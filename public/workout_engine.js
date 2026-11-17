import { limbSegments } from './limbSegments.js';
import { saveWorkoutSession } from './utils/history.js';

const video      = document.getElementById('video');
const overlay    = document.getElementById('overlay');
const ctx        = overlay.getContext('2d');
const activeMovement  = document.getElementById('active-movement');
const activeRound     = document.getElementById('active-round');
const activeReps      = document.getElementById('active-reps');
const timerDisplay    = document.getElementById('timer-display');
const roundStatsDisplay = document.getElementById('round-stats');
const cueDisplay      = document.getElementById('cue-display');

// ── Timer formatting ──────────────────────────────────────────
function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ── Workout prescription panel ────────────────────────────────
function buildPanel(exercises, modality) {
  const panel      = document.getElementById('workout-panel');
  const wpModality = document.getElementById('wp-modality');
  const wpConfig   = document.getElementById('wp-config');
  const wpMovements = document.getElementById('wp-movements');

  const labels  = { emom: 'EMOM', amrap: 'AMRAP', fortime: 'FOR TIME' };
  const configs = {
    emom:    `${modality.value} min`,
    amrap:   `${modality.value} min`,
    fortime: `${modality.value} rds`
  };

  wpModality.textContent = labels[modality.type];
  wpConfig.textContent   = configs[modality.type];

  wpMovements.innerHTML = '';
  exercises.forEach((ex, i) => {
    const li = document.createElement('li');
    li.dataset.index = i;
    li.innerHTML = `<span class="wp-reps">${ex.reps}×</span>${ex.name}`;
    wpMovements.appendChild(li);
  });

  panel.classList.remove('hidden');

  // Returns a function to update which exercise is active
  return function highlightPanel(activeIdx, doneUpTo = -1) {
    wpMovements.querySelectorAll('li').forEach((li, i) => {
      li.classList.toggle('wp-current', i === activeIdx);
      li.classList.toggle('wp-done',    i < doneUpTo);
    });
    // Scroll the current item into view inside the panel
    const currentLi = wpMovements.querySelector('li.wp-current');
    if (currentLi) currentLi.scrollIntoView({ block: 'nearest' });
  };
}

// ── Show / hide coaching cue ──────────────────────────────────
function showCue(cue) {
  if (cue) {
    cueDisplay.textContent = cue;
    cueDisplay.classList.remove('hidden');
  } else {
    cueDisplay.classList.add('hidden');
  }
}

// ── Core frame loop: run one exercise until N reps done ───────
// Returns: 'done' | 'cancelled' | 'timeout'
async function runExercise(ex, poseLandmarker, startTimeRef, timeoutMs) {
  let rep   = 0;
  let phase = 'up';

  activeMovement.textContent = `Now: ${ex.name}`;
  activeReps.textContent     = `Reps: 0 / ${ex.reps}`;

  while (rep < ex.reps) {
    if (window.cancelWorkout) return 'cancelled';
    if (timeoutMs != null && performance.now() - startTimeRef.t >= timeoutMs) return 'timeout';

    const now    = performance.now();
    const result = poseLandmarker.detectForVideo(video, now);

    const completed = await new Promise(resolve => {
      requestAnimationFrame(() => {
        timerDisplay.textContent = formatTime(performance.now() - startTimeRef.t);
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        if (!result?.landmarks?.length) { resolve(false); return; }

        // Pixel coords for drawing; normalized (0-1) for detectors whose
        // thresholds were written in normalized space.
        const kpPixels = result.landmarks[0].map(p => ({
          x: p.x * overlay.width,
          y: p.y * overlay.height,
          z: p.z,
          score: p.visibility ?? 1
        }));
        const kpNorm = result.landmarks[0].map(p => ({
          x: p.x,
          y: p.y,
          z: p.z,
          score: p.visibility ?? 1
        }));

        const output = ex.detector({ keypoints: kpNorm }, rep, phase);
        drawKeypoints(kpPixels, output.zones ?? {});
        showCue(output.cue);

        if (output.phase !== phase) {
          phase = output.phase;
          if (output.counted) {
            rep += 1;
            activeReps.textContent = `Reps: ${rep} / ${ex.reps}`;
            setTimeout(() => resolve(true), 300);
            return;
          }
        }
        resolve(false);
      });
    });

    void completed; // phase transitions are handled inline above
  }

  return 'done';
}

