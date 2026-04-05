
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  startWatching,
  stopWatching,
  getWatcherStatus,
  getCurrentSnapshot,
  getLastDiff,
} from "../../dist/services/song-watcher.js";
import { loadWorkspaceConfig } from "../../dist/services/workspace.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fornix-watcher-"));
  fs.writeFileSync(
    path.join(root, "fornix-mcp.config.json"),
    JSON.stringify({ allowedDirs: ["."] })
  );
  return root;
}

function cleanup(dir) {
  stopWatching();
  fs.rmSync(dir, { recursive: true, force: true });
}

const MINIMAL_SONG_XML = `<?xml version="1.0"?>
<Song>
  <TempoMapSegment start="0" tempo="0.4" />
  <TimeSignatureMapSegment numerator="4" denominator="4" />
  <MediaTrack name="Kick" mediaType="Audio" />
  <MediaTrack name="Lead Synth" mediaType="Music" />
  <FolderTrack name="LEAD" />
  <MarkerEvent name="Intro" start="0" markerType="1" />
  <MarkerEvent name="Drop 1" start="2822400" markerType="1" />
</Song>`;

const UPDATED_SONG_XML = `<?xml version="1.0"?>
<Song>
  <TempoMapSegment start="0" tempo="0.375" />
  <TimeSignatureMapSegment numerator="4" denominator="4" />
  <MediaTrack name="Kick" mediaType="Audio" />
  <MediaTrack name="Lead Synth" mediaType="Music" />
  <MediaTrack name="Pad" mediaType="Music" />
  <FolderTrack name="LEAD" />
  <FolderTrack name="FX" />
  <MarkerEvent name="Intro" start="0" markerType="1" />
  <MarkerEvent name="Build-up" start="1411200" markerType="1" />
  <MarkerEvent name="Drop 1" start="2822400" markerType="1" />
</Song>`;

// ─── Tests ────────────────────────────────────────────────────────────────────

test("startWatching returns error for non-existent path", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    const result = startWatching(path.join(root, "nonexistent"));
    assert.equal(result.ok, false);
    assert.ok(result.message.includes("does not exist"));
  } finally {
    cleanup(root);
  }
});

test("startWatching on a .song file creates initial snapshot", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    const songPath = path.join(root, "test.song");
    fs.writeFileSync(songPath, MINIMAL_SONG_XML, "utf8");

    const result = startWatching(songPath);
    assert.equal(result.ok, true);

    const snap = getCurrentSnapshot();
    assert.ok(snap, "should have a snapshot");
    assert.equal(snap.result.format, "xml");
    assert.equal(snap.result.tempo, 150); // 60 / 0.4 = 150
    assert.equal(snap.result.tracks.length, 3);
    assert.equal(snap.result.markers.length, 2);
  } finally {
    cleanup(root);
  }
});

test("startWatching on directory finds .song files", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    const songDir = path.join(root, "MySong");
    fs.mkdirSync(songDir, { recursive: true });
    fs.writeFileSync(path.join(songDir, "MySong.song"), MINIMAL_SONG_XML, "utf8");

    const result = startWatching(root);
    assert.equal(result.ok, true);

    const snap = getCurrentSnapshot();
    assert.ok(snap, "should find and parse .song in subdirectory");
    assert.equal(snap.result.tracks.length, 3);
  } finally {
    cleanup(root);
  }
});

test("getWatcherStatus reflects active state", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    const songPath = path.join(root, "test.song");
    fs.writeFileSync(songPath, MINIMAL_SONG_XML, "utf8");

    // Before watching
    let status = getWatcherStatus();
    assert.equal(status.active, false);

    // After watching
    startWatching(songPath);
    status = getWatcherStatus();
    assert.equal(status.active, true);
    assert.ok(status.songFile);
    assert.equal(status.snapshotCount, 1);

    // After stopping
    stopWatching();
    status = getWatcherStatus();
    assert.equal(status.active, false);
    assert.equal(status.snapshotCount, 0);
  } finally {
    cleanup(root);
  }
});

test("getLastDiff returns null after first snapshot (no previous)", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    const songPath = path.join(root, "test.song");
    fs.writeFileSync(songPath, MINIMAL_SONG_XML, "utf8");

    startWatching(songPath);
    assert.equal(getLastDiff(), null, "no diff after initial snapshot");
  } finally {
    cleanup(root);
  }
});

test("stopWatching clears all state", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    const songPath = path.join(root, "test.song");
    fs.writeFileSync(songPath, MINIMAL_SONG_XML, "utf8");

    startWatching(songPath);
    assert.ok(getCurrentSnapshot());

    stopWatching();
    assert.equal(getCurrentSnapshot(), null);
    assert.equal(getLastDiff(), null);
    assert.equal(getWatcherStatus().active, false);
  } finally {
    cleanup(root);
  }
});

test("startWatching replaces previous watcher", () => {
  const root = makeTmpWorkspace();
  try {
    loadWorkspaceConfig(root);
    const songPath1 = path.join(root, "song1.song");
    const songPath2 = path.join(root, "song2.song");
    fs.writeFileSync(songPath1, MINIMAL_SONG_XML, "utf8");
    fs.writeFileSync(songPath2, UPDATED_SONG_XML, "utf8");

    startWatching(songPath1);
    const snap1 = getCurrentSnapshot();
    assert.equal(snap1.result.tracks.length, 3);

    // Starting a new watch replaces the old one
    startWatching(songPath2);
    const snap2 = getCurrentSnapshot();
    assert.equal(snap2.result.tracks.length, 5); // 3 media + 2 folder
  } finally {
    cleanup(root);
  }
});
