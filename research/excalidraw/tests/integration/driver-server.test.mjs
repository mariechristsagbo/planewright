// Exercises the driver's HTTP boundary, runner and token file with real loopback requests.
// Steps are stubs, so no browser is started and no website is contacted.
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MAX_BODY_BYTES, TOKEN_HEADER } from '../../lib/guard.mjs';
import { FatalStepError } from '../../lib/metrics.mjs';
import { createDriverServer, createRunner, listenLoopback, writeToken } from '../../lib/server.mjs';

const dir = mkdtempSync(join(tmpdir(), 'pw-driver-test-'));
const timelineFile = join(dir, 'timeline.jsonl');
const steps = new Map(
  Object.entries({
    echo: async (_ctx, step) => ({ value: step.value ?? null }),
    fail: async () => {
      throw new Error('Step failed at /home/someone/secret/path.mjs\nstack line');
    },
    fatal: async () => {
      throw new FatalStepError('Metrics mismatch, run aborted: devicePixelRatio');
    },
    nested: async (ctx, step) => {
      for (const inner of step.trigger) await ctx.run(inner);
      return { nested: step.trigger.length };
    },
  }),
);
const scenarioFile = join(dir, 'stub-scenario.json');
writeFileSync(scenarioFile, JSON.stringify({ steps: [{ do: 'echo', value: 'from-file' }] }));
const scenarios = new Map([['stub-scenario', scenarioFile]]);

let server;
let port;
let token;
let quits = 0;

function collect(res, resolve) {
  let text = '';
  res.on('data', (chunk) => {
    text += chunk;
  });
  res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
}

function send({ path = '/run', method = 'POST', headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          host: `127.0.0.1:${String(port)}`,
          'content-type': 'application/json',
          [TOKEN_HEADER]: token,
          ...headers,
        },
      },
      (res) => collect(res, resolve),
    );
    req.on('error', reject);
    req.end(body);
  });
}

// Streams `count` chunks of `size` bytes without a Content-Length header.
function sendChunked(count, size) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path: '/run',
        method: 'POST',
        headers: {
          host: `127.0.0.1:${String(port)}`,
          'content-type': 'application/json',
          'transfer-encoding': 'chunked',
          [TOKEN_HEADER]: token,
        },
      },
      (res) => collect(res, resolve),
    );
    req.on('error', reject);
    for (let i = 0; i < count; i += 1) req.write('x'.repeat(size));
    req.end();
  });
}

const run = (batch, extra = {}) => send({ body: JSON.stringify(batch), ...extra });
const timeline = () =>
  readFileSync(timelineFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

beforeAll(async () => {
  token = writeToken(join(dir, 'driver.token'));
  const ctx = createRunner({ steps, timelineFile, base: { outDir: dir } });
  server = createDriverServer({
    ctx,
    token,
    port: () => port,
    scenarios,
    onQuit: () => {
      quits += 1;
    },
  });
  port = await listenLoopback(server, 0);
});

afterAll(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  writeFileSync(timelineFile, '');
});

describe('request boundary', () => {
  it('runs an authorised inline batch and logs each step', async () => {
    const res = await run({ steps: [{ do: 'echo', value: 1 }] });
    expect(res).toEqual({ status: 200, body: [{ do: 'echo', result: { value: 1 } }] });
    expect(timeline()).toHaveLength(1);
  });

  it.each([
    ['a missing token', { headers: { [TOKEN_HEADER]: '' } }, 401],
    ['a foreign Origin', { headers: { origin: 'https://evil.example' } }, 403],
    ['cross-site fetch metadata', { headers: { 'sec-fetch-site': 'cross-site' } }, 403],
    ['a rebinding Host', { headers: { host: `evil.example:${String(1)}` } }, 403],
    ['a form content type', { headers: { 'content-type': 'text/plain' } }, 415],
    ['GET', { method: 'GET' }, 405],
    ['an unknown route', { path: '/steps' }, 404],
  ])('rejects %s before running anything', async (_label, extra, status) => {
    const res = await run({ steps: [{ do: 'echo' }] }, extra);
    expect(res.status).toBe(status);
    expect(timeline()).toHaveLength(0);
  });
});

