
import test from "node:test";
import assert from "node:assert/strict";

import { StudioOneAdapter } from "../../dist/daw/studio-one-adapter.js";
import { hasCapability } from "../../dist/daw/capabilities.js";
import { buildProducerPlan } from "../../dist/producer/orchestrator.js";
import { VALID_INTENT_IDS } from "../../dist/producer/intents.js";

// ─── StudioOneAdapter capability honesty ────────���────────────────────────────

test("StudioOneAdapter.getCapabilities returns all 10 capability names", async () => {
  const adapter = new StudioOneAdapter();
  const caps = await adapter.getCapabilities();
  const names = caps.map(c => c.name);

  assert.ok(names.includes("session.read"));
  assert.ok(names.includes("session.write"));
  assert.ok(names.includes("arrangement.read"));
  assert.ok(names.includes("arrangement.write"));
  assert.ok(names.includes("transport.control"));
  assert.ok(names.includes("track.control"));
  assert.ok(names.includes("plugin.context"));
  assert.ok(names.includes("audio.capture"));
  assert.ok(names.includes("render.read"));
  assert.ok(names.includes("rollback"));
  assert.equal(caps.length, 10);
});

test("StudioOneAdapter: no write capability is marked proven (without MCU)", async () => {
  const adapter = new StudioOneAdapter();
  const caps = await adapter.getCapabilities();

  for (const cap of caps) {
    if (cap.level === "write") {
      assert.notEqual(
        cap.status,
        "proven",
        `${cap.name} (write) should not be "proven" — MCU bridge not connected and not yet verified`,
      );
    }
  }
});

test("StudioOneAdapter: blocked capabilities have level none", async () => {
  const adapter = new StudioOneAdapter();
  const caps = await adapter.getCapabilities();

  const blocked = caps.filter(c => c.status === "blocked");
  for (const cap of blocked) {
    assert.equal(
      cap.level,
      "none",
      `${cap.name} is blocked but reports level "${cap.level}" — should be "none"`,
    );
  }
});

test("StudioOneAdapter: plugin.context, audio.capture, render.read are blocked", async () => {
  const adapter = new StudioOneAdapter();
  const caps = await adapter.getCapabilities();

  for (const name of ["plugin.context", "audio.capture", "render.read"]) {
    const cap = caps.find(c => c.name === name);
    assert.ok(cap, `Missing capability: ${name}`);
    assert.equal(cap.status, "blocked", `${name} should be blocked`);
    assert.equal(cap.level, "none", `${name} should have level none`);
  }
});

test("StudioOneAdapter: arrangement.write is blocked", async () => {
  const adapter = new StudioOneAdapter();
  const caps = await adapter.getCapabilities();
  const cap = caps.find(c => c.name === "arrangement.write");
  assert.ok(cap);
  assert.equal(cap.status, "blocked");
  assert.equal(cap.level, "none");
});

test("hasCapability returns false for blocked capabilities", async () => {
  const adapter = new StudioOneAdapter();
  const caps = await adapter.getCapabilities();

  assert.equal(hasCapability(caps, "plugin.context"), false);
  assert.equal(hasCapability(caps, "audio.capture"), false);
  assert.equal(hasCapability(caps, "arrangement.write", "write"), false);
});

// ─── Session snapshot without connections ────────────────────────────────────

test("StudioOneAdapter.getSessionSnapshot returns sane defaults without connections", async () => {
  const adapter = new StudioOneAdapter();
  const snap = await adapter.getSessionSnapshot();

  assert.equal(snap.dawId, "studio-one-7");
  assert.ok(snap.capturedAt);
  assert.ok(Array.isArray(snap.tracks));
  assert.ok(Array.isArray(snap.sections));
  assert.ok(Array.isArray(snap.warnings));
  assert.ok(snap.warnings.length > 0, "Should have at least one warning when nothing is connected");
});

// ─── Producer plan: critique-drop ──────────────��─────────────────────────────

test("buildProducerPlan returns a plan for critique-drop", async () => {
  const adapter = new StudioOneAdapter();
  const plan = await buildProducerPlan(adapter, { id: "critique-drop" });

  assert.equal(plan.intentId, "critique-drop");
  assert.equal(plan.title, "Critique this drop");
  assert.ok(plan.summary.length > 0);
  assert.ok(Array.isArray(plan.suggestions));
  assert.ok(plan.suggestions.length >= 2, "Should have at least 2 suggestions");
  assert.ok(Array.isArray(plan.capabilityReport));
  assert.ok(plan.capabilityReport.length > 0);
});

