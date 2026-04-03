// ─── Fornix Studio MCP – Filesystem Tools ────────────────────────────────────

import fs from "fs";
import path from "path";
import { glob } from "glob";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { guardPath, isReadOnly, shouldDryRun } from "../services/workspace.js";
import { logAction, formatToolResult, truncate } from "../services/logger.js";
import { FILE_READ_LINE_LIMIT } from "../constants.js";

export function registerFilesystemTools(server: McpServer): void {

  // ── read_file ────────────────────────────────────────────────────────────

  server.registerTool("fs_read_file", {
    title: "Read File",
    description: "Read contents of a file within the allowed workspace.",
    inputSchema: {
      path: z.string().describe("Absolute or workspace-relative path to file"),
      startLine: z.number().int().min(0).default(0).describe("0-based start line"),
      maxLines: z.number().int().min(1).max(1000).default(FILE_READ_LINE_LIMIT).describe("Max lines to read"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ path: p, startLine, maxLines }) => {
    try {
      const abs = guardPath(p);
      if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);

      const raw = fs.readFileSync(abs, "utf8");
      const lines = raw.split("\n");
      const slice = lines.slice(startLine, startLine + maxLines);
      const hasMore = startLine + maxLines < lines.length;

      const content = slice.join("\n");
      const footer = hasMore
        ? `\n\n[... ${lines.length - startLine - maxLines} more lines – use startLine to page ...]`
        : "";

      logAction({ tool: "fs_read_file", action: "read", target: abs, summary: `Read ${abs}`, dryRun: false, ok: true });
      return { content: [{ type: "text", text: truncate(content + footer) }] };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "fs_read_file", action: "read", target: p, summary: err, dryRun: false, ok: false, error: err });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });

  // ── write_file ───────────────────────────────────────────────────────────

  server.registerTool("fs_write_file", {
    title: "Write File",
    description: "Write (overwrite or create) a file. Set dryRun=true to preview without writing.",
    inputSchema: {
      path: z.string().describe("Target file path"),
      content: z.string().describe("Full file content"),
      dryRun: z.boolean().optional().describe("If true, show what would happen without writing"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  }, async ({ path: p, content, dryRun }) => {
    const dry = shouldDryRun(dryRun);
    try {
      const abs = guardPath(p);
      if (isReadOnly(abs)) throw new Error(`${abs} is in a read-only directory`);

      if (!dry) {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, "utf8");
      }

      const summary = dry
        ? `Would write ${content.length} chars to ${abs}`
        : `Wrote ${content.length} chars to ${abs}`;

      logAction({ tool: "fs_write_file", action: "write", target: abs, summary, dryRun: dry, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, { bytes: content.length }, dry) }] };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "fs_write_file", action: "write", target: p, summary: err, dryRun: dry, ok: false, error: err });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });

  // ── patch_file ───────────────────────────────────────────────────────────

  server.registerTool("fs_patch_file", {
    title: "Patch File",
    description: "Replace a specific string in a file. oldText must match exactly once.",
    inputSchema: {
      path: z.string().describe("Target file path"),
      oldText: z.string().min(1).describe("Exact text to find and replace (must be unique in file)"),
      newText: z.string().describe("Replacement text"),
      dryRun: z.boolean().optional().describe("Preview without writing"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ path: p, oldText, newText, dryRun }) => {
    const dry = shouldDryRun(dryRun);
    try {
      const abs = guardPath(p);
      if (isReadOnly(abs)) throw new Error(`${abs} is in a read-only directory`);
      if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);

      const original = fs.readFileSync(abs, "utf8");
      const count = original.split(oldText).length - 1;

      if (count === 0) throw new Error(`oldText not found in ${abs}`);
      if (count > 1) throw new Error(`oldText found ${count} times in ${abs} – must be unique. Refine the search text.`);

      const patched = original.replace(oldText, newText);

      if (!dry) {
        fs.writeFileSync(abs, patched, "utf8");
      }

      const summary = dry
        ? `Would patch ${abs} (replaced 1 occurrence)`
        : `Patched ${abs} (replaced 1 occurrence)`;

      logAction({ tool: "fs_patch_file", action: "patch", target: abs, summary, dryRun: dry, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, { oldLength: original.length, newLength: patched.length }, dry) }] };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "fs_patch_file", action: "patch", target: p, summary: err, dryRun: dry, ok: false, error: err });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });

  // ── list_tree ────────────────────────────────────────────────────────────

  server.registerTool("fs_list_tree", {
    title: "List Directory Tree",
    description: "List files and folders in a directory (max 3 levels deep by default).",
    inputSchema: {
      path: z.string().describe("Directory path"),
      depth: z.number().int().min(1).max(6).default(3).describe("Max depth"),
      includeHidden: z.boolean().default(false).describe("Include dotfiles"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ path: p, depth, includeHidden }) => {
    try {
      const abs = guardPath(p);
      if (!fs.existsSync(abs)) throw new Error(`Directory not found: ${abs}`);

      const pattern = `**/*`;
      const files = await glob(pattern, {
        cwd: abs,
        dot: includeHidden,
        ignore: ["node_modules/**", ".git/**", "dist/**"],
      });

      // Filter by depth
      const filtered = files.filter((f) => f.split("/").length <= depth);
      const sorted = filtered.sort();

      const output = sorted.map((f) => {
        const full = path.join(abs, f);
        const stat = fs.statSync(full);
        const icon = stat.isDirectory() ? "📁" : "📄";
        const size = stat.isFile() ? ` (${stat.size}b)` : "";
        return `${icon} ${f}${size}`;
      });

      logAction({ tool: "fs_list_tree", action: "read", target: abs, summary: `Listed ${output.length} entries in ${abs}`, dryRun: false, ok: true });
      return { content: [{ type: "text", text: truncate(`Tree of ${abs}:\n\n${output.join("\n")}`) }] };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "fs_list_tree", action: "read", target: p, summary: err, dryRun: false, ok: false, error: err });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });

  // ── search_code ──────────────────────────────────────────────────────────

  server.registerTool("fs_search_code", {
    title: "Search Code",
    description: "Search for a text pattern across files in the workspace.",
    inputSchema: {
      pattern: z.string().min(1).describe("Text or regex pattern to search"),
      dir: z.string().optional().describe("Directory to search (defaults to workspace root)"),
      filePattern: z.string().default("**/*").describe("Glob pattern to filter files"),
      maxResults: z.number().int().min(1).max(200).default(50),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ pattern, dir, filePattern, maxResults }) => {
    try {
      const searchDir = guardPath(dir ?? process.env.WORKSPACE_ROOT ?? process.cwd());
      const files = await glob(filePattern, {
        cwd: searchDir,
        ignore: ["node_modules/**", ".git/**", "dist/**"],
        nodir: true,
      });

      const regex = new RegExp(pattern, "gm");
      const results: string[] = [];

      for (const f of files) {
        if (results.length >= maxResults) break;
        try {
          const full = path.join(searchDir, f);
          const content = fs.readFileSync(full, "utf8");
          const lines = content.split("\n");
          lines.forEach((line, i) => {
            if (regex.test(line) && results.length < maxResults) {
              results.push(`${f}:${i + 1}: ${line.trim()}`);
            }
            regex.lastIndex = 0;
          });
        } catch { /* skip unreadable files */ }
      }

      logAction({ tool: "fs_search_code", action: "read", summary: `Found ${results.length} matches for "${pattern}"`, dryRun: false, ok: true });
      return { content: [{ type: "text", text: truncate(results.join("\n") || `No matches for "${pattern}"`) }] };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "fs_search_code", action: "read", summary: err, dryRun: false, ok: false, error: err });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });

  // ── move_file ────────────────────────────────────────────────────────────

  server.registerTool("fs_move_file", {
    title: "Move / Rename File",
    description: "Move or rename a file or directory within the allowed workspace.",
    inputSchema: {
      src: z.string().describe("Source path"),
      dest: z.string().describe("Destination path"),
      dryRun: z.boolean().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ src, dest, dryRun }) => {
    const dry = shouldDryRun(dryRun);
    try {
      const absSrc = guardPath(src);
      const absDest = guardPath(dest);
      if (!fs.existsSync(absSrc)) throw new Error(`Source not found: ${absSrc}`);

      if (!dry) {
        fs.mkdirSync(path.dirname(absDest), { recursive: true });
        fs.renameSync(absSrc, absDest);
      }

      const summary = dry ? `Would move ${absSrc} → ${absDest}` : `Moved ${absSrc} → ${absDest}`;
      logAction({ tool: "fs_move_file", action: "move", target: absSrc, summary, dryRun: dry, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, {}, dry) }] };
    } catch (e) {
      const err = String(e);
      logAction({ tool: "fs_move_file", action: "move", target: src, summary: err, dryRun: dry, ok: false, error: err });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });
}
