import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    if (this.failWritesFor?.has(key)) throw new Error("Storage write blocked");
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const installStorage = (storage) => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
};

test("migrates existing workspace state to the Velo Arc storage key", async () => {
  const storage = new MemoryStorage();
  installStorage(storage);

  const previousState = {
    _version: "1.0",
    workspace: { name: "saved project" },
    terminal: {
      history: [{ type: "output", content: "Welcome to Soroban Studio Terminal" }],
    },
  };
  const serialized = JSON.stringify(previousState);
  storage.setItem("soroban-studio-state", serialized);

  const { loadState, saveState, clearState } = await import("./storage.js?legacy-migration");
  const migratedState = loadState();

  assert.deepEqual(migratedState.workspace, previousState.workspace);
  assert.equal(migratedState.terminal.history[0].content, "Welcome to Velo Arc Terminal");
  const storedTerminalMessage = JSON.parse(storage.getItem("velo-arc-state")).terminal.history[0].content;
  assert.equal(storedTerminalMessage, "Welcome to Velo Arc Terminal");
  assert.equal(storage.getItem("soroban-studio-state"), null);

  saveState({ terminal: { isCollapsed: true } });
  assert.deepEqual(JSON.parse(storage.getItem("velo-arc-state")).workspace, previousState.workspace);

  clearState();
  assert.equal(storage.getItem("velo-arc-state"), null);
  assert.equal(storage.getItem("soroban-studio-state"), null);
});

test("does not migrate state with an unsupported version", async () => {
  const storage = new MemoryStorage();
  installStorage(storage);
  storage.setItem("soroban-studio-state", JSON.stringify({ _version: "0.9" }));

  const { loadState } = await import("./storage.js?unsupported-version");

  const originalLog = console.log;
  console.log = () => {};
  try {
    assert.equal(loadState(), null);
  } finally {
    console.log = originalLog;
  }

  assert.equal(storage.getItem("velo-arc-state"), null);
  assert.notEqual(storage.getItem("soroban-studio-state"), null);
});

test("keeps legacy workspace state available when storage migration cannot write", async () => {
  const storage = new MemoryStorage();
  installStorage(storage);
  const previousState = { _version: "1.0", workspace: { name: "saved project" } };
  storage.setItem("soroban-studio-state", JSON.stringify(previousState));
  storage.failWritesFor = new Set(["velo-arc-state"]);

  const { loadState } = await import("./storage.js?failed-migration");

  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.deepEqual(loadState(), previousState);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(storage.getItem("velo-arc-state"), null);
  assert.notEqual(storage.getItem("soroban-studio-state"), null);
});
