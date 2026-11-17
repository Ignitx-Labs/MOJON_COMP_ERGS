export const name = "Pushups";
export const defaultReps = 10;

import { isValid, angleBetween3D } from './utils.js';

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  const angles = [];
  if ([kp[11], kp[13], kp[15]].every(isValid)) {
    const a = angleBetween3D(kp[11], kp[13], kp[15]);
    if (!isNaN(a)) angles.push(a);
  }
  if ([kp[12], kp[14], kp[16]].every(isValid)) {
    const a = angleBetween3D(kp[12], kp[14], kp[16]);
    if (!isNaN(a)) angles.push(a);
  }

  if (angles.length === 0) return { phase, counted: false, cue: "Show upper body" };

  const avgAngle = angles.reduce((a, b) => a + b) / angles.length;

  if (phase === 'up' && avgAngle < 90) {
    return { phase: 'down', counted: false, cue: "Chest to the floor!" };
  }

  if (phase === 'down' && avgAngle > 140) {
    return { phase: 'up', counted: true, cue: "Push the ground away!" };
  }

  return {
    phase, counted: false,
    cue: phase === 'up' ? "Keep core tight, lower slow" : "Full extension at the top"
  };
}