// ═════════════════════════════════════════════════════════════
// FOR TIME — complete N rounds of all exercises as fast as possible
// ═════════════════════════════════════════════════════════════
async function runForTime(video, exercises, modality, poseLandmarker, highlightPanel, timeRef) {
  const totalRounds = modality.value;
  const roundTimes  = [];

  for (let round = 1; round <= totalRounds; round++) {
    if (window.cancelWorkout) return { roundTimes, roundsDone: round - 1 };
    const roundStart = performance.now();
    activeRound.textContent = `Round ${round} / ${totalRounds}`;

    for (let i = 0; i < exercises.length; i++) {
      if (window.cancelWorkout) return { roundTimes, roundsDone: round - 1 };
      highlightPanel(i, 0);
      const status = await runExercise(exercises[i], poseLandmarker, timeRef, null);
      if (status === 'cancelled') return { roundTimes, roundsDone: round - 1 };
    }

    const roundTime = (performance.now() - roundStart) / 1000;
    roundTimes.push(roundTime);
    roundStatsDisplay.innerHTML = roundTimes
      .map((t, i) => `🏁 R${i + 1}: ${t.toFixed(1)}s`)
      .join(' &nbsp;|&nbsp; ');
  }

  return { roundTimes, roundsDone: totalRounds };
}

// ═════════════════════════════════════════════════════════════
// AMRAP — as many rounds as possible in N minutes
// ═════════════════════════════════════════════════════════════
async function runAMRAP(video, exercises, modality, poseLandmarker, highlightPanel, timeRef) {
  const timeCap  = modality.value * 60 * 1000; // ms
  let round      = 0;
  const roundTimes = [];

  while (true) {
    if (window.cancelWorkout) break;
    if (performance.now() - timeRef.t >= timeCap) break;

    round++;
    activeRound.textContent = `Round ${round}`;
    const roundStart = performance.now();

    let allDone = true;
    for (let i = 0; i < exercises.length; i++) {
      if (window.cancelWorkout) { allDone = false; break; }
      highlightPanel(i, 0);
      const status = await runExercise(exercises[i], poseLandmarker, timeRef, timeCap);
      if (status === 'cancelled' || status === 'timeout') { allDone = false; break; }
    }

    if (allDone) {
      const roundTime = (performance.now() - roundStart) / 1000;
      roundTimes.push(roundTime);
      roundStatsDisplay.innerHTML = `Rounds: <strong>${round}</strong> &nbsp;|&nbsp; Last: ${roundTime.toFixed(1)}s`;
    } else {
      break;
    }
  }

  return { roundTimes, roundsDone: round };
}

// ═════════════════════════════════════════════════════════════
// EMOM — every minute on the minute, complete all exercises
// ═════════════════════════════════════════════════════════════
async function runEMOM(video, exercises, modality, poseLandmarker, highlightPanel, timeRef) {
  const totalMinutes = modality.value;
  const roundTimes   = [];

  for (let minute = 1; minute <= totalMinutes; minute++) {
    if (window.cancelWorkout) break;

    const minuteStart = performance.now();
    const minuteEnd   = minuteStart + 60_000;
    activeRound.textContent = `Min ${minute} / ${totalMinutes}`;

    let allDone = true;
    for (let i = 0; i < exercises.length; i++) {
      if (window.cancelWorkout) { allDone = false; break; }
      highlightPanel(i, 0);
      const remaining = minuteEnd - performance.now();
      if (remaining <= 0) { allDone = false; break; }
      const status = await runExercise(exercises[i], poseLandmarker, timeRef, minuteEnd - timeRef.t);
      if (status === 'cancelled') { allDone = false; break; }
      // 'timeout' mid-exercise is fine in EMOM — we move to rest
    }

    const workTime = (performance.now() - minuteStart) / 1000;
    const restMs   = minuteEnd - performance.now();
    roundTimes.push(workTime);

    if (restMs > 100 && !window.cancelWorkout) {
      // Show rest countdown
      activeMovement.textContent = '💤 Rest';
      activeReps.textContent     = '';
      highlightPanel(-1, exercises.length); // all done for this minute

      const restEnd = minuteEnd;
      while (performance.now() < restEnd) {
        if (window.cancelWorkout) break;
        await new Promise(r => requestAnimationFrame(() => {
          const rem = Math.max(0, restEnd - performance.now());
          timerDisplay.textContent = formatTime(performance.now() - timeRef.t);
          roundStatsDisplay.innerHTML = `Rest: <strong>${(rem / 1000).toFixed(1)}s</strong>`;
          ctx.clearRect(0, 0, overlay.width, overlay.height);
          r();
        }));
      }
    }

    const restSec = Math.max(0, (minuteEnd - minuteStart - workTime * 1000) / 1000);
    roundStatsDisplay.innerHTML = `Min ${minute}: ${workTime.toFixed(1)}s work &nbsp;|&nbsp; ${restSec.toFixed(1)}s rest`;
  }

  return { roundTimes, roundsDone: totalMinutes };
}

