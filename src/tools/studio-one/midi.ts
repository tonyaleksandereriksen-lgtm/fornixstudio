// ─── Fornix Studio MCP – Studio One: MIDI Tools ──────────────────────────────
//
// Category B: Indirectly implementable.
// MIDI note data is communicated via the bridge with bar/beat/tick positioning.
// The Extension translates these into S1 note events on the target track.
//
// Coordinate system: all positions use { bar, beat, tick } where
//   bar   = 1-based measure number
//   beat  = 1-based beat within bar
//   tick  = 0-based sub-division (0–479 for 480 PPQN)

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendCommand, isBridgeReady } from "../../services/bridge.js";
import { logAction, formatToolResult } from "../../services/logger.js";

// Shared position schema
const PositionSchema = z.object({
  bar: z.number().int().min(1),
  beat: z.number().int().min(1).max(16),
  tick: z.number().int().min(0).max(479).default(0),
});

// Single MIDI note schema
const NoteSchema = z.object({
  pitch: z.number().int().min(0).max(127)
    .describe("MIDI pitch 0–127 (C4 = 60, A4 = 69)"),
  velocity: z.number().int().min(1).max(127).default(100)
    .describe("Note velocity 1–127"),
  start: PositionSchema.describe("Note start position"),
  duration: z.object({
    bars: z.number().int().min(0).default(0),
    beats: z.number().int().min(0).default(1),
    ticks: z.number().int().min(0).max(479).default(0),
  }).describe("Note duration"),
  channel: z.number().int().min(1).max(16).default(1),
});

function notConnected(action: string) {
  return {
    content: [{
      type: "text" as const,
      text: `⚠ Studio One bridge not ready – cannot ${action}.\n` +
        `Use s1_export_instruction with MIDI commands as a fallback.`,
    }],
  };
}

