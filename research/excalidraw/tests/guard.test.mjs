import { describe, expect, it } from 'vitest';

import {
  TOKEN_HEADER,
  checkRequest,
  fixturePath,
  outputPath,
  safeDownloadName,
  safeName,
  sanitiseError,
} from '../lib/guard.mjs';

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
  ])('rejects %s', (_label, req, status) => {
    expect(checkRequest(req, { token: TOKEN, port: PORT })?.status).toBe(status);
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

  it('reduces server-suggested download names', () => {
    expect(safeDownloadName('../../etc/passwd')).toBe('etc_passwd');
    expect(safeDownloadName('My Drawing (1).png')).toBe('My_Drawing_1_.png');
    expect(safeDownloadName('///')).toBe('download');
    expect(safeDownloadName('x'.repeat(100))).toHaveLength(40);
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
});
