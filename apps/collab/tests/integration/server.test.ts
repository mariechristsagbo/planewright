import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

import { isServerMessage, PROTOCOL_VERSION, type ServerMessage } from '@planewright/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { silentLogger } from '../../src/logger.ts';
import { createCollabServer, HEALTH_PATH, SERVICE_NAME, WEBSOCKET_PATH } from '../../src/server.ts';

const ALLOWED_ORIGIN = 'http://localhost:5173';

const server = createCollabServer(
  { host: '127.0.0.1', port: 0, allowedOrigins: [ALLOWED_ORIGIN], maxPayloadBytes: 1024 },
  silentLogger,
);
let address: AddressInfo;

function httpUrl(path: string): string {
  return `http://127.0.0.1:${String(address.port)}${path}`;
}

function connect(origin: string, path = WEBSOCKET_PATH): WebSocket {
  return new WebSocket(`ws://127.0.0.1:${String(address.port)}${path}`, { origin });
}

async function nextMessage(client: WebSocket): Promise<ServerMessage> {
  const [data] = (await once(client, 'message')) as [Buffer];
  const parsed: unknown = JSON.parse(data.toString('utf8'));
  if (!isServerMessage(parsed)) {
    throw new Error(`Unexpected message: ${data.toString('utf8')}`);
  }
  return parsed;
}

async function rejectedStatus(client: WebSocket): Promise<number | undefined> {
  const [, response] = (await once(client, 'unexpected-response')) as [
    unknown,
    { statusCode?: number },
  ];
  // Aborting a handshake makes `ws` emit "closed before the connection was established", which
  // `events.once` would surface as a rejection, so wait for "close" with a plain listener.
  const closed = new Promise((resolve) => client.once('close', resolve));
  client.once('error', () => undefined);
  client.terminate();
  await closed;
  return response.statusCode;
}

beforeAll(async () => {
  address = await server.start();
});

afterAll(async () => {
  await server.stop();
});

describe('collaboration service HTTP surface', () => {
  it('reports health with the protocol version', async () => {
    const response = await fetch(httpUrl(HEALTH_PATH));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      status: 'ok',
      service: SERVICE_NAME,
      protocolVersion: PROTOCOL_VERSION,
    });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const response = await fetch(httpUrl('/unknown'));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  });
});

describe('collaboration service WebSocket surface', () => {
  it('greets an allowed origin and declines client messages for now', async () => {
    const client = connect(ALLOWED_ORIGIN);
    expect(await nextMessage(client)).toEqual({
      type: 'server.hello',
      protocolVersion: PROTOCOL_VERSION,
    });

    client.send(JSON.stringify({ type: 'client.anything' }));
    expect(await nextMessage(client)).toMatchObject({
      type: 'server.error',
      code: 'not_implemented',
    });

    client.close();
    await once(client, 'close');
  });

  it('rejects origins that are not allowed', async () => {
    expect(await rejectedStatus(connect('https://evil.example'))).toBe(403);
  });

  it('rejects upgrades outside the WebSocket path', async () => {
    expect(await rejectedStatus(connect(ALLOWED_ORIGIN, '/elsewhere'))).toBe(404);
  });
});
