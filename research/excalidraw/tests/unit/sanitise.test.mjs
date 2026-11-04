import { describe, expect, it } from 'vitest';

import {
  clipboardShapeOf,
  countSecretShapes,
  hasSecretFragment,
  redactSecrets,
  sanitiseUrl,
  stripQuery,
  urlShapeOf,
} from '../../lib/sanitise.mjs';

// Synthetic, low-entropy values with the shape of a collaboration room id (20) and key (22),
// built at run time so that secret scanners do not mistake them for credentials.
const ROOM = 'a1B2'.repeat(5);
const KEY = `${'k_L-'.repeat(5)}m1`;
const ROOM_URL = `https://excalidraw.com/#room=${ROOM},${KEY}`;

describe('sanitiseUrl', () => {
  it('keeps origin, path and sorted unique query key names only', () => {
    expect(sanitiseUrl('https://x.example/a/b?token=SECRET&b=2&b=3#frag')).toEqual({
      origin: 'https://x.example',
      path: '/a/b',
      queryKeys: ['b', 'token'],
      hasFragment: true,
    });
  });

  it('never returns query values, fragments or userinfo', () => {
    const text = JSON.stringify(sanitiseUrl(`https://user:pw@x.example/p?k=SECRET${ROOM_URL}`));
    expect(text).not.toMatch(/SECRET|pw|user|room=/u);
  });

  it('reduces data and blob URLs to their scheme and survives garbage', () => {
    expect(sanitiseUrl('data:text/plain,SECRET')).toEqual({ scheme: 'data:' });
    expect(sanitiseUrl('blob:https://x.example/uuid')).toEqual({ scheme: 'blob:' });
    expect(sanitiseUrl('::not a url')).toEqual({ unparseable: true });
  });
});

describe('urlShapeOf', () => {
  it('records the room fragment as key name and value lengths only', () => {
    const shape = urlShapeOf(ROOM_URL);
    expect(shape).toEqual({
      origin: 'https://excalidraw.com',
      path: '/',
      queryKeys: [],
      fragment: [{ key: 'room', valueLengths: [20, 22] }],
    });
    expect(JSON.stringify(shape)).not.toContain(ROOM);
    expect(JSON.stringify(shape)).not.toContain(KEY);
  });

  it('handles an empty fragment and query keys without values', () => {
    expect(urlShapeOf('https://excalidraw.com/?a=SECRET&a=2').queryKeys).toEqual(['a']);
    expect(urlShapeOf('https://excalidraw.com/').fragment).toEqual([]);
  });
});

describe('stripQuery', () => {
  it('drops userinfo, query and fragment', () => {
    expect(stripQuery(`https://u:p@excalidraw.com/x?y=SECRET#room=${ROOM},${KEY}`)).toBe(
      'https://excalidraw.com/x',
    );
    expect(stripQuery('nonsense')).toBeNull();
  });
});

describe('redactSecrets', () => {
  it('redacts collaboration fragments in ARIA text', () => {
    const aria = `- textbox: ${ROOM_URL}\n- button "Copy link"`;
    const out = redactSecrets(aria);
    expect(out).toBe('- textbox: https://excalidraw.com/#room=<redacted>\n- button "Copy link"');
    expect(countSecretShapes(out)).toEqual({});
  });

  it('redacts token-shaped values and leaves ordinary text alone', () => {
    const github = `ghp_${'A'.repeat(36)}`;
    const out = redactSecrets(`token ${github} and AKIA${'B'.repeat(16)} stay out`);
    expect(out).not.toContain(github);
    expect(out).toContain('<redacted:github-token>');
    expect(out).toContain('<redacted:aws-access-key>');
    expect(redactSecrets('Live collaboration')).toBe('Live collaboration');
  });
});

describe('countSecretShapes', () => {
  it('counts shapes by name without returning values', () => {
    const pem = ['-----BEGIN', 'PRIVATE', 'KEY-----'].join(' ');
    const text = `${ROOM_URL} ${ROOM_URL} sk-ant-${'x'.repeat(30)} ${pem}`;
    expect(countSecretShapes(text)).toEqual({
      'room-fragment': 2,
      'anthropic-key': 1,
      'private-key': 1,
    });
  });

  it('ignores our own redaction placeholders', () => {
    expect(countSecretShapes('room=REDACTED_ROOM_ID____,REDACTED_ROOM_KEY_____')).toEqual({});
    expect(countSecretShapes('room=<redacted>')).toEqual({});
  });
});

// Encoded and `json` link forms of the same synthetic values.
const ENCODED = `room%3D${ROOM}%2C${KEY}`;
const JSON_LINK = `https://excalidraw.com/#json=${ROOM},${KEY}`;
const leaks = (text) => [ROOM, KEY].some((part) => String(text).includes(part));

