
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Import the session tools registration and required helpers
import { registerSessionTools } from "../../dist/tools/session.js";
import { loadWorkspaceConfig } from "../../dist/services/workspace.js";

// ─── Mock MCP server ──────────────────────────────────────────────────────────

function createMockServer() {
  const tools = {};
  return {
    registerTool(name, def, handler) {
      tools[name] = { def, handler };
    },
    tools,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fornix-session-"));
  fs.writeFileSync(
    path.join(root, "fornix-mcp.config.json"),
    JSON.stringify({ allowedDirs: ["."] })
  );
  return root;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Registration ─────────────────────────────────────────────────────────────

test("registerSessionTools registers all 4 session tools", () => {
  const server = createMockServer();
  registerSessionTools(server);

  const names = Object.keys(server.tools);
  assert.ok(names.includes("session_kickstart"), "missing session_kickstart");
  assert.ok(names.includes("session_apply_mix_preset"), "missing session_apply_mix_preset");
  assert.ok(names.includes("session_health_check"), "missing session_health_check");
  assert.ok(names.includes("session_list_mix_presets"), "missing session_list_mix_presets");
  assert.equal(names.length, 4);
});

// ─── session_kickstart (file-based) ───────────────────────────────────────────

test("session_kickstart file-based writes session plan files", async () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    const server = createMockServer();
    registerSessionTools(server);

    const result = await server.tools.session_kickstart.handler({
      songTitle: "Test Track",
      tempo: 150,
      timeSignatureNumerator: 4,
      createBuses: true,
      insertPlugins: true,
      createArrangementMarkers: true,
      initialTracks: [
        { name: "Kick", type: "audio", bus: "Kick & Bass" },
        { name: "Lead Synth", type: "instrument", bus: "LEAD" },
      ],
      outputDir: root,
    });

    assert.ok(!result.isError, "should not be error");

    const sessionDir = path.join(root, "Fornix", "session-kickstart");
    assert.ok(fs.existsSync(sessionDir), "session dir should exist");

    // Check instruction JSON
    const instrPath = path.join(sessionDir, "s1-instructions.json");
    assert.ok(fs.existsSync(instrPath), "s1-instructions.json should exist");
    const instr = JSON.parse(fs.readFileSync(instrPath, "utf8"));
    assert.equal(instr.songTitle, "Test Track");
    assert.equal(instr.tempo, 150);
    assert.ok(instr.instructions.length > 0, "should have instructions");

    // Check track plan JSON
    const planPath = path.join(sessionDir, "track-plan.json");
    assert.ok(fs.existsSync(planPath), "track-plan.json should exist");
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    assert.ok(plan.tracks.length >= 7, "should have buses + initial tracks");

    // Check markdown
    const mdPath = path.join(sessionDir, "session-plan.md");
    assert.ok(fs.existsSync(mdPath), "session-plan.md should exist");
    const md = fs.readFileSync(mdPath, "utf8");
    assert.ok(md.includes("Test Track"), "markdown should include song title");
    assert.ok(md.includes("150 BPM"), "markdown should include tempo");
  } finally {
    cleanup(root);
  }
});

test("session_kickstart errors when no outputDir and bridge down", async () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    const server = createMockServer();
    registerSessionTools(server);

    const result = await server.tools.session_kickstart.handler({
      songTitle: "Test",
      tempo: 150,
      timeSignatureNumerator: 4,
      createBuses: true,
      insertPlugins: true,
      createArrangementMarkers: true,
    });

    assert.equal(result.isError, true, "should be error without outputDir");
    assert.ok(result.content[0].text.includes("outputDir"));
  } finally {
    cleanup(root);
  }
});

test("session_kickstart respects createBuses=false", async () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    const server = createMockServer();
    registerSessionTools(server);

    await server.tools.session_kickstart.handler({
      songTitle: "Minimal",
      tempo: 160,
      timeSignatureNumerator: 4,
      createBuses: false,
      insertPlugins: false,
      createArrangementMarkers: false,
      outputDir: root,
    });

    const planPath = path.join(root, "Fornix", "session-kickstart", "track-plan.json");
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    assert.equal(plan.tracks.length, 0, "no buses or tracks when disabled");
  } finally {
    cleanup(root);
  }
});

