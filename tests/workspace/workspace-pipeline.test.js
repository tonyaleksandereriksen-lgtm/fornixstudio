
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createWorkspace,
  createWorkspaceFromTemplate,
  addTrackToWorkspace,
  generateWorkspacePackages,
  readWorkspace,
} from "../../dist/services/workspace-profile.js";
import { listTemplates } from "../../dist/services/template-library.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fornix-pipe-test-"));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── generateWorkspacePackages ──────────────────────────────────────────────────

test("generateWorkspacePackages generates packages for all tracks", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({
      outputDir: dir,
      name: "Dark EP",
      defaults: { styleVariant: "rawphoric", leadStyle: "screech" },
    });
    addTrackToWorkspace({ outputDir: dir, trackName: "Track Alpha", tempo: 150 });
    addTrackToWorkspace({ outputDir: dir, trackName: "Track Beta", tempo: 148 });

    const result = generateWorkspacePackages(dir);

    assert.equal(result.workspaceName, "Dark EP");
    assert.equal(result.generated.length, 2);
    assert.equal(result.skipped.length, 0);
    assert.equal(result.alreadyGenerated.length, 0);

    // Verify packages exist on disk
    for (const g of result.generated) {
      assert.ok(fs.existsSync(g.packageRoot), `Package root should exist: ${g.packageRoot}`);
      const metaPath = path.join(g.packageRoot, "00_Metadata", "Package_Metadata.json");
      assert.ok(fs.existsSync(metaPath), `Metadata should exist for ${g.trackSlug}`);

      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      assert.equal(meta.workspaceRef, "Dark EP", "workspaceRef should be set");
    }

    // Verify workspace tracks are marked as generated
    const ws = readWorkspace(dir);
    assert.ok(ws.tracks[0].packageGenerated);
    assert.ok(ws.tracks[1].packageGenerated);
  } finally {
    cleanup(dir);
  }
});

test("generateWorkspacePackages skips already-generated tracks by default", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "EP" });
    addTrackToWorkspace({ outputDir: dir, trackName: "Done", tempo: 150 });
    addTrackToWorkspace({ outputDir: dir, trackName: "New", tempo: 148 });

    // Generate first time
    generateWorkspacePackages(dir);

    // Generate again — "Done" should be skipped
    const result = generateWorkspacePackages(dir);

    assert.equal(result.alreadyGenerated.length, 2);
    assert.equal(result.generated.length, 0);
  } finally {
    cleanup(dir);
  }
});

test("generateWorkspacePackages regenerates all when regenerate=true", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "EP" });
    addTrackToWorkspace({ outputDir: dir, trackName: "Track A", tempo: 150 });

    generateWorkspacePackages(dir);
    const result = generateWorkspacePackages(dir, { regenerate: true });

    assert.equal(result.generated.length, 1);
    assert.equal(result.alreadyGenerated.length, 0);
  } finally {
    cleanup(dir);
  }
});

test("generateWorkspacePackages throws when workspace has no tracks", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({ outputDir: dir, name: "Empty" });
    assert.throws(
      () => generateWorkspacePackages(dir),
      /no tracks/i,
    );
  } finally {
    cleanup(dir);
  }
});

test("generateWorkspacePackages applies workspace inheritance to generated packages", () => {
  const dir = makeTempDir();
  try {
    createWorkspace({
      outputDir: dir,
      name: "Inherited EP",
      defaults: { styleVariant: "rawphoric", leadStyle: "screech", mood: "dark aggression" },
    });
    addTrackToWorkspace({
      outputDir: dir,
      trackName: "Raw Track",
      tempo: 155,
      overrides: { leadStyle: "hybrid" },
    });

    const result = generateWorkspacePackages(dir);

    const metaPath = path.join(result.generated[0].packageRoot, "00_Metadata", "Package_Metadata.json");
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

    assert.equal(meta.styleVariant, "rawphoric", "should inherit workspace default");
    assert.equal(meta.leadStyle, "hybrid", "track override should win");
    assert.equal(meta.tempo, 155);
  } finally {
    cleanup(dir);
  }
});

