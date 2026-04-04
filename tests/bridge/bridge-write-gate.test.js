/**
 * Bridge write-gate tool layer test
 *
 * Tests requireBridgeWrite / requireBridgeRead from
 * src/tools/studio-one/bridge-guard.ts at the tool handler level.
 *
 * Scenario: bridge has completed the full handshake (isBridgeReady() === true)
 * but no live read has been verified yet (_runtimeReadVerifiedAt is null).
 *
 *   Test 1 – write tool returns gate message (not isError, sendCommand NOT called)
 *   Test 2 – write tool proceeds after recordBridgeLiveVerification("read")
 *   Test 3 – read tool is NOT blocked by the write gate
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetBridgeStateForTests,
  __setBridgeTimeoutForTests,
  __setSocketFactoryForTests,
  connectBridge,
  disconnectBridge,
  recordBridgeLiveVerification,
} from "../../dist/services/bridge.js";
import { createSocketFactory } from "../helpers/fake-bridge-socket.js";

import { registerTrackTools } from "../../dist/tools/studio-one/tracks.js";
import { registerPluginTools } from "../../dist/tools/studio-one/plugins.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fake McpServer that stores tool handlers by name so tests can call them. */
function makeFakeServer() {
  const handlers = new Map();
  return {
    registerTool(name, _schema, handler) {
      handlers.set(name, handler);
    },
    get(name) {
      const h = handlers.get(name);
      assert.ok(h, `handler for "${name}" was not registered`);
      return h;
    },
  };
}

/**
 * Socket factory that completes the handshake (ping + getCapabilities) and
 * silently ignores every other command, so those requests time out.
 *
 * Pass an onCreate callback to capture the socket reference so tests can
 * inspect which commands were sent over the wire.
 */
function handshakeFactory(onCreate) {
  return createSocketFactory(
    (msg, socket) => {
      if (msg.command === "ping") {
        socket.reply({
          requestId: msg.requestId,
          ok: true,
          command: "ping",
          data: { pong: true },
        });
        return;
      }
      if (msg.command === "getCapabilities") {
        socket.reply({
          requestId: msg.requestId,
          ok: true,
          command: "getCapabilities",
          data: {
            transport: true,
            song: true,
            tracks: true,
            plugins: true,
            automation: false,
            midi: true,
            markers: false,
            filesystem: true,
            websocketServer: true,
          },
        });
      }
      // All other commands are silently ignored → sendBridgeRequest rejects with COMMAND_TIMEOUT.
    },
    onCreate ? { onCreate } : {},
  );
}

// ── Test lifecycle ────────────────────────────────────────────────────────────

test.beforeEach(() => {
  __resetBridgeStateForTests();
  __setBridgeTimeoutForTests(25);
});

test.afterEach(async () => {
  await disconnectBridge();
  __resetBridgeStateForTests();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test("write tool returns gate message when handshake OK but liveReadVerified is false", async () => {
  let capturedSocket;
  __setSocketFactoryForTests(handshakeFactory((s) => { capturedSocket = s; }));
  await connectBridge();

  const server = makeFakeServer();
  registerTrackTools(server);
  const handler = server.get("s1_create_track");

  const result = await handler({ name: "Kick", type: "audio" });
  const text = result.content[0].text;

  // Gate response is informational, not an error
  assert.ok(!result.isError, `gated response must not set isError; got:\n${text}`);

  // Must contain the write-gate message
  assert.ok(
    text.includes("WRITE is still gated"),
    `expected "WRITE is still gated" in response, got:\n${text}`,
  );

  // Must tell the user how to clear the gate
  assert.ok(
    text.includes("s1_get_transport_state"),
    `expected "s1_get_transport_state" hint in response, got:\n${text}`,
  );

  // sendCommand must NOT have reached the socket — gate fires before the send
  const sentCommands = capturedSocket.sent.map((s) => JSON.parse(s).command);
  assert.ok(
    !sentCommands.includes("createTrack"),
    `sendCommand must not fire when gated; commands on wire: [${sentCommands.join(", ")}]`,
  );
});

test("write tool proceeds to sendCommand after recordBridgeLiveVerification('read')", async () => {
  let capturedSocket;
  __setSocketFactoryForTests(handshakeFactory((s) => { capturedSocket = s; }));
  await connectBridge();

  // Lift the write gate
  recordBridgeLiveVerification("read");

  const server = makeFakeServer();
  registerTrackTools(server);
  const handler = server.get("s1_create_track");

  // The fake socket ignores createTrack → COMMAND_TIMEOUT → tool returns isError
  const result = await handler({ name: "Kick", type: "audio" });
  const text = result.content[0].text;

  // Gate must NOT have fired
  assert.ok(
    !text.includes("WRITE is still gated"),
    `expected no gate message after liveReadVerified, got:\n${text}`,
  );

  // sendCommand must have reached the socket (command sent before timeout)
  const sentCommands = capturedSocket.sent.map((s) => JSON.parse(s).command);
  assert.ok(
    sentCommands.includes("createTrack"),
    `expected "createTrack" on the wire after gate lifted; sent: [${sentCommands.join(", ")}]`,
  );
});

test("read tool is not blocked by the write gate when handshake OK but liveReadVerified is false", async () => {
  __setSocketFactoryForTests(handshakeFactory());
  await connectBridge();

  const server = makeFakeServer();
  registerPluginTools(server);
  const handler = server.get("s1_get_plugin_params");

  // The fake socket ignores getPluginParams → timeout, but no gate fires
  const result = await handler({ trackName: "Kick", pluginName: "Compressor" });
  const text = result.content[0].text;

  // Must NOT show the write-gate message
  assert.ok(
    !text.includes("WRITE is still gated"),
    `read tool must not be blocked by write gate, got:\n${text}`,
  );

  // Must NOT report bridge-not-ready (handshake IS complete)
  assert.ok(
    !text.includes("bridge is not ready"),
    `read tool must not report bridge-not-ready after handshake, got:\n${text}`,
  );
});
