// File: script.js
import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";
import Sortable from "https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/+esm";
import { startWorkoutFlow } from './workout_engine.js';
import { initBodyScanUI } from './movements/body_scan.js';
import { renderHistoryPanel } from './utils/history.js';

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const builder = document.getElementById('builder');
const movementList = document.getElementById('movement-list');
const roundsInput = document.getElementById('rounds');
const roundsLabelText = document.getElementById('rounds-label-text');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const setupLoading = document.getElementById('setup-loading');
const setupMessage = document.getElementById('setup-message');
const exerciseSection = document.getElementById('exercise-section');
const setupFooter = document.getElementById('setup-footer');

window.video = video;

let detector;
let modules = [];
let cancelWorkout = false;
let selectedModality = null; // 'emom' | 'amrap' | 'fortime'
let lastWorkoutConfig = null; // { exercises, modality } — for "Do it again"

// ── Modality config ───────────────────────────────────────────
const MODALITY_CONFIG = {
  emom:    { label: 'Minutes',       defaultValue: 20, description: 'Each minute, complete all exercises. Rest the remainder.' },
  amrap:   { label: 'Time Cap (min)', defaultValue: 20, description: 'Max rounds in the time cap. Go!' },
  fortime: { label: 'Rounds',        defaultValue: 3,  description: 'Complete all rounds as fast as possible.' }
};

// ── Screen management ─────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('hidden', s.id !== id);
  });
}

function setSetupMessage(msg) {
  if (setupMessage) setupMessage.textContent = msg;
}

function hideSetupLoading() {
  if (setupLoading) setupLoading.classList.add('hidden');
}

// ── Camera ────────────────────────────────────────────────────
async function setupCamera() {
  setSetupMessage("Requesting camera access…");
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false
  });

  video.srcObject = stream;

  return new Promise(resolve => {
    video.onloadedmetadata = async () => {
      await video.play();
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
      console.log("✅ Camera stream ready");
      resolve();
    };
  });
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  // Load exercise list immediately — doesn't need camera
  await loadMovements();
  populateBuilder(modules);
  makeSortable();

  // Camera + model init in parallel
  try {
    await setupCamera();
    setSetupMessage("Loading MOJON AI model…");

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );

    detector = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "./models/pose_landmarker_full.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5
    });

    console.log("✅ MediaPipe BlazePose ready");

    if (window.location.hash === '#body_scan') {
      hideSetupLoading();
      const scanHost = document.getElementById('scan-host');
      initBodyScanUI(scanHost, detector, () => showScreen('screen-setup'));
      showScreen('screen-scan');
      return;
    }

    setSetupMessage("Stand back so your full body is visible");
    setTimeout(hideSetupLoading, 3000);

  } catch (err) {
    console.error("❌ MediaPipe initialization failed:", err);
    setSetupMessage("Camera access denied. Please allow camera permissions and reload.");
  }
}

// ── Movements ─────────────────────────────────────────────────
async function loadMovements() {
  const res = await fetch('./movements/index.json');
  const files = await res.json();
  const promises = files.map(name => import(`./movements/${name}.js`));
  modules = await Promise.all(promises);
}

function formatName(str) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function populateBuilder(movementModules) {
  movementList.innerHTML = '';
  movementModules.forEach(mod => {
    const pill = document.createElement('label');
    pill.className = 'ex-pill';
    const defaultReps = mod.defaultReps || 10;
    pill.innerHTML = `
      <input type="checkbox" data-name="${mod.name}" />
      <span class="ex-seq"></span>
      <span class="ex-pill-name">${formatName(mod.name)}</span>
      <div class="ex-pill-counter">
        <button type="button" class="reps-btn reps-dec">−</button>
        <input type="number" value="${defaultReps}" min="1" class="ex-reps" />
        <button type="button" class="reps-btn reps-inc">+</button>
      </div>
    `;
    pill.querySelector('input[type="checkbox"]').addEventListener('change', updateSequenceNumbers);
    pill.querySelector('.reps-dec').addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const inp = pill.querySelector('.ex-reps');
      inp.value = Math.max(1, parseInt(inp.value) - 1);
    });
    pill.querySelector('.reps-inc').addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const inp = pill.querySelector('.ex-reps');
      inp.value = parseInt(inp.value) + 1;
    });
    movementList.appendChild(pill);
  });
}

