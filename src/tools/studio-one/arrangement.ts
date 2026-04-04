// ─── Fornix Studio MCP – Studio One: Arrangement + Marker Tools ──────────────
//
// Markers, sections, and arrangement structure.
// Hardstyle-specific helpers included for standard song sections.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { sendCommand, isBridgeReady } from "../../services/bridge.js";
import { logAction, formatToolResult } from "../../services/logger.js";
import { guardPath } from "../../services/workspace.js";
import { requireBridgeRead, requireBridgeWrite } from "./bridge-guard.js";

// Standard hardstyle/trance arrangement sections
const HARDSTYLE_SECTIONS = [
  { name: "Intro",         defaultLength: 16 },
  { name: "Breakdown",     defaultLength: 16 },
  { name: "Build-up",      defaultLength: 8  },
  { name: "Drop 1",        defaultLength: 32 },
  { name: "Breakdown 2",   defaultLength: 16 },
  { name: "Build-up 2",    defaultLength: 8  },
  { name: "Drop 2",        defaultLength: 32 },
  { name: "Outro",         defaultLength: 16 },
] as const;

export function registerArrangementTools(server: McpServer): void {

  // ── s1_add_marker ─────────────────────────────────────────────────────────

  server.registerTool("s1_add_marker", {
    title: "Add Marker",
    description: "Add a named marker at a specific bar in the Studio One timeline.",
    inputSchema: {
      bar: z.number().int().min(1).describe("Bar position (1-based)"),
      name: z.string().min(1).max(64).describe("Marker label"),
      color: z.string().optional().describe("Hex colour e.g. #FF6600"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ bar, name, color }) => {
    const blocked = requireBridgeWrite(`add marker "${name}"`);
    if (blocked) return { content: [{ type: "text", text: blocked }] };
    try {
      const res = await sendCommand("addMarker", { bar, name, color });
      if (!res.ok) throw new Error(res.error);
      const summary = `Marker "${name}" added at bar ${bar}`;
      logAction({ tool: "s1_add_marker", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_get_markers ────────────────────────────────────────────────────────

  server.registerTool("s1_get_markers", {
    title: "Get All Markers",
    description: "List all markers in the current Studio One song.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => {
    const blocked = requireBridgeRead("read markers");
    if (blocked) return { content: [{ type: "text", text: blocked }] };
    try {
      const res = await sendCommand("getMarkers");
      if (!res.ok) throw new Error(res.error);
      return { content: [{ type: "text", text: formatToolResult(true, "Markers", res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_delete_marker ──────────────────────────────────────────────────────

  server.registerTool("s1_delete_marker", {
    title: "Delete Marker",
    description: "Delete a marker by name or bar position.",
    inputSchema: {
      name: z.string().optional().describe("Marker name"),
      bar: z.number().int().min(1).optional().describe("Bar position"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ name, bar }) => {
    if (!name && !bar) {
      return { content: [{ type: "text", text: "✗ Provide name or bar" }], isError: true };
    }
    const blocked = requireBridgeWrite("delete marker");
    if (blocked) return { content: [{ type: "text", text: blocked }] };
    try {
      const res = await sendCommand("deleteMarker", { name, bar });
      if (!res.ok) throw new Error(res.error);
      const summary = `Deleted marker: ${name ?? `bar ${bar}`}`;
      logAction({ tool: "s1_delete_marker", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_build_arrangement ─────────────────────────────────────────────────

  server.registerTool("s1_build_arrangement", {
    title: "Build Arrangement Structure",
    description:
      "Place section markers for a full song arrangement in one call. " +
      "Generates all markers sequentially from bar 1. " +
      "Use the preset 'hardstyle' for a standard Fornix layout, or provide custom sections.",
    inputSchema: {
      preset: z.enum(["hardstyle", "trance", "custom"])
        .default("hardstyle")
        .describe("Arrangement preset to use"),
      customSections: z.array(z.object({
        name: z.string(),
        bars: z.number().int().min(1).max(128),
        color: z.string().optional(),
      })).optional()
        .describe("Required when preset='custom'. Array of sections in order."),
      startBar: z.number().int().min(1).default(1),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ preset, customSections, startBar }) => {
    const tranceSections = [
      { name: "Intro", defaultLength: 16 },
      { name: "Verse 1", defaultLength: 16 },
      { name: "Pre-Chorus", defaultLength: 8 },
      { name: "Chorus 1", defaultLength: 16 },
      { name: "Verse 2", defaultLength: 16 },
      { name: "Chorus 2", defaultLength: 16 },
      { name: "Bridge", defaultLength: 8 },
      { name: "Breakdown", defaultLength: 16 },
      { name: "Climax", defaultLength: 32 },
      { name: "Outro", defaultLength: 16 },
    ];

    let sections: Array<{ name: string; bars: number; color?: string }>;

    if (preset === "hardstyle") {
      sections = HARDSTYLE_SECTIONS.map(s => ({ name: s.name, bars: s.defaultLength }));
    } else if (preset === "trance") {
      sections = tranceSections.map(s => ({ name: s.name, bars: s.defaultLength }));
    } else {
      if (!customSections?.length) {
        return {
          content: [{ type: "text", text: "✗ customSections required when preset='custom'" }],
          isError: true,
        };
      }
      sections = customSections;
    }

    const SECTION_COLORS: Record<string, string> = {
      "Intro": "#444466", "Breakdown": "#225588", "Build-up": "#884400",
      "Drop 1": "#CC2200", "Drop 2": "#CC2200", "Breakdown 2": "#225588",
      "Build-up 2": "#884400", "Outro": "#334433",
      "Verse 1": "#225588", "Verse 2": "#225588", "Pre-Chorus": "#556622",
      "Chorus 1": "#882200", "Chorus 2": "#882200",
      "Bridge": "#664400", "Climax": "#CC0000",
    };

    if (!isBridgeReady()) {
      // Fallback: describe the arrangement as text so the user can apply it manually.
      let bar = startBar;
      const lines = sections.map(s => {
        const line = `Bar ${String(bar).padStart(3, " ")}: ${s.name} (${s.bars} bars)`;
        bar += s.bars;
        return line;
      });
      return {
        content: [{
          type: "text",
          text: `⚠ Bridge not connected – arrangement plan (apply manually):\n\n${lines.join("\n")}\n\nTotal length: ${bar - startBar} bars`,
        }],
      };
    }

    // Bridge is connected; enforce write gate before sending markers.
    const writeBlocked = requireBridgeWrite("build arrangement");
    if (writeBlocked) return { content: [{ type: "text", text: writeBlocked }] };

    try {
      const markerCalls: Array<{ bar: number; name: string; color: string }> = [];
      let currentBar = startBar;

      for (const section of sections) {
        markerCalls.push({
          bar: currentBar,
          name: section.name,
          color: section.color ?? SECTION_COLORS[section.name] ?? "#555555",
        });
        currentBar += section.bars;
      }

      const res = await sendCommand("addMarkersMulti", { markers: markerCalls });
      if (!res.ok) throw new Error(res.error);

      const totalBars = currentBar - startBar;
      const summary = `Arrangement built: ${sections.length} sections, ${totalBars} bars total`;
      logAction({ tool: "s1_build_arrangement", action: "s1_bridge", summary, dryRun: false, ok: true });
      return {
        content: [{
          type: "text",
          text: formatToolResult(true, summary,
            markerCalls.map(m => `  Bar ${String(m.bar).padStart(3, " ")}: ${m.name}`).join("\n")
          ),
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_export_arrangement_plan ────────────────────────────────────────────

  server.registerTool("s1_export_arrangement_plan", {
    title: "Export Arrangement Plan",
    description:
      "Export a full arrangement plan as Markdown – sections, bar ranges, " +
      "track assignments, and notes. For planning before touching the DAW.",
    inputSchema: {
      outputDir: z.string().describe("Directory to write the plan file"),
      title: z.string().default("Untitled").describe("Song/project title"),
      tempo: z.number().min(60).max(220).default(150),
      preset: z.enum(["hardstyle", "trance", "custom"]).default("hardstyle"),
      customSections: z.array(z.object({
        name: z.string(),
        bars: z.number().int().min(1),
        notes: z.string().optional(),
      })).optional(),
      trackAssignments: z.record(z.string())
        .optional()
        .describe("Map of section name → active tracks/buses (e.g. {'Drop 1': 'Kick, Lead, Pads'})"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ outputDir, title, tempo, preset, customSections, trackAssignments }) => {
    try {
      const abs = guardPath(outputDir);
      fs.mkdirSync(abs, { recursive: true });

      let sections =
        preset === "hardstyle" ? HARDSTYLE_SECTIONS.map(s => ({ name: s.name, bars: s.defaultLength, notes: "" })) :
        preset === "custom" ? (customSections ?? []) :
        [
          { name: "Intro", bars: 16 }, { name: "Verse 1", bars: 16 },
          { name: "Chorus 1", bars: 16 }, { name: "Outro", bars: 16 },
        ];

      let bar = 1;
      const sectionTable = sections.map(s => {
        const endBar = bar + s.bars - 1;
        const tracks = trackAssignments?.[s.name] ?? "—";
        const row = `| ${String(bar).padEnd(5)} | ${String(endBar).padEnd(5)} | ${String(s.bars).padEnd(4)} | ${s.name.padEnd(20)} | ${tracks} |`;
        bar += s.bars;
        return { ...s, row, startBar: bar - s.bars, endBar: bar - 1 };
      });

      const md = [
        `# Arrangement Plan – ${title}`,
        `**Tempo:** ${tempo} BPM  |  **Preset:** ${preset}  |  **Generated:** ${new Date().toLocaleString()}`,
        `**Total length:** ${bar - 1} bars`,
        "",
        "## Section Map",
        "",
        "| Start | End   | Bars | Section              | Active Tracks |",
        "|-------|-------|------|----------------------|---------------|",
        ...sectionTable.map(s => s.row),
        "",
        "## Section Notes",
        "",
        ...sectionTable.map(s =>
          `### ${s.name} (bars ${s.startBar}–${s.endBar})\n${s.notes ?? "_No notes_"}\n`
        ),
        "---",
        "_Generated by Fornix Studio MCP_",
      ].join("\n");

      const filename = `arrangement-${title.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.md`;
      const filePath = path.join(abs, filename);
      fs.writeFileSync(filePath, md, "utf8");

      const summary = `Arrangement plan written: ${sections.length} sections, ${bar - 1} bars`;
      logAction({ tool: "s1_export_arrangement_plan", action: "write", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, { filePath }) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });
}
