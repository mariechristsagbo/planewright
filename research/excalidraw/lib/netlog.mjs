// Metadata-only network log: method, origin, path, query key names, resource type, status and
// WebSocket frame counts/sizes. Headers, cookies, query values and bodies are never recorded.
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

import { sanitiseUrl } from './sanitise.mjs';

function watchSocket(write, socket) {
  const counts = { sent: 0, received: 0, sentBytes: 0, receivedBytes: 0 };
  const size = (payload) => (typeof payload === 'string' ? payload.length : payload.byteLength);
  write({ event: 'websocket-open', ...sanitiseUrl(socket.url()) });
  socket.on('framesent', ({ payload }) => {
    counts.sent += 1;
    counts.sentBytes += size(payload);
  });
  socket.on('framereceived', ({ payload }) => {
    counts.received += 1;
    counts.receivedBytes += size(payload);
  });
  socket.on('close', () =>
    write({ event: 'websocket-close', ...sanitiseUrl(socket.url()), ...counts }),
  );
}

export function attachNetlog(page, outDir) {
  const file = join(outDir, 'netlog.jsonl');
  const write = (entry) =>
    appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
  page.on('requestfinished', async (request) => {
    const response = await request.response().catch(() => null);
    write({
      event: 'request',
      method: request.method(),
      type: request.resourceType(),
      status: response?.status() ?? null,
      fromServiceWorker: response?.fromServiceWorker() ?? null,
      ...sanitiseUrl(request.url()),
    });
  });
  page.on('requestfailed', (request) =>
    write({
      event: 'request-failed',
      method: request.method(),
      type: request.resourceType(),
      failure: request.failure()?.errorText ?? null,
      ...sanitiseUrl(request.url()),
    }),
  );
  page.on('websocket', (socket) => watchSocket(write, socket));
  page.on('worker', (worker) => write({ event: 'worker', ...sanitiseUrl(worker.url()) }));
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) write({ event: 'navigated', ...sanitiseUrl(frame.url()) });
  });
}
