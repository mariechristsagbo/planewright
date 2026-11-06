/**
 * The public entry of `@planewright/engine`. The engine exports its types and, once the editor
 * exists, one constructor (docs/architecture/engine/modules.md#public-surface); every layer stays
 * internal to the package.
 */
export type { Cancel, Clock, IdSource, Scheduler } from './ports/ports.ts';
