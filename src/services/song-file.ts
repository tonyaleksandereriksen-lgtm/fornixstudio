// ─── Fornix Studio MCP – Song File Probe ──────────────────────────────────────
//
// Reads a Studio One .song file from disk and extracts arrangement data.
// Studio One .song files are ZIP archives containing XML (Song/Song.xml).
// This probe attempts multiple strategies:
//   1. ZIP extraction using Node's built-in zlib (deflate per entry)
//   2. Raw UTF-8 text parse (if the file is already XML)
//   3. Binary string scan (extract readable fragments from raw bytes)

import fs from "fs";
import zlib from "zlib";

// ─── Types ───────────���─────────────────────────────────���────────────────────────

export interface Marker {
  name: string;
  positionBars: number;
  positionSeconds: number;
}

export interface Track {
  name: string;
  type: string;
  regionCount: number;
}

export interface Region {
  trackName: string;
  name: string;
  startBar: number;
  lengthBars: number;
}

export type SongFileFormat = "xml" | "zip-xml" | "binary" | "unknown";

export interface SongFileResult {
  format: SongFileFormat;
  raw: string;
  markers: Marker[];
  tracks: Track[];
  tempo: number | null;
  timeSignature: string | null;
  regions: Region[];
  parseNotes: string[];
}

// ─── ZIP mini-reader ──────────��─────────────────────────────────────────────────
//
// Studio One .song = ZIP containing Song/Song.xml (or similar).
// ZIP local file headers: PK\x03\x04 … filename … compressed data.
// We locate entries, inflate the XML one with zlib.inflateRawSync.

const ZIP_LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_CENTRAL_DIR = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
const ZIP_END_CENTRAL = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

interface ZipEntry {
  filename: string;
  compressedData: Buffer;
  compressionMethod: number;
}

/**
 * Read ZIP entries using the central directory (at end of file) for accurate
 * sizes, then extract compressed data from the corresponding local headers.
 * Studio One .song files use data descriptors (bit 3 of GP flag) so the
 * local header often has compressedSize=0 — the central directory is the
 * reliable source.
 */
function findZipEntries(buf: Buffer): ZipEntry[] {
  // Try central-directory approach first (reliable for S1 .song files)
  const cdEntries = findZipEntriesViaCentralDir(buf);
  if (cdEntries.length > 0) return cdEntries;

  // Fallback: local-header scan (works for simpler ZIPs)
  return findZipEntriesViaLocalHeaders(buf);
}

function findZipEntriesViaCentralDir(buf: Buffer): ZipEntry[] {
  // Find End of Central Directory record (search from end, last 65KB)
  const searchStart = Math.max(0, buf.length - 65536);
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= searchStart; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return [];

  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const cdEntryCount = buf.readUInt16LE(eocdOffset + 10);

  if (cdOffset >= buf.length) return [];

  const entries: ZipEntry[] = [];
  let pos = cdOffset;

  for (let i = 0; i < cdEntryCount && pos + 46 <= buf.length; i++) {
    // Verify central directory signature
    if (buf[pos] !== 0x50 || buf[pos + 1] !== 0x4b || buf[pos + 2] !== 0x01 || buf[pos + 3] !== 0x02) {
      break;
    }

    const compressionMethod = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const filenameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);

    const filename = buf.subarray(pos + 46, pos + 46 + filenameLen).toString("utf8");

    // Now locate data in the local file header
    if (localHeaderOffset + 30 <= buf.length) {
      const localFilenameLen = buf.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localFilenameLen + localExtraLen;

      if (compressedSize > 0 && dataStart + compressedSize <= buf.length) {
        entries.push({
          filename,
          compressedData: buf.subarray(dataStart, dataStart + compressedSize),
          compressionMethod,
        });
      }
    }

    pos += 46 + filenameLen + extraLen + commentLen;
  }

  return entries;
}

function findZipEntriesViaLocalHeaders(buf: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset < buf.length - 30) {
    const headerIdx = buf.indexOf(ZIP_LOCAL_HEADER, offset);
    if (headerIdx === -1) break;

    const compressionMethod = buf.readUInt16LE(headerIdx + 8);
    const compressedSize = buf.readUInt32LE(headerIdx + 18);
    const filenameLen = buf.readUInt16LE(headerIdx + 26);
    const extraLen = buf.readUInt16LE(headerIdx + 28);

    const filenameStart = headerIdx + 30;
    const filename = buf.subarray(filenameStart, filenameStart + filenameLen).toString("utf8");

    const dataStart = filenameStart + filenameLen + extraLen;

    if (compressedSize > 0 && dataStart + compressedSize <= buf.length) {
      entries.push({
        filename,
        compressedData: buf.subarray(dataStart, dataStart + compressedSize),
        compressionMethod,
      });
      offset = dataStart + compressedSize;
    } else {
      offset = headerIdx + 4;
    }
  }

  return entries;
}

