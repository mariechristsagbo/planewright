import type { Camera } from '../camera/camera.ts';
import { panBy, wheelPan } from '../camera/pan.ts';
import { twoPointerCamera } from '../camera/pinch.ts';
import { wheelZoom } from '../camera/zoom.ts';
import type { WheelInput } from './events.ts';
import type { Gesture } from './gestures.ts';

// Viewport routing (docs/architecture/engine/interaction.md#gesture-recogniser): camera gestures
// and every wheel event go to the camera rules whatever the tool (REQ-V01, REQ-V04, REQ-V06,
// REQ-V07).

/** The camera after a wheel event: a zoom about the pointer, or a pan by the delta. */
export function cameraForWheel(camera: Camera, wheel: WheelInput): Camera {
  return wheel.zoom
    ? wheelZoom(camera, wheel.at, wheel.delta.y)
    : wheelPan(camera, wheel.delta, wheel.modifiers.shift);
}

export interface ViewportRouter {
  /** The camera after a camera gesture, or null for a gesture that belongs to the tool. */
  gesture(camera: Camera, gesture: Gesture): Camera | null;
}

/** Routes camera gestures; a pinch is computed from the camera at its start (REQ-V07). */
export function createViewportRouter(): ViewportRouter {
  let start: Camera | null = null;
  return {
    gesture(camera, gesture) {
      if (gesture.type === 'pan') return panBy(camera, gesture.delta);
      if (gesture.type === 'pinch-start') {
        start = camera;
        return camera;
      }
      if (gesture.type === 'pinch')
        return twoPointerCamera(start ?? camera, gesture.from, gesture.to);
      return null;
    },
  };
}
