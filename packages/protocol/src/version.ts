/**
 * Wire protocol version shared by Planewright clients and the collaboration service.
 *
 * Version 0 is the pre-release foundation protocol. It carries no document or presence
 * data and offers no compatibility guarantees; it will be replaced once the collaboration
 * design has been decided through the issue-driven process.
 */
export const PROTOCOL_VERSION = 0;

export type ProtocolVersion = typeof PROTOCOL_VERSION;