// ═════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═════════════════════════════════════════════════════════════
export async function startWorkoutFlow(video, exercises, modality, poseLandmarker) {
  overlay.width  = video.videoWidth;
  overlay.height = video.videoHeight;

  const timeRef = { t: performance.now() }; // shared mutable ref for all engines

  const highlightPanel = buildPanel(exercises, modality);

  let result;

  switch (modality.type) {
    case 'amrap':
      result = await runAMRAP(video, exercises, modality, poseLandmarker, highlightPanel, timeRef);
      break;
    case 'emom':
      result = await runEMOM(video, exercises, modality, poseLandmarker, highlightPanel, timeRef);
      break;
    case 'fortime':
    default:
      result = await runForTime(video, exercises, modality, poseLandmarker, highlightPanel, timeRef);
      break;
  }

  const totalTimeSec = (performance.now() - timeRef.t) / 1000;

  // ── Finish UI ────────────────────────────────────────────────
  activeMovement.textContent = window.cancelWorkout ? 'Workout Stopped' : '✅ Workout Complete!';
  activeRound.textContent    = '';
  activeReps.textContent     = '';
  cueDisplay.classList.add('hidden');

  if (!window.cancelWorkout) {
    // Summary line
    const summary = modality.type === 'amrap'
      ? `${result.roundsDone} rounds in ${formatTime(totalTimeSec * 1000)}`
      : modality.type === 'emom'
      ? `${result.roundsDone} min EMOM done`
      : `${result.roundsDone} rounds in ${formatTime(totalTimeSec * 1000)}`;

    roundStatsDisplay.innerHTML = `<strong>${summary}</strong>`;

    saveWorkoutSession({
      modality: modality.type,
      modalityValue: modality.value,
      exercises: exercises.map(ex => ({ name: ex.name, reps: ex.reps })),
      roundsDone: result.roundsDone,
      roundTimes: result.roundTimes,
      totalTimeSec
    });
  }

  return {
    modality,
    exercises,
    roundsDone: result.roundsDone,
    roundTimes: result.roundTimes,
    totalTimeSec,
    cancelled: !!window.cancelWorkout
  };
}

// ── Skeleton renderer ─────────────────────────────────────────
function drawKeypoints(kp, zones = {}) {
  ctx.lineWidth = 3;

  Object.entries(limbSegments).forEach(([zone, lines]) => {
    const color = zones[zone] === 'ok'   ? '#00ff88' :
                  zones[zone] === 'fail' ? '#ff4466' : 'rgba(0,255,194,0.45)';
    lines.forEach(([a, b]) => {
      if (kp[a]?.score > 0.2 && kp[b]?.score > 0.2) {
        ctx.beginPath();
        ctx.moveTo(kp[a].x, kp[a].y);
        ctx.lineTo(kp[b].x, kp[b].y);
        ctx.strokeStyle = color;
        ctx.stroke();
      }
    });
  });

  kp.forEach(p => {
    if (!p || p.x == null || p.y == null) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 165, 0, 0.9)';
    ctx.fill();
  });
}
