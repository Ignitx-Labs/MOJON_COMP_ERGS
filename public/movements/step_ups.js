export const name = "Step Ups";
export const defaultReps = 20;

import { isValid } from './utils.js';

// Alternating high-knee drive — knee must clear above hip level.
// Stricter threshold than high_knees to simulate stepping onto a box.

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  const lHip   = kp[23], rHip   = kp[24];
  const lKnee  = kp[25], rKnee  = kp[26];

  if (![lHip, rHip, lKnee, rKnee].every(isValid)) {
    return { phase, counted: false, cue: "Show your full legs" };
  }

  // Y decreases upward; knee above hip = knee.y < hip.y with margin
  const leftHigh  = lKnee.y < lHip.y - 0.06;
  const rightHigh = rKnee.y < rHip.y - 0.06;

  const wantLeft = rep % 2 === 0;
  const triggered = wantLeft ? leftHigh : rightHigh;

  if (phase === 'up' && triggered) {
    return { phase: 'down', counted: true, cue: wantLeft ? "Now the right!" : "Now the left!" };
  }

  if (phase === 'down' && !triggered) {
    return { phase: 'up', counted: false, cue: "Drive that knee up!" };
  }

  return { phase, counted: false, cue: "Step up, drive the knee" };
}
