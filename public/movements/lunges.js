export const name = "Lunges";
export const defaultReps = 10;

import { isValid, angleBetween3D  } from './utils.js';

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  const left = [kp[23], kp[25], kp[27]];
  const right = [kp[24], kp[26], kp[28]];

  const angles = [];

  if (left.every(isValid)) {
    const angle = angleBetween3D(...left);
    if (!isNaN(angle)) angles.push(angle);
  }

  if (right.every(isValid)) {
    const angle = angleBetween3D(...right);
    if (!isNaN(angle)) angles.push(angle);
  }

  if (angles.length === 0) return { phase, counted: false, cue: "Show your full legs" };

  const minAngle = Math.min(...angles);

  if (phase === 'up' && minAngle < 100) {
    return { phase: 'down', counted: false, cue: "Front knee over ankle!" };
  }

  if (phase === 'down' && minAngle > 150) {
    return { phase: 'up', counted: true, cue: "Drive up!" };
  }

  return {
    phase, counted: false,
    cue: phase === 'up' ? "Step forward, lower down" : "Push through front heel"
  };
}
