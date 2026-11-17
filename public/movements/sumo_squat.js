export const name = "Sumo Squat";
export const defaultReps = 12;

import { isValid, angleBetween3D } from './utils.js';

// Wide stance squat: ankle spread must exceed shoulder width.
// Same knee-angle thresholds as regular squats.

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  if (![kp[11], kp[12], kp[23], kp[24], kp[25], kp[26], kp[27], kp[28]].every(isValid)) {
    return { phase, counted: false, cue: "Show full body" };
  }

  const ankleWidth    = Math.abs(kp[27].x - kp[28].x);
  const shoulderWidth = Math.abs(kp[11].x - kp[12].x);
  const wideStance    = ankleWidth > shoulderWidth * 1.25;

  if (!wideStance) {
    return { phase, counted: false, cue: "Widen your stance!" };
  }

  const leftAngle  = angleBetween3D(kp[23], kp[25], kp[27]);
  const rightAngle = angleBetween3D(kp[24], kp[26], kp[28]);
  const angles = [leftAngle, rightAngle].filter(a => !isNaN(a));

  if (angles.length === 0) return { phase, counted: false, cue: "Show full legs" };

  const squatAngle = Math.min(...angles);

  if (phase === 'up' && squatAngle < 100) {
    return { phase: 'down', counted: false, cue: "Knees out, sit deep!" };
  }

  if (phase === 'down' && squatAngle > 150) {
    return { phase: 'up', counted: true, cue: "Squeeze at the top!" };
  }

  return {
    phase, counted: false,
    cue: phase === 'up' ? "Squat wide and low" : "Drive through heels"
  };
}
