// ─── Fornix Studio MCP – Studio One Bridge ───────────────────────────────────
//
// Maintains the optional experimental WebSocket connection to the Studio One
// extension. A socket connection alone is not treated as ready. The bridge must
// complete a shallow runtime probe handshake before live commands are allowed.

import fs from "fs";
import os from "os";
import path from "path";
import { WebSocket } from "ws";
import { S1_BRIDGE_HOST, S1_BRIDGE_PORT, S1_BRIDGE_TIMEOUT_MS } from "../constants.js";
import type {
  S1BridgeCapabilities,
  S1BridgeExtensionEvidence,
  S1BridgeLifecyclePhase,
  S1BridgeProofStates,
  S1BridgeRuntimeStatus,
  S1BridgeStatus,
  S1Command,
  S1Response,
} from "../types.js";

type BridgeSocketLike = {
  send(data: string): void;
  close(): void;
  terminate?: () => void;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
};

type BridgeSocketFactory = (url: string) => BridgeSocketLike;

type PendingRequest = {
  resolve: (r: S1Response) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
  command: string;
};

const LIVE_READ_COMMANDS = new Set([
  "getTransportState",
  "getSongMetadata",
]);

const LIVE_WRITE_COMMANDS = new Set([
  "setTempo",
  "setLoopRange",
  "createTrack",
  "renameTrack",
  "setTrackMute",
  "setTrackSolo",
  "setTrackVolume",
  "createSend",
  "addPlugin",
  "setPluginParam",
  "loadPluginPreset",
  "triggerMacro",
  "addMidiNotes",
  "addChord",
  "addDrumPattern",
  "clearMidiPart",
  "quantizePart",
  "addMarker",
  "deleteMarker",
  "addAutomationPoints",
]);

const DEFAULT_EXTENSION_LOG_DIR = path.join(os.homedir(), "Documents", "FornixMCP", "logs");

const DEFAULT_CAPABILITIES: S1BridgeCapabilities = {
  transport: false,
  song: false,
  tracks: false,
  plugins: false,
  automation: false,
  midi: false,
  markers: false,
  filesystem: false,
  websocketServer: false,
};

let _ws: BridgeSocketLike | null = null;
let _state: S1BridgeStatus = "disconnected";
let _pendingRequests = new Map<string, PendingRequest>();
let _reqCounter = 0;
let _lastHandshakeAt: string | null = null;
let _lastPingAt: string | null = null;
let _capabilities: S1BridgeCapabilities | null = null;
let _lastError: { code: string; message: string } | null = null;
let _socketFactory: BridgeSocketFactory = (url) => new WebSocket(url);
let _bridgeTimeoutMs = S1_BRIDGE_TIMEOUT_MS;
/** Progress within performHandshake (socket alone is not enough). */
let _handshakeStage: "none" | "ping_ok" | "complete" = "none";
let _extensionRespondedAt: string | null = null;
let _runtimeReadVerifiedAt: string | null = null;
let _runtimeWriteVerifiedAt: string | null = null;

function nextId(): string {
  return `mcp-${++_reqCounter}`;
}

function setState(next: S1BridgeStatus): void {
  _state = next;
}

function setLastError(code: string, message: string): void {
  _lastError = { code, message };
}

