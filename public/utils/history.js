// utils/history.js
// Workout session persistence and rendering.

const HISTORY_KEY = 'workoutHistory';
const MAX_SESSIONS = 50;

/**
 * Persist a completed workout session.
 * @param {{ exercises: {name:string, reps:number}[], totalRounds: number, roundTimes: number[], totalTimeSec: number }} session
 */
export function saveWorkoutSession(session) {
  const history = loadWorkoutHistory();
  history.unshift({ ...session, timestamp: new Date().toISOString() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_SESSIONS)));
}

/** Returns the array of saved sessions, newest first. */
export function loadWorkoutHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

/**
 * Renders workout history into `container` as HTML.
 * @param {HTMLElement} container
 */
export function renderHistoryPanel(container) {
  const history = loadWorkoutHistory();

  if (history.length === 0) {
    container.innerHTML = '<p class="history-empty">No workouts recorded yet. Complete a session to see it here.</p>';
    return;
  }

  container.innerHTML = history.map(session => {
    const date = new Date(session.timestamp).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    // Handle both old schema (totalRounds) and new schema (roundsDone)
    const rounds = session.roundsDone ?? session.totalRounds ?? 1;
    const timeText = _formatTime(session.totalTimeSec);

    // Modality badge (new sessions only)
    const modalityLabels = { emom: 'EMOM', amrap: 'AMRAP', fortime: 'FOR TIME' };
    const modalityBadge = session.modality
      ? `<span class="hist-modality">${session.modalityValue ?? ''} ${modalityLabels[session.modality] ?? session.modality}</span>`
      : '';

    const exTags = (session.exercises || [])
      .map(e => `<span class="hist-tag">${e.name} ×${e.reps}</span>`)
      .join('');

    const roundBreakdown = (session.roundTimes || []).length > 1
      ? `<div class="hist-rounds">${session.roundTimes.map((t, i) => `R${i + 1}: ${t.toFixed(1)}s`).join(' · ')}</div>`
      : '';

    return `
      <div class="hist-session">
        <div class="hist-header">
          <span class="hist-date">${date}</span>
          <span class="hist-meta">${rounds} round${rounds !== 1 ? 's' : ''} · ${timeText}</span>
        </div>
        ${modalityBadge}
        <div class="hist-exercises">${exTags}</div>
        ${roundBreakdown}
      </div>`;
  }).join('');
}

function _formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