// ─── session_apply_mix_preset ─────────────────────────────────────────────────

test("session_apply_mix_preset returns preset values when bridge down", async () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    const server = createMockServer();
    registerSessionTools(server);

    const result = await server.tools.session_apply_mix_preset.handler({
      trackName: "LEAD",
      pluginName: "FabFilter Pro-R 2",
      presetName: "large-room-lead",
      dryRun: false,
    });

    // Bridge is down, so it shows values for manual application
    assert.ok(!result.isError);
    const text = result.content[0].text;
    assert.ok(text.includes("Room Size"), "should show parameter values");
    assert.ok(text.includes("manual application") || text.includes("Bridge not connected"));
  } finally {
    cleanup(root);
  }
});

test("session_apply_mix_preset rejects unknown plugin", async () => {
  const server = createMockServer();
  registerSessionTools(server);

  const result = await server.tools.session_apply_mix_preset.handler({
    trackName: "Master",
    pluginName: "NonExistentPlugin",
    presetName: "foo",
    dryRun: false,
  });

  assert.equal(result.isError, true);
  assert.ok(result.content[0].text.includes("No presets"));
});

test("session_apply_mix_preset rejects unknown preset name", async () => {
  const server = createMockServer();
  registerSessionTools(server);

  const result = await server.tools.session_apply_mix_preset.handler({
    trackName: "Master",
    pluginName: "FabFilter Pro-L 2",
    presetName: "nonexistent-preset",
    dryRun: false,
  });

  assert.equal(result.isError, true);
  assert.ok(result.content[0].text.includes("not found"));
});

test("session_apply_mix_preset dry-run mode shows parameters", async () => {
  const server = createMockServer();
  registerSessionTools(server);

  const result = await server.tools.session_apply_mix_preset.handler({
    trackName: "Kick & Bass",
    pluginName: "SSL Bus Compressor 2",
    presetName: "glue-kick-bass",
    dryRun: true,
  });

  assert.ok(!result.isError);
  const text = result.content[0].text;
  assert.ok(text.includes("DRY-RUN"));
  assert.ok(text.includes("Threshold"));
});

// ─── session_health_check ─────────────────────────────────────────────────────

test("session_health_check requires bridge or songFilePath", async () => {
  const server = createMockServer();
  registerSessionTools(server);

  const result = await server.tools.session_health_check.handler({});

  assert.equal(result.isError, true);
  assert.ok(result.content[0].text.includes("Bridge not connected"));
});

test("session_health_check file-based with valid .song mock", async () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    const server = createMockServer();
    registerSessionTools(server);

    // Write a minimal XML "song" file inside workspace
    const songXml = `<?xml version="1.0"?>
<Song>
  <TempoMapSegment start="0" tempo="0.4" />
  <MediaTrack name="Kick" mediaType="Audio" />
  <MediaTrack name="Lead Synth" mediaType="Music" />
  <FolderTrack name="LEAD" />
  <FolderTrack name="Kick &amp; Bass" />
</Song>`;
    const songPath = path.join(root, "test.song");
    fs.writeFileSync(songPath, songXml, "utf8");

    const result = await server.tools.session_health_check.handler({
      expectedTempo: 150,
      songFilePath: songPath,
    });

    assert.ok(!result.isError);
    const text = result.content[0].text;
    assert.ok(text.includes("Health Check"), "should include header");
    assert.ok(text.includes("150"), "should include tempo");
    assert.ok(text.includes("LEAD"), "should detect LEAD bus");
  } finally {
    cleanup(root);
  }
});

// ─── session_list_mix_presets ─────────────────────────────────────────────────

test("session_list_mix_presets returns preset library", async () => {
  const server = createMockServer();
  registerSessionTools(server);

  const result = await server.tools.session_list_mix_presets.handler({});

  assert.ok(!result.isError);
  const text = result.content[0].text;
  assert.ok(text.includes("FabFilter Pro-L 2"));
  assert.ok(text.includes("FabFilter Pro-R 2"));
  assert.ok(text.includes("SSL Bus Compressor 2"));
  assert.ok(text.includes("master-limiter"));
  assert.ok(text.includes("large-room-lead"));
});
