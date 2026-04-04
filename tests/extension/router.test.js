// Extension router tests — runs main.js in a sandboxed VM without Studio One globals
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.join(__dirname, "../../studio-one-extension/main.js");
const extensionSource = fs.readFileSync(EXTENSION_PATH, "utf8");

/**
 * Load the extension router in a sandbox that provides just enough globals
 * for the router switch to execute without blowing up on missing DAW APIs.
 */
function loadRouterSandbox() {
  const replies = [];

  const fakeClient = {
    send(raw) {
      replies.push(JSON.parse(raw));
    },
  };

  // Minimal Host/globals so the file evaluates
  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    Error,
    Object,
    Array,
    String,
    Number,
    parseInt,
    parseFloat,
    isNaN,
    Set,
    setInterval: () => null,
    clearInterval: () => {},
    queueMicrotask,
    Host: {
      Console: { writeLine: () => {} },
      WebSocket: { createServer: () => ({ onconnection: null }) },
      getDocumentsPath: () => null,
    },
    Song: { getActiveSong: () => null },
    Transport: {},
    Tracks: { AUDIO: 0, INSTRUMENT: 1, AUTOMATION: 2, BUS: 3, FX: 4, FOLDER: 5 },
    module: { exports: {} },
  };

  vm.createContext(sandbox);
  vm.runInContext(extensionSource, sandbox, { filename: "main.js" });

  return { sandbox, fakeClient, replies };
}

function invokeHandle(sandbox, fakeClient, rawJson) {
  // The extension redefines handle() at the bottom (automation patch).
  // We simulate a client message by calling handle directly.
  // Since handle is file-scoped, we invoke it via the onconnection callback pattern.
  // Easiest: just re-create the message flow.
  const replies = [];
  const client = {
    send(raw) { replies.push(JSON.parse(raw)); },
  };

  // We need to call the handle function. Since it's not exported, we call
  // the server's onconnection handler with a fake client, then call onmessage.
  const server = sandbox.Host.WebSocket.createServer(7890);
  let onmessage = null;

  // Patch createServer to capture the onconnection handler
  // Actually, the extension already called startServer() during evaluate.
  // Let's just use a different approach — eval a call to handle().
  vm.runInContext(
    `(function(client, raw) { handle(client, raw); })`,
    sandbox
  )(client, rawJson);

  return replies;
}

describe("extension router", () => {
  it("returns error envelope for malformed JSON input", () => {
    const { sandbox } = loadRouterSandbox();
    const client = { send(raw) { this.result = JSON.parse(raw); } };

    vm.runInContext(
      `(function(c, r) { handle(c, r); })`,
      sandbox
    )(client, "not json {{{");

    assert.equal(client.result.ok, false);
    assert.ok(client.result.error);
  });

  it("returns UNKNOWN_COMMAND envelope for unsupported commands", () => {
    const { sandbox } = loadRouterSandbox();
    const client = { send(raw) { this.result = JSON.parse(raw); } };

    vm.runInContext(
      `(function(c, r) { handle(c, r); })`,
      sandbox
    )(client, JSON.stringify({ command: "doSomethingWeird", requestId: "test-1" }));

    assert.equal(client.result.ok, false);
    assert.match(client.result.error, /Unknown command.*doSomethingWeird/);
    assert.equal(client.result.requestId, "test-1");
  });

  it("setTempo rejects values outside 20-300 range", () => {
    const { sandbox } = loadRouterSandbox();
    const client = { send(raw) { this.result = JSON.parse(raw); } };

    // Provide a minimal activeSong so it gets past Song.getActiveSong() check
    sandbox.Song.getActiveSong = () => ({
      getTransport: () => ({
        setTempo: () => {},
        getTempo: () => 150,
      }),
    });

    vm.runInContext(
      `(function(c, r) { handle(c, r); })`,
      sandbox
    )(client, JSON.stringify({ command: "setTempo", params: { bpm: 999 }, requestId: "t-1" }));

    assert.equal(client.result.ok, false);
    assert.match(client.result.error, /out of range/i);
  });

  it("getTransportState returns transport data when song is active", () => {
    const { sandbox } = loadRouterSandbox();
    const client = { send(raw) { this.result = JSON.parse(raw); } };

    sandbox.Song.getActiveSong = () => ({
      getTransport: () => ({
        isPlaying: () => false,
        isRecording: () => false,
        getTempo: () => 150,
        getPosition: () => 0,
        isLoopEnabled: () => false,
        getLoopStart: () => 0,
        getLoopEnd: () => 0,
      }),
      getTimeSignatureNumerator: () => 4,
      getTimeSignatureDenominator: () => 4,
    });

    vm.runInContext(
      `(function(c, r) { handle(c, r); })`,
      sandbox
    )(client, JSON.stringify({ command: "getTransportState", requestId: "t-2" }));

    assert.equal(client.result.ok, true);
    assert.equal(client.result.data.tempo, 150);
    assert.equal(client.result.data.playing, false);
    assert.equal(client.result.requestId, "t-2");
  });
});
