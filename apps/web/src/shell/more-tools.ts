import type { EditorCommand, ToolId } from '@planewright/engine';

import { TOOL_GLYPHS } from '../ui/tool-items.ts';
import type { IconName } from './glyphs.ts';

// The phone's dock and More (ADR 0012, decision 2; the v0.2 plan's S8): on a phone in portrait the
// tool bar is a dock of the registry's tools but Hand and Diamond, then More, whose popover holds
// Hand, Diamond and Tool lock. The set is the shell's constant, not the engine's: both lists are
// read from the registry in its order, and a command that the registry lacks is left out, never
// invented.

/** The tools that More holds rather than the dock. */
const MORE_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>(['hand', 'diamond']);

/** The other command that More holds. */
const MORE_COMMAND = 'tool.lock';

/** More's place among the tool bar's stops, which no registry command's identifier takes. */
export const MORE = 'more';

/** More's button's and its popover's identifiers, which name and control each other. */
export const MORE_BUTTON_ID = 'more-button';
export const MORE_TOOLS_ID = 'more-tools';

const inMore = ({ id, tool }: EditorCommand): boolean =>
  tool === undefined ? id === MORE_COMMAND : MORE_TOOLS.has(tool);

/** The dock's tools: the registry's tools that More does not hold, in the registry's order. */
export const dockCommands = (commands: readonly EditorCommand[]): EditorCommand[] =>
  commands.filter((command) => command.tool !== undefined && !inMore(command));

/** More's commands: Hand, Diamond and Tool lock, those that the registry has, in its order. */
export const moreCommands = (commands: readonly EditorCommand[]): EditorCommand[] =>
  commands.filter(inMore);

/** What More shows: its own glyph, or the active tool's, pressed, while More holds that tool. */
export interface MoreFace {
  readonly glyph: IconName;
  readonly pressed: boolean;
}

/** More's face for the active tool; tool lock, which changes no tool, never changes it. */
export const moreFace = ({ tool }: { readonly tool: ToolId }): MoreFace =>
  MORE_TOOLS.has(tool)
    ? { glyph: TOOL_GLYPHS[tool], pressed: true }
    : { glyph: 'more', pressed: false };
