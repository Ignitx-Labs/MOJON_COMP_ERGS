export const name = "Wall Sit";
export const defaultReps = 5;

import { isValid, angleBetween3D } from './utils.js';

// Isometric hold: 1 rep = 5 seconds in a valid 80–100° squat position.
// Module-level timer so it persists across detector calls.

let holdStart = null;
const HOLD_MS = 5000;

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  const angles = [];
  if ([kp[23], kp[25], kp[27]].every(isValid)) {
    const a = angleBetween3D(kp[23], kp[25], kp[27]);
    if (!isNaN(a)) angles.push(a);
  }
  if ([kp[24], kp[26], kp[28]].every(isValid)) {
    const a = angleBetween3D(kp[24], kp[26], kp[28]);
    if (!isNaN(a)) angles.push(a);
  }

  if (angles.length === 0) {
    holdStart = null;
    return { phase, counted: false, cue: "Show your full legs" };
  }

  const avg = angles.reduce((a, b) => a + b) / angles.length;
  const inPosition = avg > 75 && avg < 115;

  if (!inPosition) {
    holdStart = null;
    return { phase, counted: false, cue: "Bend knees to 90° and hold" };
  }

  const now = performance.now();
  if (!holdStart) holdStart = now;

  const held    = now - holdStart;
  const remain  = Math.ceil((HOLD_MS - held) / 1000);

  if (held >= HOLD_MS) {
    holdStart = now; // reset for next rep
    return { phase: 'up', counted: true, cue: "Rep done! Keep holding!" };
  }

  return {
    phase: 'down', counted: false,
    cue: remain > 0 ? `Hold… ${remain}s` : "Almost there!"
  };
}
