import test from "node:test";
import assert from "node:assert/strict";

import {
  __getPendingRequestCountForTests,
  __resetBridgeStateForTests,
  __setBridgeTimeoutForTests,
  __setSocketFactoryForTests,
  connectBridge,
  disconnectBridge,
  getBridgeRuntimeStatus,
  sendCommand,
} from "../../dist/services/bridge.js";
import { createSocketFactory } from "../helpers/fake-bridge-socket.js";

function handshakeOnlyFactory(onCreate) {
  return createSocketFactory((message, socket) => {
    if (message.command === "ping") {
      socket.reply({
        requestId: message.requestId,
        ok: true,
        command: "ping",
        data: { pong: true },
      });
      return;
    }

    if (message.command === "getCapabilities") {
      socket.reply({
        requestId: message.requestId,
        ok: true,
        command: "getCapabilities",
        data: {
          transport: true,
          song: true,
          tracks: true,
          plugins: false,
          automation: false,
          midi: false,
          markers: false,
          filesystem: true,
          websocketServer: true,
        },
      });
    }
  }, { onCreate });
}

function handshakeReadWriteFactory(onCreate) {
  return createSocketFactory((message, socket) => {
    if (message.command === "ping") {
      socket.reply({ requestId: message.requestId, ok: true, command: "ping", data: { pong: true } });
      return;
    }
    if (message.command === "getCapabilities") {
      socket.reply({
        requestId: message.requestId,
        ok: true,
        command: "getCapabilities",
        data: { transport: true, song: true, tracks: true, plugins: false, automation: false, midi: false, markers: false, filesystem: true, websocketServer: true },
      });
      return;
    }
    if (message.command === "getTransportState") {
      socket.reply({ requestId: message.requestId, ok: true, command: "getTransportState", data: { position: 0, tempo: 128 } });
      return;
    }
    if (message.command === "setTempo") {
      socket.reply({ requestId: message.requestId, ok: true, command: "setTempo", data: { bpm: message.params?.bpm } });
      return;
    }
  }, { onCreate });
}

test.beforeEach(() => {
  __resetBridgeStateForTests();
  __setBridgeTimeoutForTests(25);
});

test.afterEach(async () => {
  await disconnectBridge();
  __resetBridgeStateForTests();
});

test("bridge request timeout clears pending request state", async () => {
  __setSocketFactoryForTests(handshakeOnlyFactory());
  await connectBridge();

  const pending = sendCommand("getSongMetadata");
  await assert.rejects(() => pending, /COMMAND_TIMEOUT/);
  assert.equal(__getPendingRequestCountForTests(), 0);
  assert.equal(getBridgeRuntimeStatus().lastError?.code, "COMMAND_TIMEOUT");
});

test("bridge write commands are gated until one live read is verified, then runtime phase advances", async () => {
  __setSocketFactoryForTests(handshakeReadWriteFactory());
  await connectBridge();

  // After handshake only: liveReadVerified must be false, write must be gated
  const runtimeBefore = getBridgeRuntimeStatus();
  assert.equal(runtimeBefore.lifecyclePhase, "handshake_ok");
  assert.equal(runtimeBefore.proof.liveReadVerified, false);
  assert.equal(runtimeBefore.proof.liveWriteVerified, false);

  await assert.rejects(
    () => sendCommand("setTempo", { bpm: 130 }),
    /LIVE_READ_REQUIRED/,
  );

  // After a live read: write gate lifts, phase advances
  await sendCommand("getTransportState");
  const runtimeMid = getBridgeRuntimeStatus();
  assert.equal(runtimeMid.lifecyclePhase, "live_read_verified");
  assert.equal(runtimeMid.proof.liveReadVerified, true);
  assert.equal(runtimeMid.proof.liveWriteVerified, false);
  assert.equal(runtimeMid.proof.nextRequiredState, "live_write_verified");

  await sendCommand("setTempo", { bpm: 130 });
  const runtimeAfter = getBridgeRuntimeStatus();
  assert.equal(runtimeAfter.lifecyclePhase, "runtime_verified");
  assert.equal(runtimeAfter.proof.liveWriteVerified, true);
  assert.equal(runtimeAfter.proof.runtimeVerified, true);
  assert.equal(runtimeAfter.proof.nextRequiredState, null);
});

test("bridge disconnect rejects and cleans pending requests", async () => {
  let socketRef = null;
  __setSocketFactoryForTests(handshakeOnlyFactory((socket) => {
    socketRef = socket;
  }));

  await connectBridge();

  const pending = sendCommand("getSongMetadata");
  assert.equal(__getPendingRequestCountForTests(), 1);

  socketRef.close();

  await assert.rejects(() => pending, /disconnected/);
  assert.equal(__getPendingRequestCountForTests(), 0);
  assert.equal(getBridgeRuntimeStatus().state, "disconnected");
});
