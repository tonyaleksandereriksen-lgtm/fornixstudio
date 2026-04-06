
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  loadWorkspaceConfig,
  guardPath,
  resolveWorkspacePath,
  isReadOnly,
  shouldDryRun,
} from "../../dist/services/workspace.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fornix-guard-"));
  // Create a minimal config
  fs.writeFileSync(
    path.join(root, "fornix-mcp.config.json"),
    JSON.stringify({
      allowedDirs: ["."],
      readOnlyDirs: ["readonly"],
      dryRunByDefault: false,
    })
  );
  fs.mkdirSync(path.join(root, "subdir"), { recursive: true });
  fs.mkdirSync(path.join(root, "readonly"), { recursive: true });
  return root;
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

// ─── Basic path guarding ──────────────────────────────────────────────────────

test("guardPath allows paths inside workspace", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    const result = guardPath(path.join(root, "subdir", "file.txt"));
    assert.equal(result, path.resolve(root, "subdir", "file.txt"));
  } finally {
    cleanup(root);
  }
});

test("guardPath allows workspace root itself", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    const result = guardPath(root);
    assert.equal(result, path.resolve(root));
  } finally {
    cleanup(root);
  }
});

test("guardPath rejects paths outside workspace", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    assert.throws(
      () => guardPath("/etc/passwd"),
      /outside the allowed workspace/
    );
  } finally {
    cleanup(root);
  }
});

test("guardPath rejects parent traversal (..)", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    assert.throws(
      () => guardPath(path.join(root, "subdir", "..", "..", "escape")),
      /outside the allowed workspace/
    );
  } finally {
    cleanup(root);
  }
});

test("guardPath handles relative paths within workspace", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    // Relative paths resolve against workspace root
    const result = guardPath("subdir/file.txt");
    assert.equal(result, path.resolve(root, "subdir", "file.txt"));
  } finally {
    cleanup(root);
  }
});

// ─── Symlink protection ───────────────────────────────────────────────────────

test("guardPath blocks symlink that points outside workspace", () => {
  const root = makeTmpWorkspace();
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "fornix-outside-"));
  const outsideFile = path.join(outsideDir, "secret.txt");
  fs.writeFileSync(outsideFile, "sensitive data");

  try {
    loadWorkspaceConfig(root);

    // Create a symlink inside workspace pointing outside
    const symlinkPath = path.join(root, "sneaky-link");
    fs.symlinkSync(outsideDir, symlinkPath, "junction");

    // Accessing the symlink target should be blocked
    assert.throws(
      () => guardPath(path.join(symlinkPath, "secret.txt")),
      /outside the allowed workspace/
    );
  } finally {
    cleanup(root);
    cleanup(outsideDir);
  }
});

test("guardPath blocks file symlink pointing outside workspace", () => {
  const root = makeTmpWorkspace();
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "fornix-outside-"));
  const outsideFile = path.join(outsideDir, "secret.txt");
  fs.writeFileSync(outsideFile, "sensitive data");

  try {
    loadWorkspaceConfig(root);

    // Create a file symlink inside workspace pointing to file outside
    const symlinkPath = path.join(root, "sneaky-file.txt");
    try {
      fs.symlinkSync(outsideFile, symlinkPath, "file");
    } catch {
      // Symlink creation may require elevated privileges on Windows — skip
      return;
    }

    assert.throws(
      () => guardPath(symlinkPath),
      /outside the allowed workspace/
    );
  } finally {
    cleanup(root);
    cleanup(outsideDir);
  }
});

test("guardPath allows symlink that stays within workspace", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);

    // Create a symlink inside workspace pointing to another dir inside workspace
    const linkTarget = path.join(root, "subdir");
    const symlinkPath = path.join(root, "internal-link");
    try {
      fs.symlinkSync(linkTarget, symlinkPath, "junction");
    } catch {
      return; // Skip if symlinks not supported
    }

    // This should succeed — target is still within workspace
    const result = guardPath(path.join(symlinkPath, "file.txt"));
    assert.ok(result);
  } finally {
    cleanup(root);
  }
});

// ─── Read-only checks ─────────────────────────────────────────────────────────

test("isReadOnly returns true for paths in readOnlyDirs", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    assert.equal(isReadOnly(path.join(root, "readonly", "file.txt")), true);
  } finally {
    cleanup(root);
  }
});

test("isReadOnly returns false for paths outside readOnlyDirs", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    assert.equal(isReadOnly(path.join(root, "subdir", "file.txt")), false);
  } finally {
    cleanup(root);
  }
});

// ─── Dry run ──────────────────────────────────────────────────────────────────

test("shouldDryRun respects tool override over workspace default", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    assert.equal(shouldDryRun(true), true);
    assert.equal(shouldDryRun(false), false);
  } finally {
    cleanup(root);
  }
});

test("shouldDryRun falls back to workspace default", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    // Config has dryRunByDefault: false
    assert.equal(shouldDryRun(undefined), false);
  } finally {
    cleanup(root);
  }
});

// ─── Config loading edge cases ────────────────────────────────────────────────

test("loadWorkspaceConfig creates default config when no file exists", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fornix-noconfig-"));
  try {
    const config = loadWorkspaceConfig(root);
    assert.deepEqual(config.allowedDirs, [path.resolve(root)]);
    assert.deepEqual(config.readOnlyDirs, []);
    assert.equal(config.dryRunByDefault, false);
    assert.equal(config.s1BridgeEnabled, false);
  } finally {
    cleanup(root);
  }
});

test("loadWorkspaceConfig deduplicates allowedDirs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fornix-dedup-"));
  fs.writeFileSync(
    path.join(root, "fornix-mcp.config.json"),
    JSON.stringify({ allowedDirs: [".", ".", "subdir", "subdir"] })
  );
  try {
    const config = loadWorkspaceConfig(root);
    const unique = new Set(config.allowedDirs);
    assert.equal(config.allowedDirs.length, unique.size);
  } finally {
    cleanup(root);
  }
});

test("loadWorkspaceConfig throws on malformed JSON", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fornix-bad-"));
  fs.writeFileSync(path.join(root, "fornix-mcp.config.json"), "not json");
  try {
    assert.throws(
      () => loadWorkspaceConfig(root),
      /Failed to parse/
    );
  } finally {
    cleanup(root);
  }
});
