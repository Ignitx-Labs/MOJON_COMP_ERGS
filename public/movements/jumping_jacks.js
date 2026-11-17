export const name = "Jumping Jacks";
export const defaultReps = 15;

import { isValid } from './utils.js';

// Arms up: wrists rise above shoulder level (wrist.y < shoulder.y in screen coords).
// Arms down: wrists drop below mid-body (between shoulder and hip).
// Legs: ankle lateral separation detects wide vs together.

export function detector(pose, rep, phase) {
  const kp = pose.keypoints ?? pose;

  const lw = kp[15], ls = kp[11], lh = kp[23];
  const rw = kp[16], rs = kp[12], rh = kp[24];
  const la = kp[27], ra = kp[28];

  if (![lw, ls, lh, rw, rs, rh, la, ra].every(isValid)) {
    return { phase, counted: false, zones: {} };
  }

  // Arms up: both wrists above shoulder level
  const armsUp = lw.y < ls.y && rw.y < rs.y;

  // Arms down: both wrists below mid-body (halfway between shoulder and hip)
  const midY = ((ls.y + rs.y) / 2 + (lh.y + rh.y) / 2) / 2;
  const armsDown = lw.y > midY && rw.y > midY;

  // Legs wide / together by ankle X separation
  const legDistance  = Math.abs(la.x - ra.x);
  const legsWide     = legDistance > 0.2;
  const legsTogether = legDistance < 0.08;

  const zones = {
    leftArm:  armsUp ? 'ok' : 'default',
    rightArm: armsUp ? 'ok' : 'default',
    leftLeg:  legsWide ? 'ok' : legsTogether ? 'default' : 'fail',
    rightLeg: legsWide ? 'ok' : legsTogether ? 'default' : 'fail'
  };

  if (phase === 'down' && armsUp && legsWide) {
    return { phase: 'up', counted: false, zones, cue: "Full extension — hold!" };
  }

  if (phase === 'up' && armsDown && legsTogether) {
    return { phase: 'down', counted: true, zones, cue: "Arms up, feet wide!" };
  }

  return {
    phase, counted: false, zones,
    cue: phase === 'down' ? "Jump out, arms overhead" : "Jump in, arms down"
  };
}
