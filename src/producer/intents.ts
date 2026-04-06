// ─── Fornix Studio – Producer Intent Types ───────────────────────────────────
//
// High-level intents a producer would express. Each intent maps to a plan
// that queries DAW capabilities and delegates to existing services.
//
// ── Response contract (schema version 1) ─────────────────────────────────────
//
// Every intent returns a ProducerPlan. The shape is stable and consumed by:
//   • fornix_producer_plan MCP tool  (src/tools/producer.ts)
//   • /api/producer-plan JSON route  (src/services/status-server.ts)
//   • /producer HTML view            (creator-facing)
//
// The contract is versioned via `schemaVersion`. Consumers should check this
// field before assuming the shape. All plans are preview-only (no DAW writes).
//
// Adding a new intent:
//   1. Add the ID to ProducerIntentId
//   2. Add a builder in orchestrator.ts
//   3. Add it to VALID_INTENT_IDS below
//   4. No schema change needed — all intents return ProducerPlan.

import type { DawCapability } from "../daw/types.js";

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
  /**
   * Readiness of this suggestion's action, if applicable.
   *   • "preview-only" — meaningful future action candidate, not yet executable
   *   • "unavailable"  — purely diagnostic, no action path planned
   */
  actionState?: "preview-only" | "unavailable";
  /** Bar range this suggestion targets, if applicable. */
  barRange?: { startBar: number; endBar: number };
  /** Optional tags for categorization (e.g. "low-end", "structure", "export"). */
  tags?: string[];
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
 * Lightweight history/action metadata for a producer plan.
 *
 * In the current preview-only phase, `status` is always "preview-only" and
 * `appliedAt`/`rollbackToken` are always undefined.  These fields exist as
 * stable attachment points for future apply/rollback/audit work.
 */
export interface ProducerPlanHistory {
  /** Always "preview-only" in the current phase — no plans are applied. */
  status: "preview-only";
  /** Reserved: ISO timestamp when this plan was applied (future). */
  appliedAt?: undefined;
  /** Reserved: opaque token for rolling back an applied plan (future). */
  rollbackToken?: undefined;
  /** Optional human-readable note about this plan's lifecycle. */
  note?: string;
}

/**
 * The stable, versioned response shape returned by every producer intent.
 *
 * schema version 1 — consumed by MCP tool, JSON API, and HTML view.
 * All fields are always present (some may be empty arrays or undefined).
 */
export interface ProducerPlan {
  /** Schema version. Consumers should check this before assuming shape. */
  schemaVersion: "1";
  /** Stable identifier for this plan instance (intent + adapter + timestamp hash). */
  planId: string;
  /** ISO 8601 timestamp of when this plan was generated. */
  generatedAt: string;
  /** Which intent produced this plan. */
  intentId: ProducerIntentId;
  /** Always true — producer plans are preview-only, no DAW writes. */
  previewOnly: true;
  /** Which DAW adapter produced this plan (e.g. "studio-one-7"). */
  adapterId: string;
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
  /** Full capability snapshot from the active DAW adapter. */
  capabilities: DawCapability[];
  /** Whether live arrangement analysis was available and used. */
  analysisAvailable: boolean;
  /** History/action metadata — preview-only in current phase. */
  history: ProducerPlanHistory;
}
