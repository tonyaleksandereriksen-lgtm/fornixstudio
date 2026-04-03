// ─── Fornix Studio MCP – Sound Design Helper ─────────────────────────────────
//
// Generates human-readable and machine-readable sound design recipes.
// Does NOT write directly into Serum/Sylenth1 (no public patch file API).
// Category B: produces patch descriptor files the producer can execute manually,
// or that future plugin-specific tools can parse.

import fs from "fs";
import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { guardPath } from "../services/workspace.js";
import { logAction, formatToolResult } from "../services/logger.js";

// ── Types ────────────────────────────────────────────────────────────────────

const WaveformSchema = z.enum([
  "Saw", "Square", "Sine", "Triangle", "Noise",
  "Custom", "Wavetable",
]);

const FilterTypeSchema = z.enum([
  "LP12", "LP24", "HP12", "HP24", "BP", "Notch", "Peak", "Comb",
]);

const OscillatorSchema = z.object({
  waveform: WaveformSchema,
  octave: z.number().int().min(-3).max(3).default(0),
  semitone: z.number().int().min(-12).max(12).default(0),
  cents: z.number().int().min(-100).max(100).default(0),
  level: z.number().min(0).max(100).default(100),
  unisonVoices: z.number().int().min(1).max(16).default(1),
  unisonDetune: z.number().min(0).max(100).default(0),
  pan: z.number().min(-100).max(100).default(0),
  wavetableName: z.string().optional().describe("Serum wavetable name (if waveform=Wavetable)"),
});

const FilterSchema = z.object({
  type: FilterTypeSchema.default("LP24"),
  cutoff: z.number().min(20).max(20000).describe("Cutoff frequency in Hz"),
  resonance: z.number().min(0).max(100).default(20),
  drive: z.number().min(0).max(100).default(0),
  envelopeAmount: z.number().min(-100).max(100).default(0)
    .describe("Filter envelope modulation depth (negative = inverted)"),
});

