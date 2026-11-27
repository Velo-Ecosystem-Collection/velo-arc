import assert from "node:assert/strict";
import test from "node:test";
import { resolveWasmPath } from "./contractDiscovery.js";

test("resolves a nested contract's wasm in the runner's workspace target directory", () => {
  const contract = { path: "contracts/notes", crateName: "notes" };

  assert.equal(
    resolveWasmPath(contract),
    "/workspace/target/wasm32v1-none/release/notes.wasm",
  );
});
