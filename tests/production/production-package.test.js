
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  FORNIX_OUTPUT_ROOT,
  PACKAGE_LAYOUT,
  PACKAGE_METADATA_LAYOUT,
  buildMixActions,
  getPackageSummary,
  planPackageUpdate,
  previewPackageUpdate,
  regenerateProductionPackageSection,
  writeProductionPackage,
} from "../../dist/services/production-package.js";
import { registerProductionPackageTools } from "../../dist/tools/production-package.js";

const HEADER_LABELS = {
  styleVariant: "Style",
  leadStyle: "Lead focus",
  dropStrategy: "Drop strategy",
  energyProfile: "Energy profile",
  substyle: "Substyle",
  vocalMode: "Vocal mode",
  kickStyle: "Kick style",
  antiClimaxStyle: "Anti-climax style",
  arrangementFocus: "Arrangement focus",
  cinematicIntensity: "Cinematic intensity",
  aggressionLevel: "Aggression level",
  emotionalTone: "Emotional tone",
};

const PROFILE_SECTIONS = {
  project_plan: PACKAGE_LAYOUT.projectPlan,
  routing: PACKAGE_LAYOUT.routing,
  automation: PACKAGE_LAYOUT.automation,
  sound_design: PACKAGE_LAYOUT.soundDesign,
  checklist: PACKAGE_LAYOUT.checklists,
};

function createBaseInput(tempRoot) {
  return {
    outputDir: tempRoot,
    trackName: "Cathedral of Ruin",
    artistName: "Fornix",
    tempo: 150,
    keySignature: "F# minor",
    styleVariant: "rawphoric",
    leadStyle: "hybrid",
    dropStrategy: "anti-climax-to-melodic",
    energyProfile: "late-payoff",
    targetBars: 160,
    creativeBrief: "Dark cinematic intro, hostile anti-climax pressure, emotional final payoff.",
    mixConcerns: ["kick tail against reverse bass", "lead harshness in the climax", "wet FX before the drop"],
    signatureHooks: ["cathedral motif", "hybrid lead", "hostile anti-climax"],
    substyle: "rawphoric",
    kickStyle: "hard transient tok with gritty tail control",
    antiClimaxStyle: "aggressive screech-led anti-climax",
    arrangementFocus: "long-form tension and reveal",
    vocalMode: "featured-vocal",
    djUtilityPriority: "high",
    referenceNotes: ["intro must feel cinematic not filler", "save widest lead for final payoff"],
    sectionGoals: {
      Intro: "Establish ruin atmosphere without revealing the drop payload.",
      "Drop 1": "Hit with anti-climax pressure and keep the kick center dominant.",
    },
    cinematicIntensity: "high",
    aggressionLevel: "high",
    emotionalTone: "melancholic but violent",
    mood: "dark cathedral tension",
    focus: "drop contrast and hook clarity",
    concerns: ["vocal center conflict", "transition wash"],
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function extractHeaderValue(markdown, label) {
  const match = markdown.match(new RegExp(`- \\*\\*${label}:\\*\\* (.+)`));
  return match ? match[1].trim() : null;
}

function getSectionProfile(metadata, section) {
  return metadata.sectionResolvedProfiles?.[section] ?? metadata.resolvedProfile;
}

function assertHeaderMatchesSectionProfile(markdown, sectionProfile, prefix) {
  for (const [field, label] of Object.entries(HEADER_LABELS)) {
    assert.equal(
      extractHeaderValue(markdown, label),
      sectionProfile[field],
      `${prefix}: expected ${field}=${sectionProfile[field]}`,
    );
  }
}

test("production package writer creates metadata plus the standardized Fornix folder structure", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fornix-package-"));
  const input = createBaseInput(tempRoot);
  const result = writeProductionPackage(input);

  const packageRoot = path.join(tempRoot, FORNIX_OUTPUT_ROOT, "cathedral-of-ruin");
  assert.equal(result.packageRoot, packageRoot);
  assert.ok(fs.existsSync(packageRoot));

  const metadataPath = path.join(packageRoot, PACKAGE_METADATA_LAYOUT.dir, PACKAGE_METADATA_LAYOUT.filename);
  assert.equal(result.metadataPath, metadataPath);
  assert.ok(fs.existsSync(metadataPath));

  const metadata = readJson(metadataPath);
  assert.equal(metadata.trackName, input.trackName);
  assert.equal(metadata.trackSlug, "cathedral-of-ruin");
  assert.equal(metadata.generatorTool, "fornix_generate_production_package");
  assert.equal(metadata.packageFormatVersion, "1.1.0");
  assert.ok(metadata.resolvedProfile);
  assert.ok(metadata.sectionResolvedProfiles);
  assert.ok(Array.isArray(metadata.updatedSections));
  assert.ok(metadata.updatedSections.includes("routing"));

  for (const layout of Object.values(PACKAGE_LAYOUT)) {
    const filePath = path.join(packageRoot, layout.dir, layout.filename);
    assert.ok(fs.existsSync(filePath), `missing file ${filePath}`);
  }

  for (const [section, layout] of Object.entries(PROFILE_SECTIONS)) {
    const markdown = readText(path.join(packageRoot, layout.dir, layout.filename));
    assertHeaderMatchesSectionProfile(markdown, getSectionProfile(metadata, section), section);
  }

  const mixReport = readText(path.join(packageRoot, PACKAGE_LAYOUT.mix.dir, PACKAGE_LAYOUT.mix.filename));
  assert.match(mixReport, /Section:/i);
  assert.match(mixReport, /Likely issue:/i);
  assert.match(mixReport, /Priority:/i);
});

test("writeProductionPackage creates the standard Fornix package structure with aligned section profiles", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fornix-package-"));
  const result = writeProductionPackage(createBaseInput(tempRoot));

  const packageRoot = path.join(tempRoot, FORNIX_OUTPUT_ROOT, "cathedral-of-ruin");
  assert.equal(result.packageRoot, packageRoot);

  const metadataPath = path.join(packageRoot, PACKAGE_METADATA_LAYOUT.dir, PACKAGE_METADATA_LAYOUT.filename);
  assert.ok(fs.existsSync(metadataPath));

  const metadata = readJson(metadataPath);
  assert.equal(metadata.generatorTool, "fornix_generate_production_package");
  assert.ok(metadata.resolvedProfile);
  assert.ok(metadata.sectionResolvedProfiles);

  for (const [section, layout] of Object.entries(PROFILE_SECTIONS)) {
    const markdown = readText(path.join(packageRoot, layout.dir, layout.filename));
    assertHeaderMatchesSectionProfile(markdown, getSectionProfile(metadata, section), section);
  }
});