test("buildProducerPlan critique-drop: suggestions have required fields", async () => {
  const adapter = new StudioOneAdapter();
  const plan = await buildProducerPlan(adapter, { id: "critique-drop" });

  for (const s of plan.suggestions) {
    assert.ok(s.id, "Suggestion must have an id");
    assert.ok(s.title, "Suggestion must have a title");
    assert.ok(s.rationale, "Suggestion must have a rationale");
    assert.ok(["low", "medium", "high"].includes(s.confidence), `Invalid confidence: ${s.confidence}`);
  }
});

// ─── Producer plan: prepare-mastering ────────────────────────────────────────

test("buildProducerPlan returns a plan for prepare-mastering", async () => {
  const adapter = new StudioOneAdapter();
  const plan = await buildProducerPlan(adapter, { id: "prepare-mastering" });

  assert.equal(plan.intentId, "prepare-mastering");
  assert.ok(plan.title.toLowerCase().includes("master"));
  assert.ok(plan.suggestions.length >= 2);
});

// ─── Producer plan: session-overview ────────────────────────────────────���────

test("buildProducerPlan returns a plan for session-overview", async () => {
  const adapter = new StudioOneAdapter();
  const plan = await buildProducerPlan(adapter, { id: "session-overview" });

  assert.equal(plan.intentId, "session-overview");
  assert.ok(plan.title.toLowerCase().includes("overview"));
});

// ─── Producer plan: unknown intent fallback ────���─────────────────────────────

test("buildProducerPlan returns a sane fallback for suggest-arrangement", async () => {
  const adapter = new StudioOneAdapter();
  const plan = await buildProducerPlan(adapter, { id: "suggest-arrangement" });

  assert.equal(plan.intentId, "suggest-arrangement");
  assert.ok(plan.warnings.length > 0, "Unimplemented intent should have a warning");
});

// ─── Preview-only assertion ─────���────────────────────────────────────────────

test("StudioOneAdapter.applyAction returns not-implemented (preview-only)", async () => {
  const adapter = new StudioOneAdapter();
  const result = await adapter.applyAction({ actionId: "test-action" });

  assert.equal(result.applied, false, "No actions should be applied in preview mode");
  assert.ok(result.warnings.length > 0);
});

// ─── Critique-drop: target section resolution ───────────────────────────────

test("buildProducerPlan critique-drop with targetSectionId includes explicit target", async () => {
  const adapter = new StudioOneAdapter();
  const plan = await buildProducerPlan(adapter, {
    id: "critique-drop",
    targetSectionId: "Drop 1",
  });

  assert.equal(plan.intentId, "critique-drop");
  // Target section should exist and be marked explicit
  assert.ok(plan.targetSection, "Should have a targetSection when targetSectionId is provided");
  assert.equal(plan.targetSection.name, "Drop 1");
  assert.equal(plan.targetSection.source, "explicit");
});

test("buildProducerPlan critique-drop without targetSectionId still returns a sane plan", async () => {
  const adapter = new StudioOneAdapter();
  const plan = await buildProducerPlan(adapter, { id: "critique-drop" });

  assert.equal(plan.intentId, "critique-drop");
  assert.ok(plan.summary.length > 0, "Summary should not be empty");
  assert.ok(plan.suggestions.length >= 2, "Should have fallback suggestions even without a target");

  // Without watcher or MCU, targetSection should either be absent or source "none"
  if (plan.targetSection) {
    // If present, source must be "none" since nothing is connected
    assert.equal(
      plan.targetSection.source,
      "none",
      "Without connections, target source should be 'none'",
    );
  }
});

test("buildProducerPlan critique-drop with limited capabilities produces preview plan", async () => {
  const adapter = new StudioOneAdapter();
  const plan = await buildProducerPlan(adapter, { id: "critique-drop" });

  // Even with no MCU and no watcher, plan should be useful
  assert.equal(plan.intentId, "critique-drop");
  assert.equal(plan.analysisAvailable, false, "No analysis without watcher");

  // Should have warnings about missing capabilities
  assert.ok(plan.warnings.length > 0, "Should warn about missing capabilities");

  // Should still produce generic suggestions
  assert.ok(plan.suggestions.length >= 3, "Should have at least 3 generic suggestions");
  for (const s of plan.suggestions) {
    assert.ok(s.id, "Each suggestion needs an id");
    assert.ok(s.title, "Each suggestion needs a title");
    assert.ok(s.rationale, "Each suggestion needs a rationale");
    assert.ok(
      ["low", "medium", "high"].includes(s.confidence),
      `Invalid confidence: ${s.confidence}`,
    );
  }

  // Capability report should be present
  assert.ok(Array.isArray(plan.capabilityReport));
  assert.ok(plan.capabilityReport.length > 0);
});

// ─── Response contract stability ────────────────────────────────────────────

