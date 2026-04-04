// Bridge handshake verification tests
import { describe, it, beforeEach, afterEach } from "node:test";
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

beforeEach(() => {
  __resetBridgeStateForTests();
  __setBridgeTimeoutForTests(25);
});

afterEach(async () => {
  await disconnectBridge();
  __resetBridgeStateForTests();
});

describe("bridge handshake", () => {
  it("stays non-ready unless both ping and capabilities succeed", async () => {
    // Only respond to ping, ignore capabilities → handshake fails
    __setSocketFactoryForTests(
      createSocketFactory((msg, sock) => {
        if (msg.command === "ping") {
          sock.reply({ requestId: msg.requestId, ok: true, data: { pong: true } });
        }
        // Deliberately do NOT reply to getCapabilities → timeout
      })
    );

    await connectBridge();

    const status = getBridgeRuntimeStatus();
    assert.equal(status.state, "degraded");
    assert.equal(status.lifecyclePhase, "idle");
    assert.equal(status.proof.handshakeOk, false);
    assert.equal(status.lastError?.code, "HANDSHAKE_FAILED");
    assert.equal(status.proof.liveReadVerified, false);
    assert.equal(status.proof.liveWriteVerified, false);
  });

  it("becomes ready only after ping and capability responses both validate", async () => {
    __setSocketFactoryForTests(
      createSocketFactory((msg, sock) => {
        if (msg.command === "ping") {
          sock.reply({ requestId: msg.requestId, ok: true, data: { pong: true } });
        } else if (msg.command === "getCapabilities") {
          sock.reply({
            requestId: msg.requestId,
            ok: true,
            data: {
              commands: ["getTransportState", "setTempo"],
              apiVersion: "1.0",
              extensionVersion: "1.1",
            },
          });
        }
      })
    );

    await connectBridge();

    const status = getBridgeRuntimeStatus();

    // State and phase
    assert.equal(status.state, "ready");
    assert.equal(status.lifecyclePhase, "handshake_ok");

    // Capabilities stored
    assert.ok(status.capabilities);
    assert.deepEqual(status.capabilities.commands, ["getTransportState", "setTempo"]);
    assert.equal(status.capabilities.apiVersion, "1.0");
    assert.equal(status.capabilities.extensionVersion, "1.1");

    // Timestamps populated
    assert.ok(status.extensionRespondedAt);
    assert.ok(status.lastHandshakeAt);
    assert.ok(status.lastPingAt);
    assert.ok(status.connectedAt);

    // Proof levels — read/write not yet verified
    assert.equal(status.proof.liveReadVerified, false);
    assert.equal(status.proof.liveWriteVerified, false);
    assert.equal(status.proof.handshakeOk, true);
    assert.equal(status.proof.packageMode, "bridge_experimental");
    assert.equal(status.proof.nextRequiredState, "live_read_verified");

    // No errors
    assert.equal(status.lastError, null);
  });
});
