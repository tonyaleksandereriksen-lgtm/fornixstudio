// ─── Fornix Studio MCP – Studio One Bridge ───────────────────────────────────
//
// Maintains a WebSocket connection to the Studio One JS Extension on port 7890.
//
// Lifecycle phases:
//   idle → handshake_ok → live_read_verified → runtime_verified
//
// Write-gating: write commands are rejected until at least one live read
// has been verified, ensuring the bridge actually returns real DAW data
// before any state-mutating commands are allowed.

import { WebSocket } from "ws";
import { S1_BRIDGE_HOST, S1_BRIDGE_PORT, S1_BRIDGE_TIMEOUT_MS } from "../constants.js";
import type {
  S1Command,
  S1Response,
  S1BridgeStatus,
  BridgeRuntimeState,
  BridgeLifecyclePhase,
  BridgeErrorCode,
  BridgeProof,
  BridgeLastError,
  BridgeCapabilities,
  BridgeRuntimeStatus,
} from "../types.js";
import { BRIDGE_READ_COMMANDS, BRIDGE_WRITE_COMMANDS } from "../types.js";

// ── Internal state ───────────────────────────────────────────────────────────

let _ws: WebSocket | null = null;
let _status: S1BridgeStatus = "disconnected";
let _pendingRequests = new Map<
  string,
  { resolve: (r: S1Response) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
>();
let _reqCounter = 0;

// Runtime proof state
let _runtimeState: BridgeRuntimeState = "disconnected";
let _lifecyclePhase: BridgeLifecyclePhase = "idle";
let _capabilities: BridgeCapabilities | null = null;
let _lastError: BridgeLastError | null = null;
let _liveReadVerified = false;
let _liveWriteVerified = false;
let _extensionRespondedAt: string | null = null;
let _lastHandshakeAt: string | null = null;
let _lastPingAt: string | null = null;
let _connectedAt: string | null = null;

// Test hooks
let _timeoutMs = S1_BRIDGE_TIMEOUT_MS;
let _socketFactory: ((url: string) => WebSocket) | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function nextId(): string {
  return `mcp-${++_reqCounter}`;
}

function now(): string {
  return new Date().toISOString();
}

function setLastError(code: BridgeErrorCode, message: string): void {
  _lastError = { code, message, ts: now() };
}

function computeNextRequired(): BridgeLifecyclePhase | null {
  if (!_liveReadVerified) return "live_read_verified";
  if (!_liveWriteVerified) return "runtime_verified";
  return null;
}

function buildProof(): BridgeProof {
  return {
    packageMode: "bridge_experimental",
    extensionLoaded: _extensionRespondedAt !== null,
    listenerCreated: _connectedAt !== null,
    handshakeOk: (_lifecyclePhase as string) !== "idle",
    liveReadVerified: _liveReadVerified,
    liveWriteVerified: _liveWriteVerified,
    nextRequiredState: computeNextRequired(),
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getBridgeStatus(): S1BridgeStatus {
  return _status;
}

export function getBridgeRuntimeStatus(): BridgeRuntimeStatus {
  return {
    state: _runtimeState,
    lifecyclePhase: _lifecyclePhase,
    proof: buildProof(),
    capabilities: _capabilities,
    lastError: _lastError,
    extensionRespondedAt: _extensionRespondedAt,
    lastHandshakeAt: _lastHandshakeAt,
    lastPingAt: _lastPingAt,
    connectedAt: _connectedAt,
  };
}

export async function connectBridge(): Promise<void> {
  _runtimeState = "connecting";

  return new Promise<void>((resolve, reject) => {
    const url = `ws://${S1_BRIDGE_HOST}:${S1_BRIDGE_PORT}`;
    const ws = _socketFactory ? _socketFactory(url) : new WebSocket(url);

    const timeout = setTimeout(() => {
      ws.terminate();
      _status = "error";
      _runtimeState = "disconnected";
      reject(new Error(`Studio One bridge connection timeout (${_timeoutMs}ms). Is the Studio One Extension running?`));
    }, _timeoutMs);

    ws.on("open", () => {
      clearTimeout(timeout);
      _ws = ws;
      _status = "connected";
      _connectedAt = now();
      process.stderr.write("[s1-bridge] Connected to Studio One extension\n");

      // Start handshake sequence
      performHandshake().then(() => {
        resolve();
      }).catch((err) => {
        _runtimeState = "degraded";
        setLastError("HANDSHAKE_FAILED", String(err.message ?? err));
        resolve(); // Still resolve — connected but degraded
      });
    });

    ws.on("message", (raw: unknown) => {
      try {
        const rawStr = typeof raw === "string" ? raw : String(raw);
        const msg = JSON.parse(rawStr) as S1Response;
        const id = msg.requestId;
        if (id && _pendingRequests.has(id)) {
          const { resolve: res, timer } = _pendingRequests.get(id)!;
          clearTimeout(timer);
          _pendingRequests.delete(id);
          res(msg);
        }
      } catch {
        process.stderr.write("[s1-bridge] Failed to parse message\n");
      }
    });

    ws.on("close", () => {
      _ws = null;
      _status = "disconnected";
      _runtimeState = "disconnected";
      process.stderr.write("[s1-bridge] Disconnected from Studio One extension\n");
      for (const [, { reject: rej, timer }] of _pendingRequests) {
        clearTimeout(timer);
        rej(new Error("Studio One bridge disconnected"));
      }
      _pendingRequests.clear();
    });

    ws.on("error", (err: Error) => {
      clearTimeout(timeout);
      _status = "error";
      _runtimeState = "disconnected";
      reject(err);
    });
  });
}

async function performHandshake(): Promise<void> {
  // Step 1: Ping
  const pingId = nextId();
  const pingResponse = await rawSend({ command: "ping", requestId: pingId });
  if (!pingResponse.ok) {
    throw new Error("Ping failed: " + (pingResponse.error ?? "unknown"));
  }
  _lastPingAt = now();
  _extensionRespondedAt = now();

  // Step 2: Capabilities
  const capId = nextId();
  const capResponse = await rawSend({ command: "getCapabilities", requestId: capId });
  if (!capResponse.ok || !capResponse.data) {
    throw new Error("Capabilities exchange failed");
  }

  const data = capResponse.data as Record<string, unknown>;
  _capabilities = {
    commands: (data.commands as string[]) ?? [],
    apiVersion: (data.apiVersion as string) ?? "unknown",
    extensionVersion: (data.extensionVersion as string) ?? "unknown",
  };
  _lastHandshakeAt = now();
  _runtimeState = "ready";
  _lifecyclePhase = "handshake_ok";
  process.stderr.write("[s1-bridge] Handshake complete – extension ready\n");
}

/**
 * Low-level send that bypasses write-gating. Used for handshake commands.
 */
function rawSend(cmd: S1Command): Promise<S1Response> {
  if (!_ws) throw new Error("No WebSocket connection");

  const requestId = cmd.requestId ?? nextId();
  const payload: S1Command = { ...cmd, requestId };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      _pendingRequests.delete(requestId);
      setLastError("COMMAND_TIMEOUT", `Command "${cmd.command}" timed out after ${_timeoutMs}ms`);
      reject(Object.assign(new Error(`Command "${cmd.command}" timed out after ${_timeoutMs}ms`), { code: "COMMAND_TIMEOUT" }));
    }, _timeoutMs);

    _pendingRequests.set(requestId, { resolve, reject, timer });
    _ws!.send(JSON.stringify(payload));
  });
}

