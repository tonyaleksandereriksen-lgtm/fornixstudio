// ─── Fornix Studio MCP – Checkpoint Service ──────────────────────────────────

import { simpleGit, type SimpleGit } from "simple-git";
import { CHECKPOINT_PREFIX } from "../constants.js";
import type { CheckpointInfo } from "../types.js";

let _git: SimpleGit | null = null;

export function initGit(gitRoot: string): void {
  _git = simpleGit(gitRoot);
}

function git(): SimpleGit {
  if (!_git) throw new Error("Git not initialised. Call initGit() first.");
  return _git;
}

/**
 * Create a checkpoint commit with all current changes staged.
 * Returns the new commit hash.
 */
export async function createCheckpoint(message: string): Promise<string> {
  const g = git();
  const label = `${CHECKPOINT_PREFIX}: ${message}`;

  await g.add("-A");

  // Check if there's anything to commit
  const status = await g.status();
  if (status.files.length === 0) {
    // Nothing staged – create an empty commit so we always have a rollback point
    await g.commit(label, ["--allow-empty"]);
  } else {
    await g.commit(label);
  }

  const log = await g.log({ maxCount: 1 });
  return log.latest?.hash ?? "unknown";
}

/**
 * List recent MCP checkpoints.
 */
export async function listCheckpoints(n = 20): Promise<CheckpointInfo[]> {
  const g = git();
  const log = await g.log({ maxCount: n * 5 }); // fetch more, filter below

  return (log.all ?? [])
    .map((c) => ({
      hash: c.hash,
      message: c.message,
      date: c.date,
      isMcpCheckpoint: c.message.startsWith(CHECKPOINT_PREFIX),
    }))
    .filter((c) => c.isMcpCheckpoint)
    .slice(0, n);
}

/**
 * Restore a single file to its state at a given commit hash.
 */
export async function restoreFile(
  filePath: string,
  commitHash: string
): Promise<void> {
  const g = git();
  await g.checkout([commitHash, "--", filePath]);
}

/**
 * Hard-reset the entire working tree to a checkpoint hash.
 * DESTRUCTIVE. Caller should warn the user before calling.
 */
export async function revertToCheckpoint(commitHash: string): Promise<void> {
  const g = git();
  await g.reset(["--hard", commitHash]);
}

/**
 * Get current git status summary.
 */
export async function getStatus(): Promise<{
  branch: string;
  modified: string[];
  staged: string[];
  untracked: string[];
  clean: boolean;
}> {
  const g = git();
  const s = await g.status();

  return {
    branch: s.current ?? "unknown",
    modified: s.modified,
    staged: s.staged,
    untracked: s.not_added,
    clean: s.isClean(),
  };
}

/**
 * Get unified diff for a file, or all changes if path omitted.
 */
export async function getDiff(filePath?: string): Promise<string> {
  const g = git();
  if (filePath) {
    return await g.diff(["HEAD", "--", filePath]);
  }
  return await g.diff(["HEAD"]);
}
