// ─── Fornix Studio MCP – Studio One Bridge ───────────────────────────────────
//
// This service maintains a WebSocket connection to the Studio One JS Extension
// that runs a local ws server on S1_BRIDGE_PORT.
//
// If the bridge is unavailable, all commands return a structured error with
// a fallback suggestion so Claude can propose a manual workaround.

import { WebSocket } from "ws";
import { S1_BRIDGE_HOST, S1_BRIDGE_PORT, S1_BRIDGE_TIMEOUT_MS } from "../constants.js";
import type { S1Command, S1Response, S1BridgeStatus } from "../types.js";

let _ws: WebSocket | null = null;
let _status: S1BridgeStatus = "disconnected";
let _pendingRequests = new Map<
  string,
  { resolve: (r: S1Response) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
>();
let _reqCounter = 0;

function nextId(): string {
  return `mcp-${++_reqCounter}`;
}

export function getBridgeStatus(): S1BridgeStatus {
  return _status;
}

export async function connectBridge(): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `ws://${S1_BRIDGE_HOST}:${S1_BRIDGE_PORT}`;
    const ws = new WebSocket(url);

    const timeout = setTimeout(() => {
      ws.terminate();
      _status = "error";
      reject(new Error(`Studio One bridge connection timeout (${S1_BRIDGE_TIMEOUT_MS}ms). Is the Studio One Extension running?`));
    }, S1_BRIDGE_TIMEOUT_MS);

    ws.on("open", () => {
      clearTimeout(timeout);
      _ws = ws;
      _status = "connected";
      process.stderr.write("[s1-bridge] Connected to Studio One extension\n");
      resolve();
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as S1Response;
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
      process.stderr.write("[s1-bridge] Disconnected from Studio One extension\n");
      // Reject all pending requests
      for (const [, { reject: rej, timer }] of _pendingRequests) {
        clearTimeout(timer);
        rej(new Error("Studio One bridge disconnected"));
      }
      _pendingRequests.clear();
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      _status = "error";
      reject(err);
    });
  });
}

export async function disconnectBridge(): Promise<void> {
  _ws?.close();
  _ws = null;
  _status = "disconnected";
}

/**
 * Send a command to Studio One and await the response.
 * Throws if the bridge is not connected.
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

  const requestId = nextId();
  const cmd: S1Command = { command, params, requestId };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      _pendingRequests.delete(requestId);
      reject(new Error(`Studio One command "${command}" timed out after ${S1_BRIDGE_TIMEOUT_MS}ms`));
    }, S1_BRIDGE_TIMEOUT_MS);

    _pendingRequests.set(requestId, { resolve, reject, timer });
    _ws!.send(JSON.stringify(cmd));
  });
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
