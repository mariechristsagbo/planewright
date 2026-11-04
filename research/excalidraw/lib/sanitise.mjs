// Privacy sanitisers shared by the driver, the netlog, the REA extractors and the secret-shape
// scanner. Pure functions so that every boundary can be unit-tested without a browser.

// A key name is kept only when it looks like an identifier. Anything else, for example an
// encoded `room%3D<id>` with no literal `=`, may carry a value and is reduced to a placeholder.
const KEY_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/u;
const safeKey = (key) => (KEY_NAME.test(key) ? key : '<non-identifier>');
const queryKeysOf = (url) => [...new Set([...url.searchParams.keys()].map(safeKey))];

/** Network metadata for a URL: origin, path, query key names and whether a fragment exists. */
export function sanitiseUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol === 'data:' || url.protocol === 'blob:') return { scheme: url.protocol };
    return {
      origin: url.origin,
      path: url.pathname,
      queryKeys: queryKeysOf(url).sort(),
      hasFragment: url.hash.length > 0,
    };
  } catch {
    return { unparseable: true };
  }
}

/**
 * URL shape only: origin, path, query key names and, for the fragment, each key with the length
 * of each comma-separated value part. Room identifiers and keys are never returned.
 */
export function urlShapeOf(href) {
  const url = new URL(href);
  const fragment = url.hash.slice(1);
  const parts = fragment
    ? fragment.split('&').map((pair) => {
        const [key = '', value = ''] = pair.split('=');
        return { key: safeKey(key), valueLengths: value.split(',').map((v) => v.length) };
      })
    : [];
  return { origin: url.origin, path: url.pathname, queryKeys: queryKeysOf(url), fragment: parts };
}

// One character in either case, literal or percent-encoded any number of times (`r`, `%72`,
// `%2552`, ...). Every character of a key name and of the `=` and `,` separators is matched this
// way, so any mix of literal and encoded characters matches. The patterns use the `i` flag.
const hexOf = (ch) => ch.charCodeAt(0).toString(16);
const anyForm = (ch) => {
  const cases = [...new Set([ch.toLowerCase(), ch.toUpperCase()])];
  return `(?:${ch}|%(?:25)*(?:${cases.map(hexOf).join('|')}))`;
};
const encodedWord = (word) => [...word].map(anyForm).join('');
const EQ = encodedWord('=');
const COMMA = encodedWord(',');
const ROOM_KEY = encodedWord('room');
const JSON_KEY = encodedWord('json');
const LINK_KEY = `(?:${ROOM_KEY}|${JSON_KEY})`;
// A collaboration room or a shareable `#json=` link value, literal or percent-encoded.
const SECRET_FRAGMENT = new RegExp(String.raw`${LINK_KEY}${EQ}[^&\s]`, 'iu');
/** Text that names a room or `json` link key with its `=`, in any of the forms above. */
export const LINK_KEY_TEXT = new RegExp(`${LINK_KEY}${EQ}`, 'iu');

// Percent-escapes of ASCII characters, decoded again and again until nothing changes. It never
// throws on a malformed escape, so one stray `%` cannot hide the rest of a text.
const ASCII_ESCAPE = /%([0-7][0-9a-f])/giu;
const decodeChar = (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16));
function decodeAscii(text) {
  let previous = '';
  let out = String(text);
  while (out !== previous) {
    previous = out;
    out = out.replace(ASCII_ESCAPE, decodeChar);
  }
  return out;
}

/** A text and, when it differs, its ASCII-decoded form. */
function formsOf(text) {
  const raw = String(text);
  const decoded = decodeAscii(raw);
  return decoded === raw ? [raw] : [raw, decoded];
}

/** True when a URL's fragment carries a room or `json` link value, in raw or encoded form. */
export function hasSecretFragment(href) {
  const hash = String(href).split('#').slice(1).join('#');
  return formsOf(hash).some((form) => SECRET_FRAGMENT.test(form));
}

/** Origin and path only; drops userinfo, query and fragment. Null when unparseable. */
export function stripQuery(raw) {
  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return null;
  }
}

// Shapes of values that must never be stored or published. Room and link key names and their
// separators match in any case and any mix of literal and percent-encoded characters; a value
// whose own characters are encoded is found in the decoded form (see countSecretShapes).
// Placeholders written by our own redaction (`<redacted>`, `REDACTED_…`) do not match.
const ID20 = '(?!REDACTED)[A-Za-z0-9_-]{20}';
const KEY22 = '[A-Za-z0-9_-]{22}';
export const SECRET_SHAPES = [
  ['room-fragment', new RegExp(`${ROOM_KEY}${EQ}${ID20}${COMMA}${KEY22}`, 'giu')],
  [
    'json-link',
    new RegExp(`${JSON_KEY}${EQ}(?!REDACTED)[A-Za-z0-9_-]{16,}${COMMA}${KEY22}`, 'giu'),
  ],
  ['github-token', /\b(?:gh[opsur]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/gu],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}/gu],
  ['openai-style-key', /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{32,}/gu],
  ['aws-access-key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/gu],
  ['slack-token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/gu],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/gu],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/gu],
  ['private-key', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/gu],
];

/**
 * Counts each secret shape in a text and in its ASCII-decoded form, keeping the larger count per
 * shape. Returns only shape names and counts, never values.
 */
export function countSecretShapes(text) {
  const forms = formsOf(text);
  const counts = {};
  for (const [name, pattern] of SECRET_SHAPES) {
    const found = Math.max(...forms.map((form) => form.match(pattern)?.length ?? 0));
    if (found > 0) counts[name] = found;
  }
  return counts;
}

// Shapes already covered by the room/json value replacement in redactSecrets. The replacement
// takes everything up to a delimiter, so it does not depend on how the value is encoded.
const LINK_SHAPES = new Set(['room-fragment', 'json-link']);
const LINK_VALUE = new RegExp(String.raw`(${LINK_KEY}${EQ})[^\s"'<>&)\]]+`, 'giu');

/**
 * Replaces collaboration room values, `json` link values (literal or percent-encoded) and
 * secret-shaped values with placeholders. Applied to every text the driver writes from the page
 * (ARIA snapshots, dialog messages, clipboard previews, download names).
 */
export function redactSecrets(text) {
  let out = String(text).replace(LINK_VALUE, '$1<redacted>');
  for (const [name, pattern] of SECRET_SHAPES) {
    if (!LINK_SHAPES.has(name)) out = out.replace(pattern, `<redacted:${name}>`);
  }
  return out;
}

const PREVIEW_CHARS = 24;
const redactedString = (value) => (typeof value === 'string' ? redactSecrets(value) : undefined);

/**
 * Shape of a clipboard text: its length and, for a JSON object, key names, `type` and element
 * types; otherwise a short preview. The whole text is redacted before it is truncated, so a cut
 * can never leave a partial secret that the redaction patterns no longer recognise.
 */
export function clipboardShapeOf(text) {
  const raw = String(text);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      chars: raw.length,
      json: false,
      startsWith: redactSecrets(raw).slice(0, PREVIEW_CHARS),
    };
  }
  return {
    chars: raw.length,
    json: true,
    keys: Object.keys(parsed).map(redactSecrets),
    type: redactedString(parsed.type),
    elements: Array.isArray(parsed.elements)
      ? parsed.elements.map((e) => redactedString(e?.type))
      : undefined,
  };
}