/**
 * Send a command to Studio One and await the response.
 * Write commands are gated until at least one live read is verified.
 */
export async function sendCommand(
  command: string,
  params: Record<string, unknown> = {}
): Promise<S1Response> {
  if (!_ws || _status !== "connected") {
    throw new Error(
      "Studio One bridge is not connected.\n" +
      "Ensure the Fornix Studio One Extension is installed and Studio One is open.\n" +
      "Fallback: use the s1_export_instruction tool to generate a manual change file."
    );
  }

  // Write-gating: reject writes until live read is verified
  if (BRIDGE_WRITE_COMMANDS.has(command) && !_liveReadVerified) {
    const err = Object.assign(
      new Error(`Write command "${command}" rejected: complete at least one live read first.`),
      { code: "LIVE_READ_REQUIRED" as const }
    );
    setLastError("LIVE_READ_REQUIRED", err.message);
    throw err;
  }

  const requestId = nextId();
  const cmd: S1Command = { command, params, requestId };

  const response = await rawSend(cmd);

  // Advance proof state on successful responses
  if (response.ok) {
    if (BRIDGE_READ_COMMANDS.has(command) && !_liveReadVerified) {
      _liveReadVerified = true;
      _lifecyclePhase = "live_read_verified";
      process.stderr.write("[s1-bridge] Live read verified via " + command + "\n");
    }
    if (BRIDGE_WRITE_COMMANDS.has(command) && !_liveWriteVerified) {
      _liveWriteVerified = true;
      _lifecyclePhase = "runtime_verified";
      process.stderr.write("[s1-bridge] Live write verified via " + command + " – runtime fully verified\n");
    }
  }

  return response;
}

export async function disconnectBridge(): Promise<void> {
  _ws?.close();
  _ws = null;
  _status = "disconnected";
  _runtimeState = "disconnected";
}

/**
 * Attempt to connect; silently fail if S1 is not available.
 * Used at server startup so the MCP server launches even without S1.
 */
export async function tryConnectBridge(): Promise<void> {
  try {
    await connectBridge();
  } catch {
    process.stderr.write(
      "[s1-bridge] Studio One not available – bridge will be inactive.\n" +
      "  Start Studio One with the Fornix Extension to enable live DAW control.\n"
    );
  }
}

// ── Test hooks ───────────────────────────────────────────────────────────────
// These are only used by the test suite to inject mock sockets and reset state.

export function __resetBridgeStateForTests(): void {
  _ws = null;
  _status = "disconnected";
  _runtimeState = "disconnected";
  _lifecyclePhase = "idle";
  _capabilities = null;
  _lastError = null;
  _liveReadVerified = false;
  _liveWriteVerified = false;
  _extensionRespondedAt = null;
  _lastHandshakeAt = null;
  _lastPingAt = null;
  _connectedAt = null;
  _reqCounter = 0;
  for (const [, { reject: rej, timer }] of _pendingRequests) {
    clearTimeout(timer);
    rej(new Error("reset"));
  }
  _pendingRequests.clear();
  _socketFactory = null;
  _timeoutMs = S1_BRIDGE_TIMEOUT_MS;
}

export function __setBridgeTimeoutForTests(ms: number): void {
  _timeoutMs = ms;
}

export function __setSocketFactoryForTests(factory: ((url: string) => WebSocket) | null): void {
  _socketFactory = factory;
}

export function __getPendingRequestCountForTests(): number {
  return _pendingRequests.size;
}
