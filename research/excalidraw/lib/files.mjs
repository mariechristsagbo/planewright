// Exclusive-create writes for driver artefacts. A name that is already used is never replaced,
// so every screenshot, ARIA snapshot or download name maps to exactly one capture.
import { createWriteStream, openSync, rmSync, writeFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';

/** Writes data to a new file. Fails with EEXIST, and changes nothing, when the file exists. */
export function writeExclusive(file, data) {
  writeFileSync(file, data, { flag: 'wx' });
}

/**
 * Streams into a new file. The file is created with O_EXCL before any byte is read, so an
 * existing file fails with EEXIST and stays untouched; a partial file that this call created is
 * removed when the stream fails.
 */
export async function streamExclusive(readable, file) {
  const fd = openSync(file, 'wx');
  try {
    await pipeline(readable, createWriteStream(file, { fd }));
  } catch (error) {
    rmSync(file, { force: true });
    throw error;
  }
}
