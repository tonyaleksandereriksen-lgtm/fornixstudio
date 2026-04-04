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
