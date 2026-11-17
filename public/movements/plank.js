export const name = "Plank";
export const defaultReps = 4;

import { isValid } from './utils.js';

// Isometric hold: 1 rep = 5 seconds in valid plank position.
// Plank signature from a front-facing camera: wrists and ankles both
// close to the bottom of the frame (both on the floor), indicating a
// horizontal body position.

let holdStart = null;
const HOLD_MS = 5000;

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  const lWrist = kp[15], rWrist = kp[16];
  const lAnkle = kp[27], rAnkle = kp[28];
  const lHip   = kp[23], rHip   = kp[24];
  const lShoulder = kp[11], rShoulder = kp[12];

  if (![lWrist, rWrist, lAnkle, rAnkle, lHip, rHip, lShoulder, rShoulder].every(isValid)) {
    holdStart = null;
    return { phase, counted: false, cue: "Get into plank position" };
  }

  const wristY  = (lWrist.y + rWrist.y) / 2;
  const ankleY  = (lAnkle.y + rAnkle.y) / 2;
  const hipY    = (lHip.y + rHip.y) / 2;

  // In plank, wrists and ankles are both low in the frame (on the floor)
  // AND the hip stays level with shoulders (no piking/sagging)
  const onFloor   = wristY > 0.55 && ankleY > 0.55;
  const levelBody = Math.abs(hipY - wristY) < 0.25;

  const inPlank = onFloor && levelBody;

  if (!inPlank) {
    holdStart = null;
    return {
      phase, counted: false,
      cue: onFloor ? "Keep hips level!" : "Lower your body to the floor"
    };
  }

  const now = performance.now();
  if (!holdStart) holdStart = now;

  const held   = now - holdStart;
  const remain = Math.ceil((HOLD_MS - held) / 1000);

  if (held >= HOLD_MS) {
    holdStart = now;
    return { phase: 'up', counted: true, cue: "Rep done! Stay tight!" };
  }

  return {
    phase: 'down', counted: false,
    cue: `Hold tight… ${remain}s`
  };
}
