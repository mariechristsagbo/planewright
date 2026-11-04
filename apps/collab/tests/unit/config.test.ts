import { describe, expect, it } from 'vitest';

import { ConfigError, DEFAULT_CONFIG, loadConfig } from '../../src/config.ts';

describe('loadConfig', () => {
  it('uses safe local defaults when no variables are set', () => {
    expect(loadConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it('reads every supported variable', () => {
    expect(
      loadConfig({
        PLANEWRIGHT_COLLAB_HOST: ' 0.0.0.0 ',
        PLANEWRIGHT_COLLAB_PORT: '9000',
        PLANEWRIGHT_COLLAB_ALLOWED_ORIGINS: 'https://a.example, http://localhost:3000',
        PLANEWRIGHT_COLLAB_MAX_PAYLOAD_BYTES: '1024',
      }),
    ).toEqual({
      host: '0.0.0.0',
      port: 9000,
      allowedOrigins: ['https://a.example', 'http://localhost:3000'],
      maxPayloadBytes: 1024,
    });
  });

  it.each([
    [{ PLANEWRIGHT_COLLAB_HOST: '  ' }, /HOST must not be empty/],
    [{ PLANEWRIGHT_COLLAB_PORT: 'eighty' }, /PORT must be a non-negative integer/],
    [{ PLANEWRIGHT_COLLAB_PORT: '-1' }, /PORT must be a non-negative integer/],
    [{ PLANEWRIGHT_COLLAB_PORT: '70000' }, /PORT must be between 0 and 65535/],
    [{ PLANEWRIGHT_COLLAB_MAX_PAYLOAD_BYTES: '0' }, /MAX_PAYLOAD_BYTES must be between/],
    [{ PLANEWRIGHT_COLLAB_ALLOWED_ORIGINS: ' , ' }, /must list at least one origin/],
    [{ PLANEWRIGHT_COLLAB_ALLOWED_ORIGINS: 'not a url' }, /invalid origin/],
    [{ PLANEWRIGHT_COLLAB_ALLOWED_ORIGINS: 'https://a.example/path' }, /must be bare origins/],
  ])('rejects invalid input %o', (env, message) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(message);
  });
});
