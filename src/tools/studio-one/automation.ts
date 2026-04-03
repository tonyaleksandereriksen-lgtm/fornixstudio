// ─── Fornix Studio MCP – Studio One: Automation Tools ───────────────────────

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendCommand, getBridgeStatus } from "../../services/bridge.js";
import { logAction, formatToolResult } from "../../services/logger.js";

function notConnected(action: string) {
  return {
    content: [{ type: "text" as const, text: `⚠ Studio One bridge not connected – cannot ${action}.` }],
  };
}

// Common automation targets in a hardstyle mix
const COMMON_TARGETS = [
  "Volume", "Pan", "Mute",
  "FabFilter Pro-L 2/Gain", "FabFilter Pro-L 2/Threshold",
  "FabFilter Pro-R 2/Room Size", "FabFilter Pro-R 2/Decay",
  "FabFilter Pro-Q 3/Band 1 Gain",
  "SSL Bus Compressor 2/Threshold", "SSL Bus Compressor 2/Ratio",
  "Oxford Inflator/Effect",
  "Serum/Filter Cutoff", "Serum/LFO 1 Rate",
  "Sylenth1/Filter 1 Cutoff",
  "Send Level",
] as const;

export function registerAutomationTools(server: McpServer): void {

  // ── s1_add_automation_point ───────────────────────────────────────────────

  server.registerTool("s1_add_automation_point", {
    title: "Add Automation Point",
    description:
      "Add one or more automation points to a track's automation lane. " +
      "Creates the lane if it doesn't exist. " +
      "Value is always normalised 0.0–1.0 unless isAbsolute=true.",
    inputSchema: {
      trackName: z.string().describe("Track or bus name"),
      parameter: z.string().describe(
        `Parameter to automate. Common targets: ${COMMON_TARGETS.slice(0, 6).join(", ")}, etc.`
      ),
      points: z.array(z.object({
        bar: z.number().int().min(1).describe("Bar position"),
        beat: z.number().int().min(1).max(16).default(1),
        value: z.number().describe("Parameter value"),
      })).min(1).max(500).describe("Automation points to add"),
      isAbsolute: z.boolean().default(false)
        .describe("If true, value is in the parameter's own units (dB, Hz, etc.)"),
      curveType: z.enum(["linear", "step", "smooth"]).default("linear"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ trackName, parameter, points, isAbsolute, curveType }) => {
    if (getBridgeStatus() !== "connected") {
      return notConnected(`add automation to "${trackName}/${parameter}"`);
    }
    try {
      const res = await sendCommand("addAutomationPoints", {
        trackName, parameter, points, isAbsolute, curveType,
      });
      if (!res.ok) throw new Error(res.error);
      const summary = `Added ${points.length} automation point(s) on "${trackName}" / ${parameter}`;
      logAction({ tool: "s1_add_automation_point", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_add_automation_ramp ────────────────────────────────────────────────

  server.registerTool("s1_add_automation_ramp", {
    title: "Add Automation Ramp",
    description:
      "Create a linear ramp between two values across a bar range. " +
      "Ideal for filter sweeps, volume rides, reverb builds. " +
      "Generates intermediate points for a smooth curve.",
    inputSchema: {
      trackName: z.string(),
      parameter: z.string(),
      startBar: z.number().int().min(1),
      endBar: z.number().int().min(1),
      startValue: z.number().describe("Value at startBar (0.0–1.0 normalised, or absolute)"),
      endValue: z.number().describe("Value at endBar"),
      steps: z.number().int().min(2).max(64).default(16)
        .describe("Number of interpolation steps (more = smoother)"),
      isAbsolute: z.boolean().default(false),
      curveType: z.enum(["linear", "exponential", "logarithmic"]).default("linear"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ trackName, parameter, startBar, endBar, startValue, endValue, steps, isAbsolute, curveType }) => {
    if (endBar <= startBar) {
      return { content: [{ type: "text", text: "✗ endBar must be > startBar" }], isError: true };
    }
    if (getBridgeStatus() !== "connected") {
      return notConnected(`add automation ramp on "${trackName}/${parameter}"`);
    }
    try {
      // Generate interpolated points
      const points = Array.from({ length: steps }, (_, i) => {
        const t = i / (steps - 1);
        let v: number;
        if (curveType === "exponential") {
          v = startValue + (endValue - startValue) * (t * t);
        } else if (curveType === "logarithmic") {
          v = startValue + (endValue - startValue) * Math.sqrt(t);
        } else {
          v = startValue + (endValue - startValue) * t;
        }
        const bar = Math.round(startBar + (endBar - startBar) * t);
        return { bar, beat: 1, value: v };
      });

      const res = await sendCommand("addAutomationPoints", {
        trackName, parameter, points, isAbsolute, curveType: "linear",
      });
      if (!res.ok) throw new Error(res.error);
      const summary = `Automation ramp on "${trackName}"/${parameter}: ${startValue}→${endValue} bars ${startBar}–${endBar}`;
      logAction({ tool: "s1_add_automation_ramp", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, { steps: points.length }) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_clear_automation ───────────────────────────────────────────────────

  server.registerTool("s1_clear_automation", {
    title: "Clear Automation",
    description: "Delete all automation points from a lane within a bar range.",
    inputSchema: {
      trackName: z.string(),
      parameter: z.string(),
      startBar: z.number().int().min(1),
      endBar: z.number().int().min(1),
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ trackName, parameter, startBar, endBar }) => {
    if (getBridgeStatus() !== "connected") return notConnected("clear automation");
    try {
      const res = await sendCommand("clearAutomation", { trackName, parameter, startBar, endBar });
      if (!res.ok) throw new Error(res.error);
      const summary = `Cleared automation on "${trackName}"/${parameter} bars ${startBar}–${endBar}`;
      logAction({ tool: "s1_clear_automation", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });
}
