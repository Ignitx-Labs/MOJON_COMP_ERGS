export const name = "Side Lunges";
export const defaultReps = 10;

import { isValid, angleBetween3D } from './utils.js';

// One leg bends (<90°) while the other stays extended (>150°).
// Counts each side as one rep.

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  if (![kp[23], kp[24], kp[25], kp[26], kp[27], kp[28]].every(isValid)) {
    return { phase, counted: false, cue: "Show your full legs" };
  }

  const leftAngle  = angleBetween3D(kp[23], kp[25], kp[27]);
  const rightAngle = angleBetween3D(kp[24], kp[26], kp[28]);

  const sideLunge =
    (!isNaN(leftAngle)  && !isNaN(rightAngle)) &&
    ((leftAngle < 100 && rightAngle > 145) || (rightAngle < 100 && leftAngle > 145));

  const standing =
    !isNaN(leftAngle) && !isNaN(rightAngle) &&
    leftAngle > 150 && rightAngle > 150;

  if (phase === 'up' && sideLunge) {
    return { phase: 'down', counted: false, cue: "Sit into that hip!" };
  }

  if (phase === 'down' && standing) {
    return { phase: 'up', counted: true, cue: "Other side!" };
  }

  return {
    phase, counted: false,
    cue: phase === 'up' ? "Step wide, bend one knee" : "Drive up through heel"
  };
}
