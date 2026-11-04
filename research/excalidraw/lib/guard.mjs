// Request, path and error guards for the loopback research driver. Pure functions so that they
// can be unit-tested without a browser.
import { timingSafeEqual } from 'node:crypto';
import { join, resolve, sep } from 'node:path';

import { redactSecrets } from './sanitise.mjs';

export const TOKEN_HEADER = 'x-research-token';
/** Request bodies above this size are rejected before any JSON parsing. */
export const MAX_BODY_BYTES = 256 * 1024;
/** The only reference origin the driver may navigate to. */
export const REFERENCE_ORIGIN = 'https://excalidraw.com';
const SAFE_NAME_MAX = 80;
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;

/** Accepts only short file-name tokens: no separators, no traversal, no leading dot. */
export function safeName(value, label = 'name') {
  if (typeof value !== 'string' || !SAFE_NAME.test(value) || value.includes('..')) {
    throw new Error(`Invalid ${label}: use letters, digits, ".", "_" or "-" only.`);
  }
  return value;
}

/** Resolves a file name inside a directory and proves it stays there. */
export function confinedPath(dir, name, label) {
  const root = resolve(dir);
  const file = resolve(join(root, safeName(name, label)));
  if (!file.startsWith(root + sep)) throw new Error(`Invalid ${label}: outside its directory.`);
  return file;
}

/** Fixture files live in <out>/../fixtures and are named, never given as paths. */
export function fixturePath(outDir, name) {
  return confinedPath(join(outDir, '..', 'fixtures'), name, 'fixture name');
}

/** Output artefacts (screenshots, ARIA snapshots, downloads) are named, never given as paths. */
export function outputPath(outDir, sub, name, extension) {
  return confinedPath(
    join(outDir, sub),
    `${safeName(name, `${sub} name`)}${extension}`,
    `${sub} name`,
  );
}

/**
 * Builds a safe download file name from our own prefix and a server-suggested name. The result
 * always passes safeName: no traversal, no leading dot, at most 80 characters.
 */
export function safeDownloadName(prefix, suggested) {
  const head = safeName(prefix, 'download name');
  const room = SAFE_NAME_MAX - head.length - 1;
  const cleaned = String(suggested)
    .replace(/[^A-Za-z0-9._-]+/gu, '_')
    .replace(/\.{2,}/gu, '.')
    .replace(/^[._-]+/u, '')
    .slice(0, Math.max(room, 0))
    .replace(/[.]+$/u, '');
  return room > 0 && cleaned.length > 0 ? `${head}-${cleaned}` : head;
}

/** Parses a TCP port for a loopback listener: an integer from 1024 to 65535. */
export function parsePort(value, label = 'port') {
  const port = Number(value);
  if (!/^\d+$/u.test(String(value)) || !Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`Invalid ${label}: use an integer from 1024 to 65535.`);
  }
  return port;
}

/**
 * Navigation allowlist: about:blank, or an https URL on the reference origin without
 * credentials. Self-authored fixtures are loaded with the separate `fixture` step instead.
 * The scheme is checked as well as the origin: a `blob:` URL reports the origin that created it.
 */
export function checkNavigation(raw) {
  if (raw === 'about:blank') return raw;
  let url;
  try {
    url = new URL(String(raw));
  } catch {
    throw new Error('Navigation refused: not a URL.');
  }
  const allowed = url.protocol === 'https:' && url.origin === REFERENCE_ORIGIN;
  if (!allowed || url.username || url.password) {
    throw new Error('Navigation refused: only the reference origin and about:blank are allowed.');
  }
  return url.href;
}

/** The same allowlist as checkNavigation, as a boolean, for navigations the page starts itself. */
export function isAllowedNavigation(raw) {
  try {
    checkNavigation(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Error text for clients and the timeline: first line only, room and link values and other
 * secret shapes redacted, no local paths, bounded length. Redaction runs before the cut, so a
 * truncated value can never escape it. Timeline errors reach the committed sessions.json.
 */
export function sanitiseError(error) {
  const raw = error instanceof Error ? error.message : 'Non-error value thrown';
  const firstLine = raw.split('\n').find((line) => line.trim().length > 0) ?? '';
  return redactSecrets(firstLine)
    .replace(/(?:[A-Za-z]:)?(?:\/[^\s/:'"`]+){2,}/gu, '<path>')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 300);
}

function tokenMatches(expected, given) {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Browser-originated requests carry Origin or Fetch Metadata; only same-origin ones pass. */
function browserOriginRejected(headers, port) {
  const origin = headers.origin;
  if (origin !== undefined && origin !== `http://127.0.0.1:${String(port)}`) return true;
  const site = headers['sec-fetch-site'];
  return site !== undefined && site !== 'same-origin' && site !== 'none';
}

function checkAccess({ method, url, headers }, { token, port }) {
  if (url !== '/run' && url !== '/quit') return { status: 404, error: 'Unknown route.' };
  if (method !== 'POST') return { status: 405, error: 'Use POST.' };
  if (headers.host !== `127.0.0.1:${String(port)}`) return { status: 403, error: 'Bad Host.' };
  if (browserOriginRejected(headers, port)) return { status: 403, error: 'Bad Origin.' };
  if (!tokenMatches(token, headers[TOKEN_HEADER])) return { status: 401, error: 'Bad token.' };
  return null;
}

function checkBody({ url, headers }) {
  if (Number(headers['content-length'] ?? 0) > MAX_BODY_BYTES) {
    return { status: 413, error: 'Request body too large.' };
  }
  const type = String(headers['content-type'] ?? '')
    .split(';')[0]
    ?.trim()
    .toLowerCase();
  if (url === '/run' && type !== 'application/json') {
    return { status: 415, error: 'Use application/json.' };
  }
  return null;
}

/**
 * Validates a driver request. Returns null when acceptable, otherwise { status, error }.
 * Every route needs POST, the exact loopback Host, no foreign Origin, and the per-run token;
 * /run also needs JSON and a declared length within MAX_BODY_BYTES. The streamed body is
 * capped separately while it is read.
 */
export function checkRequest(request, options) {
  return checkAccess(request, options) ?? checkBody(request);
}
