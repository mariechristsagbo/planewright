import { describe, expect, it } from 'vitest';

import {
  MAX_BODY_BYTES,
  TOKEN_HEADER,
  checkNavigation,
  checkRequest,
  fixturePath,
  isAllowedNavigation,
  outputPath,
  parsePort,
  safeDownloadName,
  safeName,
  sanitiseError,
} from '../../lib/guard.mjs';

const TOKEN = 'a'.repeat(64);
const PORT = 9333;
const goodHeaders = {
  host: '127.0.0.1:9333',
  'content-type': 'application/json',
  [TOKEN_HEADER]: TOKEN,
};
const request = (overrides = {}) => ({
  method: 'POST',
  url: '/run',
  headers: { ...goodHeaders },
  ...overrides,
});

describe('checkRequest', () => {
  it('accepts a POST to /run with Host, token and JSON', () => {
    expect(checkRequest(request(), { token: TOKEN, port: PORT })).toBeNull();
  });

  it('protects /quit with the same Host and token checks', () => {
    expect(checkRequest(request({ url: '/quit' }), { token: TOKEN, port: PORT })).toBeNull();
    const noToken = request({ url: '/quit', headers: { host: goodHeaders.host } });
    expect(checkRequest(noToken, { token: TOKEN, port: PORT })?.status).toBe(401);
    expect(
      checkRequest(request({ url: '/quit', method: 'GET' }), { token: TOKEN, port: PORT })?.status,
    ).toBe(405);
  });

  it.each([
    ['unknown route', request({ url: '/' }), 404],
    ['GET', request({ method: 'GET' }), 405],
    ['localhost Host', request({ headers: { ...goodHeaders, host: 'localhost:9333' } }), 403],
    ['rebinding Host', request({ headers: { ...goodHeaders, host: 'evil.example:9333' } }), 403],
    ['wrong port', request({ headers: { ...goodHeaders, host: '127.0.0.1:80' } }), 403],
    [
      'missing token',
      request({ headers: { host: goodHeaders.host, 'content-type': 'application/json' } }),
      401,
    ],
    ['wrong token', request({ headers: { ...goodHeaders, [TOKEN_HEADER]: 'b'.repeat(64) } }), 401],
    ['short token', request({ headers: { ...goodHeaders, [TOKEN_HEADER]: 'a' } }), 401],
    ['form body', request({ headers: { ...goodHeaders, 'content-type': 'text/plain' } }), 415],
    [
      'foreign Origin',
      request({ headers: { ...goodHeaders, origin: 'https://evil.example' } }),
      403,
    ],
    ['null Origin', request({ headers: { ...goodHeaders, origin: 'null' } }), 403],
    [
      'cross-site fetch metadata',
      request({ headers: { ...goodHeaders, 'sec-fetch-site': 'cross-site' } }),
      403,
    ],
    [
      'oversized declared body',
      request({ headers: { ...goodHeaders, 'content-length': String(MAX_BODY_BYTES + 1) } }),
      413,
    ],
  ])('rejects %s', (_label, req, status) => {
    expect(checkRequest(req, { token: TOKEN, port: PORT })?.status).toBe(status);
  });
});

describe('checkRequest origin and content rules', () => {
  it('accepts a same-origin loopback Origin and same-origin fetch metadata', () => {
    const req = request({
      headers: { ...goodHeaders, origin: 'http://127.0.0.1:9333', 'sec-fetch-site': 'same-origin' },
    });
    expect(checkRequest(req, { token: TOKEN, port: PORT })).toBeNull();
  });

  it('checks Origin before the token, so a browser page learns nothing about the token', () => {
    const req = request({
      headers: { host: goodHeaders.host, origin: 'https://evil.example' },
    });
    expect(checkRequest(req, { token: TOKEN, port: PORT })?.error).toBe('Bad Origin.');
  });

  it('accepts a JSON content type with parameters', () => {
    const req = request({
      headers: { ...goodHeaders, 'content-type': 'application/json; charset=utf-8' },
    });
    expect(checkRequest(req, { token: TOKEN, port: PORT })).toBeNull();
  });
});

