// ─── Fornix Studio MCP – Workspace Guard ─────────────────────────────────────

import fs from "fs";
import path from "path";
import { WORKSPACE_CONFIG_FILENAME } from "../constants.js";
import type { WorkspaceConfig } from "../types.js";

let _config: WorkspaceConfig | null = null;
let _workspaceRoot: string | null = null;

function resolveConfigPath(baseDir: string, value: string): string {
  return path.resolve(baseDir, value);
}

function normalizeDirList(baseDir: string, dirs: string[] | undefined, fallback: string[] = []): string[] {
  const source = dirs?.length ? dirs : fallback;
  return Array.from(new Set(source.map((dir) => resolveConfigPath(baseDir, dir))));
}

function isPathInside(targetPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function loadWorkspaceConfig(workspaceRoot: string): WorkspaceConfig {
  _workspaceRoot = path.resolve(workspaceRoot);
  const cfgPath = path.join(_workspaceRoot, WORKSPACE_CONFIG_FILENAME);

  if (fs.existsSync(cfgPath)) {
    try {
      const raw = fs.readFileSync(cfgPath, "utf8");
      const parsed = JSON.parse(raw) as WorkspaceConfig;

      _config = {
        allowedDirs: normalizeDirList(_workspaceRoot, parsed.allowedDirs, [_workspaceRoot]),
        readOnlyDirs: normalizeDirList(_workspaceRoot, parsed.readOnlyDirs),
        dryRunByDefault: parsed.dryRunByDefault ?? false,
        gitRoot: resolveConfigPath(_workspaceRoot, parsed.gitRoot ?? _workspaceRoot),
        s1BridgeEnabled: parsed.s1BridgeEnabled ?? false,
      };

      return _config;
    } catch (e) {
      throw new Error(`Failed to parse ${WORKSPACE_CONFIG_FILENAME}: ${e}`);
    }
  }

  _config = {
    allowedDirs: [_workspaceRoot],
    readOnlyDirs: [],
    dryRunByDefault: false,
    gitRoot: _workspaceRoot,
    s1BridgeEnabled: false,
  };

  return _config;
}

export function getConfig(): WorkspaceConfig {
  if (!_config) {
    throw new Error("Workspace config not loaded. Call loadWorkspaceConfig() first.");
  }
  return _config;
}

export function resolveWorkspacePath(inputPath: string): string {
  if (!_workspaceRoot) {
    throw new Error("Workspace not initialised.");
  }

  return path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(_workspaceRoot, inputPath);
}

/**
 * Resolve and validate that a path is inside an allowed directory.
 * Throws if the path is outside the allowlist.
 */
export function guardPath(inputPath: string): string {
  if (!_config) {
    throw new Error("Workspace not initialised.");
  }

  const resolved = resolveWorkspacePath(inputPath);

  const allowed = _config.allowedDirs.some((dir) => isPathInside(resolved, dir));
  if (!allowed) {
    throw new Error(
      `Path "${resolved}" is outside the allowed workspace.\n` +
      `Allowed dirs: ${_config.allowedDirs.join(", ")}`
    );
  }

  return resolved;
}

/**
 * Check if a path is in a read-only directory.
 */
export function isReadOnly(inputPath: string): boolean {
  if (!_config?.readOnlyDirs?.length) {
    return false;
  }

  const resolved = resolveWorkspacePath(inputPath);
  return _config.readOnlyDirs.some((dir) => isPathInside(resolved, dir));
}

/**
 * Should this operation run in dry-run mode?
 * Tool-level override wins; falls back to workspace default.
 */
export function shouldDryRun(toolOverride?: boolean): boolean {
  if (toolOverride !== undefined) {
    return toolOverride;
  }

  return _config?.dryRunByDefault ?? false;
}
