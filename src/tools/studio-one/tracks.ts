// ─── Fornix Studio MCP – Studio One: Track Tools ─────────────────────────────

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendCommand, getBridgeStatus } from "../../services/bridge.js";
import { logAction, formatToolResult } from "../../services/logger.js";

function notConnected(action: string): { content: { type: "text"; text: string }[] } {
  return {
    content: [{
      type: "text",
      text: `⚠ Studio One bridge not connected – cannot ${action}.\nUse s1_export_instruction for a file-based fallback.`,
    }],
  };
}

export function registerTrackTools(server: McpServer): void {

  // ── s1_create_track ───────────────────────────────────────────────────────

  server.registerTool("s1_create_track", {
    title: "Create Track",
    description: "Add a new track to the current Studio One song.",
    inputSchema: {
      name: z.string().min(1).max(64).describe("Track name"),
      type: z.enum(["audio", "instrument", "automation", "bus", "folder"])
        .describe("Track type"),
      color: z.string().optional().describe("Hex colour e.g. #FF4400"),
      insertAtPosition: z.number().int().min(0).optional()
        .describe("0-based insert position (omit to append)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ name, type, color, insertAtPosition }) => {
    if (getBridgeStatus() !== "connected") return notConnected(`create track "${name}"`);
    try {
      const res = await sendCommand("createTrack", { name, type, color, insertAtPosition });
      if (!res.ok) throw new Error(res.error);
      const summary = `Created ${type} track: "${name}"`;
      logAction({ tool: "s1_create_track", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_rename_track ───────────────────────────────────────────────────────

  server.registerTool("s1_rename_track", {
    title: "Rename Track",
    description: "Rename an existing track in Studio One by its current name or ID.",
    inputSchema: {
      trackId: z.string().optional().describe("Track ID (preferred)"),
      currentName: z.string().optional().describe("Current track name (used if no ID)"),
      newName: z.string().min(1).max(64).describe("New track name"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ trackId, currentName, newName }) => {
    if (!trackId && !currentName) {
      return { content: [{ type: "text", text: "✗ Provide trackId or currentName" }], isError: true };
    }
    if (getBridgeStatus() !== "connected") return notConnected(`rename track to "${newName}"`);
    try {
      const res = await sendCommand("renameTrack", { trackId, currentName, newName });
      if (!res.ok) throw new Error(res.error);
      const summary = `Renamed track to "${newName}"`;
      logAction({ tool: "s1_rename_track", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_mute_track ─────────────────────────────────────────────────────────

  server.registerTool("s1_mute_track", {
    title: "Mute / Unmute Track",
    description: "Mute or unmute a Studio One track.",
    inputSchema: {
      trackId: z.string().optional(),
      trackName: z.string().optional(),
      muted: z.boolean().describe("true = mute, false = unmute"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async ({ trackId, trackName, muted }) => {
    if (!trackId && !trackName) {
      return { content: [{ type: "text", text: "✗ Provide trackId or trackName" }], isError: true };
    }
    if (getBridgeStatus() !== "connected") return notConnected(`${muted ? "mute" : "unmute"} track`);
    try {
      const res = await sendCommand("setTrackMute", { trackId, trackName, muted });
      if (!res.ok) throw new Error(res.error);
      const label = trackName ?? trackId ?? "track";
      const summary = `${muted ? "Muted" : "Unmuted"} "${label}"`;
      logAction({ tool: "s1_mute_track", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_solo_track ─────────────────────────────────────────────────────────

  server.registerTool("s1_solo_track", {
    title: "Solo / Unsolo Track",
    description: "Toggle solo on a Studio One track.",
    inputSchema: {
      trackId: z.string().optional(),
      trackName: z.string().optional(),
      soloed: z.boolean(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async ({ trackId, trackName, soloed }) => {
    if (!trackId && !trackName) {
      return { content: [{ type: "text", text: "✗ Provide trackId or trackName" }], isError: true };
    }
    if (getBridgeStatus() !== "connected") return notConnected(`${soloed ? "solo" : "unsolo"} track`);
    try {
      const res = await sendCommand("setTrackSolo", { trackId, trackName, soloed });
      if (!res.ok) throw new Error(res.error);
      const label = trackName ?? trackId ?? "track";
      const summary = `${soloed ? "Soloed" : "Unsoloed"} "${label}"`;
      logAction({ tool: "s1_solo_track", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_set_track_volume ───────────────────────────────────────────────────

  server.registerTool("s1_set_track_volume", {
    title: "Set Track Volume",
    description: "Set a track's fader volume in dB.",
    inputSchema: {
      trackId: z.string().optional(),
      trackName: z.string().optional(),
      volumeDb: z.number().min(-144).max(6).describe("Volume in dB (0 = unity, -144 = silence)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async ({ trackId, trackName, volumeDb }) => {
    if (!trackId && !trackName) {
      return { content: [{ type: "text", text: "✗ Provide trackId or trackName" }], isError: true };
    }
    if (getBridgeStatus() !== "connected") return notConnected("set volume");
    try {
      const res = await sendCommand("setTrackVolume", { trackId, trackName, volumeDb });
      if (!res.ok) throw new Error(res.error);
      const label = trackName ?? trackId ?? "track";
      const summary = `Set "${label}" volume to ${volumeDb} dB`;
      logAction({ tool: "s1_set_track_volume", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_create_send ────────────────────────────────────────────────────────

  server.registerTool("s1_create_send", {
    title: "Create FX Send",
    description: "Add an FX send from a track to a bus or FX channel.",
    inputSchema: {
      fromTrackName: z.string().describe("Source track name"),
      toBusName: z.string().describe("Target bus or FX channel name"),
      sendLevelDb: z.number().min(-144).max(6).default(0).describe("Send level in dB"),
      preFader: z.boolean().default(false).describe("Pre-fader send?"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ fromTrackName, toBusName, sendLevelDb, preFader }) => {
    if (getBridgeStatus() !== "connected") return notConnected(`create send "${fromTrackName}" → "${toBusName}"`);
    try {
      const res = await sendCommand("createSend", { fromTrackName, toBusName, sendLevelDb, preFader });
      if (!res.ok) throw new Error(res.error);
      const summary = `Send created: "${fromTrackName}" → "${toBusName}" @ ${sendLevelDb} dB${preFader ? " (pre-fader)" : ""}`;
      logAction({ tool: "s1_create_send", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });
}
