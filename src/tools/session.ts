// ─── Fornix Studio MCP – Session Tools ───────────────────────────────────────
//
// High-level session management:
//   session_kickstart       - set up a full hardstyle session from scratch
//   session_apply_mix_preset - apply Fornix plugin settings across the mix
//   session_health_check    - analyse the current project for issues

import fs from "fs";
import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendCommand, isBridgeReady } from "../services/bridge.js";
import { logAction, formatToolResult, truncate } from "../services/logger.js";
import { guardPath, isReadOnly } from "../services/workspace.js";
import { tryParseSongFile } from "../services/song-file.js";
import { buildArrangementSummary, analyzeArrangement } from "../services/arrangement.js";

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

// ── Session marker builder ──────────────────────────────────────────────────

function buildSessionMarkers(_tempo: number) {
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

  let bar = 1;
  return sections.map(s => {
    const marker = { bar, name: s.name, bars: s.bars, color: s.color };
    bar += s.bars;
    return marker;
  });
}

// ── Session markdown builder ────────────────────────────────────────────────

function buildSessionMarkdown(
  songTitle: string,
  tempo: number,
  timeSigNum: number,
  tracks: Array<{ name: string; type: string; color?: string; bus?: string; plugins: string[] }>,
  markers: Array<{ bar: number; name: string; bars: number; color: string }>,
): string {
  const lines = [
    `# Session Plan – ${songTitle}`,
    "",
    `**Tempo:** ${tempo} BPM  `,
    `**Time Signature:** ${timeSigNum}/4  `,
    `**Generated:** ${new Date().toLocaleString()}`,
    "",
  ];

  if (markers.length > 0) {
    lines.push("## Arrangement", "");
    lines.push("| Section | Start Bar | Length | Color |");
    lines.push("|---------|-----------|--------|-------|");
    for (const m of markers) {
      lines.push(`| ${m.name} | Bar ${m.bar} | ${m.bars} bars | ${m.color} |`);
    }
    const totalBars = markers[markers.length - 1].bar + markers[markers.length - 1].bars - 1;
    lines.push("", `**Total Length:** ${totalBars} bars (${(totalBars * 4 * 60 / tempo / 60).toFixed(1)} min)`);
    lines.push("");
  }

  const buses = tracks.filter(t => t.type === "bus");
  const other = tracks.filter(t => t.type !== "bus");

  if (buses.length > 0) {
    lines.push("## Buses", "");
    for (const bus of buses) {
      lines.push(`### ${bus.name}`);
      if (bus.color) lines.push(`- **Color:** ${bus.color}`);
      if (bus.plugins.length > 0) {
        lines.push(`- **Plugins:** ${bus.plugins.join(" → ")}`);
      }
      lines.push("");
    }
  }

  if (other.length > 0) {
    lines.push("## Tracks", "");
    for (const track of other) {
      lines.push(`### ${track.name}`);
      lines.push(`- **Type:** ${track.type}`);
      if (track.bus) lines.push(`- **Routed to:** ${track.bus}`);
      lines.push("");
    }
  }

  lines.push(
    "## Setup Instructions",
    "",
    "1. Create a new song in Studio One",
    `2. Set tempo to **${tempo} BPM**`,
    "3. Create each bus listed above (right-click in mixer → Add Bus Channel)",
    "4. Add the listed plugins to each bus in order",
    "5. Create the tracks and route them to their assigned buses",
    "6. Add arrangement markers at the bar positions listed above",
    "",
  );

  return lines.join("\n");
}

