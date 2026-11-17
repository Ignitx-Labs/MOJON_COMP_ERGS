export const name = "Squats";
export const defaultReps = 10;

import { isValid, angleBetween3D } from './utils.js';

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  const left  = angleBetween3D(kp[23], kp[25], kp[27]);
  const right = angleBetween3D(kp[24], kp[26], kp[28]);
  const angles = [left, right].filter(a => !isNaN(a));

  if (angles.length === 0) return { phase, counted: false, cue: "Show your full body" };

  const squatAngle = Math.min(...angles);

  if (phase === 'up' && squatAngle < 100) {
    return { phase: 'down', counted: false, cue: "Hold depth!" };
  }

  if (phase === 'down' && squatAngle > 150) {
    return { phase: 'up', counted: true, cue: "Squeeze glutes!" };
  }

  return {
    phase, counted: false,
    cue: phase === 'up' ? "Sit back and down" : "Drive through your heels"
  };
}
