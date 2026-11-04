export interface CollabConfig {
  readonly host: string;
  readonly port: number;
  readonly allowedOrigins: readonly string[];
  readonly maxPayloadBytes: number;
}

export type Environment = Readonly<Record<string, string | undefined>>;

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

export const DEFAULT_CONFIG: CollabConfig = {
  host: '127.0.0.1',
  port: 8787,
  allowedOrigins: ['http://localhost:5173'],
  maxPayloadBytes: 65_536,
};

const MAX_PORT = 65_535;
const MAX_PAYLOAD_LIMIT_BYTES = 16 * 1024 * 1024;

function parseInteger(name: string, raw: string, min: number, max: number): number {
  if (!/^\d+$/.test(raw)) {
    throw new ConfigError(`${name} must be a non-negative integer, received "${raw}".`);
  }
  const value = Number(raw);
  if (value < min || value > max) {
    throw new ConfigError(`${name} must be between ${String(min)} and ${String(max)}.`);
  }
  return value;
}

function parseOrigin(name: string, raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError(`${name} contains an invalid origin "${raw}".`);
  }
  if (url.origin !== raw) {
    throw new ConfigError(`${name} entries must be bare origins such as "${url.origin}".`);
  }
  return raw;
}

function parseOrigins(name: string, raw: string): readonly string[] {
  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (entries.length === 0) {
    throw new ConfigError(`${name} must list at least one origin.`);
  }
  return entries.map((entry) => parseOrigin(name, entry));
}

function readHost(raw: string | undefined): string {
  if (raw === undefined) {
    return DEFAULT_CONFIG.host;
  }
  const host = raw.trim();
  if (host.length === 0) {
    throw new ConfigError('PLANEWRIGHT_COLLAB_HOST must not be empty.');
  }
  return host;
}

/** Builds the service configuration from environment variables, failing fast on bad input. */
export function loadConfig(env: Environment): CollabConfig {
  const port = env['PLANEWRIGHT_COLLAB_PORT'];
  const origins = env['PLANEWRIGHT_COLLAB_ALLOWED_ORIGINS'];
  const maxPayload = env['PLANEWRIGHT_COLLAB_MAX_PAYLOAD_BYTES'];
  return {
    host: readHost(env['PLANEWRIGHT_COLLAB_HOST']),
    port:
      port === undefined
        ? DEFAULT_CONFIG.port
        : parseInteger('PLANEWRIGHT_COLLAB_PORT', port, 0, MAX_PORT),
    allowedOrigins:
      origins === undefined
        ? DEFAULT_CONFIG.allowedOrigins
        : parseOrigins('PLANEWRIGHT_COLLAB_ALLOWED_ORIGINS', origins),
    maxPayloadBytes:
      maxPayload === undefined
        ? DEFAULT_CONFIG.maxPayloadBytes
        : parseInteger(
            'PLANEWRIGHT_COLLAB_MAX_PAYLOAD_BYTES',
            maxPayload,
            1,
            MAX_PAYLOAD_LIMIT_BYTES,
          ),
  };
}
