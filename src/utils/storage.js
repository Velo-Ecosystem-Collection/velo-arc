/**
 * LocalStorage utility for persisting state.
 * Handles save/load with versioning and race condition prevention.
 */

const STORAGE_KEY = 'velo-arc-state';
const LEGACY_STORAGE_KEY = 'soroban-studio-state';
const STATE_VERSION = '1.0';

let cachedState = null;
let lastSaved = 0;

const migrateLegacyState = (state) => {
  const history = state.terminal?.history;
  if (!Array.isArray(history)) return state;

  return {
    ...state,
    terminal: {
      ...state.terminal,
      history: history.map((entry) =>
        entry?.type === 'output' && entry.content === 'Welcome to Soroban Studio Terminal'
          ? { ...entry, content: 'Welcome to Velo Arc Terminal' }
          : entry,
      ),
    },
  };
};

export const loadState = () => {
  try {
    if (cachedState) return cachedState;
    let serialized = localStorage.getItem(STORAGE_KEY);
    let shouldMigrateLegacyState = false;

    if (serialized === null) {
      serialized = localStorage.getItem(LEGACY_STORAGE_KEY);
      shouldMigrateLegacyState = serialized !== null;
    }

    if (!serialized) return null;
    const parsed = JSON.parse(serialized);
    if (parsed?._version !== STATE_VERSION) {
      console.log('State version mismatch, resetting state');
      return null;
    }

    const state = shouldMigrateLegacyState ? migrateLegacyState(parsed) : parsed;

    if (shouldMigrateLegacyState) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        console.warn('Failed to migrate legacy Velo Arc state; keeping it available in memory.');
      }
    }

    cachedState = state;
    return state;
  } catch (err) {
    console.error('Failed to load state from localStorage:', err);
    return null;
  }
};

export const saveState = (state) => {
  try {
    const now = Date.now();
    if (now - lastSaved < 50) return;
    lastSaved = now;

    const existing = loadState() || {};
    const merged = {
      ...existing,
      ...state,
      _version: STATE_VERSION,
      _lastUpdated: now,
    };

    cachedState = merged;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
  }
};

export const clearState = () => {
  try {
    cachedState = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear localStorage:', err);
  }
};

export const getStateSection = (section, defaultValue = null) => {
  const state = loadState();
  return state?.[section] ?? defaultValue;
};

export const saveStateSection = (section, data) => {
  const existing = loadState() || {};
  saveState({ ...existing, [section]: data });
};