export function registerSessionTools(server: McpServer): void {

  // ── session_kickstart ─────────────────────────────────────────────────────

  server.registerTool("session_kickstart", {
    title: "Kickstart New Session",
    description:
      "Set up a hardstyle session skeleton: tempo, Fornix buses, plugin inserts, " +
      "arrangement markers, and initial tracks. " +
      "Works in two modes: (1) live bridge — sends commands to Studio One directly, " +
      "(2) file-based — writes a complete session plan + instruction set to outputDir for manual import. " +
      "File-based mode activates automatically when the bridge is not connected.",
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
      outputDir: z.string().optional().describe("Output directory for file-based mode (required when bridge is down, defaults to working directory)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({
    songTitle, tempo, timeSignatureNumerator,
    createBuses, insertPlugins, createArrangementMarkers, initialTracks,
    outputDir,
  }) => {
    // ── Live bridge mode ──────────────────────────────────────────────────
    if (isBridgeReady()) {
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

      await step(`Tempo → ${tempo} BPM`, "setTempo", { bpm: tempo });
      if (timeSignatureNumerator !== 4) {
        results.push(`  ⚠ Time signature ${timeSignatureNumerator}/4 noted — no verified bridge command.`);
      }

      if (createBuses) {
        for (const bus of HARDSTYLE_BUSES) {
          await step(`Bus: ${bus.name}`, "createTrack", { name: bus.name, type: "bus", color: bus.color });
        }
      }

      if (insertPlugins && createBuses) {
        for (const bus of HARDSTYLE_BUSES) {
          for (const plugin of bus.plugins) {
            await step(`  ${bus.name} ← ${plugin}`, "addPlugin", { trackName: bus.name, pluginName: plugin });
          }
        }
      }

      if (createArrangementMarkers) {
        const markers = buildSessionMarkers(tempo);
        await step(`Arrangement markers (${markers.length} sections)`, "addMarkersMulti", { markers: markers.map(m => ({ bar: m.bar, name: m.name, color: m.color })) });
        const totalBars = markers[markers.length - 1].bar + markers[markers.length - 1].bars - 1;
        await step(`Total length: ${totalBars} bars`, "setLoopRange", { startBar: 1, endBar: totalBars });
      }

      for (const track of initialTracks ?? []) {
        await step(`Track: ${track.name} (${track.type})`, "createTrack", { name: track.name, type: track.type });
        if (track.bus) {
          await step(`  Send: ${track.name} → ${track.bus}`, "createSend", { fromTrackName: track.name, toBusName: track.bus, sendLevelDb: 0 });
        }
      }

      const ok = errors === 0;
      const summary = ok
        ? `Session "${songTitle}" kickstarted (live): ${results.filter(r => r.includes("✓")).length} steps completed`
        : `Session kickstart completed with ${errors} error(s)`;
      logAction({ tool: "session_kickstart", action: "s1_bridge", summary, dryRun: false, ok });
      return { content: [{ type: "text", text: formatToolResult(ok, summary, results.join("\n")) }] };
    }

    // ── File-based fallback mode ──────────────────────────────────────────
    try {
      if (!outputDir) {
        return {
          content: [{ type: "text", text:
            "⚠ Bridge not connected — file-based mode requires outputDir.\n" +
            "Provide an outputDir (your Studio One project folder or Fornix output directory) and I'll generate the full session plan there." }],
          isError: true,
        };
      }

      const abs = guardPath(outputDir);
      if (isReadOnly(abs)) throw new Error(`${abs} is in a read-only directory`);
      fs.mkdirSync(abs, { recursive: true });

      const sessionDir = path.join(abs, "Fornix", "session-kickstart");
      fs.mkdirSync(sessionDir, { recursive: true });

      // Build all instruction data
      const allInstructions: Array<{ command: string; params: Record<string, unknown> }> = [];
      const allTracks: Array<{ name: string; type: string; color?: string; bus?: string; plugins: string[]; notes?: string }> = [];

      allInstructions.push({ command: "setTempo", params: { bpm: tempo } });

      if (createBuses) {
        for (const bus of HARDSTYLE_BUSES) {
          allInstructions.push({ command: "createTrack", params: { name: bus.name, type: "bus", color: bus.color } });
          allTracks.push({ name: bus.name, type: "bus", color: bus.color, plugins: [...bus.plugins] });
          if (insertPlugins) {
            for (const plugin of bus.plugins) {
              allInstructions.push({ command: "addPlugin", params: { trackName: bus.name, pluginName: plugin } });
            }
          }
        }
      }

      if (createArrangementMarkers) {
        const markers = buildSessionMarkers(tempo);
        allInstructions.push({ command: "addMarkersMulti", params: { markers: markers.map(m => ({ bar: m.bar, name: m.name, color: m.color })) } });
        const totalBars = markers[markers.length - 1].bar + markers[markers.length - 1].bars - 1;
        allInstructions.push({ command: "setLoopRange", params: { startBar: 1, endBar: totalBars } });
      }

      for (const track of initialTracks ?? []) {
        allInstructions.push({ command: "createTrack", params: { name: track.name, type: track.type } });
        allTracks.push({ name: track.name, type: track.type, bus: track.bus, plugins: [] });
        if (track.bus) {
          allInstructions.push({ command: "createSend", params: { fromTrackName: track.name, toBusName: track.bus, sendLevelDb: 0 } });
        }
      }

      // Write instruction JSON
      const instructionPath = path.join(sessionDir, "s1-instructions.json");
      fs.writeFileSync(instructionPath, JSON.stringify({
        version: 1,
        createdAt: new Date().toISOString(),
        label: "session-kickstart",
        songTitle,
        tempo,
        instructions: allInstructions,
      }, null, 2), "utf8");

      // Write track plan JSON
      const trackPlanPath = path.join(sessionDir, "track-plan.json");
      fs.writeFileSync(trackPlanPath, JSON.stringify({
        version: 1,
        songTitle,
        tempo,
        createdAt: new Date().toISOString(),
        tracks: allTracks,
      }, null, 2), "utf8");

      // Write human-readable session plan (Markdown)
      const markers = createArrangementMarkers ? buildSessionMarkers(tempo) : [];
      const md = buildSessionMarkdown(songTitle, tempo, timeSignatureNumerator, allTracks, markers);
      const mdPath = path.join(sessionDir, "session-plan.md");
      fs.writeFileSync(mdPath, md, "utf8");

      const fileList = [instructionPath, trackPlanPath, mdPath].map(f => path.basename(f)).join(", ");
      const summary = `Session "${songTitle}" plan written (file-based): ${allInstructions.length} instructions, ${allTracks.length} tracks`;
      logAction({ tool: "session_kickstart", action: "write", target: sessionDir, summary, dryRun: false, ok: true });

      return {
        content: [{ type: "text", text: formatToolResult(true, summary,
          `Mode: file-based (bridge not connected)\n` +
          `Output: ${sessionDir}\n` +
          `Files: ${fileList}\n\n` +
          `Next steps:\n` +
          `  1. Open Studio One and create a new song at ${tempo} BPM\n` +
          `  2. Follow session-plan.md to set up buses, plugins, and tracks\n` +
          `  3. The instruction JSON can be imported if the bridge becomes available\n` +
          `  4. Use fornix_generate_production_package to create detailed production docs`) }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
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

    if (dryRun || !isBridgeReady()) {
      const modeNote = !isBridgeReady() && !dryRun
        ? "\n\nBridge not connected — showing preset values for manual application in Studio One.\n" +
          "Open the plugin UI and set these parameters manually, or re-run with the bridge active."
        : "";
      return {
        content: [{
          type: "text",
          text: formatToolResult(true,
            `${dryRun ? "[DRY-RUN] " : ""}Preset "${presetName}" for ${pluginName} on "${trackName}"`,
            paramList + modeNote,
            dryRun),
        }],
      };
    }

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
      "Analyse a Studio One session for common issues: " +
      "tempo mismatch, missing recommended buses, track counts, arrangement problems. " +
      "Works in two modes: (1) live bridge — queries Studio One directly, " +
      "(2) file-based — reads a .song file from disk. " +
      "Provide songFilePath for file-based mode.",
    inputSchema: {
      expectedTempo: z.number().min(60).max(220).optional()
        .describe("Flag if session tempo differs from this value"),
      songFilePath: z.string().optional()
        .describe("Path to a .song file for offline analysis (file-based mode)"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ expectedTempo, songFilePath }) => {

    // ── Gather session data from either source ───────────────────────────
    let songTempo: number | null = null;
    let tracks: Array<{ name: string; type: string; muted?: boolean; volume?: number }> = [];
    let mode: string;
    let arrangementNote = "";

    if (isBridgeReady()) {
      mode = "live";
      try {
        const metaRes = await sendCommand("getSongMetadata");
        if (!metaRes.ok) throw new Error(metaRes.error);
        const song = metaRes.data as {
          tempo: number;
          tracks: Array<{ name: string; type: string; muted: boolean; volume: number }>;
        };
        songTempo = song.tempo;
        tracks = song.tracks;
      } catch (e) {
        return { content: [{ type: "text", text: `✗ Health check failed (live): ${e}` }], isError: true };
      }
    } else if (songFilePath) {
      mode = "file";
      try {
        const abs = guardPath(songFilePath);
        const parsed = tryParseSongFile(abs);

        if (parsed.format === "unknown") {
          return {
            content: [{ type: "text", text:
              `⚠ Could not parse ${path.basename(songFilePath)} (format: ${parsed.format}).\n` +
              `Studio One .song files are typically ZIP archives. ` +
              `If parsing failed, the file may be open in Studio One — try closing it first, or provide the path to a backup copy.` }],
            isError: true,
          };
        }

        songTempo = parsed.tempo;
        tracks = parsed.tracks.map(t => ({ name: t.name, type: t.type ?? "audio" }));

        // Run arrangement analysis if we got markers
        if (parsed.markers.length >= 2) {
          const summary = buildArrangementSummary(parsed);
          const analysis = analyzeArrangement(summary, {
            genre: "hardstyle",
            targetLengthMinutes: 5.5,
            ...(expectedTempo ? {} : {}),
          });
          if (analysis.problems.length > 0) {
            arrangementNote = "\n\nArrangement:\n" +
              analysis.problems.slice(0, 5).map(p => `  ⚠ [${p.section}] ${p.problem}`).join("\n") +
              (analysis.problems.length > 5 ? `\n  ... and ${analysis.problems.length - 5} more (use fornix_analyze_arrangement for full report)` : "");
          } else {
            arrangementNote = "\n\nArrangement:\n  ✓ Structure looks solid — " + analysis.energyArc.verdict + " energy arc";
          }
        }
      } catch (e) {
        return { content: [{ type: "text", text: `✗ Health check failed (file): ${e}` }], isError: true };
      }
    } else {
      return {
        content: [{ type: "text", text:
          "⚠ Bridge not connected and no songFilePath provided.\n\n" +
          "Two ways to run a health check:\n" +
          "  1. Provide songFilePath — path to your .song file for offline analysis\n" +
          "  2. Enable the bridge — for live Studio One queries (not available on S1 7)\n\n" +
          "Your .song files are typically in:\n" +
          "  C:\\Users\\<you>\\Documents\\Studio One\\Songs\\<song-name>\\<song-name>.song" }],
        isError: true,
      };
    }

    // ── Run health checks ───────────────────────────────────────────────
    const issues: string[] = [];
    const warnings: string[] = [];
    const okChecks: string[] = [];

    // Tempo check
    if (songTempo !== null) {
      if (expectedTempo && Math.abs(songTempo - expectedTempo) > 0.1) {
        issues.push(`Tempo is ${songTempo} BPM, expected ${expectedTempo} BPM`);
      } else {
        okChecks.push(`Tempo: ${songTempo} BPM`);
      }
    } else {
      warnings.push("Could not determine tempo from song file");
    }

    const trackNames = tracks.map(t => t.name.toLowerCase());
    // S1 uses FolderTracks as bus groups — treat both "bus" and "folder" as buses
    const busNames = tracks
      .filter(t => t.type === "bus" || t.type === "folder")
      .map(t => t.name);

    // Check for required Fornix buses (fuzzy: "Kick/Bass" matches "Kick & Bass", etc.)
    const busChecks: Array<{ label: string; match: (n: string) => boolean }> = [
      { label: "Kick & Bass", match: n => /kick.*bass|bass.*kick/i.test(n) },
      { label: "LEAD",        match: n => /\blead/i.test(n) },
    ];
    for (const check of busChecks) {
      if (busNames.some(b => check.match(b))) {
        okChecks.push(`Bus/group present: ${check.label}`);
      } else {
        warnings.push(`Missing recommended bus/group: "${check.label}"`);
      }
    }

    // Check for muted tracks (live mode only — .song files don't expose mute state reliably)
    if (mode === "live") {
      const muted = tracks.filter(t => (t as { muted?: boolean }).muted && t.type !== "bus");
      if (muted.length > 0) {
        warnings.push(`${muted.length} track(s) are muted: ${muted.map(t => t.name).join(", ")}`);
      } else {
        okChecks.push("No accidentally muted tracks");
      }

      const hotTracks = tracks.filter(t => ((t as { volume?: number }).volume ?? 0) > 1.41);
      if (hotTracks.length > 0) {
        warnings.push(`${hotTracks.length} track(s) have fader above +3 dB: ${hotTracks.map(t => t.name).join(", ")}`);
      }
    }

    // Check Master bus/output exists
    // S1 uses "Main" as the output channel label, not "Master"
    const hasMaster = trackNames.some(n => n === "master" || n === "main")
      || busNames.some(n => /master|main/i.test(n));
    if (!hasMaster) {
      // Not an issue for S1 — the Main output always exists but isn't in the track list
      // Only warn if there are no buses at all (indicates an empty or unusual project)
      if (busNames.length === 0) {
        warnings.push("No bus/group channels found — consider organizing tracks into groups");
      }
    } else {
      okChecks.push("Master/Main output present");
    }

    const totalTracks = tracks.length;
    okChecks.push(`Total tracks: ${totalTracks}`);

    const modeLabel = mode === "live" ? "Live Bridge" : "File-Based (.song)";
    const lines = [
      `═══ Session Health Check (${modeLabel}) ═══`,
      `Tempo: ${songTempo ?? "?"} BPM | Tracks: ${totalTracks} | Buses: ${busNames.length}`,
      "",
      issues.length  ? `Issues (${issues.length}):\n${issues.map(i => `  ✗ ${i}`).join("\n")}` : "",
      warnings.length ? `Warnings (${warnings.length}):\n${warnings.map(w => `  ⚠ ${w}`).join("\n")}` : "",
      okChecks.length ? `OK (${okChecks.length}):\n${okChecks.map(o => `  ✓ ${o}`).join("\n")}` : "",
      arrangementNote,
      "",
      issues.length === 0 && warnings.length === 0
        ? "✓ No issues found. Session looks healthy."
        : `Found ${issues.length} issue(s) and ${warnings.length} warning(s).`,
    ].filter(Boolean).join("\n");

    return { content: [{ type: "text", text: truncate(lines) }] };
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
