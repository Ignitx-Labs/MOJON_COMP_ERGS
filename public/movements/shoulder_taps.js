export const name = "Shoulder Taps";
export const defaultReps = 20;

import { isValid, angleBetween3D } from './utils.js';

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  const lw = kp[15]; // left wrist
  const rw = kp[16]; // right wrist
  const rs = kp[12]; // right shoulder
  const ls = kp[11]; // left shoulder
  const lh = kp[23]; // left hip
  const rh = kp[24]; // right hip

  if (![lw, rw, rs, ls, lh, rh].every(isValid)) {
    return { phase, counted: false, cue: "Show upper body and hips" };
  }

  const hipY = (lh.y + rh.y) / 2;
  const hipX = (lh.x + rh.x) / 2;

  const leftTap = Math.abs(lw.x - rs.x) < 0.1 && Math.abs(lw.y - rs.y) < 0.1;
  const rightTap = Math.abs(rw.x - ls.x) < 0.1 && Math.abs(rw.y - ls.y) < 0.1;

  const hipsStable = Math.abs(lh.y - rh.y) < 0.05;

  const tapDetected = (leftTap || rightTap) && hipsStable;

  if (phase === "down" && tapDetected) {
    return { phase: "up", counted: false, cue: "Hold — stay square!" };
  }

  if (phase === "up" && !tapDetected) {
    return { phase: "down", counted: true, cue: "Tap the other shoulder!" };
  }

  return { phase, counted: false, cue: hipsStable ? "Reach and tap!" : "Keep hips still!" };
}