export const name = "Calf Raises";
export const defaultReps = 15;

import { isValid } from './utils.js';

// Detects heel lift by comparing heel Y to foot-index Y.
// When flat-footed: heel ≈ foot-index height.
// When on tiptoe: heel rises above foot-index (smaller Y in screen coords).

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  const lHeel = kp[29], rHeel = kp[30];
  const lFoot = kp[31], rFoot = kp[32];

  if (![lHeel, rHeel, lFoot, rFoot].every(isValid)) {
    return { phase, counted: false, cue: "Show your full legs" };
  }

  const leftRaised  = lHeel.y < lFoot.y - 0.02;
  const rightRaised = rHeel.y < rFoot.y - 0.02;
  const raised = leftRaised && rightRaised;

  const leftFlat  = lHeel.y >= lFoot.y - 0.01;
  const rightFlat = rHeel.y >= rFoot.y - 0.01;
  const flat = leftFlat && rightFlat;

  if (phase === 'down' && raised) {
    return { phase: 'up', counted: false, cue: "Hold the top!" };
  }

  if (phase === 'up' && flat) {
    return { phase: 'down', counted: true, cue: "Rise again!" };
  }

  return {
    phase, counted: false,
    cue: phase === 'down' ? "Rise onto your toes" : "Lower with control"
  };
}
