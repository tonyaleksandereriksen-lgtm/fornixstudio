// ─── Fornix Studio MCP – Workspace Guard ─────────────────────────────────────

import fs from "fs";
import path from "path";
import { WORKSPACE_CONFIG_FILENAME } from "../constants.js";
import type { WorkspaceConfig } from "../types.js";

let _config: WorkspaceConfig | null = null;

export function loadWorkspaceConfig(workspaceRoot: string): WorkspaceConfig {
  const cfgPath = path.join(workspaceRoot, WORKSPACE_CONFIG_FILENAME);

  if (fs.existsSync(cfgPath)) {
    try {
      const raw = fs.readFileSync(cfgPath, "utf8");
      _config = JSON.parse(raw) as WorkspaceConfig;
      return _config;
    } catch (e) {
      throw new Error(`Failed to parse ${WORKSPACE_CONFIG_FILENAME}: ${e}`);
    }
  }

  // Default: allow only the workspace root itself
  _config = {
    allowedDirs: [workspaceRoot],
    dryRunByDefault: false,
    gitRoot: workspaceRoot,
    s1BridgeEnabled: false,
  };
  return _config;
}

export function getConfig(): WorkspaceConfig {
  if (!_config) throw new Error("Workspace config not loaded. Call loadWorkspaceConfig() first.");
  return _config;
}

/**
 * Resolve and validate that a path is inside an allowed directory.
 * Throws if the path is outside the allowlist.
 */
export function guardPath(inputPath: string): string {
  if (!_config) throw new Error("Workspace not initialised.");

  const resolved = path.resolve(inputPath);

  const allowed = _config.allowedDirs.some((dir) =>
    resolved.startsWith(path.resolve(dir))
  );

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
  if (!_config?.readOnlyDirs) return false;
  const resolved = path.resolve(inputPath);
  return _config.readOnlyDirs.some((dir) =>
    resolved.startsWith(path.resolve(dir))
  );
}

/**
 * Should this operation run in dry-run mode?
 * Tool-level override wins; falls back to workspace default.
 */
export function shouldDryRun(toolOverride?: boolean): boolean {
  if (toolOverride !== undefined) return toolOverride;
  return _config?.dryRunByDefault ?? false;
}
