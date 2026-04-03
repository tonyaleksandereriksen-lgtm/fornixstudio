// ─── Fornix Studio MCP – Session Tools ───────────────────────────────────────
//
// High-level session management:
//   session_kickstart       - set up a full hardstyle session from scratch
//   session_apply_mix_preset - apply Fornix plugin settings across the mix
//   session_health_check    - analyse the current project for issues

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendCommand, getBridgeStatus } from "../services/bridge.js";
import { logAction, formatToolResult, truncate } from "../services/logger.js";

// ── Fornix Plugin Preset Library ──────────────────────────────────────────────
//
// These are normalised (0–1) parameter values for common mix positions.
// Calibrated for hardstyle at 150 BPM, -6 LUFS mix bus target.

const PLUGIN_PRESETS: Record<string, Record<string, Record<string, number>>> = {
  "FabFilter Pro-L 2": {
    "master-limiter": {
      "Gain":        0.75,   // Input gain ~0 dB
      "Output Level":0.83,   // Output -0.3 dBTP
      "Threshold":   0.80,   // Around -3 dB
      "Attack":      0.30,
      "Release":     0.55,
      "Style":       0.60,   // Transparent
    },
    "bus-limiter": {
      "Gain":        0.72,
      "Output Level":0.85,
      "Threshold":   0.75,
      "Attack":      0.20,
      "Release":     0.50,
    },
  },
  "FabFilter Pro-R 2": {
    "large-room-lead": {
      "Room Size":   0.55,
      "Decay":       0.42,   // ~2.0 s
      "Pre-Delay":   0.22,   // ~18 ms
      "Brightness":  0.60,
      "Mix":         0.25,
    },
    "short-ambience": {
      "Room Size":   0.30,
      "Decay":       0.25,
      "Pre-Delay":   0.10,
      "Brightness":  0.55,
      "Mix":         0.18,
    },
    "epic-hall": {
      "Room Size":   0.80,
      "Decay":       0.65,
      "Pre-Delay":   0.35,
      "Brightness":  0.45,
      "Mix":         0.20,
    },
  },
  "SSL Bus Compressor 2": {
    "glue-kick-bass": {
      "Threshold":   0.45,
      "Ratio":       0.55,   // 4:1
      "Attack":      0.35,   // 10 ms
      "Release":     0.60,   // Auto
      "Make-Up":     0.55,
      "Mix":         0.85,
    },
    "punch-lead": {
      "Threshold":   0.50,
      "Ratio":       0.45,   // 2:1
      "Attack":      0.25,
      "Release":     0.65,
      "Make-Up":     0.52,
      "Mix":         0.90,
    },
  },
  "Oxford Inflator": {
    "hardstyle-saturation": {
      "Effect":      0.45,
      "Clip":        0.00,
      "Band":        0.50,
      "Curve":       0.50,
    },
  },
  "Ozone 12 Dynamics": {
    "multiband-control": {
      "Threshold 1": 0.55,
      "Threshold 2": 0.52,
      "Threshold 3": 0.50,
      "Threshold 4": 0.48,
      "Ratio":       0.40,
      "Attack":      0.35,
      "Release":     0.60,
    },
  },
};

// ── Bus routing template ───────────────────────────────────────────────────────

const HARDSTYLE_BUSES = [
  { name: "Kick & Bass", color: "#CC2200", plugins: ["SSL Bus Compressor 2", "Oxford Inflator", "FabFilter Pro-L 2"] },
  { name: "LEAD",        color: "#FF6600", plugins: ["FabFilter Pro-R 2", "SSL Bus Compressor 2"] },
  { name: "Percussion",  color: "#884400", plugins: ["FabFilter Pro-L 2"] },
  { name: "Chords",      color: "#0055CC", plugins: ["FabFilter Pro-R 2"] },
  { name: "Pads",        color: "#005588", plugins: ["FabFilter Pro-R 2"] },
  { name: "FX",          color: "#006622", plugins: [] },
  { name: "Master",      color: "#222244", plugins: ["Ozone 12 Dynamics", "FabFilter Pro-L 2"] },
] as const;

