// ─── Fornix Studio MCP – Studio One Bridge ───────────────────────────────────
//
// Maintains the optional experimental WebSocket connection to the Studio One
// extension. A socket connection alone is not treated as ready. The bridge must
// complete a shallow runtime probe handshake before live commands are allowed.

import { WebSocket } from "ws";
import { S1_BRIDGE_HOST, S1_BRIDGE_PORT, S1_BRIDGE_TIMEOUT_MS } from "../constants.js";
import type {
  S1BridgeCapabilities,
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
  setState("disconnected");
  setLastError("BRIDGE_NOT_CONNECTED", "Studio One bridge disconnected");
  cleanupPendingRequests(new Error("Studio One bridge disconnected"));
  process.stderr.write("[s1-bridge] Disconnected from Studio One extension\n");
}

function onSocketError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  setLastError("RUNTIME_ERROR", message);
  if (_state !== "disconnected") {
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
  try {
    const ping = await sendBridgeRequest("ping", {}, { requireReady: false });
    if (!ping.ok) {
      throw new Error(ping.errorMessage ?? "ping failed");
    }

    _lastPingAt = new Date().toISOString();

    const capabilities = await sendBridgeRequest("getCapabilities", {}, { requireReady: false });
    if (!capabilities.ok) {
      throw new Error(capabilities.errorMessage ?? "capability probe failed");
    }

    _capabilities = normalizeCapabilities(capabilities.data);
    _lastHandshakeAt = new Date().toISOString();
    setState("ready");
    clearLastError();
  } catch (error) {
    _capabilities = null;
    _lastHandshakeAt = null;
    setState(_ws ? "degraded" : "error");
    setLastError(
      "HANDSHAKE_FAILED",
      error instanceof Error ? error.message : String(error),
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

export function getBridgeRuntimeStatus(): S1BridgeRuntimeStatus {
  return {
    state: _state,
    handshakeOk: isBridgeReady(),
    lastHandshakeAt: _lastHandshakeAt,
    lastPingAt: _lastPingAt,
    capabilities: _capabilities,
    lastError: _lastError,
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
  setState("disconnected");
}

export async function sendCommand(
  command: string,
  params: Record<string, unknown> = {},
): Promise<S1Response> {
  return sendBridgeRequest(command, params, { requireReady: true });
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
  _socketFactory = (url) => new WebSocket(url);
  _bridgeTimeoutMs = S1_BRIDGE_TIMEOUT_MS;
}

export function __setBridgeTimeoutForTests(timeoutMs: number): void {
  _bridgeTimeoutMs = timeoutMs;
}

export function __getPendingRequestCountForTests(): number {
  return _pendingRequests.size;
}
