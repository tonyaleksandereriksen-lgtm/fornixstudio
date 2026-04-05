
// ─── Fornix Studio MCP – Workspace Profile Tools ────────────────────────────────
//
// Multi-track workspace management: create, summarize, add tracks.
// No live Studio One dependency.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { guardPath } from "../services/workspace.js";
import { logAction, formatToolResult } from "../services/logger.js";
import {
  type WorkspaceStyleDefaults,
  addTrackToWorkspace,
  createWorkspace,
  getWorkspaceSummary,
} from "../services/workspace-profile.js";

// ─── Shared Zod shapes ─────────────────────────────────────────────────────────

const styleVariantSchema = z.enum([
  "cinematic-euphoric",
  "rawphoric",
  "anthemic-euphoric",
  "festival-hardstyle",
]);

const leadStyleSchema = z.enum(["euphoric", "screech", "hybrid"]);

const dropStrategySchema = z.enum([
  "anti-climax-to-melodic",
  "melodic-then-anti-climax",
  "double-anti-climax",
  "festival-main-drop",
]);

const energyProfileSchema = z.enum([
  "patient-cinematic",
  "steady-escalation",
  "front-loaded",
  "late-payoff",
]);

const bpmRangeSchema = z.object({
  min: z.number().int().min(100).max(200),
  max: z.number().int().min(100).max(200),
});

const styleDefaultsShape = {
  styleVariant: styleVariantSchema.optional(),
  leadStyle: leadStyleSchema.optional(),
  dropStrategy: dropStrategySchema.optional(),
  energyProfile: energyProfileSchema.optional(),
  keySignature: z.string().optional(),
  targetBars: z.number().int().min(128).max(256).optional(),
  substyle: z.string().optional(),
  kickStyle: z.string().optional(),
  antiClimaxStyle: z.string().optional(),
  arrangementFocus: z.string().optional(),
  vocalMode: z.string().optional(),
  djUtilityPriority: z.string().optional(),
  cinematicIntensity: z.string().optional(),
  aggressionLevel: z.string().optional(),
  emotionalTone: z.string().optional(),
  mood: z.string().optional(),
  focus: z.string().optional(),
  mixConcerns: z.array(z.string()).optional(),
  referenceNotes: z.array(z.string()).optional(),
  sectionGoals: z.record(z.string()).optional(),
};

const styleDefaultsSchema = z.object(styleDefaultsShape);

// ─── Tool registration ──────────────────────────────────────────────────────────

