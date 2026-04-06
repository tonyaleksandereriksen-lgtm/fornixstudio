// ─── Fornix Studio – Producer Intent Types ───────────────────────────────────
//
// High-level intents a producer would express. Each intent maps to a plan
// that queries DAW capabilities and delegates to existing services.
//
// ── Response contract ────────────────────────────────────────────────────────
//
// Every intent returns a ProducerPlan. The shape is stable and consumed by:
//   • fornix_producer_plan MCP tool  (src/tools/producer.ts)
//   • /api/producer-plan JSON route  (src/services/status-server.ts)
//   • /producer HTML view            (creator-facing)
//
// Adding a new intent:
//   1. Add the ID to ProducerIntentId
//   2. Add a builder in orchestrator.ts
//   3. Add it to the validIntents list in status-server.ts
//   4. No schema change needed — all intents return ProducerPlan.

/** Recognized producer intent identifiers. */
export type ProducerIntentId =
  | "critique-drop"
  | "critique-arrangement"
  | "prepare-mastering"
  | "suggest-arrangement"
  | "generate-package"
  | "session-overview";

/** All valid intent IDs, exported as a runtime array for validation. */
export const VALID_INTENT_IDS: readonly ProducerIntentId[] = [
  "critique-drop",
  "critique-arrangement",
  "prepare-mastering",
  "suggest-arrangement",
  "session-overview",
] as const;

/** Input to the producer orchestrator. */
export interface ProducerIntentInput {
  id: ProducerIntentId;
  /** Optional: target a specific section by marker name or ID. */
  targetSectionId?: string;
  /** Reserved for future per-intent options. */
  options?: Record<string, unknown>;
}

/**
 * A single actionable suggestion within a producer plan.
 *
 * Every suggestion has a confidence level that reflects data quality:
 *   • "high"   — backed by parsed arrangement data or session state
 *   • "medium" — inferred from partial data or heuristics
 *   • "low"    — generic guidance, no live data available
 */
export interface ProducerSuggestion {
  /** Unique identifier within this plan (e.g. "drop-impact", "master-headroom"). */
  id: string;
  /** Short, human-readable title shown to the creator. */
  title: string;
  /** Explanation of why this suggestion matters and what to check. */
  rationale: string;
  /** Confidence in this suggestion based on available data. */
  confidence: "low" | "medium" | "high";
  /** If set, this suggestion can be executed as a DAW action (future). */
  actionId?: string;
  /** Bar range this suggestion targets, if applicable. */
  barRange?: { start: number; end: number };
}

/**
 * The section a plan targets, if applicable.
 * Source indicates how it was resolved:
 *   • "explicit" — user provided targetSectionId
 *   • "auto"     — auto-detected from arrangement data or markers
 *   • "none"     — no target could be resolved
 */
export interface ProducerTargetSection {
  name: string;
  startBar: number;
  lengthBars: number;
  source: "explicit" | "auto" | "none";
}

/**
 * The stable response shape returned by every producer intent.
 *
 * This is the contract consumed by the MCP tool, JSON API, and HTML view.
 * All fields are always present (some may be empty arrays or undefined).
 */
export interface ProducerPlan {
  /** Which intent produced this plan. */
  intentId: ProducerIntentId;
  /** Human-readable plan title. */
  title: string;
  /** One-line summary of what the plan covers. */
  summary: string;
  /** Warnings about missing capabilities, data gaps, or degraded output. */
  warnings: string[];
  /** Ordered list of actionable suggestions. */
  suggestions: ProducerSuggestion[];
  /** The section this plan targets, if applicable (section-specific intents). */
  targetSection?: ProducerTargetSection;
  /** One-line summaries of capabilities that were checked. */
  capabilityReport: string[];
  /** Whether live arrangement analysis was available and used. */
  analysisAvailable: boolean;
}