describe('body size cap', () => {
  it('rejects an oversized declared body with 413 and runs nothing', async () => {
    const body = JSON.stringify({ steps: [{ do: 'echo', value: 'x'.repeat(MAX_BODY_BYTES) }] });
    const res = await send({ body });
    expect(res.status).toBe(413);
    expect(timeline()).toHaveLength(0);
  });

  it('caps a chunked body without a declared length before parsing it', async () => {
    const res = await sendChunked(5, MAX_BODY_BYTES / 4);
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('Request body too large.');
  });

  it('answers malformed JSON with a sanitised 400', async () => {
    const res = await send({ body: '{"steps":' });
    expect(res.status).toBe(400);
    expect(res.body.error).not.toMatch(/\n/u);
  });
});

describe('runner and timeline', () => {
  it('records null, primitive and unknown steps as failed rows and continues on request', async () => {
    const res = await run({
      continueOnError: true,
      steps: [null, 42, { do: 'constructor' }, { do: '__proto__' }, { do: 'echo', value: 2 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.map((r) => r.error ?? 'ok')).toEqual([
      'Unknown step name.',
      'Unknown step name.',
      'Unknown step name.',
      'Unknown step name.',
      'ok',
    ]);
    const rows = timeline();
    expect(rows).toHaveLength(5);
    expect(rows[0].step).toEqual({ invalid: 'object' });
    expect(rows[1].step).toEqual({ invalid: 'number' });
  });

  it('stores failures with a sanitised one-line message', async () => {
    await run({ continueOnError: true, steps: [{ do: 'fail' }] });
    const [row] = timeline();
    expect(row.error).toBe('Step failed at <path>');
    expect(row.result).toBeUndefined();
  });

  it('stops at the first failure unless continueOnError is set', async () => {
    const res = await run({ steps: [{ do: 'fail' }, { do: 'echo' }] });
    expect(res.body).toHaveLength(1);
  });

  it('always stops at a fatal step, even with continueOnError', async () => {
    const res = await run({ continueOnError: true, steps: [{ do: 'fatal' }, { do: 'echo' }] });
    expect(res.body).toEqual([
      { do: 'fatal', error: 'Metrics mismatch, run aborted: devicePixelRatio', fatal: true },
    ]);
    expect(timeline()[0].fatal).toBe(true);
  });

  it('logs nested trigger steps as their own rows', async () => {
    await run({ steps: [{ do: 'nested', trigger: [{ do: 'echo' }, { do: 'echo' }] }] });
    expect(timeline().map((r) => r.step.do)).toEqual(['echo', 'echo', 'nested']);
  });
});

describe('scenarios', () => {
  it('runs a scenario by name from the driver listing', async () => {
    const res = await run({ scenario: 'stub-scenario' });
    expect(res.body).toEqual([{ do: 'echo', result: { value: 'from-file' } }]);
  });

  it.each(['__proto__', 'constructor', '../stub-scenario', scenarioFile])(
    'rejects the scenario name %s',
    async (scenario) => {
      const res = await run({ scenario });
      expect(res).toEqual({ status: 400, body: { error: 'Unknown scenario name.' } });
    },
  );
});

describe('quit and token', () => {
  it('protects /quit with method, Host, Origin and token checks', async () => {
    expect((await send({ path: '/quit', method: 'GET' })).status).toBe(405);
    expect((await send({ path: '/quit', headers: { [TOKEN_HEADER]: 'x' } })).status).toBe(401);
    expect((await send({ path: '/quit', headers: { origin: 'null' } })).status).toBe(403);
    expect(quits).toBe(0);
    expect(await send({ path: '/quit', body: '{}' })).toEqual({
      status: 200,
      body: { bye: true },
    });
    expect(quits).toBe(1);
  });

  it('writes a 64-hex token with mode 600 and replaces a stale, readable file', () => {
    const file = join(dir, 'stale.token');
    writeFileSync(file, 'old', { mode: 0o644 });
    const fresh = writeToken(file);
    expect(fresh).toMatch(/^[0-9a-f]{64}$/u);
    expect(readFileSync(file, 'utf8')).toBe(fresh);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(writeToken(file)).not.toBe(fresh);
  });
});