test("full generation resolves missing optional profile inputs once and uses that same profile everywhere", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fornix-resolved-"));
  const input = createBaseInput(tempRoot);
  input.styleVariant = "cinematic-euphoric";
  input.leadStyle = "euphoric";
  input.energyProfile = "patient-cinematic";
  delete input.substyle;
  delete input.kickStyle;
  delete input.antiClimaxStyle;
  delete input.arrangementFocus;
  delete input.vocalMode;
  delete input.cinematicIntensity;
  delete input.aggressionLevel;
  delete input.emotionalTone;

  const result = writeProductionPackage(input);
  const metadata = readJson(result.metadataPath);

  assert.equal(metadata.resolvedProfile.vocalMode, "featured-vocal");
  assert.equal(metadata.vocalMode, "featured-vocal");
  assert.equal(metadata.resolvedProfile.substyle, "cinematic-euphoric");
  assert.equal(metadata.resolvedProfile.kickStyle, "clean hardstyle tok with controlled body and mono tail discipline");
  assert.equal(metadata.resolvedProfile.antiClimaxStyle, "controlled anti-climax with melodic contrast");
  assert.equal(metadata.resolvedProfile.arrangementFocus, "long-form tension and reveal");
  assert.equal(metadata.resolvedProfile.cinematicIntensity, "high");
  assert.equal(metadata.resolvedProfile.aggressionLevel, "medium");

  for (const [section, layout] of Object.entries(PROFILE_SECTIONS)) {
    const markdown = readText(path.join(result.packageRoot, layout.dir, layout.filename));
    assertHeaderMatchesSectionProfile(markdown, metadata.resolvedProfile, `full-generation ${section}`);
  }
});

