import { describe, expect, it } from 'vitest';

import {
  countSecretShapes,
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
