// ─── Fornix Studio MCP – Production Package Planning Helpers ─────────────────
//
// Read-only change detection, recommendation, and priority planning for
// existing file-based production packages. No Studio One bridge dependency.

import type {
  PackageSectionId,
  ProductionPackageInput,
  ProductionPackageMetadata,
} from "./production-package.js";

export type PackageSectionPriority = "primary" | "secondary" | "optional";

export interface PackageProfileFieldChange {
  field: string;
  previousValue: unknown;
  nextValue: unknown;
}

export interface PackageSectionPlan {
  section: PackageSectionId;
  priority: PackageSectionPriority;
  reasons: string[];
  changedFields: string[];
}

export interface PackageUpdatePlan {
  changedProfileFields: PackageProfileFieldChange[];
  recommendedSections: PackageSectionId[];
  primarySections: PackageSectionId[];
  secondarySections: PackageSectionId[];
  optionalSections: PackageSectionId[];
  sectionPlans: PackageSectionPlan[];
}

type ComparablePackageData = Pick<
  ProductionPackageMetadata,
  | "trackName"
  | "artistName"
  | "tempo"
  | "keySignature"
  | "styleVariant"
  | "leadStyle"
  | "dropStrategy"
  | "energyProfile"
  | "targetBars"
  | "creativeBrief"
  | "mixConcerns"
  | "signatureHooks"
  | "mood"
  | "focus"
  | "concerns"
  | "substyle"
  | "kickStyle"
  | "antiClimaxStyle"
  | "arrangementFocus"
  | "vocalMode"
  | "djUtilityPriority"
  | "referenceNotes"
  | "sectionGoals"
  | "cinematicIntensity"
  | "aggressionLevel"
  | "emotionalTone"
>;

type PackageFieldName = keyof ComparablePackageData;

interface FieldPriorityRule {
  primary?: Array<[PackageSectionId, string]>;
  secondary?: Array<[PackageSectionId, string]>;
  optional?: Array<[PackageSectionId, string]>;
}

const TRACK_PROFILE_FIELDS: PackageFieldName[] = [
  "trackName",
  "artistName",
  "tempo",
  "keySignature",
  "styleVariant",
  "leadStyle",
  "dropStrategy",
  "energyProfile",
  "targetBars",
  "creativeBrief",
  "mixConcerns",
  "signatureHooks",
  "mood",
  "focus",
  "concerns",
  "substyle",
  "kickStyle",
  "antiClimaxStyle",
  "arrangementFocus",
  "vocalMode",
  "djUtilityPriority",
  "referenceNotes",
  "sectionGoals",
  "cinematicIntensity",
  "aggressionLevel",
  "emotionalTone",
];

const PRIORITY_WEIGHT: Record<PackageSectionPriority, number> = {
  primary: 3,
  secondary: 2,
  optional: 1,
};

const SECTION_ORDER: PackageSectionId[] = [
  "project_plan",
  "routing",
  "automation",
  "mix",
  "sound_design",
  "checklist",
];