function inflateEntry(entry: ZipEntry): string | null {
  try {
    if (entry.compressionMethod === 0) {
      // Stored (no compression)
      return entry.compressedData.toString("utf8");
    }
    if (entry.compressionMethod === 8) {
      // Deflate
      return zlib.inflateRawSync(entry.compressedData).toString("utf8");
    }
    return null;
  } catch {
    return null;
  }
}

// ─── XML extraction (regex-based, no dependency) ────────────────────────────────

/** Extract a named attribute from an XML element string (order-independent) */
function attr(element: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i").exec(element);
  return m ? m[1] : null;
}

function extractSampleRate(xml: string): number {
  const m = /sampleRate\s*=\s*"(\d+)"/i.exec(xml);
  return m ? parseInt(m[1], 10) : 44100;
}

function extractMarkers(xml: string, tempo: number | null): Marker[] {
  const markers: Marker[] = [];
  const sampleRate = extractSampleRate(xml);

  // Match full element tags for marker-like elements (order-independent attribute extraction)
  const elementPattern = /<(MarkerEvent|ArrangerEvent|Marker|Section)\b[^>]*?\/?>/gi;
  let elMatch: RegExpExecArray | null;

  while ((elMatch = elementPattern.exec(xml)) !== null) {
    const element = elMatch[0];
    const tag = elMatch[1];
    const name = attr(element, "name");
    if (!name) continue;

    // Filter S1 system markers: markerType="2" (Start) and "3" (End) are loop markers, not arrangement
    const markerType = attr(element, "markerType");
    if (markerType === "2" || markerType === "3") continue;

    const rawStart = attr(element, "start");

    if (!rawStart) {
      // No start attribute = position 0
      markers.push({ name, positionBars: 1, positionSeconds: 0 });
      continue;
    }

    const rawPosition = parseFloat(rawStart);
    if (isNaN(rawPosition)) continue;

    let positionSeconds: number;
    let positionBars: number;

    if (rawPosition > 10000) {
      // S1 sample-based position (timeFormat="2"): position in samples
      positionSeconds = rawPosition / sampleRate;
      if (tempo) {
        positionBars = Math.round((positionSeconds * tempo) / (60 * 4)) + 1;
      } else {
        positionBars = 0;
      }
    } else if (tempo) {
      // Small values: seconds (MarkerEvents with timeFormat="2" and small positions)
      positionSeconds = rawPosition;
      positionBars = Math.round((rawPosition * tempo) / (60 * 4)) + 1;
    } else {
      positionSeconds = rawPosition;
      positionBars = 0;
    }

    markers.push({ name, positionBars, positionSeconds });
  }

  // Filter out scratch-pad markers (beyond reasonable song length ~20 min = ~1200 bars at 150 BPM)
  const maxReasonableBars = 600;
  const filtered = markers.filter((m) => m.positionBars <= maxReasonableBars);

  // Deduplicate by name+position
  const seen = new Set<string>();
  const deduped = filtered.filter((m) => {
    const key = `${m.name}:${m.positionBars.toFixed(0)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by bar position
  deduped.sort((a, b) => a.positionBars - b.positionBars);
  return deduped;
}

function extractTracks(xml: string): Track[] {
  const tracks: Track[] = [];
  const seen = new Set<string>();

  // S1 actual format: <MediaTrack ... name="..." mediaType="Music|Audio" ...>
  // Attributes can be in any order, so use attr() helper
  const mediaTrackPattern = /<MediaTrack\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = mediaTrackPattern.exec(xml)) !== null) {
    const el = match[0];
    const name = attr(el, "name");
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const mediaType = (attr(el, "mediaType") ?? "audio").toLowerCase();
    const type = mediaType === "music" ? "instrument" : "audio";
    tracks.push({ name, type, regionCount: 0 });
  }

  // S1 folder tracks: <FolderTrack ... name="..." ...>
  const folderPattern = /<FolderTrack\b[^>]*>/gi;
  while ((match = folderPattern.exec(xml)) !== null) {
    const el = match[0];
    const name = attr(el, "name");
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    tracks.push({ name, type: "folder", regionCount: 0 });
  }

  // Legacy/generic patterns (for non-S1 XML or test XML)
  const genericPattern = /<(?:Audio|Instrument|Bus)?Track\b[^>]*>/gi;
  while ((match = genericPattern.exec(xml)) !== null) {
    const el = match[0];
    const name = attr(el, "name");
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const type = attr(el, "type") ?? inferTrackType(name);
    tracks.push({ name, type, regionCount: 0 });
  }

  return tracks;
}

function inferTrackType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("bus") || lower === "master") return "bus";
  if (lower.includes("fx") || lower.includes("send")) return "fx";
  return "audio";
}

function countRegionsForTrack(xml: string, _trackName: string): number {
  // Rough count: number of <Event or <AudioClip or <MusicPart tags near the track
  // For the POC, return 0 — full region-per-track mapping needs DOM traversal
  return 0;
}

function extractRegions(xml: string, tempo: number | null): Region[] {
  const regions: Region[] = [];
  // <Event name="..." start="..." length="..."/> or <AudioClip .../>
  const pattern = /<(?:Event|AudioClip|MusicPart)\b[^>]*?\bname\s*=\s*"([^"]*)"[^>]*?\bstart\s*=\s*"([^"]*)"[^>]*?\blength\s*=\s*"([^"]*)"[^>]*?\/?>/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    const name = match[1];
    const rawStart = parseFloat(match[2]);
    const rawLength = parseFloat(match[3]);

    const ppq = 960;
    const beatsPerBar = 4;
    let startBar: number;
    let lengthBars: number;

    if (rawStart > 10000 || rawLength > 10000) {
      startBar = Math.round(((rawStart / ppq) / beatsPerBar) * 100) / 100;
      lengthBars = Math.round(((rawLength / ppq) / beatsPerBar) * 100) / 100;
    } else if (tempo) {
      startBar = Math.round(((rawStart * tempo) / (60 * beatsPerBar)) * 100) / 100;
      lengthBars = Math.round(((rawLength * tempo) / (60 * beatsPerBar)) * 100) / 100;
    } else {
      startBar = rawStart;
      lengthBars = rawLength;
    }

    regions.push({ trackName: "", name, startBar, lengthBars });
  }

  return regions;
}

function extractTempo(xml: string): number | null {
  // S1 actual format: <TempoMapSegment ... tempo="VALUE" .../>
  // where VALUE is seconds-per-beat, BPM = 60 / VALUE
  const tempoMapMatch = /<TempoMapSegment\b[^>]*?\btempo\s*=\s*"([^"]+)"[^>]*?\bstart\s*=\s*"0"/i.exec(xml)
    ?? /<TempoMapSegment\b[^>]*?\bstart\s*=\s*"0"[^>]*?\btempo\s*=\s*"([^"]+)"/i.exec(xml);

  if (tempoMapMatch) {
    const val = parseFloat(tempoMapMatch[1]);
    if (val > 0 && val < 2) {
      // seconds-per-beat: BPM = 60 / val
      const bpm = Math.round(60 / val);
      if (bpm >= 60 && bpm <= 300) return bpm;
    }
  }

  // Fallback: first TempoMapSegment regardless of start
  const anyTempoMap = /<TempoMapSegment\b[^>]*?\btempo\s*=\s*"([^"]+)"/i.exec(xml);
  if (anyTempoMap) {
    const val = parseFloat(anyTempoMap[1]);
    if (val > 0 && val < 2) {
      const bpm = Math.round(60 / val);
      if (bpm >= 60 && bpm <= 300) return bpm;
    }
  }

  // Legacy/generic patterns: <Tempo value="150"/> or bpm="150" or tempo="150"
  const legacyPatterns = [
    /<Tempo\b[^>]*?\bvalue\s*=\s*"([^"]+)"/i,
    /\bbpm\s*=\s*"([^"]+)"/i,
  ];

  for (const p of legacyPatterns) {
    const m = p.exec(xml);
    if (m) {
      const val = parseFloat(m[1]);
      if (val >= 60 && val <= 300) return val;
    }
  }

  return null;
}

function extractTimeSignature(xml: string): string | null {
  // S1 actual: <TimeSignatureMapSegment ... numerator="4" denominator="4"/>
  // Generic: <TimeSignature numerator="4" denominator="4"/>
  const m = /numerator\s*=\s*"(\d+)"[^>]*?denominator\s*=\s*"(\d+)"/i.exec(xml);
  if (m) return `${m[1]}/${m[2]}`;

  const m2 = /timeSignature\s*=\s*"([^"]+)"/i.exec(xml);
  if (m2) return m2[1];

  return null;
}

// ─── Binary string scanner ──────��───────────────────────────────────────────────

function scanBinaryForStrings(buf: Buffer): string {
  // Extract all runs of printable ASCII >= 4 chars
  const strings: string[] = [];
  let current = "";

  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    if (byte >= 0x20 && byte <= 0x7e) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= 4) {
        strings.push(current);
      }
      current = "";
    }
  }
  if (current.length >= 4) strings.push(current);

  return strings.join("\n");
}

// ─── Public API ───���──────────────────────────���─────────────────────────────────��

export function tryParseSongFile(filePath: string): SongFileResult {
  const buf = fs.readFileSync(filePath);
  const notes: string[] = [];

  // Strategy 1: Check for ZIP (Studio One .song is a ZIP archive)
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    notes.push("Detected ZIP archive (Studio One .song format)");

    const entries = findZipEntries(buf);
    const xmlNames = entries.filter(e => e.filename.endsWith(".xml")).map(e => e.filename);
    notes.push(`Found ${entries.length} ZIP entries (${xmlNames.length} XML: ${xmlNames.join(", ")})`);

    // Look for the main Song XML — prioritize Song/song.xml (Studio One standard)
    const xmlCandidates = entries.filter((e) =>
      e.filename.toLowerCase().endsWith(".xml"),
    );

    // Sort: Song/song.xml first, then other song-related XMLs, then any XML
    xmlCandidates.sort((a, b) => {
      const aIsSong = a.filename.toLowerCase() === "song/song.xml" ? 0 : 1;
      const bIsSong = b.filename.toLowerCase() === "song/song.xml" ? 0 : 1;
      if (aIsSong !== bIsSong) return aIsSong - bIsSong;

      const aHasSong = a.filename.toLowerCase().includes("song") ? 0 : 1;
      const bHasSong = b.filename.toLowerCase().includes("song") ? 0 : 1;
      return aHasSong - bHasSong;
    });

    // Try each XML candidate until one yields data
    for (const xmlEntry of xmlCandidates) {
      const xml = inflateEntry(xmlEntry);
      if (xml && xml.includes("<")) {
        const tempo = extractTempo(xml);
        const markers = extractMarkers(xml, tempo);
        const tracks = extractTracks(xml);

        // Only use this entry if it actually has song data
        if (markers.length > 0 || tracks.length > 0 || tempo !== null) {
          notes.push(`Extracted song data from ${xmlEntry.filename} (${xml.length} chars)`);
          return {
            format: "zip-xml",
            raw: xml.slice(0, 50_000),
            markers,
            tracks,
            tempo,
            timeSignature: extractTimeSignature(xml),
            regions: extractRegions(xml, tempo),
            parseNotes: notes,
          };
        }
        notes.push(`${xmlEntry.filename}: inflated OK but no song data found`);
      } else {
        notes.push(`${xmlEntry.filename}: could not inflate`);
      }
    }

    // Fallback: try combining all inflatable entries
    notes.push("No single XML had song data — scanning all entries");
    const combined = entries
      .map((e) => inflateEntry(e))
      .filter(Boolean)
      .join("\n");

    if (combined.length > 0) {
      const tempo = extractTempo(combined);
      const markers = extractMarkers(combined, tempo);
      const tracks = extractTracks(combined);

      if (markers.length > 0 || tracks.length > 0 || tempo !== null) {
        return {
          format: "zip-xml",
          raw: combined.slice(0, 50_000),
          markers,
          tracks,
          tempo,
          timeSignature: extractTimeSignature(combined),
          regions: extractRegions(combined, tempo),
          parseNotes: notes,
        };
      }
    }
  }

  // Strategy 2: Try as UTF-8 text / XML
  const text = buf.toString("utf8");
  if (text.includes("<") && (text.includes("Track") || text.includes("Marker") || text.includes("Song"))) {
    notes.push("Detected XML content");
    const tempo = extractTempo(text);
    return {
      format: "xml",
      raw: text.slice(0, 50_000),
      markers: extractMarkers(text, tempo),
      tracks: extractTracks(text),
      tempo,
      timeSignature: extractTimeSignature(text),
      regions: extractRegions(text, tempo),
      parseNotes: notes,
    };
  }

  // Strategy 3: Binary string scan
  notes.push("File is not XML — scanning binary for readable strings");
  const scanned = scanBinaryForStrings(buf);
  const tempo = extractTempo(scanned);
  const markers = extractMarkers(scanned, tempo);
  const tracks = extractTracks(scanned);

  if (markers.length > 0 || tracks.length > 0 || tempo !== null) {
    notes.push(`Binary scan found: ${markers.length} markers, ${tracks.length} tracks, tempo=${tempo}`);
    return {
      format: "binary",
      raw: scanned.slice(0, 50_000),
      markers,
      tracks,
      tempo,
      timeSignature: extractTimeSignature(scanned),
      regions: extractRegions(scanned, tempo),
      parseNotes: notes,
    };
  }

  notes.push("Could not extract arrangement data from this file");
  return {
    format: "unknown",
    raw: scanned.slice(0, 10_000),
    markers: [],
    tracks: [],
    tempo: null,
    timeSignature: null,
    regions: [],
    parseNotes: notes,
  };
}
