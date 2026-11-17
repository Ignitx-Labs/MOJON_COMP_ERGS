// utils/quaternion.js
// Full quaternion math for joint orientation tracking.
// Quaternions represent 3D rotations as q = (w, x, y, z) where
// w = cos(θ/2) and (x,y,z) = sin(θ/2) * unit_axis.

export class Quaternion {
  constructor(w, x, y, z) {
    this.w = w; this.x = x; this.y = y; this.z = z;
  }

  static identity() {
    return new Quaternion(1, 0, 0, 0);
  }

  // Quaternion representing the shortest rotation from vector a to vector b.
  static fromVectors(a, b) {
    const an = _norm3(a);
    const bn = _norm3(b);
    const dot = an.x * bn.x + an.y * bn.y + an.z * bn.z;

    // Nearly opposite vectors: rotate 180° around any perpendicular axis
    if (dot < -0.9999) {
      let perp = { x: 1, y: 0, z: 0 };
      if (Math.abs(an.x) > 0.9) perp = { x: 0, y: 1, z: 0 };
      const axis = _norm3(_cross3(an, perp));
      return new Quaternion(0, axis.x, axis.y, axis.z);
    }

    const c = _cross3(an, bn);
    return new Quaternion(1 + dot, c.x, c.y, c.z).normalize();
  }

  // Quaternion from a unit axis and an angle in radians.
  static fromAxisAngle(axis, angleRad) {
    const half = angleRad / 2;
    const s = Math.sin(half);
    return new Quaternion(Math.cos(half), axis.x * s, axis.y * s, axis.z * s);
  }

  // Hamilton product: applies rotation q after this.
  multiply(q) {
    return new Quaternion(
      this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z,
      this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y,
      this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x,
      this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w
    );
  }

  // Conjugate = inverse for unit quaternions.
  conjugate() {
    return new Quaternion(this.w, -this.x, -this.y, -this.z);
  }

  magnitude() {
    return Math.sqrt(this.w ** 2 + this.x ** 2 + this.y ** 2 + this.z ** 2);
  }

  normalize() {
    const m = this.magnitude();
    if (m < 1e-10) return Quaternion.identity();
    return new Quaternion(this.w / m, this.x / m, this.y / m, this.z / m);
  }

  // Rotation angle encoded in this quaternion, in degrees.
  angleDeg() {
    const w = Math.min(Math.max(this.w, -1), 1);
    return 2 * Math.acos(w) * (180 / Math.PI);
  }

  // Rotate a 3D vector by this quaternion: v' = q * v * q⁻¹
  rotateVector(v) {
    const qv = new Quaternion(0, v.x, v.y, v.z);
    const result = this.multiply(qv).multiply(this.conjugate());
    return { x: result.x, y: result.y, z: result.z };
  }

  // Spherical linear interpolation — shortest path between two orientations.
  static slerp(a, b, t) {
    let dot = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
    // Ensure shortest arc
    if (dot < 0) {
      b = new Quaternion(-b.w, -b.x, -b.y, -b.z);
      dot = -dot;
    }
    // Nearly identical — fall back to linear
    if (dot > 0.9995) {
      return new Quaternion(
        a.w + t * (b.w - a.w), a.x + t * (b.x - a.x),
        a.y + t * (b.y - a.y), a.z + t * (b.z - a.z)
      ).normalize();
    }
    const theta0 = Math.acos(dot);
    const sinTheta0 = Math.sin(theta0);
    const s0 = Math.sin((1 - t) * theta0) / sinTheta0;
    const s1 = Math.sin(t * theta0) / sinTheta0;
    return new Quaternion(
      s0 * a.w + s1 * b.w, s0 * a.x + s1 * b.x,
      s0 * a.y + s1 * b.y, s0 * a.z + s1 * b.z
    );
  }
}

// ── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns the quaternion representing the bend at `joint`
 * (rotation from the proximal segment to the distal segment).
 *
 * @param {Object} proximal  - keypoint with {x, y, z?}
 * @param {Object} joint     - the joint being measured
 * @param {Object} distal    - end of the distal segment
 * @returns {Quaternion}
 */
export function jointQuaternion(proximal, joint, distal) {
  const segA = {
    x: joint.x - proximal.x,
    y: joint.y - proximal.y,
    z: (joint.z ?? 0) - (proximal.z ?? 0)
  };
  const segB = {
    x: distal.x - joint.x,
    y: distal.y - joint.y,
    z: (distal.z ?? 0) - (joint.z ?? 0)
  };
  return Quaternion.fromVectors(segA, segB);
}

/**
 * Joint flexion angle in degrees via quaternion — drop-in for angleBetween3D.
 * Returns the anatomical joint angle: 180° = fully extended, decreasing as the
 * joint bends. The quaternion encodes the rotation from the proximal segment
 * vector to the distal segment vector (both pointing away from the joint), so
 * its rotation angle is the supplement of the anatomical angle — we correct for
 * that here with 180 − q.angleDeg().
 */
export function jointAngleDeg(proximal, joint, distal) {
  return 180 - jointQuaternion(proximal, joint, distal).angleDeg();
}

/**
 * Detect lateral deviation at a joint (e.g. knee valgus/varus).
 * Returns signed angle in degrees around the given reference axis.
 *
 * @param {Object} proximal
 * @param {Object} joint
 * @param {Object} distal
 * @param {{ x, y, z }} referenceAxis  - typically {x:0, y:1, z:0} for vertical
 * @returns {number} signed degrees
 */
export function lateralDeviationDeg(proximal, joint, distal, referenceAxis = { x: 0, y: 1, z: 0 }) {
  const q = jointQuaternion(proximal, joint, distal);
  const axis = _norm3({ x: q.x, y: q.y, z: q.z });
  const ref = _norm3(referenceAxis);
  const projection = axis.x * ref.x + axis.y * ref.y + axis.z * ref.z;
  return Math.asin(Math.min(Math.max(projection, -1), 1)) * (180 / Math.PI);
}

// ── Private vector math ──────────────────────────────────────────────────────

function _norm3(v) {
  const m = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
  if (m < 1e-10) return { x: 0, y: 0, z: 1 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

function _cross3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}
