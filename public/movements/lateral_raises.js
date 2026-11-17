export const name = "Lateral Raises";
export const defaultReps = 12;

import { isValid } from './utils.js';

// Arms raised: wrists rise to shoulder height or above.
// Arms down: wrists fall below hip level.

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  const lShoulder = kp[11], rShoulder = kp[12];
  const lHip = kp[23],      rHip = kp[24];
  const lWrist = kp[15],    rWrist = kp[16];

  if (![lShoulder, rShoulder, lHip, rHip, lWrist, rWrist].every(isValid)) {
    return { phase, counted: false, cue: "Show upper body" };
  }

  const hipY = (lHip.y + rHip.y) / 2;
  const shoulderY = (lShoulder.y + rShoulder.y) / 2;

  const armsUp   = lWrist.y < shoulderY + 0.04 && rWrist.y < shoulderY + 0.04;
  const armsDown = lWrist.y > hipY - 0.05      && rWrist.y > hipY - 0.05;

  if (phase === 'down' && armsUp) {
    return { phase: 'up', counted: false, cue: "Hold — feel the burn!" };
  }

  if (phase === 'up' && armsDown) {
    return { phase: 'down', counted: true, cue: "Control down!" };
  }

  return {
    phase, counted: false,
    cue: phase === 'down' ? "Raise arms to shoulder height" : "Lower with control"
  };
}
