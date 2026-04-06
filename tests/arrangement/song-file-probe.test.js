
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { tryParseSongFile } from "../../dist/services/song-file.js";
import {
  buildArrangementSummary,
  buildArrangementFromManual,
  analyzeArrangement,
  formatTime,
} from "../../dist/services/arrangement.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fornix-arr-test-"));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── tryParseSongFile: XML format ─────────────────────────────────────────────

test("tryParseSongFile extracts markers and tempo from minimal XML", () => {
  const dir = makeTempDir();
  try {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Song>
  <Tempo value="150"/>
  <TimeSignature numerator="4" denominator="4"/>
  <Tracks>
    <AudioTrack name="Kick" type="audio"/>
    <AudioTrack name="Lead" type="audio"/>
    <Track name="LEAD Bus" type="bus"/>
  </Tracks>
  <ArrangerTrack>
    <Marker name="Intro" start="0"/>
    <Marker name="Breakdown" start="15360"/>
    <Marker name="Build-up" start="30720"/>
    <Marker name="Drop 1" start="38400"/>
    <Marker name="Breakdown 2" start="69120"/>
    <Marker name="Build-up 2" start="84480"/>
    <Marker name="Drop 2" start="92160"/>
    <Marker name="Outro" start="122880"/>
  </ArrangerTrack>
</Song>`;

    const filePath = path.join(dir, "test.song");
    fs.writeFileSync(filePath, xml, "utf8");

    const result = tryParseSongFile(filePath);

    assert.equal(result.format, "xml");
    assert.equal(result.tempo, 150);
    assert.equal(result.timeSignature, "4/4");
    assert.ok(result.markers.length >= 8, `Expected >= 8 markers, got ${result.markers.length}`);
    assert.ok(result.tracks.length >= 3, `Expected >= 3 tracks, got ${result.tracks.length}`);

    // Verify marker names are extracted
    const markerNames = result.markers.map((m) => m.name);
    assert.ok(markerNames.includes("Intro"));
    assert.ok(markerNames.includes("Drop 1"));
    assert.ok(markerNames.includes("Outro"));
  } finally {
    cleanup(dir);
  }
});

test("tryParseSongFile extracts tempo from bpm attribute format", () => {
  const dir = makeTempDir();
  try {
    const xml = `<Song bpm="155"><Track name="Kick" type="audio"/></Song>`;
    const filePath = path.join(dir, "bpm.song");
    fs.writeFileSync(filePath, xml, "utf8");

    const result = tryParseSongFile(filePath);

    assert.equal(result.format, "xml");
    assert.equal(result.tempo, 155);
  } finally {
    cleanup(dir);
  }
});

// ─── tryParseSongFile: plain text fallback ──────────────────────────────────────

test("tryParseSongFile returns unknown for plain text without XML-like content", () => {
  const dir = makeTempDir();
  try {
    const filePath = path.join(dir, "plain.song");
    fs.writeFileSync(filePath, "This is just a plain text file with no XML structure.", "utf8");

    const result = tryParseSongFile(filePath);

    assert.equal(result.format, "unknown");
    assert.equal(result.markers.length, 0);
    assert.equal(result.tracks.length, 0);
    assert.equal(result.tempo, null);
  } finally {
    cleanup(dir);
  }
});

// ─── tryParseSongFile: binary with embedded strings ─────────────────────────────

test("tryParseSongFile extracts data from binary with embedded XML fragments", () => {
  const dir = makeTempDir();
  try {
    // Simulate binary file with some readable XML fragments embedded
    const xmlFragment = '<Marker name="Drop" start="38400"/><Track name="Kick"/>';
    const prefix = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
    const middle = Buffer.from(xmlFragment, "utf8");
    const suffix = Buffer.from([0x00, 0x00, 0xff, 0xfe, 0x00]);

    const filePath = path.join(dir, "binary.song");
    fs.writeFileSync(filePath, Buffer.concat([prefix, middle, suffix]));

    const result = tryParseSongFile(filePath);

    // Should detect the XML fragments even in binary
    assert.ok(result.format === "xml" || result.format === "binary");
    assert.ok(result.markers.length >= 1 || result.tracks.length >= 1,
      "Should extract at least one marker or track from embedded strings");
  } finally {
    cleanup(dir);
  }
});

// ─── buildArrangementSummary from markers ───────────────────────────────────────

test("buildArrangementSummary derives sections from markers", () => {
  const songResult = {
    format: /** @type {"xml"} */ ("xml"),
    raw: "",
    markers: [
      { name: "Intro", positionBars: 1, positionSeconds: 0 },
      { name: "Breakdown", positionBars: 17, positionSeconds: 25.6 },
      { name: "Build-up", positionBars: 33, positionSeconds: 51.2 },
      { name: "Drop 1", positionBars: 41, positionSeconds: 64 },
      { name: "Outro", positionBars: 73, positionSeconds: 115.2 },
    ],
    tracks: [{ name: "Kick", type: "audio", regionCount: 0 }],
    tempo: 150,
    timeSignature: "4/4",
    regions: [],
    parseNotes: [],
  };

  const summary = buildArrangementSummary(songResult);

  assert.equal(summary.sections.length, 5);
  assert.equal(summary.tempo, 150);
  assert.ok(summary.totalLengthBars > 0);

  // Verify section derivation from consecutive markers
  assert.equal(summary.sections[0].name, "Intro");
  assert.equal(summary.sections[0].startBar, 1);
  assert.equal(summary.sections[0].lengthBars, 16); // 17 - 1

  assert.equal(summary.sections[2].name, "Build-up");
  assert.equal(summary.sections[2].lengthBars, 8); // 41 - 33

  assert.equal(summary.sections[3].name, "Drop 1");
  assert.equal(summary.sections[3].lengthBars, 32); // 73 - 41
});

test("buildArrangementSummary flags sections shorter than 8 bars", () => {
  const songResult = {
    format: /** @type {"xml"} */ ("xml"),
    raw: "",
    markers: [
      { name: "Intro", positionBars: 1, positionSeconds: 0 },
      { name: "Tiny", positionBars: 5, positionSeconds: 6.4 },
      { name: "Drop", positionBars: 9, positionSeconds: 12.8 },
    ],
    tracks: [],
    tempo: 150,
    timeSignature: null,
    regions: [],
    parseNotes: [],
  };

  const summary = buildArrangementSummary(songResult);

  const tooShort = summary.sectionFlags.filter((f) => f.flag === "too-short");
  assert.ok(tooShort.length >= 1, "Should flag the 4-bar sections as too short");
});

test("buildArrangementSummary flags sections longer than 64 bars", () => {
  const songResult = {
    format: /** @type {"xml"} */ ("xml"),
    raw: "",
    markers: [
      { name: "Intro", positionBars: 1, positionSeconds: 0 },
      { name: "Giant Section", positionBars: 17, positionSeconds: 25.6 },
      { name: "End", positionBars: 97, positionSeconds: 153.6 },
    ],
    tracks: [],
    tempo: 150,
    timeSignature: null,
    regions: [],
    parseNotes: [],
  };

  const summary = buildArrangementSummary(songResult);

  const tooLong = summary.sectionFlags.filter((f) => f.flag === "too-long");
  assert.ok(tooLong.length >= 1, "Should flag the 80-bar section as too long");
});

test("buildArrangementSummary detects identical consecutive section lengths", () => {
  const songResult = {
    format: /** @type {"xml"} */ ("xml"),
    raw: "",
    markers: [
      { name: "Part A", positionBars: 1, positionSeconds: 0 },
      { name: "Part B", positionBars: 17, positionSeconds: 25.6 },
      { name: "Part C", positionBars: 33, positionSeconds: 51.2 },
    ],
    tracks: [],
    tempo: 150,
    timeSignature: null,
    regions: [],
    parseNotes: [],
  };

  const summary = buildArrangementSummary(songResult);

  const identical = summary.sectionFlags.filter((f) => f.flag === "identical-length");
  assert.ok(identical.length >= 1, "Should flag identical 16-bar consecutive sections");
});

// ─── buildArrangementFromManual ─────────────────────────────────────────────────

test("buildArrangementFromManual creates sections from manual input", () => {
  const manual = [
    { name: "Intro", lengthBars: 16 },
    { name: "Breakdown", lengthBars: 16 },
    { name: "Build-up", lengthBars: 8 },
    { name: "Drop 1", lengthBars: 32 },
    { name: "Breakdown 2", lengthBars: 16 },
    { name: "Build-up 2", lengthBars: 8 },
    { name: "Drop 2", lengthBars: 32 },
    { name: "Outro", lengthBars: 16 },
  ];

  const summary = buildArrangementFromManual(manual, 150);

  assert.equal(summary.sections.length, 8);
  assert.equal(summary.totalLengthBars, 144);
  assert.equal(summary.tempo, 150);

  // Verify sequential bar positions
  assert.equal(summary.sections[0].startBar, 1);
  assert.equal(summary.sections[1].startBar, 17); // 1 + 16
  assert.equal(summary.sections[2].startBar, 33); // 17 + 16
  assert.equal(summary.sections[3].startBar, 41); // 33 + 8

  // Verify seconds calculation: 16 bars at 150 BPM = 16 * 4 * 60/150 = 25.6s
  assert.equal(summary.sections[0].lengthSeconds, 25.6);
});

// ─── analyzeArrangement ─────────────────────────────────────────────────────────

test("analyzeArrangement produces section map with flags", () => {
  const summary = buildArrangementFromManual([
    { name: "Intro", lengthBars: 16 },
    { name: "Build-up", lengthBars: 8 },
    { name: "Drop 1", lengthBars: 32 },
    { name: "Outro", lengthBars: 16 },
  ], 150);

  const analysis = analyzeArrangement(summary);

  assert.ok(analysis.sectionMap.length === 4);
  assert.ok(analysis.sectionMap[0].name === "Intro");
  assert.ok(analysis.sectionMap[0].bars === 16);
  assert.ok(analysis.sectionMap[0].barRange.includes("1"));
});

test("analyzeArrangement detects missing sections in hardstyle genre", () => {
  // A track with no breakdown — just intro → drop → outro
  const summary = buildArrangementFromManual([
    { name: "Intro", lengthBars: 16 },
    { name: "Drop", lengthBars: 32 },
    { name: "Outro", lengthBars: 16 },
  ], 150);

  const analysis = analyzeArrangement(summary, { genre: "hardstyle" });

  // Should detect missing build-up before drop
  const buildProblems = analysis.problems.filter((p) =>
    p.problem.toLowerCase().includes("build"),
  );
  assert.ok(buildProblems.length >= 1, "Should flag missing build-up");
});

test("analyzeArrangement energy arc is strong for well-structured arrangement", () => {
  const summary = buildArrangementFromManual([
    { name: "Intro", lengthBars: 16 },
    { name: "Breakdown", lengthBars: 16 },
    { name: "Build-up", lengthBars: 8 },
    { name: "Drop 1", lengthBars: 32 },
    { name: "Breakdown 2", lengthBars: 16 },
    { name: "Build-up 2", lengthBars: 8 },
    { name: "Drop 2", lengthBars: 32 },
    { name: "Outro", lengthBars: 16 },
  ], 150);

  const analysis = analyzeArrangement(summary, { genre: "hardstyle" });

  assert.equal(analysis.energyArc.verdict, "strong");
  assert.ok(analysis.energyArc.phases.length === 8);
});

test("analyzeArrangement energy arc detects missing peak", () => {
  // All low-energy sections
  const summary = buildArrangementFromManual([
    { name: "Intro", lengthBars: 16 },
    { name: "Breakdown", lengthBars: 32 },
    { name: "Outro", lengthBars: 16 },
  ], 150);

  const analysis = analyzeArrangement(summary);

  assert.ok(
    analysis.energyArc.verdict === "broken" || analysis.energyArc.verdict === "needs-work",
    "Should flag missing peak",
  );
});

test("analyzeArrangement generates actions with bar references", () => {
  // Arrangement with clear problems
  const summary = buildArrangementFromManual([
    { name: "Drop", lengthBars: 32 },
    { name: "Another Drop", lengthBars: 32 },
  ], 150);

  const analysis = analyzeArrangement(summary, { genre: "hardstyle" });

  assert.ok(analysis.actions.length >= 1, "Should generate at least one action");
  for (const action of analysis.actions) {
    assert.ok(typeof action.targetBar === "number", "Actions should have bar references");
    assert.ok(action.action.length > 10, "Actions should be specific");
  }
});

test("analyzeArrangement includes producer problem description", () => {
  const summary = buildArrangementFromManual([
    { name: "Intro", lengthBars: 16 },
    { name: "Drop", lengthBars: 32 },
    { name: "Outro", lengthBars: 16 },
  ], 150);

  const analysis = analyzeArrangement(summary, {
    problemDescription: "The drop feels empty after the breakdown",
  });

  const producerProblem = analysis.problems.find((p) => p.section === "(producer)");
  assert.ok(producerProblem, "Should include producer's stated problem");
  assert.ok(producerProblem.problem.includes("drop feels empty"));
});

test("analyzeArrangement reports length deviation from target", () => {
  // 32 bars at 150 BPM = 51.2 seconds, target 5.5 min = 330 seconds
  const summary = buildArrangementFromManual([
    { name: "Intro", lengthBars: 16 },
    { name: "Drop", lengthBars: 16 },
  ], 150);

  const analysis = analyzeArrangement(summary, { targetLengthMinutes: 5.5 });

  const lengthProblem = analysis.problems.find((p) =>
    p.problem.includes("too short") || p.problem.includes("target"),
  );
  assert.ok(lengthProblem, "Should flag that arrangement is too short for target");
});

// ─── formatTime ─────────────────────────────────────────────────────────────────

test("formatTime formats seconds to m:ss", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(65), "1:05");
  assert.equal(formatTime(330), "5:30");
  assert.equal(formatTime(125.7), "2:06");
});

// ─── Tool manifest ──────────────────────────────────────────────────────────────

test("fornix_analyze_arrangement appears in TOOL_MANIFEST", async () => {
  const { TOOL_MANIFEST } = await import("../../dist/services/status-server.js");
  const entry = TOOL_MANIFEST.find((t) => t.name === "fornix_analyze_arrangement");
  assert.ok(entry, "Tool should be in manifest");
  assert.equal(entry.readOnly, true);
  assert.equal(entry.family, "Arrangement Analysis");
});
