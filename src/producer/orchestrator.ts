// ─── Fornix Studio – Producer Orchestrator ────────────────────────��──────────
//
// Turns a producer intent into an actionable plan by:
//   1. Querying the active adapter for capabilities and session state
//   2. Delegating to existing services (arrangement analysis, production packages)
//   3. Producing a plan with concrete, confidence-rated suggestions
//
// This does NOT replace existing tools — it composes them into intent flows.

import { hasCapability, summarizeCapabilities } from "../daw/capabilities.js";
import type { DawAdapter, DawCapability, DawSessionSnapshot } from "../daw/types.js";
import type {
  ProducerIntentInput,
  ProducerPlan,
  ProducerSuggestion,
  ProducerTargetSection,
} from "./intents.js";
import {
  buildArrangementSummary,
  analyzeArrangement,
  type ArrangementAnalysis,
  type ArrangementSummary,
  type Section,
} from "../services/arrangement.js";
import { getCurrentSnapshot } from "../services/song-watcher.js";

/**
 * Build a producer plan for the given intent using the active DAW adapter.
 * The plan includes warnings about missing capabilities and concrete suggestions.
 */
export async function buildProducerPlan(
  adapter: DawAdapter,
  input: ProducerIntentInput,
): Promise<ProducerPlan> {
  const [capabilities, session] = await Promise.all([
    adapter.getCapabilities(),
    adapter.getSessionSnapshot(),
  ]);

  const capabilityReport = summarizeCapabilities(capabilities);
  const baseWarnings = session.warnings.slice();

  switch (input.id) {
    case "critique-drop":
      return buildCritiqueDropPlan(capabilities, session, input, capabilityReport, baseWarnings);
    case "critique-arrangement":
      return buildCritiqueArrangementPlan(capabilities, session, capabilityReport, baseWarnings);
    case "prepare-mastering":
      return buildMasteringPrepPlan(capabilities, session, capabilityReport, baseWarnings);
    case "session-overview":
      return buildSessionOverviewPlan(capabilities, session, capabilityReport, baseWarnings);
    default:
      return {
        intentId: input.id,
        title: `Intent: ${input.id}`,
        summary: `Intent "${input.id}" is recognized but not yet implemented in the orchestrator.`,
        warnings: [...baseWarnings, `No orchestration logic for intent "${input.id}" yet.`],
        suggestions: [],
        capabilityReport,
        analysisAvailable: false,
      };
  }
}

// ─── Arrangement analysis helper ─────────────────────────────────────────────

/**
 * Try to produce an ArrangementAnalysis from the active song watcher snapshot.
 * Returns null if no watcher data is available or parsing fails.
 */
function tryGetArrangementAnalysis(): { analysis: ArrangementAnalysis; summary: ArrangementSummary } | null {
  const snapshot = getCurrentSnapshot();
  if (!snapshot) return null;

  try {
    const summary = buildArrangementSummary(snapshot.result);
    if (summary.sections.length === 0) return null;
    const analysis = analyzeArrangement(summary, { genre: "hardstyle" });
    return { analysis, summary };
  } catch {
    return null;
  }
}

// ─── Critique Drop ───────────────────────────────────────────────────────────

function buildCritiqueDropPlan(
  capabilities: DawCapability[],
  session: DawSessionSnapshot,
  input: ProducerIntentInput,
  capabilityReport: string[],
  warnings: string[],
): ProducerPlan {
  const canReadArrangement = hasCapability(capabilities, "arrangement.read");

  // Try to get real arrangement data
  const arrangementData = canReadArrangement ? tryGetArrangementAnalysis() : null;
  const analysisAvailable = arrangementData !== null;

  if (!canReadArrangement) {
    warnings.push("Arrangement read not available. Start the song watcher or use fornix_analyze_arrangement with manual sections.");
  } else if (!analysisAvailable) {
    warnings.push("Song watcher active but no arrangement data available yet. Save the session in S1 to trigger a parse.");
  }

  // Resolve target section
  const target = resolveDropSection(
    input.targetSectionId,
    session,
    arrangementData?.summary ?? null,
  );

  // Build suggestions — use real analysis data when available
  const suggestions = analysisAvailable
    ? buildAnalysisBackedSuggestions(arrangementData!.analysis, arrangementData!.summary, target)
    : buildGenericDropSuggestions(target);

  const summaryText = target.source !== "none"
    ? `Critique "${target.name}" (bars ${target.startBar}–${target.startBar + target.lengthBars}). ` +
      (analysisAvailable ? "Backed by live arrangement analysis." : "Generic guidance — start song watcher for bar-specific analysis.")
    : "No drop section found. Provide a targetSectionId or start the song watcher.";

  return {
    intentId: "critique-drop",
    title: "Critique this drop",
    summary: summaryText,
    warnings,
    suggestions,
    targetSection: target.source !== "none" ? target : undefined,
    capabilityReport,
    analysisAvailable,
  };
}

