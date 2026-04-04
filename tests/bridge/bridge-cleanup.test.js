// Bridge request lifecycle, timeout, write-gating, and disconnect cleanup tests
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  __resetBridgeStateForTests,
  __setBridgeTimeoutForTests,
  __setSocketFactoryForTests,
  __getPendingRequestCountForTests,
  connectBridge,
  disconnectBridge,
  sendCommand,
  getBridgeRuntimeStatus,
} from "../../dist/services/bridge.js";

import { createSocketFactory } from "../helpers/fake-bridge-socket.js";

// Standard handshake handler for tests that need a fully-handshaken bridge
function handshakeHandler(msg, sock) {
  if (msg.command === "ping") {
    sock.reply({ requestId: msg.requestId, ok: true, data: { pong: true } });
  } else if (msg.command === "getCapabilities") {
    sock.reply({
      requestId: msg.requestId,
      ok: true,
      data: { commands: ["getTransportState", "setTempo"], apiVersion: "1.0", extensionVersion: "1.1" },
    });
  }
}

// Handshake + live command responses
function fullHandler(msg, sock) {
  handshakeHandler(msg, sock);
  if (msg.command === "getTransportState") {
    sock.reply({ requestId: msg.requestId, ok: true, data: { playing: false, tempo: 150 } });
  } else if (msg.command === "setTempo") {
    sock.reply({ requestId: msg.requestId, ok: true, data: { bpm: msg.params?.bpm ?? 150 } });
  }
}

beforeEach(() => {
  __resetBridgeStateForTests();
  __setBridgeTimeoutForTests(25);
});

afterEach(async () => {
  await disconnectBridge();
  __resetBridgeStateForTests();
});

describe("bridge cleanup", () => {
  it("request timeout clears pending request state", async () => {
    // Handshake works, but any other command is never answered → timeout
    __setSocketFactoryForTests(createSocketFactory(handshakeHandler));
    await connectBridge();

    try {
      await sendCommand("getTransportState");
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.code, "COMMAND_TIMEOUT");
    }
    assert.equal(__getPendingRequestCountForTests(), 0);
    assert.equal(getBridgeRuntimeStatus().lastError?.code, "COMMAND_TIMEOUT");
  });

  it("write commands are gated until one live read is verified, then runtime phase advances", async () => {
    __setSocketFactoryForTests(createSocketFactory(fullHandler));
    await connectBridge();

    // Before live read — writes should be rejected
    try {
      await sendCommand("setTempo", { bpm: 160 });
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal(err.code, "LIVE_READ_REQUIRED");
    }

    // Perform a live read
    const readResult = await sendCommand("getTransportState");
    assert.equal(readResult.ok, true);
    assert.equal(getBridgeRuntimeStatus().proof.liveReadVerified, true);
    assert.equal(getBridgeRuntimeStatus().lifecyclePhase, "live_read_verified");

    // Now writes should succeed
    const writeResult = await sendCommand("setTempo", { bpm: 160 });
    assert.equal(writeResult.ok, true);
    assert.equal(getBridgeRuntimeStatus().proof.liveWriteVerified, true);
    assert.equal(getBridgeRuntimeStatus().lifecyclePhase, "runtime_verified");
    assert.equal(getBridgeRuntimeStatus().proof.nextRequiredState, null);
  });

  it("disconnect rejects and cleans pending requests", async () => {
    let storedSocket = null;
    __setSocketFactoryForTests(
      createSocketFactory(handshakeHandler, {
        onCreate: (sock) => { storedSocket = sock; },
      })
    );
    await connectBridge();

    // Start a command that will never be answered
    const pending = sendCommand("getTransportState").catch((e) => e);

    // Close socket externally before it can respond
    storedSocket.close();

    const err = await pending;
    assert.ok(err instanceof Error);
    assert.match(err.message, /disconnected/i);
    assert.equal(__getPendingRequestCountForTests(), 0);
    assert.equal(getBridgeRuntimeStatus().state, "disconnected");
  });
});
