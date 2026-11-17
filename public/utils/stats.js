// utils/stats.js
// Lightweight statistical helpers shared across movement detectors and analysis modules.

/** Arithmetic mean of a numeric array. Returns 0 for empty arrays. */
export function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Clamp a value between min and max inclusive. */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Exponential moving average — smooths noisy sensor readings.
 * alpha=0 → ignore new value, alpha=1 → ignore history.
 */
export function smooth(prev, next, alpha = 0.3) {
  return prev * (1 - alpha) + next * alpha;
}

/**
 * Maintains a sliding window of the last `maxLen` values and
 * returns their average after appending `newVal`.
 * Mutates `window` in place — pass the same array each frame.
 */
export function runningAverage(window, newVal, maxLen = 5) {
  window.push(newVal);
  if (window.length > maxLen) window.shift();
  return average(window);
}

/** Standard deviation of a numeric array. */
export function stddev(arr) {
  if (arr.length < 2) return 0;
  const mean = average(arr);
  const variance = arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Normalise a value to [0, 1] given expected min/max.
 * Values outside range are clamped.
 */
export function normalise(val, min, max) {
  if (max === min) return 0;
  return clamp((val - min) / (max - min), 0, 1);
}
