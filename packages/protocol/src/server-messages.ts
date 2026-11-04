import { PROTOCOL_VERSION, type ProtocolVersion } from './version.ts';

/** Sent by the collaboration service immediately after a WebSocket connection is accepted. */
export interface ServerHello {
  readonly type: 'server.hello';
  readonly protocolVersion: ProtocolVersion;
}

export const SERVER_ERROR_CODES = ['invalid_message', 'not_implemented'] as const;

export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number];

/** Sent by the collaboration service when it cannot act on a client message. */
export interface ServerError {
  readonly type: 'server.error';
  readonly code: ServerErrorCode;
  readonly message: string;
}

export type ServerMessage = ServerHello | ServerError;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isServerErrorCode(value: unknown): value is ServerErrorCode {
  return SERVER_ERROR_CODES.some((code) => code === value);
}

/** Runtime guard for values decoded from the wire. */
export function isServerMessage(value: unknown): value is ServerMessage {
  if (!isRecord(value)) {
    return false;
  }
  switch (value['type']) {
    case 'server.hello':
      return value['protocolVersion'] === PROTOCOL_VERSION;
    case 'server.error':
      return isServerErrorCode(value['code']) && typeof value['message'] === 'string';
    default:
      return false;
  }
}
