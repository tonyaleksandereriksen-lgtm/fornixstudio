
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
  checkWorkspaceConsistency,
  createWorkspace,
  createWorkspaceFromTemplate,
  generateWorkspacePackages,
  getWorkspaceSummary,
  removeTrackFromWorkspace,
  updateWorkspaceDefaults,
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

  // ── fornix_generate_workspace_packages ─────────────────────────────────────
  server.registerTool("fornix_generate_workspace_packages", {
    title: "Generate Workspace Packages",
    description:
      "Generate production packages for all tracks in a workspace. Each track's package inherits workspace defaults " +
      "with per-track overrides applied. Tracks already generated are skipped unless regenerate is true.",
    inputSchema: {
      outputDir: z.string().describe("Directory containing workspace.json"),
      regenerate: z.boolean().default(false).describe("Re-generate packages for tracks that already have one"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async (rawInput) => {
    try {
      const resolvedDir = guardPath(rawInput.outputDir);
      const result = generateWorkspacePackages(resolvedDir, { regenerate: rawInput.regenerate });

      const summary =
        `Generated ${result.generated.length} packages for workspace "${result.workspaceName}"` +
        (result.alreadyGenerated.length > 0 ? ` (${result.alreadyGenerated.length} already generated)` : "") +
        (result.skipped.length > 0 ? ` (${result.skipped.length} skipped)` : "");

      logAction({ tool: "fornix_generate_workspace_packages", action: "write", target: resolvedDir, summary, dryRun: false, ok: true });

      return {
        content: [{
          type: "text" as const,
          text: formatToolResult(true, summary, {
            workspaceName: result.workspaceName,
            generated: result.generated,
            alreadyGenerated: result.alreadyGenerated,
            skipped: result.skipped,
          }),
        }],
      };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "fornix_generate_workspace_packages", action: "write", summary: err, dryRun: false, ok: false, error: err });
      return { content: [{ type: "text" as const, text: `✗ ${err}` }], isError: true };
    }
  });

  // ── fornix_create_workspace_from_template ──────────────────────────────────
  server.registerTool("fornix_create_workspace_from_template", {
    title: "Create Workspace from Template",
    description:
      "Create a new workspace pre-populated with style defaults from a production template. " +
      "Use fornix_list_templates to see available template IDs.",
    inputSchema: {
      outputDir: z.string().describe("Base output directory for the workspace"),
      name: z.string().min(1).describe("Workspace / EP / album name"),
      templateId: z.string().min(1).describe("Template ID (e.g. 'rawphoric-banger', 'cinematic-euphoric-epic')"),
      artistName: z.string().default("Fornix").describe("Artist name"),
      bpmRange: bpmRangeSchema.optional().describe("Optional BPM range constraint"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async (rawInput) => {
    try {
      const resolvedDir = guardPath(rawInput.outputDir);

      const workspace = createWorkspaceFromTemplate({
        outputDir: resolvedDir,
        name: rawInput.name,
        templateId: rawInput.templateId,
        artistName: rawInput.artistName,
        bpmRange: rawInput.bpmRange,
      });

      const defaultCount = Object.keys(workspace.defaults).filter(
        (k) => (workspace.defaults as Record<string, unknown>)[k] !== undefined,
      ).length;

      const summary = `Workspace "${workspace.name}" created from template "${rawInput.templateId}"`;
      logAction({ tool: "fornix_create_workspace_from_template", action: "write", target: resolvedDir, summary, dryRun: false, ok: true });

      return {
        content: [{
          type: "text" as const,
          text: formatToolResult(true, summary, {
            name: workspace.name,
            templateId: rawInput.templateId,
            artistName: workspace.artistName,
            bpmRange: workspace.bpmRange ?? null,
            defaultsSet: defaultCount,
            path: `${resolvedDir}/workspace.json`,
          }),
        }],
      };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "fornix_create_workspace_from_template", action: "write", summary: err, dryRun: false, ok: false, error: err });
      return { content: [{ type: "text" as const, text: `✗ ${err}` }], isError: true };
    }
  });

  // ── fornix_check_workspace_consistency ──────────────────────────────────────
  server.registerTool("fornix_check_workspace_consistency", {
    title: "Check Workspace Consistency",
    description:
      "Compare generated packages against workspace defaults and track overrides. " +
      "Reports drift between what the workspace expects and what each package actually contains.",
    inputSchema: {
      outputDir: z.string().describe("Directory containing workspace.json"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (rawInput) => {
    try {
      const resolvedDir = guardPath(rawInput.outputDir);
      const result = checkWorkspaceConsistency(resolvedDir);

      const lines: string[] = [
        `Workspace: ${result.workspaceName}`,
        `Tracks checked: ${result.tracksChecked}`,
        `With packages: ${result.tracksWithPackage}`,
      ];

      if (result.tracksMissingPackage.length > 0) {
        lines.push(`Missing packages: ${result.tracksMissingPackage.join(", ")}`);
      }

      if (result.issues.length > 0) {
        lines.push("");
        lines.push("Issues:");
        for (const issue of result.issues) {
          const icon = issue.severity === "error" ? "[ERROR]" : "[WARN]";
          lines.push(`  ${icon} ${issue.trackName}: ${issue.field} — expected ${JSON.stringify(issue.expected)}, got ${JSON.stringify(issue.actual)}`);
        }
      }

      const status = result.consistent ? "consistent" : `${result.issues.length} issues found`;
      const summary = `Workspace "${result.workspaceName}" — ${status}`;
      logAction({ tool: "fornix_check_workspace_consistency", action: "read", target: resolvedDir, summary, dryRun: false, ok: true });

      return {
        content: [{
          type: "text" as const,
          text: formatToolResult(true, summary, lines.join("\n")),
        }],
      };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "fornix_check_workspace_consistency", action: "read", summary: err, dryRun: false, ok: false, error: err });
      return { content: [{ type: "text" as const, text: `✗ ${err}` }], isError: true };
    }
  });

  // ── fornix_remove_track_from_workspace ─────────────────────────────────────
  server.registerTool("fornix_remove_track_from_workspace", {
    title: "Remove Track from Workspace",
    description:
      "Remove a track from the workspace by its slug. Optionally deletes the track's generated package directory.",
    inputSchema: {
      outputDir: z.string().describe("Directory containing workspace.json"),
      trackSlug: z.string().min(1).describe("Track slug to remove (as shown in workspace summary)"),
      cleanPackage: z.boolean().default(false).describe("Also delete the track's generated package files"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  }, async (rawInput) => {
    try {
      const resolvedDir = guardPath(rawInput.outputDir);
      const result = removeTrackFromWorkspace(resolvedDir, rawInput.trackSlug, {
        cleanPackage: rawInput.cleanPackage,
      });

      const summary = `Track "${result.removedTrack.trackName}" removed from workspace "${result.workspace.name}"`;
      logAction({ tool: "fornix_remove_track_from_workspace", action: "write", target: resolvedDir, summary, dryRun: false, ok: true });

      return {
        content: [{
          type: "text" as const,
          text: formatToolResult(true, summary, {
            removedTrack: result.removedTrack.trackName,
            removedSlug: result.removedTrack.trackSlug,
            packageCleaned: result.packageCleaned,
            remainingTracks: result.workspace.tracks.length,
          }),
        }],
      };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "fornix_remove_track_from_workspace", action: "write", summary: err, dryRun: false, ok: false, error: err });
      return { content: [{ type: "text" as const, text: `✗ ${err}` }], isError: true };
    }
  });

  // ── fornix_update_workspace_defaults ───────────────────────────────────────
  server.registerTool("fornix_update_workspace_defaults", {
    title: "Update Workspace Defaults",
    description:
      "Update the shared style defaults for an existing workspace. " +
      "By default merges with existing defaults (only specified fields change). " +
      "Set merge=false to replace all defaults entirely. " +
      "After updating, use fornix_check_workspace_consistency to detect drift against generated packages.",
    inputSchema: {
      outputDir: z.string().describe("Directory containing workspace.json"),
      defaults: styleDefaultsSchema.describe("Style defaults to set or merge"),
      merge: z.boolean().default(true).describe("true = merge with existing defaults; false = replace entirely"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async (rawInput) => {
    try {
      const resolvedDir = guardPath(rawInput.outputDir);
      const result = updateWorkspaceDefaults(
        resolvedDir,
        (rawInput.defaults ?? {}) as Partial<WorkspaceStyleDefaults>,
        { merge: rawInput.merge },
      );

      const parts: string[] = [];
      if (result.updatedFields.length > 0) {
        parts.push(`Updated: ${result.updatedFields.join(", ")}`);
      }
      if (result.removedFields.length > 0) {
        parts.push(`Removed: ${result.removedFields.join(", ")}`);
      }
      if (parts.length === 0) {
        parts.push("No changes detected");
      }

      const summary = `Workspace "${result.workspace.name}" defaults updated (${rawInput.merge ? "merge" : "replace"})`;
      logAction({ tool: "fornix_update_workspace_defaults", action: "write", target: resolvedDir, summary, dryRun: false, ok: true });

      return {
        content: [{
          type: "text" as const,
          text: formatToolResult(true, summary, {
            mode: rawInput.merge ? "merge" : "replace",
            updatedFields: result.updatedFields,
            removedFields: result.removedFields,
            totalDefaults: Object.keys(result.workspace.defaults).filter(
              (k) => (result.workspace.defaults as Record<string, unknown>)[k] !== undefined,
            ).length,
          }),
        }],
      };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "fornix_update_workspace_defaults", action: "write", summary: err, dryRun: false, ok: false, error: err });
      return { content: [{ type: "text" as const, text: `✗ ${err}` }], isError: true };
    }
  });
}
