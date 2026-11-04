// Request, path and error guards for the loopback research driver. Pure functions so that they
// can be unit-tested without a browser.
import { timingSafeEqual } from 'node:crypto';
import { join, resolve, sep } from 'node:path';

export const TOKEN_HEADER = 'x-research-token';
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

/** Reduces a server-suggested download name to a safe file-name token. */
export function safeDownloadName(suggested) {
  const cleaned = String(suggested)
    .replace(/[^A-Za-z0-9._-]+/gu, '_')
    .replace(/^[._-]+/u, '')
    .slice(0, 40);
  return cleaned.length > 0 ? cleaned : 'download';
}

/** Error text for clients and the timeline: first line only, no local paths, bounded length. */
export function sanitiseError(error) {
  const raw = error instanceof Error ? error.message : 'Non-error value thrown';
  const firstLine = raw.split('\n').find((line) => line.trim().length > 0) ?? '';
  return firstLine
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

/**
 * Validates a driver request. Returns null when acceptable, otherwise { status, error }.
 * Every route needs POST, the exact loopback Host, and the per-run token; /run also needs JSON.
 */
export function checkRequest(request, { token, port }) {
  const { method, url, headers } = request;
  if (url !== '/run' && url !== '/quit') return { status: 404, error: 'Unknown route.' };
  if (method !== 'POST') return { status: 405, error: 'Use POST.' };
  if (headers.host !== `127.0.0.1:${String(port)}`) return { status: 403, error: 'Bad Host.' };
  if (!tokenMatches(token, headers[TOKEN_HEADER])) return { status: 401, error: 'Bad token.' };
  const type = String(headers['content-type'] ?? '')
    .split(';')[0]
    ?.trim()
    .toLowerCase();
  if (url === '/run' && type !== 'application/json') {
    return { status: 415, error: 'Use application/json.' };
  }
  return null;
}