test("package summary reports package health and override state honestly", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fornix-summary-"));
  const input = createBaseInput(tempRoot);
  const result = writeProductionPackage(input);

  const summary = getPackageSummary({
    outputDir: tempRoot,
    trackName: input.trackName,
  });

  assert.equal(summary.complete, true);
  assert.equal(summary.metadataExists, true);
  assert.equal(summary.metadata?.trackName, input.trackName);
  assert.equal(summary.metadata?.vocalMode, "featured-vocal");
  assert.deepEqual(summary.missingDocuments, []);
  assert.ok(summary.documents.mix.exists);
  assert.ok(summary.documents.routing.exists);
  assert.equal(summary.packageCompleteness, "complete");
  assert.equal(summary.hasSectionOverrides, false);
  assert.deepEqual(summary.overriddenSections, []);
  assert.equal(summary.packageHealth, "healthy");
  assert.match(summary.packageConsistencySummary, /aligned/i);
  assert.equal(summary.metadataPath, result.metadataPath);
});

test("mix actions are actionable, section-aware, and sorted by priority", () => {
  const actions = buildMixActions({
    outputDir: ".",
    trackName: "Pressure Bloom",
    artistName: "Fornix",
    tempo: 150,
    keySignature: "A minor",
    styleVariant: "rawphoric",
    leadStyle: "hybrid",
    dropStrategy: "anti-climax-to-melodic",
    energyProfile: "late-payoff",
    targetBars: 160,
    mixConcerns: ["stereo sub", "lead harshness", "transition FX overload"],
    vocalMode: "featured-vocal",
    cinematicIntensity: "high",
  });

  assert.ok(actions.length >= 7);
  assert.ok(actions.some((action) => action.section === "anti-climax"));
  assert.ok(actions.some((action) => action.section === "breakdown"));

  for (const action of actions) {
    assert.ok(action.likelyIssue.length > 20);
    assert.ok(action.whyItMatters.length > 20);
    assert.ok(action.exactActionToTest.length > 30);
    assert.match(action.priority, /^P[1-3]$/);
  }

  const priorities = actions.map((action) => action.priority);
  const firstNonP1 = priorities.findIndex((value) => value !== "P1");
  if (firstNonP1 !== -1) {
    assert.ok(!priorities.slice(firstNonP1).includes("P1"));
  }
});

test("preview and planning stay read-only and expose override impact clearly", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fornix-preview-"));
  const result = writeProductionPackage(createBaseInput(tempRoot));

  const metadataStatBefore = fs.statSync(result.metadataPath).mtimeMs;
  const routingPath = path.join(result.packageRoot, PACKAGE_LAYOUT.routing.dir, PACKAGE_LAYOUT.routing.filename);
  const routingStatBefore = fs.statSync(routingPath).mtimeMs;

  const preview = previewPackageUpdate({
    packagePath: result.packageRoot,
    vocalMode: "instrumental",
  });

  const plan = planPackageUpdate({
    packagePath: result.packageRoot,
    vocalMode: "instrumental",
  });

  assert.equal(preview.metadataWouldChange, true);
  assert.equal(preview.currentPackageComplete, true);
  assert.equal(preview.hasSectionOverrides, false);
  assert.equal(preview.packageLevelProfileWouldChange, false);
  assert.equal(preview.wouldIntroduceSectionOverrides, true);
  assert.equal(preview.wouldLeaveSectionOverrides, false);
  assert.match(preview.overrideImpactSummary, /introduce section overrides/i);
  assert.deepEqual(preview.recommendedSections, plan.recommendedSections);
  assert.deepEqual(plan.primarySections, ["routing", "mix"]);
  assert.deepEqual(plan.secondarySections, ["sound_design", "checklist"]);
  assert.deepEqual(plan.optionalSections, ["project_plan"]);
  assert.ok(plan.sectionPlans.some((item) => item.section === "routing" && item.priority === "primary"));
  assert.ok(plan.sectionPlans.some((item) => item.section === "project_plan" && item.priority === "optional"));

  assert.equal(fs.statSync(result.metadataPath).mtimeMs, metadataStatBefore);
  assert.equal(fs.statSync(routingPath).mtimeMs, routingStatBefore);
});

test("preview and planning (legacy path) compare file mtimes — no writes", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fornix-plan-"));
  const input = createBaseInput(tempRoot);
  const result = writeProductionPackage(input);

  const metadataStatsBefore = fs.statSync(result.metadataPath).mtimeMs;
  const routingPath = path.join(result.packageRoot, PACKAGE_LAYOUT.routing.dir, PACKAGE_LAYOUT.routing.filename);
  const routingStatsBefore = fs.statSync(routingPath).mtimeMs;

  previewPackageUpdate({
    packagePath: result.packageRoot,
    vocalMode: "instrumental",
  });

  assert.equal(fs.statSync(result.metadataPath).mtimeMs, metadataStatsBefore);
  assert.equal(fs.statSync(routingPath).mtimeMs, routingStatsBefore);
});

