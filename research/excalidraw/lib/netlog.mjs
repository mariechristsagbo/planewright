// Metadata-only network log: method, origin, path, query key names, resource type, status, when a
// request started and WebSocket frame counts/sizes. Headers, cookies, query values and bodies are
// never recorded. A request is written once it has finished or failed; `at` is that write time and
// `startedAt` the time the page reported the request, or null when its start was not seen.
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

/**
 * Attaches the log to a page and returns its writer for other metadata-only events. `now` is the
 * clock both times are read from; the driver uses the default.
 */
export function attachNetlog(page, outDir, now = () => new Date()) {
  const file = join(outDir, 'netlog.jsonl');
  const write = (entry) =>
    appendFileSync(file, `${JSON.stringify({ at: now().toISOString(), ...entry })}\n`);
  const starts = new WeakMap();
  const startOf = (request) => starts.get(request) ?? null;
  page.on('request', (request) => starts.set(request, now().toISOString()));
  page.on('requestfinished', async (request) => {
    const startedAt = startOf(request);
    const response = await request.response().catch(() => null);
    write({
      event: 'request',
      startedAt,
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
      startedAt: startOf(request),
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
  return write;
}
