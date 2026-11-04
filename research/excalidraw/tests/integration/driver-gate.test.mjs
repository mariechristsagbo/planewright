// Exercises batch admission (one batch at a time, the runLast lock) over real loopback HTTP, and
// the runner's halt check. Steps are stubs, so no browser is started and no website is contacted.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { TOKEN_HEADER } from '../../lib/guard.mjs';
import { createDriverServer, createGate, createRunner, listenLoopback } from '../../lib/server.mjs';

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
const ECHO = [{ do: 'echo' }];
const scenarios = new Map([
  scenarioFile('plain', { steps: ECHO }),
  scenarioFile('final-a', { runLast: true, steps: ECHO }),
  scenarioFile('final-b', { runLast: true, steps: ECHO }),
]);

async function startDriver() {
  let release = () => undefined;
  const gateOpen = new Promise((resolve) => {
    release = resolve;
  });
  const steps = new Map(
    Object.entries({ echo: async () => ({ ok: true }), hold: async () => gateOpen }),
  );
  const ctx = createRunner({ steps, timelineFile: join(dir, 'timeline.jsonl'), base: {} });
  let port = 0;
  const token = 'b'.repeat(64);
  const server = createDriverServer({
    ctx,
    token,
    port: () => port,
    scenarios,
    onQuit: () => undefined,
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
  return { post, release };
}

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
});