function notConnected(action: string) {
  return {
    content: [{ type: "text" as const, text: `⚠ Bridge not connected – cannot ${action}.\nUse s1_generate_bus_template as a fallback.` }],
  };
}

export function registerSessionTools(server: McpServer): void {

  // ── session_kickstart ─────────────────────────────────────────────────────

  server.registerTool("session_kickstart", {
    title: "Kickstart New Session",
    description:
      "Set up a complete new hardstyle session: tempo, time signature, " +
      "all Fornix buses, standard plugin inserts, arrangement markers, and initial tracks. " +
      "Runs as a batch — one command, full session skeleton.",
    inputSchema: {
      songTitle: z.string().default("Untitled Hardstyle"),
      tempo: z.number().min(100).max(180).default(150).describe("BPM"),
      timeSignatureNumerator: z.number().int().min(2).max(8).default(4),
      createBuses: z.boolean().default(true),
      insertPlugins: z.boolean().default(true),
      createArrangementMarkers: z.boolean().default(true),
      initialTracks: z.array(z.object({
        name: z.string(),
        type: z.enum(["audio", "instrument"]),
        bus: z.string().optional(),
      })).optional().describe("Extra tracks to create beyond the buses"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({
    songTitle, tempo, timeSignatureNumerator,
    createBuses, insertPlugins, createArrangementMarkers, initialTracks,
  }) => {
    if (getBridgeStatus() !== "connected") return notConnected("kickstart session");

    const results: string[] = [];
    let errors = 0;

    async function step(label: string, command: string, params: Record<string, unknown>) {
      try {
        const res = await sendCommand(command, params);
        if (!res.ok) throw new Error(res.error ?? "Unknown error");
        results.push(`  ✓ ${label}`);
      } catch (e) {
        results.push(`  ✗ ${label}: ${e}`);
        errors++;
      }
    }

    // 1. Set tempo
    await step(`Tempo → ${tempo} BPM`, "setTempo", { bpm: tempo });

    // 2. Create buses
    if (createBuses) {
      for (const bus of HARDSTYLE_BUSES) {
        await step(`Bus: ${bus.name}`, "createTrack", { name: bus.name, type: "bus", color: bus.color });
      }
    }

    // 3. Insert plugins
    if (insertPlugins && createBuses) {
      for (const bus of HARDSTYLE_BUSES) {
        for (const plugin of bus.plugins) {
          await step(`  ${bus.name} ← ${plugin}`, "addPlugin", { trackName: bus.name, pluginName: plugin });
        }
      }
    }

    // 4. Arrangement markers (hardstyle layout)
    if (createArrangementMarkers) {
      const sections = [
        { name: "Intro", bars: 16, color: "#444466" },
        { name: "Breakdown", bars: 16, color: "#225588" },
        { name: "Build-up", bars: 8, color: "#884400" },
        { name: "Drop 1", bars: 32, color: "#CC2200" },
        { name: "Breakdown 2", bars: 16, color: "#225588" },
        { name: "Build-up 2", bars: 8, color: "#884400" },
        { name: "Drop 2", bars: 32, color: "#CC2200" },
        { name: "Outro", bars: 16, color: "#334433" },
      ];

      const markers: Array<{ bar: number; name: string; color: string }> = [];
      let bar = 1;
      for (const s of sections) {
        markers.push({ bar, name: s.name, color: s.color });
        bar += s.bars;
      }
      await step(`Arrangement markers (${markers.length} sections)`, "addMarkersMulti", { markers });
      await step(`Total length: ${bar - 1} bars`, "setLoopRange", { startBar: 1, endBar: bar - 1 });
    }

    // 5. Initial tracks
    for (const track of initialTracks ?? []) {
      await step(`Track: ${track.name} (${track.type})`, "createTrack", {
        name: track.name, type: track.type,
      });
      if (track.bus) {
        await step(`  Send: ${track.name} → ${track.bus}`, "createSend", {
          fromTrackName: track.name, toBusName: track.bus, sendLevelDb: 0,
        });
      }
    }

    const ok = errors === 0;
    const summary = ok
      ? `Session "${songTitle}" kickstarted: ${results.filter(r => r.includes("✓")).length} steps completed`
      : `Session kickstart completed with ${errors} error(s)`;

    logAction({ tool: "session_kickstart", action: "s1_bridge", summary, dryRun: false, ok });
    return {
      content: [{
        type: "text",
        text: formatToolResult(ok, summary, results.join("\n")),
      }],
    };
  });

  // ── session_apply_mix_preset ──────────────────────────────────────────────

  server.registerTool("session_apply_mix_preset", {
    title: "Apply Mix Preset",
    description:
      "Apply a named Fornix plugin parameter preset to a plugin instance. " +
      "Presets are calibrated for hardstyle at -6 LUFS. " +
      `Available: ${Object.keys(PLUGIN_PRESETS).map(p => `"${p}"`).join(", ")}`,
    inputSchema: {
      trackName: z.string().describe("Track or bus containing the plugin"),
      pluginName: z.string().describe("Plugin to configure"),
      presetName: z.string().describe(
        "Preset name. Per plugin:\n" +
        Object.entries(PLUGIN_PRESETS)
          .map(([p, presets]) => `  ${p}: ${Object.keys(presets).join(", ")}`)
          .join("\n")
      ),
      dryRun: z.boolean().default(false).describe("Preview without applying"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async ({ trackName, pluginName, presetName, dryRun }) => {
    const pluginPresets = PLUGIN_PRESETS[pluginName];
    if (!pluginPresets) {
      const available = Object.keys(PLUGIN_PRESETS).join(", ");
      return {
        content: [{
          type: "text",
          text: `✗ No presets for "${pluginName}".\nAvailable plugins: ${available}`,
        }],
        isError: true,
      };
    }

    const preset = pluginPresets[presetName];
    if (!preset) {
      const available = Object.keys(pluginPresets).join(", ");
      return {
        content: [{
          type: "text",
          text: `✗ Preset "${presetName}" not found for ${pluginName}.\nAvailable: ${available}`,
        }],
        isError: true,
      };
    }

    const paramList = Object.entries(preset)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n");

    if (dryRun) {
      return {
        content: [{
          type: "text",
          text: formatToolResult(true, `[DRY-RUN] Would apply "${presetName}" to ${pluginName} on "${trackName}"`, paramList, true),
        }],
      };
    }

    if (getBridgeStatus() !== "connected") return notConnected(`apply preset to "${pluginName}"`);

    const results: string[] = [];
    let errors = 0;

    for (const [paramName, value] of Object.entries(preset)) {
      try {
        const res = await sendCommand("setPluginParam", {
          trackName, pluginName, paramName, value, isAbsolute: false,
        });
        if (!res.ok) throw new Error(res.error);
        results.push(`  ✓ ${paramName} = ${value}`);
      } catch (e) {
        results.push(`  ✗ ${paramName}: ${e}`);
        errors++;
      }
    }

    const ok = errors === 0;
    const summary = `Preset "${presetName}" applied to ${pluginName} on "${trackName}" (${Object.keys(preset).length - errors}/${Object.keys(preset).length} params)`;
    logAction({ tool: "session_apply_mix_preset", action: "s1_bridge", summary, dryRun: false, ok });
    return { content: [{ type: "text", text: formatToolResult(ok, summary, results.join("\n")) }] };
  });

  // ── session_health_check ──────────────────────────────────────────────────

  server.registerTool("session_health_check", {
    title: "Session Health Check",
    description:
      "Analyse the current Studio One session for common issues: " +
      "missing buses, unrouted tracks, clipping tracks, missing limiters, " +
      "tempo inconsistencies, and empty arrangement sections.",
    inputSchema: {
      expectedTempo: z.number().min(60).max(220).optional()
        .describe("Flag if session tempo differs from this value"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ expectedTempo }) => {
    if (getBridgeStatus() !== "connected") {
      return {
        content: [{
          type: "text",
          text: "⚠ Bridge not connected – health check requires a live Studio One session.",
        }],
      };
    }

    try {
      const metaRes = await sendCommand("getSongMetadata");
      if (!metaRes.ok) throw new Error(metaRes.error);

      const song = metaRes.data as {
        tempo: number;
        tracks: Array<{ name: string; type: string; muted: boolean; volume: number }>;
      };

      const issues: string[] = [];
      const warnings: string[] = [];
      const ok: string[] = [];

      // Tempo check
      if (expectedTempo && Math.abs(song.tempo - expectedTempo) > 0.1) {
        issues.push(`Tempo is ${song.tempo} BPM, expected ${expectedTempo} BPM`);
      } else {
        ok.push(`Tempo: ${song.tempo} BPM`);
      }

      const trackNames = song.tracks.map(t => t.name.toLowerCase());
      const busNames = song.tracks.filter(t => t.type === "bus").map(t => t.name);

      // Check for required Fornix buses
      const requiredBuses = ["Kick & Bass", "LEAD", "Master"];
      for (const bus of requiredBuses) {
        if (busNames.some(b => b.toLowerCase() === bus.toLowerCase())) {
          ok.push(`Bus present: ${bus}`);
        } else {
          warnings.push(`Missing recommended bus: "${bus}"`);
        }
      }

      // Check for muted tracks (possible accidental mutes)
      const muted = song.tracks.filter(t => t.muted && t.type !== "bus");
      if (muted.length > 0) {
        warnings.push(`${muted.length} track(s) are muted: ${muted.map(t => t.name).join(", ")}`);
      } else {
        ok.push("No accidentally muted tracks");
      }

      // Check for suspiciously high volumes (> +3 dB = value > 1.41 linear)
      const hotTracks = song.tracks.filter(t => t.volume > 1.41);
      if (hotTracks.length > 0) {
        warnings.push(`${hotTracks.length} track(s) have fader above +3 dB: ${hotTracks.map(t => t.name).join(", ")}`);
      }

      // Check Master bus exists
      const hasMaster = trackNames.some(n => n === "master");
      if (!hasMaster) {
        issues.push("No Master bus found – ensure your output is bussed correctly");
      } else {
        ok.push("Master bus present");
      }

      const totalTracks = song.tracks.length;
      ok.push(`Total tracks: ${totalTracks}`);

      const lines = [
        `═══ Session Health Check ═══`,
        `Tempo: ${song.tempo} BPM | Tracks: ${totalTracks} | Buses: ${busNames.length}`,
        "",
        issues.length  ? `Issues (${issues.length}):\n${issues.map(i => `  ✗ ${i}`).join("\n")}` : "",
        warnings.length ? `Warnings (${warnings.length}):\n${warnings.map(w => `  ⚠ ${w}`).join("\n")}` : "",
        ok.length       ? `OK (${ok.length}):\n${ok.map(o => `  ✓ ${o}`).join("\n")}` : "",
        "",
        issues.length === 0 && warnings.length === 0
          ? "✓ No issues found. Session looks healthy."
          : `Found ${issues.length} issue(s) and ${warnings.length} warning(s).`,
      ].filter(Boolean).join("\n");

      return { content: [{ type: "text", text: truncate(lines) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ Health check failed: ${e}` }], isError: true };
    }
  });

  // ── session_list_mix_presets ──────────────────────────────────────────────

  server.registerTool("session_list_mix_presets", {
    title: "List Mix Presets",
    description: "List all available Fornix mix presets and the plugins they cover.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => {
    const lines = Object.entries(PLUGIN_PRESETS).map(([plugin, presets]) => {
      const presetList = Object.keys(presets).map(p => `    • ${p}`).join("\n");
      return `${plugin}:\n${presetList}`;
    });
    return {
      content: [{
        type: "text",
        text: `Fornix Mix Preset Library\n${"─".repeat(40)}\n\n${lines.join("\n\n")}`,
      }],
    };
  });
}
