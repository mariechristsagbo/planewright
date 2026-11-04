// Counts occurrences of standard web-platform API identifiers in exported shipped scripts.
// Output is identifier -> count per file. No source text, excerpts or offsets are printed,
// so the result is a static observation about platform capabilities, not a code transcript.
//
// Usage: node research/excalidraw/api-surface.mjs <export_web_scripts output directory>
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const IDENTIFIERS = [
  'showOpenFilePicker',
  'showSaveFilePicker',
  'FileSystemFileHandle',
  'launchQueue',
  'indexedDB',
  'localStorage',
  'sessionStorage',
  'BroadcastChannel',
  'serviceWorker',
  'new Worker',
  'SharedWorker',
  'WebSocket',
  'EventSource',
  'crypto.subtle',
  'AES-GCM',
  'navigator.clipboard',
  'ClipboardItem',
  'clipboardData',
  'requestAnimationFrame',
  'OffscreenCanvas',
  'Path2D',
  'getContext',
  'ResizeObserver',
  'PointerEvent',
  'pointerdown',
  'touchstart',
  'gesturestart',
  'wheel',
  'visibilitychange',
  'beforeunload',
  'navigator.onLine',
  'FontFace',
  'WebAssembly',
  'CompressionStream',
  'navigator.share',
  'beforeinstallprompt',
];

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.js') ? [path] : [];
  });
}

function count(text, needle) {
  let total = 0;
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) {
    total += 1;
  }
  return total;
}

const [root] = process.argv.slice(2);
if (!root) throw new Error('Pass an export_web_scripts output directory.');
const report = files(join(root, 'files')).map((path) => {
  const text = readFileSync(path, 'utf8');
  const hits = Object.fromEntries(
    IDENTIFIERS.map((id) => [id, count(text, id)]).filter(([, n]) => n > 0),
  );
  return {
    file: relative(root, path).replace(/origins\/[0-9a-f]{64}\//u, ''),
    bytes: text.length,
    hits,
  };
});
console.log(JSON.stringify(report, null, 1));