test("selective regeneration keeps package-level profile unchanged and stores honest section overrides", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fornix-regen-"));
  const result = writeProductionPackage(createBaseInput(tempRoot));

  const projectPlanPath = path.join(result.packageRoot, PACKAGE_LAYOUT.projectPlan.dir, PACKAGE_LAYOUT.projectPlan.filename);
  const routingPath = path.join(result.packageRoot, PACKAGE_LAYOUT.routing.dir, PACKAGE_LAYOUT.routing.filename);
  const automationPath = path.join(result.packageRoot, PACKAGE_LAYOUT.automation.dir, PACKAGE_LAYOUT.automation.filename);
  const soundDesignPath = path.join(result.packageRoot, PACKAGE_LAYOUT.soundDesign.dir, PACKAGE_LAYOUT.soundDesign.filename);

  const projectPlanBefore = readText(projectPlanPath);
  const routingBefore = readText(routingPath);
  const automationBefore = readText(automationPath);
  const soundDesignBefore = readText(soundDesignPath);
  const metadataBefore = readJson(result.metadataPath);

  const regen = regenerateProductionPackageSection({
    packagePath: result.packageRoot,
    section: "routing",
    vocalMode: "instrumental",
    djUtilityPriority: "low",
  });

  const metadataAfter = readJson(result.metadataPath);
  const projectPlanAfter = readText(projectPlanPath);
  const routingAfter = readText(routingPath);
  const automationAfter = readText(automationPath);
  const soundDesignAfter = readText(soundDesignPath);

  assert.equal(regen.updatedSection, "routing");
  assert.equal(regen.updatedSectionPriority, "primary");
  assert.ok(regen.sectionJustifyingProfileFields.includes("vocalMode"));
  assert.ok(regen.remainingRecommendedSections.includes("mix"));
  assert.equal(regen.packageLevelProfileRemainsUnchanged, true);
  assert.equal(regen.hasSectionOverridesAfterUpdate, true);
  assert.ok(regen.overriddenSectionsAfterUpdate.includes("routing"));
  assert.equal(regen.packageHealthAfterUpdate, "mixed-overrides");
  assert.match(regen.packageConsistencySummaryAfterUpdate, /section overrides exist/i);

  assert.equal(metadataAfter.vocalMode, metadataBefore.vocalMode);
  assert.equal(metadataAfter.vocalMode, "featured-vocal");
  assert.equal(metadataAfter.resolvedProfile.vocalMode, "featured-vocal");
  assert.equal(metadataAfter.sectionResolvedProfiles.routing.vocalMode, "instrumental");
  assert.equal(metadataAfter.sectionResolvedProfiles.routing.djUtilityPriority, "low");
  assert.equal(metadataAfter.sectionResolvedProfiles.project_plan.vocalMode, "featured-vocal");

  assert.equal(projectPlanAfter, projectPlanBefore);
  assert.equal(automationAfter, automationBefore);
  assert.equal(soundDesignAfter, soundDesignBefore);
  assert.notEqual(routingAfter, routingBefore);

  assertHeaderMatchesSectionProfile(projectPlanAfter, metadataAfter.sectionResolvedProfiles.project_plan, "project_plan");
  assertHeaderMatchesSectionProfile(routingAfter, metadataAfter.sectionResolvedProfiles.routing, "routing");
  assertHeaderMatchesSectionProfile(automationAfter, metadataAfter.sectionResolvedProfiles.automation, "automation");
  assertHeaderMatchesSectionProfile(soundDesignAfter, metadataAfter.sectionResolvedProfiles.sound_design, "sound_design");

  const summary = getPackageSummary({ packagePath: result.packageRoot });
  assert.equal(summary.hasSectionOverrides, true);
  assert.ok(summary.overriddenSections.includes("routing"));
  assert.equal(summary.packageHealth, "mixed-overrides");
});

test("production package tools register generation, summary, regeneration, and mix tools", () => {
  const names = [];
  const fakeServer = {
    registerTool(name) {
      names.push(name);
    },
  };

  registerProductionPackageTools(fakeServer);
  assert.deepEqual(names, [
    "fornix_generate_production_package",
    "fornix_generate_mix_actions",
    "fornix_preview_package_update",
    "fornix_plan_package_update",
    "fornix_regenerate_package_section",
    "fornix_get_package_summary",
  ]);
});