/** Find the drop section from explicit input, session markers, or arrangement analysis. */
function resolveDropSection(
  explicitId: string | undefined,
  session: DawSessionSnapshot,
  summary: ArrangementSummary | null,
): ProducerTargetSection {
  // 1. Explicit input
  if (explicitId) {
    // Try to find it in arrangement data for bar info
    if (summary) {
      const section = summary.sections.find(
        (s) => s.name.toLowerCase() === explicitId.toLowerCase(),
      );
      if (section) {
        return {
          name: section.name,
          startBar: section.startBar,
          lengthBars: section.lengthBars,
          source: "explicit",
        };
      }
    }
    // Try session markers
    const marker = session.sections.find(
      (s) => s.name.toLowerCase() === explicitId.toLowerCase() || s.id === explicitId,
    );
    if (marker) {
      return {
        name: marker.name,
        startBar: marker.startBar ?? 0,
        lengthBars: 0,
        source: "explicit",
      };
    }
    // Accept as explicit even without bar data
    return { name: explicitId, startBar: 0, lengthBars: 0, source: "explicit" };
  }

  // 2. Auto-detect from arrangement sections
  if (summary) {
    const dropSection = findDropInSections(summary.sections);
    if (dropSection) {
      return {
        name: dropSection.name,
        startBar: dropSection.startBar,
        lengthBars: dropSection.lengthBars,
        source: "auto",
      };
    }
  }

  // 3. Auto-detect from session markers
  const dropMarker = session.sections.find((s) => /drop|chorus|hook/i.test(s.name));
  if (dropMarker) {
    return {
      name: dropMarker.name,
      startBar: dropMarker.startBar ?? 0,
      lengthBars: 0,
      source: "auto",
    };
  }

  return { name: "", startBar: 0, lengthBars: 0, source: "none" };
}

/** Find the first drop-like section in the arrangement. */
function findDropInSections(sections: Section[]): Section | undefined {
  return sections.find((s) => /drop|chorus|hook/i.test(s.name));
}

