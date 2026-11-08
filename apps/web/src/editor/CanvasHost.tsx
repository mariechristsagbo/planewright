import { useEffect, useRef } from 'react';

import { attachInput, observeSize } from './attach-input.ts';
import { useEditorView, useSurface } from './surface.ts';

/**
 * The canvas host: a scene canvas and an overlay canvas stacked in one focusable region, sized
 * from the page, whose input goes to the editor and which draws every frame the editor builds.
 */
export function CanvasHost() {
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
      <div
        ref={host}
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
      <p id="canvas-instructions" className="canvas-instructions">
        Choose a drawing tool, then drag on the canvas to draw, or tap for the default size; the
        Selection tool (V) selects, moves, resizes and rotates what is drawn. Scroll to pan,
        Shift+scroll to pan sideways, and {mod}+scroll or pinch to zoom; {mod}+=, {mod}+− and {mod}
        +0 zoom from the keyboard. Drag with the middle button, with Space held or with the Hand
        tool (H) to pan.
      </p>
    </div>
  );
}
