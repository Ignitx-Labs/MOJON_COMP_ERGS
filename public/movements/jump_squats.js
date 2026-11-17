export const name = "Jump Squats";
export const defaultReps = 10;

import { isValid, angleBetween3D } from './utils.js';

// Same squat depth detection as regular squats.
// 'up' threshold is higher (160°) to encourage full explosive extension.

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

  if (angles.length === 0) return { phase, counted: false, cue: "Show your full body" };

  const squatAngle = Math.min(...angles);

  if (phase === 'up' && squatAngle < 100) {
    return { phase: 'down', counted: false, cue: "Load the jump!" };
  }

  if (phase === 'down' && squatAngle > 160) {
    return { phase: 'up', counted: true, cue: "Explode up!" };
  }

  return {
    phase, counted: false,
    cue: phase === 'up' ? "Squat deep" : "Drive up and jump!"
  };
}
