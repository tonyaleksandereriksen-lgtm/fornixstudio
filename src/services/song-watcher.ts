// ─── Fornix Studio MCP – Song File Watcher ────────────────────────────────────
//
// Watches a Studio One project directory for .song file changes.
// On each save (detected via chokidar), re-parses the file and maintains
// a snapshot + diff against the previous state.
//
// This gives the MCP server "listening" capability — awareness of what's
// happening in Studio One without requiring the broken extension bridge.

import fs from "fs";
import path from "path";
import chokidar from "chokidar";
import { tryParseSongFile, type SongFileResult } from "./song-file.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SongSnapshot {
  filePath: string;
  parsedAt: string;
  result: SongFileResult;
}

export interface SongDiff {
  tracksAdded: string[];
  tracksRemoved: string[];
  tempoChanged: { from: number | null; to: number | null } | null;
  timeSignatureChanged: { from: string | null; to: string | null } | null;
  markersAdded: string[];
  markersRemoved: string[];
  markersMoved: Array<{ name: string; fromBar: number; toBar: number }>;
  summary: string;
}

export interface WatcherStatus {
  active: boolean;
  watchPath: string | null;
  songFile: string | null;
  lastParsedAt: string | null;
  snapshotCount: number;
  lastDiff: SongDiff | null;
}

// ─── State ────────────────────────────────────────────────────────────────────

let _watcher: chokidar.FSWatcher | null = null;
let _watchPath: string | null = null;
let _songFile: string | null = null;
let _current: SongSnapshot | null = null;
let _previous: SongSnapshot | null = null;
let _lastDiff: SongDiff | null = null;
let _snapshotCount = 0;
const _onChangeCallbacks: Array<(snap: SongSnapshot, diff: SongDiff | null) => void> = [];

// Debounce: S1 may write the file in multiple passes
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 1500;

/** Match .song and .song.autosave files */
function isSongFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith(".song") || lower.endsWith(".song.autosave");
}

// ─── Diffing ──────────────────────────────────────────────────────────────────

function diffSnapshots(prev: SongSnapshot, curr: SongSnapshot): SongDiff {
  const prevTrackNames = new Set(prev.result.tracks.map(t => t.name));
  const currTrackNames = new Set(curr.result.tracks.map(t => t.name));

  const tracksAdded = [...currTrackNames].filter(n => !prevTrackNames.has(n));
  const tracksRemoved = [...prevTrackNames].filter(n => !currTrackNames.has(n));

  const tempoChanged =
    prev.result.tempo !== curr.result.tempo
      ? { from: prev.result.tempo, to: curr.result.tempo }
      : null;

  const timeSignatureChanged =
    prev.result.timeSignature !== curr.result.timeSignature
      ? { from: prev.result.timeSignature, to: curr.result.timeSignature }
      : null;

  // Marker diffing
  const prevMarkerMap = new Map(prev.result.markers.map(m => [m.name, m.positionBars]));
  const currMarkerMap = new Map(curr.result.markers.map(m => [m.name, m.positionBars]));

  const markersAdded = [...currMarkerMap.keys()].filter(n => !prevMarkerMap.has(n));
  const markersRemoved = [...prevMarkerMap.keys()].filter(n => !currMarkerMap.has(n));
  const markersMoved: SongDiff["markersMoved"] = [];

  for (const [name, bar] of currMarkerMap) {
    const prevBar = prevMarkerMap.get(name);
    if (prevBar !== undefined && prevBar !== bar) {
      markersMoved.push({ name, fromBar: prevBar, toBar: bar });
    }
  }

  // Build summary
  const parts: string[] = [];
  if (tracksAdded.length) parts.push(`+${tracksAdded.length} track(s): ${tracksAdded.join(", ")}`);
  if (tracksRemoved.length) parts.push(`-${tracksRemoved.length} track(s): ${tracksRemoved.join(", ")}`);
  if (tempoChanged) parts.push(`tempo: ${tempoChanged.from ?? "?"} → ${tempoChanged.to ?? "?"} BPM`);
  if (timeSignatureChanged) parts.push(`time sig: ${timeSignatureChanged.from ?? "?"} → ${timeSignatureChanged.to ?? "?"}`);
  if (markersAdded.length) parts.push(`+${markersAdded.length} marker(s): ${markersAdded.join(", ")}`);
  if (markersRemoved.length) parts.push(`-${markersRemoved.length} marker(s): ${markersRemoved.join(", ")}`);
  if (markersMoved.length) parts.push(`${markersMoved.length} marker(s) moved`);

  const summary = parts.length > 0 ? parts.join(" | ") : "no changes detected";

  return {
    tracksAdded,
    tracksRemoved,
    tempoChanged,
    timeSignatureChanged,
    markersAdded,
    markersRemoved,
    markersMoved,
    summary,
  };
}

// ─── Core ─────────────────────────────────────────────────────────────────────

