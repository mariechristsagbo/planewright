// External interaction driver for behavioural research.
//
// Holds one Playwright CDP connection to an already-running, disposable, loopback-only browser
// so that REA can observe the same page passively between interaction batches. Accepts step
// batches over a loopback-only HTTP endpoint and appends every executed step to a timeline.
// A request body is an inline batch ({ steps: [...] }) or { scenario: "<name>" }.
// Every request must be a POST to 127.0.0.1:<port> carrying the per-run token from
// <out>/driver.token in the x-research-token header; /run also requires application/json.
//
// Usage: node research/excalidraw/driver.mjs --cdp http://127.0.0.1:9222 --port 9333 --out <dir>
import { randomBytes } from 'node:crypto';
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { chromium } from 'playwright-core';

import { checkRequest, sanitiseError } from './lib/guard.mjs';
import { attachNetlog } from './lib/netlog.mjs';
import { probes } from './lib/probes.mjs';
import { handlers } from './lib/steps.mjs';

const LOOPBACK = '127.0.0.1';
// A Map lookup keeps step names from reaching inherited object properties.
const STEPS = new Map(Object.entries({ ...handlers, ...probes }));

// Scenario files are read from this directory's own listing; clients send only a name, so file
// contents never travel over HTTP and no client-supplied path reaches the filesystem.
const SCENARIO_DIR = join(dirname(fileURLToPath(import.meta.url)), 'scenarios');
const SCENARIOS = new Map(
  readdirSync(SCENARIO_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => [basename(name, '.json'), join(SCENARIO_DIR, name)]),
);

function toBatch(body) {
  if (typeof body.scenario !== 'string') return body;
  const file = SCENARIOS.get(body.scenario);
  if (!file) throw new Error('Unknown scenario name.');
  return JSON.parse(readFileSync(file, 'utf8'));
}

function options() {
  const { values } = parseArgs({
    options: {
      cdp: { type: 'string', default: 'http://127.0.0.1:9222' },
      port: { type: 'string', default: '9333' },
      out: { type: 'string' },
    },
  });
  const cdp = new URL(values.cdp);
  if (cdp.hostname !== LOOPBACK) throw new Error('The CDP endpoint must be on 127.0.0.1.');
  if (!values.out) throw new Error('--out <absolute directory> is required.');
  return { cdp: values.cdp, port: Number(values.port), out: values.out };
}

async function connect(cdpUrl) {
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.newPage());
  const cdp = await context.newCDPSession(page);
  return { browser, page, cdp };
}

function createContext(session, outDir) {
  for (const sub of ['screenshots', 'downloads', 'aria']) {
    mkdirSync(join(outDir, sub), { recursive: true });
  }
  const timeline = join(outDir, 'timeline.jsonl');
  const ctx = { ...session, outDir };
  ctx.run = async (step) => {
    const started = new Date().toISOString();
    try {
      const handler = typeof step.do === 'string' ? STEPS.get(step.do) : undefined;
      if (typeof handler !== 'function') throw new Error('Unknown step name.');
      const result = await handler(ctx, step);
      appendFileSync(timeline, `${JSON.stringify({ started, step, result })}\n`);
      return { do: step.do, result };
    } catch (error) {
      // Failed steps are evidence too; record them with a sanitised message.
      appendFileSync(
        timeline,
        `${JSON.stringify({ started, step, error: sanitiseError(error) })}\n`,
      );
      throw error;
    }
  };
  return ctx;
}

async function runBatch(ctx, batch) {
  if (!Array.isArray(batch?.steps)) throw new Error('A batch needs a "steps" array.');
  const results = [];
  for (const step of batch.steps) {
    try {
      results.push(await ctx.run(step));
    } catch (error) {
      results.push({ do: step.do, error: sanitiseError(error) });
      if (!batch.continueOnError) break;
    }
  }
  return results;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function serve(ctx, { port, token }, shutdown) {
  const server = createServer(async (request, response) => {
    const reply = (status, body) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body, null, 1));
    };
    const rejected = checkRequest(request, { token, port });
    if (rejected) {
      request.resume();
      reply(rejected.status, { error: rejected.error });
      return;
    }
    if (request.url === '/quit') {
      reply(200, { bye: true });
      shutdown(server);
      return;
    }
    try {
      reply(200, await runBatch(ctx, toBatch(JSON.parse(await readBody(request)))));
    } catch (error) {
      reply(400, { error: sanitiseError(error) });
    }
  });
  server.listen(port, LOOPBACK, () => console.log(`driver listening on ${LOOPBACK}:${port}`));
}

const opts = options();
const session = await connect(opts.cdp);
const ctx = createContext(session, opts.out);
attachNetlog(session.page, opts.out);
// A fresh random token per run, readable only by the current user.
const token = randomBytes(32).toString('hex');
writeFileSync(join(opts.out, 'driver.token'), token, { mode: 0o600 });
serve(ctx, { port: opts.port, token }, (server) => {
  server.close();
  // Disconnect only; the browser belongs to the disposable container and is stopped separately.
  void session.browser.close().finally(() => process.exit(0));
});
