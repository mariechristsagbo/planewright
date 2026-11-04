// Privacy sanitisers shared by the driver, the netlog, the REA extractors and the secret-shape
// scanner. Pure functions so that every boundary can be unit-tested without a browser.

/** Network metadata for a URL: origin, path, query key names and whether a fragment exists. */
export function sanitiseUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol === 'data:' || url.protocol === 'blob:') return { scheme: url.protocol };
    return {
      origin: url.origin,
      path: url.pathname,
      queryKeys: [...new Set(url.searchParams.keys())].sort(),
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
        return { key, valueLengths: value.split(',').map((v) => v.length) };
      })
    : [];
  return {
    origin: url.origin,
    path: url.pathname,
    queryKeys: [...new Set(url.searchParams.keys())],
    fragment: parts,
  };
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

/**
 * Replaces collaboration fragments and secret-shaped values with placeholders. Applied to every
 * text the driver writes from the page (ARIA snapshots, dialog messages, clipboard previews).
 */
export function redactSecrets(text) {
  let out = String(text).replace(/(room=)[^\s"'<>&)\]]+/gu, '$1<redacted>');
  for (const [name, pattern] of SECRET_SHAPES) {
    if (name !== 'room-fragment') out = out.replace(pattern, `<redacted:${name}>`);
  }
  return out;
}
