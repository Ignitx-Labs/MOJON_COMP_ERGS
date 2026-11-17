export const name = "Reverse Lunges";
export const defaultReps = 10;

import { isValid, angleBetween3D } from './utils.js';

// Same joint-angle detection as forward lunges.
// Step back: the rear knee drops, creating the same <90° bend signature.

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

  const minAngle = Math.min(...angles);

  if (phase === 'up' && minAngle < 100) {
    return { phase: 'down', counted: false, cue: "Back knee nearly touches!" };
  }

  if (phase === 'down' && minAngle > 150) {
    return { phase: 'up', counted: true, cue: "Step back in!" };
  }

  return {
    phase, counted: false,
    cue: phase === 'up' ? "Step back, drop the knee" : "Push through front heel"
  };
}
