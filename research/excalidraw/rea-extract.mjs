// Reduces a saved REA tool result to sanitized, committable facts.
//
// - capture_web_screenshot: decodes the PNG next to the input, verifies its SHA-256 and byte
//   count against the Evidence record, and reports the PNG's own dimensions.
// - inspect_web_page: keeps named accessibility nodes, storage key names, script and resource
//   URLs (no query values), worker counts and completeness flags. No values or payloads.
//
// Usage: node research/excalidraw/rea-extract.mjs <rea-result.json> [summary-out.json]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

import { stripQuery } from './lib/sanitise.mjs';

const INTERACTIVE = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'textbox',
  'combobox',
  'slider',
  'tab',
  'switch',
  'dialog',
  'heading',
  'region',
  'Canvas',
  'searchbox',
  'spinbutton',
  'listbox',
  'option',
]);

function screenshot(evidence, input) {
  const { artifact, viewport, captured_at: capturedAt } = evidence.normalized_result;
  const bytes = Buffer.from(artifact.data_base64, 'base64');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== artifact.sha256 || bytes.length !== artifact.bytes) {
    throw new Error('Decoded PNG does not match the Evidence digest or byte count.');
  }
  const png = input.replace(/\.json$/u, '.png');
  writeFileSync(png, bytes);
  return {
    kind: 'rea-screenshot',
    evidence_id: evidence.evidence_id,
    captured_at: capturedAt,
    viewport,
    png: {
      sha256,
      bytes: bytes.length,
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    },
    dimensions_match_viewport:
      bytes.readUInt32BE(16) === viewport.width && bytes.readUInt32BE(20) === viewport.height,
  };
}

function states(node) {
  return Object.fromEntries(
    (node.states ?? [])
      .filter((s) =>
        ['pressed', 'checked', 'expanded', 'disabled', 'selected', 'haspopup'].includes(s.name),
      )
      .map((s) => [s.name, s.value]),
  );
}

function storageKeys(storage) {
  if (!storage) return null;
  return {
    local_storage_keys: [...storage.local_storage_keys].sort(),
    session_storage_keys: [...storage.session_storage_keys].sort(),
    indexed_db_names: [...storage.indexed_db_names].sort(),
    cache_names: storage.cache_names,
    values_redacted: storage.values_redacted,
  };
}

function inventory(result) {
  return {
    scripts: (result.scripts?.items ?? []).map((s) => ({
      url: stripQuery(s.url),
      module: s.is_module,
      length: s.length,
    })),
    resources: (result.resources ?? []).map((r) => ({
      url: stripQuery(r.url),
      type: r.type,
      size: r.content_size,
    })),
    ...eventCounts(result),
  };
}

function eventCounts(result) {
  return {
    workers: result.workers?.length ?? null,
    websocket_connections: result.network?.websocket_connections?.length ?? null,
    console_events: result.console?.events?.length ?? null,
  };
}

function inspection(evidence) {
  const result = evidence.normalized_result;
  const nodes = result.accessibility?.nodes ?? [];
  return {
    kind: 'rea-inspect-web-page',
    evidence_id: evidence.evidence_id,
    url: stripQuery(result.target?.url ?? ''),
    capture_window: result.capture_window,
    completeness: result.completeness?.status,
    conditions: result.completeness?.conditions,
    accessibility_total: result.accessibility?.total_nodes,
    dom_total: result.dom?.total_nodes,
    controls: nodes
      .filter((n) => INTERACTIVE.has(n.role) && !n.ignored)
      .map((n) => ({ role: n.role, name: n.name, description: n.description, ...states(n) })),
    storage: storageKeys(result.storage),
    ...inventory(result),
    limitations: result.limitations,
  };
}

const [input, output] = process.argv.slice(2);
if (!input) throw new Error('Pass a saved REA result JSON file.');
const evidence = JSON.parse(readFileSync(input, 'utf8'));
const summaries = { capture_web_screenshot: screenshot, inspect_web_page: inspection };
const summarise = summaries[evidence.operation];
if (!summarise) throw new Error(`Unsupported REA operation "${String(evidence.operation)}".`);
const summary = summarise(evidence, input);
const text = `${JSON.stringify(summary, null, 2)}\n`;
if (output) writeFileSync(output, text);
else process.stdout.write(text);
