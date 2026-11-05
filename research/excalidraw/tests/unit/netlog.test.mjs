// Exercises the metadata-only netlog with a stub page that emits Playwright-style events and a
// stub clock, so each entry's write time and its request's start time are known exactly.
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { attachNetlog } from '../../lib/netlog.mjs';

const dirs = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

// Each read of the clock moves it on by one second from a fixed start.
function stubClock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 0, 1) + tick++ * 1000);
}

function stubPage() {
  const page = new EventEmitter();
  const main = { url: () => 'about:blank' };
  page.mainFrame = () => main;
  return page;
}

function stubRequest(url, response = { status: () => 200, fromServiceWorker: () => false }) {
  return {
    url: () => url,
    method: () => 'GET',
    resourceType: () => 'script',
    response: () => Promise.resolve(response),
    failure: () => ({ errorText: 'net::ERR_FAILED' }),
  };
}

function attach() {
  const dir = mkdtempSync(join(tmpdir(), 'netlog-test-'));
  dirs.push(dir);
  const page = stubPage();
  attachNetlog(page, dir, stubClock());
  const entries = () =>
    readFileSync(join(dir, 'netlog.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  return { page, entries };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('attachNetlog request start times', () => {
  it('writes when a request started beside when it finished', async () => {
    const { page, entries } = attach();
    const request = stubRequest('https://example.test/a.js?v=SECRET#frag');
    page.emit('request', request);
    page.emit('requestfinished', request);
    await settle();
    const [entry] = entries();
    expect(entry).toMatchObject({
      at: '2026-01-01T00:00:01.000Z',
      event: 'request',
      startedAt: '2026-01-01T00:00:00.000Z',
      status: 200,
      origin: 'https://example.test',
      path: '/a.js',
      queryKeys: ['v'],
    });
    expect(JSON.stringify(entry).includes('SECRET')).toBe(false);
  });

  it('keeps the start of a failed request', async () => {
    const { page, entries } = attach();
    const request = stubRequest('https://example.test/b.js');
    page.emit('request', request);
    page.emit('requestfailed', request);
    await settle();
    expect(entries()).toEqual([
      expect.objectContaining({
        at: '2026-01-01T00:00:01.000Z',
        event: 'request-failed',
        startedAt: '2026-01-01T00:00:00.000Z',
        failure: 'net::ERR_FAILED',
      }),
    ]);
  });

  it('writes a null start for a request whose start it did not see', async () => {
    const { page, entries } = attach();
    page.emit('requestfinished', stubRequest('https://example.test/c.js'));
    await settle();
    expect(entries()[0].startedAt).toBeNull();
  });
});

describe('attachNetlog request entry keys', () => {
  it('records the same keys as before, plus the start, and no headers or bodies', async () => {
    const { page, entries } = attach();
    const request = stubRequest('https://example.test/d.js');
    page.emit('request', request);
    page.emit('requestfinished', request);
    await settle();
    expect(Object.keys(entries()[0]).sort()).toEqual(
      [
        'at',
        'event',
        'startedAt',
        'method',
        'type',
        'status',
        'fromServiceWorker',
        'origin',
        'path',
        'queryKeys',
        'hasFragment',
      ].sort(),
    );
  });
});
