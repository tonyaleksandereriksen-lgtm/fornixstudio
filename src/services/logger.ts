// ─── Fornix Studio MCP – Logger ──────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { ACTION_LOG_FILENAME, CHARACTER_LIMIT } from "../constants.js";
import type { ActionLogEntry, ActionType } from "../types.js";

let _logPath: string | null = null;

export function initLogger(workspaceRoot: string): void {
  _logPath = path.join(workspaceRoot, ACTION_LOG_FILENAME);
}

export function logAction(entry: Omit<ActionLogEntry, "ts">): void {
  const full: ActionLogEntry = {
    ts: new Date().toISOString(),
    ...entry,
  };

  const line = JSON.stringify(full);

  if (_logPath) {
    try {
      fs.appendFileSync(_logPath, line + "\n", "utf8");
    } catch {
      // Non-fatal: log to stderr if file write fails
      process.stderr.write(`[logger] Failed to write log: ${line}\n`);
    }
  }

  // Always echo to stderr so it appears in MCP debug output
  const icon = entry.ok ? "✓" : "✗";
  const dry = entry.dryRun ? " [DRY-RUN]" : "";
  process.stderr.write(`[${entry.tool}]${dry} ${icon} ${entry.summary}\n`);
}

export function readRecentLogs(n: number = 50): ActionLogEntry[] {
  if (!_logPath || !fs.existsSync(_logPath)) return [];

  try {
    const raw = fs.readFileSync(_logPath, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines
      .slice(-n)
      .map((l) => JSON.parse(l) as ActionLogEntry)
      .reverse();
  } catch {
    return [];
  }
}

export function truncate(text: string, limit = CHARACTER_LIMIT): string {
  if (text.length <= limit) return text;
  const half = Math.floor(limit / 2);
  return (
    text.slice(0, half) +
    `\n\n... [truncated ${text.length - limit} chars] ...\n\n` +
    text.slice(-half)
  );
}

export function formatToolResult(
  ok: boolean,
  summary: string,
  data: unknown,
  dryRun = false
): string {
  const tag = dryRun ? " [DRY-RUN – no changes made]" : "";
  const status = ok ? "✓" : "✗";
  const body =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return truncate(`${status}${tag} ${summary}\n\n${body}`);
}
