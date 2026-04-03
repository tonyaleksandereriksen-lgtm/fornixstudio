// ─── Fornix Studio MCP – Project + Validation Tools ──────────────────────────

import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { glob } from "glob";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { guardPath } from "../services/workspace.js";
import { logAction, formatToolResult, truncate } from "../services/logger.js";
import { readRecentLogs } from "../services/logger.js";

const execFileAsync = promisify(execFile);

async function runCmd(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs = 30_000
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 4,
    });
    return { stdout, stderr, code: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? String(e),
      code: err.code ?? 1,
    };
  }
}

export function registerProjectTools(server: McpServer): void {

  // ── inspect_project_structure ────────────────────────────────────────────

  server.registerTool("project_inspect_structure", {
    title: "Inspect Project Structure",
    description: "Analyse the project directory: detect language, frameworks, entry points, and risks.",
    inputSchema: {
      dir: z.string().describe("Project root directory to inspect"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ dir }) => {
    try {
      const abs = guardPath(dir);
      const files = await glob("**/*", {
        cwd: abs,
        ignore: ["node_modules/**", ".git/**", "dist/**", "build/**"],
        dot: false,
      });

      const ext_counts: Record<string, number> = {};
      for (const f of files) {
        const e = path.extname(f).toLowerCase();
        if (e) ext_counts[e] = (ext_counts[e] ?? 0) + 1;
      }

      const exts = Object.entries(ext_counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const languages: string[] = [];
      if (ext_counts[".ts"] || ext_counts[".tsx"]) languages.push("TypeScript");
      if (ext_counts[".js"] || ext_counts[".jsx"]) languages.push("JavaScript");
      if (ext_counts[".py"]) languages.push("Python");
      if (ext_counts[".cs"]) languages.push("C#");
      if (ext_counts[".json"]) languages.push("JSON/config");

      const risks: string[] = [];
      if (files.some(f => f.includes("secret") || f.includes(".env"))) risks.push("Possible secrets file detected");
      if (!files.some(f => f === ".gitignore")) risks.push("No .gitignore found");
      if (ext_counts[".ts"] && !files.some(f => f === "tsconfig.json")) risks.push("TypeScript found but no tsconfig.json");

      const entryPoints = files.filter(f =>
        /^(index|main|app|server)\.(ts|js|py)$/.test(path.basename(f))
      );

      const pkgJson = path.join(abs, "package.json");
      let scripts: Record<string, string> = {};
      if (fs.existsSync(pkgJson)) {
        try {
          scripts = JSON.parse(fs.readFileSync(pkgJson, "utf8")).scripts ?? {};
        } catch { /* ignore */ }
      }

      const report = {
        root: abs,
        fileCount: files.length,
        languages,
        topExtensions: exts,
        entryPoints,
        npmScripts: Object.keys(scripts),
        risks,
      };

      return { content: [{ type: "text", text: truncate(JSON.stringify(report, null, 2)) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── run_build ────────────────────────────────────────────────────────────

  server.registerTool("project_run_build", {
    title: "Run Build",
    description: "Run `npm run build` (or a custom command) and return output.",
    inputSchema: {
      dir: z.string().describe("Directory with package.json"),
      command: z.string().default("build").describe("npm script name to run"),
      timeoutSeconds: z.number().int().min(5).max(300).default(60),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ dir, command, timeoutSeconds }) => {
    try {
      const abs = guardPath(dir);
      const { stdout, stderr, code } = await runCmd(
        "npm",
        ["run", command],
        abs,
        timeoutSeconds * 1000
      );
      const ok = code === 0;
      const out = [stdout, stderr].filter(Boolean).join("\n");
      const summary = ok ? `Build "${command}" succeeded` : `Build "${command}" failed (exit ${code})`;
      logAction({ tool: "project_run_build", action: "exec", summary, dryRun: false, ok });
      return { content: [{ type: "text", text: formatToolResult(ok, summary, truncate(out)) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── run_tests ────────────────────────────────────────────────────────────

  server.registerTool("project_run_tests", {
    title: "Run Tests",
    description: "Run `npm test` and return results.",
    inputSchema: {
      dir: z.string().describe("Project directory"),
      pattern: z.string().optional().describe("Optional test file pattern"),
      timeoutSeconds: z.number().int().min(5).max(300).default(60),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ dir, pattern, timeoutSeconds }) => {
    try {
      const abs = guardPath(dir);
      const args = ["test", ...(pattern ? ["--", pattern] : [])];
      const { stdout, stderr, code } = await runCmd("npm", args, abs, timeoutSeconds * 1000);
      const ok = code === 0;
      const out = [stdout, stderr].filter(Boolean).join("\n");
      const summary = ok ? "Tests passed" : `Tests failed (exit ${code})`;
      logAction({ tool: "project_run_tests", action: "exec", summary, dryRun: false, ok });
      return { content: [{ type: "text", text: formatToolResult(ok, summary, truncate(out)) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── lint_project ─────────────────────────────────────────────────────────

  server.registerTool("project_lint", {
    title: "Lint Project",
    description: "Run ESLint (or npm run lint) on the project.",
    inputSchema: {
      dir: z.string().describe("Project directory"),
      fix: z.boolean().default(false).describe("Auto-fix fixable issues"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ dir, fix }) => {
    try {
      const abs = guardPath(dir);
      const args = fix ? ["run", "lint", "--", "--fix"] : ["run", "lint"];
      const { stdout, stderr, code } = await runCmd("npm", args, abs, 30_000);
      const ok = code === 0;
      const out = [stdout, stderr].filter(Boolean).join("\n");
      const summary = ok ? "Lint passed" : `Lint issues found (exit ${code})`;
      logAction({ tool: "project_lint", action: "exec", summary, dryRun: false, ok });
      return { content: [{ type: "text", text: formatToolResult(ok, summary, truncate(out)) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── typecheck_project ─────────────────────────────────────────────────────

  server.registerTool("project_typecheck", {
    title: "Typecheck Project",
    description: "Run `tsc --noEmit` to typecheck a TypeScript project.",
    inputSchema: {
      dir: z.string().describe("Project directory with tsconfig.json"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ dir }) => {
    try {
      const abs = guardPath(dir);
      const { stdout, stderr, code } = await runCmd("npx", ["tsc", "--noEmit"], abs, 60_000);
      const ok = code === 0;
      const out = [stdout, stderr].filter(Boolean).join("\n");
      const summary = ok ? "TypeScript: no errors" : `TypeScript errors found`;
      return { content: [{ type: "text", text: formatToolResult(ok, summary, truncate(out)) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── read_action_log ───────────────────────────────────────────────────────

  server.registerTool("project_read_action_log", {
    title: "Read Action Log",
    description: "Read recent AI-triggered actions from the audit log.",
    inputSchema: {
      n: z.number().int().min(1).max(100).default(20).describe("Number of recent entries"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ n }) => {
    const entries = readRecentLogs(n);
    if (!entries.length) {
      return { content: [{ type: "text", text: "No log entries yet." }] };
    }
    const lines = entries.map(e => {
      const icon = e.ok ? "✓" : "✗";
      const dry = e.dryRun ? " [DRY]" : "";
      return `${e.ts} ${icon}${dry} [${e.tool}] ${e.summary}`;
    });
    return { content: [{ type: "text", text: lines.join("\n") }] };
  });
}
