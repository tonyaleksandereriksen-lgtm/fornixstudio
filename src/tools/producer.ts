// ─── Fornix Studio MCP – Producer Plan Tool ──────────────────────────────────
//
// Preview-only producer orchestration via the DAW adapter layer.
// Returns a capability-aware plan with suggestions — no actions are executed.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StudioOneAdapter } from "../daw/studio-one-adapter.js";
import { buildProducerPlan } from "../producer/orchestrator.js";
import { truncate } from "../services/logger.js";
import type { ProducerIntentId } from "../producer/intents.js";

// Singleton adapter — reused across calls (capabilities are dynamic)
let _adapter: StudioOneAdapter | null = null;
function getAdapter(): StudioOneAdapter {
  if (!_adapter) _adapter = new StudioOneAdapter();
  return _adapter;
}

export function registerProducerTools(server: McpServer): void {

  server.registerTool("fornix_producer_plan", {
    title: "Producer Plan (Preview)",
    description:
      "Generate a high-level producer plan for a given intent. " +
      "Returns capability-aware suggestions based on current DAW connection status. " +
      "This tool is preview-only — it reads state and produces guidance but does not " +
      "execute any changes in Studio One.\n\n" +
      "Intents:\n" +
      "  critique-drop — Review impact, hook clarity, and energy of the drop section\n" +
      "  critique-arrangement — Analyze full arrangement structure and pacing\n" +
      "  prepare-mastering — Generate a mastering-prep checklist\n" +
      "  session-overview — Summarize current session state and health\n" +
      "  suggest-arrangement — Propose arrangement improvements (planned)",
    inputSchema: {
      intent: z.enum([
        "critique-drop",
        "critique-arrangement",
        "prepare-mastering",
        "suggest-arrangement",
        "session-overview",
      ]).describe("What kind of producer guidance to generate"),
      targetSectionId: z.string().optional().describe(
        "Optional: target a specific section by marker name or ID. " +
        "If omitted, the orchestrator picks the most relevant section automatically."
      ),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async ({ intent, targetSectionId }) => {
    const adapter = getAdapter();

    const plan = await buildProducerPlan(adapter, {
      id: intent as ProducerIntentId,
      targetSectionId,
    });

    const capabilities = await adapter.getCapabilities();

    // ── Format response ──────────────────────────────────────────────────
    const lines: string[] = [
      `═══ Producer Plan: ${plan.title} ═══`,
      "[Preview Only — no actions will be executed]",
      "",
      `Adapter: ${adapter.displayName} (${adapter.id})`,
      `Intent: ${plan.intentId}`,
      `Analysis: ${plan.analysisAvailable ? "live arrangement data" : "generic guidance (no watcher data)"}`,
      "",
    ];

    // Target section
    if (plan.targetSection && plan.targetSection.source !== "none") {
      const ts = plan.targetSection;
      lines.push("── Target Section ──");
      lines.push(`  Name: ${ts.name}`);
      if (ts.startBar > 0) lines.push(`  Start: bar ${ts.startBar}`);
      if (ts.lengthBars > 0) lines.push(`  Length: ${ts.lengthBars} bars`);
      lines.push(`  Source: ${ts.source}`);
      lines.push("");
    }

    lines.push(plan.summary, "");

    if (plan.warnings.length > 0) {
      lines.push("── Warnings ──");
      for (const w of plan.warnings) {
        lines.push(`  ⚠ ${w}`);
      }
      lines.push("");
    }

    if (plan.suggestions.length > 0) {
      lines.push(`── Suggestions (${plan.suggestions.length}) ──`);
      for (let i = 0; i < plan.suggestions.length; i++) {
        const s = plan.suggestions[i];
        lines.push(`  ${i + 1}. [${s.confidence.toUpperCase()}] ${s.title}`);
        lines.push(`     ${s.rationale}`);
        if (s.barRange) {
          lines.push(`     Bars: ${s.barRange.start}–${s.barRange.end}`);
        }
        if (s.actionId) {
          lines.push(`     Action: ${s.actionId} (preview only)`);
        }
      }
      lines.push("");
    }

    lines.push("── Capability Snapshot ──");
    for (const cap of capabilities) {
      const badge = cap.status === "proven" ? "✓"
        : cap.status === "partial" ? "~"
        : cap.status === "blocked" ? "✗"
        : "?";
      const line = `  ${badge} ${cap.name}: ${cap.level}/${cap.status}`;
      lines.push(cap.note ? `${line} — ${cap.note}` : line);
    }

    return {
      content: [{ type: "text", text: truncate(lines.join("\n")) }],
    };
  });
}
