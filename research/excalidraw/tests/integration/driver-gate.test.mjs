// Exercises batch admission (one batch at a time, the runLast lock) over real loopback HTTP, and
// the runner's halt check. Steps are stubs, so no browser is started and no website is contacted.
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterAll, describe, expect, it } from 'vitest';

import { TOKEN_HEADER } from '../../lib/guard.mjs';
import { countSecretShapes } from '../../lib/sanitise.mjs';
import { createDriverServer, createGate, createRunner, listenLoopback } from '../../lib/server.mjs';
import { openSessionState } from '../../lib/session-state.mjs';
import { handlers } from '../../lib/steps.mjs';

const dir = mkdtempSync(join(tmpdir(), 'pw-gate-test-'));
const servers = [];
afterAll(() => {
  for (const server of servers) server.close();
  rmSync(dir, { recursive: true, force: true });
});

const scenarioFile = (name, batch) => {
  const file = join(dir, `${name}.json`);
  writeFileSync(file, JSON.stringify(batch));
  return [name, file];
};
// Synthetic, low-entropy room value built at run time (see sanitise.test.mjs).
const ROOM_URL = `https://excalidraw.com/#room=${'a1B2'.repeat(5)},${'k_L-'.repeat(5)}m1`;
const REDACTED_URL = 'https://excalidraw.com/#room=<redacted>';
const TOKEN = 'b'.repeat(64);
const RUN_CLIENT = fileURLToPath(new URL('../../run.mjs', import.meta.url));
const ECHO = [{ do: 'echo' }];
const scenarios = new Map([
  scenarioFile('plain', { steps: ECHO }),
  scenarioFile('final-a', { runLast: true, steps: ECHO }),
  scenarioFile('final-b', { runLast: true, steps: ECHO }),
]);