// MIDI note name helpers
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function pitchToName(pitch: number): string {
  const note = NOTE_NAMES[pitch % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return `${note}${octave}`;
}

function nameToMidi(name: string): number | null {
  const match = name.toUpperCase().match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return null;
  const noteIdx = NOTE_NAMES.indexOf(match[1]);
  if (noteIdx === -1) return null;
  const octave = parseInt(match[2], 10);
  return noteIdx + (octave + 1) * 12;
}

export function registerMidiTools(server: McpServer): void {

  // ── s1_add_midi_notes ─────────────────────────────────────────────────────

  server.registerTool("s1_add_midi_notes", {
    title: "Add MIDI Notes",
    description:
      "Insert one or more MIDI notes into a pattern on an instrument track. " +
      "Creates a new part if no part exists at the start position. " +
      "Pitch accepts MIDI number (0–127) or note name (e.g. C4, A#3, Gb5).",
    inputSchema: {
      trackName: z.string().describe("Instrument track name"),
      notes: z.array(NoteSchema).min(1).max(128)
        .describe("Array of notes to insert"),
      partName: z.string().optional()
        .describe("Name for the part/clip (optional, uses track name if omitted)"),
      createPartIfMissing: z.boolean().default(true)
        .describe("Auto-create a MIDI part if none exists at the start position"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ trackName, notes, partName, createPartIfMissing }) => {
    if (!isBridgeReady()) return notConnected(`add MIDI notes to "${trackName}"`);
    try {
      const res = await sendCommand("addMidiNotes", {
        trackName,
        notes,
        partName,
        createPartIfMissing,
      });
      if (!res.ok) throw new Error(res.error);

      const noteList = notes
        .slice(0, 8)
        .map(n => `  ${pitchToName(n.pitch)} vel:${n.velocity} @ bar ${n.start.bar}`)
        .join("\n");
      const more = notes.length > 8 ? `\n  ... +${notes.length - 8} more` : "";

      const summary = `Added ${notes.length} MIDI notes to "${trackName}"`;
      logAction({ tool: "s1_add_midi_notes", action: "s1_bridge", summary, dryRun: false, ok: true });
      return {
        content: [{
          type: "text",
          text: formatToolResult(true, summary, `Notes:\n${noteList}${more}`),
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_add_chord ─────────────────────────────────────────────────────────

  server.registerTool("s1_add_chord", {
    title: "Add Chord",
    description:
      "Insert a chord (multiple simultaneous notes) at a specific position. " +
      "Specify notes by name (e.g. ['C4','E4','G4']) or MIDI numbers. " +
      "Useful for quickly placing chords in an arrangement.",
    inputSchema: {
      trackName: z.string(),
      pitches: z.array(
        z.union([
          z.number().int().min(0).max(127),
          z.string().regex(/^[A-Ga-g]#?-?\d+$/, "Use format like C4, A#3, Gb5"),
        ])
      ).min(2).max(16).describe("Note pitches as MIDI numbers or note names"),
      start: PositionSchema,
      duration: z.object({
        bars: z.number().int().min(0).default(0),
        beats: z.number().int().min(0).default(1),
        ticks: z.number().int().min(0).default(0),
      }),
      velocity: z.number().int().min(1).max(127).default(90),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ trackName, pitches, start, duration, velocity }) => {
    if (!isBridgeReady()) return notConnected(`add chord to "${trackName}"`);
    try {
      // Resolve note names to MIDI numbers
      const resolvedPitches = pitches.map(p => {
        if (typeof p === "number") return p;
        const midi = nameToMidi(p);
        if (midi === null) throw new Error(`Invalid note name: "${p}"`);
        return midi;
      });

      const notes = resolvedPitches.map(pitch => ({
        pitch,
        velocity,
        start,
        duration,
        channel: 1,
      }));

      const res = await sendCommand("addMidiNotes", {
        trackName,
        notes,
        createPartIfMissing: true,
      });
      if (!res.ok) throw new Error(res.error);

      const chordStr = resolvedPitches.map(pitchToName).join(" + ");
      const summary = `Chord [${chordStr}] added to "${trackName}" at bar ${start.bar}`;
      logAction({ tool: "s1_add_chord", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_add_drum_pattern ───────────────────────────────────────────────────

  server.registerTool("s1_add_drum_pattern", {
    title: "Add Drum Pattern",
    description:
      "Insert a drum pattern using step-sequencer notation. " +
      "Each step string is 16 characters, 'X' = hit, '.' = rest, 'x' = soft hit (vel 60). " +
      "Standard GM drum map is used by default (kick=36, snare=38, hihat=42).",
    inputSchema: {
      trackName: z.string().describe("Drum/instrument track"),
      startBar: z.number().int().min(1),
      lengthBars: z.number().int().min(1).max(16).default(1),
      steps: z.object({
        kick: z.string().length(16).optional().describe("16-step kick pattern e.g. 'X...X...X...X...'"),
        snare: z.string().length(16).optional().describe("16-step snare pattern"),
        hihat: z.string().length(16).optional().describe("16-step closed hihat"),
        openHihat: z.string().length(16).optional().describe("16-step open hihat"),
        clap: z.string().length(16).optional().describe("16-step clap"),
        custom: z.array(z.object({
          pitch: z.number().int().min(0).max(127),
          pattern: z.string().length(16),
        })).optional().describe("Custom pitch patterns"),
      }),
      swing: z.number().min(50).max(75).default(50)
        .describe("Swing percentage (50 = straight, 67 = triplet feel)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ trackName, startBar, lengthBars, steps, swing }) => {
    if (!isBridgeReady()) return notConnected(`add drum pattern to "${trackName}"`);
    try {
      const GM_MAP: Record<string, number> = {
        kick: 36, snare: 38, hihat: 42, openHihat: 46, clap: 39,
      };

      const notes: Array<{
        pitch: number;
        velocity: number;
        start: { bar: number; beat: number; tick: number };
        duration: { bars: number; beats: number; ticks: number };
        channel: number;
      }> = [];
      const TICKS_PER_STEP = 120; // 480 PPQN / 4 steps per beat

      const addPattern = (pattern: string, pitch: number) => {
        for (let i = 0; i < 16; i++) {
          const ch = pattern[i];
          if (ch === "." || ch === " ") continue;

          const velocity = ch === "x" ? 60 : ch === "X" ? 100 : 80;
          const beat = Math.floor(i / 4) + 1;
          const stepInBeat = i % 4;

          // Apply swing to off-beat 16th notes (steps 1, 3 within each beat)
          let tick = stepInBeat * TICKS_PER_STEP;
          if (stepInBeat === 1 && swing > 50) {
            tick = Math.round(tick * (swing / 50));
          }

          notes.push({
            pitch,
            velocity,
            start: { bar: startBar, beat, tick },
            duration: { bars: 0, beats: 0, ticks: 80 },
            channel: 10, // GM drum channel
          });
        }
      };

      if (steps.kick) addPattern(steps.kick, GM_MAP.kick);
      if (steps.snare) addPattern(steps.snare, GM_MAP.snare);
      if (steps.hihat) addPattern(steps.hihat, GM_MAP.hihat);
      if (steps.openHihat) addPattern(steps.openHihat, GM_MAP.openHihat);
      if (steps.clap) addPattern(steps.clap, GM_MAP.clap);
      for (const c of steps.custom ?? []) {
        addPattern(c.pattern, c.pitch);
      }

      if (notes.length === 0) throw new Error("No steps defined – all patterns are empty");

      const res = await sendCommand("addMidiNotes", {
        trackName, notes,
        createPartIfMissing: true,
        partName: `Beat – Bar ${startBar}`,
      });
      if (!res.ok) throw new Error(res.error);

      const summary = `Drum pattern added to "${trackName}": ${notes.length} hits over ${lengthBars} bar(s)`;
      logAction({ tool: "s1_add_drum_pattern", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_clear_midi_part ────────────────────────────────────────────────────

  server.registerTool("s1_clear_midi_part", {
    title: "Clear MIDI Part",
    description: "Delete all notes from a MIDI part on a track within a bar range.",
    inputSchema: {
      trackName: z.string(),
      startBar: z.number().int().min(1),
      endBar: z.number().int().min(1),
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ trackName, startBar, endBar }) => {
    if (!isBridgeReady()) return notConnected(`clear MIDI part on "${trackName}"`);
    try {
      const res = await sendCommand("clearMidiPart", { trackName, startBar, endBar });
      if (!res.ok) throw new Error(res.error);
      const summary = `Cleared MIDI notes on "${trackName}" bars ${startBar}–${endBar}`;
      logAction({ tool: "s1_clear_midi_part", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_quantize_part ──────────────────────────────────────────────────────

  server.registerTool("s1_quantize_part", {
    title: "Quantize MIDI Part",
    description: "Quantize notes in a MIDI part to the nearest grid value.",
    inputSchema: {
      trackName: z.string(),
      startBar: z.number().int().min(1),
      endBar: z.number().int().min(1),
      gridValue: z.enum(["1/4", "1/8", "1/16", "1/32"])
        .default("1/16").describe("Quantize grid"),
      strength: z.number().min(0).max(100).default(100)
        .describe("Quantize strength % (100 = hard quantize)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ trackName, startBar, endBar, gridValue, strength }) => {
    if (!isBridgeReady()) return notConnected(`quantize "${trackName}"`);
    try {
      const res = await sendCommand("quantizePart", { trackName, startBar, endBar, gridValue, strength });
      if (!res.ok) throw new Error(res.error);
      const summary = `Quantized "${trackName}" bars ${startBar}–${endBar} to ${gridValue} @ ${strength}%`;
      logAction({ tool: "s1_quantize_part", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });
}
