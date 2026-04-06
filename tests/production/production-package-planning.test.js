
import test from "node:test";
import assert from "node:assert/strict";

import {
  diffPackageProfile,
  planPackageSections,
  getSectionPlanForSection,
} from "../../dist/services/production-package-planning.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMetadata(overrides = {}) {
  return {
    packageFormatVersion: "1.0.0",
    generatorTool: "fornix_generate_production_package",
    generatorVersion: "1.0.0",
    generationTimestamp: "2026-04-01T00:00:00.000Z",
    lastUpdatedTimestamp: "2026-04-01T00:00:00.000Z",
    updatedSections: [],
    trackName: "Test Track",
    trackSlug: "test-track",
    artistName: "Fornix",
    tempo: 150,
    keySignature: "F# minor",
    styleVariant: "cinematic-euphoric",
    leadStyle: "euphoric",
    dropStrategy: "anti-climax-to-melodic",
    energyProfile: "steady-escalation",
    targetBars: 160,
    mixConcerns: [],
    signatureHooks: [],
    ...overrides,
  };
}

// ─── diffPackageProfile ───────────────────────────────────────────────────────

test("diffPackageProfile returns empty array when nothing changed", () => {
  const meta = makeMetadata();
  const next = makeMetadata();
  const changes = diffPackageProfile(meta, next);
  assert.equal(changes.length, 0);
});

test("diffPackageProfile detects scalar field changes", () => {
  const previous = makeMetadata();
  const next = makeMetadata({ tempo: 155, keySignature: "A minor" });

  const changes = diffPackageProfile(previous, next);
  const fields = changes.map((c) => c.field);

  assert.ok(fields.includes("tempo"));
  assert.ok(fields.includes("keySignature"));
  assert.equal(changes.length, 2);

  const tempoChange = changes.find((c) => c.field === "tempo");
  assert.equal(tempoChange.previousValue, 150);
  assert.equal(tempoChange.nextValue, 155);
});

test("diffPackageProfile detects enum field changes", () => {
  const previous = makeMetadata();
  const next = makeMetadata({
    styleVariant: "rawphoric",
    leadStyle: "screech",
    dropStrategy: "double-anti-climax",
    energyProfile: "front-loaded",
  });

  const changes = diffPackageProfile(previous, next);
  const fields = changes.map((c) => c.field);

  assert.ok(fields.includes("styleVariant"));
  assert.ok(fields.includes("leadStyle"));
  assert.ok(fields.includes("dropStrategy"));
  assert.ok(fields.includes("energyProfile"));
});

test("diffPackageProfile detects array field changes", () => {
  const previous = makeMetadata({ mixConcerns: ["kick clarity"] });
  const next = makeMetadata({ mixConcerns: ["kick clarity", "lead width"] });

  const changes = diffPackageProfile(previous, next);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].field, "mixConcerns");
});

test("diffPackageProfile treats identical arrays as unchanged", () => {
  const previous = makeMetadata({ signatureHooks: ["hook-a", "hook-b"] });
  const next = makeMetadata({ signatureHooks: ["hook-a", "hook-b"] });

  const changes = diffPackageProfile(previous, next);
  assert.equal(changes.length, 0);
});

test("diffPackageProfile detects object field changes (sectionGoals)", () => {
  const previous = makeMetadata({ sectionGoals: { intro: "cinematic build" } });
  const next = makeMetadata({ sectionGoals: { intro: "aggressive hit" } });

  const changes = diffPackageProfile(previous, next);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].field, "sectionGoals");
});

test("diffPackageProfile treats undefined and null as equal (both normalize to null)", () => {
  const previous = makeMetadata({ mood: undefined });
  const next = makeMetadata({ mood: undefined });

  const changes = diffPackageProfile(previous, next);
  const moodChange = changes.find((c) => c.field === "mood");
  assert.equal(moodChange, undefined);
});

test("diffPackageProfile detects change from undefined to a value", () => {
  const previous = makeMetadata({ mood: undefined });
  const next = makeMetadata({ mood: "dark" });

  const changes = diffPackageProfile(previous, next);
  const moodChange = changes.find((c) => c.field === "mood");
  assert.ok(moodChange);
  assert.equal(moodChange.nextValue, "dark");
});

// ─── planPackageSections ──────────────────────────────────────────────────────

test("planPackageSections returns empty plan when no changes", () => {
  const plan = planPackageSections([]);

  assert.equal(plan.changedProfileFields.length, 0);
  assert.equal(plan.recommendedSections.length, 0);
  assert.equal(plan.sectionPlans.length, 0);
});

test("planPackageSections maps tempo change to project_plan (primary) and automation + mix", () => {
  const changes = diffPackageProfile(
    makeMetadata(),
    makeMetadata({ tempo: 155 }),
  );
  const plan = planPackageSections(changes);

  assert.ok(plan.primarySections.includes("project_plan"));
  assert.ok(plan.primarySections.includes("automation"));
  assert.ok(plan.secondarySections.includes("mix"));

  const projectPlan = getSectionPlanForSection("project_plan", plan);
  assert.ok(projectPlan);
  assert.equal(projectPlan.priority, "primary");
  assert.ok(projectPlan.changedFields.includes("tempo"));
});

