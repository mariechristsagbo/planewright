import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { CANVAS_ID } from '../a11y/focus.ts';
import { attachInput, observeSize } from './attach-input.ts';
import { useEditorView, useSurface } from './surface.ts';
import { TextEditor } from './text/TextEditor.tsx';

/**
 * The canvas host: a scene canvas and an overlay canvas stacked in one focusable region, sized
 * from the page, whose input goes to the editor and which draws every frame the editor builds. The
 * text area of a text being edited, with its hint chip, lies over it, outside the region, so its
 * input stays its own. The shell's chrome over the canvas, its focus ring and chip (the v0.2 plan's
 * S10), comes as children after the text layer, inside the stage and outside the region, so that
 * this module imports no shell component and a view that renders the host builds them not again.
 */
export function CanvasHost({ children }: { readonly children?: ReactNode }) {
  const { editor, platform, createRenderer } = useSurface();
  const { cursor } = useEditorView();
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (host.current === null || scene.current === null || overlay.current === null) return;
    const renderer = createRenderer(scene.current, overlay.current);
    const stopFrames = editor.onFrame((frame) => {
      renderer.render(frame);
    });
    const detach = attachInput(host.current, scene.current, editor, platform);
    const stopSizing = observeSize(scene.current, editor);
    return () => {
      stopSizing();
      detach();
      stopFrames();
      renderer.dispose();
    };
  }, [editor, platform, createRenderer]);

  const mod = platform === 'apple' ? 'Cmd' : 'Ctrl';
  return (
    <div className="canvas-area">
      <div className="canvas-stage">
        <div
          ref={host}
          id={CANVAS_ID}
          className="canvas-host"
          role="region"
          aria-label="Drawing canvas"
          aria-describedby="canvas-instructions"
          tabIndex={0}
          style={{ cursor }}
        >
          <canvas ref={scene} className="canvas-layer" aria-hidden="true" />
          <canvas ref={overlay} className="canvas-layer" aria-hidden="true" />
        </div>
        <div className="text-layer">
          <TextEditor host={host} />
        </div>
        {children}
      </div>
      {/* The canvas's description, said with its name; the full-bleed canvas shows no paragraph. */}
      <p id="canvas-instructions" className="visually-hidden">
        Choose a drawing tool, then drag on the canvas to draw, or tap for the default size; the
        Selection tool (V) selects, moves, resizes and rotates what is drawn. Scroll to pan,
        Shift+scroll to pan sideways, and {mod}+scroll or pinch to zoom; {mod}+=, {mod}+− and {mod}
        +0 zoom from the keyboard. Drag with the middle button, with Space held or with the Hand
        tool (H) to pan. With the Text tool (T), click or tap to place a text and type it; Escape,{' '}
        {mod}+Enter or a press elsewhere ends it, and a double-click or double tap on a text edits
        it again. From the keyboard, Enter draws the drawing tool’s element at the centre of the
        canvas, or edits the one selected text with the Selection tool.
      </p>
    </div>
  );
}