describe('encoded room and json link forms', () => {
  it.each([
    ['percent-encoded room', `https://x.example/?u=https%3A%2F%2Fexcalidraw.com%2F%23${ENCODED}`],
    ['upper-case encoded room', `#ROOM%3d${ROOM}`],
    ['json link', JSON_LINK],
    ['encoded json link', `json%3D${ROOM}%2C${KEY}`],
  ])('redacts a %s', (_label, text) => {
    const out = redactSecrets(text);
    expect(leaks(out)).toBe(false);
    expect(out).toContain('<redacted>');
  });

  it('counts the encoded room and json link shapes without returning values', () => {
    expect(countSecretShapes(`${ENCODED} ${JSON_LINK}`)).toEqual({
      'room-fragment-encoded': 1,
      'json-link': 1,
    });
    expect(countSecretShapes(redactSecrets(`${ENCODED} ${JSON_LINK}`))).toEqual({});
  });

  it.each([
    ['double-encoded room', `room%253D${ROOM}%252C${KEY}`],
    ['triple-encoded room', `room%25253D${ROOM}%25252C${KEY}`],
    ['upper-case literal room', `#ROOM=${ROOM},${KEY}`],
    ['double-encoded json link', `json%253D${ROOM}%252C${KEY}`],
  ])('redacts and counts a %s', (_label, text) => {
    expect(Object.keys(countSecretShapes(text))).toHaveLength(1);
    const out = redactSecrets(text);
    expect(leaks(out)).toBe(false);
    expect(countSecretShapes(out)).toEqual({});
  });

  it('replaces a key name that is not an identifier, so an encoded value is never a key', () => {
    const shape = urlShapeOf(`https://excalidraw.com/?${ENCODED}=1#${ENCODED}`);
    expect(leaks(JSON.stringify(shape))).toBe(false);
    expect(shape.fragment[0].key).toBe('<non-identifier>');
    expect(shape.queryKeys).toEqual(['<non-identifier>']);
    expect(leaks(JSON.stringify(sanitiseUrl(`https://x.example/?${ENCODED}=1`)))).toBe(false);
  });
});

describe('hasSecretFragment', () => {
  it.each([
    ROOM_URL,
    JSON_LINK,
    `https://excalidraw.com/#${ENCODED}`,
    `https://excalidraw.com/#x=1&Room=${ROOM}`,
    `about:blank#%72oom=${ROOM}`,
    `https://excalidraw.com/#room=${ROOM}%E0%A4%A`,
    `https://excalidraw.com/#room%253D${ROOM}`,
    `https://excalidraw.com/#%2572oom%25253D${ROOM}`,
  ])('detects a collaboration value in %s', (href) => {
    expect(hasSecretFragment(href)).toBe(true);
  });

  it.each([
    'https://excalidraw.com/',
    'https://excalidraw.com/?room=query-not-fragment',
    'https://excalidraw.com/#room=',
    'https://excalidraw.com/#room=&x=1',
    'https://excalidraw.com/#library=abc',
  ])('finds no value in %s', (href) => {
    expect(hasSecretFragment(href)).toBe(false);
  });
});

describe('clipboardShapeOf', () => {
  // A token-shaped value that a 24-character cut would split below the pattern's minimum length.
  const TOKEN = ['gh', 'p_', 'Q7'.repeat(18)].join('');

  it('redacts the whole text before cutting the preview', () => {
    const shape = clipboardShapeOf(`see ${TOKEN} and ${ROOM_URL}`);
    expect(shape.json).toBe(false);
    expect(shape.startsWith).toHaveLength(24);
    expect(shape.startsWith).not.toContain('Q7Q7');
    expect(shape.startsWith).toBe('see <redacted:github-tok');
  });

  it('never previews a room value cut at the boundary', () => {
    const shape = clipboardShapeOf(`https://excalidraw.com/#room=${ROOM},${KEY}`);
    expect(leaks(shape.startsWith)).toBe(false);
    expect(shape.chars).toBe(ROOM_URL.length);
  });

  it('reduces a JSON object to redacted key names and types', () => {
    const shape = clipboardShapeOf(
      JSON.stringify({ type: 'scene', elements: [{ type: 'rectangle' }, null], [TOKEN]: 1 }),
    );
    expect(shape).toMatchObject({ json: true, type: 'scene', elements: ['rectangle', undefined] });
    expect(shape.keys).toEqual(['type', 'elements', '<redacted:github-token>']);
  });

  it.each(['null', '42', '[1,2]'])('treats non-object JSON %s as text', (text) => {
    expect(clipboardShapeOf(text)).toEqual({ chars: text.length, json: false, startsWith: text });
  });
});
