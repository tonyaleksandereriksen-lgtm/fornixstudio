// ─── Fornix Studio MCP – Studio One: Plugin Tools ────────────────────────────

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendCommand, getBridgeStatus } from "../../services/bridge.js";
import { logAction, formatToolResult } from "../../services/logger.js";

function notConnected(action: string) {
  return {
    content: [{
      type: "text" as const,
      text: `⚠ Studio One bridge not connected – cannot ${action}.\nUse s1_export_instruction as a fallback.`,
    }],
  };
}

export function registerPluginTools(server: McpServer): void {

  // ── s1_add_plugin ─────────────────────────────────────────────────────────

  server.registerTool("s1_add_plugin", {
    title: "Add Plugin to Track",
    description: "Insert a VST/AU plugin on a track's insert chain. Plugin must be installed in Studio One.",
    inputSchema: {
      trackName: z.string().describe("Track or bus name"),
      pluginName: z.string().describe("Exact plugin name as shown in Studio One browser (e.g. 'FabFilter Pro-L 2')"),
      insertPosition: z.number().int().min(0).optional().describe("Insert slot (0 = first). Omit to append."),
      preset: z.string().optional().describe("Preset name to load after inserting"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ trackName, pluginName, insertPosition, preset }) => {
    if (getBridgeStatus() !== "connected") return notConnected(`add "${pluginName}" to "${trackName}"`);
    try {
      const res = await sendCommand("addPlugin", { trackName, pluginName, insertPosition, preset });
      if (!res.ok) throw new Error(res.error);
      const summary = `Added "${pluginName}" to "${trackName}"${preset ? ` (preset: ${preset})` : ""}`;
      logAction({ tool: "s1_add_plugin", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_set_plugin_param ───────────────────────────────────────────────────

  server.registerTool("s1_set_plugin_param", {
    title: "Set Plugin Parameter",
    description: "Set a named parameter on a plugin instance. Value must be in [0.0 – 1.0] normalised range unless isAbsolute=true.",
    inputSchema: {
      trackName: z.string().describe("Track or bus name"),
      pluginName: z.string().describe("Plugin name"),
      paramName: z.string().describe("Parameter name (e.g. 'Room Size', 'Threshold', 'Release')"),
      value: z.number().describe("Parameter value"),
      isAbsolute: z.boolean().default(false).describe("If true, value is in the plugin's own unit (dB, Hz, etc.)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async ({ trackName, pluginName, paramName, value, isAbsolute }) => {
    if (getBridgeStatus() !== "connected") return notConnected(`set param "${paramName}" on "${pluginName}"`);
    try {
      const res = await sendCommand("setPluginParam", { trackName, pluginName, paramName, value, isAbsolute });
      if (!res.ok) throw new Error(res.error);
      const summary = `Set "${pluginName}" › "${paramName}" = ${value}${isAbsolute ? " (absolute)" : " (normalised)"}`;
      logAction({ tool: "s1_set_plugin_param", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_get_plugin_params ──────────────────────────────────────────────────

  server.registerTool("s1_get_plugin_params", {
    title: "Get Plugin Parameters",
    description: "List all automatable parameters and current values for a plugin instance.",
    inputSchema: {
      trackName: z.string(),
      pluginName: z.string(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ trackName, pluginName }) => {
    if (getBridgeStatus() !== "connected") return notConnected(`read params for "${pluginName}"`);
    try {
      const res = await sendCommand("getPluginParams", { trackName, pluginName });
      if (!res.ok) throw new Error(res.error);
      return { content: [{ type: "text", text: formatToolResult(true, `Params for "${pluginName}"`, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_load_plugin_preset ─────────────────────────────────────────────────

  server.registerTool("s1_load_plugin_preset", {
    title: "Load Plugin Preset",
    description: "Load a saved preset on an existing plugin instance.",
    inputSchema: {
      trackName: z.string(),
      pluginName: z.string(),
      presetName: z.string().describe("Preset name as shown in Studio One preset browser"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ trackName, pluginName, presetName }) => {
    if (getBridgeStatus() !== "connected") return notConnected(`load preset "${presetName}"`);
    try {
      const res = await sendCommand("loadPluginPreset", { trackName, pluginName, presetName });
      if (!res.ok) throw new Error(res.error);
      const summary = `Loaded preset "${presetName}" on "${pluginName}" (track: "${trackName}")`;
      logAction({ tool: "s1_load_plugin_preset", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });

  // ── s1_trigger_macro ──────────────────────────────────────────────────────

  server.registerTool("s1_trigger_macro", {
    title: "Trigger Studio One Macro",
    description: "Execute a named macro from the Studio One Macro organizer. Macro must exist in S1.",
    inputSchema: {
      macroName: z.string().describe("Exact macro name from the S1 Macro Organizer"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ macroName }) => {
    if (getBridgeStatus() !== "connected") return notConnected(`trigger macro "${macroName}"`);
    try {
      const res = await sendCommand("triggerMacro", { macroName });
      if (!res.ok) throw new Error(res.error);
      const summary = `Triggered macro: "${macroName}"`;
      logAction({ tool: "s1_trigger_macro", action: "s1_bridge", summary, dryRun: false, ok: true });
      return { content: [{ type: "text", text: formatToolResult(true, summary, res.data) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${e}` }], isError: true };
    }
  });
}
