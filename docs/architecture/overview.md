# Architecture overview

This document describes the foundation as it exists today. It will grow as investigations
complete and ADRs are accepted.

## Components

```text
┌───────────────────────┐        WebSocket /ws         ┌───────────────────────────┐
│ apps/web              │  ─────────────────────────▶  │ apps/collab               │
│ React + Vite          │  (not connected yet)         │ Node.js http + ws         │
│ status page only      │                              │ /healthz, hello handshake │
└──────────┬────────────┘                              └─────────────┬─────────────┘
           │ imports                                                 │ imports
           ▼                                                         ▼
                    ┌──────────────────────────────────┐
                    │ packages/protocol                │
                    │ protocol version 0, message types │
                    └──────────────────────────────────┘
```

### apps/web

A React 19 application built with Vite 8. It renders a factual status page that labels the
build as a foundation and lists capabilities that are not implemented yet. It imports the
protocol version to prove that workspace linking works.

### apps/collab

A Node.js service with no framework:

- `src/config.ts` reads `PLANEWRIGHT_COLLAB_*` variables and rejects invalid values at startup.
- `src/server.ts` serves `GET /healthz` and accepts WebSocket upgrades only on `/ws` and only
  from allowlisted `Origin` values. Every accepted client receives `server.hello`; any client
  message is answered with `server.error` / `not_implemented`. Message size is limited by
  `maxPayload`.
- `src/main.ts` wires configuration, logging and graceful shutdown on `SIGINT` and `SIGTERM`.

Logs are JSON lines on stdout.

### packages/protocol

Runtime-agnostic TypeScript definitions with no DOM or Node.js dependencies. Protocol version 0
contains only the server hello and error messages and has no compatibility guarantees.

## Open decisions

These are intentionally undecided until the behavioural investigation is complete. Each will be
settled by an ADR:

- Scene and element model, and how documents are versioned and serialised.
- Rendering approach (Canvas 2D, WebGL or a hybrid), hit testing and viewport virtualisation.
- Input handling, tool architecture and undo/redo model.
- Collaboration model (operational transformation, CRDT or server-authoritative), presence,
  room lifecycle, authentication and persistence.
- File import and export formats.
