import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';

import { PROTOCOL_VERSION, type ServerMessage } from '@planewright/protocol';
import { WebSocketServer, type WebSocket } from 'ws';

import type { CollabConfig } from './config.ts';
import { jsonLogger, type Logger } from './logger.ts';

export const SERVICE_NAME = 'planewright-collab';
export const HEALTH_PATH = '/healthz';
export const WEBSOCKET_PATH = '/ws';

const GOING_AWAY = 1001;

export interface HealthResponse {
  readonly status: 'ok';
  readonly service: typeof SERVICE_NAME;
  readonly protocolVersion: typeof PROTOCOL_VERSION;
}

export interface CollabServer {
  /** Starts listening and resolves with the bound address. */
  start(): Promise<AddressInfo>;
  /** Closes every client connection and stops listening. */
  stop(): Promise<void>;
}

function pathnameOf(request: IncomingMessage): string {
  return new URL(request.url ?? '/', 'http://localhost').pathname;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

function handleHttpRequest(request: IncomingMessage, response: ServerResponse): void {
  if (request.method === 'GET' && pathnameOf(request) === HEALTH_PATH) {
    const health: HealthResponse = {
      status: 'ok',
      service: SERVICE_NAME,
      protocolVersion: PROTOCOL_VERSION,
    };
    sendJson(response, 200, health);
    return;
  }
  sendJson(response, 404, { error: 'not_found' });
}

function rejectUpgrade(socket: Duplex, status: 403 | 404, reason: string): void {
  socket.end(
    `HTTP/1.1 ${String(status)} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
}

function send(client: WebSocket, message: ServerMessage): void {
  client.send(JSON.stringify(message));
}

function acceptClient(client: WebSocket, log: Logger): void {
  client.on('error', (error) => {
    log('ws.client_error', { message: error.message });
  });
  client.on('message', () => {
    send(client, {
      type: 'server.error',
      code: 'not_implemented',
      message: 'This foundation build does not process client messages yet.',
    });
  });
  send(client, { type: 'server.hello', protocolVersion: PROTOCOL_VERSION });
}

/**
 * Creates the collaboration service. In this foundation it only exposes a health endpoint and
 * a WebSocket handshake that greets clients; no document or presence data is exchanged.
 */
export function createCollabServer(config: CollabConfig, log: Logger = jsonLogger): CollabServer {
  const httpServer = createServer(handleHttpRequest);
  const sockets = new WebSocketServer({ noServer: true, maxPayload: config.maxPayloadBytes });
  const allowedOrigins = new Set(config.allowedOrigins);

  httpServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (pathnameOf(request) !== WEBSOCKET_PATH) {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }
    const origin = request.headers.origin;
    if (origin === undefined || !allowedOrigins.has(origin)) {
      log('ws.origin_rejected', { origin: origin ?? null });
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }
    sockets.handleUpgrade(request, socket, head, (client) => {
      acceptClient(client, log);
    });
  });

  return {
    start: () =>
      new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(config.port, config.host, () => {
          httpServer.off('error', reject);
          const address = httpServer.address();
          if (address === null || typeof address === 'string') {
            reject(new Error('Expected the collaboration service to bind a TCP address.'));
            return;
          }
          resolve(address);
        });
      }),
    stop: () =>
      new Promise((resolve, reject) => {
        for (const client of sockets.clients) {
          client.close(GOING_AWAY, 'Server shutting down');
        }
        sockets.close();
        httpServer.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
        httpServer.closeAllConnections();
      }),
  };
}