function updateSequenceNumbers() {
  const allPills = [...movementList.querySelectorAll('.ex-pill')];
  let seq = 1;
  allPills.forEach(pill => {
    const cb    = pill.querySelector('input[type="checkbox"]');
    const badge = pill.querySelector('.ex-seq');
    if (cb?.checked) {
      badge.textContent = seq++;
    } else {
      badge.textContent = '';
    }
  });
}

function makeSortable() {
  Sortable.create(movementList, {
    animation: 150,
    ghostClass: 'ghost',
    onEnd: updateSequenceNumbers
  });
}

// ── Modality selection ────────────────────────────────────────
document.querySelectorAll('.modality-card').forEach(card => {
  card.addEventListener('click', () => {
    const modality = card.dataset.modality;
    selectedModality = modality;

    // Update active card
    document.querySelectorAll('.modality-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');

    // Update rounds label and default value
    const cfg = MODALITY_CONFIG[modality];
    roundsLabelText.textContent = cfg.label;
    roundsInput.value = cfg.defaultValue;

    // Reveal exercise section and footer
    exerciseSection.classList.remove('hidden');
    setupFooter.classList.remove('hidden');

    // Scroll to exercise section
    exerciseSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ── Static button listeners ───────────────────────────────────
document.getElementById('bodyScanBtn')?.addEventListener('click', () => {
  const scanHost = document.getElementById('scan-host');
  initBodyScanUI(scanHost, detector, () => {
    showScreen('screen-setup');
  });
  showScreen('screen-scan');
});

document.getElementById('historyBtn')?.addEventListener('click', () => {
  const panel = document.getElementById('history-panel');
  const content = document.getElementById('history-content');
  renderHistoryPanel(content);
  panel.classList.remove('hidden');
});

document.getElementById('closeHistory')?.addEventListener('click', () => {
  document.getElementById('history-panel').classList.add('hidden');
});

// ── Stop button ───────────────────────────────────────────────
stopBtn?.addEventListener('click', () => {
  cancelWorkout = true;
  window.cancelWorkout = true;
  // showScreen will happen when startWorkoutFlow returns
});

// ── Stats screen ──────────────────────────────────────────────
function showStatsScreen(stats) {
  const { modality, exercises, roundsDone, roundTimes, totalTimeSec } = stats;

  const labels  = { emom: 'EMOM', amrap: 'AMRAP', fortime: 'FOR TIME' };
  const configs = {
    emom:    `${modality.value} min`,
    amrap:   `${modality.value} min`,
    fortime: `${modality.value} rds`
  };

  // Modality badge
  document.getElementById('stats-modality-badge').textContent =
    `${configs[modality.type]} ${labels[modality.type]}`;

  // Primary + secondary metrics (vary by modality)
  const primaryVal  = document.getElementById('stats-primary-value');
  const primaryLbl  = document.getElementById('stats-primary-label');
  const secondaryVal = document.getElementById('stats-secondary-value');
  const secondaryLbl = document.getElementById('stats-secondary-label');
  const totalTime   = formatStatsTime(totalTimeSec);

  if (modality.type === 'amrap') {
    primaryVal.textContent  = roundsDone;
    primaryLbl.textContent  = 'Rounds';
    secondaryVal.textContent = totalTime;
    secondaryLbl.textContent = 'Total Time';
  } else if (modality.type === 'emom') {
    primaryVal.textContent  = `${modality.value}`;
    primaryLbl.textContent  = 'Min Completed';
    const avgWork = roundTimes.length
      ? (roundTimes.reduce((a,b) => a+b, 0) / roundTimes.length).toFixed(1)
      : '—';
    secondaryVal.textContent = `${avgWork}s`;
    secondaryLbl.textContent = 'Avg Work/Min';
  } else {
    primaryVal.textContent  = totalTime;
    primaryLbl.textContent  = 'Total Time';
    secondaryVal.textContent = roundsDone;
    secondaryLbl.textContent = roundsDone === 1 ? 'Round' : 'Rounds';
  }

  // Circuit list
  const circuitEl = document.getElementById('stats-circuit');
  circuitEl.innerHTML = '';
  exercises.forEach((ex, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="sc-num">${i + 1}</span>
      <span class="sc-name">${ex.name}</span>
      <span class="sc-reps">${ex.reps}×</span>
    `;
    circuitEl.appendChild(li);
  });

  // Round breakdown (only if multiple rounds with times)
  const roundsSection = document.getElementById('stats-rounds-section');
  const roundsList    = document.getElementById('stats-rounds-list');
  if (roundTimes && roundTimes.length > 0) {
    roundsSection.classList.remove('hidden');
    roundsList.innerHTML = '';
    const maxTime = Math.max(...roundTimes);
    roundTimes.forEach((t, i) => {
      const label = modality.type === 'emom' ? `Min ${i + 1}` : `Round ${i + 1}`;
      const pct   = maxTime > 0 ? (t / maxTime) * 100 : 0;
      const row   = document.createElement('div');
      row.className = 'sr-row';
      row.innerHTML = `
        <span class="sr-label">${label}</span>
        <div class="sr-bar-wrap"><div class="sr-bar" style="width: ${pct}%"></div></div>
        <span class="sr-time">${t.toFixed(1)}s</span>
      `;
      roundsList.appendChild(row);
    });
  } else {
    roundsSection.classList.add('hidden');
  }

  showScreen('screen-stats');
}

function formatStatsTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Stats screen buttons
document.getElementById('statsAgainBtn')?.addEventListener('click', async () => {
  if (!lastWorkoutConfig) return;
  cancelWorkout = false;
  window.cancelWorkout = false;
  showScreen('screen-workout');
  const stats = await startWorkoutFlow(video, lastWorkoutConfig.exercises, lastWorkoutConfig.modality, detector);
  if (!stats?.cancelled) {
    try { showStatsScreen(stats); } catch (e) { showScreen('screen-setup'); }
  } else {
    showScreen('screen-setup');
  }
});

document.getElementById('statsHomeBtn')?.addEventListener('click', () => {
  showScreen('screen-setup');
});

// ── Start workout ─────────────────────────────────────────────
builder.addEventListener('submit', async (e) => {
  if (builder.dataset.mode === 'scan') {
    e.preventDefault();
    return;
  }

  e.preventDefault();

  if (!selectedModality) {
    alert("Please select a modality first (EMOM, AMRAP, or FOR TIME).");
    return;
  }

  const selected = [];
  const rows = [...movementList.querySelectorAll('.ex-pill')];

  rows.forEach(pill => {
    const checkbox = pill.querySelector('input[type="checkbox"]');
    const repsInput = pill.querySelector('.ex-reps');
    if (checkbox?.checked) {
      const mod = modules.find(m => m.name === checkbox.dataset.name);
      if (mod) {
        selected.push({
          name: mod.name,
          detector: mod.detector,
          reps: parseInt(repsInput?.value) || 10
        });
      }
    }
  });

  const value = parseInt(roundsInput.value);
  if (!selected.length || isNaN(value) || value <= 0) {
    alert("Please select at least one exercise and a valid number.");
    return;
  }

  const modality = { type: selectedModality, value };

  lastWorkoutConfig = { exercises: selected, modality };
  cancelWorkout = false;
  window.cancelWorkout = false;

  showScreen('screen-workout');

  let stats;
  try {
    stats = await startWorkoutFlow(video, selected, modality, detector);
  } catch (err) {
    console.error("❌ Workout failed to start:", err);
    showScreen('screen-setup');
    return;
  }

  if (stats?.cancelled) {
    showScreen('screen-setup');
  } else {
    try {
      showStatsScreen(stats);
    } catch (err) {
      console.error('❌ showStatsScreen failed:', err);
      showScreen('screen-setup');
    }
  }
});

init();
