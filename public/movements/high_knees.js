export const name = "High Knees";
export const defaultReps = 20;

import { isValid, angleBetween3D } from './utils.js';

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  const leftKneeHigh = isValid(kp[25]) && isValid(kp[23]) && kp[25].y < kp[23].y;
  const rightKneeHigh = isValid(kp[26]) && isValid(kp[24]) && kp[26].y < kp[24].y;

  const alternating = (rep % 2 === 0 && leftKneeHigh) || (rep % 2 === 1 && rightKneeHigh);

  const wantLeft = rep % 2 === 0;

  if (phase === "up" && alternating) {
    return { phase: "down", counted: true, cue: wantLeft ? "Now the right!" : "Now the left!" };
  }

  if (phase === "down" && !alternating) {
    return { phase: "up", counted: false, cue: "Drive that knee up!" };
  }

  return { phase, counted: false, cue: "Pump your arms, drive the knees!" };
}