describe('names and paths', () => {
  it('accepts plain names', () => {
    expect(safeName('ui-01-main-menu')).toBe('ui-01-main-menu');
    expect(safeName('test-64x48.png')).toBe('test-64x48.png');
  });

  it.each(['../x', '/etc/passwd', 'a/b', 'a\\b', '..', '.hidden', '', 'a..b', 'x'.repeat(81), 42])(
    'rejects %s',
    (value) => {
      expect(() => safeName(value)).toThrow(/Invalid/u);
    },
  );

  it('confines fixtures and outputs to their directories', () => {
    expect(fixturePath('/tmp/out/s1', 'test.png')).toBe('/tmp/out/fixtures/test.png');
    expect(outputPath('/tmp/out/s1', 'aria', 'menu', '.yml')).toBe('/tmp/out/s1/aria/menu.yml');
    expect(() => fixturePath('/tmp/out/s1', '/etc/passwd')).toThrow(/Invalid/u);
    expect(() => outputPath('/tmp/out/s1', 'screenshots', '../../x', '.png')).toThrow(/Invalid/u);
  });

  it('reduces server-suggested download names behind our own prefix', () => {
    expect(safeDownloadName('io-01', '../../etc/passwd')).toBe('io-01-etc_passwd');
    expect(safeDownloadName('io-01', 'My Drawing (1).png')).toBe('io-01-My_Drawing_1_.png');
    expect(safeDownloadName('io-01', '///')).toBe('io-01');
    expect(() => safeDownloadName('../x', 'a.png')).toThrow(/Invalid/u);
  });

  it.each([
    ['a long name', 'x'.repeat(200)],
    ['dot runs', 'scene..excalidraw'],
    ['trailing dots', 'scene...'],
    ['a long prefix', 'y'.repeat(90)],
  ])('keeps download names valid for %s', (_label, suggested) => {
    const name = safeDownloadName('p'.repeat(70), suggested);
    expect(name.length).toBeLessThanOrEqual(80);
    expect(name).not.toContain('..');
    expect(safeName(name)).toBe(name);
  });
});

describe('parsePort', () => {
  it.each(['1024', '9333', '65535', 9333])('accepts %s', (value) => {
    expect(parsePort(value)).toBe(Number(value));
  });

  it.each(['80', '0', '65536', '9333abc', '-1', '', '9.5', '0x2000', undefined])(
    'rejects %s',
    (value) => {
      expect(() => parsePort(value)).toThrow(/Invalid port/u);
    },
  );
});

describe('checkNavigation', () => {
  it.each(['https://excalidraw.com/', 'https://excalidraw.com/?x=1', 'about:blank'])(
    'allows %s',
    (url) => {
      expect(() => checkNavigation(url)).not.toThrow();
    },
  );

  it.each([
    'http://excalidraw.com/',
    'https://excalidraw.com.evil.example/',
    'https://user:pw@excalidraw.com/',
    'https://excalidraw.com:8443/',
    'https://plus.excalidraw.com/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,x',
    // A blob: URL reports the origin that created it, so the scheme must be checked as well.
    'blob:https://excalidraw.com/0f8fad5b-d9cb-469f-a165-70867728950e',
    'blob:null/0f8fad5b-d9cb-469f-a165-70867728950e',
    'about:blank#room=x',
    'not a url',
    42,
  ])('refuses %s', (url) => {
    expect(() => checkNavigation(url)).toThrow(/Navigation refused/u);
  });
});

describe('isAllowedNavigation', () => {
  it('applies the same allowlist without throwing', () => {
    expect(isAllowedNavigation('https://excalidraw.com/#x')).toBe(true);
    expect(isAllowedNavigation('about:blank')).toBe(true);
    expect(isAllowedNavigation('blob:https://excalidraw.com/0f8fad5b')).toBe(false);
    expect(isAllowedNavigation('chrome-error://chromewebdata/')).toBe(false);
    expect(isAllowedNavigation(undefined)).toBe(false);
  });
});

describe('sanitiseError', () => {
  it('keeps the first line, hides local paths and bounds length', () => {
    const error = new Error('Timeout at /home/user/work/file.mjs:10\nCall log:\n  - waiting');
    expect(sanitiseError(error)).toBe('Timeout at <path>:10');
    expect(sanitiseError(new Error('x'.repeat(500)))).toHaveLength(300);
  });

  it('never echoes non-Error values', () => {
    expect(sanitiseError({ secret: 'value' })).toBe('Non-error value thrown');
  });

  // Synthetic, low-entropy room id and key built at run time (see sanitise.test.mjs).
  const ROOM = 'a1B2'.repeat(5);
  const KEY = `${'k_L-'.repeat(5)}m1`;
  it.each([
    ['a host with a room fragment', `goto: https://excalidraw.com#room=${ROOM},${KEY}`],
    ['a bare room value', `bad fragment room=${ROOM},${KEY}`],
    ['an upper-case room value', `bad fragment ROOM=${ROOM},${KEY}`],
    ['a double-encoded room value', `u=%23room%253D${ROOM}%252C${KEY}`],
    ['a json link', `https://excalidraw.com#json=${ROOM},${KEY}`],
    ['a value at the length cut', `${'x'.repeat(280)} room=${ROOM},${KEY}`],
  ])('redacts %s before it reaches the timeline', (_label, message) => {
    const text = sanitiseError(new Error(message));
    expect(text).not.toContain(ROOM.slice(0, 8));
    expect(text).not.toContain(KEY.slice(0, 8));
  });

  it('redacts token-shaped values in error text', () => {
    const token = `ghp_${'A'.repeat(36)}`;
    expect(sanitiseError(new Error(`auth ${token} failed`))).toBe(
      'auth <redacted:github-token> failed',
    );
  });
});
