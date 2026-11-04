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

// A collaboration room or a shareable `#json=` link value, literal or percent-encoded.
const SECRET_FRAGMENT = /(?:room|json)(?:=|%3d)[^&\s]/iu;

/** True when a URL's fragment carries a room or `json` link value, in raw or encoded form. */
export function hasSecretFragment(href) {
  const hash = String(href).split('#').slice(1).join('#');
  let decoded = hash;
  try {
    decoded = decodeURIComponent(hash);
  } catch {
    // A malformed escape keeps the raw text, which is still tested.
  }
  return SECRET_FRAGMENT.test(hash) || SECRET_FRAGMENT.test(decoded);
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

// Shapes of values that must never be stored or published. Placeholders written by our own
// redaction (`<redacted>`, `REDACTED_…`) do not match.
export const SECRET_SHAPES = [
  ['room-fragment', /room=(?!REDACTED)[A-Za-z0-9_-]{20},[A-Za-z0-9_-]{22}/gu],
  ['room-fragment-encoded', /room%3D(?!REDACTED)[A-Za-z0-9_-]{20}%2C[A-Za-z0-9_-]{22}/giu],
  ['json-link', /json(?:=|%3D)(?!REDACTED)[A-Za-z0-9_-]{16,}(?:,|%2C)[A-Za-z0-9_-]{22}/giu],
  ['github-token', /\b(?:gh[opsur]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/gu],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}/gu],
  ['openai-style-key', /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{32,}/gu],
  ['aws-access-key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/gu],
  ['slack-token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/gu],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/gu],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/gu],
  ['private-key', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/gu],
];

/** Counts each secret shape in a text. Returns only shape names and counts, never values. */
export function countSecretShapes(text) {
  const counts = {};
  for (const [name, pattern] of SECRET_SHAPES) {
    const found = text.match(pattern)?.length ?? 0;
    if (found > 0) counts[name] = found;
  }
  return counts;
}

// Shapes already covered by the room/json value replacement in redactSecrets.
const LINK_SHAPES = new Set(['room-fragment', 'room-fragment-encoded', 'json-link']);

/**
 * Replaces collaboration room values, `json` link values (literal or percent-encoded) and
 * secret-shaped values with placeholders. Applied to every text the driver writes from the page
 * (ARIA snapshots, dialog messages, clipboard previews, download names).
 */
export function redactSecrets(text) {
  let out = String(text).replace(/((?:room|json)(?:=|%3d))[^\s"'<>&)\]]+/giu, '$1<redacted>');
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