export function registerWorkspaceProfileTools(server: McpServer): void {

  // ── fornix_create_workspace ───────────────────────────────────────────────
  server.registerTool("fornix_create_workspace", {
    title: "Create Workspace",
    description:
      "Create a new multi-track workspace (workspace.json) with shared style defaults and an optional BPM range. " +
      "All tracks added later inherit these defaults unless overridden.",
    inputSchema: {
      outputDir: z.string().describe("Base output directory for the workspace (inside allowed dirs)"),
      name: z.string().min(1).describe("Workspace / EP / album name"),
      artistName: z.string().default("Fornix").describe("Default artist name for all tracks"),
      bpmRange: bpmRangeSchema.optional().describe("Optional BPM range that track tempos must fall within"),
      defaults: styleDefaultsSchema.optional().describe("Inheritable style defaults shared by all tracks"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async (rawInput) => {
    try {
      const resolvedDir = guardPath(rawInput.outputDir);

      const workspace = createWorkspace({
        outputDir: resolvedDir,
        name: rawInput.name,
        artistName: rawInput.artistName,
        bpmRange: rawInput.bpmRange,
        defaults: (rawInput.defaults ?? {}) as WorkspaceStyleDefaults,
      });

      const defaultCount = Object.keys(workspace.defaults).filter(
        (k) => (workspace.defaults as Record<string, unknown>)[k] !== undefined,
      ).length;

      const summary = `Workspace "${workspace.name}" created at ${resolvedDir}`;
      logAction({ tool: "fornix_create_workspace", action: "write", target: resolvedDir, summary, dryRun: false, ok: true });

      return {
        content: [{
          type: "text" as const,
          text: formatToolResult(true, summary, {
            name: workspace.name,
            artistName: workspace.artistName,
            bpmRange: workspace.bpmRange ?? null,
            defaultsSet: defaultCount,
            path: `${resolvedDir}/workspace.json`,
          }),
        }],
      };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "fornix_create_workspace", action: "write", summary: err, dryRun: false, ok: false, error: err });
      return { content: [{ type: "text" as const, text: `✗ ${err}` }], isError: true };
    }
  });

  // ── fornix_get_workspace_summary ──────────────────────────────────────────
  server.registerTool("fornix_get_workspace_summary", {
    title: "Get Workspace Summary",
    description:
      "Read and summarize an existing workspace: defaults, track list, generation status.",
    inputSchema: {
      outputDir: z.string().describe("Directory containing workspace.json"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (rawInput) => {
    try {
      const resolvedDir = guardPath(rawInput.outputDir);
      const summary = getWorkspaceSummary(resolvedDir);

      const lines: string[] = [
        `Workspace: ${summary.name}`,
        `Artist: ${summary.artistName}`,
      ];

      if (summary.bpmRange) {
        lines.push(`BPM range: ${summary.bpmRange.min}–${summary.bpmRange.max}`);
      }

      lines.push(`Defaults set: ${summary.defaultsSet.join(", ") || "(none)"}`);
      lines.push(`Tracks: ${summary.trackCount} (${summary.generatedCount} generated)`);

      if (summary.tracks.length > 0) {
        lines.push("");
        for (const t of summary.tracks) {
          const gen = t.packageGenerated ? " [generated]" : "";
          const ov = t.overrideCount > 0 ? ` [${t.overrideCount} overrides]` : "";
          lines.push(`  ${t.trackName} (${t.tempo} BPM)${ov}${gen}`);
        }
      }

      logAction({ tool: "fornix_get_workspace_summary", action: "read", target: resolvedDir, summary: `Workspace "${summary.name}" summarized`, dryRun: false, ok: true });

      return {
        content: [{
          type: "text" as const,
          text: formatToolResult(true, `Workspace "${summary.name}"`, lines.join("\n")),
        }],
      };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "fornix_get_workspace_summary", action: "read", summary: err, dryRun: false, ok: false, error: err });
      return { content: [{ type: "text" as const, text: `✗ ${err}` }], isError: true };
    }
  });

  // ── fornix_add_track_to_workspace ─────────────────────────────────────────
  server.registerTool("fornix_add_track_to_workspace", {
    title: "Add Track to Workspace",
    description:
      "Add a track to an existing workspace with per-track tempo, brief, hooks, and optional style overrides. " +
      "Tempo is validated against the workspace BPM range if one is set.",
    inputSchema: {
      outputDir: z.string().describe("Directory containing workspace.json"),
      trackName: z.string().min(1).describe("Track working title"),
      tempo: z.number().int().min(100).max(200).describe("Track tempo (must be within workspace BPM range if set)"),
      creativeBrief: z.string().optional().describe("Short creative brief for this track"),
      signatureHooks: z.array(z.string()).optional().describe("Named hooks or motifs for this track"),
      overrides: styleDefaultsSchema.optional().describe("Style fields that override workspace defaults for this track"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async (rawInput) => {
    try {
      const resolvedDir = guardPath(rawInput.outputDir);

      const { workspace, track } = addTrackToWorkspace({
        outputDir: resolvedDir,
        trackName: rawInput.trackName,
        tempo: rawInput.tempo,
        creativeBrief: rawInput.creativeBrief,
        signatureHooks: rawInput.signatureHooks,
        overrides: (rawInput.overrides ?? undefined) as Partial<WorkspaceStyleDefaults> | undefined,
      });

      const overrideCount = track.overrides ? Object.keys(track.overrides).length : 0;
      const summary = `Track "${track.trackName}" added to workspace "${workspace.name}"`;
      logAction({ tool: "fornix_add_track_to_workspace", action: "write", target: resolvedDir, summary, dryRun: false, ok: true });

      return {
        content: [{
          type: "text" as const,
          text: formatToolResult(true, summary, {
            trackName: track.trackName,
            trackSlug: track.trackSlug,
            tempo: track.tempo,
            overrides: overrideCount,
            totalTracks: workspace.tracks.length,
          }),
        }],
      };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "fornix_add_track_to_workspace", action: "write", summary: err, dryRun: false, ok: false, error: err });
      return { content: [{ type: "text" as const, text: `✗ ${err}` }], isError: true };
    }
  });
}
