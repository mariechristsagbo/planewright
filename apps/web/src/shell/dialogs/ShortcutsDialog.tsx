import type { CommandId, EditorCommand, KeyChord } from '@planewright/engine';
import { Fragment } from 'react';

import { useSurface } from '../../editor/surface.ts';
import type { Platform } from '../../platform/platform.ts';
import { shortcutText } from '../../ui/shortcuts.ts';
import { ModalDialog } from './ModalDialog.tsx';

// The Keyboard shortcuts dialog (ADR 0012, decisions 2 and 13; the v0.2 plan's S4): every command
// of the registry, the one source of the commands' labels and keys (REQ-C14), with its keys as
// shortcutText() writes them, grouped by the area that its identifier starts with.

/** The area that a command's identifier starts with, such as "tool" for "tool.hand". */
type AreaOf<Id> = Id extends `${infer Area}.${string}` ? Area : never;

/** Each area's heading, in the dialog's order; the type asks for one for every area there is. */
const AREAS: Readonly<Record<AreaOf<CommandId>, string>> = {
  tool: 'Tools',
  history: 'History',
  selection: 'Selection',
  view: 'View',
  canvas: 'Canvas',
};

/** A command's keys, each chord in a key of its own, joined by "or" as shortcutText() joins them. */
function Keys({
  chords,
  platform,
}: {
  readonly chords: readonly KeyChord[];
  readonly platform: Platform;
}) {
  return chords.map((chord, index) => {
    const text = shortcutText([chord], platform);
    return (
      <Fragment key={text}>
        {index > 0 ? ' or ' : null}
        <kbd>{text}</kbd>
      </Fragment>
    );
  });
}

interface AreaProps {
  readonly area: string;
  readonly heading: string;
  readonly commands: readonly EditorCommand[];
  readonly platform: Platform;
}

/** One area's commands, in registry order, in a table named by the area's heading. */
function AreaTable({ area, heading, commands, platform }: AreaProps) {
  const id = `shortcuts-${area}`;
  return (
    <>
      <h3 id={id}>{heading}</h3>
      <table className="shortcut-table" aria-labelledby={id}>
        <tbody>
          {commands.map(({ id: command, label, shortcuts }) => (
            <tr key={command}>
              <th scope="row">{label}</th>
              <td>
                <Keys chords={shortcuts} platform={platform} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Every registry command with its keys, in the shell's modal dialog, as About this build is. */
export function ShortcutsDialog({ onClose }: { readonly onClose: () => void }) {
  const { editor, platform } = useSurface();
  return (
    <ModalDialog id="keyboard-shortcuts" title="Keyboard shortcuts" onClose={onClose}>
      <p>
        Every command of this build with its keys. The keys work while the drawing canvas has the
        focus.
      </p>
      {Object.entries(AREAS).map(([area, heading]) => (
        <AreaTable
          key={area}
          area={area}
          heading={heading}
          commands={editor.commands.filter(({ id }) => id.startsWith(`${area}.`))}
          platform={platform}
        />
      ))}
    </ModalDialog>
  );
}