function clearLastError(): void {
  _lastError = null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readLatestStartupMarker(): S1BridgeExtensionEvidence {
  const evidence: S1BridgeExtensionEvidence = {
    logsDir: DEFAULT_EXTENSION_LOG_DIR,
    startupMarkerFound: false,
    lastStartupAt: null,
    lastStartupPath: null,
    listenerDeclaredAvailable: null,
    filesystemWriteAvailable: null,
    source: "none" as const,
  };

  if (!fs.existsSync(DEFAULT_EXTENSION_LOG_DIR)) {
    return evidence;
  }

  let files: string[] = [];
  try {
    files = fs.readdirSync(DEFAULT_EXTENSION_LOG_DIR)
      .filter((name) => name.startsWith("startup-") && name.endsWith(".json"))
      .sort()
      .reverse();
  } catch {
    return evidence;
  }

  if (!files.length) {
    return evidence;
  }

  const latestPath = path.join(DEFAULT_EXTENSION_LOG_DIR, files[0]);
  evidence.startupMarkerFound = true;
  evidence.lastStartupPath = latestPath;
  evidence.source = "startup_marker";

  try {
    const parsed = JSON.parse(fs.readFileSync(latestPath, "utf8")) as Record<string, unknown>;
    const host = isObject(parsed.host) ? parsed.host : {};
    evidence.lastStartupAt =
      typeof parsed.timestamp === "string"
        ? parsed.timestamp
        : null;
    evidence.listenerDeclaredAvailable =
      typeof host.websocketServer === "boolean"
        ? host.websocketServer
        : null;
    evidence.filesystemWriteAvailable =
      typeof host.filesystemWrite === "boolean"
        ? host.filesystemWrite
        : null;
  } catch {
    // keep marker existence even if JSON parse fails
  }

  return evidence;
}

function buildBridgeProofStates(): S1BridgeProofStates {
  const extensionEvidence = readLatestStartupMarker();
  const extensionLoaded = extensionEvidence.startupMarkerFound || _extensionRespondedAt !== null;
  // listenerCreated requires actual evidence: either the startup marker explicitly
  // reports host.websocketServer=true, or the handshake completed (which proves
  // the extension answered on that port).  A bare TCP connection (_state===
  // "connected") is not sufficient — any process could be listening on port 7890.
  const listenerCreated =
    extensionEvidence.listenerDeclaredAvailable === true
    || _state === "ready"
    || _state === "degraded";
  const handshakeOk = isBridgeReady();
  const liveReadVerified = _runtimeReadVerifiedAt !== null;
  const liveWriteVerified = _runtimeWriteVerifiedAt !== null;
  const runtimeVerified = liveReadVerified && liveWriteVerified;

  let nextRequiredState: S1BridgeProofStates["nextRequiredState"] = null;
  if (!extensionLoaded) nextRequiredState = "extension_loaded";
  else if (!listenerCreated) nextRequiredState = "listener_created";
  else if (!handshakeOk) nextRequiredState = "handshake_ok";
  else if (!liveReadVerified) nextRequiredState = "live_read_verified";
  else if (!liveWriteVerified) nextRequiredState = "live_write_verified";
  else nextRequiredState = null;

  const packageMode =
    runtimeVerified
      ? "runtime_verified"
      : handshakeOk || extensionLoaded || listenerCreated
        ? "bridge_experimental"
        : "file_first";

  let acceptanceSummary = "File-first / fallback-first. No Studio One runtime proof yet.";
  if (runtimeVerified) {
    acceptanceSummary = "Runtime verified: handshake, one live read, and one live write have all completed in this MCP process.";
  } else if (liveReadVerified) {
    acceptanceSummary = "Handshake completed and one live read succeeded. Live write is still unverified.";
  } else if (handshakeOk) {
    acceptanceSummary = "Handshake completed, but no live read or live write has been verified yet.";
  } else if (listenerCreated) {
    acceptanceSummary = "A listener is observable, but the MCP→Studio One handshake is still unproven.";
  } else if (extensionLoaded) {
    acceptanceSummary = "The extension has runtime evidence, but no listener or handshake is proven yet.";
  }

  return {
    extensionLoaded,
    listenerCreated,
    handshakeOk,
    liveReadVerified,
    liveWriteVerified,
    runtimeVerified,
    hasRealRuntimeProof: runtimeVerified,
    nextRequiredState,
    packageMode,
    acceptanceSummary,
  };
}

function normalizeCapabilities(value: unknown): S1BridgeCapabilities {
  const source = isObject(value) ? value : {};
  return {
    transport: source.transport === true,
    song: source.song === true,
    tracks: source.tracks === true,
    plugins: source.plugins === true,
    automation: source.automation === true,
    midi: source.midi === true,
    markers: source.markers === true,
    filesystem: source.filesystem === true,
    websocketServer: source.websocketServer === true,
  };
}

function normalizeResponse(raw: unknown): S1Response | null {
  if (!isObject(raw)) {
    return null;
  }

  const command = typeof raw.command === "string" ? raw.command : "unknown";
  const errorCode = typeof raw.errorCode === "string" ? raw.errorCode : undefined;
  const errorMessage =
    typeof raw.errorMessage === "string"
      ? raw.errorMessage
      : typeof raw.error === "string"
        ? raw.error
        : undefined;

  return {
    requestId: typeof raw.requestId === "string" || raw.requestId === null ? raw.requestId : undefined,
    ok: raw.ok === true,
    command,
    data: raw.data,
    error: errorMessage,
    errorCode,
    errorMessage,
  };
}

function isSocketUsable(): boolean {
  return _ws !== null && (_state === "connected" || _state === "ready" || _state === "degraded");
}

function cleanupPendingRequests(reason: Error): void {
  for (const [, pending] of _pendingRequests) {
    clearTimeout(pending.timer);
    pending.reject(reason);
  }
  _pendingRequests.clear();
}

function onSocketMessage(raw: unknown): void {
  try {
    const parsed = JSON.parse(String(raw));
    const msg = normalizeResponse(parsed);

    if (!msg) {
      process.stderr.write("[s1-bridge] Ignored malformed response envelope\n");
      return;
    }

    const id = msg.requestId;
    if (id && _pendingRequests.has(id)) {
      const pending = _pendingRequests.get(id)!;
      clearTimeout(pending.timer);
      _pendingRequests.delete(id);
      pending.resolve(msg);
      return;
    }

    process.stderr.write(`[s1-bridge] Ignored unsolicited message for command "${msg.command}"\n`);
  } catch {
    process.stderr.write("[s1-bridge] Failed to parse bridge message\n");
  }
}

function onSocketClose(): void {
  _ws = null;
  _capabilities = null;
  _lastHandshakeAt = null;
  _handshakeStage = "none";
  _extensionRespondedAt = null;
  _runtimeReadVerifiedAt = null;
  _runtimeWriteVerifiedAt = null;
  setState("disconnected");
  setLastError("BRIDGE_NOT_CONNECTED", "Studio One bridge disconnected");
  cleanupPendingRequests(new Error("Studio One bridge disconnected"));
  process.stderr.write("[s1-bridge] Disconnected from Studio One extension\n");
}

function onSocketError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  setLastError("RUNTIME_ERROR", message);
  if (_state !== "disconnected") {
    // Clear proof timestamps so the dashboard never shows stale live-verified
    // timestamps alongside an error state.  onSocketClose does this too, but
    // an error event does not always precede a close event.
    _runtimeReadVerifiedAt = null;
    _runtimeWriteVerifiedAt = null;
    setState("error");
  }
}

