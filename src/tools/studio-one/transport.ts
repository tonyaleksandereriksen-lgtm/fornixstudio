// ─── Fornix Studio MCP – Studio One: Transport + Song Tools ──────────────────
//
// Live transport control routes through the optional experimental Studio One bridge.
// A socket connection alone is not treated as verified. The bridge must complete
// a runtime probe handshake before live commands are allowed.

import fs from "fs";
import os from "os";
import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getBridgeRuntimeStatus,
  getBridgeStatus,
  hasBridgeCapability,
  isBridgeReady,
  sendCommand,
} from "../../services/bridge.js";
import { logAction, formatToolResult } from "../../services/logger.js";
import { tryParseSongFile } from "../../services/song-file.js";
import { guardPath } from "../../services/workspace.js";
import type { S1BridgeCapabilities } from "../../types.js";

function bridgeUnavailableMsg(action: string): string {
  const runtime = getBridgeRuntimeStatus();
  const hint =
    runtime.state === "disconnected" || runtime.state === "error"
      ? "Ensure Studio One is open and the experimental extension is actually running."
      : "The socket may be open, but the runtime probe handshake is not complete.";

  return (
    `⚠ Studio One bridge is not ready – cannot ${action} directly.\n` +
    `State: ${runtime.state}; handshakeOk=${runtime.handshakeOk ? "true" : "false"}.\n` +
    `${hint}\n\n` +
    "File-based alternatives (no bridge needed):\n" +
    "  - session_kickstart with outputDir — generates full session plan + instructions\n" +
    "  - s1_export_instruction — write any DAW command as a JSON instruction file\n" +
    "  - s1_generate_track_plan — create a complete track setup document\n" +
    "  - s1_generate_bus_template — generate Fornix bus routing template\n" +
    "  - fornix_generate_production_package — full production package docs"
  );
}

function capabilityMissingMsg(action: string, capability: keyof S1BridgeCapabilities): string {
  const runtime = getBridgeRuntimeStatus();
  return (
    `⚠ CAPABILITY_MISSING – cannot ${action} because the bridge did not report "${capability}" support.\n` +
    `State: ${runtime.state}; handshakeOk=${runtime.handshakeOk ? "true" : "false"}.\n` +
    "Do not assume native Studio One support from a bare socket connection. Use fallback tools instead."
  );
}

function requireBridge(action: string, capabilities: Array<keyof S1BridgeCapabilities> = []): string | null {
  if (!isBridgeReady()) {
    return bridgeUnavailableMsg(action);
  }

  for (const capability of capabilities) {
    if (!hasBridgeCapability(capability)) {
      return capabilityMissingMsg(action, capability);
    }
  }

  return null;
}

function requireBridgeWrite(action: string, capabilities: Array<keyof S1BridgeCapabilities> = []): string | null {
  const unavailable = requireBridge(action, capabilities);
  if (unavailable) {
    return unavailable;
  }

  const runtime = getBridgeRuntimeStatus();
  if (!runtime.proof.liveReadVerified) {
    return (
      `⚠ Live Studio One WRITE is still gated — cannot ${action} yet.\n` +
      `Handshake is complete, but no live read has been verified in this MCP process.\n` +
      `Run s1_get_transport_state or s1_query_song_metadata first, confirm the values in Studio One, then retry the write.\n` +
      `Next required state: ${runtime.proof.nextRequiredState ?? "live_read_verified"}.`
    );
  }

  return null;
}

function runtimeSummary() {
  return getBridgeRuntimeStatus();
}

