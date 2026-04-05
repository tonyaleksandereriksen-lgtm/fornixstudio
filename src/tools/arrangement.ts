// ─── Fornix Studio MCP – Arrangement Analysis Tool ────────────────────────────
//
// POC: reads a .song file from disk, extracts arrangement data,
// and returns actionable consultation. Also accepts manual section input
// as a fallback when the file format is unreadable.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { guardPath } from "../services/workspace.js";
import { logAction, formatToolResult, truncate } from "../services/logger.js";
import { tryParseSongFile } from "../services/song-file.js";
import {
  analyzeArrangement,
  buildArrangementFromManual,
  buildArrangementSummary,
  formatTime,
} from "../services/arrangement.js";

export function registerArrangementAnalysisTools(server: McpServer): void {

  server.registerTool("fornix_analyze_arrangement", {
    title: "Analyze Arrangement",
    description:
      "Read a Studio One .song file (or accept manual section input) and return " +
      "actionable arrangement consultation: section map, energy arc assessment, " +
      "specific problems with bar references, and concrete actions.\n\n" +
      "If the .song file cannot be parsed, the tool returns clear evidence of what " +
      "was found and accepts manualSections as a fallback.",
    inputSchema: {
      songFilePath: z.string().optional()
        .describe("Absolute path to a .song file. Optional if manualSections is provided."),
      manualSections: z.array(z.object({
        name: z.string().min(1),
        lengthBars: z.number().int().min(1),
      })).optional()
        .describe("Fallback: manually describe your arrangement sections and their lengths in bars."),
      tempo: z.number().min(60).max(300).optional()
        .describe("Tempo in BPM. Required for manualSections, optional override for .song file parse."),
      genre: z.string().default("hardstyle")
        .describe("Genre context for analysis (default: hardstyle)"),
      targetLengthMinutes: z.number().min(1).max(15).default(5.5)
        .describe("Target track length in minutes (default: 5.5)"),
      problemDescription: z.string().optional()
        .describe("What the producer is hearing or struggling with — guides the analysis focus."),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (rawInput) => {
    try {
      const { songFilePath, manualSections, tempo, genre, targetLengthMinutes, problemDescription } = rawInput;

      // Validate: need either a file or manual sections
      if (!songFilePath && (!manualSections || manualSections.length === 0)) {
        return {
          content: [{
            type: "text" as const,
            text: "✗ Provide either songFilePath (path to a .song file) or manualSections (array of {name, lengthBars}).",
          }],
          isError: true,
        };
      }

      let analysis;
      let inputMode: string;

      if (manualSections && manualSections.length > 0) {
        // ── Manual sections path ─────────────────────────────────────────
        const effectiveTempo = tempo ?? 150;
        const summary = buildArrangementFromManual(manualSections, effectiveTempo);
        analysis = analyzeArrangement(summary, { genre, targetLengthMinutes, problemDescription });
        inputMode = `Manual input (${manualSections.length} sections, ${effectiveTempo} BPM)`;

      } else {
        // ── Song file path ───────────────────────────────────────────────
        const resolvedPath = guardPath(songFilePath!);
        const songResult = tryParseSongFile(resolvedPath);

        if (songResult.format === "unknown" && songResult.markers.length === 0) {
          // Parse failed completely — return evidence + fallback instructions
          const evidence = [
            `File format: ${songResult.format}`,
            `Parse notes: ${songResult.parseNotes.join("; ")}`,
            `Markers found: ${songResult.markers.length}`,
            `Tracks found: ${songResult.tracks.length}`,
            `Tempo detected: ${songResult.tempo ?? "none"}`,
          ].join("\n");

          const fallbackInstructions = [
            "",
            "═══ Could not extract arrangement data ═══",
            "",
            "The .song file format could not be parsed. This is expected —",
            "Studio One uses a proprietary binary format that varies by version.",
            "",
            "Fallback options:",
            "1. Call this tool again with manualSections instead:",
            '   manualSections: [{ name: "Intro", lengthBars: 16 }, { name: "Breakdown", lengthBars: 16 }, ...]',
            "   tempo: 150",
            "",
            "2. In Studio One, export arrangement markers:",
            "   Song → Export FLP/MIDI → save as .mid — then this tool can read marker data from MIDI",
            "",
            "3. Copy your marker names and bar positions into the manualSections format above.",
          ].join("\n");

          logAction({
            tool: "fornix_analyze_arrangement", action: "read",
            target: resolvedPath, summary: "Song file parse returned unknown format",
            dryRun: false, ok: true,
          });

          return {
            content: [{
              type: "text" as const,
              text: truncate(`${evidence}\n${fallbackInstructions}`),
            }],
          };
        }

        const summary = buildArrangementSummary(songResult, tempo);
        analysis = analyzeArrangement(summary, { genre, targetLengthMinutes, problemDescription });
        inputMode = `Song file (${songResult.format}, ${songResult.parseNotes.length} parse notes)`;
      }

      // ── Format the analysis output ──────────────────────────────────────
      const lines: string[] = [];

      lines.push(`═══ Arrangement Analysis ═══`);
      lines.push(`Input: ${inputMode}`);
      lines.push(`${analysis.parseEvidence}`);
      lines.push("");

      // Section map
      lines.push("── Section Map ──");
      lines.push("Name                  | Bars | Time   | Range      | Flag");
      lines.push("─".repeat(70));
      for (const s of analysis.sectionMap) {
        const name = s.name.padEnd(21).slice(0, 21);
        const bars = String(s.bars).padStart(4);
        const time = formatTime(s.seconds).padStart(6);
        const range = s.barRange.padEnd(10);
        const flag = s.flag === "ok" ? "" : `⚠ ${s.flag}`;
        lines.push(`${name} | ${bars} | ${time} | ${range} | ${flag}`);
      }
      lines.push("");

      // Energy arc
      lines.push("── Energy Arc ──");
      lines.push(`Verdict: ${analysis.energyArc.verdict.toUpperCase()}`);
      lines.push(analysis.energyArc.assessment);
      if (analysis.energyArc.phases.length > 0) {
        lines.push("");
        for (const p of analysis.energyArc.phases) {
          const bar = `[${p.bars}]`.padEnd(12);
          lines.push(`  ${bar} ${p.name} → ${p.energyLevel}`);
        }
      }
      lines.push("");

      // Problems
      if (analysis.problems.length > 0) {
        lines.push("── Problems ──");
        for (const p of analysis.problems.slice(0, 5)) {
          const icon = p.severity === "critical" ? "✗" : p.severity === "warning" ? "⚠" : "ℹ";
          lines.push(`${icon} [bar ${p.bar}] ${p.section}: ${p.problem}`);
        }
        lines.push("");
      }

      // Actions
      if (analysis.actions.length > 0) {
        lines.push("── Actions ──");
        for (const a of analysis.actions.slice(0, 5)) {
          lines.push(`${a.priority}. [bar ${a.targetBar}] ${a.section}: ${a.action}`);
        }
        lines.push("");
      }

      const resultText = truncate(lines.join("\n"));
      const summaryText = `Arrangement analyzed: ${analysis.sectionMap.length} sections, ${analysis.summary.totalLengthBars} bars, ${analysis.energyArc.verdict}`;

      logAction({
        tool: "fornix_analyze_arrangement", action: "read",
        summary: summaryText, dryRun: false, ok: true,
      });

      return {
        content: [{ type: "text" as const, text: resultText }],
      };

    } catch (e) {
      const err = String(e);
      logAction({
        tool: "fornix_analyze_arrangement", action: "read",
        summary: err, dryRun: false, ok: false, error: err,
      });
      return { content: [{ type: "text" as const, text: `✗ ${err}` }], isError: true };
    }
  });
}
