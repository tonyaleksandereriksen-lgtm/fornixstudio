
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createWorkspace,
  addTrackToWorkspace,
  removeTrackFromWorkspace,
  updateWorkspaceDefaults,
  readWorkspace,
  generateWorkspacePackages,
  checkWorkspaceConsistency,
} from "../../dist/services/workspace-profile.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fornix-mut-test-"));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── removeTrackFromWorkspace ─────────────────────────────────────────────────

test("removeTrackFromWorkspace removes a track by slug", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "Remove Test" });
    addTrackToWorkspace({ outputDir: dir, trackName: "Keep Me", tempo: 150 });
    addTrackToWorkspace({ outputDir: dir, trackName: "Drop Me", tempo: 148 });

    const result = removeTrackFromWorkspace(dir, "drop-me");

    assert.equal(result.removedTrack.trackName, "Drop Me");
    assert.equal(result.removedTrack.trackSlug, "drop-me");
    assert.equal(result.workspace.tracks.length, 1);
    assert.equal(result.workspace.tracks[0].trackSlug, "keep-me");
    assert.equal(result.packageCleaned, false);
  } finally {
    cleanup(dir);
  }
});

test("removeTrackFromWorkspace throws for unknown slug", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "Not Found Test" });
    addTrackToWorkspace({ outputDir: dir, trackName: "Exists", tempo: 150 });

    assert.throws(
      () => removeTrackFromWorkspace(dir, "does-not-exist"),
      /not found/i,
    );
  } finally {
    cleanup(dir);
  }
});

test("removeTrackFromWorkspace with cleanPackage deletes package directory", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "Clean Test" });
    addTrackToWorkspace({ outputDir: dir, trackName: "Generated Track", tempo: 150 });
    generateWorkspacePackages(dir);

    // Verify package exists
    const packageDir = path.join(dir, "Fornix", "generated-track");
    assert.ok(fs.existsSync(packageDir), "package should exist before removal");

    const result = removeTrackFromWorkspace(dir, "generated-track", { cleanPackage: true });

    assert.equal(result.packageCleaned, true);
    assert.ok(!fs.existsSync(packageDir), "package should be deleted after removal");
    assert.equal(result.workspace.tracks.length, 0);
  } finally {
    cleanup(dir);
  }
});

test("removeTrackFromWorkspace without cleanPackage preserves package directory", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "Preserve Test" });
    addTrackToWorkspace({ outputDir: dir, trackName: "Keep Package", tempo: 150 });
    generateWorkspacePackages(dir);

    const packageDir = path.join(dir, "Fornix", "keep-package");
    assert.ok(fs.existsSync(packageDir));

    const result = removeTrackFromWorkspace(dir, "keep-package");

    assert.equal(result.packageCleaned, false);
    assert.ok(fs.existsSync(packageDir), "package should still exist");
  } finally {
    cleanup(dir);
  }
});

test("removeTrackFromWorkspace persists change to disk", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "Persist Test" });
    addTrackToWorkspace({ outputDir: dir, trackName: "A", tempo: 150 });
    addTrackToWorkspace({ outputDir: dir, trackName: "B", tempo: 148 });

    removeTrackFromWorkspace(dir, "a");

    const ws = readWorkspace(dir);
    assert.equal(ws.tracks.length, 1);
    assert.equal(ws.tracks[0].trackSlug, "b");
  } finally {
    cleanup(dir);
  }
});

// ─── updateWorkspaceDefaults ──────────────────────────────────────────────────

test("updateWorkspaceDefaults merges new fields into existing defaults", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({
      outputDir: dir,
      name: "Merge Test",
      defaults: { styleVariant: "cinematic-euphoric", leadStyle: "euphoric" },
    });

    const result = updateWorkspaceDefaults(dir, { leadStyle: "screech", mood: "dark" });

    assert.ok(result.updatedFields.includes("leadStyle"));
    assert.ok(result.updatedFields.includes("mood"));
    assert.equal(result.workspace.defaults.styleVariant, "cinematic-euphoric"); // preserved
    assert.equal(result.workspace.defaults.leadStyle, "screech"); // updated
    assert.equal(result.workspace.defaults.mood, "dark"); // new
  } finally {
    cleanup(dir);
  }
});

test("updateWorkspaceDefaults merge mode preserves untouched fields", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({
      outputDir: dir,
      name: "Preserve Test",
      defaults: { styleVariant: "rawphoric", kickStyle: "distorted-punch" },
    });

    updateWorkspaceDefaults(dir, { leadStyle: "screech" });

    const ws = readWorkspace(dir);
    assert.equal(ws.defaults.styleVariant, "rawphoric");
    assert.equal(ws.defaults.kickStyle, "distorted-punch");
    assert.equal(ws.defaults.leadStyle, "screech");
  } finally {
    cleanup(dir);
  }
});

test("updateWorkspaceDefaults replace mode clears old fields", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({
      outputDir: dir,
      name: "Replace Test",
      defaults: { styleVariant: "cinematic-euphoric", leadStyle: "euphoric", mood: "uplifting" },
    });

    const result = updateWorkspaceDefaults(
      dir,
      { styleVariant: "rawphoric" },
      { merge: false },
    );

    assert.ok(result.updatedFields.includes("styleVariant"));
    assert.ok(result.removedFields.includes("leadStyle"));
    assert.ok(result.removedFields.includes("mood"));
    assert.equal(result.workspace.defaults.styleVariant, "rawphoric");
    assert.equal(result.workspace.defaults.leadStyle, undefined);
    assert.equal(result.workspace.defaults.mood, undefined);
  } finally {
    cleanup(dir);
  }
});

test("updateWorkspaceDefaults reports no changes when values are identical", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({
      outputDir: dir,
      name: "Noop Test",
      defaults: { styleVariant: "rawphoric" },
    });

    const result = updateWorkspaceDefaults(dir, { styleVariant: "rawphoric" });

    assert.equal(result.updatedFields.length, 0);
    assert.equal(result.removedFields.length, 0);
  } finally {
    cleanup(dir);
  }
});

test("updateWorkspaceDefaults persists to disk", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "Persist Test" });

    updateWorkspaceDefaults(dir, {
      styleVariant: "festival-hardstyle",
      energyProfile: "front-loaded",
    });

    const ws = readWorkspace(dir);
    assert.equal(ws.defaults.styleVariant, "festival-hardstyle");
    assert.equal(ws.defaults.energyProfile, "front-loaded");
  } finally {
    cleanup(dir);
  }
});

// ─── Workflow: update defaults → check consistency → regenerate ───────────────

test("update defaults creates detectable drift in consistency check", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({
      outputDir: dir,
      name: "Drift Workflow",
      defaults: { styleVariant: "cinematic-euphoric", leadStyle: "euphoric" },
    });
    addTrackToWorkspace({ outputDir: dir, trackName: "Track A", tempo: 150 });
    generateWorkspacePackages(dir);

    // Consistency should be clean initially
    const before = checkWorkspaceConsistency(dir);
    assert.equal(before.consistent, true);

    // Update defaults — creates drift
    updateWorkspaceDefaults(dir, { styleVariant: "rawphoric", leadStyle: "screech" });

    // Now consistency should report drift
    const after = checkWorkspaceConsistency(dir);
    assert.equal(after.consistent, false);

    const fields = after.issues.map((i) => i.field);
    assert.ok(fields.includes("styleVariant"));
    assert.ok(fields.includes("leadStyle"));
  } finally {
    cleanup(dir);
  }
});