/** Build suggestions backed by real arrangement analysis data. */
function buildAnalysisBackedSuggestions(
  analysis: ArrangementAnalysis,
  summary: ArrangementSummary,
  target: ProducerTargetSection,
): ProducerSuggestion[] {
  const suggestions: ProducerSuggestion[] = [];
  const dropBar = target.startBar;
  const dropEnd = dropBar + target.lengthBars;

  // 1. Drop-specific problems from analysis
  const dropProblems = analysis.problems.filter(
    (p) => p.bar >= dropBar && (dropEnd === 0 || p.bar <= dropEnd),
  );

  if (dropProblems.length > 0) {
    for (const p of dropProblems.slice(0, 2)) {
      suggestions.push({
        id: `problem-${p.section}-${p.bar}`,
        title: `${p.severity === "critical" ? "Fix" : "Review"}: ${p.problem}`,
        rationale: `${p.severity} issue at bar ${p.bar} in "${p.section}".`,
        confidence: p.severity === "critical" ? "high" : "medium",
        barRange: { start: p.bar, end: p.bar + 8 },
      });
    }
  }

  // 2. Drop length check
  if (target.lengthBars > 0) {
    const dropLengthOk = target.lengthBars >= 16 && target.lengthBars <= 64;
    suggestions.push({
      id: "drop-length",
      title: dropLengthOk
        ? `Drop length OK (${target.lengthBars} bars)`
        : `Drop length concern (${target.lengthBars} bars)`,
      rationale: dropLengthOk
        ? `At ${target.lengthBars} bars, the drop has standard hardstyle duration.`
        : target.lengthBars < 16
          ? `At ${target.lengthBars} bars, the drop may feel too short. Typical hardstyle drops are 16–32 bars.`
          : `At ${target.lengthBars} bars, the drop may lose momentum. Consider tightening to 32 bars max.`,
      confidence: "high",
      barRange: { start: dropBar, end: dropEnd },
    });
  }

  // 3. Energy arc verdict for drop context
  if (analysis.energyArc) {
    const arcVerdict = analysis.energyArc.verdict;
    suggestions.push({
      id: "drop-energy-arc",
      title: `Energy arc: ${arcVerdict}`,
      rationale: analysis.energyArc.assessment,
      confidence: arcVerdict === "strong" ? "high" : arcVerdict === "needs-work" ? "medium" : "high",
    });
  }

  // 4. Pre-drop transition check
  const preDrop = findSectionBefore(summary.sections, target.name);
  if (preDrop) {
    suggestions.push({
      id: "pre-drop-transition",
      title: `Check transition from "${preDrop.name}" → "${target.name}"`,
      rationale: `"${preDrop.name}" (${preDrop.lengthBars} bars) leads into the drop. Verify build tension, filter sweep, and impact contrast.`,
      confidence: "high",
      barRange: {
        start: preDrop.startBar + preDrop.lengthBars - 4,
        end: dropBar + 4,
      },
    });
  }

  // 5. Drop actions from analysis engine
  const dropActions = analysis.actions.filter(
    (a) => a.targetBar >= dropBar && (dropEnd === 0 || a.targetBar <= dropEnd),
  );
  for (const a of dropActions.slice(0, 1)) {
    suggestions.push({
      id: `action-${a.priority}`,
      title: a.action,
      rationale: `Priority ${a.priority} action targeting bar ${a.targetBar} in "${a.section}".`,
      confidence: a.priority <= 2 ? "high" : "medium",
      barRange: { start: a.targetBar, end: a.targetBar + 8 },
    });
  }

  // Ensure at least 3 suggestions
  if (suggestions.length < 3) {
    suggestions.push(...buildGenericDropSuggestions(target).slice(suggestions.length));
  }

  return suggestions.slice(0, 5);
}

/** Generic suggestions when no arrangement data is available. */
function buildGenericDropSuggestions(target: ProducerTargetSection): ProducerSuggestion[] {
  const barRange = target.startBar > 0 && target.lengthBars > 0
    ? { start: target.startBar, end: target.startBar + target.lengthBars }
    : undefined;

  return [
    {
      id: "drop-impact",
      title: "Check impact and contrast",
      rationale: "Compare density, low-end handoff, and release against the pre-drop transition. The first beat of the drop should feel like a physical arrival.",
      confidence: "high",
      barRange,
    },
    {
      id: "drop-hook",
      title: "Audit hook clarity",
      rationale: "Check for lead masking, over-stacked layers, and weak rhythmic anchors. The hook should be instantly identifiable.",
      confidence: "medium",
    },
    {
      id: "drop-energy",
      title: "Verify energy arc",
      rationale: "Ensure the drop delivers the energy promise set by the buildup. Flag anti-climax, over-compression, or missing low-end weight.",
      confidence: "high",
    },
    {
      id: "drop-length-generic",
      title: "Check drop duration",
      rationale: "Standard hardstyle drops are 16–32 bars. Too short loses impact; too long loses attention. Verify against your target structure.",
      confidence: "medium",
    },
    {
      id: "drop-mixdown",
      title: "Preview mix balance",
      rationale: "Solo the drop section and check kick/bass balance, lead presence, and stereo width against your reference tracks.",
      confidence: "medium",
    },
  ];
}

