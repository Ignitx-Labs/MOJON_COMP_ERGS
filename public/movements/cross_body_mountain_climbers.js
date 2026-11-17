export const name = "Cross-Body Mountain Climbers";
export const defaultReps = 20;

import { isValid } from './utils.js';

// From plank, drive knee to the OPPOSITE elbow.
// Alternates left-knee→right-elbow and right-knee→left-elbow.

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  const lKnee = kp[25], rKnee = kp[26];
  const lElbow = kp[13], rElbow = kp[14];

  if (![lKnee, rKnee, lElbow, rElbow].every(isValid)) {
    return { phase, counted: false, cue: "Get into plank position" };
  }

  const THRESH = 0.12;

  const leftToRight  = Math.abs(lKnee.x - rElbow.x) < THRESH && Math.abs(lKnee.y - rElbow.y) < THRESH;
  const rightToLeft  = Math.abs(rKnee.x - lElbow.x) < THRESH && Math.abs(rKnee.y - lElbow.y) < THRESH;

  const wantLeft = rep % 2 === 0;
  const triggered = wantLeft ? leftToRight : rightToLeft;

  if (phase === 'up' && triggered) {
    return { phase: 'down', counted: true, cue: wantLeft ? "Now right knee to left!" : "Now left knee to right!" };
  }

  if (phase === 'down' && !triggered) {
    return { phase: 'up', counted: false, cue: wantLeft ? "Drive left knee to right elbow" : "Drive right knee to left elbow" };
  }

  return { phase, counted: false, cue: "Plank — drive knees across!" };
}
