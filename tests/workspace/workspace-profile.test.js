
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  WORKSPACE_FILENAME,
  WORKSPACE_FORMAT_VERSION,
  createWorkspace,
  readWorkspace,
  writeWorkspace,
  workspaceExists,
  addTrackToWorkspace,
  resolveTrackInput,
  getWorkspaceSummary,
  markTrackGenerated,
} from "../../dist/services/workspace-profile.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fornix-ws-test-"));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── createWorkspace ────────────────────────────────────────────────────────────

test("createWorkspace writes workspace.json with correct shape", () => {
  const dir = makeTempDir();
  try {
    const ws = createWorkspace({ outputDir: dir, name: "Dark EP" });

    assert.equal(ws.workspaceFormatVersion, WORKSPACE_FORMAT_VERSION);
    assert.equal(ws.name, "Dark EP");
    assert.equal(ws.artistName, "Fornix");
    assert.deepEqual(ws.tracks, []);
    assert.ok(ws.createdAt);

    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, WORKSPACE_FILENAME), "utf8"));
    assert.equal(onDisk.name, "Dark EP");
  } finally {
    cleanup(dir);
  }
});

test("createWorkspace rejects duplicate creation", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "EP1" });
    assert.throws(() => createWorkspace({ outputDir: dir, name: "EP2" }), /already exists/);
  } finally {
    cleanup(dir);
  }
});

test("createWorkspace with BPM range and defaults", () => {
  const dir = makeTempDir();
  try {
    const ws = createWorkspace({
      outputDir: dir,
      name: "Festival Set",
      artistName: "TestArtist",
      bpmRange: { min: 145, max: 155 },
      defaults: { styleVariant: "rawphoric", leadStyle: "screech" },
    });

    assert.deepEqual(ws.bpmRange, { min: 145, max: 155 });
    assert.equal(ws.defaults.styleVariant, "rawphoric");
    assert.equal(ws.defaults.leadStyle, "screech");
    assert.equal(ws.artistName, "TestArtist");
  } finally {
    cleanup(dir);
  }
});

test("createWorkspace rejects invalid BPM range (min > max)", () => {
  const dir = makeTempDir();
  try {
    assert.throws(
      () => createWorkspace({ outputDir: dir, name: "Bad", bpmRange: { min: 160, max: 140 } }),
      /cannot exceed max/,
    );
  } finally {
    cleanup(dir);
  }
});

test("createWorkspace rejects BPM range outside 100–200", () => {
  const dir = makeTempDir();
  try {
    assert.throws(
      () => createWorkspace({ outputDir: dir, name: "Bad", bpmRange: { min: 50, max: 150 } }),
      /100–200/,
    );
  } finally {
    cleanup(dir);
  }
});

// ─── workspaceExists / readWorkspace ────────────────────────────────────────────

test("workspaceExists returns false when no file present", () => {
  const dir = makeTempDir();
  try {
    assert.equal(workspaceExists(dir), false);
  } finally {
    cleanup(dir);
  }
});

test("workspaceExists returns true after creation", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "EP" });
    assert.equal(workspaceExists(dir), true);
  } finally {
    cleanup(dir);
  }
});

test("readWorkspace throws when file does not exist", () => {
  const dir = makeTempDir();
  try {
    assert.throws(() => readWorkspace(dir), /No workspace\.json/);
  } finally {
    cleanup(dir);
  }
});

// ─── addTrackToWorkspace ────────────────────────────────────────────────────────

test("addTrackToWorkspace appends a track", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "EP" });
    const { workspace, track } = addTrackToWorkspace({
      outputDir: dir,
      trackName: "Cathedral of Ruin",
      tempo: 150,
      creativeBrief: "Dark intro",
    });

    assert.equal(workspace.tracks.length, 1);
    assert.equal(track.trackName, "Cathedral of Ruin");
    assert.equal(track.trackSlug, "cathedral-of-ruin");
    assert.equal(track.tempo, 150);
    assert.equal(track.packageGenerated, false);
    assert.ok(track.addedAt);
  } finally {
    cleanup(dir);
  }
});

test("addTrackToWorkspace rejects duplicate track slug", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "EP" });
    addTrackToWorkspace({ outputDir: dir, trackName: "Track One", tempo: 150 });
    assert.throws(
      () => addTrackToWorkspace({ outputDir: dir, trackName: "Track One", tempo: 150 }),
      /already exists/,
    );
  } finally {
    cleanup(dir);
  }
});

test("addTrackToWorkspace validates tempo against BPM range", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "EP", bpmRange: { min: 145, max: 155 } });
    assert.throws(
      () => addTrackToWorkspace({ outputDir: dir, trackName: "Slow", tempo: 130 }),
      /outside workspace BPM range/,
    );
  } finally {
    cleanup(dir);
  }
});

test("addTrackToWorkspace allows tempo within BPM range", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "EP", bpmRange: { min: 145, max: 155 } });
    const { track } = addTrackToWorkspace({ outputDir: dir, trackName: "Good", tempo: 150 });
    assert.equal(track.tempo, 150);
  } finally {
    cleanup(dir);
  }
});