function parseAndSnapshot(filePath: string): SongSnapshot | null {
  try {
    const result = tryParseSongFile(filePath);
    if (result.format === "unknown" && result.tracks.length === 0 && result.markers.length === 0) {
      // S1 may have the file locked mid-write — skip this parse
      return null;
    }
    return {
      filePath,
      parsedAt: new Date().toISOString(),
      result,
    };
  } catch {
    // File locked or inaccessible during S1 save — will retry on next change
    return null;
  }
}

function handleFileChange(filePath: string): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);

  _debounceTimer = setTimeout(() => {
    const snap = parseAndSnapshot(filePath);
    if (!snap) return;

    _previous = _current;
    _current = snap;
    _songFile = filePath;
    _snapshotCount++;

    const diff = _previous ? diffSnapshots(_previous, _current) : null;
    _lastDiff = diff;

    const label = diff ? diff.summary : "initial snapshot";
    process.stderr.write(`[watcher] Song updated: ${path.basename(filePath)} — ${label}\n`);

    for (const cb of _onChangeCallbacks) {
      try { cb(snap, diff); } catch { /* ignore callback errors */ }
    }
  }, DEBOUNCE_MS);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start watching a directory (or specific .song file) for changes.
 * If a directory is given, watches all .song files recursively.
 * If a .song file path is given, watches that specific file.
 */
export function startWatching(targetPath: string): { ok: boolean; message: string } {
  if (_watcher) {
    stopWatching();
  }

  const resolved = path.resolve(targetPath);

  if (!fs.existsSync(resolved)) {
    return { ok: false, message: `Path does not exist: ${resolved}` };
  }

  const stat = fs.statSync(resolved);
  let watchGlob: string;

  if (stat.isFile() && isSongFile(resolved)) {
    watchGlob = resolved;
    _watchPath = path.dirname(resolved);
    // Do an initial parse immediately
    const snap = parseAndSnapshot(resolved);
    if (snap) {
      _current = snap;
      _songFile = resolved;
      _snapshotCount++;
      process.stderr.write(`[watcher] Initial parse: ${path.basename(resolved)} — ${snap.result.tracks.length} tracks, tempo ${snap.result.tempo ?? "?"}\n`);
    }
  } else if (stat.isDirectory()) {
    watchGlob = path.join(resolved, "**/*.song{,.autosave}");
    _watchPath = resolved;

    // Find and parse the most recent .song file immediately
    const songFiles = findSongFiles(resolved);
    if (songFiles.length > 0) {
      const newest = songFiles[0]; // sorted newest first
      const snap = parseAndSnapshot(newest);
      if (snap) {
        _current = snap;
        _songFile = newest;
        _snapshotCount++;
        process.stderr.write(`[watcher] Initial parse: ${path.basename(newest)} — ${snap.result.tracks.length} tracks, tempo ${snap.result.tempo ?? "?"}\n`);
      }
    }
  } else {
    return { ok: false, message: `Not a directory or .song file: ${resolved}` };
  }

  _watcher = chokidar.watch(watchGlob, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 },
    depth: 3,
  });

  _watcher.on("change", (fp) => {
    if (typeof fp === "string" && isSongFile(fp)) {
      handleFileChange(fp);
    }
  });

  _watcher.on("add", (fp) => {
    if (typeof fp === "string" && isSongFile(fp)) {
      handleFileChange(fp);
    }
  });

  const songCount = _current ? 1 : 0;
  return {
    ok: true,
    message: `Watching ${resolved} for .song/.autosave changes` +
      (songCount > 0 ? ` (initial snapshot: ${path.basename(_songFile!)})` : ""),
  };
}

export function stopWatching(): void {
  if (_watcher) {
    _watcher.close();
    _watcher = null;
  }
  _watchPath = null;
  _songFile = null;
  _current = null;
  _previous = null;
  _lastDiff = null;
  _snapshotCount = 0;
}

export function getWatcherStatus(): WatcherStatus {
  return {
    active: _watcher !== null,
    watchPath: _watchPath,
    songFile: _songFile,
    lastParsedAt: _current?.parsedAt ?? null,
    snapshotCount: _snapshotCount,
    lastDiff: _lastDiff,
  };
}

export function getCurrentSnapshot(): SongSnapshot | null {
  return _current;
}

export function getLastDiff(): SongDiff | null {
  return _lastDiff;
}

export function onSongChange(callback: (snap: SongSnapshot, diff: SongDiff | null) => void): void {
  _onChangeCallbacks.push(callback);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findSongFiles(dir: string, maxDepth = 3): string[] {
  const results: string[] = [];

  function walk(current: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isFile() && isSongFile(entry.name)) {
          results.push(full);
        } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
          walk(full, depth + 1);
        }
      }
    } catch { /* permission errors, etc. */ }
  }

  walk(dir, 0);

  // Sort by modification time, newest first
  results.sort((a, b) => {
    try {
      return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
    } catch { return 0; }
  });

  return results;
}
