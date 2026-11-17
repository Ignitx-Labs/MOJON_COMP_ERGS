export const name = "Overhead Press";
export const defaultReps = 12;

import { isValid } from './utils.js';

// Arms up: wrists are above the nose landmark (fully extended overhead).
// Arms down: wrists drop below shoulder level.

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  const nose      = kp[0];
  const lShoulder = kp[11], rShoulder = kp[12];
  const lWrist    = kp[15], rWrist    = kp[16];

  if (![nose, lShoulder, rShoulder, lWrist, rWrist].every(isValid)) {
    return { phase, counted: false, cue: "Show upper body" };
  }

  const shoulderY = (lShoulder.y + rShoulder.y) / 2;

  const armsUp   = lWrist.y < nose.y && rWrist.y < nose.y;
  const armsDown = lWrist.y > shoulderY + 0.05 && rWrist.y > shoulderY + 0.05;

  if (phase === 'down' && armsUp) {
    return { phase: 'up', counted: false, cue: "Lock it out!" };
  }

  if (phase === 'up' && armsDown) {
    return { phase: 'down', counted: true, cue: "Press again!" };
  }

  return {
    phase, counted: false,
    cue: phase === 'down' ? "Press overhead to lockout" : "Lower to shoulder level"
  };
}
