// movements/utils.js
// Shared helpers for all movement detectors.
// angleBetween3D now goes through proper quaternion rotation math rather than
// a raw dot-product. It also accepts 3 keypoints (proximal, joint, distal)
// matching how every exercise detector already calls it — the old 2-arg
// signature silently discarded the third point and produced incorrect angles.

import { jointAngleDeg, jointQuaternion, lateralDeviationDeg } from '../utils/quaternion.js';

// Re-export quaternion primitives so movement detectors can import them
// from one place without a separate path dependency.
export { jointQuaternion, lateralDeviationDeg };

// ── Canvas helpers ────────────────────────────────────────────────────────────

export function drawKeypoints(ctx, keypoints) {
  keypoints.forEach(kp => {
    if (kp && kp.x != null && kp.y != null && kp.score > 0.5) {
      ctx.beginPath();
      ctx.arc(kp.x * ctx.canvas.width, kp.y * ctx.canvas.height, 4, 0, 2 * Math.PI);
      ctx.fillStyle = 'lime';
      ctx.fill();
    }
  });
}

export function drawSkeleton(ctx, keypoints) {
  const connections = [
    ['left_shoulder',  'right_shoulder'],
    ['left_shoulder',  'left_elbow'],
    ['left_elbow',     'left_wrist'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow',    'right_wrist'],
    ['left_hip',       'right_hip'],
    ['left_shoulder',  'left_hip'],
    ['right_shoulder', 'right_hip'],
    ['left_hip',       'left_knee'],
    ['left_knee',      'left_ankle'],
    ['right_hip',      'right_knee'],
    ['right_knee',     'right_ankle']
  ];

  connections.forEach(([p1, p2]) => {
    const kp1 = keypoints.find(k => k.name === p1);
    const kp2 = keypoints.find(k => k.name === p2);
    if (kp1 && kp2 && kp1.score > 0.5 && kp2.score > 0.5) {
      ctx.beginPath();
      ctx.moveTo(kp1.x * ctx.canvas.width, kp1.y * ctx.canvas.height);
      ctx.lineTo(kp2.x * ctx.canvas.width, kp2.y * ctx.canvas.height);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}

// ── Angle math (quaternion-powered) ──────────────────────────────────────────

/**
 * Angle at the middle keypoint `b`, formed by the chain a → b → c.
 * Uses quaternion rotation internally — same scalar result but the full
 * joint orientation is preserved for future enrichment (valgus detection, etc).
 *
 * NOTE: all exercise detectors already call this with 3 keypoints.
 * The previous implementation silently ignored the third argument.
 *
 * @param {{ x, y, z? }} a  proximal keypoint (e.g. hip)
 * @param {{ x, y, z? }} b  joint keypoint   (e.g. knee)
 * @param {{ x, y, z? }} c  distal keypoint  (e.g. ankle)
 * @returns {number} degrees in [0, 180]
 */
export function angleBetween3D(a, b, c) {
  if (!a || !b || !c) return NaN;
  return jointAngleDeg(a, b, c);
}

// ── Vector helpers ────────────────────────────────────────────────────────────

export function vectorBetween(a, b) {
  return {
    x: b.x - a.x,
    y: b.y - a.y,
    z: (b.z ?? 0) - (a.z ?? 0)
  };
}

// ── Validity guards ───────────────────────────────────────────────────────────

/** True when a keypoint has usable, finite coordinates. */
export function isValid(kp) {
  return kp != null && kp.x != null && kp.y != null &&
         isFinite(kp.x) && isFinite(kp.y);
}

export function getAngle() { return 0; }
