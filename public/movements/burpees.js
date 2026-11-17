export const name = "Burpees";
export const defaultReps = 10;

import { isValid } from './utils.js';

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  const leftHip      = kp[23];
  const rightHip     = kp[24];
  const leftAnkle    = kp[27];
  const rightAnkle   = kp[28];
  const leftShoulder = kp[11];
  const rightShoulder= kp[12];
  const leftWrist    = kp[15];
  const rightWrist   = kp[16];

  if (
    !isValid(leftHip) || !isValid(rightHip) ||
    !isValid(leftAnkle) || !isValid(rightAnkle) ||
    !isValid(leftShoulder) || !isValid(rightShoulder) ||
    !isValid(leftWrist) || !isValid(rightWrist)
  ) {
    return { phase, counted: false, cue: "Show your full body" };
  }

  const hipY      = (leftHip.y      + rightHip.y)      / 2;
  const ankleY    = (leftAnkle.y    + rightAnkle.y)    / 2;
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const wristY    = (leftWrist.y    + rightWrist.y)    / 2;

  // In canvas coords y=0 is TOP, so ankleY > hipY > shoulderY when standing.
  // hipRatio = hipY / ankleY:  near 0.5 when standing tall, near 1.0 when lying flat.
  // Using a ratio keeps the thresholds camera-distance-independent.
  const hipRatio = ankleY > 0 ? hipY / ankleY : 0.5;

  const bodyDown = hipRatio > 0.87;          // hips near floor level
  const bodyUp   = hipRatio < 0.72;          // hips high — standing
  const armsUp   = wristY < shoulderY;       // wrists above shoulders

  if (phase === "up" && bodyDown) {
    return { phase: "down", counted: false, cue: "Explode up!" };
  }

  if (phase === "down" && bodyUp && armsUp) {
    return { phase: "up", counted: true, cue: "Drop down fast!" };
  }

  return {
    phase, counted: false,
    cue: phase === "up" ? "Drop down fast!" : "Stand tall — arms up!",
  };
}
