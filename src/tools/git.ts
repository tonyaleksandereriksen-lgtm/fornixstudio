// ─── Fornix Studio MCP – Git Tools ───────────────────────────────────────────

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createCheckpoint,
  listCheckpoints,
  restoreFile,
  revertToCheckpoint,
  getStatus,
  getDiff,
} from "../services/checkpoint.js";
import { logAction, formatToolResult, truncate } from "../services/logger.js";
import { guardPath } from "../services/workspace.js";

export function registerGitTools(server: McpServer): void {

  // ── git_status ───────────────────────────────────────────────────────────

  server.registerTool("git_status", {
    title: "Git Status",
    description: "Show current git branch, modified, staged, and untracked files.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => {
    try {
      const s = await getStatus();
      const lines = [
        `Branch: ${s.branch}`,
        `Clean: ${s.clean}`,
        s.staged.length ? `Staged:\n${s.staged.map(f => `  + ${f}`).join("\n")}` : "",
        s.modified.length ? `Modified:\n${s.modified.map(f => `  ~ ${f}`).join("\n")}` : "",
        s.untracked.length ? `Untracked:\n${s.untracked.map(f => `  ? ${f}`).join("\n")}` : "",
      ].filter(Boolean).join("\n");

      return { content: [{ type: "text", text: truncate(lines) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── git_diff ─────────────────────────────────────────────────────────────

  server.registerTool("git_diff", {
    title: "Git Diff",
    description: "Show unified diff of current changes vs HEAD.",
    inputSchema: {
      path: z.string().optional().describe("Specific file path (omit for all changes)"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ path: p }) => {
    try {
      const abs = p ? guardPath(p) : undefined;
      const diff = await getDiff(abs);
      return { content: [{ type: "text", text: truncate(diff || "No changes vs HEAD") }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── git_commit_checkpoint ────────────────────────────────────────────────

  server.registerTool("git_commit_checkpoint", {
    title: "Create Git Checkpoint",
    description: "Stage all changes and create a labelled MCP checkpoint commit for safe rollback.",
    inputSchema: {
      message: z.string().min(3).describe("Short description of what is being checkpointed"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ message }) => {
    try {
      const hash = await createCheckpoint(message);
      const summary = `Checkpoint created: ${hash.slice(0, 8)} – "${message}"`;
      logAction({ tool: "git_commit_checkpoint", action: "git", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, { hash }) }] };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "git_commit_checkpoint", action: "git", summary: err, dryRun: false, ok: false, error: err });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });

  // ── git_list_checkpoints ─────────────────────────────────────────────────

  server.registerTool("git_list_checkpoints", {
    title: "List MCP Checkpoints",
    description: "List recent MCP checkpoint commits available for rollback.",
    inputSchema: {
      n: z.number().int().min(1).max(50).default(10).describe("Number of checkpoints to show"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ n }) => {
    try {
      const cps = await listCheckpoints(n);
      if (!cps.length) {
        return { content: [{ type: "text", text: "No MCP checkpoints found." }] };
      }
      const lines = cps.map(
        (c) => `${c.hash.slice(0, 8)}  ${c.date}  ${c.message}`
      );
      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── git_restore_file ─────────────────────────────────────────────────────

  server.registerTool("git_restore_file", {
    title: "Restore File from Checkpoint",
    description: "Restore a single file to its state at a given checkpoint hash.",
    inputSchema: {
      path: z.string().describe("File to restore"),
      commitHash: z.string().length(40).describe("Full 40-char commit hash from git_list_checkpoints"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ path: p, commitHash }) => {
    try {
      const abs = guardPath(p);
      await restoreFile(abs, commitHash);
      const summary = `Restored ${abs} from ${commitHash.slice(0, 8)}`;
      logAction({ tool: "git_restore_file", action: "git", target: abs, summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, {}) }] };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "git_restore_file", action: "git", target: p, summary: err, dryRun: false, ok: false, error: err });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });

  // ── git_revert_checkpoint ────────────────────────────────────────────────

  server.registerTool("git_revert_checkpoint", {
    title: "Hard Revert to Checkpoint",
    description: "DESTRUCTIVE: Hard-reset entire workspace to a checkpoint. All uncommitted changes lost.",
    inputSchema: {
      commitHash: z.string().length(40).describe("Full 40-char commit hash"),
      confirm: z.literal("I_UNDERSTAND_THIS_IS_DESTRUCTIVE").describe("Must pass this exact string to confirm"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  }, async ({ commitHash, confirm: _confirm }) => {
    try {
      await revertToCheckpoint(commitHash);
      const summary = `Hard-reverted workspace to checkpoint ${commitHash.slice(0, 8)}`;
      logAction({ tool: "git_revert_checkpoint", action: "git", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, {}) }] };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "git_revert_checkpoint", action: "git", summary: err, dryRun: false, ok: false, error: err });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });
}
