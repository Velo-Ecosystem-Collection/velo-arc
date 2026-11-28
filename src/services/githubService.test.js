import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { cloneRepository } from "./githubService.js";

const repoUrl = "https://github.com/example/notes";
const api = "https://api.github.com/repos/example/notes";
const manifestPath = "contracts/Cargo.toml";
const manifest = '[workspace]\nmembers = ["notes"]\n[workspace.dependencies]\nsoroban-sdk = "23"\n';
const wasmBytes = Uint8Array.of(0, 97, 115, 109, 255);

const mockClone = (t, { privateRepo = false, archive, blobStatus = 200 } = {}) => {
  t.mock.method(console, "warn", () => {});
  t.mock.method(globalThis, "fetch", async (url, options) => {
    switch (url) {
      case api:
        return Response.json({ name: "notes", default_branch: "main", private: privateRepo });
      case `${api}/zipball/main`:
        if (archive) return new Response(archive);
        throw new TypeError("GitHub archive redirect blocked");
      case `${api}/git/trees/main?recursive=1`:
        return Response.json({
          tree: [
            { type: "blob", path: manifestPath, sha: "manifest-sha" },
            { type: "blob", path: "notes.wasm", sha: "wasm-sha" },
          ],
        });
      case `${api}/git/blobs/manifest-sha`:
      case `${api}/git/blobs/wasm-sha`:
        assert.equal(options.headers.Accept, "application/vnd.github.raw+json");
        assert.equal(options.headers.Authorization, privateRepo ? "Bearer fixture-token" : undefined);
        if (url.endsWith("/wasm-sha")) return new Response(wasmBytes);
        return new Response(blobStatus === 200 ? manifest : null, { status: blobStatus });
      case "https://raw.githubusercontent.com/example/notes/main/contracts/Cargo.toml":
        return new Response(null, { status: 404, statusText: "Not Found" });
      case "https://raw.githubusercontent.com/example/notes/main/notes.wasm":
        return new Response(wasmBytes);
      default:
        throw new Error(`Unexpected request to ${url}`);
    }
  });
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => privateRepo ? "fixture-token" : null },
  });
  t.after(() => {
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else delete globalThis.localStorage;
  });
};

test("recovers the workspace manifest when public raw download fails", async (t) => {
  mockClone(t);
  const { contents, tree } = await cloneRepository(repoUrl);
  assert.equal(contents[manifestPath], manifest);
  assert.equal(contents["notes.wasm"], Buffer.from(wasmBytes).toString("base64"));
  assert.equal(tree[0].children.find(({ name }) => name === "contracts").children[0].id, manifestPath);
});

test("uses authenticated blobs when the private archive cannot be fetched", async (t) => {
  mockClone(t, { privateRepo: true });
  const { contents } = await cloneRepository(repoUrl);
  assert.equal(contents[manifestPath], manifest);
  assert.equal(contents["notes.wasm"], Buffer.from(wasmBytes).toString("base64"));
  const urls = fetch.mock.calls.map(({ arguments: [url] }) => url);
  assert.ok(urls.includes(`${api}/git/blobs/wasm-sha`));
  assert.ok(urls.every((url) => url.startsWith(api)));
});

test("rejects an incomplete clone and reports the file that could not load", async (t) => {
  mockClone(t, { blobStatus: 404 });
  const progress = [];
  await assert.rejects(
    cloneRepository(repoUrl, ({ percent }) => progress.push(percent)),
    /Could not load contracts\/Cargo\.toml.*Repository or path not found/,
  );
  assert.ok(progress.every((percent) => percent < 100));
});

test("imports a complete archive without looking up individual files", async (t) => {
  const zip = new JSZip();
  zip.file(`example-notes-commit/${manifestPath}`, manifest);
  zip.file("example-notes-commit/notes.wasm", wasmBytes);
  mockClone(t, { archive: await zip.generateAsync({ type: "arraybuffer" }) });
  const { contents } = await cloneRepository(repoUrl);
  assert.equal(contents[manifestPath], manifest);
  assert.equal(contents["notes.wasm"], Buffer.from(wasmBytes).toString("base64"));
  assert.equal(fetch.mock.callCount(), 2);
});
