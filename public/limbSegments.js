// MediaPipe PoseLandmarker index reference:
//  0 nose · 11/12 shoulders · 13/14 elbows · 15/16 wrists
//  23/24 hips · 25/26 knees · 27/28 ankles · 29/30 heels · 31/32 foot index

export const limbSegments = {
  leftArm:  [[11, 13], [13, 15]],
  rightArm: [[12, 14], [14, 16]],
  leftLeg:  [[23, 25], [25, 27], [27, 29], [29, 31]],
  rightLeg: [[24, 26], [26, 28], [28, 30], [30, 32]],
  torso:    [[11, 12], [23, 24], [11, 23], [12, 24]],
  spine:    [[0, 11], [0, 12]]
};