export function registerTransportTools(server: McpServer): void {
  server.registerTool("s1_probe_runtime", {
    title: "Probe Studio One Runtime",
    description:
      "Return bridge connection state, lifecyclePhase (socket vs handshake vs live verified), handshake timestamps, capabilities, and errors. " +
      "Does not prove Studio One ran without matching extension logs and a successful live read/write in the DAW.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => {
    const runtime = runtimeSummary();
    const summary =
      runtime.proof.runtimeVerified
        ? "Studio One bridge runtime is verified in this MCP process."
        : `Studio One bridge is not fully runtime-verified yet. Next required state: ${runtime.proof.nextRequiredState ?? "none"}.`;

    return { content: [{ type: "text", text: formatToolResult(true, summary, runtime) }] };
  });

  server.registerTool("s1_get_runtime_capabilities", {
    title: "Get Studio One Runtime Capabilities",
    description: "Return the last capability map reported by the Studio One bridge handshake, if any.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => {
    const runtime = getBridgeRuntimeStatus();
    if (!runtime.handshakeOk || !runtime.capabilities) {
      return {
        content: [{
          type: "text",
          text:
            "⚠ Studio One capabilities are not available yet. " +
            "The bridge is disconnected, unverified, or the handshake has not completed.",
        }],
      };
    }

    return {
      content: [{
        type: "text",
        text: formatToolResult(true, "Studio One runtime capabilities", runtime.capabilities),
      }],
    };
  });

  // ── s1_get_transport_state ────────────────────────────────────────────────

  server.registerTool("s1_get_transport_state", {
    title: "Get Transport State",
    description:
      "Get current Studio One transport state: play position, tempo, time signature, loop range. " +
      "When the bridge is unavailable, provide a songFilePath to read tempo and time sig from a .song file.",
    inputSchema: {
      songFilePath: z.string().optional().describe("Path to .song file (used when bridge is unavailable)"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ songFilePath }) => {
    // Try live bridge first
    if (isBridgeReady() && hasBridgeCapability("transport") && hasBridgeCapability("song")) {
      try {
        const res = await sendCommand("getTransportState");
        if (res.ok) {
          return { content: [{ type: "text", text: formatToolResult(true, "Transport state (live)", res.data) }] };
        }
      } catch { /* fall through to file-based */ }
    }

    // File-based fallback
    if (songFilePath) {
      try {
        guardPath(songFilePath);
        const result = tryParseSongFile(songFilePath);
        const lines = [
          `═══ Transport State (from .song file) ═══`,
          `Song: ${path.basename(songFilePath, ".song")}`,
          `Tempo: ${result.tempo ?? "unknown"} BPM`,
          `Time Signature: ${result.timeSignature ?? "4/4"}`,
          `Tracks: ${result.tracks.length}`,
          `Markers: ${result.markers.length}`,
          "",
          "Note: Play position and loop range are only available via live bridge.",
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (e) {
        return { content: [{ type: "text", text: `✗ Could not read song file: ${e}` }], isError: true };
      }
    }

    return { content: [{ type: "text", text: bridgeUnavailableMsg("read transport") }] };
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
    const unavailable = requireBridgeWrite(`set tempo to ${bpm} BPM`, ["transport", "song"]);
    if (unavailable) {
      return { content: [{ type: "text", text: unavailable }] };
    }

    try {
      const res = await sendCommand("setTempo", { bpm });
      if (!res.ok) {
        throw new Error(res.errorMessage ?? res.error ?? "Unknown bridge error");
      }

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

    const unavailable = requireBridgeWrite(`set loop bars ${startBar}–${endBar}`, ["transport", "song"]);
    if (unavailable) {
      return { content: [{ type: "text", text: unavailable }] };
    }

    try {
      const res = await sendCommand("setLoopRange", { startBar, endBar });
      if (!res.ok) {
        throw new Error(res.errorMessage ?? res.error ?? "Unknown bridge error");
      }

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
    description:
      "Get song title, tempo, time sig, sample rate, and full track list from Studio One. " +
      "When the bridge is unavailable, provide a songFilePath to read directly from a .song file.",
    inputSchema: {
      songFilePath: z.string().optional().describe("Path to .song file (used when bridge is unavailable)"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ songFilePath }) => {
    // Try live bridge first
    if (isBridgeReady() && hasBridgeCapability("song")) {
      try {
        const res = await sendCommand("getSongMetadata");
        if (res.ok) {
          return { content: [{ type: "text", text: formatToolResult(true, "Song metadata (live)", res.data) }] };
        }
      } catch { /* fall through to file-based */ }
    }

    // File-based fallback
    if (songFilePath) {
      try {
        guardPath(songFilePath);
        const result = tryParseSongFile(songFilePath);
        const title = path.basename(songFilePath, ".song");
        const folders = result.tracks.filter(t => t.type === "folder");
        const audio = result.tracks.filter(t => t.type === "audio");
        const instruments = result.tracks.filter(t => t.type === "instrument");

        const lines = [
          `═══ Song Metadata (from .song file) ═══`,
          `Title: ${title}`,
          `Tempo: ${result.tempo ?? "unknown"} BPM`,
          `Time Signature: ${result.timeSignature ?? "4/4"}`,
          `Tracks: ${result.tracks.length} total (${instruments.length} instrument, ${audio.length} audio, ${folders.length} folder/bus)`,
          "",
        ];

        if (folders.length > 0) {
          lines.push("Bus/Groups:", ...folders.map(f => `  - ${f.name}`), "");
        }

        if (result.markers.length > 0) {
          lines.push("Markers:", ...result.markers.map(m => `  - ${m.name} @ bar ${m.positionBars}`), "");
        }

        lines.push(`Parse notes: ${result.parseNotes.join("; ")}`);

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (e) {
        return { content: [{ type: "text", text: `✗ Could not read song file: ${e}` }], isError: true };
      }
    }

    return { content: [{ type: "text", text: bridgeUnavailableMsg("query song metadata") }] };
  });

  // ── s1_bridge_status ──────────────────────────────────────────────────────

  server.registerTool("s1_bridge_status", {
    title: "Studio One Bridge Status",
    description: "Check whether the optional experimental Studio One bridge has completed its runtime handshake.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => {
    const runtime = getBridgeRuntimeStatus();
    const msg =
      isBridgeReady()
        ? "✓ Studio One bridge handshake completed. Live DAW control is available only for reported capabilities."
        : `⚠ Studio One bridge status: ${getBridgeStatus()}. Handshake complete: ${runtime.handshakeOk ? "yes" : "no"}.\n` +
          "A socket connection alone does not verify Studio One control.\n" +
          "File-based fallback tools (s1_export_instruction) remain available.";

    return { content: [{ type: "text", text: msg }] };
  });

  // ── s1_read_extension_log ─────────────────────────────────────────────────
  //
  // Reads startup marker files written by studio-one-extension/main.js during
  // activate(). These files are the only externally-observable proof that
  // Studio One actually executed the extension. This tool works even when the
  // WebSocket bridge is not connected.

  server.registerTool("s1_read_extension_log", {
    title: "Read Extension Startup Logs",
    description:
      "Read Studio One extension startup marker files from Documents/FornixMCP/logs/. " +
      "These files are written by the extension when Studio One loads it, independently of the WebSocket bridge. " +
      "Use this to determine whether Studio One has ever executed the extension.",
    inputSchema: {
      logsDir: z.string().optional()
        .describe("Override the default logs directory (Documents/FornixMCP/logs). Optional."),
      maxEntries: z.number().int().min(1).max(20).default(5)
        .describe("Maximum number of log entries to return (most recent first)"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ logsDir, maxEntries }) => {
    const defaultLogsDir = path.join(os.homedir(), "Documents", "FornixMCP", "logs");
    const targetDir = logsDir ?? defaultLogsDir;

    if (!fs.existsSync(targetDir)) {
      return {
        content: [{
          type: "text",
          text:
            `⚠ Extension log directory not found: ${targetDir}\n\n` +
            "This means the Studio One extension has never successfully written a startup marker.\n" +
            "Possible causes:\n" +
            "  1. The extension has not been installed in Studio One's extension/scripts directory.\n" +
            "  2. Studio One has not been opened since the extension was installed.\n" +
            "  3. Host.FileSystem.writeFile is not available in this Studio One version.\n" +
            "  4. Host.getDocumentsPath() returned a different path than expected.\n\n" +
            "Expected log path: " + defaultLogsDir,
        }],
      };
    }

    let files: string[];
    try {
      files = fs.readdirSync(targetDir).filter(
        (f) => f.startsWith("startup-") || f.startsWith("shutdown-"),
      );
    } catch (e) {
      return { content: [{ type: "text", text: `✗ Could not read log directory: ${e}` }], isError: true };
    }

    if (!files.length) {
      return {
        content: [{
          type: "text",
          text:
            `⚠ Log directory exists at ${targetDir} but contains no startup/shutdown markers.\n` +
            "The extension may have run but Host.FileSystem.writeFile was unavailable.\n" +
            "Check Studio One's script console for [FornixMCPBridge] log lines.",
        }],
      };
    }

    // Sort by embedded timestamp (filename contains Unix ms timestamp), newest first
    const sorted = files
      .map((f) => {
        const match = f.match(/(\d{10,})/);
        return { name: f, ts: match ? parseInt(match[1], 10) : 0 };
      })
      .sort((a, b) => b.ts - a.ts)
      .slice(0, maxEntries);

    const entries = sorted.map(({ name }) => {
      const filePath = path.join(targetDir, name);
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        return { file: name, content: JSON.parse(raw) };
      } catch {
        return { file: name, content: null, parseError: true };
      }
    });

    const startupCount = entries.filter((e) => e.file.startsWith("startup-")).length;
    const summary =
      `✓ Found ${files.length} extension log file(s) in ${targetDir}.\n` +
      `Showing ${entries.length} most recent (${startupCount} startup marker(s)).\n` +
      "The extension HAS been observed executing inside Studio One.\n\n" +
      "Check 'host.websocketServer' in the startup entries to see whether " +
      "Host.WebSocket.createServer was available when the extension ran.";

    return {
      content: [{
        type: "text",
        text: formatToolResult(true, summary, { logsDir: targetDir, totalFiles: files.length, entries }),
      }],
    };
  });
}