const FIELD_PRIORITY_RULES: Record<PackageFieldName, FieldPriorityRule> = {
  trackName: {
    primary: [
      ["project_plan", "Track identity should stay aligned in the Project Plan header and arrangement framing."],
    ],
    secondary: [
      ["routing", "Track identity appears in the Routing Sheet header."],
      ["automation", "Track identity appears in the Automation Blueprint header."],
      ["mix", "Track identity appears in the Mix Report header."],
      ["sound_design", "Track identity appears in the Sound Design Pack header."],
      ["checklist", "Track identity appears in the Producer Checklist header."],
    ],
  },
  artistName: {
    primary: [["project_plan", "Artist identity changes the package overview and planning context."]],
    secondary: [["mix", "Artist identity appears in the Mix Report header."]],
  },
  tempo: {
    primary: [
      ["project_plan", "Tempo changes arrangement pacing and bar payload density."],
      ["automation", "Tempo changes rate-based build and release timing moves."],
    ],
    secondary: [["mix", "Tempo changes transition timing and tail masking risk."]],
  },
  keySignature: {
    primary: [["sound_design", "Key changes register choice, voicing, and layer placement."]],
    secondary: [["project_plan", "Key changes motif planning and emotional release framing."]],
  },
  styleVariant: {
    primary: [
      ["project_plan", "Style variant changes the overall structure and payoff strategy."],
      ["sound_design", "Style variant changes lead, screech, and atmosphere targets."],
    ],
    secondary: [
      ["routing", "Style variant changes bus emphasis and spatial restraint."],
      ["automation", "Style variant changes tension and release automation priorities."],
      ["mix", "Style variant changes the most likely hardstyle mix risks."],
    ],
    optional: [["checklist", "Style variant changes what the final pass/fail checks should emphasize."]],
  },
  leadStyle: {
    primary: [["sound_design", "Lead style directly changes synthesis, layering, and movement decisions."]],
    secondary: [
      ["routing", "Lead style changes lead bus grouping and effects emphasis."],
      ["mix", "Lead style changes harshness, width, and center-lane risk."],
    ],
    optional: [["project_plan", "Lead style can shift where melodic or hostile focus should land."]],
  },
  dropStrategy: {
    primary: [["project_plan", "Drop strategy changes section-to-section payoff order."]],
    secondary: [
      ["automation", "Drop strategy changes build, mute, and release automation moves."],
      ["mix", "Drop strategy changes where contrast and impact risks show up."],
    ],
  },
  energyProfile: {
    primary: [["project_plan", "Energy profile changes pacing, reveal timing, and section weighting."]],
    secondary: [
      ["automation", "Energy profile changes tension-curve automation planning."],
      ["checklist", "Energy profile changes what to validate before the final arrangement pass."],
    ],
  },
  targetBars: {
    primary: [["project_plan", "Target bar count changes arrangement scope and section lengths."]],
    secondary: [["checklist", "Target bar count affects arrangement completion checks."]],
  },
  creativeBrief: {
    primary: [["project_plan", "Creative brief directly changes production priorities and section language."]],
    secondary: [
      ["sound_design", "Creative brief changes texture and layer intent."],
      ["checklist", "Creative brief changes what should pass the final creative review."],
    ],
  },
  mixConcerns: {
    primary: [["mix", "Explicit mix concerns should change the action list directly."]],
    secondary: [["checklist", "Explicit mix concerns should surface in the final QA checks."]],
  },
  signatureHooks: {
    primary: [
      ["project_plan", "Signature hooks change section priorities and reveal strategy."],
      ["sound_design", "Signature hooks change the main synthesis targets."],
    ],
    secondary: [["checklist", "Signature hooks should be explicitly validated before finish."]],
  },
  mood: {
    primary: [["project_plan", "Mood changes the cinematic and emotional section framing."]],
    secondary: [["sound_design", "Mood changes timbre density and atmosphere design choices."]],
  },
  focus: {
    primary: [["project_plan", "Primary focus changes the plan priorities."]],
    secondary: [
      ["mix", "Primary focus changes which mix risks deserve the strongest attention."],
      ["checklist", "Primary focus changes what the package should validate as done."],
    ],
  },
  concerns: {
    primary: [["mix", "General concerns should shift the mix action priorities."]],
    secondary: [["checklist", "General concerns should remain visible in producer QA."]],
  },
  substyle: {
    primary: [
      ["project_plan", "Substyle changes section architecture and contrast expectations."],
      ["sound_design", "Substyle changes lead, screech, and atmosphere targets."],
    ],
    secondary: [
      ["routing", "Substyle changes bus grouping priorities and spatial restraint."],
      ["automation", "Substyle changes how aggressively tension moves should hit."],
      ["mix", "Substyle changes likely clash points and impact discipline."],
    ],
    optional: [["checklist", "Substyle changes the final producer checks."]],
  },
  kickStyle: {
    primary: [
      ["sound_design", "Kick style changes layer design, transient strategy, and tail intent."],
      ["mix", "Kick style changes tail masking, tok definition, and mono discipline risks."],
    ],
    secondary: [["routing", "Kick style changes kick bus shaping, tail control, and sidechain intent."]],
    optional: [["checklist", "Kick style changes the final kick translation checks."]],
  },
  antiClimaxStyle: {
    primary: [
      ["project_plan", "Anti-climax style changes how the hostile section is staged."],
      ["automation", "Anti-climax style changes filter, distortion, and tension automation moves."],
    ],
    secondary: [
      ["sound_design", "Anti-climax style changes screech and bass design direction."],
      ["mix", "Anti-climax style changes screech pressure and kick-space risk."],
    ],
    optional: [["checklist", "Anti-climax style changes what the producer should re-check before export."]],
  },
  arrangementFocus: {
    primary: [["project_plan", "Arrangement focus directly changes the structural priorities."]],
    secondary: [
      ["automation", "Arrangement focus changes tension and transition automation planning."],
      ["checklist", "Arrangement focus changes the final arrangement validation."],
    ],
  },
  vocalMode: {
    primary: [
      ["routing", "Vocal mode changes center-lane bus planning, send discipline, and vocal lane reservation."],
      ["mix", "Vocal mode changes center clarity, ducking, and masking risks."],
    ],
    secondary: [
      ["checklist", "Vocal mode changes intelligibility and center-lane validation checks."],
      ["sound_design", "Vocal mode changes how leads and FX layers must leave room."],
    ],
    optional: [["project_plan", "Vocal mode can change breakdown and hook staging decisions."]],
  },
  djUtilityPriority: {
    primary: [
      ["project_plan", "DJ utility priority changes intro/outro planning and transition usefulness."],
      ["routing", "DJ utility priority changes outro routing discipline and utility stems emphasis."],
    ],
    secondary: [["checklist", "DJ utility priority changes transition-readiness checks."]],
    optional: [["mix", "DJ utility emphasis can warrant a quick transition-focused mix pass."]],
  },
  referenceNotes: {
    primary: [["project_plan", "Reference notes should change section planning language."]],
    secondary: [
      ["sound_design", "Reference notes should change synthesis and layering direction."],
      ["checklist", "Reference notes should remain visible in producer validation."],
    ],
  },
  sectionGoals: {
    primary: [["project_plan", "Section goals directly affect the arrangement plan."]],
    secondary: [
      ["automation", "Section goals should change section-specific automation moves."],
      ["checklist", "Section goals should be validated before finish."],
    ],
  },
  cinematicIntensity: {
    primary: [
      ["project_plan", "Cinematic intensity changes intro and breakdown architecture."],
      ["automation", "Cinematic intensity changes riser, filter, and impact automation weight."],
    ],
    secondary: [
      ["sound_design", "Cinematic intensity changes atmosphere, impacts, and transition layer design."],
      ["mix", "Cinematic intensity changes wash, transition, and low-mid buildup risks."],
    ],
    optional: [["routing", "Heavy cinematic staging can justify stricter FX and transition bus cleanup."]],
  },
  aggressionLevel: {
    primary: [
      ["sound_design", "Aggression level changes screech tone, transient design, and drop pressure choices."],
      ["mix", "Aggression level changes harshness and density risk management."],
    ],
    secondary: [
      ["project_plan", "Aggression level changes anti-climax and drop pressure targets."],
      ["automation", "Aggression level changes distortion, filter, and dynamic automation depth."],
    ],
  },
  emotionalTone: {
    primary: [["project_plan", "Emotional tone changes breakdown and payoff direction."]],
    secondary: [["sound_design", "Emotional tone changes lead timbre and pad support."]],
  },
};

function normalizeComparableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [...value];
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
    );
  }

  return value ?? null;
}

function comparableEquals(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeComparableValue(a)) === JSON.stringify(normalizeComparableValue(b));
}

export function diffPackageProfile(
  previous: ProductionPackageMetadata,
  next: ProductionPackageInput | ProductionPackageMetadata,
): PackageProfileFieldChange[] {
  return TRACK_PROFILE_FIELDS.flatMap((field) => {
    const previousValue = normalizeComparableValue(previous[field]);
    const nextValue = normalizeComparableValue(next[field]);

    if (comparableEquals(previousValue, nextValue)) {
      return [];
    }

    return [{
      field,
      previousValue,
      nextValue,
    }];
  });
}

export function planPackageSections(
  changes: PackageProfileFieldChange[],
): PackageUpdatePlan {
  const sectionPlans = new Map<PackageSectionId, PackageSectionPlan>();

  const mergeRule = (
    section: PackageSectionId,
    priority: PackageSectionPriority,
    reason: string,
    changedField: string,
  ) => {
    const existing = sectionPlans.get(section);
    const normalizedReason = `${changedField}: ${reason}`;

    if (!existing) {
      sectionPlans.set(section, {
        section,
        priority,
        reasons: [normalizedReason],
        changedFields: [changedField],
      });
      return;
    }

    const existingReasonSet = new Set(existing.reasons);
    existingReasonSet.add(normalizedReason);

    const existingFieldSet = new Set(existing.changedFields);
    existingFieldSet.add(changedField);

    const strongerPriority =
      PRIORITY_WEIGHT[priority] > PRIORITY_WEIGHT[existing.priority]
        ? priority
        : existing.priority;

    sectionPlans.set(section, {
      section,
      priority: strongerPriority,
      reasons: Array.from(existingReasonSet),
      changedFields: Array.from(existingFieldSet),
    });
  };

  for (const change of changes) {
    const field = change.field as PackageFieldName;
    const rules = FIELD_PRIORITY_RULES[field];
    if (!rules) continue;

    for (const [section, reason] of rules.primary ?? []) {
      mergeRule(section, "primary", reason, field);
    }
    for (const [section, reason] of rules.secondary ?? []) {
      mergeRule(section, "secondary", reason, field);
    }
    for (const [section, reason] of rules.optional ?? []) {
      mergeRule(section, "optional", reason, field);
    }
  }

  const sortedPlans = Array.from(sectionPlans.values()).sort((a, b) => {
    const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priorityDiff !== 0) return priorityDiff;

    const reasonDiff = b.reasons.length - a.reasons.length;
    if (reasonDiff !== 0) return reasonDiff;

    return SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
  });

  const primarySections = sortedPlans.filter((item) => item.priority === "primary").map((item) => item.section);
  const secondarySections = sortedPlans.filter((item) => item.priority === "secondary").map((item) => item.section);
  const optionalSections = sortedPlans.filter((item) => item.priority === "optional").map((item) => item.section);

  return {
    changedProfileFields: changes,
    recommendedSections: sortedPlans.map((item) => item.section),
    primarySections,
    secondarySections,
    optionalSections,
    sectionPlans: sortedPlans,
  };
}

export function getSectionPlanForSection(
  section: PackageSectionId,
  plan: PackageUpdatePlan,
): PackageSectionPlan | undefined {
  return plan.sectionPlans.find((item) => item.section === section);
}
