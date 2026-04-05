
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  batchRegeneratePackage,
  writeProductionPackage,
  getPackageSummary,
} from "../../dist/services/production-package.js";

function createBaseInput(tempRoot) {
  return {
    outputDir: tempRoot,
    trackName: "Batch Test Track",
    artistName: "Fornix",
    tempo: 150,
    keySignature: "F# minor",
    styleVariant: "cinematic-euphoric",
    leadStyle: "euphoric",
    dropStrategy: "anti-climax-to-melodic",
    energyProfile: "steady-escalation",
    targetBars: 160,
  };
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fornix-batch-test-"));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test("batchRegeneratePackage regenerates all sections when no sections specified and profile changed", () => {
  const dir = makeTempDir();
  try {
    const input = createBaseInput(dir);
    const result = writeProductionPackage(input);

    const batchResult = batchRegeneratePackage({
      packagePath: result.packageRoot,
      styleVariant: "rawphoric",
      leadStyle: "screech",
    });

    assert.ok(batchResult.regeneratedSections.length > 0, "should regenerate sections");
    assert.equal(batchResult.skippedSections.length, 0, "no sections should be skipped");
    assert.equal(batchResult.updatedFiles.length, batchResult.regeneratedSections.length);
    assert.ok(batchResult.changedProfileFields.length > 0, "profile fields should have changed");
    assert.equal(batchResult.metadata.trackName, "Batch Test Track");
  } finally {
    cleanup(dir);
  }
});

test("batchRegeneratePackage regenerates only specified sections", () => {
  const dir = makeTempDir();
  try {
    const input = createBaseInput(dir);
    const result = writeProductionPackage(input);

    const batchResult = batchRegeneratePackage({
      packagePath: result.packageRoot,
      sections: ["project_plan", "mix"],
      styleVariant: "rawphoric",
    });

    assert.deepEqual(batchResult.regeneratedSections, ["project_plan", "mix"]);
    assert.equal(batchResult.updatedFiles.length, 2);
  } finally {
    cleanup(dir);
  }
});

test("batchRegeneratePackage leaves package complete after full regeneration", () => {
  const dir = makeTempDir();
  try {
    const input = createBaseInput(dir);
    const result = writeProductionPackage(input);

    const batchResult = batchRegeneratePackage({
      packagePath: result.packageRoot,
      styleVariant: "rawphoric",
      leadStyle: "screech",
    });

    assert.ok(batchResult.packageSummary.complete, "package should be complete after full regen");
    // All sections regenerated with the new profile; section overrides exist because
    // the package-level profile stays at the original values while sections get the new values.
    assert.ok(batchResult.regeneratedSections.length >= 6, "all sections should be regenerated");
  } finally {
    cleanup(dir);
  }
});

test("batchRegeneratePackage throws when metadata is missing", () => {
  const dir = makeTempDir();
  try {
    // Create a fake package root with no metadata
    const fakeRoot = path.join(dir, "Fornix", "no-metadata");
    fs.mkdirSync(fakeRoot, { recursive: true });

    assert.throws(
      () => batchRegeneratePackage({ packagePath: fakeRoot }),
      /metadata is missing/i,
    );
  } finally {
    cleanup(dir);
  }
});
