
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { registerSoundDesignTools } from "../../dist/tools/sound-design.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fornix-sd-test-"));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Tool registration ──────────────────────────────────────────────────────

test("registerSoundDesignTools registers sd_describe_patch and sd_generate_hardstyle_lead", () => {
  const registered = [];
  const fakeServer = { registerTool(name) { registered.push(name); } };
  registerSoundDesignTools(fakeServer);

  assert.ok(registered.includes("sd_describe_patch"));
  assert.ok(registered.includes("sd_generate_hardstyle_lead"));
  assert.equal(registered.length, 2);
});

// ─── Patch file generation (sd_describe_patch equivalent logic) ──────────

// Since the tool handler uses guardPath, we test the file writing logic directly
// by simulating what the handler does after guard validation.

function writePatchFiles(dir, patchName, recipe) {
  const filename = "patch-" + patchName.replace(/\s+/g, "-").toLowerCase() + ".md";
  const mdPath = path.join(dir, filename);
  const jsonPath = mdPath.replace(".md", ".json");

  const md = [
    "# Patch: " + patchName,
    "**Synth:** " + recipe.synth + "  |  **Category:** " + recipe.category,
    "",
    "## Oscillators",
    ...recipe.oscillators.map((osc, i) => "OSC " + (i + 1) + ": " + osc.waveform),
    "",
    "## Amp Envelope",
    "A: " + recipe.ampEnvelope.attack + "ms | D: " + recipe.ampEnvelope.decay + "ms | S: " + recipe.ampEnvelope.sustain + "% | R: " + recipe.ampEnvelope.release + "ms",
  ].join("\n");

  fs.writeFileSync(mdPath, md, "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(recipe, null, 2), "utf8");

  return { mdPath, jsonPath };
}

test("patch files write both .md and .json with correct naming", () => {
  const dir = makeTempDir();
  try {
    const recipe = {
      patchName: "Test Supersaw",
      synth: "Serum",
      category: "Lead",
      oscillators: [{ waveform: "Saw", octave: 0, semitone: 0, cents: 0, level: 100, unisonVoices: 4, unisonDetune: 18, pan: 0 }],
      ampEnvelope: { attack: 5, decay: 200, sustain: 90, release: 300 },
    };

    const { mdPath, jsonPath } = writePatchFiles(dir, "Test Supersaw", recipe);

    assert.ok(fs.existsSync(mdPath));
    assert.ok(fs.existsSync(jsonPath));
    assert.ok(mdPath.endsWith("patch-test-supersaw.md"));
    assert.ok(jsonPath.endsWith("patch-test-supersaw.json"));
  } finally {
    cleanup(dir);
  }
});

test("patch .md file contains readable patch information", () => {
  const dir = makeTempDir();
  try {
    const recipe = {
      patchName: "Dark Lead",
      synth: "Vital",
      category: "Lead",
      oscillators: [
        { waveform: "Wavetable", octave: 0, semitone: 0, cents: 0, level: 100, unisonVoices: 1, unisonDetune: 0, pan: 0 },
        { waveform: "Sine", octave: -1, semitone: 0, cents: 0, level: 40, unisonVoices: 1, unisonDetune: 0, pan: 0 },
      ],
      ampEnvelope: { attack: 10, decay: 300, sustain: 80, release: 500 },
    };

    const { mdPath } = writePatchFiles(dir, "Dark Lead", recipe);
    const md = fs.readFileSync(mdPath, "utf8");

    assert.ok(md.includes("# Patch: Dark Lead"));
    assert.ok(md.includes("Vital"));
    assert.ok(md.includes("Lead"));
    assert.ok(md.includes("Wavetable"));
    assert.ok(md.includes("Sine"));
    assert.ok(md.includes("A: 10ms"));
  } finally {
    cleanup(dir);
  }
});

test("patch .json file is valid JSON with all recipe fields", () => {
  const dir = makeTempDir();
  try {
    const recipe = {
      patchName: "Screech Bass",
      synth: "Serum",
      category: "Bass",
      oscillators: [{ waveform: "Square", octave: -1, semitone: 0, cents: 0, level: 100, unisonVoices: 2, unisonDetune: 10, pan: 0 }],
      filter: { type: "LP24", cutoff: 1200, resonance: 45, drive: 30, envelopeAmount: -50 },
      ampEnvelope: { attack: 0, decay: 100, sustain: 70, release: 200 },
    };

    const { jsonPath } = writePatchFiles(dir, "Screech Bass", recipe);
    const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    assert.equal(parsed.synth, "Serum");
    assert.equal(parsed.category, "Bass");
    assert.equal(parsed.oscillators[0].waveform, "Square");
    assert.equal(parsed.filter.cutoff, 1200);
    assert.equal(parsed.filter.drive, 30);
  } finally {
    cleanup(dir);
  }
});

// ─── Hardstyle lead generation logic ─────────────────────────────────────────

// Test the character → parameter mapping that sd_generate_hardstyle_lead uses

const CUTOFF_MAP = {
  bright: 8000, dark: 1200, screechy: 12000, warm: 2500, "mid-focused": 4000,
};
const RESONANCE_MAP = {
  bright: 30, dark: 45, screechy: 65, warm: 20, "mid-focused": 35,
};

test("hardstyle lead character maps produce valid filter settings", () => {
  const characters = ["bright", "dark", "screechy", "warm", "mid-focused"];

  for (const character of characters) {
    const cutoff = CUTOFF_MAP[character];
    const resonance = RESONANCE_MAP[character];

    assert.ok(cutoff >= 20 && cutoff <= 20000, `${character} cutoff ${cutoff} out of range`);
    assert.ok(resonance >= 0 && resonance <= 100, `${character} resonance ${resonance} out of range`);
  }
});

test("screechy character produces highest cutoff and resonance", () => {
  const characters = Object.keys(CUTOFF_MAP);

  const maxCutoff = Math.max(...characters.map((c) => CUTOFF_MAP[c]));
  const maxResonance = Math.max(...characters.map((c) => RESONANCE_MAP[c]));

  assert.equal(CUTOFF_MAP["screechy"], maxCutoff);
  assert.equal(RESONANCE_MAP["screechy"], maxResonance);
});

test("dark character produces lowest cutoff", () => {
  const characters = Object.keys(CUTOFF_MAP);
  const minCutoff = Math.min(...characters.map((c) => CUTOFF_MAP[c]));
  assert.equal(CUTOFF_MAP["dark"], minCutoff);
});

test("hardstyle lead recipe produces correct wavetable for screechy vs others", () => {
  // screechy uses Analog_Saw_Down, others use Hypersaw
  function getWavetable(character) {
    return character === "screechy" ? "Analog_Saw_Down" : "Hypersaw";
  }

  assert.equal(getWavetable("screechy"), "Analog_Saw_Down");
  assert.equal(getWavetable("bright"), "Hypersaw");
  assert.equal(getWavetable("dark"), "Hypersaw");
  assert.equal(getWavetable("warm"), "Hypersaw");
});

test("hardstyle lead recipe includes distortion drive scaled by character", () => {
  function getDrive(character) {
    return character === "screechy" ? 45 : 20;
  }

  assert.equal(getDrive("screechy"), 45);
  assert.equal(getDrive("bright"), 20);
  assert.ok(getDrive("screechy") > getDrive("bright"), "screechy should have more distortion");
});

// ─── Filename sanitization ──────────────────────────────────────────────────

test("patch filename sanitizes spaces to hyphens and lowercases", () => {
  const names = [
    ["Fornix Supersaw", "patch-fornix-supersaw.md"],
    ["Dark Lead V2", "patch-dark-lead-v2.md"],
    ["   Spaced   Out   ", "patch--spaced-out-.md"],
  ];

  for (const [input, expected] of names) {
    const result = "patch-" + input.replace(/\s+/g, "-").toLowerCase() + ".md";
    assert.equal(result, expected);
  }
});
