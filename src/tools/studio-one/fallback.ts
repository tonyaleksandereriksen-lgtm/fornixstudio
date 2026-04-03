// ─── Fornix Studio MCP – Studio One: File-Based Fallback ─────────────────────
//
// When the Studio One bridge is not available, these tools produce structured
// instruction files that can be loaded/reviewed manually, or imported by the
// Studio One Extension the next time S1 is open.
//
// Category B (Indirect / Bridge-layer):
//   s1_export_instruction, s1_generate_track_plan, s1_generate_bus_template

import fs from "fs";
import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logAction, formatToolResult } from "../../services/logger.js";
import { guardPath } from "../../services/workspace.js";

export function registerFallbackTools(server: McpServer): void {

  // ── s1_export_instruction ─────────────────────────────────────────────────

  server.registerTool("s1_export_instruction", {
    title: "Export S1 Instruction File",
    description:
      "Write a structured JSON instruction file that the Studio One Extension will execute on next load. " +
      "Use when bridge is unavailable. Extension polls for this file at startup.",
    inputSchema: {
      outputDir: z.string().describe("Directory to write the instruction file"),
      instructions: z.array(z.object({
        command: z.string().describe("S1 bridge command name (e.g. createTrack, setTempo)"),
        params: z.record(z.unknown()).describe("Command parameters"),
      })).min(1).max(50),
      label: z.string().default("pending").describe("Label for the instruction batch"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ outputDir, instructions, label }) => {
    try {
      const abs = guardPath(outputDir);
      fs.mkdirSync(abs, { recursive: true });

      const filename = `s1-instructions-${label}-${Date.now()}.json`;
      const filePath = path.join(abs, filename);

      const payload = {
        version: 1,
        createdAt: new Date().toISOString(),
        label,
        instructions,
      };

      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");

      const summary = `Wrote ${instructions.length} instructions to ${filename}`;
      logAction({ tool: "s1_export_instruction", action: "write", target: filePath, summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, { filePath, count: instructions.length }) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_generate_track_plan ────────────────────────────────────────────────

  server.registerTool("s1_generate_track_plan", {
    title: "Generate Track Plan",
    description:
      "Generate a human-readable and machine-readable track setup plan for a Hardstyle/trance project. " +
      "Export as Markdown + JSON for manual review or bridge import.",
    inputSchema: {
      outputDir: z.string().describe("Directory to write plan files"),
      songTitle: z.string().default("Untitled").describe("Song working title"),
      tempo: z.number().min(60).max(200).default(150).describe("Song BPM"),
      tracks: z.array(z.object({
        name: z.string(),
        type: z.enum(["audio", "instrument", "bus", "fx", "folder"]),
        color: z.string().optional(),
        bus: z.string().optional().describe("Parent bus name"),
        plugins: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })).min(1),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ outputDir, songTitle, tempo, tracks }) => {
    try {
      const abs = guardPath(outputDir);
      fs.mkdirSync(abs, { recursive: true });

      const ts = Date.now();
      const jsonPath = path.join(abs, `track-plan-${ts}.json`);
      const mdPath = path.join(abs, `track-plan-${ts}.md`);

      const plan = { version: 1, songTitle, tempo, createdAt: new Date().toISOString(), tracks };
      fs.writeFileSync(jsonPath, JSON.stringify(plan, null, 2), "utf8");

      const mdLines = [
        `# Track Plan – ${songTitle}`,
        `**Tempo:** ${tempo} BPM  `,
        `**Generated:** ${new Date().toLocaleString()}`,
        "",
        "## Tracks",
        "",
        ...tracks.map(t => [
          `### ${t.name}`,
          `- **Type:** ${t.type}`,
          t.color ? `- **Colour:** ${t.color}` : "",
          t.bus ? `- **Bus:** ${t.bus}` : "",
          t.plugins?.length ? `- **Plugins:** ${t.plugins.join(", ")}` : "",
          t.notes ? `- **Notes:** ${t.notes}` : "",
          "",
        ].filter(Boolean).join("\n")),
      ].join("\n");

      fs.writeFileSync(mdPath, mdLines, "utf8");

      const summary = `Track plan written: ${tracks.length} tracks for "${songTitle}"`;
      logAction({ tool: "s1_generate_track_plan", action: "write", summary, dryRun: false, ok: true });
      return {
        content: [{
          type: "text",
          text: formatToolResult(true, summary, { jsonPath, mdPath, trackCount: tracks.length }),
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_generate_bus_template ──────────────────────────────────────────────

  server.registerTool("s1_generate_bus_template", {
    title: "Generate Fornix Bus Template",
    description:
      "Generate the standard Fornix hardstyle bus routing template as a JSON instruction set " +
      "that can be applied via the bridge or loaded manually.",
    inputSchema: {
      outputDir: z.string().describe("Output directory"),
      includePlugins: z.boolean().default(true).describe("Include standard Fornix plugin assignments"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ outputDir, includePlugins }) => {
    try {
      const abs = guardPath(outputDir);
      fs.mkdirSync(abs, { recursive: true });

      const buses = [
        { name: "LEAD", color: "#FF6600", plugins: includePlugins ? ["FabFilter Pro-R 2", "Valhalla Shimmer"] : [] },
        { name: "Kick & Bass", color: "#CC0000", plugins: includePlugins ? ["SSL Bus Compressor 2", "Oxford Inflator"] : [] },
        { name: "Percussion", color: "#884400", plugins: includePlugins ? ["FabFilter Pro-L 2"] : [] },
        { name: "Chords", color: "#0055CC", plugins: includePlugins ? ["FabFilter Pro-R 2"] : [] },
        { name: "Pads", color: "#005588", plugins: includePlugins ? ["Valhalla Reverb"] : [] },
        { name: "FX", color: "#006622", plugins: [] },
        { name: "Master", color: "#222222", plugins: includePlugins ? ["Ozone 12 Dynamics", "FabFilter Pro-L 2"] : [] },
      ];

      const instructions = buses.flatMap(bus => [
        { command: "createTrack", params: { name: bus.name, type: "bus", color: bus.color } },
        ...bus.plugins.map(p => ({
          command: "addPlugin",
          params: { trackName: bus.name, pluginName: p },
        })),
      ]);

      const filename = `fornix-bus-template-${Date.now()}.json`;
      const filePath = path.join(abs, filename);
      fs.writeFileSync(filePath, JSON.stringify({ version: 1, label: "fornix-bus-template", instructions }, null, 2));

      const summary = `Fornix bus template written: ${buses.length} buses, ${instructions.length} instructions`;
      logAction({ tool: "s1_generate_bus_template", action: "write", target: filePath, summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, { filePath }) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });
}