function attachSocketListeners(ws: BridgeSocketLike): void {
  ws.on("message", onSocketMessage);
  ws.on("close", onSocketClose);
  ws.on("error", onSocketError);
}

async function openSocket(url: string): Promise<BridgeSocketLike> {
  clearLastError();
  setState("connecting");

  return new Promise((resolve, reject) => {
    const ws = _socketFactory(url);
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      setState("error");
      setLastError(
        "COMMAND_TIMEOUT",
        `Studio One bridge connection timeout (${_bridgeTimeoutMs}ms)`,
      );
      ws.terminate?.();
      reject(new Error(`Studio One bridge connection timeout (${_bridgeTimeoutMs}ms). Is the Studio One Extension running?`));
    }, _bridgeTimeoutMs);

    ws.on("open", () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve(ws);
    });

    ws.on("error", (err) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      setState("error");
      const message = err instanceof Error ? err.message : String(err);
      setLastError("RUNTIME_ERROR", message);
      reject(err instanceof Error ? err : new Error(message));
    });
  });
}

async function sendBridgeRequest(
  command: string,
  params: Record<string, unknown> = {},
  options: { requireReady?: boolean; timeoutMs?: number } = {},
): Promise<S1Response> {
  const { requireReady = true, timeoutMs = _bridgeTimeoutMs } = options;

  if (!isSocketUsable()) {
    setLastError("BRIDGE_NOT_CONNECTED", "Studio One bridge is not connected");
    throw new Error("BRIDGE_NOT_CONNECTED: Studio One bridge is not connected.");
  }

  if (requireReady && _state !== "ready") {
    setLastError("BRIDGE_NOT_READY", "Studio One bridge socket exists but handshake is incomplete");
    throw new Error("BRIDGE_NOT_READY: Studio One bridge handshake has not completed.");
  }

  if (LIVE_WRITE_COMMANDS.has(command) && !_runtimeReadVerifiedAt) {
    setLastError(
      "LIVE_READ_REQUIRED",
      `Studio One write command "${command}" is gated until one live read is verified.`,
    );
    throw new Error(
      `LIVE_READ_REQUIRED: Studio One write command "${command}" is blocked until one live read succeeds and is confirmed against Studio One. ` +
      `Run s1_get_transport_state or s1_query_song_metadata first, verify the returned values in the DAW, then retry the write.`,
    );
  }

  const requestId = nextId();
  const cmd: S1Command = { command, params, requestId };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      _pendingRequests.delete(requestId);
      setLastError("COMMAND_TIMEOUT", `Studio One command "${command}" timed out after ${timeoutMs}ms`);
      reject(new Error(`COMMAND_TIMEOUT: Studio One command "${command}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    _pendingRequests.set(requestId, { resolve, reject, timer, command });

    try {
      _ws!.send(JSON.stringify(cmd));
    } catch (error) {
      clearTimeout(timer);
      _pendingRequests.delete(requestId);
      const message = error instanceof Error ? error.message : String(error);
      setLastError("RUNTIME_ERROR", message);
      reject(new Error(`RUNTIME_ERROR: ${message}`));
    }
  });
}

async function performHandshake(): Promise<void> {
  _handshakeStage = "none";
  try {
    process.stderr.write("[s1-bridge] Handshake: sending ping…\n");
    const ping = await sendBridgeRequest("ping", {}, { requireReady: false });
    if (!ping.ok) {
      throw new Error(ping.errorMessage ?? "ping failed");
    }

    _lastPingAt = new Date().toISOString();
    _extensionRespondedAt = _lastPingAt;
    _handshakeStage = "ping_ok";
    process.stderr.write(
      `[s1-bridge] Handshake: ping OK (${_lastPingAt}) — extension router responded\n`,
    );

    process.stderr.write("[s1-bridge] Handshake: requesting getCapabilities…\n");
    const capabilities = await sendBridgeRequest("getCapabilities", {}, { requireReady: false });
    if (!capabilities.ok) {
      throw new Error(capabilities.errorMessage ?? "capability probe failed");
    }

    _capabilities = normalizeCapabilities(capabilities.data);
    _lastHandshakeAt = new Date().toISOString();
    _handshakeStage = "complete";
    const capKeys = Object.entries(_capabilities)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(", ");
    process.stderr.write(
      `[s1-bridge] Handshake: capabilities OK (${_lastHandshakeAt}) — ${capKeys || "(none)"}\n`,
    );
    setState("ready");
    clearLastError();
  } catch (error) {
    _capabilities = null;
    _lastHandshakeAt = null;
    _handshakeStage = "none";
    setState(_ws ? "degraded" : "error");
    setLastError(
      "HANDSHAKE_FAILED",
      error instanceof Error ? error.message : String(error),
    );
    process.stderr.write(
      `[s1-bridge] Handshake FAILED: ${_lastError?.message ?? "unknown"}\n`,
    );
    throw new Error(`HANDSHAKE_FAILED: ${_lastError?.message ?? "Bridge handshake failed"}`);
  }
}

export function getBridgeStatus(): S1BridgeStatus {
  return _state;
}

export function isBridgeReady(): boolean {
  return _state === "ready" && _lastHandshakeAt !== null;
}

function deriveLifecyclePhase(): S1BridgeLifecyclePhase {
  if (_state === "disconnected") return "disconnected";
  if (_state === "connecting") return "connecting";
  if (_state === "error") return "error";
  if (_state === "degraded") return "degraded";
  if (_state === "connected") {
    if (_handshakeStage === "ping_ok") return "extension_responded";
    return "socket_connected";
  }
  if (_state === "ready") {
    if (_runtimeReadVerifiedAt && _runtimeWriteVerifiedAt) return "runtime_verified";
    if (_runtimeReadVerifiedAt) return "live_read_verified";
    return "handshake_ok";
  }
  return "socket_connected";
}

export function getBridgeLifecyclePhase(): S1BridgeLifecyclePhase {
  return deriveLifecyclePhase();
}

/**
 * Record first successful live read or write in this process (after handshake).
 * Used to surface runtime_verified — does not replace Studio One-side proof.
 */
export function recordBridgeLiveVerification(kind: "read" | "write"): void {
  if (!isBridgeReady()) {
    return;
  }
  const ts = new Date().toISOString();
  if (kind === "read" && !_runtimeReadVerifiedAt) {
    _runtimeReadVerifiedAt = ts;
    process.stderr.write(`[s1-bridge] Runtime: first live READ verified at ${ts}\n`);
  }
  if (kind === "write" && !_runtimeWriteVerifiedAt) {
    _runtimeWriteVerifiedAt = ts;
    process.stderr.write(`[s1-bridge] Runtime: first live WRITE verified at ${ts}\n`);
  }
}

export function getBridgeRuntimeStatus(): S1BridgeRuntimeStatus {
  const extensionEvidence = readLatestStartupMarker();
  const proof = buildBridgeProofStates();

  return {
    state: _state,
    handshakeOk: isBridgeReady(),
    lifecyclePhase: deriveLifecyclePhase(),
    extensionRespondedAt: _extensionRespondedAt,
    lastHandshakeAt: _lastHandshakeAt,
    lastPingAt: _lastPingAt,
    capabilities: _capabilities,
    lastError: _lastError,
    runtimeReadVerifiedAt: _runtimeReadVerifiedAt,
    runtimeWriteVerifiedAt: _runtimeWriteVerifiedAt,
    extensionEvidence,
    proof,
  };
}

export function hasBridgeCapability(capability: keyof S1BridgeCapabilities): boolean {
  return _capabilities?.[capability] === true;
}

export async function connectBridge(): Promise<void> {
  const url = `ws://${S1_BRIDGE_HOST}:${S1_BRIDGE_PORT}`;
  const ws = await openSocket(url);

  _ws = ws;
  attachSocketListeners(ws);
  setState("connected");
  process.stderr.write("[s1-bridge] Socket connected; running runtime probe handshake\n");

  await performHandshake();
  process.stderr.write("[s1-bridge] Handshake complete; bridge marked ready\n");
}

export async function disconnectBridge(): Promise<void> {
  cleanupPendingRequests(new Error("Studio One bridge disconnected"));
  _ws?.close();
  _ws = null;
  _capabilities = null;
  _lastHandshakeAt = null;
  _handshakeStage = "none";
  _extensionRespondedAt = null;
  _runtimeReadVerifiedAt = null;
  _runtimeWriteVerifiedAt = null;
  setState("disconnected");
}

export async function sendCommand(
  command: string,
  params: Record<string, unknown> = {},
): Promise<S1Response> {
  const response = await sendBridgeRequest(command, params, { requireReady: true });

  if (response.ok && LIVE_READ_COMMANDS.has(command)) {
    recordBridgeLiveVerification("read");
  }

  if (response.ok && LIVE_WRITE_COMMANDS.has(command)) {
    recordBridgeLiveVerification("write");
  }

  return response;
}

export async function tryConnectBridge(): Promise<void> {
  try {
    await connectBridge();
  } catch {
    const runtime = getBridgeRuntimeStatus();
    process.stderr.write(
      `[s1-bridge] Bridge not ready (state=${runtime.state}, handshake=${runtime.handshakeOk ? "ok" : "pending"})\n` +
      "  Studio One runtime is unverified; fallback tools remain first-class.\n",
    );
  }
}

// ── Test hooks ────────────────────────────────────────────────────────────────

export function __setSocketFactoryForTests(factory: BridgeSocketFactory): void {
  _socketFactory = factory;
}

export function __resetBridgeStateForTests(): void {
  cleanupPendingRequests(new Error("Bridge test reset"));
  _ws = null;
  _state = "disconnected";
  _reqCounter = 0;
  _lastHandshakeAt = null;
  _lastPingAt = null;
  _capabilities = null;
  _lastError = null;
  _handshakeStage = "none";
  _extensionRespondedAt = null;
  _runtimeReadVerifiedAt = null;
  _runtimeWriteVerifiedAt = null;
  _socketFactory = (url) => new WebSocket(url);
  _bridgeTimeoutMs = S1_BRIDGE_TIMEOUT_MS;
}

export function __setBridgeTimeoutForTests(timeoutMs: number): void {
  _bridgeTimeoutMs = timeoutMs;
}

export function __getPendingRequestCountForTests(): number {
  return _pendingRequests.size;
}
