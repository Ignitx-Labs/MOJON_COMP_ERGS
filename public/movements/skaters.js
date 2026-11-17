export const name = "Skaters";
export const defaultReps = 20;

import { isValid } from './utils.js';

// Detects lateral weight shift: one ankle is well to the side of the hip midpoint.
// Alternates left-right each rep.

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  const lHip = kp[23], rHip = kp[24];
  const lAnkle = kp[27], rAnkle = kp[28];

  if (![lHip, rHip, lAnkle, rAnkle].every(isValid)) {
    return { phase, counted: false, cue: "Show your full body" };
  }

  const hipMidX = (lHip.x + rHip.x) / 2;
  const lOffset = lAnkle.x - hipMidX; // negative = left of centre
  const rOffset = rAnkle.x - hipMidX; // positive = right of centre

  // Landing left: left ankle is left of centre, right ankle further right
  const leftLanding  = lOffset < -0.08 && rOffset > 0.04;
  // Landing right: right ankle is right of centre, left ankle further left
  const rightLanding = rOffset >  0.08 && lOffset < -0.04;

  const wantLeft  = rep % 2 === 0;
  const triggered = wantLeft ? leftLanding : rightLanding;

  if (phase === 'up' && triggered) {
    return { phase: 'down', counted: true, cue: wantLeft ? "Now right!" : "Now left!" };
  }

  if (phase === 'down' && !triggered) {
    return { phase: 'up', counted: false, cue: "Leap to the side!" };
  }

  return { phase, counted: false, cue: "Wide lateral hops" };
}