// ─── createWorkspaceFromTemplate ────────────────────────────────────────────────

test("createWorkspaceFromTemplate populates defaults from template", () => {
  const dir = makeTempDir();
  try {
    const ws = createWorkspaceFromTemplate({
      outputDir: dir,
      name: "Raw EP",
      templateId: "rawphoric-banger",
    });

    assert.equal(ws.name, "Raw EP");
    assert.equal(ws.defaults.styleVariant, "rawphoric");
    assert.equal(ws.defaults.leadStyle, "screech");
    assert.equal(ws.defaults.dropStrategy, "double-anti-climax");
    assert.equal(ws.defaults.energyProfile, "front-loaded");
    assert.ok(ws.defaults.kickStyle);
    assert.ok(ws.defaults.mixConcerns && ws.defaults.mixConcerns.length > 0);
  } finally {
    cleanup(dir);
  }
});

test("createWorkspaceFromTemplate throws for unknown template", () => {
  const dir = makeTempDir();
  try {
    assert.throws(
      () => createWorkspaceFromTemplate({ outputDir: dir, name: "Bad", templateId: "nonexistent" }),
      /not found/,
    );
  } finally {
    cleanup(dir);
  }
});

test("createWorkspaceFromTemplate respects custom artist and BPM range", () => {
  const dir = makeTempDir();
  try {
    const ws = createWorkspaceFromTemplate({
      outputDir: dir,
      name: "Festival Set",
      templateId: "anthemic-festival",
      artistName: "TestArtist",
      bpmRange: { min: 145, max: 155 },
    });

    assert.equal(ws.artistName, "TestArtist");
    assert.deepEqual(ws.bpmRange, { min: 145, max: 155 });
    assert.equal(ws.defaults.styleVariant, "festival-hardstyle");
  } finally {
    cleanup(dir);
  }
});

test("full pipeline: template → workspace → add tracks → generate packages", () => {
  const dir = makeTempDir();
  try {
    // Create workspace from template
    createWorkspaceFromTemplate({
      outputDir: dir,
      name: "Cinematic EP",
      templateId: "cinematic-euphoric-epic",
      bpmRange: { min: 145, max: 155 },
    });

    // Add tracks
    addTrackToWorkspace({
      outputDir: dir,
      trackName: "Cathedral of Ruin",
      tempo: 150,
      creativeBrief: "Dark cathedral atmosphere",
      signatureHooks: ["cathedral motif"],
    });
    addTrackToWorkspace({
      outputDir: dir,
      trackName: "Eternal Horizon",
      tempo: 148,
      creativeBrief: "Expansive euphoric journey",
      overrides: { energyProfile: "steady-escalation" },
    });

    // Generate all packages
    const result = generateWorkspacePackages(dir);

    assert.equal(result.generated.length, 2);
    assert.equal(result.skipped.length, 0);

    // Verify both packages inherit template defaults
    for (const g of result.generated) {
      const metaPath = path.join(g.packageRoot, "00_Metadata", "Package_Metadata.json");
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      assert.equal(meta.styleVariant, "cinematic-euphoric");
      assert.equal(meta.leadStyle, "euphoric");
      assert.equal(meta.workspaceRef, "Cinematic EP");
    }

    // Verify the overridden track has its override applied
    const horizonMeta = JSON.parse(fs.readFileSync(
      path.join(result.generated[1].packageRoot, "00_Metadata", "Package_Metadata.json"),
      "utf8",
    ));
    assert.equal(horizonMeta.energyProfile, "steady-escalation");

    // Verify workspace shows all tracks as generated
    const ws = readWorkspace(dir);
    assert.equal(ws.tracks.filter((t) => t.packageGenerated).length, 2);
  } finally {
    cleanup(dir);
  }
});
