import { describe, expect, it } from 'vitest';

import { isServerMessage, PROTOCOL_VERSION } from '../../src/index.ts';

describe('isServerMessage', () => {
  it('accepts a hello for the current protocol version', () => {
    expect(isServerMessage({ type: 'server.hello', protocolVersion: PROTOCOL_VERSION })).toBe(true);
  });

  it('rejects a hello for another protocol version', () => {
    expect(isServerMessage({ type: 'server.hello', protocolVersion: PROTOCOL_VERSION + 1 })).toBe(
      false,
    );
  });

  it('accepts a well-formed error', () => {
    expect(
      isServerMessage({ type: 'server.error', code: 'not_implemented', message: 'later' }),
    ).toBe(true);
  });

  it.each([
    ['an unknown error code', { type: 'server.error', code: 'boom', message: 'x' }],
    ['a non-string error message', { type: 'server.error', code: 'invalid_message', message: 1 }],
    ['an unknown message type', { type: 'server.unknown' }],
    ['an array', []],
    ['null', null],
    ['a string', 'server.hello'],
  ])('rejects %s', (_label, value) => {
    expect(isServerMessage(value)).toBe(false);
  });
});