test("VALID_INTENT_IDS is a non-empty array of strings", () => {
  assert.ok(Array.isArray(VALID_INTENT_IDS));
  assert.ok(VALID_INTENT_IDS.length >= 5, "Should have at least 5 intent IDs");
  for (const id of VALID_INTENT_IDS) {
    assert.equal(typeof id, "string");
  }
});

test("every VALID_INTENT_ID produces a plan with the stable contract", async () => {
  const adapter = new StudioOneAdapter();

  for (const intentId of VALID_INTENT_IDS) {
    const plan = await buildProducerPlan(adapter, { id: intentId });

    // Required string fields
    assert.equal(typeof plan.intentId, "string", `${intentId}: intentId must be string`);
    assert.equal(plan.intentId, intentId, `${intentId}: intentId must match input`);
    assert.equal(typeof plan.title, "string", `${intentId}: title must be string`);
    assert.ok(plan.title.length > 0, `${intentId}: title must not be empty`);
    assert.equal(typeof plan.summary, "string", `${intentId}: summary must be string`);
    assert.ok(plan.summary.length > 0, `${intentId}: summary must not be empty`);

    // Required arrays
    assert.ok(Array.isArray(plan.warnings), `${intentId}: warnings must be array`);
    assert.ok(Array.isArray(plan.suggestions), `${intentId}: suggestions must be array`);
    assert.ok(Array.isArray(plan.capabilityReport), `${intentId}: capabilityReport must be array`);
    assert.ok(plan.capabilityReport.length > 0, `${intentId}: capabilityReport must not be empty`);

    // Boolean field
    assert.equal(typeof plan.analysisAvailable, "boolean", `${intentId}: analysisAvailable must be boolean`);

    // Suggestions contract
    for (const s of plan.suggestions) {
      assert.ok(s.id, `${intentId}: suggestion.id required`);
      assert.ok(s.title, `${intentId}: suggestion.title required`);
      assert.ok(s.rationale, `${intentId}: suggestion.rationale required`);
      assert.ok(
        ["low", "medium", "high"].includes(s.confidence),
        `${intentId}: invalid confidence "${s.confidence}"`,
      );
      // barRange, if present, must have start and end
      if (s.barRange) {
        assert.equal(typeof s.barRange.start, "number", `${intentId}: barRange.start must be number`);
        assert.equal(typeof s.barRange.end, "number", `${intentId}: barRange.end must be number`);
      }
    }

    // targetSection, if present, must have required fields
    if (plan.targetSection) {
      assert.equal(typeof plan.targetSection.name, "string");
      assert.equal(typeof plan.targetSection.startBar, "number");
      assert.equal(typeof plan.targetSection.lengthBars, "number");
      assert.ok(["explicit", "auto", "none"].includes(plan.targetSection.source));
    }
  }
});

// ─── Prepare-mastering enrichment ───────────────────────────────────────────

test("buildProducerPlan prepare-mastering returns enriched checklist", async () => {
  const adapter = new StudioOneAdapter();
  const plan = await buildProducerPlan(adapter, { id: "prepare-mastering" });

  assert.equal(plan.intentId, "prepare-mastering");
  assert.ok(plan.title.toLowerCase().includes("master"));
  assert.ok(plan.summary.length > 0, "Summary should not be empty");

  // Should have at least 4 suggestions (headroom, bus cleanup, export, reference)
  assert.ok(plan.suggestions.length >= 4, `Expected >= 4 suggestions, got ${plan.suggestions.length}`);

  // Core suggestion IDs should be present
  const ids = plan.suggestions.map(s => s.id);
  assert.ok(ids.includes("master-headroom"), "Should include headroom check");
  assert.ok(ids.includes("master-bus-cleanup"), "Should include bus cleanup");
  assert.ok(ids.includes("master-export"), "Should include export settings");
  assert.ok(ids.includes("master-reference"), "Should include reference check");
});

test("buildProducerPlan prepare-mastering suggestions follow contract", async () => {
  const adapter = new StudioOneAdapter();
  const plan = await buildProducerPlan(adapter, { id: "prepare-mastering" });

  for (const s of plan.suggestions) {
    assert.ok(s.id, "Suggestion must have an id");
    assert.ok(s.title, "Suggestion must have a title");
    assert.ok(s.rationale.length > 20, `Suggestion "${s.id}" rationale too short`);
    assert.ok(
      ["low", "medium", "high"].includes(s.confidence),
      `Invalid confidence: ${s.confidence}`,
    );
  }
});

test("buildProducerPlan prepare-mastering warns about missing capabilities", async () => {
  const adapter = new StudioOneAdapter();
  const plan = await buildProducerPlan(adapter, { id: "prepare-mastering" });

  // Without watcher, should warn about missing arrangement data
  assert.ok(plan.warnings.length > 0, "Should have warnings when nothing is connected");
});
