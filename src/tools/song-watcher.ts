// ─── Fornix Studio MCP – Song Watcher Tools ──────────────────────────────────
//
// MCP tools for the file-based session listener.
// These tools let the AI monitor a Studio One session without requiring
// the user to leave S1 or manually specify file paths.

import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  startWatching,
  stopWatching,
  getWatcherStatus,
  getCurrentSnapshot,
  getLastDiff,
} from "../services/song-watcher.js";
import { guardPath } from "../services/workspace.js";
import { logAction, formatToolResult, truncate } from "../services/logger.js";
import { buildArrangementSummary, analyzeArrangement } from "../services/arrangement.js";

export function registerSongWatcherTools(server: McpServer): void {

  // ── s1_watch_session ────────────────────────────────────────────────────────

  server.registerTool("s1_watch_session", {
    title: "Watch Studio One Session",
    description:
      "Start monitoring a Studio One project directory or .song file for changes. " +
      "The watcher detects saves automatically and maintains a live snapshot of " +
      "tempo, tracks, markers, and arrangement. Use s1_session_snapshot to read " +
      "the latest state without specifying file paths. " +
      "Provide either a directory (watches all .song files) or a direct .song file path.",
    inputSchema: {
      path: z.string().describe(
        "Directory containing .song files, or direct path to a .song file. " +
        "Example: C:/Users/you/Documents/Studio One/Songs/MyTrack"
      ),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ path: inputPath }) => {
    try {
      const abs = guardPath(inputPath);
      const result = startWatching(abs);

      if (!result.ok) {
        return { content: [{ type: "text", text: `✗ ${result.message}` }], isError: true };
      }

      const status = getWatcherStatus();
      const snap = getCurrentSnapshot();

      let details = `Watcher active on: ${status.watchPath}`;
      if (snap) {
        const r = snap.result;
        details += `\n\nInitial snapshot (${path.basename(snap.filePath)}):\n` +
          `  Format: ${r.format}\n` +
          `  Tempo: ${r.tempo ?? "unknown"} BPM\n` +
          `  Time Signature: ${r.timeSignature ?? "unknown"}\n` +
          `  Tracks: ${r.tracks.length}\n` +
          `  Markers: ${r.markers.length}\n` +
          `  Regions: ${r.regions.length}`;

        if (r.tracks.length > 0) {
          details += "\n\nTracks:";
          for (const t of r.tracks.slice(0, 20)) {
            details += `\n  ${t.type.padEnd(10)} ${t.name}`;
          }
          if (r.tracks.length > 20) details += `\n  ... and ${r.tracks.length - 20} more`;
        }

        if (r.markers.length > 0) {
          details += "\n\nArrangement markers:";
          for (const m of r.markers) {
            details += `\n  Bar ${String(m.positionBars).padStart(3)} — ${m.name}`;
          }
        }
      }

      details += "\n\nThe watcher will detect saves automatically. Use s1_session_snapshot to check current state.";

      const summary = `Watching ${path.basename(status.watchPath ?? inputPath)}`;
      logAction({ tool: "s1_watch_session", action: "read", target: abs, summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, details) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_session_snapshot ─────────────────────────────────────────────────────

  server.registerTool("s1_session_snapshot", {
    title: "Get Session Snapshot",
    description:
      "Get the latest parsed snapshot of the watched Studio One session. " +
      "Returns tempo, tracks, markers, arrangement, and any changes since the last save. " +
      "Requires s1_watch_session to be active. No file path needed — reads from the watcher cache.",
    inputSchema: {
      includeArrangementAnalysis: z.boolean().default(true)
        .describe("Include hardstyle arrangement analysis with the snapshot"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ includeArrangementAnalysis }) => {
    const status = getWatcherStatus();
    if (!status.active) {
      return {
        content: [{ type: "text", text:
          "⚠ No active watcher. Start one with s1_watch_session first.\n\n" +
          "Example: s1_watch_session with path = your Studio One Songs directory" }],
        isError: true,
      };
    }

    const snap = getCurrentSnapshot();
    if (!snap) {
      return {
        content: [{ type: "text", text: "⚠ Watcher is active but no snapshot available yet. Save your song in Studio One." }],
        isError: true,
      };
    }

    const r = snap.result;
    const lines: string[] = [
      `═══ Session Snapshot ═══`,
      `File: ${path.basename(snap.filePath)}`,
      `Parsed: ${snap.parsedAt}`,
      `Format: ${r.format}`,
      `Saves tracked: ${status.snapshotCount}`,
      "",
      `Tempo: ${r.tempo ?? "?"} BPM`,
      `Time Signature: ${r.timeSignature ?? "?"}`,
      `Tracks: ${r.tracks.length}`,
      `Markers: ${r.markers.length}`,
      `Regions: ${r.regions.length}`,
    ];

    // Tracks
    if (r.tracks.length > 0) {
      lines.push("", "── Tracks ──");
      const byType = new Map<string, string[]>();
      for (const t of r.tracks) {
        const list = byType.get(t.type) ?? [];
        list.push(t.name);
        byType.set(t.type, list);
      }
      for (const [type, names] of byType) {
        lines.push(`  ${type} (${names.length}): ${names.join(", ")}`);
      }
    }

    // Markers
    if (r.markers.length > 0) {
      lines.push("", "── Arrangement ──");
      for (const m of r.markers) {
        lines.push(`  Bar ${String(m.positionBars).padStart(3)} — ${m.name}`);
      }
    }

    // Diff since last save
    const diff = getLastDiff();
    if (diff) {
      lines.push("", "── Changes (last save) ──");
      lines.push(`  ${diff.summary}`);
    }

    // Arrangement analysis
    if (includeArrangementAnalysis && r.markers.length >= 2) {
      try {
        const arrSummary = buildArrangementSummary(r);
        const analysis = analyzeArrangement(arrSummary, {
          genre: "hardstyle",
          targetLengthMinutes: 5.5,
        });

        lines.push("", "── Arrangement Analysis ──");
        lines.push(`  Energy arc: ${analysis.energyArc.verdict}`);

        if (analysis.problems.length > 0) {
          lines.push(`  Issues (${analysis.problems.length}):`);
          for (const p of analysis.problems.slice(0, 5)) {
            lines.push(`    ⚠ [${p.section}] ${p.problem}`);
          }
        } else {
          lines.push("  ✓ No arrangement issues detected");
        }

        if (analysis.actions.length > 0) {
          lines.push(`  Suggestions:`);
          for (const a of analysis.actions.slice(0, 3)) {
            lines.push(`    → [${a.section}] ${a.action}`);
          }
        }
      } catch { /* analysis not critical */ }
    }

    return { content: [{ type: "text", text: truncate(lines.join("\n")) }] };
  });

  // ── s1_session_diff ─────────────────────────────────────────────────────────

  server.registerTool("s1_session_diff", {
    title: "Get Session Changes",
    description:
      "Show what changed between the two most recent saves of the watched .song file. " +
      "Reports track additions/removals, tempo changes, marker changes, etc. " +
      "Requires s1_watch_session to be active with at least 2 saves detected.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => {
    const status = getWatcherStatus();
    if (!status.active) {
      return {
        content: [{ type: "text", text: "⚠ No active watcher. Start one with s1_watch_session first." }],
        isError: true,
      };
    }

    const diff = getLastDiff();
    if (!diff) {
      return {
        content: [{ type: "text", text:
          status.snapshotCount < 2
            ? "⚠ Only 1 snapshot so far — save your song in Studio One to generate a diff."
            : "⚠ No diff available." }],
        isError: true,
      };
    }

    const lines: string[] = [`═══ Session Diff (save #${status.snapshotCount - 1} → #${status.snapshotCount}) ═══`, ""];

    if (diff.tracksAdded.length) {
      lines.push(`Tracks added (${diff.tracksAdded.length}):`);
      for (const t of diff.tracksAdded) lines.push(`  + ${t}`);
    }
    if (diff.tracksRemoved.length) {
      lines.push(`Tracks removed (${diff.tracksRemoved.length}):`);
      for (const t of diff.tracksRemoved) lines.push(`  - ${t}`);
    }
    if (diff.tempoChanged) {
      lines.push(`Tempo changed: ${diff.tempoChanged.from ?? "?"} → ${diff.tempoChanged.to ?? "?"} BPM`);
    }
    if (diff.timeSignatureChanged) {
      lines.push(`Time signature changed: ${diff.timeSignatureChanged.from ?? "?"} → ${diff.timeSignatureChanged.to ?? "?"}`);
    }
    if (diff.markersAdded.length) {
      lines.push(`Markers added (${diff.markersAdded.length}):`);
      for (const m of diff.markersAdded) lines.push(`  + ${m}`);
    }
    if (diff.markersRemoved.length) {
      lines.push(`Markers removed (${diff.markersRemoved.length}):`);
      for (const m of diff.markersRemoved) lines.push(`  - ${m}`);
    }
    if (diff.markersMoved.length) {
      lines.push(`Markers moved (${diff.markersMoved.length}):`);
      for (const m of diff.markersMoved) lines.push(`  ~ ${m.name}: bar ${m.fromBar} → bar ${m.toBar}`);
    }

    if (lines.length === 2) {
      lines.push("No structural changes detected between saves.");
      lines.push("(Waveform edits, plugin changes, and mix moves are not tracked by the .song parser)");
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  });

  // ── s1_stop_watching ────────────────────────────────────────────────────────

  server.registerTool("s1_stop_watching", {
    title: "Stop Session Watcher",
    description: "Stop the active file watcher and clear the session snapshot cache.",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async () => {
    const status = getWatcherStatus();
    if (!status.active) {
      return { content: [{ type: "text", text: "No active watcher to stop." }] };
    }

    const watchedPath = status.watchPath;
    stopWatching();
    logAction({ tool: "s1_stop_watching", action: "read", summary: `Stopped watching ${watchedPath}`, dryRun: false, ok: true });
    return { content: [{ type: "text", text: `✓ Stopped watching ${watchedPath}. Snapshot cache cleared.` }] };
  });
}
