
import test from "node:test";
import assert from "node:assert/strict";

import {
  listTemplates,
  getTemplate,
  getTemplateCategories,
} from "../../dist/services/template-library.js";

test("listTemplates returns all templates when no category specified", () => {
  const templates = listTemplates();
  assert.ok(templates.length >= 5, "should have at least 5 templates");
  for (const t of templates) {
    assert.ok(t.id, "each template needs an id");
    assert.ok(t.name, "each template needs a name");
    assert.ok(t.styleVariant, "each template needs styleVariant");
    assert.ok(t.creativeBrief, "each template needs creativeBrief");
  }
});

test("listTemplates filters by category", () => {
  const raw = listTemplates("raw");
  assert.ok(raw.length >= 1, "should have at least 1 raw template");
  for (const t of raw) {
    assert.equal(t.category, "raw");
  }

  const cinematic = listTemplates("cinematic");
  assert.ok(cinematic.length >= 1, "should have at least 1 cinematic template");
  for (const t of cinematic) {
    assert.equal(t.category, "cinematic");
  }
});

test("getTemplate returns a template by ID", () => {
  const t = getTemplate("rawphoric-banger");
  assert.ok(t, "template should exist");
  assert.equal(t.id, "rawphoric-banger");
  assert.equal(t.styleVariant, "rawphoric");
  assert.equal(t.leadStyle, "screech");
  assert.ok(t.mixConcerns.length > 0);
});

test("getTemplate returns undefined for unknown ID", () => {
  const t = getTemplate("nonexistent-template");
  assert.equal(t, undefined);
});

test("getTemplateCategories returns all unique categories", () => {
  const categories = getTemplateCategories();
  assert.ok(categories.includes("euphoric"));
  assert.ok(categories.includes("raw"));
  assert.ok(categories.includes("cinematic"));
  assert.ok(categories.includes("festival"));
  assert.ok(categories.includes("hybrid"));
});

test("each template has valid enum values", () => {
  const validStyleVariants = ["cinematic-euphoric", "rawphoric", "anthemic-euphoric", "festival-hardstyle"];
  const validLeadStyles = ["euphoric", "screech", "hybrid"];
  const validDropStrategies = ["anti-climax-to-melodic", "melodic-then-anti-climax", "double-anti-climax", "festival-main-drop"];
  const validEnergyProfiles = ["patient-cinematic", "steady-escalation", "front-loaded", "late-payoff"];

  for (const t of listTemplates()) {
    assert.ok(validStyleVariants.includes(t.styleVariant), `${t.id}: invalid styleVariant "${t.styleVariant}"`);
    assert.ok(validLeadStyles.includes(t.leadStyle), `${t.id}: invalid leadStyle "${t.leadStyle}"`);
    assert.ok(validDropStrategies.includes(t.dropStrategy), `${t.id}: invalid dropStrategy "${t.dropStrategy}"`);
    assert.ok(validEnergyProfiles.includes(t.energyProfile), `${t.id}: invalid energyProfile "${t.energyProfile}"`);
  }
});

test("template IDs are unique", () => {
  const ids = listTemplates().map((t) => t.id);
  const unique = new Set(ids);
  assert.equal(ids.length, unique.size, `Duplicate template IDs: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(", ")}`);
});