test("addTrackToWorkspace stores overrides", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "EP", defaults: { styleVariant: "cinematic-euphoric" } });
    const { track } = addTrackToWorkspace({
      outputDir: dir,
      trackName: "Raw One",
      tempo: 150,
      overrides: { styleVariant: "rawphoric", aggressionLevel: "high" },
    });

    assert.equal(track.overrides.styleVariant, "rawphoric");
    assert.equal(track.overrides.aggressionLevel, "high");
  } finally {
    cleanup(dir);
  }
});

// ─── resolveTrackInput (inheritance) ────────────────────────────────────────────

test("resolveTrackInput uses workspace defaults when track has no overrides", () => {
  const dir = makeTempDir();
  try {
    const ws = createWorkspace({
      outputDir: dir,
      name: "EP",
      defaults: {
        styleVariant: "rawphoric",
        leadStyle: "screech",
        kickStyle: "gritty tok",
        mood: "dark",
      },
    });
    const { workspace, track } = addTrackToWorkspace({
      outputDir: dir,
      trackName: "Track A",
      tempo: 150,
    });

    const resolved = resolveTrackInput(workspace, track);

    assert.equal(resolved.styleVariant, "rawphoric");
    assert.equal(resolved.leadStyle, "screech");
    assert.equal(resolved.kickStyle, "gritty tok");
    assert.equal(resolved.mood, "dark");
    assert.equal(resolved.trackName, "Track A");
    assert.equal(resolved.tempo, 150);
  } finally {
    cleanup(dir);
  }
});

test("resolveTrackInput lets track overrides win over workspace defaults", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({
      outputDir: dir,
      name: "EP",
      defaults: { styleVariant: "cinematic-euphoric", leadStyle: "euphoric", mood: "melancholic" },
    });
    const { workspace, track } = addTrackToWorkspace({
      outputDir: dir,
      trackName: "Raw Banger",
      tempo: 155,
      overrides: { styleVariant: "rawphoric", leadStyle: "screech" },
    });

    const resolved = resolveTrackInput(workspace, track);

    assert.equal(resolved.styleVariant, "rawphoric", "override should win");
    assert.equal(resolved.leadStyle, "screech", "override should win");
    assert.equal(resolved.mood, "melancholic", "workspace default should fill");
  } finally {
    cleanup(dir);
  }
});

test("resolveTrackInput falls back to hardcoded defaults when workspace has no value", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "Bare EP" });
    const { workspace, track } = addTrackToWorkspace({
      outputDir: dir,
      trackName: "Minimal",
      tempo: 150,
    });

    const resolved = resolveTrackInput(workspace, track);

    // These are the hardcoded fallbacks in resolveTrackInput
    assert.equal(resolved.styleVariant, "cinematic-euphoric");
    assert.equal(resolved.leadStyle, "hybrid");
    assert.equal(resolved.dropStrategy, "anti-climax-to-melodic");
    assert.equal(resolved.energyProfile, "steady-escalation");
    assert.equal(resolved.targetBars, 160);
    assert.equal(resolved.keySignature, "F# minor");
  } finally {
    cleanup(dir);
  }
});

test("resolveTrackInput preserves per-track fields (creativeBrief, signatureHooks)", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "EP" });
    const { workspace, track } = addTrackToWorkspace({
      outputDir: dir,
      trackName: "Hook City",
      tempo: 148,
      creativeBrief: "festival opener",
      signatureHooks: ["big lead", "vocal chop"],
    });

    const resolved = resolveTrackInput(workspace, track);

    assert.equal(resolved.creativeBrief, "festival opener");
    assert.deepEqual(resolved.signatureHooks, ["big lead", "vocal chop"]);
  } finally {
    cleanup(dir);
  }
});

// ─── markTrackGenerated ─────────────────────────────────────────────────────────

test("markTrackGenerated sets packageGenerated on the correct track", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "EP" });
    addTrackToWorkspace({ outputDir: dir, trackName: "Track A", tempo: 150 });
    addTrackToWorkspace({ outputDir: dir, trackName: "Track B", tempo: 148 });

    markTrackGenerated(dir, "track-a");

    const ws = readWorkspace(dir);
    assert.equal(ws.tracks[0].packageGenerated, true);
    assert.equal(ws.tracks[1].packageGenerated, false);
  } finally {
    cleanup(dir);
  }
});

// ─── getWorkspaceSummary ────────────────────────────────────────────────────────

test("getWorkspaceSummary returns correct counts and fields", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({
      outputDir: dir,
      name: "Summary Test",
      bpmRange: { min: 140, max: 160 },
      defaults: { styleVariant: "rawphoric", leadStyle: "screech" },
    });
    addTrackToWorkspace({ outputDir: dir, trackName: "Alpha", tempo: 150 });
    addTrackToWorkspace({
      outputDir: dir,
      trackName: "Beta",
      tempo: 155,
      overrides: { mood: "aggressive" },
    });
    markTrackGenerated(dir, "alpha");

    const summary = getWorkspaceSummary(dir);

    assert.equal(summary.name, "Summary Test");
    assert.equal(summary.trackCount, 2);
    assert.equal(summary.generatedCount, 1);
    assert.deepEqual(summary.bpmRange, { min: 140, max: 160 });
    assert.ok(summary.defaultsSet.includes("styleVariant"));
    assert.ok(summary.defaultsSet.includes("leadStyle"));
    assert.equal(summary.tracks[0].overrideCount, 0);
    assert.equal(summary.tracks[1].overrideCount, 1);
  } finally {
    cleanup(dir);
  }
});
