import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetBridgeStateForTests,
  __setBridgeTimeoutForTests,
  __setSocketFactoryForTests,
  connectBridge,
  disconnectBridge,
  getBridgeRuntimeStatus,
} from "../../dist/services/bridge.js";
import { createSocketFactory } from "../helpers/fake-bridge-socket.js";

test.beforeEach(() => {
  __resetBridgeStateForTests();
  __setBridgeTimeoutForTests(25);
});

test.afterEach(async () => {
  await disconnectBridge();
  __resetBridgeStateForTests();
});

test("bridge handshake stays non-ready unless both ping and capabilities succeed", async () => {
  __setSocketFactoryForTests(createSocketFactory((message, socket) => {
    if (message.command === "ping") {
      socket.reply({
        requestId: message.requestId,
        ok: true,
        command: "ping",
        data: { pong: true },
      });
    }
  }));

  await assert.rejects(() => connectBridge(), /HANDSHAKE_FAILED/);

  const runtime = getBridgeRuntimeStatus();
  assert.equal(runtime.handshakeOk, false);
  assert.equal(runtime.state, "degraded");
  assert.equal(runtime.capabilities, null);
  assert.equal(runtime.lastError?.code, "HANDSHAKE_FAILED");
});

test("bridge becomes ready only after ping and capability responses both validate", async () => {
  __setSocketFactoryForTests(createSocketFactory((message, socket) => {
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
          tracks: false,
          plugins: false,
          automation: false,
          midi: false,
          markers: false,
          filesystem: true,
          websocketServer: true,
        },
      });
    }
  }));

  await connectBridge();

  const runtime = getBridgeRuntimeStatus();
  assert.equal(runtime.state, "ready");
  assert.equal(runtime.handshakeOk, true);
  assert.equal(runtime.capabilities?.transport, true);
  assert.ok(runtime.lastHandshakeAt);
  assert.ok(runtime.lastPingAt);
  assert.equal(runtime.lastError, null);
});