// `extra` adds step handlers and context fields to the stub driver.
async function startDriver(state, extra = {}) {
  let release = () => undefined;
  const gateOpen = new Promise((resolve) => {
    release = resolve;
  });
  const steps = new Map(
    Object.entries({
      echo: async () => ({ ok: true }),
      hold: async () => gateOpen,
      ...extra.steps,
    }),
  );
  const ctx = createRunner({ steps, timelineFile: join(dir, 'timeline.jsonl'), base: extra.base });
  let port = 0;
  const token = TOKEN;
  const server = createDriverServer({
    ctx,
    token,
    port: () => port,
    scenarios,
    onQuit: () => undefined,
    state,
  });
  servers.push(server);
  port = await listenLoopback(server, 0);
  const post = async (body) => {
    const res = await fetch(`http://127.0.0.1:${String(port)}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [TOKEN_HEADER]: token },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  return { post, release, port };
}

// A page whose locators record what they were asked to click.
const stubPage = (clicked) => {
  const target = (what) => ({ click: async () => clicked.push(what) });
  return {
    locator: (selector) => ({ first: () => target(selector) }),
    getByRole: (_role, { name }) => ({ first: () => target(name) }),
  };
};

describe('one batch at a time', () => {
  it('refuses a batch that arrives while another runs, and runs nothing from it', async () => {
    const { post, release } = await startDriver();
    const first = post({ steps: [{ do: 'hold' }] });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const second = await post({ steps: [{ do: 'echo' }] });
    expect(second).toEqual({ status: 409, body: { error: 'Another batch is running.' } });
    release();
    expect((await first).status).toBe(200);
    expect((await post({ steps: ECHO })).status).toBe(200);
  });
});

describe('runLast lock', () => {
  it('admits only unrun runLast scenarios once one has started', async () => {
    const { post } = await startDriver();
    expect((await post({ scenario: 'plain' })).status).toBe(200);
    expect((await post({ scenario: 'final-a' })).status).toBe(200);
    expect((await post({ scenario: 'plain' })).status).toBe(409);
    expect((await post({ steps: ECHO })).status).toBe(409);
    expect((await post({ scenario: 'final-a' })).body.error).toMatch(/at most once/u);
    expect((await post({ scenario: 'final-b' })).status).toBe(200);
  });

  it('keeps the lock across a driver restart on the same session directory', async () => {
    const file = join(dir, 'driver-state.json');
    const before = await startDriver(openSessionState(file));
    expect((await before.post({ scenario: 'final-a' })).status).toBe(200);
    const after = await startDriver(openSessionState(file));
    expect((await after.post({ scenario: 'plain' })).body.error).toMatch(/only runLast follow/u);
    expect((await after.post({ steps: ECHO })).status).toBe(409);
    expect((await after.post({ scenario: 'final-a' })).body.error).toMatch(/at most once/u);
    expect((await after.post({ scenario: 'final-b' })).status).toBe(200);
  });

  it('ignores runLast on inline batches, which can neither lock nor pass the lock', () => {
    const gate = createGate();
    expect(gate.admit(null, { runLast: true })).toBeNull();
    gate.release();
    expect(gate.admit('plain', { steps: [] })).toBeNull();
    gate.release();
    expect(gate.admit('final-a', { runLast: true })).toBeNull();
    gate.release();
    expect(gate.admit(null, { runLast: true })).toMatch(/only runLast follow/u);
  });
});

describe('halted runner', () => {
  it('fails every step fatally, before its handler runs, once a halt reason exists', async () => {
    let calls = 0;
    const steps = new Map([['echo', async () => (calls += 1)]]);
    const timelineFile = join(dir, 'halted.jsonl');
    const base = { halted: () => 'the page opened a popup.' };
    const ctx = createRunner({ steps, timelineFile, base });
    const error = await ctx.run({ do: 'echo' }).catch((e) => e);
    expect(error).toMatchObject({
      fatal: true,
      message: 'Session halted: the page opened a popup.',
    });
    expect(calls).toBe(0);
    expect(JSON.parse(readFileSync(timelineFile, 'utf8'))).toMatchObject({ fatal: true });
  });

  it('redacts room and link values in step records before they reach the timeline', async () => {
    const url = ROOM_URL;
    const seen = [];
    const steps = new Map([['echo', async (_ctx, step) => seen.push(step.url)]]);
    const timelineFile = join(dir, 'redacted.jsonl');
    const ctx = createRunner({ steps, timelineFile, base: {} });
    const step = { do: 'echo', url, nested: [{ text: url }] };
    await ctx.run(step);
    await ctx.run({ do: 'missing', url }).catch(() => undefined);
    const text = readFileSync(timelineFile, 'utf8');
    expect(countSecretShapes(text)).toEqual({});
    expect(text.match(/#room=<redacted>/gu)).toHaveLength(3);
    // The handler still gets the step as sent, and the caller's object is left unchanged.
    expect(seen).toEqual([url]);
    expect(step.nested[0].text).toBe(url);
  });

  it('treats an empty halt reason as halted, never as clear', async () => {
    let calls = 0;
    const steps = new Map([['echo', async () => (calls += 1)]]);
    const timelineFile = join(dir, 'halted-empty.jsonl');
    const ctx = createRunner({ steps, timelineFile, base: { halted: () => '' } });
    await expect(ctx.run({ do: 'echo' })).rejects.toMatchObject({ fatal: true });
    expect(calls).toBe(0);
  });
});

describe('timeline redaction', () => {
  it('redacts the results of the real selector and role handlers, which echo the step', async () => {
    const url = ROOM_URL;
    const clicked = [];
    const page = stubPage(clicked);
    const steps = new Map([
      ['selector', handlers.selector],
      ['role', handlers.role],
    ]);
    const timelineFile = join(dir, 'redacted-results.jsonl');
    const ctx = createRunner({ steps, timelineFile, base: { page } });
    await ctx.run({ do: 'selector', selector: `a[href="${url}"]` });
    await ctx.run({ do: 'role', role: 'link', name: url });
    const text = readFileSync(timelineFile, 'utf8');
    expect(countSecretShapes(text)).toEqual({});
    const rows = text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(rows.map((row) => row.result)).toEqual([
      { selector: 'a[href="https://excalidraw.com/#room=<redacted>"]' },
      { role: 'link', name: 'https://excalidraw.com/#room=<redacted>' },
    ]);
    // The page still received the selector and the name as sent.
    expect(clicked).toEqual([`a[href="${url}"]`, url]);
  });

  it('redacts room values in key names, in the step record and in the result', async () => {
    const steps = new Map([['echo', async () => ({ [ROOM_URL]: 'result' })]]);
    const timelineFile = join(dir, 'redacted-keys.jsonl');
    const ctx = createRunner({ steps, timelineFile, base: {} });
    await ctx.run({ do: 'echo', nested: [{ [ROOM_URL]: 'step' }] });
    const text = readFileSync(timelineFile, 'utf8');
    expect(countSecretShapes(text)).toEqual({});
    const redacted = 'https://excalidraw.com/#room=<redacted>';
    const row = JSON.parse(text);
    expect(row.step.nested).toEqual([{ [redacted]: 'step' }]);
    expect(row.result).toEqual({ [redacted]: 'result' });
  });

  it('redacts room values nested in a result, in lists, objects and key names', async () => {
    // Shaped like real results: storage key lists, chooser file names, mask boxes per selector.
    const nested = (value) => ({
      storage: { localStorage: { kind: 'object', keys: ['theme', value] } },
      files: [{ name: value, bytes: 3 }],
      maskBoxes: [[{ selector: value, width: 10 }]],
      byKey: { outer: { [value]: { inner: [value] } } },
    });
    const steps = new Map([['echo', async () => nested(ROOM_URL)]]);
    const timelineFile = join(dir, 'redacted-nested.jsonl');
    const ctx = createRunner({ steps, timelineFile, base: {} });
    await ctx.run({ do: 'echo' });
    const text = readFileSync(timelineFile, 'utf8');
    expect(countSecretShapes(text)).toEqual({});
    expect(JSON.parse(text).result).toEqual(nested('https://excalidraw.com/#room=<redacted>'));
  });
});

describe('reply redaction', () => {
  it('sends the redacted results in the HTTP reply and in what run.mjs prints', async () => {
    const clicked = [];
    let kept = null;
    const { post, port } = await startDriver(undefined, {
      steps: {
        selector: handlers.selector,
        role: handlers.role,
        keep: async () => (kept = { url: ROOM_URL }),
      },
      base: { page: stubPage(clicked) },
    });
    const batch = {
      steps: [
        { do: 'selector', selector: `a[href="${ROOM_URL}"]` },
        { do: 'role', role: 'link', name: ROOM_URL },
        { do: 'keep' },
      ],
    };
    const reply = await post(batch);
    writeFileSync(join(dir, 'driver.token'), TOKEN);
    const client = [RUN_CLIENT, '--port', String(port), '--out', dir, JSON.stringify(batch)];
    const { stdout } = await promisify(execFile)(process.execPath, client);
    expect(countSecretShapes(JSON.stringify(reply.body))).toEqual({});
    expect(countSecretShapes(stdout)).toEqual({});
    expect(reply.body).toEqual([
      { do: 'selector', result: { selector: `a[href="${REDACTED_URL}"]` } },
      { do: 'role', result: { role: 'link', name: REDACTED_URL } },
      { do: 'keep', result: { url: REDACTED_URL } },
    ]);
    expect(JSON.parse(stdout)).toEqual(reply.body);
    // Handlers still receive the step as sent, and their own result object is left unchanged.
    const sent = [`a[href="${ROOM_URL}"]`, ROOM_URL];
    expect(clicked).toEqual([...sent, ...sent]);
    expect(kept).toEqual({ url: ROOM_URL });
  });
});
