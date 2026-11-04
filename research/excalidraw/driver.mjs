// External interaction driver for behavioural research.
//
// Holds one Playwright CDP connection to an already-running, disposable, loopback-only browser
// so that REA can observe the same page passively while interaction batches run. Accepts step
// batches over a loopback-only HTTP endpoint and appends every step, including failed ones, to
// a timeline. A request body is an inline batch ({ steps: [...] }) or { scenario: "<name>" }.
// Every request must be a POST to 127.0.0.1:<port> carrying the per-run token from
// <out>/driver.token in the x-research-token header; see lib/guard.mjs for the full policy.
//
// Usage: node research/excalidraw/driver.mjs --cdp http://127.0.0.1:9222 --port 9333 --out <dir>
import { mkdirSync, readdirSync } from 'node:fs';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { chromium } from 'playwright-core';

import { parsePort } from './lib/guard.mjs';
import { attachNetlog } from './lib/netlog.mjs';
import { probes } from './lib/probes.mjs';
import { createDriverServer, createRunner, listenLoopback, writeToken } from './lib/server.mjs';
import { handlers } from './lib/steps.mjs';

// A Map lookup keeps step names from reaching inherited object properties.
const STEPS = new Map(Object.entries({ ...handlers, ...probes }));

// Scenario files are read from this directory's own listing; clients send only a name, so
// scenario file contents never travel over HTTP.
const SCENARIO_DIR = join(dirname(fileURLToPath(import.meta.url)), 'scenarios');
const SCENARIOS = new Map(
  readdirSync(SCENARIO_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => [basename(name, '.json'), join(SCENARIO_DIR, name)]),
);

function options() {
  const { values } = parseArgs({
    options: {
      cdp: { type: 'string', default: 'http://127.0.0.1:9222' },
      port: { type: 'string', default: '9333' },
      out: { type: 'string' },
    },
  });
  const cdp = new URL(values.cdp);
  if (cdp.protocol !== 'http:' || cdp.hostname !== '127.0.0.1') {
    throw new Error('The CDP endpoint must be http://127.0.0.1:<port>.');
  }
  parsePort(cdp.port, 'CDP port');
  if (!values.out || !isAbsolute(values.out)) {
    throw new Error('--out <absolute directory> is required.');
  }
  return { cdp: values.cdp, port: parsePort(values.port), out: values.out };
}

async function connect(cdpUrl) {
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.newPage());
  const cdp = await context.newCDPSession(page);
  return { browser, page, cdp };
}

const opts = options();
for (const sub of ['screenshots', 'downloads', 'aria']) {
  mkdirSync(join(opts.out, sub), { recursive: true });
}
const session = await connect(opts.cdp);
const ctx = createRunner({
  steps: STEPS,
  timelineFile: join(opts.out, 'timeline.jsonl'),
  base: { ...session, outDir: opts.out },
});
attachNetlog(session.page, opts.out);
const token = writeToken(join(opts.out, 'driver.token'));
const server = createDriverServer({
  ctx,
  token,
  port: () => opts.port,
  scenarios: SCENARIOS,
  onQuit: () => {
    server.close();
    // Disconnect only; the browser belongs to the disposable container and is stopped separately.
    void session.browser.close().finally(() => process.exit(0));
  },
});
const bound = await listenLoopback(server, opts.port);
console.log(`driver listening on 127.0.0.1:${String(bound)}`);