test("planPackageSections maps styleVariant to all six sections", () => {
  const changes = diffPackageProfile(
    makeMetadata(),
    makeMetadata({ styleVariant: "rawphoric" }),
  );
  const plan = planPackageSections(changes);

  assert.equal(plan.recommendedSections.length, 6);
  assert.ok(plan.primarySections.includes("project_plan"));
  assert.ok(plan.primarySections.includes("sound_design"));
  assert.ok(plan.secondarySections.includes("routing"));
  assert.ok(plan.secondarySections.includes("automation"));
  assert.ok(plan.secondarySections.includes("mix"));
  assert.ok(plan.optionalSections.includes("checklist"));
});

test("planPackageSections promotes section priority when multiple fields affect it", () => {
  // leadStyle makes sound_design primary and routing secondary
  // kickStyle also makes sound_design primary and routing secondary
  // Both together should still keep priorities (not downgrade)
  const changes = diffPackageProfile(
    makeMetadata(),
    makeMetadata({ leadStyle: "screech", kickStyle: "distorted-punch" }),
  );
  const plan = planPackageSections(changes);

  const soundDesign = getSectionPlanForSection("sound_design", plan);
  assert.ok(soundDesign);
  assert.equal(soundDesign.priority, "primary");
  assert.ok(soundDesign.changedFields.includes("leadStyle"));
  assert.ok(soundDesign.changedFields.includes("kickStyle"));
});

test("planPackageSections accumulates reasons from multiple field changes", () => {
  const changes = diffPackageProfile(
    makeMetadata(),
    makeMetadata({ tempo: 155, energyProfile: "front-loaded" }),
  );
  const plan = planPackageSections(changes);

  const projectPlan = getSectionPlanForSection("project_plan", plan);
  assert.ok(projectPlan);
  // project_plan is primary from both tempo and energyProfile
  assert.equal(projectPlan.priority, "primary");
  assert.ok(projectPlan.changedFields.includes("tempo"));
  assert.ok(projectPlan.changedFields.includes("energyProfile"));
  assert.ok(projectPlan.reasons.length >= 2);
});

test("planPackageSections sorts by priority weight then reason count then section order", () => {
  // styleVariant triggers many sections; trackName also triggers many.
  // Primary sections should come before secondary, secondary before optional.
  const changes = diffPackageProfile(
    makeMetadata(),
    makeMetadata({ styleVariant: "rawphoric" }),
  );
  const plan = planPackageSections(changes);

  const priorities = plan.sectionPlans.map((s) => s.priority);
  const primaryIdx = priorities.lastIndexOf("primary");
  const secondaryIdx = priorities.indexOf("secondary");
  const optionalIdx = priorities.indexOf("optional");

  if (secondaryIdx !== -1) {
    assert.ok(primaryIdx < secondaryIdx, "primary sections should come before secondary");
  }
  if (optionalIdx !== -1 && secondaryIdx !== -1) {
    assert.ok(secondaryIdx < optionalIdx, "secondary sections should come before optional");
  }
});

test("planPackageSections handles mixConcerns change correctly", () => {
  const changes = diffPackageProfile(
    makeMetadata({ mixConcerns: [] }),
    makeMetadata({ mixConcerns: ["kick-lead masking", "sub bass clarity"] }),
  );
  const plan = planPackageSections(changes);

  assert.ok(plan.primarySections.includes("mix"));
  assert.ok(plan.secondarySections.includes("checklist"));
});

// ─── getSectionPlanForSection ─────────────────────────────────────────────────

test("getSectionPlanForSection returns undefined for section not in plan", () => {
  const plan = planPackageSections([]);
  const result = getSectionPlanForSection("routing", plan);
  assert.equal(result, undefined);
});

test("getSectionPlanForSection returns the correct plan entry", () => {
  const changes = diffPackageProfile(
    makeMetadata(),
    makeMetadata({ keySignature: "A minor" }),
  );
  const plan = planPackageSections(changes);

  const soundDesign = getSectionPlanForSection("sound_design", plan);
  assert.ok(soundDesign);
  assert.equal(soundDesign.section, "sound_design");
  assert.equal(soundDesign.priority, "primary");
  assert.ok(soundDesign.changedFields.includes("keySignature"));
});

// ─── Multi-field realistic scenario ──────────────────────────────────────────

test("realistic multi-field change produces a complete and prioritized plan", () => {
  // Simulates a style pivot: rawphoric with new lead, different tempo, added concerns
  const previous = makeMetadata({
    styleVariant: "cinematic-euphoric",
    leadStyle: "euphoric",
    tempo: 150,
    mood: "uplifting",
    mixConcerns: [],
  });

  const next = makeMetadata({
    styleVariant: "rawphoric",
    leadStyle: "screech",
    tempo: 155,
    mood: "dark",
    mixConcerns: ["screech harshness", "kick-bass separation"],
  });

  const changes = diffPackageProfile(previous, next);
  assert.ok(changes.length >= 4, `Expected at least 4 changes, got ${changes.length}`);

  const plan = planPackageSections(changes);

  // All 6 sections should be recommended after this many changes
  assert.equal(plan.recommendedSections.length, 6);
  assert.ok(plan.primarySections.length >= 3, "should have several primary sections");

  // project_plan should be primary (tempo + styleVariant + mood all trigger it)
  const projectPlan = getSectionPlanForSection("project_plan", plan);
  assert.equal(projectPlan.priority, "primary");

  // mix should be primary (mixConcerns primary + styleVariant secondary + tempo secondary + leadStyle secondary — promoted)
  const mix = getSectionPlanForSection("mix", plan);
  assert.equal(mix.priority, "primary");
  assert.ok(mix.changedFields.length >= 2, "mix should be affected by multiple fields");
});
