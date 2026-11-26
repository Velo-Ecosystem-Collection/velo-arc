/**
 * LocalStorage utility for persisting state.
 * Handles save/load with versioning and race condition prevention.
 */

import { isArcEventMode, scopedStorageKey } from '../services/arcSession.js';

const STORAGE_KEY = 'velo-arc-state';
const LEGACY_STORAGE_KEY = 'soroban-studio-state';
const STATE_VERSION = '1.0';

const cachedStates = new Map();
const lastSavedAt = new Map();

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
    const key = scopedStorageKey(STORAGE_KEY);
    if (cachedStates.has(key)) return cachedStates.get(key);
    let serialized = localStorage.getItem(key);
    let shouldMigrateLegacyState = false;

    if (serialized === null && !isArcEventMode) {
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
        localStorage.setItem(key, JSON.stringify(state));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        console.warn('Failed to migrate legacy Velo Arc state; keeping it available in memory.');
      }
    }

    cachedStates.set(key, state);
    return state;
  } catch (err) {
    console.error('Failed to load state from localStorage:', err);
    return null;
  }
};

export const saveState = (state) => {
  try {
    const key = scopedStorageKey(STORAGE_KEY);
    const now = Date.now();
    if (now - (lastSavedAt.get(key) || 0) < 50) return;
    lastSavedAt.set(key, now);

    const existing = loadState() || {};
    const merged = {
      ...existing,
      ...state,
      _version: STATE_VERSION,
      _lastUpdated: now,
    };

    cachedStates.set(key, merged);
    localStorage.setItem(key, JSON.stringify(merged));
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
  }
};

export const clearState = () => {
  try {
    const key = scopedStorageKey(STORAGE_KEY);
    cachedStates.delete(key);
    localStorage.removeItem(key);
    if (!isArcEventMode) localStorage.removeItem(LEGACY_STORAGE_KEY);
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
