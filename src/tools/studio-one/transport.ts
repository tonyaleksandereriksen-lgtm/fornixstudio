// ─── Fornix Studio MCP – Studio One: Transport + Song Tools ──────────────────
//
// Category A (Officially supported via S1 Extensions WebSocket bridge):
//   get_transport_state, set_tempo, set_loop_range, query_song_metadata
//
// Category B (Indirect via file-based fallback when bridge unavailable):
//   All of the above degrade gracefully to s1_export_instruction

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendCommand, getBridgeStatus } from "../../services/bridge.js";
import { logAction, formatToolResult } from "../../services/logger.js";

function bridgeUnavailableMsg(action: string): string {
  return (
    `⚠ Studio One bridge not connected – cannot ${action} directly.\n` +
    `Use s1_export_instruction to generate a manual instruction file instead.\n` +
    `Or start Studio One with the Fornix Extension and reconnect.`
  );
}

export function registerTransportTools(server: McpServer): void {

  // ── s1_get_transport_state ────────────────────────────────────────────────

  server.registerTool("s1_get_transport_state", {
    title: "Get Transport State",
    description: "Get current Studio One transport state: play position, tempo, time signature, loop range.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => {
    if (getBridgeStatus() !== "connected") {
      return { content: [{ type: "text", text: bridgeUnavailableMsg("read transport") }] };
    }
    try {
      const res = await sendCommand("getTransportState");
      if (!res.ok) throw new Error(res.error ?? "Unknown bridge error");
      return { content: [{ type: "text", text: formatToolResult(true, "Transport state", res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_set_tempo ─────────────────────────────────────────────────────────

  server.registerTool("s1_set_tempo", {
    title: "Set Tempo",
    description: "Set Studio One song tempo in BPM.",
    inputSchema: {
      bpm: z.number().min(20).max(300).describe("Tempo in BPM (20–300)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async ({ bpm }) => {
    if (getBridgeStatus() !== "connected") {
      return { content: [{ type: "text", text: bridgeUnavailableMsg(`set tempo to ${bpm} BPM`) }] };
    }
    try {
      const res = await sendCommand("setTempo", { bpm });
      if (!res.ok) throw new Error(res.error ?? "Unknown bridge error");
      const summary = `Tempo set to ${bpm} BPM`;
      logAction({ tool: "s1_set_tempo", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "s1_set_tempo", action: "s1_bridge", summary: err, dryRun: false, ok: false, error: err });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });

  // ── s1_set_loop_range ─────────────────────────────────────────────────────

  server.registerTool("s1_set_loop_range", {
    title: "Set Loop Range",
    description: "Set Studio One loop start and end in bars.",
    inputSchema: {
      startBar: z.number().int().min(1).describe("Loop start bar (1-based)"),
      endBar: z.number().int().min(2).describe("Loop end bar (must be > startBar)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ startBar, endBar }) => {
    if (endBar <= startBar) {
      return { content: [{ type: "text", text: "✗ endBar must be greater than startBar" }], isError: true };
    }
    if (getBridgeStatus() !== "connected") {
      return { content: [{ type: "text", text: bridgeUnavailableMsg(`set loop bars ${startBar}–${endBar}`) }] };
    }
    try {
      const res = await sendCommand("setLoopRange", { startBar, endBar });
      if (!res.ok) throw new Error(res.error ?? "Unknown bridge error");
      const summary = `Loop set: bars ${startBar}–${endBar}`;
      logAction({ tool: "s1_set_loop_range", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_query_song_metadata ────────────────────────────────────────────────

  server.registerTool("s1_query_song_metadata", {
    title: "Query Song Metadata",
    description: "Get song title, tempo, time sig, sample rate, and full track list from Studio One.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => {
    if (getBridgeStatus() !== "connected") {
      return { content: [{ type: "text", text: bridgeUnavailableMsg("query song metadata") }] };
    }
    try {
      const res = await sendCommand("getSongMetadata");
      if (!res.ok) throw new Error(res.error ?? "Unknown bridge error");
      return { content: [{ type: "text", text: formatToolResult(true, "Song metadata", res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_bridge_status ──────────────────────────────────────────────────────

  server.registerTool("s1_bridge_status", {
    title: "Studio One Bridge Status",
    description: "Check whether the Studio One WebSocket bridge is connected.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => {
    const status = getBridgeStatus();
    const msg =
      status === "connected"
        ? "✓ Studio One bridge is connected. Live DAW control is available."
        : `⚠ Studio One bridge status: ${status}.\n` +
          "Ensure Studio One is open and the Fornix Extension is running.\n" +
          "File-based fallback tools (s1_export_instruction) are always available.";
    return { content: [{ type: "text", text: msg }] };
  });
}
