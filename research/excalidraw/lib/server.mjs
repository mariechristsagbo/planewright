// HTTP wiring and step runner for the loopback research driver. Kept separate from the browser
// connection so that the request boundary, timeline logging and token handling can be tested
// with stub steps and real HTTP requests.
import { randomBytes } from 'node:crypto';
import { appendFileSync, chmodSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';

import { MAX_BODY_BYTES, checkRequest, sanitiseError } from './guard.mjs';

const LOOPBACK = '127.0.0.1';

const stepName = (step) =>
  step !== null && typeof step === 'object' && typeof step.do === 'string' ? step.do : null;

/**
 * Creates the step runner. Every step, successful or not, is appended to the timeline; failures
 * keep only a sanitised one-line message. `steps` is a Map so names never reach inherited
 * object properties.
 */
export function createRunner({ steps, timelineFile, base }) {
  const ctx = { ...base };
  ctx.run = async (step) => {
    const started = new Date().toISOString();
    const record = step !== null && typeof step === 'object' ? step : { invalid: typeof step };
    try {
      const handler = steps.get(stepName(step) ?? '');
      if (typeof handler !== 'function') throw new Error('Unknown step name.');
      const result = await handler(ctx, step);
      appendFileSync(timelineFile, `${JSON.stringify({ started, step: record, result })}\n`);
      return { do: step.do, result };
    } catch (error) {
      const fatal = error?.fatal === true;
      const row = { started, step: record, error: sanitiseError(error), ...(fatal && { fatal }) };
      appendFileSync(timelineFile, `${JSON.stringify(row)}\n`);
      throw error;
    }
  };
  return ctx;
}

/** Runs a batch in order. A fatal error (for example a metrics mismatch) always stops it. */
export async function runBatch(ctx, batch) {
  if (!Array.isArray(batch?.steps)) throw new Error('A batch needs a "steps" array.');
  const results = [];
  for (const step of batch.steps) {
    try {
      results.push(await ctx.run(step));
    } catch (error) {
      const fatal = error?.fatal === true;
      results.push({ do: stepName(step), error: sanitiseError(error), ...(fatal && { fatal }) });
      if (fatal || batch.continueOnError !== true) break;
    }
  }
  return results;
}

/** Reads a request body, failing as soon as it exceeds the cap; nothing is parsed before that. */
export function readCappedBody(request, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        const error = new Error('Request body too large.');
        error.status = 413;
        request.removeAllListeners('data');
        request.resume();
        reject(error);
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

/** Turns a request body into a batch: a named scenario from the driver's listing, or inline. */
export function toBatch(body, scenarios) {
  const parsed = JSON.parse(body);
  if (parsed === null || typeof parsed !== 'object') throw new Error('A batch must be an object.');
  if (typeof parsed.scenario !== 'string') return parsed;
  const file = scenarios.get(parsed.scenario);
  if (!file) throw new Error('Unknown scenario name.');
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * Creates the loopback HTTP server. Requests are checked before any body byte is read; /quit
 * calls `onQuit` once. The caller chooses when to listen.
 */
export function createDriverServer({ ctx, token, port, scenarios, onQuit }) {
  return createServer(async (request, response) => {
    const reply = (status, body) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body, null, 1));
    };
    const rejected = checkRequest(request, { token, port: port() });
    if (rejected) {
      request.resume();
      reply(rejected.status, { error: rejected.error });
      return;
    }
    if (request.url === '/quit') {
      request.resume();
      reply(200, { bye: true });
      onQuit();
      return;
    }
    try {
      const batch = toBatch(await readCappedBody(request), scenarios);
      reply(200, await runBatch(ctx, batch));
    } catch (error) {
      reply(error?.status === 413 ? 413 : 400, { error: sanitiseError(error) });
    }
  });
}

/** Listens on the loopback interface only and resolves with the bound port. */
export function listenLoopback(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, LOOPBACK, () => resolve(server.address().port));
  });
}

/**
 * Writes a fresh 32-byte token readable only by the current user. An existing file is removed
 * first, so a stale file's permissions can never be inherited.
 */
export function writeToken(file) {
  const token = randomBytes(32).toString('hex');
  rmSync(file, { force: true });
  writeFileSync(file, token, { mode: 0o600, flag: 'wx' });
  chmodSync(file, 0o600);
  return token;
}