const EnvelopeSchema = z.object({
  attack: z.number().min(0).max(20000).describe("Attack time in ms"),
  decay: z.number().min(0).max(20000).describe("Decay time in ms"),
  sustain: z.number().min(0).max(100).describe("Sustain level %"),
  release: z.number().min(0).max(20000).describe("Release time in ms"),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function msToLabel(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function renderOscBlock(osc: z.infer<typeof OscillatorSchema>, label: string): string {
  const detune = osc.unisonVoices > 1
    ? `  Unison: ${osc.unisonVoices} voices, ${osc.unisonDetune}¢ detune\n`
    : "";
  const wt = osc.wavetableName ? ` (${osc.wavetableName})` : "";
  return [
    `**${label}:**`,
    `  Waveform: ${osc.waveform}${wt}`,
    `  Tune: ${osc.octave > 0 ? "+" : ""}${osc.octave} oct, ${osc.semitone > 0 ? "+" : ""}${osc.semitone} semi, ${osc.cents > 0 ? "+" : ""}${osc.cents}¢`,
    `  Level: ${osc.level}%  |  Pan: ${osc.pan > 0 ? "+" : ""}${osc.pan}`,
    detune,
  ].filter(Boolean).join("\n");
}

// ── Tool registration ──────────────────────────────────────────────────────

export function registerSoundDesignTools(server: McpServer): void {

  // ── sd_describe_patch ─────────────────────────────────────────────────────

  server.registerTool("sd_describe_patch", {
    title: "Describe Synth Patch",
    description:
      "Generate a detailed, human-readable synth patch recipe as Markdown. " +
      "Covers oscillators, filter, envelopes, and effects. " +
      "Saves as a .md file for reference while programming the synth manually. " +
      "Works for Serum, Sylenth1, or any synth.",
    inputSchema: {
      outputDir: z.string().describe("Directory to save the patch description"),
      patchName: z.string().min(1).describe("Name of the patch (e.g. 'Fornix Supersaw')"),
      synth: z.enum(["Serum", "Sylenth1", "Vital", "Generic"])
        .default("Serum"),
      category: z.enum([
        "Lead", "Pad", "Pluck", "Bass", "Chord", "FX", "Arp", "Stab",
      ]),
      oscillators: z.array(OscillatorSchema).min(1).max(4),
      filter: FilterSchema.optional(),
      ampEnvelope: EnvelopeSchema,
      filterEnvelope: EnvelopeSchema.optional(),
      lfo: z.array(z.object({
        rate: z.string().describe("e.g. '1/4', '2 Hz', 'Key Sync'"),
        waveform: WaveformSchema,
        target: z.string().describe("What it modulates e.g. 'Filter Cutoff', 'Osc1 Pan'"),
        amount: z.number().min(-100).max(100),
      })).optional(),
      effects: z.array(z.object({
        type: z.string().describe("e.g. 'Reverb', 'Chorus', 'Distortion', 'Delay'"),
        settings: z.record(z.union([z.string(), z.number()])),
      })).optional(),
      notes: z.string().optional().describe("Producer notes, usage tips, or context"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({
    outputDir, patchName, synth, category,
    oscillators, filter, ampEnvelope, filterEnvelope,
    lfo, effects, notes,
  }) => {
    try {
      const abs = guardPath(outputDir);
      fs.mkdirSync(abs, { recursive: true });

      const lines: string[] = [
        `# Patch: ${patchName}`,
        `**Synth:** ${synth}  |  **Category:** ${category}  |  **Date:** ${new Date().toLocaleDateString()}`,
        "",
        "---",
        "",
        "## Oscillators",
        "",
        ...oscillators.map((osc, i) => renderOscBlock(osc, `OSC ${i + 1}`)),
        "",
        "---",
        "",
        "## Amp Envelope",
        `| A | D | S | R |`,
        `|---|---|---|---|`,
        `| ${msToLabel(ampEnvelope.attack)} | ${msToLabel(ampEnvelope.decay)} | ${ampEnvelope.sustain}% | ${msToLabel(ampEnvelope.release)} |`,
        "",
      ];

      if (filter) {
        lines.push(
          "## Filter",
          `- **Type:** ${filter.type}`,
          `- **Cutoff:** ${filter.cutoff} Hz`,
          `- **Resonance:** ${filter.resonance}%`,
          filter.drive > 0 ? `- **Drive:** ${filter.drive}%` : "",
          filter.envelopeAmount !== 0 ? `- **Env Amount:** ${filter.envelopeAmount > 0 ? "+" : ""}${filter.envelopeAmount}%` : "",
          "",
        );
      }

      if (filterEnvelope) {
        lines.push(
          "## Filter Envelope",
          `| A | D | S | R |`,
          `|---|---|---|---|`,
          `| ${msToLabel(filterEnvelope.attack)} | ${msToLabel(filterEnvelope.decay)} | ${filterEnvelope.sustain}% | ${msToLabel(filterEnvelope.release)} |`,
          "",
        );
      }

      if (lfo?.length) {
        lines.push("## LFOs", "");
        for (const l of lfo) {
          lines.push(`**LFO:** ${l.waveform} @ ${l.rate} → ${l.target} (${l.amount > 0 ? "+" : ""}${l.amount}%)`);
        }
        lines.push("");
      }

      if (effects?.length) {
        lines.push("## Effects Chain", "");
        for (const fx of effects) {
          const settings = Object.entries(fx.settings)
            .map(([k, v]) => `${k}: ${v}`)
            .join("  |  ");
          lines.push(`**${fx.type}:** ${settings}`);
        }
        lines.push("");
      }

      if (notes) {
        lines.push("## Notes", "", notes, "");
      }

      lines.push("---", "_Generated by Fornix Studio MCP_");

      const md = lines.filter(l => l !== undefined).join("\n");
      const filename = `patch-${patchName.replace(/\s+/g, "-").toLowerCase()}.md`;
      const filePath = path.join(abs, filename);
      fs.writeFileSync(filePath, md, "utf8");

      // Also write JSON for machine parsing
      const jsonPath = filePath.replace(".md", ".json");
      fs.writeFileSync(jsonPath, JSON.stringify({
        patchName, synth, category, oscillators, filter,
        ampEnvelope, filterEnvelope, lfo, effects, notes,
      }, null, 2));

      const summary = `Patch recipe written: "${patchName}" (${synth} ${category})`;
      logAction({ tool: "sd_describe_patch", action: "write", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, { mdPath: filePath, jsonPath }) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── sd_generate_hardstyle_lead ────────────────────────────────────────────

  server.registerTool("sd_generate_hardstyle_lead", {
    title: "Generate Hardstyle Lead Preset",
    description:
      "Generate a Fornix-style hardstyle lead synth recipe optimised for Serum. " +
      "Outputs a Markdown patch descriptor with oscillator, filter, and FX settings " +
      "tuned for a powerful, modern hardstyle lead sound.",
    inputSchema: {
      outputDir: z.string().describe("Output directory"),
      patchName: z.string().default("Fornix Lead"),
      character: z.enum(["bright", "dark", "screechy", "warm", "mid-focused"])
        .default("bright")
        .describe("Tonal character of the lead"),
      unisonVoices: z.number().int().min(1).max(8).default(4),
      unisonDetune: z.number().min(0).max(50).default(18),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ outputDir, patchName, character, unisonVoices, unisonDetune }) => {
    try {
      const abs = guardPath(outputDir);
      fs.mkdirSync(abs, { recursive: true });

      const cutoffMap: Record<string, number> = {
        bright: 8000, dark: 1200, screechy: 12000, warm: 2500, "mid-focused": 4000,
      };

      const resonanceMap: Record<string, number> = {
        bright: 30, dark: 45, screechy: 65, warm: 20, "mid-focused": 35,
      };

      const recipe = {
        patchName,
        synth: "Serum",
        category: "Lead",
        character,
        oscillators: [
          {
            label: "OSC A – Main",
            waveform: "Wavetable",
            wavetableName: character === "screechy" ? "Analog_Saw_Down" : "Hypersaw",
            octave: 0, semitone: 0, cents: 0,
            level: 100,
            unisonVoices,
            unisonDetune,
            pan: 0,
          },
          {
            label: "OSC B – Sub support",
            waveform: "Sine",
            octave: -1, semitone: 0, cents: 0,
            level: 40,
            unisonVoices: 1,
            unisonDetune: 0,
            pan: 0,
          },
        ],
        filter: {
          type: "LP24",
          cutoff: cutoffMap[character],
          resonance: resonanceMap[character],
          drive: character === "screechy" ? 30 : 0,
          envelopeAmount: -20,
        },
        ampEnvelope: { attack: 5, decay: 200, sustain: 90, release: 300 },
        filterEnvelope: { attack: 0, decay: 800, sustain: 20, release: 400 },
        lfo: [
          { rate: "1/4", waveform: "Sine", target: "Osc A Unison Detune", amount: 8 },
        ],
        effects: [
          { type: "Hyper/Dimension", settings: { mix: 25, size: 40 } },
          { type: "Distortion", settings: { mode: "Soft Clip", drive: character === "screechy" ? 45 : 20, mix: 100 } },
          { type: "EQ", settings: { lowCut: "80Hz", highShelf: "+2dB @ 8kHz" } },
          { type: "Reverb", settings: { size: 15, mix: 8 } },
          { type: "Delay", settings: { time: "1/8", feedback: 20, mix: 12 } },
        ],
        producerNotes: [
          `Character: ${character}`,
          `Route this track → LEAD bus → FabFilter Pro-R 2 → SSL Bus Compressor`,
          `Layer with a separate sub sine (−1 oct) at −6 dB for body`,
          `Automate filter cutoff in the breakdown for tension`,
        ].join("\n"),
      };

      const md = [
        `# Patch: ${patchName}`,
        `**Synth:** Serum  |  **Category:** Lead  |  **Character:** ${character}`,
        `**Generated:** ${new Date().toLocaleDateString()}`,
        "",
        "---",
        "",
        "## Oscillators",
        "",
        ...recipe.oscillators.map(osc => [
          `**${osc.label}:**`,
          `  Waveform: ${osc.waveform}${osc.wavetableName ? ` (${osc.wavetableName})` : ""}`,
          `  Tune: ${osc.octave} oct, ${osc.semitone} semi, ${osc.cents}¢`,
          `  Level: ${osc.level}%`,
          osc.unisonVoices > 1 ? `  Unison: ${osc.unisonVoices} voices @ ${osc.unisonDetune}¢` : "",
        ].filter(Boolean).join("\n")),
        "",
        "## Filter",
        `- Type: LP24`,
        `- Cutoff: ${recipe.filter.cutoff} Hz`,
        `- Resonance: ${recipe.filter.resonance}%`,
        `- Drive: ${recipe.filter.drive}%`,
        `- Env Amount: ${recipe.filter.envelopeAmount}%`,
        "",
        "## Amp Envelope",
        `A: ${recipe.ampEnvelope.attack}ms | D: ${recipe.ampEnvelope.decay}ms | S: ${recipe.ampEnvelope.sustain}% | R: ${recipe.ampEnvelope.release}ms`,
        "",
        "## Filter Envelope",
        `A: ${recipe.filterEnvelope.attack}ms | D: ${recipe.filterEnvelope.decay}ms | S: ${recipe.filterEnvelope.sustain}% | R: ${recipe.filterEnvelope.release}ms`,
        "",
        "## LFO",
        `Rate: ${recipe.lfo[0].rate} | Wave: ${recipe.lfo[0].waveform} | Target: ${recipe.lfo[0].target} | Amount: ${recipe.lfo[0].amount}%`,
        "",
        "## Effects Chain",
        ...recipe.effects.map(fx => `- **${fx.type}:** ${Object.entries(fx.settings).map(([k,v]) => `${k}=${v}`).join(", ")}`),
        "",
        "## Producer Notes",
        recipe.producerNotes,
        "",
        "---",
        "_Generated by Fornix Studio MCP_",
      ].join("\n");

      const filename = `patch-${patchName.replace(/\s+/g, "-").toLowerCase()}.md`;
      const filePath = path.join(abs, filename);
      fs.writeFileSync(filePath, md, "utf8");
      fs.writeFileSync(filePath.replace(".md", ".json"), JSON.stringify(recipe, null, 2));

      const summary = `Hardstyle lead recipe generated: "${patchName}" (${character}, ${unisonVoices}v)`;
      logAction({ tool: "sd_generate_hardstyle_lead", action: "write", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, { filePath }) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });
}