/** Find the section immediately before a named section. */
function findSectionBefore(sections: Section[], targetName: string): Section | undefined {
  const idx = sections.findIndex((s) => s.name === targetName);
  return idx > 0 ? sections[idx - 1] : undefined;
}

// ─── Other intents (unchanged) ───────────────────────────────────────────────

function buildCritiqueArrangementPlan(
  capabilities: DawCapability[],
  session: DawSessionSnapshot,
  capabilityReport: string[],
  warnings: string[],
): ProducerPlan {
  const canReadArrangement = hasCapability(capabilities, "arrangement.read");

  if (!canReadArrangement) {
    warnings.push("Arrangement read not available. Use fornix_analyze_arrangement with manualSections as fallback.");
  }

  return {
    intentId: "critique-arrangement",
    title: "Critique arrangement",
    summary: `Analyze full arrangement structure (${session.sections.length} sections detected).`,
    warnings,
    suggestions: [
      {
        id: "arrangement-structure",
        title: "Check section flow and pacing",
        rationale: "Verify intro length, build tension, drop duration, and breakdown placement against hardstyle conventions.",
        confidence: canReadArrangement ? "high" : "medium",
      },
      {
        id: "arrangement-gaps",
        title: "Detect gaps and redundancy",
        rationale: "Flag dead air, over-long sections, or repeated patterns that reduce impact.",
        confidence: "high",
      },
    ],
    capabilityReport,
    analysisAvailable: canReadArrangement,
  };
}

