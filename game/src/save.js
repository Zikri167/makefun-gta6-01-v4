// save.js — the whole save game is one localStorage record: cash earned, the
// mission the player is on and how many jobs are done. The start screen offers
// Continue when a record exists; finishing a mission writes a fresh one.

const SAVE_KEY = 'neon-tide-vesper-bay-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      missionIndex: state.missionIndex,
      jobsDone: state.jobsDone,
    }));
  } catch {
    // Private mode or a full store: the game simply runs unsaved.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