function buildMasteringPrepPlan(
  capabilities: DawCapability[],
  session: DawSessionSnapshot,
  capabilityReport: string[],
  warnings: string[],
): ProducerPlan {
  const canReadSession = hasCapability(capabilities, "session.read");
  const canReadArrangement = hasCapability(capabilities, "arrangement.read");

  if (!canReadSession) {
    warnings.push("Session read not available. Producing guidance-only checklist.");
  }

  // Try arrangement analysis for length/structure data
  const arrangementData = canReadArrangement ? tryGetArrangementAnalysis() : null;
  const analysisAvailable = arrangementData !== null;

  const trackCount = session.tracks.length;
  const tempo = session.tempo;
  const title = session.title ?? "Untitled";

  // Build session-aware summary
  const summaryParts: string[] = [`Mastering-prep checklist for "${title}"`];
  if (tempo) summaryParts.push(`${tempo} BPM`);
  if (trackCount > 0) summaryParts.push(`${trackCount} tracks`);
  if (analysisAvailable) {
    const totalBars = arrangementData.summary.totalLengthBars;
    const totalSec = arrangementData.summary.totalLengthSeconds;
    const mins = Math.floor(totalSec / 60);
    const secs = Math.round(totalSec % 60);
    summaryParts.push(`${totalBars} bars (~${mins}:${secs.toString().padStart(2, "0")})`);
  }
  const summary = summaryParts.join(" — ") + ".";

  const suggestions: ProducerSuggestion[] = [];

  // 1. Headroom — always relevant
  suggestions.push({
    id: "master-headroom",
    title: "Verify headroom and clipping risk",
    rationale: "Check for limiter dependency on master bus, peak levels, and final export headroom target. " +
      "Aim for -1 dB true peak with at least -6 dB RMS headroom for the mastering engineer.",
    confidence: "high",
  });

  // 2. Master bus cleanup — always relevant
  suggestions.push({
    id: "master-bus-cleanup",
    title: "Review master bus chain",
    rationale: "Flag processing that should be removed before mastering: limiters, saturators, wide EQ. " +
      "Keep only intentional mix-glue processing (light bus compression, if any).",
    confidence: "high",
  });

  // 3. Track count hygiene — session-aware
  if (trackCount > 0) {
    const soloedTracks = session.tracks.filter((t) => t.soloed).map((t) => t.name);
    const mutedTracks = session.tracks.filter((t) => t.muted).map((t) => t.name);
    const rationale = trackCount > 40
      ? `${trackCount} tracks detected — high count. Verify no unused or duplicate tracks before print. `
      : `${trackCount} tracks detected. Verify all tracks are intentional. `;
    const soloNote = soloedTracks.length > 0
      ? `Soloed: ${soloedTracks.join(", ")} — remove before export. `
      : "";
    const muteNote = mutedTracks.length > 0
      ? `Muted: ${mutedTracks.join(", ")} — confirm these should stay muted or remove. `
      : "";

    suggestions.push({
      id: "master-track-hygiene",
      title: `Track hygiene check (${trackCount} tracks)`,
      rationale: rationale + soloNote + muteNote +
        "Disable any track solo, confirm mute states, remove unused sends.",
      confidence: trackCount > 0 ? "high" : "medium",
    });
  }

  // 4. Arrangement length check — analysis-aware
  if (analysisAvailable) {
    const totalSec = arrangementData.summary.totalLengthSeconds;
    const mins = Math.floor(totalSec / 60);
    const secs = Math.round(totalSec % 60);
    const lengthStr = `${mins}:${secs.toString().padStart(2, "0")}`;
    const isStandard = totalSec >= 150 && totalSec <= 420; // 2:30 – 7:00

    suggestions.push({
      id: "master-arrangement-length",
      title: `Arrangement length: ${lengthStr}`,
      rationale: isStandard
        ? `Track length (${lengthStr}) is within standard range for release. Verify tail/fade handling.`
        : totalSec < 150
          ? `Track is short (${lengthStr}). Confirm this is intentional — short tracks may need tail padding for streaming platforms.`
          : `Track is long (${lengthStr}). Verify arrangement doesn't have unnecessary dead air or overly extended sections.`,
      confidence: "high",
      barRange: { start: 1, end: arrangementData.summary.totalLengthBars },
    });

    // 5. Arrangement problems relevant to mastering
    const structureProblems = arrangementData.analysis.problems.filter(
      (p) => p.severity === "critical" || p.severity === "warning",
    );
    if (structureProblems.length > 0) {
      const topProblem = structureProblems[0];
      suggestions.push({
        id: "master-structure-issue",
        title: `Fix before mastering: ${topProblem.problem}`,
        rationale: `${topProblem.severity} issue at bar ${topProblem.bar} in "${topProblem.section}". ` +
          "Structural problems should be resolved before printing for mastering.",
        confidence: "high",
        barRange: { start: topProblem.bar, end: topProblem.bar + 8 },
      });
    }
  } else if (!canReadArrangement) {
    warnings.push("Start the song watcher for arrangement-aware mastering checks (track length, structural issues).");
  }

  // 6. Export settings — always relevant
  suggestions.push({
    id: "master-export",
    title: "Prepare export settings",
    rationale: "Print checklist: 24-bit WAV, session sample rate (do not resample), " +
      "tail long enough for reverb decay, name file clearly (Artist - Title - Mix Version).",
    confidence: "high",
  });

  // 7. Reference check — always relevant
  suggestions.push({
    id: "master-reference",
    title: "Final reference check",
    rationale: "A/B the mix against your reference tracks at matched loudness before printing. " +
      "Check tonal balance, low-end weight, and stereo image. Flag anything that feels off before mastering.",
    confidence: "medium",
  });

  return {
    intentId: "prepare-mastering",
    title: "Prepare for mastering",
    summary,
    warnings,
    suggestions: suggestions.slice(0, 7),
    capabilityReport,
    analysisAvailable,
  };
}

function buildSessionOverviewPlan(
  capabilities: DawCapability[],
  session: DawSessionSnapshot,
  capabilityReport: string[],
  warnings: string[],
): ProducerPlan {
  const trackCount = session.tracks.length;
  const sectionCount = session.sections.length;

  return {
    intentId: "session-overview",
    title: "Session overview",
    summary: `${session.title ?? "Untitled"} — ${session.tempo ?? "?"} BPM, ${trackCount} tracks, ${sectionCount} sections.`,
    warnings,
    suggestions: [
      {
        id: "overview-health",
        title: "Session health check",
        rationale: `${trackCount} tracks detected. Review for unused tracks, routing issues, and organizational clarity.`,
        confidence: trackCount > 0 ? "high" : "low",
      },
    ],
    capabilityReport,
    analysisAvailable: false,
  };
}
