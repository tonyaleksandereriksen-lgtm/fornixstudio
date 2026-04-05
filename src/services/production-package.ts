
// ─── Fornix Studio MCP – Production Package Service ──────────────────────────

import fs from "fs";
import path from "path";
import { SERVER_VERSION } from "../constants.js";
import { workspaceExists, readWorkspace } from "./workspace-profile.js";
import {
  diffPackageProfile,
  getSectionPlanForSection,
  planPackageSections,
  type PackageProfileFieldChange,
  type PackageSectionPriority,
  type PackageUpdatePlan,
} from "./production-package-planning.js";

export type StyleVariant =
  | "cinematic-euphoric"
  | "rawphoric"
  | "anthemic-euphoric"
  | "festival-hardstyle";

export type LeadStyle = "euphoric" | "screech" | "hybrid";

export type DropStrategy =
  | "anti-climax-to-melodic"
  | "melodic-then-anti-climax"
  | "double-anti-climax"
  | "festival-main-drop";

export type EnergyProfile =
  | "patient-cinematic"
  | "steady-escalation"
  | "front-loaded"
  | "late-payoff";

export type MixPriority = "P1" | "P2" | "P3";

export type PackageSectionId =
  | "project_plan"
  | "routing"
  | "automation"
  | "mix"
  | "sound_design"
  | "checklist";

type PackageLayoutKey =
  | "projectPlan"
  | "routing"
  | "automation"
  | "mix"
  | "soundDesign"
  | "checklists";

export interface ProductionPackageInput {
  outputDir: string;
  trackName: string;
  artistName: string;
  tempo: number;
  keySignature: string;
  styleVariant: StyleVariant;
  leadStyle: LeadStyle;
  dropStrategy: DropStrategy;
  energyProfile: EnergyProfile;
  targetBars: number;
  creativeBrief?: string;
  mixConcerns?: string[];
  signatureHooks?: string[];
  mood?: string;
  focus?: string;
  concerns?: string[];
  substyle?: string;
  kickStyle?: string;
  antiClimaxStyle?: string;
  arrangementFocus?: string;
  vocalMode?: string;
  djUtilityPriority?: string;
  referenceNotes?: string[];
  sectionGoals?: Record<string, string>;
  cinematicIntensity?: string;
  aggressionLevel?: string;
  emotionalTone?: string;
}

export interface MixAction {
  id: string;
  area: string;
  section?: string;
  likelyIssue: string;
  whyItMatters: string;
  exactActionToTest: string;
  priority: MixPriority;
}

/** Serializable profile slice used for package identity and per-section override tracking. */
export interface StoredSectionProfile {
  styleVariant: StyleVariant;
  leadStyle: LeadStyle;
  dropStrategy: DropStrategy;
  energyProfile: EnergyProfile;
  substyle: string;
  kickStyle: string;
  antiClimaxStyle: string;
  arrangementFocus: string;
  vocalMode: string;
  djUtilityPriority: string;
  cinematicIntensity: "low" | "medium" | "high";
  aggressionLevel: "low" | "medium" | "high";
  emotionalTone: string;
  mood: string;
  focus: string;
  concerns: string[];
  referenceNotes: string[];
  sectionGoals: Record<string, string>;
  signatureHooks: string[];
}

export interface ProductionPackageMetadata {
  packageFormatVersion: string;
  generatorTool: string;
  generatorVersion: string;
  generationTimestamp: string;
  lastUpdatedTimestamp: string;
  updatedSections: PackageSectionId[];
  trackName: string;
  trackSlug: string;
  artistName: string;
  tempo: number;
  keySignature: string;
  styleVariant: StyleVariant;
  leadStyle: LeadStyle;
  dropStrategy: DropStrategy;
  energyProfile: EnergyProfile;
  targetBars: number;
  creativeBrief?: string;
  mixConcerns: string[];
  signatureHooks: string[];
  mood?: string;
  focus?: string;
  concerns?: string[];
  substyle?: string;
  kickStyle?: string;
  antiClimaxStyle?: string;
  arrangementFocus?: string;
  vocalMode?: string;
  djUtilityPriority?: string;
  referenceNotes?: string[];
  sectionGoals?: Record<string, string>;
  cinematicIntensity?: string;
  aggressionLevel?: string;
  emotionalTone?: string;
  /** If this package was generated from a workspace, records the workspace name for provenance. */
  workspaceRef?: string;
  /** Canonical package-level resolved profile (identity); top-level style fields mirror this after writes. */
  resolvedProfile?: StoredSectionProfile;
  /** Per-section resolved profiles; may differ after selective regeneration. */
  sectionResolvedProfiles?: Partial<Record<PackageSectionId, StoredSectionProfile>>;
}

export interface ProductionPackageResult {
  packageRoot: string;
  trackSlug: string;
  files: Record<PackageLayoutKey, string>;
  metadataPath: string;
  metadata: ProductionPackageMetadata;
  mixActions: MixAction[];
}

export interface PackageDocumentState {
  id: PackageSectionId;
  label: string;
  path: string;
  exists: boolean;
  lastModifiedTimestamp: string | null;
}

export interface ProductionPackageSummary {
  packageRoot: string;
  trackSlug: string;
  packagePath: string;
  packageFormatVersion: string | null;
  metadataPath: string;
  metadataExists: boolean;
  metadata: ProductionPackageMetadata | null;
  documents: Record<PackageSectionId, PackageDocumentState>;
  existingDocuments: PackageSectionId[];
  missingDocuments: PackageSectionId[];
  complete: boolean;
  generationTimestamp: string | null;
  lastUpdatedTimestamp: string | null;
  packageCompleteness: "complete" | "partial";
  hasSectionOverrides: boolean;
  overriddenSections: PackageSectionId[];
  packageHealth: "healthy" | "partial" | "mixed-overrides";
  packageConsistencySummary: string;
}

export interface RegeneratePackageSectionInput extends Partial<Omit<ProductionPackageInput, "outputDir">> {
  outputDir?: string;
  packagePath?: string;
  trackSlug?: string;
  section: PackageSectionId;
}

export interface RegeneratePackageSectionResult {
  packageRoot: string;
  packageSummary: ProductionPackageSummary;
  updatedSection: PackageSectionId;
  updatedFile: string;
  untouchedFiles: string[];
  metadataPath: string;
  metadata: ProductionPackageMetadata;
  mixActions: MixAction[];
  changedProfileFields: PackageProfileFieldChange[];
  sectionJustifyingProfileFields: string[];
  updatedSectionPriority: PackageSectionPriority | null;
  sectionRecommendationReasons: string[];
  remainingRecommendedSections: PackageSectionId[];
  metadataUpdatedFields: string[];
  packageLevelProfileRemainsUnchanged: boolean;
  hasSectionOverridesAfterUpdate: boolean;
  overriddenSectionsAfterUpdate: PackageSectionId[];
  packageHealthAfterUpdate: "healthy" | "partial" | "mixed-overrides";
  packageConsistencySummaryAfterUpdate: string;
}

export interface PackageLocatorInput {
  outputDir?: string;
  packagePath?: string;
  trackName?: string;
  trackSlug?: string;
}

export interface PreviewPackageUpdateInput extends Partial<Omit<ProductionPackageInput, "outputDir">> {
  outputDir?: string;
  packagePath?: string;
  trackSlug?: string;
}

export interface PackageUpdatePreviewResult extends PackageUpdatePlan {
  packageRoot: string;
  targetPackagePath: string;
  metadataPath: string;
  packageSummary: ProductionPackageSummary;
  currentPackageComplete: boolean;
  metadataWouldChange: boolean;
  hasSectionOverrides: boolean;
  overriddenSections: PackageSectionId[];
  packageCompleteness: "complete" | "partial";
  packageHealth: "healthy" | "partial" | "mixed-overrides";
  packageConsistencySummary: string;
  packageLevelProfileWouldChange: boolean;
  wouldIntroduceSectionOverrides: boolean;
  wouldLeaveSectionOverrides: boolean;
  overrideImpactSummary: string;
}

export type PackageUpdatePlanResult = PackageUpdatePreviewResult;

export const FORNIX_OUTPUT_ROOT = "Fornix";
export const PACKAGE_FORMAT_VERSION = "1.1.0";
export const PACKAGE_GENERATOR_TOOL = "fornix_generate_production_package";
export const PACKAGE_PREVIEW_TOOL = "fornix_preview_package_update";
export const PACKAGE_PLAN_TOOL = "fornix_plan_package_update";
export const PACKAGE_REGEN_TOOL = "fornix_regenerate_package_section";

export const PACKAGE_METADATA_LAYOUT = {
  dir: "00_Metadata",
  filename: "Package_Metadata.json",
} as const;

export const PACKAGE_LAYOUT = {
  projectPlan: { dir: "01_Project_Plan", filename: "Project_Plan.md" },
  routing: { dir: "02_Routing", filename: "Routing_Sheet.md" },
  automation: { dir: "03_Automation", filename: "Automation_Blueprint.md" },
  mix: { dir: "04_Mix", filename: "Mix_Report.md" },
  soundDesign: { dir: "05_Sound_Design", filename: "Sound_Design_Pack.md" },
  checklists: { dir: "06_Checklists", filename: "Producer_Checklist.md" },
} as const;

const SECTION_LAYOUT_BY_ID: Record<PackageSectionId, { key: PackageLayoutKey; label: string }> = {
  project_plan: { key: "projectPlan", label: "Project Plan" },
  routing: { key: "routing", label: "Routing Sheet" },
  automation: { key: "automation", label: "Automation Blueprint" },
  mix: { key: "mix", label: "Mix Report" },
  sound_design: { key: "soundDesign", label: "Sound Design Pack" },
  checklist: { key: "checklists", label: "Producer Checklist" },
};

interface ArrangementSection {
  name: string;
  bars: number;
  energy: string;
  purpose: string;
  productionFocus: string;
  notes: string;
}

interface RoutingBus {
  bus: string;
  sources: string;
  insertsIntent: string;
  risk: string;
}

interface AutomationRow {
  section: string;
  parameter: string;
  action: string;
  purpose: string;
}

interface SoundDesignRole {
  role: string;
  synthesisDirection: string;
  layering: string;
  movement: string;
  mixPlacement: string;
}

interface ResolvedProfile {
  substyle: string;
  kickStyle: string;
  antiClimaxStyle: string;
  arrangementFocus: string;
  vocalMode: string;
  djUtilityPriority: string;
  cinematicIntensity: "low" | "medium" | "high";
  aggressionLevel: "low" | "medium" | "high";
  emotionalTone: string;
  mood: string;
  focus: string;
  concerns: string[];
  referenceNotes: string[];
  sectionGoals: Record<string, string>;
  signatureHooks: string[];
  isRawphoric: boolean;
  isVocalFocused: boolean;
  wantsHighDjUtility: boolean;
  wantsCinematicWeight: boolean;
}

const ALL_SECTION_IDS = Object.keys(SECTION_LAYOUT_BY_ID) as PackageSectionId[];
const ALL_LAYOUT_KEYS = Object.keys(PACKAGE_LAYOUT) as PackageLayoutKey[];

const PRIORITY_ORDER: Record<MixPriority, number> = { P1: 0, P2: 1, P3: 2 };

export function slugifyTrackName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "untitled-track";
}

function titleCaseSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function markdownTable(headers: string[], rows: string[][]): string {
  const escape = (value: string) => value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => escape(cell)).join(" | ")} |`),
  ].join("\n");
}

function parseLevel(value: string | undefined, fallback: "low" | "medium" | "high"): "low" | "medium" | "high" {
  const text = value?.toLowerCase().trim();
  if (!text) return fallback;
  if (/(low|subtle|light|restrained|minimal)/.test(text)) return "low";
  if (/(high|heavy|cinematic|aggressive|intense|max)/.test(text)) return "high";
  return "medium";
}

function resolveProfile(input: ProductionPackageInput | ProductionPackageMetadata): ResolvedProfile {
  const signatureHooks = input.signatureHooks?.length
    ? [...input.signatureHooks]
    : ["cinematic intro", "anti-climax tension", "euphoric payoff"];

  const referenceNotes = input.referenceNotes?.length ? [...input.referenceNotes] : [];
  const concerns = input.concerns?.length ? [...input.concerns] : [...(input.mixConcerns ?? [])];

  const substyle =
    input.substyle
    ?? (input.styleVariant === "rawphoric"
      ? "rawphoric"
      : input.styleVariant === "cinematic-euphoric"
        ? "cinematic-euphoric"
        : input.styleVariant);

  const vocalMode = input.vocalMode
    ?? (input.styleVariant === "cinematic-euphoric" ? "featured-vocal" : "instrumental");

  const arrangementFocus = input.arrangementFocus
    ?? (input.energyProfile === "patient-cinematic"
      ? "long-form tension and reveal"
      : input.energyProfile === "front-loaded"
        ? "fast payoff and direct impact"
        : "steady lift with controlled contrast");

  const antiClimaxStyle = input.antiClimaxStyle
    ?? (input.styleVariant === "rawphoric"
      ? "aggressive screech-led anti-climax"
      : "controlled anti-climax with melodic contrast");

  const kickStyle = input.kickStyle
    ?? (input.styleVariant === "rawphoric"
      ? "hard transient tok with gritty tail control"
      : "clean hardstyle tok with controlled body and mono tail discipline");

  const djUtilityPriority = input.djUtilityPriority
    ?? (input.energyProfile === "front-loaded" ? "medium" : "high");

  const mood = input.mood ?? input.emotionalTone ?? "melancholic tension with release";
  const focus = input.focus ?? arrangementFocus;

  return {
    substyle,
    kickStyle,
    antiClimaxStyle,
    arrangementFocus,
    vocalMode,
    djUtilityPriority,
    cinematicIntensity: parseLevel(input.cinematicIntensity, input.styleVariant === "cinematic-euphoric" ? "high" : "medium"),
    aggressionLevel: parseLevel(input.aggressionLevel, input.styleVariant === "rawphoric" ? "high" : "medium"),
    emotionalTone: input.emotionalTone ?? input.mood ?? "melancholic but determined",
    mood,
    focus,
    concerns,
    referenceNotes,
    sectionGoals: input.sectionGoals ?? {},
    signatureHooks,
    isRawphoric: /raw/.test(substyle.toLowerCase()) || input.styleVariant === "rawphoric",
    isVocalFocused: /(vocal|spoken)/.test(vocalMode.toLowerCase()) && !/instrumental/.test(vocalMode.toLowerCase()),
    wantsHighDjUtility: /(high|club|dj|transition)/.test(djUtilityPriority.toLowerCase()),
    wantsCinematicWeight: parseLevel(input.cinematicIntensity, "medium") === "high"
      || input.styleVariant === "cinematic-euphoric",
  };
}

function serializeSectionProfile(input: ProductionPackageInput | ProductionPackageMetadata): StoredSectionProfile {
  const profile = resolveProfile(input);

  return {
    styleVariant: input.styleVariant,
    leadStyle: input.leadStyle,
    dropStrategy: input.dropStrategy,
    energyProfile: input.energyProfile,
    substyle: profile.substyle,
    kickStyle: profile.kickStyle,
    antiClimaxStyle: profile.antiClimaxStyle,
    arrangementFocus: profile.arrangementFocus,
    vocalMode: profile.vocalMode,
    djUtilityPriority: profile.djUtilityPriority,
    cinematicIntensity: profile.cinematicIntensity,
    aggressionLevel: profile.aggressionLevel,
    emotionalTone: profile.emotionalTone,
    mood: profile.mood,
    focus: profile.focus,
    concerns: [...profile.concerns],
    referenceNotes: [...profile.referenceNotes],
    sectionGoals: { ...profile.sectionGoals },
    signatureHooks: [...profile.signatureHooks],
  };
}

function cloneSectionProfile(profile: StoredSectionProfile): StoredSectionProfile {
  return {
    ...profile,
    concerns: [...profile.concerns],
    referenceNotes: [...profile.referenceNotes],
    sectionGoals: { ...profile.sectionGoals },
    signatureHooks: [...profile.signatureHooks],
  };
}

function buildResolvedInput(input: ProductionPackageInput | ProductionPackageMetadata): ProductionPackageInput {
  const sectionProfile = serializeSectionProfile(input);

  return {
    outputDir: "outputDir" in input ? input.outputDir : "",
    trackName: input.trackName,
    artistName: input.artistName,
    tempo: input.tempo,
    keySignature: input.keySignature,
    styleVariant: sectionProfile.styleVariant,
    leadStyle: sectionProfile.leadStyle,
    dropStrategy: sectionProfile.dropStrategy,
    energyProfile: sectionProfile.energyProfile,
    targetBars: input.targetBars,
    creativeBrief: input.creativeBrief,
    mixConcerns: [...(input.mixConcerns ?? [])],
    signatureHooks: [...sectionProfile.signatureHooks],
    mood: sectionProfile.mood,
    focus: sectionProfile.focus,
    concerns: [...sectionProfile.concerns],
    substyle: sectionProfile.substyle,
    kickStyle: sectionProfile.kickStyle,
    antiClimaxStyle: sectionProfile.antiClimaxStyle,
    arrangementFocus: sectionProfile.arrangementFocus,
    vocalMode: sectionProfile.vocalMode,
    djUtilityPriority: sectionProfile.djUtilityPriority,
    referenceNotes: [...sectionProfile.referenceNotes],
    sectionGoals: { ...sectionProfile.sectionGoals },
    cinematicIntensity: sectionProfile.cinematicIntensity,
    aggressionLevel: sectionProfile.aggressionLevel,
    emotionalTone: sectionProfile.emotionalTone,
  };
}

function buildUniformSectionProfiles(profile: StoredSectionProfile): Record<PackageSectionId, StoredSectionProfile> {
  return Object.fromEntries(
    ALL_SECTION_IDS.map((section) => [section, cloneSectionProfile(profile)]),
  ) as Record<PackageSectionId, StoredSectionProfile>;
}

function sanitizeSectionResolvedProfiles(
  value: Partial<Record<PackageSectionId, StoredSectionProfile>> | undefined,
): Partial<Record<PackageSectionId, StoredSectionProfile>> | undefined {
  if (!value) return undefined;

  const entries = Object.entries(value)
    .filter(([section]) => ALL_SECTION_IDS.includes(section as PackageSectionId))
    .map(([section, profile]) => [section, profile ? cloneSectionProfile(profile) : profile] as const)
    .filter((entry): entry is readonly [PackageSectionId, StoredSectionProfile] => Boolean(entry[1]));

  if (!entries.length) return undefined;
  return Object.fromEntries(entries) as Partial<Record<PackageSectionId, StoredSectionProfile>>;
}

function getPackageResolvedProfile(metadata: ProductionPackageMetadata): StoredSectionProfile {
  if (metadata.resolvedProfile) {
    return cloneSectionProfile(metadata.resolvedProfile);
  }

  return serializeSectionProfile(metadata);
}

function sectionProfilesEqual(left: StoredSectionProfile, right: StoredSectionProfile): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getOverriddenSections(metadata: ProductionPackageMetadata | null): PackageSectionId[] {
  if (!metadata) return [];
  const packageProfile = getPackageResolvedProfile(metadata);
  const sectionProfiles = metadata.sectionResolvedProfiles ?? buildUniformSectionProfiles(packageProfile);

  return ALL_SECTION_IDS.filter((section) => {
    const sectionProfile = sectionProfiles[section] ?? packageProfile;
    return !sectionProfilesEqual(sectionProfile, packageProfile);
  });
}

function describePackageHealth(
  metadataExists: boolean,
  missingDocuments: number,
  overriddenSections: PackageSectionId[],
): { packageCompleteness: "complete" | "partial"; packageHealth: "healthy" | "partial" | "mixed-overrides"; packageConsistencySummary: string } {
  const packageCompleteness = missingDocuments === 0 && metadataExists ? "complete" : "partial";

  if (!metadataExists || missingDocuments > 0) {
    return {
      packageCompleteness,
      packageHealth: "partial",
      packageConsistencySummary: missingDocuments > 0
        ? `Package is partial: ${missingDocuments} expected document(s) are missing.`
        : "Package metadata is missing.",
    };
  }

  if (overriddenSections.length > 0) {
    return {
      packageCompleteness,
      packageHealth: "mixed-overrides",
      packageConsistencySummary: `Package-level profile is unchanged, but section overrides exist for: ${overriddenSections.join(", ")}.`,
    };
  }

  return {
    packageCompleteness,
    packageHealth: "healthy",
    packageConsistencySummary: "Package metadata and section profiles are aligned with no section overrides.",
  };
}

function renderHeader(
  title: string,
  input: ProductionPackageInput | ProductionPackageMetadata,
  generatedAt: string,
): string[] {
  const profile = resolveProfile(input);
  const hooks = profile.signatureHooks.join(", ");

  const optionalLines = [
    profile.substyle ? `- **Substyle:** ${profile.substyle}` : null,
    profile.vocalMode ? `- **Vocal mode:** ${profile.vocalMode}` : null,
    profile.kickStyle ? `- **Kick style:** ${profile.kickStyle}` : null,
    profile.antiClimaxStyle ? `- **Anti-climax style:** ${profile.antiClimaxStyle}` : null,
    profile.arrangementFocus ? `- **Arrangement focus:** ${profile.arrangementFocus}` : null,
    profile.cinematicIntensity ? `- **Cinematic intensity:** ${profile.cinematicIntensity}` : null,
    profile.aggressionLevel ? `- **Aggression level:** ${profile.aggressionLevel}` : null,
    profile.emotionalTone ? `- **Emotional tone:** ${profile.emotionalTone}` : null,
    profile.mood ? `- **Mood:** ${profile.mood}` : null,
    profile.focus ? `- **Focus:** ${profile.focus}` : null,
    profile.referenceNotes.length ? `- **Reference notes:** ${profile.referenceNotes.join("; ")}` : null,
  ].filter((line): line is string => Boolean(line));

  return [
    `# ${title} – ${input.trackName}`,
    "",
    `- **Artist:** ${input.artistName}`,
    `- **Tempo:** ${input.tempo} BPM`,
    `- **Key:** ${input.keySignature}`,
    `- **Style:** ${input.styleVariant}`,
    `- **Lead focus:** ${input.leadStyle}`,
    `- **Drop strategy:** ${input.dropStrategy}`,
    `- **Energy profile:** ${input.energyProfile}`,
    `- **Signature hooks:** ${hooks}`,
    ...optionalLines,
    `- **Generated:** ${generatedAt}`,
    "",
  ];
}

function createArrangement(input: ProductionPackageInput): ArrangementSection[] {
  const profile = resolveProfile(input);

  const introFocus = profile.wantsCinematicWeight
    ? "Impacts, tonal atmospheres, filtered top loop, motif teaser, and disciplined transition cleanup."
    : "Impacts, filtered top loop, motif hints, and restrained melodic fragments.";

  const breakdownFocus = profile.isVocalFocused
    ? "Chord stack, theme support, center-lane vocal clarity, and controlled reverb bloom."
    : "Chord stack, theme piano/pluck, controlled reverb bloom, and theme reveal.";

  const firstDrop =
    input.dropStrategy === "melodic-then-anti-climax"
      ? {
          name: "Drop 1 – Euphoric Statement",
          bars: 24,
          energy: profile.isRawphoric ? "7/10" : "8/10",
          purpose: "Expose the main melody early without spending the loudest impact yet.",
          productionFocus: profile.isVocalFocused
            ? "Wide supersaws, vocal support lane, cleaner center, and tighter kick/sub than the climax."
            : "Wide supersaws, clean hook lane, and tighter kick/sub than the climax.",
          notes: "Keep the first drop slightly drier than the final climax so the second payoff can still grow.",
        }
      : {
          name: "Drop 1 – Anti-Climax",
          bars: 24,
          energy: profile.isRawphoric || profile.aggressionLevel === "high" ? "9/10" : "8/10",
          purpose: "Hit fast with attitude and rhythm before the full melodic payoff.",
          productionFocus: profile.isRawphoric
            ? "Kick, reverse bass, aggressive screech punctuation, minimal pad wash, and controlled top grit."
            : "Kick, reverse bass, screech punctuation, and minimal pad wash.",
          notes: `Use stark contrast after the build: dry center, strong kick transient, and less tail than the climax. ${profile.antiClimaxStyle}`,
        };

  const secondDrop =
    input.dropStrategy === "double-anti-climax"
      ? {
          name: "Drop 2 – Anti-Climax Escalation",
          bars: 32,
          energy: "9/10",
          purpose: "Escalate aggression with more movement, fills, and tighter edits.",
          productionFocus: "Add extra screech call-response, faster fills, and sharper FX mutes.",
          notes: "Differentiate from Drop 1 by automation intensity, not by overstuffing new layers.",
        }
      : input.dropStrategy === "festival-main-drop"
        ? {
            name: "Drop 2 – Festival Main Drop",
            bars: 32,
            energy: "10/10",
            purpose: "Deliver the widest and most anthemic payoff of the record.",
            productionFocus: "Full melody stack, stronger ride energy, maxed impact FX, and a clean mono anchor.",
            notes: "Open the stereo image and brightness here, but preserve mono sub discipline.",
          }
        : input.dropStrategy === "melodic-then-anti-climax"
          ? {
              name: "Drop 2 – Anti-Climax Switch-Up",
              bars: 32,
              energy: "9/10",
              purpose: "Refresh the second half with rhythmic aggression after the melody lands.",
              productionFocus: profile.isRawphoric
                ? "Screech lead, gated tails, faster fills, sharper downlifter cuts, and tighter top-bus control."
                : "Screech lead, gated tails, faster fills, and sharper downlifter cuts.",
              notes: "Do not bury the kick with extra screech layers; leave center space for tok and punch.",
            }
          : {
              name: "Drop 2 – Euphoric Climax",
              bars: 32,
              energy: "10/10",
              purpose: "Cash in the emotional payoff with the full melody and widest lead stack.",
              productionFocus: profile.isVocalFocused
                ? "Euphoric lead layers, octave support, vocal texture, and larger FX tails while keeping the vocal center readable."
                : "Euphoric lead layers, octave support, and larger FX tails on transitions.",
              notes: "Make this brighter and wider than Drop 1 while keeping sub and kick mono-locked.",
            };

  return [
    {
      name: "Intro – Cinematic Establishment",
      bars: 16,
      energy: profile.wantsCinematicWeight ? "4/10" : "3/10",
      purpose: "Set the theme with atmosphere, motif hints, and tension without revealing the drop payload.",
      productionFocus: introFocus,
      notes: profile.wantsCinematicWeight
        ? "Let the intro feel cinematic first. Transition cleanup matters more than filler density."
        : "Keep the intro restrained so the first full-width reveal still means something.",
    },
    {
      name: "Breakdown – Theme Reveal",
      bars: 16,
      energy: profile.isVocalFocused ? "6/10" : "5/10",
      purpose: profile.isVocalFocused ? "Present the hook, lyric/story lane, and harmonic identity." : "Present the harmonic identity and vocal/story moment.",
      productionFocus: breakdownFocus,
      notes: profile.isVocalFocused
        ? "Reserve center clarity for the topline and push wide supporting layers outward."
        : "Keep the chord tail elegant and let the topline breathe before the riser density increases.",
    },
    {
      name: "Build-Up 1",
      bars: 8,
      energy: "7/10",
      purpose: "Convert emotion into tension and point directly at the first drop.",
      productionFocus: "Pitch risers, snare lift, filter opening, and pre-drop mute discipline.",
      notes: "Tension should come from automation and subtraction, not just extra white noise.",
    },
    firstDrop,
    {
      name: "Mid-Intro / Reset",
      bars: 8,
      energy: "5/10",
      purpose: "Reset the ear and prepare the second emotional ramp.",
      productionFocus: "Strip back drums, motif callback, downlifter, and reduced bus density.",
      notes: "Use this section to clean reverb and prepare headroom for the second break.",
    },
    {
      name: "Breakdown 2 – Lift",
      bars: 16,
      energy: profile.wantsCinematicWeight ? "7/10" : "6/10",
      purpose: "Raise the emotional intensity and set the bigger final payoff.",
      productionFocus: profile.isVocalFocused
        ? "Bigger chords, vocal reinforcement, wider fills, and melodic pre-hook without masking the vocal center."
        : "Bigger chords, wider fills, and melodic pre-hook.",
      notes: "Save the brightest lead layer for the last 8 bars or the final drop loses contrast.",
    },
    {
      name: "Build-Up 2",
      bars: 8,
      energy: "8/10",
      purpose: "Create the highest tension point before the final release.",
      productionFocus: "Automation acceleration, impact pre-fx, snare roll modulation, and reverb pullback.",
      notes: "Kill unnecessary low-end in risers and sweeps so the downbeat hits clean.",
    },
    secondDrop,
    {
      name: "Outro / DJ Tail",
      bars: Math.max(16, input.targetBars - 128),
      energy: profile.wantsHighDjUtility ? "5/10" : "4/10",
      purpose: profile.wantsHighDjUtility
        ? "Provide a clean landing with enough drums and low-end discipline for real DJ transitions."
        : "Provide a clean landing with enough drums for edit and DJ utility.",
      productionFocus: "Controlled element removal, simpler lead motifs, and cleaner tails.",
      notes: profile.wantsHighDjUtility
        ? "Leave a dependable drum tail and avoid surprise transition FX over the final handoff bars."
        : "Preserve a usable drum tail and do not let the master limiter keep pumping after the emotional peak.",
    },
  ];
}

function buildRoutingBuses(input: ProductionPackageInput): RoutingBus[] {
  const profile = resolveProfile(input);
  const leadBus = input.leadStyle === "screech"
    ? "SCREECH"
    : input.leadStyle === "hybrid"
      ? "LEAD + SCREECH split"
      : "LEAD";

  const buses: RoutingBus[] = [
    {
      bus: "KICK",
      sources: "Tok, punch, body, tail print, transient helpers",
      insertsIntent: `Tone shaping and layer balancing before joining the sub lane. Kick style: ${profile.kickStyle}.`,
      risk: "If the tail is too long or too hot, the reverse bass loses definition and the drop softens.",
    },
    {
      bus: "SUB",
      sources: "Sub sine, reverse bass mono core, low fill support",
      insertsIntent: "Mono discipline, low-end cleanup, and phase-safe shaping",
      risk: "Stereo or saturated sub below ~120 Hz will make the drop collapse in mono and blur the limiter.",
    },
    {
      bus: "KICK & BASS",
      sources: "KICK bus + SUB bus",
      insertsIntent: "Gentle glue, shared clip control, and final kick/sub balance",
      risk: "Over-compressing this bus steals tok impact and exaggerates tail pumping.",
    },
    {
      bus: leadBus,
      sources: "Main leads, octave supports, note-center layer",
      insertsIntent: profile.isRawphoric
        ? "Control bite, midrange aggression, and send level without smearing the center."
        : "Control bite, width, and reverb send level as a single musical block.",
      risk: "Unmanaged 2.5–4.5 kHz energy will fatigue fast, especially when the screech layer enters.",
    },
    {
      bus: "MUSIC",
      sources: "Chords, pads, plucks, and cinematic theme elements",
      insertsIntent: "Shape width, duck around kick, and keep harmony behind the topline",
      risk: "If the bus stays too wide and wet during drops, the center loses punch and melody focus.",
    },
    {
      bus: "DRUM TOPS",
      sources: "Clap, snare, hats, rides, fills, tops",
      insertsIntent: "Transient leveling, top-end control, and groove cohesion",
      risk: "Too much top-bus limiting makes the anti-climax feel flat and cheap.",
    },
    {
      bus: "FX / ATMOS",
      sources: "Impacts, downlifters, uplifters, reverses, risers, and cinematic tails",
      insertsIntent: "Spatial management and transition control",
      risk: "This bus can wash the whole arrangement if long tails are not muted before the kick returns.",
    },
  ];

  if (profile.isVocalFocused) {
    buses.push({
      bus: "VOCALS / STORY",
      sources: "Lead vocal, chops, spoken texture, and support doubles",
      insertsIntent: "Keep the center-lane hook readable without over-widening the main phrase.",
      risk: "Competing lead or screech mids will bury the topline and make the breakdown smaller than intended.",
    });
  }

  buses.push({
    bus: "MASTER",
    sources: "All buses",
    insertsIntent: "Light control only until final print decisions",
    risk: "Solving balance problems on the master bus hides the real issue and makes A/B decisions unreliable.",
  });

  return buses;
}

function buildAutomationRows(input: ProductionPackageInput): AutomationRow[] {
  const profile = resolveProfile(input);
  const leadTarget = input.leadStyle === "screech" ? "SCREECH bus distortion drive" : "LEAD bus high-shelf";

  const rows: AutomationRow[] = [
    {
      section: "Intro – Cinematic Establishment",
      parameter: "MUSIC bus low-pass",
      action: "Open slowly from ~8 kHz to full range across 16 bars",
      purpose: "Reveal the harmonic world gradually without burning the drop brightness too early.",
    },
    {
      section: "Breakdown – Theme Reveal",
      parameter: "Lead teaser send to long reverb",
      action: "Increase on final 4 beats before the vocal/theme handoff, then pull back",
      purpose: "Make the breakdown feel larger without flooding the first melody exposure.",
    },
    {
      section: "Build-Up 1",
      parameter: "Riser group high-pass",
      action: "Sweep upward so the last bar carries almost no sub energy",
      purpose: "Leave headroom for the kick re-entry and prevent the first downbeat from feeling smeared.",
    },
    {
      section: "Build-Up 1",
      parameter: leadTarget,
      action: "Add 5–10% extra bite in the final 2 bars, then snap back on the drop",
      purpose: "Create expectation and a controlled contrast hit at the transition.",
    },
    {
      section: "Drop 1",
      parameter: "KICK & BASS bus clip amount",
      action: "Keep stable on bar 1–8, then automate +1 small step for fill bars only",
      purpose: "Maintain impact while letting later fill bars feel more aggressive.",
    },
    {
      section: "Mid-Intro / Reset",
      parameter: "FX / ATMOS return level",
      action: "Cut 2–3 dB on the first reset bar, then rebuild",
      purpose: "Clear space after Drop 1 and make the next break feel intentional instead of crowded.",
    },
    {
      section: "Breakdown 2 – Lift",
      parameter: "Main melody note-center level",
      action: "Automate up 0.5–1 dB across the last 8 bars",
      purpose: "Increase emotional focus without widening the whole lead bus too early.",
    },
    {
      section: "Build-Up 2",
      parameter: "Master pre-drop reverb tail",
      action: "Hard mute or gate in the final beat before the drop",
      purpose: "Protect the final downbeat from wash and increase perceived impact.",
    },
    {
      section: "Build-Up 2",
      parameter: "Snare roll pitch + rate",
      action: "Accelerate only in the final 2 bars",
      purpose: "Build urgency while keeping earlier bars readable and not fatiguing.",
    },
    {
      section: "Drop 2",
      parameter: "Lead width macro",
      action: "Open wider than Drop 1 after bar 5, keep the first 4 beats tighter",
      purpose: "Make the climax feel bigger while preserving punch on the first hit.",
    },
    {
      section: "Drop 2",
      parameter: "Kick tail decay or reverse bass release",
      action: "Shorten slightly during busiest fills and restore for the main loop",
      purpose: "Stop kick/sub smear when FX and ride density peak.",
    },
    {
      section: "Outro / DJ Tail",
      parameter: "Master bus saturation/clip stage",
      action: "Return to neutral while removing melodic layers",
      purpose: "Keep the outro clean and usable for edits or DJ transitions.",
    },
  ];

  if (profile.wantsCinematicWeight) {
    rows.push({
      section: "Intro – Cinematic Establishment",
      parameter: "FX / ATMOS tail mute group",
      action: "Cut long cinematic tails 1 beat earlier before the breakdown handoff",
      purpose: "Keep cinematic scale while preserving transition definition.",
    });
  }

  if (profile.isVocalFocused) {
    rows.push({
      section: "Breakdown – Theme Reveal",
      parameter: "VOCALS / STORY ride level",
      action: "Ride the center vocal up 0.5 dB only on key phrase endings",
      purpose: "Keep lyric intelligibility without flattening the whole vocal lane.",
    });
  }

  if (profile.isRawphoric) {
    rows.push({
      section: "Drop 1 – Anti-Climax",
      parameter: "SCREECH bus resonance macro",
      action: "Push only on call-response fills, not on every bar",
      purpose: "Keep the anti-climax aggressive without turning the midrange into static pain.",
    });
  }

  return rows;
}

const MIX_ACTION_LIBRARY: Record<string, MixAction> = {
  "kick-sub-separation": {
    id: "kick-sub-separation",
    area: "Kick & Bass",
    section: "main drop",
    likelyIssue: "Kick tail and reverse bass/sub share too much energy around the low-mid crossover.",
    whyItMatters: "The drop loses punch, the limiter works harder, and the tail masks rhythmic definition.",
    exactActionToTest: "Solo KICK, SUB, and KICK & BASS buses. Shorten the kick tail or reverse bass release by 10–15%, then carve a narrow dip where the tail masks the sub anchor. Re-compare the first 8 bars of the drop at matched loudness.",
    priority: "P1",
  },
  "lead-harshness": {
    id: "lead-harshness",
    area: "Lead Bus",
    section: "main drop",
    likelyIssue: "The main lead stack is pushing too hard in the 2.5–4.5 kHz bite zone.",
    whyItMatters: "Hardstyle leads need aggression, but excess bite makes the climax feel smaller and fatiguing after a few loops.",
    exactActionToTest: "Bypass only the brightest lead layer, identify whether the pain is from the wide layer or note-center, then test a dynamic dip in the harsh band while keeping the mono center present. Compare against the build-to-drop transition, not just a static loop.",
    priority: "P1",
  },
  "reverb-wash": {
    id: "reverb-wash",
    area: "Music / FX",
    section: "breakdown",
    likelyIssue: "Long reverb and delay tails are carrying into the drop entry.",
    whyItMatters: "The downbeat hits softer, transient contrast drops, and the anti-climax loses its dry aggression.",
    exactActionToTest: "Mute the long reverb return one beat before the drop and shorten the delay feedback on the transition fill. If the kick feels larger immediately, automate the returns instead of EQing the master.",
    priority: "P1",
  },
  "master-bus-pumping": {
    id: "master-bus-pumping",
    area: "Master",
    section: "main drop",
    likelyIssue: "Master bus dynamics control is reacting to kick/sub peaks instead of polishing the full mix.",
    whyItMatters: "The groove breathes in an uncontrolled way and your A/B decisions stop being trustworthy.",
    exactActionToTest: "Bypass the master dynamics stage for one chorus/drop loop. If the kick regains attack and the lead stops ducking awkwardly, ease the threshold or solve the balance earlier on KICK & BASS and LEAD before touching the master again.",
    priority: "P1",
  },
  "screech-midrange-fatigue": {
    id: "screech-midrange-fatigue",
    area: "Screech Bus",
    section: "anti-climax",
    likelyIssue: "Formant or band-pass screech layers are stacking in the same midrange slot as the lead hook.",
    whyItMatters: "The anti-climax feels noisy instead of surgical, and the melodic return sounds smaller by comparison.",
    exactActionToTest: "Automate the screech layer to answer the kick pattern instead of riding continuously, then notch only the most static resonance and test whether the rhythmic gaps restore energy. Keep the fix on the screech bus, not the master.",
    priority: "P1",
  },
  "wide-lead-mono-collapse": {
    id: "wide-lead-mono-collapse",
    area: "Lead Imaging",
    section: "main drop",
    likelyIssue: "The wide supersaw carries too much essential melody information with no solid mono center.",
    whyItMatters: "Phone, club mono zones, and limiter behavior all get worse when the hook disappears outside stereo playback.",
    exactActionToTest: "Check the climax in mono. If the melody sinks, raise the dry note-center layer 0.5–1 dB or narrow the widest layer slightly until the hook still speaks without the side energy.",
    priority: "P2",
  },
  "drop-impact-soft": {
    id: "drop-impact-soft",
    area: "Transitions",
    section: "main drop",
    likelyIssue: "The build is louder and denser than the drop entry, so the release feels smaller than the promise.",
    whyItMatters: "Hardstyle lives or dies on the perceived drop snap. If the first bar does not feel larger, the arrangement loses authority.",
    exactActionToTest: "Volume-match the last 2 bars of the build against bar 1 of the drop. Remove one non-essential build layer, gate the final tail, and test a cleaner first bar before adding more impact FX.",
    priority: "P1",
  },
  "top-bus-flatness": {
    id: "top-bus-flatness",
    area: "Drum Tops",
    section: "anti-climax",
    likelyIssue: "Top drums are too flattened by clipping or limiting and no longer lift the drop.",
    whyItMatters: "The track can sound loud but not exciting, especially in anti-climax sections that rely on groove detail.",
    exactActionToTest: "Bypass top-bus processing for 8 bars. If the groove wakes up, restore transient shape first and only then rebuild loudness with lighter clip or parallel treatment.",
    priority: "P2",
  },
  "sub-stereo-contamination": {
    id: "sub-stereo-contamination",
    area: "Sub",
    section: "main drop",
    likelyIssue: "Stereo effects or chorus are leaking into the low-end anchor.",
    whyItMatters: "Club translation gets unstable, the limiter reacts unpredictably, and the kick loses a clear landing spot.",
    exactActionToTest: "Collapse the SUB bus to mono below the crossover and bypass any widening after the split point. If the center instantly tightens, keep width on the harmonic bass layer only.",
    priority: "P1",
  },
  "fx-transition-overload": {
    id: "fx-transition-overload",
    area: "FX / Atmos",
    section: "intro",
    likelyIssue: "Risers, impacts, and reverse effects are all fighting for the same transition slot.",
    whyItMatters: "Instead of feeling cinematic, the arrangement feels cluttered and the drop loses contrast.",
    exactActionToTest: "Choose one primary riser, one tonal lift, and one impact for the biggest transition. Mute the rest for a single pass and check whether the drop feels cleaner and bigger.",
    priority: "P3",
  },
  "vocal-center-clash": {
    id: "vocal-center-clash",
    area: "Vocals / Lead Center",
    section: "breakdown",
    likelyIssue: "The lead center layer and the vocal are competing for the same intelligibility lane.",
    whyItMatters: "The topline loses authority, lyrics blur, and the breakdown stops feeling like the emotional anchor.",
    exactActionToTest: "Lower the mono center lead 0.5–1 dB only while the vocal phrase is active, then carve a narrow presence pocket in the support layers rather than on the vocal itself. Re-check the phrase against the drop handoff.",
    priority: "P1",
  },
};

function detectConcernIds(input: ProductionPackageInput): string[] {
  const profile = resolveProfile(input);

  const ids = new Set<string>([
    "kick-sub-separation",
    "lead-harshness",
    "reverb-wash",
    "drop-impact-soft",
    "master-bus-pumping",
  ]);

  if (input.leadStyle === "screech" || input.leadStyle === "hybrid" || profile.isRawphoric) {
    ids.add("screech-midrange-fatigue");
  }

  if (input.styleVariant === "rawphoric" || input.dropStrategy !== "festival-main-drop") {
    ids.add("top-bus-flatness");
  }

  if (input.leadStyle !== "screech") {
    ids.add("wide-lead-mono-collapse");
  }

  if (profile.isVocalFocused) {
    ids.add("vocal-center-clash");
  }

  if (profile.wantsCinematicWeight) {
    ids.add("fx-transition-overload");
  }

  const concernText = [
    ...(input.mixConcerns ?? []),
    ...(profile.concerns ?? []),
    ...profile.referenceNotes,
  ].join(" ").toLowerCase();

  if (/(sub|mono|stereo)/.test(concernText)) ids.add("sub-stereo-contamination");
  if (/(fx|transition|riser|impact)/.test(concernText)) ids.add("fx-transition-overload");
  if (/(kick|tail|bass|reverse bass)/.test(concernText)) ids.add("kick-sub-separation");
  if (/(harsh|bite|3k|4k|lead)/.test(concernText)) ids.add("lead-harshness");
  if (/(wash|reverb|delay)/.test(concernText)) ids.add("reverb-wash");
  if (/(master|pump|limit|glue)/.test(concernText)) ids.add("master-bus-pumping");
  if (/(vocal|lyric|center)/.test(concernText)) ids.add("vocal-center-clash");

  return Array.from(ids);
}

export function buildMixActions(input: ProductionPackageInput): MixAction[] {
  return detectConcernIds(input)
    .map((id) => MIX_ACTION_LIBRARY[id])
    .filter((action): action is MixAction => Boolean(action))
    .sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      if ((a.section ?? "") !== (b.section ?? "")) return (a.section ?? "").localeCompare(b.section ?? "");
      return a.area.localeCompare(b.area);
    });
}

export function renderMixActionsMarkdown(
  trackName: string,
  mixActions: MixAction[],
  generatedAt: string,
): string {
  const sections = mixActions.map((action) => [
    `## ${action.priority} – ${action.area}`,
    action.section ? `- **Section:** ${action.section}` : null,
    `- **Likely issue:** ${action.likelyIssue}`,
    `- **Why it matters:** ${action.whyItMatters}`,
    `- **Exact action to test:** ${action.exactActionToTest}`,
    `- **Priority:** ${action.priority}`,
    "",
  ].filter(Boolean).join("\n"));

  return [
    `# Mix Report – ${trackName}`,
    "",
    `- **Generated:** ${generatedAt}`,
    `- **Format:** likely issue / why it matters / exact action to test / priority`,
    "",
    "## Action Queue",
    "",
    ...sections,
    "_Generated by Fornix Studio MCP_",
  ].join("\n");
}

function renderProjectPlan(input: ProductionPackageInput, generatedAt: string): string {
  const profile = resolveProfile(input);
  const sections = createArrangement(input);

  const priorities = [
    "Lock kick / sub translation before spending time on wide climax polish.",
    profile.wantsCinematicWeight
      ? "Treat intro and breakdown transitions as real arrangement architecture, not filler between drops."
      : "Keep the intro restrained so the first drop still feels like a reveal.",
    profile.isVocalFocused
      ? "Protect center/mid clarity for the topline before widening support layers."
      : "Reserve the brightest lead layer and widest bus image for the final payoff.",
    profile.isRawphoric
      ? "Treat anti-climax aggression and top-bus control as the main excitement lever before adding more layers."
      : "Treat anti-climax aggression and euphoric emotion as separate energy tools, not the same sound with more distortion.",
  ];

  const table = markdownTable(
    ["Section", "Bars", "Energy", "Purpose", "Production focus", "Notes"],
    sections.map((section) => [
      section.name,
      String(section.bars),
      section.energy,
      section.purpose,
      section.productionFocus,
      section.notes,
    ]),
  );

  const sectionGoalRows = Object.entries(profile.sectionGoals).length
    ? [
        "## Section Goals",
        "",
        markdownTable(
          ["Section", "Goal"],
          Object.entries(profile.sectionGoals).map(([section, goal]) => [section, goal]),
        ),
        "",
      ]
    : [];

  return [
    ...renderHeader("Project Plan", input, generatedAt),
    "## Production Priorities",
    "",
    ...priorities.map((priority) => `- ${priority}`),
    "",
    input.creativeBrief ? `## Creative Brief\n\n${input.creativeBrief}\n` : "",
    sectionGoalRows.join("\n"),
    "## Section Map",
    "",
    table,
    "",
    "## Energy Notes",
    "",
    profile.wantsCinematicWeight
      ? "- **Cinematic intro architecture:** longer tonal reveals, transition cleanup, and motif pacing matter more than filler FX density."
      : "- **Cinematic intro architecture:** theme hints, impacts, and filtered musical content before any full-width lead reveal.",
    `- **Lead focus:** ${
      input.leadStyle === "hybrid"
        ? "Use euphoric lead for payoff and screech call-response for aggression."
        : input.leadStyle === "euphoric"
          ? "Prioritize melodic clarity and hook memorability."
          : "Prioritize rhythmic aggression and controlled resonance movement."
    }`,
    profile.isVocalFocused
      ? "- **Center-lane discipline:** reserve the mid/center lane for the topline during breakdowns and hook callouts."
      : "- **Drop impact strategy:** let subtraction and dry contrast create the hit before adding extra FX weight.",
    `- **Anti-climax planning:** ${profile.antiClimaxStyle}.`,
    profile.wantsHighDjUtility
      ? "- **DJ utility:** keep the outro handoff clean, with dependable drum information and controlled tail behavior."
      : "- **Outro utility:** keep the outro useful for edits and transitions without draining the emotional afterglow too early.",
    "",
    "_Generated by Fornix Studio MCP_",
  ].filter(Boolean).join("\n");
}

function renderRoutingSheet(input: ProductionPackageInput, generatedAt: string): string {
  const profile = resolveProfile(input);
  const buses = buildRoutingBuses(input);

  const busTable = markdownTable(
    ["Bus", "Sources", "Inserts intent", "Primary risk"],
    buses.map((bus) => [bus.bus, bus.sources, bus.insertsIntent, bus.risk]),
  );

  const folderGroups = [
    ["01_Drums", "Kick layers, clap/snare, tops, fills"],
    ["02_Bass", "Reverse bass, sub anchor, low support"],
    ["03_Leads", input.leadStyle === "hybrid" ? "Euphoric stack, screech stack, note-center layer" : `${input.leadStyle} lead stack and note-center support`],
    ["04_Music", profile.wantsCinematicWeight ? "Chords, pads, plucks, cinematic themes, transition beds" : "Chords, pads, plucks, cinematic themes"],
    ["05_FX", "Impacts, risers, reverses, tonal sweeps, transitions"],
    ["06_Vox_Story", profile.isVocalFocused ? "Featured vocal, chops, spoken layers, texture doubles" : "Vocal chops, hooks, spoken lines, texture layers"],
  ];

  const sendNotes = [
    "- **LEAD/SCREECH → FX_LONG:** large tail for breakdowns and climax transitions, automated down before drops.",
    "- **LEAD/SCREECH → FX_SHORT:** short ambience to keep presence without washing the center.",
    "- **DRUM TOPS → PARALLEL_CLIP:** only for extra bite when the drop needs more edge.",
    "- **MUSIC → DUCKED_VERB:** musical tail that sidechains harder than the dry bus.",
    "- **FX / ATMOS → DELAY_THROW:** transition-only throw for fills and pre-drop punctuation.",
  ];

  if (profile.isVocalFocused) {
    sendNotes.push("- **VOCALS / STORY → VOC_DUCKED_THROW:** short controlled throw for phrase endings only, never a constant wash through the center.");
  }

  return [
    ...renderHeader("Routing Sheet", input, generatedAt),
    "## Folder Grouping",
    "",
    markdownTable(["Folder", "Content"], folderGroups),
    "",
    "## Bus Routing",
    "",
    busTable,
    "",
    "## Sends and Returns",
    "",
    ...sendNotes,
    "",
    "## Sidechain Plan",
    "",
    "- Kick ducks SUB, reverse bass harmonics, pad sustain, long reverb return, and selected lead tails.",
    profile.isVocalFocused
      ? "- Keep the lead note-center and vocal center from colliding by using arrangement gaps and targeted rides before resorting to broad master EQ."
      : "- Keep the note-center lead layer lightly ducked so the melody still speaks through the first downbeat.",
    "- Sidechain depth should be strongest on the wet returns, not on the main harmonic body.",
    "",
    "## Gain Staging Intent",
    "",
    "- Individual audio/instrument tracks: leave enough room that bus processing is about control, not rescue.",
    "- KICK and SUB buses should feel solid before they ever hit the KICK & BASS bus.",
    "- MASTER bus should stay a checkpoint, not the place where balance problems get hidden.",
    "",
    "## Hardstyle Bus Risks to Watch",
    "",
    "- KICK & BASS bus: tok loss, tail smear, and over-glue are more dangerous than small EQ imperfections.",
    profile.isRawphoric
      ? "- LEAD / SCREECH bus: raw midrange fatigue and top-bus flattening are bigger risks than insufficient distortion."
      : "- LEAD / SCREECH bus: harshness builds faster than expected once rides, tops, and impacts enter.",
    "- FX / ATMOS bus: cinematic depth turns into mud quickly if long tails survive the drop entry.",
    profile.wantsHighDjUtility
      ? "- OUTRO / DJ utility: keep the final bars clean enough that a DJ can trust the transition information."
      : "- OUTRO: remove emotional weight gradually so the ending still feels intentional, not abruptly empty.",
    "",
    "_Generated by Fornix Studio MCP_",
  ].join("\n");
}

function renderAutomationBlueprint(input: ProductionPackageInput, generatedAt: string): string {
  const profile = resolveProfile(input);
  const rows = buildAutomationRows(input);

  return [
    ...renderHeader("Automation Blueprint", input, generatedAt),
    "## Automation Grid",
    "",
    markdownTable(
      ["Section", "Parameter", "Action", "Purpose"],
      rows.map((row) => [row.section, row.parameter, row.action, row.purpose]),
    ),
    "",
    "## Tension / Release Notes",
    "",
    profile.wantsCinematicWeight
      ? "- Build tension with transition cleanup, tonal motion, and selective tail management before adding more FX noise."
      : "- Increase tension with filter opening, send blooms, and rhythmic mutes rather than constant additive noise.",
    "- Pull reverb and delay down before major downbeats so the impact comes from contrast, not just volume.",
    profile.isRawphoric
      ? "- In anti-climax bars, automate screech aggression by phrase instead of leaving the same resonance intensity running constantly."
      : "- Let the final climax open wider than Drop 1, but keep the first four beats tighter for punch.",
    "",
    "_Generated by Fornix Studio MCP_",
  ].join("\n");
}

function buildSoundDesignRoles(input: ProductionPackageInput): SoundDesignRole[] {
  const profile = resolveProfile(input);

  const leadRole = input.leadStyle === "screech"
    ? {
        role: "Primary Screech Lead",
        synthesisDirection: "Band-pass or formant-focused screech with aggressive resonance movement and controlled distortion.",
        layering: "Mono center screech, one widened answer layer, and a quieter octave texture for width without blurring the center.",
        movement: "Macro the filter/resonance movement phrase by phrase so it talks back to the kick pattern.",
        mixPlacement: "Keep the aggressive resonances moving and automate level gaps between fills so the bus stays readable.",
      }
    : {
        role: "Primary Euphoric Lead",
        synthesisDirection: profile.isRawphoric
          ? "Hybrid saw stack with a firmer mono center, less airy wash, and tighter bite control than a pure euphoric supersaw tower."
          : "Supersaw-based stack with a clear mono note-center, bright top layer, and emotional octave support.",
        layering: profile.isRawphoric
          ? "Wider outer layer kept restrained, strong mono center, and support octave that does not flood the drop with wash."
          : "Wide supersaw, mid support saw, mono center note layer, and optional airy top texture for the climax only.",
        movement: "Use slow vibrato depth, width growth into the climax, and controlled brightness automation in builds.",
        mixPlacement: profile.isVocalFocused
          ? "Protect the hook in mono and move supporting width outward when the vocal owns the center."
          : "Protect the hook in mono and keep the brightest layer out until the final payoff.",
      };

  const hybridRole = input.leadStyle === "hybrid"
    ? [{
        role: "Hybrid Counter Lead",
        synthesisDirection: "Separate screech call-response layer that speaks between the euphoric melody phrases.",
        layering: "One center screech with a narrower support layer; no giant stereo stack needed.",
        movement: "Automate distortion and formant motion only on the answers so the melody still owns the bar.",
        mixPlacement: "Treat it like punctuation, not a constant blanket over the whole drop.",
      }]
    : [];

  const roles: SoundDesignRole[] = [
    {
      role: "Cinematic Intro Architecture",
      synthesisDirection: profile.wantsCinematicWeight
        ? "Textural impacts, reversed tonal swells, filtered theme motif, and dark atmospheres with controlled width and transition cleanup."
        : "Textural impacts, reversed tonal swells, filtered theme motif, and restrained atmospheres.",
      layering: "Low cinematic boom, mid atmosphere, top shimmer, and one motif teaser layer.",
      movement: "Slow filter reveals, reverb throws, and subtle pitch motion before the breakdown opens.",
      mixPlacement: "Keep the intro wide but light in the center so the drop still feels bigger later.",
    },
    leadRole,
    ...hybridRole,
    {
      role: "Kick / Sub Layering",
      synthesisDirection: `Dedicated tok/punch/body/tail approach with a separate mono sub or reverse bass anchor. ${profile.kickStyle}`,
      layering: "Do not ask one layer to do everything. Let the kick attack and the low anchor have different jobs.",
      movement: "Automate tail length or release around busy fills instead of over-EQing every section.",
      mixPlacement: "Mono lock the low anchor and keep saturation choices honest at matched loudness.",
    },
    {
      role: "Anti-Climax Driver",
      synthesisDirection: profile.isRawphoric
        ? "Dry aggressive screech answer or gated stab that hits between kicks without flooding the top-mid band."
        : "Dry rhythmic stab, gated tail, or screech answer that keeps the center aggressive.",
      layering: "One dominant center element plus sparse width support is usually stronger than a wall of layers.",
      movement: "Phrase-level mutes and distortion pushes are more effective than endless extra notes.",
      mixPlacement: "Prioritize kick visibility and use short spaces instead of giant tails.",
    },
    {
      role: "Drop Impact FX",
      synthesisDirection: "One impact, one tonal downlifter, and one short noise accent timed around the kick entry.",
      layering: "Choose complementing shapes, not five similar impacts stacked together.",
      movement: "Use transition-specific automation and mute extra tails before the drop lands.",
      mixPlacement: "Impact FX should widen the scene without hiding the tok or clap attack.",
    },
  ];

  if (profile.isVocalFocused) {
    roles.push({
      role: "Vocal / Story Lane",
      synthesisDirection: "Lead phrase or spoken texture with a dry intelligible center and controlled widening on phrase endings only.",
      layering: "Main vocal, support double, and one texture layer for size rather than a constant chorus cloud.",
      movement: "Automate delay/reverb throws on phrase endings and pull them back before the kick returns.",
      mixPlacement: "Reserve the center for intelligibility first; let wide support layers sit around it instead of through it.",
    });
  }

  return roles;
}

function renderSoundDesignPack(input: ProductionPackageInput, generatedAt: string): string {
  const profile = resolveProfile(input);
  const roles = buildSoundDesignRoles(input);

  const sections = roles.map((role) => [
    `## ${role.role}`,
    `- **Synthesis direction:** ${role.synthesisDirection}`,
    `- **Layering:** ${role.layering}`,
    `- **Movement:** ${role.movement}`,
    `- **Mix placement:** ${role.mixPlacement}`,
    "",
  ].join("\n"));

  return [
    ...renderHeader("Sound Design Pack", input, generatedAt),
    "## Design Roles",
    "",
    ...sections,
    "## Fornix Notes",
    "",
    profile.isRawphoric
      ? "- Let aggression come from rhythm, controlled midrange bite, and anti-climax phrasing instead of generic saturation spam."
      : "- Save the most emotional lead width for the final payoff.",
    "- Let the anti-climax speak with rhythm and restraint rather than endless extra saturation.",
    profile.wantsCinematicWeight
      ? "- Build cinematic sections from atmosphere, motif pacing, and transition cleanup, not generic EDM filler loops."
      : "- Build cinematic sections from atmosphere and motif hints, not generic EDM filler loops.",
    "",
    "_Generated by Fornix Studio MCP_",
  ].join("\n");
}

function renderProducerChecklist(input: ProductionPackageInput, generatedAt: string): string {
  const profile = resolveProfile(input);

  const checks = [
    profile.wantsCinematicWeight
      ? "Intro feels cinematic and intentional before it feels busy."
      : "Intro feels cinematic before it feels busy.",
    "Main theme is identifiable in the breakdown without full climax brightness.",
    "First drop has a clear identity: anti-climax aggression or euphoric statement, not a blurred compromise.",
    "Final drop is measurably wider, brighter, or more emotionally complete than Drop 1.",
    "Kick tok survives when the master chain is enabled at matched loudness.",
    "Sub anchor stays mono and controlled through the busiest fill sections.",
    "Lead hook still reads in mono on the final climax.",
    "Screech layers leave space between phrases instead of masking the hook continuously.",
    "Long FX tails are muted or ducked before key drop entries.",
    "Top drums add energy without flattening the groove.",
    "Routing reflects intentional bus ownership instead of random sends.",
    "Mix fixes are happening on source or bus channels before the master bus.",
  ];

  if (profile.isVocalFocused) {
    checks.push("Featured vocal or story lane stays readable in the center without losing the lead identity.");
  }

  if (profile.wantsHighDjUtility) {
    checks.push("Outro keeps enough clean drum and low-end information for a usable DJ transition.");
  }

  return [
    ...renderHeader("Producer Checklist", input, generatedAt),
    "## Pass / Fail Checks",
    "",
    ...checks.map((check) => `- [ ] ${check}`),
    "",
    "## Final Print Readiness",
    "",
    "- [ ] Breakdown, Drop 1, and Drop 2 each have their own energy identity.",
    "- [ ] Kick / sub relationship still feels locked after limiter audition.",
    profile.wantsHighDjUtility
      ? "- [ ] Outro handoff stays clean enough for club transitions and edits."
      : "- [ ] Outro keeps enough drum utility for edits, transitions, or DJ use.",
    "",
    "_Generated by Fornix Studio MCP_",
  ].join("\n");
}

function renderSectionMarkdown(
  section: PackageSectionId,
  input: ProductionPackageInput,
  generatedAt: string,
  mixActions: MixAction[],
): string {
  switch (section) {
    case "project_plan":
      return renderProjectPlan(input, generatedAt);
    case "routing":
      return renderRoutingSheet(input, generatedAt);
    case "automation":
      return renderAutomationBlueprint(input, generatedAt);
    case "mix":
      return renderMixActionsMarkdown(input.trackName, mixActions, generatedAt);
    case "sound_design":
      return renderSoundDesignPack(input, generatedAt);
    case "checklist":
      return renderProducerChecklist(input, generatedAt);
    default:
      throw new Error(`Unsupported section: ${section satisfies never}`);
  }
}

function getPackageRoot(outputDir: string, trackSlug: string): string {
  return path.join(outputDir, FORNIX_OUTPUT_ROOT, trackSlug);
}

function getMetadataPath(packageRoot: string): string {
  return path.join(packageRoot, PACKAGE_METADATA_LAYOUT.dir, PACKAGE_METADATA_LAYOUT.filename);
}

function getDocumentPath(packageRoot: string, key: PackageLayoutKey): string {
  const layout = PACKAGE_LAYOUT[key];
  return path.join(packageRoot, layout.dir, layout.filename);
}

function outputDirFromPackageRoot(packageRoot: string): string {
  return path.dirname(path.dirname(packageRoot));
}

function buildDocumentPathMap(packageRoot: string): Record<PackageLayoutKey, string> {
  return Object.fromEntries(
    ALL_LAYOUT_KEYS.map((key) => [key, getDocumentPath(packageRoot, key)]),
  ) as Record<PackageLayoutKey, string>;
}

function ensureSectionId(value: PackageSectionId): PackageSectionId {
  if (!ALL_SECTION_IDS.includes(value)) {
    throw new Error(`Unsupported package section "${value}"`);
  }
  return value;
}

function sanitizeMetadata(value: ProductionPackageMetadata): ProductionPackageMetadata {
  const resolvedProfile = value.resolvedProfile
    ? cloneSectionProfile(value.resolvedProfile)
    : undefined;
  const sectionResolvedProfiles = sanitizeSectionResolvedProfiles(value.sectionResolvedProfiles)
    ?? (resolvedProfile ? buildUniformSectionProfiles(resolvedProfile) : undefined);

  return {
    ...value,
    mixConcerns: [...(value.mixConcerns ?? [])],
    signatureHooks: [...(value.signatureHooks ?? [])],
    concerns: value.concerns ? [...value.concerns] : undefined,
    referenceNotes: value.referenceNotes ? [...value.referenceNotes] : undefined,
    updatedSections: Array.from(new Set((value.updatedSections ?? []).filter((section): section is PackageSectionId => ALL_SECTION_IDS.includes(section)))),
    sectionGoals: value.sectionGoals ? { ...value.sectionGoals } : undefined,
    resolvedProfile,
    sectionResolvedProfiles,
  };
}

function createMetadata(
  input: ProductionPackageInput,
  trackSlug: string,
  generatedAt: string,
  generatorTool: string,
  existing?: ProductionPackageMetadata,
  updatedSection?: PackageSectionId,
): ProductionPackageMetadata {
  const previous = existing ? sanitizeMetadata(existing) : null;
  const resolvedInput = buildResolvedInput(input);
  const updatedSections = new Set<PackageSectionId>(previous?.updatedSections ?? []);

  if (updatedSection) {
    updatedSections.add(updatedSection);
  } else {
    for (const section of ALL_SECTION_IDS) updatedSections.add(section);
  }

  const packageProfile = updatedSection && previous
    ? getPackageResolvedProfile(previous)
    : serializeSectionProfile(resolvedInput);

  const sectionResolvedProfiles = updatedSection && previous
    ? {
        ...(previous.sectionResolvedProfiles ?? buildUniformSectionProfiles(packageProfile)),
        [updatedSection]: serializeSectionProfile(resolvedInput),
      }
    : buildUniformSectionProfiles(packageProfile);

  return sanitizeMetadata({
    packageFormatVersion: PACKAGE_FORMAT_VERSION,
    generatorTool,
    generatorVersion: SERVER_VERSION,
    generationTimestamp: previous?.generationTimestamp ?? generatedAt,
    lastUpdatedTimestamp: generatedAt,
    updatedSections: Array.from(updatedSections),
    trackName: resolvedInput.trackName,
    trackSlug,
    artistName: resolvedInput.artistName,
    tempo: resolvedInput.tempo,
    keySignature: resolvedInput.keySignature,
    styleVariant: packageProfile.styleVariant,
    leadStyle: packageProfile.leadStyle,
    dropStrategy: packageProfile.dropStrategy,
    energyProfile: packageProfile.energyProfile,
    targetBars: resolvedInput.targetBars,
    creativeBrief: resolvedInput.creativeBrief,
    mixConcerns: resolvedInput.mixConcerns ?? [],
    signatureHooks: [...packageProfile.signatureHooks],
    mood: packageProfile.mood,
    focus: packageProfile.focus,
    concerns: [...packageProfile.concerns],
    substyle: packageProfile.substyle,
    kickStyle: packageProfile.kickStyle,
    antiClimaxStyle: packageProfile.antiClimaxStyle,
    arrangementFocus: packageProfile.arrangementFocus,
    vocalMode: packageProfile.vocalMode,
    djUtilityPriority: packageProfile.djUtilityPriority,
    referenceNotes: [...packageProfile.referenceNotes],
    sectionGoals: { ...packageProfile.sectionGoals },
    cinematicIntensity: packageProfile.cinematicIntensity,
    aggressionLevel: packageProfile.aggressionLevel,
    emotionalTone: packageProfile.emotionalTone,
    resolvedProfile: cloneSectionProfile(packageProfile),
    sectionResolvedProfiles,
  });
}

function metadataToInput(metadata: ProductionPackageMetadata, outputDir: string): ProductionPackageInput {
  const packageProfile = getPackageResolvedProfile(metadata);

  return {
    outputDir,
    trackName: metadata.trackName,
    artistName: metadata.artistName,
    tempo: metadata.tempo,
    keySignature: metadata.keySignature,
    styleVariant: packageProfile.styleVariant,
    leadStyle: packageProfile.leadStyle,
    dropStrategy: packageProfile.dropStrategy,
    energyProfile: packageProfile.energyProfile,
    targetBars: metadata.targetBars,
    creativeBrief: metadata.creativeBrief,
    mixConcerns: [...metadata.mixConcerns],
    signatureHooks: [...packageProfile.signatureHooks],
    mood: packageProfile.mood,
    focus: packageProfile.focus,
    concerns: [...packageProfile.concerns],
    substyle: packageProfile.substyle,
    kickStyle: packageProfile.kickStyle,
    antiClimaxStyle: packageProfile.antiClimaxStyle,
    arrangementFocus: packageProfile.arrangementFocus,
    vocalMode: packageProfile.vocalMode,
    djUtilityPriority: packageProfile.djUtilityPriority,
    referenceNotes: [...packageProfile.referenceNotes],
    sectionGoals: { ...packageProfile.sectionGoals },
    cinematicIntensity: packageProfile.cinematicIntensity,
    aggressionLevel: packageProfile.aggressionLevel,
    emotionalTone: packageProfile.emotionalTone,
  };
}

function mergeInputOverMetadata(
  metadata: ProductionPackageMetadata,
  updates: Partial<Omit<RegeneratePackageSectionInput, "packagePath" | "section" | "trackSlug" | "outputDir">>,
  outputDir: string,
): ProductionPackageInput {
  const base = metadataToInput(metadata, outputDir);

  return buildResolvedInput({
    ...base,
    ...updates,
    outputDir,
    trackName: updates.trackName ?? metadata.trackName,
    artistName: updates.artistName ?? metadata.artistName,
    tempo: updates.tempo ?? metadata.tempo,
    keySignature: updates.keySignature ?? metadata.keySignature,
    styleVariant: updates.styleVariant ?? base.styleVariant,
    leadStyle: updates.leadStyle ?? base.leadStyle,
    dropStrategy: updates.dropStrategy ?? base.dropStrategy,
    energyProfile: updates.energyProfile ?? base.energyProfile,
    targetBars: updates.targetBars ?? metadata.targetBars,
    creativeBrief: updates.creativeBrief ?? metadata.creativeBrief,
    mixConcerns: updates.mixConcerns ?? metadata.mixConcerns,
    signatureHooks: updates.signatureHooks ?? base.signatureHooks,
    mood: updates.mood ?? base.mood,
    focus: updates.focus ?? base.focus,
    concerns: updates.concerns ?? base.concerns,
    substyle: updates.substyle ?? base.substyle,
    kickStyle: updates.kickStyle ?? base.kickStyle,
    antiClimaxStyle: updates.antiClimaxStyle ?? base.antiClimaxStyle,
    arrangementFocus: updates.arrangementFocus ?? base.arrangementFocus,
    vocalMode: updates.vocalMode ?? base.vocalMode,
    djUtilityPriority: updates.djUtilityPriority ?? base.djUtilityPriority,
    referenceNotes: updates.referenceNotes ?? base.referenceNotes,
    sectionGoals: updates.sectionGoals ?? base.sectionGoals,
    cinematicIntensity: updates.cinematicIntensity ?? base.cinematicIntensity,
    aggressionLevel: updates.aggressionLevel ?? base.aggressionLevel,
    emotionalTone: updates.emotionalTone ?? base.emotionalTone,
  });
}

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

function getChangedProfileFields(
  metadata: ProductionPackageMetadata,
  nextInput: ProductionPackageInput,
): PackageProfileFieldChange[] {
  return diffPackageProfile(metadata, nextInput);
}

function getMetadataUpdatedFields(
  previous: ProductionPackageMetadata,
  next: ProductionPackageMetadata,
): string[] {
  const keys = Array.from(new Set([
    ...Object.keys(previous),
    ...Object.keys(next),
  ])).sort();

  const changed = keys.filter((key) => {
    const previousValue = normalizeComparableValue(previous[key as keyof ProductionPackageMetadata]);
    const nextValue = normalizeComparableValue(next[key as keyof ProductionPackageMetadata]);
    return JSON.stringify(previousValue) !== JSON.stringify(nextValue);
  });

  const previousSections = previous.sectionResolvedProfiles ?? {};
  const nextSections = next.sectionResolvedProfiles ?? {};
  for (const section of ALL_SECTION_IDS) {
    const previousProfile = previousSections[section];
    const nextProfile = nextSections[section];
    if (JSON.stringify(normalizeComparableValue(previousProfile)) !== JSON.stringify(normalizeComparableValue(nextProfile))) {
      changed.push(`sectionResolvedProfiles.${section}`);
    }
  }

  return Array.from(new Set(changed)).sort();
}

function buildPackageUpdatePlan(
  metadata: ProductionPackageMetadata,
  nextInput: ProductionPackageInput,
): PackageUpdatePlan {
  const changes = getChangedProfileFields(metadata, nextInput);
  return planPackageSections(changes);
}

function readMetadataFile(metadataPath: string): ProductionPackageMetadata | null {
  if (!fs.existsSync(metadataPath)) return null;

  const parsed = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as Partial<ProductionPackageMetadata>;
  if (!parsed.trackSlug && parsed.trackName) {
    parsed.trackSlug = slugifyTrackName(parsed.trackName);
  }

  if (!parsed.trackName && parsed.trackSlug) {
    parsed.trackName = titleCaseSlug(parsed.trackSlug);
  }

  const generatedAt = parsed.generationTimestamp ?? new Date().toISOString();
  const metadata = sanitizeMetadata({
    packageFormatVersion: parsed.packageFormatVersion ?? PACKAGE_FORMAT_VERSION,
    generatorTool: parsed.generatorTool ?? PACKAGE_GENERATOR_TOOL,
    generatorVersion: parsed.generatorVersion ?? SERVER_VERSION,
    generationTimestamp: generatedAt,
    lastUpdatedTimestamp: parsed.lastUpdatedTimestamp ?? generatedAt,
    updatedSections: parsed.updatedSections ?? [],
    trackName: parsed.trackName ?? "Unknown Track",
    trackSlug: parsed.trackSlug ?? slugifyTrackName(parsed.trackName ?? "unknown-track"),
    artistName: parsed.artistName ?? "Fornix",
    tempo: parsed.tempo ?? 150,
    keySignature: parsed.keySignature ?? "F# minor",
    styleVariant: parsed.styleVariant ?? "cinematic-euphoric",
    leadStyle: parsed.leadStyle ?? "hybrid",
    dropStrategy: parsed.dropStrategy ?? "anti-climax-to-melodic",
    energyProfile: parsed.energyProfile ?? "steady-escalation",
    targetBars: parsed.targetBars ?? 160,
    creativeBrief: parsed.creativeBrief,
    mixConcerns: parsed.mixConcerns ?? [],
    signatureHooks: parsed.signatureHooks ?? [],
    mood: parsed.mood,
    focus: parsed.focus,
    concerns: parsed.concerns,
    substyle: parsed.substyle,
    kickStyle: parsed.kickStyle,
    antiClimaxStyle: parsed.antiClimaxStyle,
    arrangementFocus: parsed.arrangementFocus,
    vocalMode: parsed.vocalMode,
    djUtilityPriority: parsed.djUtilityPriority,
    referenceNotes: parsed.referenceNotes,
    sectionGoals: parsed.sectionGoals,
    cinematicIntensity: parsed.cinematicIntensity,
    aggressionLevel: parsed.aggressionLevel,
    emotionalTone: parsed.emotionalTone,
    resolvedProfile: parsed.resolvedProfile,
    sectionResolvedProfiles: parsed.sectionResolvedProfiles,
  });

  if (metadata.resolvedProfile && metadata.sectionResolvedProfiles) {
    return metadata;
  }

  const fallbackProfile = serializeSectionProfile(metadata);
  return sanitizeMetadata({
    ...metadata,
    styleVariant: fallbackProfile.styleVariant,
    leadStyle: fallbackProfile.leadStyle,
    dropStrategy: fallbackProfile.dropStrategy,
    energyProfile: fallbackProfile.energyProfile,
    signatureHooks: [...fallbackProfile.signatureHooks],
    mood: fallbackProfile.mood,
    focus: fallbackProfile.focus,
    concerns: [...fallbackProfile.concerns],
    substyle: fallbackProfile.substyle,
    kickStyle: fallbackProfile.kickStyle,
    antiClimaxStyle: fallbackProfile.antiClimaxStyle,
    arrangementFocus: fallbackProfile.arrangementFocus,
    vocalMode: fallbackProfile.vocalMode,
    djUtilityPriority: fallbackProfile.djUtilityPriority,
    referenceNotes: [...fallbackProfile.referenceNotes],
    sectionGoals: { ...fallbackProfile.sectionGoals },
    cinematicIntensity: fallbackProfile.cinematicIntensity,
    aggressionLevel: fallbackProfile.aggressionLevel,
    emotionalTone: fallbackProfile.emotionalTone,
    resolvedProfile: cloneSectionProfile(fallbackProfile),
    sectionResolvedProfiles: buildUniformSectionProfiles(fallbackProfile),
  });
}

function writeMetadataFile(metadataPath: string, metadata: ProductionPackageMetadata): void {
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n", "utf8");
}

function resolvePackageRoot(locator: PackageLocatorInput): string {
  if (locator.packagePath) {
    return locator.packagePath;
  }

  const trackSlug = locator.trackSlug ?? (locator.trackName ? slugifyTrackName(locator.trackName) : null);
  if (!locator.outputDir || !trackSlug) {
    throw new Error("Provide packagePath or outputDir with trackName/trackSlug to locate a package.");
  }

  return getPackageRoot(locator.outputDir, trackSlug);
}

function buildDocumentStates(packageRoot: string): Record<PackageSectionId, PackageDocumentState> {
  return Object.fromEntries(
    ALL_SECTION_IDS.map((sectionId) => {
      const layoutInfo = SECTION_LAYOUT_BY_ID[sectionId];
      const filePath = getDocumentPath(packageRoot, layoutInfo.key);
      const exists = fs.existsSync(filePath);
      const lastModifiedTimestamp = exists ? fs.statSync(filePath).mtime.toISOString() : null;

      return [sectionId, {
        id: sectionId,
        label: layoutInfo.label,
        path: filePath,
        exists,
        lastModifiedTimestamp,
      }];
    }),
  ) as Record<PackageSectionId, PackageDocumentState>;
}

export function getPackageSummary(locator: PackageLocatorInput): ProductionPackageSummary {
  const packageRoot = resolvePackageRoot(locator);
  const trackSlug = locator.trackSlug ?? slugifyTrackName(locator.trackName ?? path.basename(packageRoot));
  const metadataPath = getMetadataPath(packageRoot);
  const metadata = readMetadataFile(metadataPath);
  const documents = buildDocumentStates(packageRoot);
  const existingDocuments = ALL_SECTION_IDS.filter((sectionId) => documents[sectionId].exists);
  const missingDocuments = ALL_SECTION_IDS.filter((sectionId) => !documents[sectionId].exists);
  const overriddenSections = getOverriddenSections(metadata);
  const { packageCompleteness, packageHealth, packageConsistencySummary } = describePackageHealth(
    Boolean(metadata),
    missingDocuments.length,
    overriddenSections,
  );

  return {
    packageRoot,
    trackSlug: metadata?.trackSlug ?? trackSlug,
    packagePath: packageRoot,
    packageFormatVersion: metadata?.packageFormatVersion ?? null,
    metadataPath,
    metadataExists: Boolean(metadata),
    metadata,
    documents,
    existingDocuments,
    missingDocuments,
    complete: Boolean(metadata) && missingDocuments.length === 0,
    packageCompleteness,
    hasSectionOverrides: overriddenSections.length > 0,
    overriddenSections,
    packageHealth,
    packageConsistencySummary,
    generationTimestamp: metadata?.generationTimestamp ?? null,
    lastUpdatedTimestamp: metadata?.lastUpdatedTimestamp ?? null,
  };
}


export function previewPackageUpdate(input: PreviewPackageUpdateInput): PackageUpdatePreviewResult {
  const packageRoot = resolvePackageRoot(input);
  const packageSummary = getPackageSummary({ packagePath: packageRoot });

  if (!packageSummary.metadata) {
    throw new Error("Package metadata is missing. Generate the package first so update preview can stay honest.");
  }

  const outputDir = outputDirFromPackageRoot(packageRoot);
  const mergedInput = mergeInputOverMetadata(packageSummary.metadata, input, outputDir);
  const plan = buildPackageUpdatePlan(packageSummary.metadata, mergedInput);
  const wouldIntroduceSectionOverrides = plan.changedProfileFields.length > 0 && !packageSummary.hasSectionOverrides;
  const wouldLeaveSectionOverrides = packageSummary.hasSectionOverrides;
  const overrideImpactSummary = plan.changedProfileFields.length === 0
    ? "No profile changes detected; no section override impact."
    : packageSummary.hasSectionOverrides
      ? "Package-level profile would remain unchanged and existing section overrides would remain until the remaining recommended sections are regenerated."
      : "Package-level profile would remain unchanged; regenerating only selected sections would introduce section overrides until the remaining recommended sections are regenerated.";

  return {
    packageRoot,
    targetPackagePath: packageRoot,
    metadataPath: packageSummary.metadataPath,
    packageSummary,
    currentPackageComplete: packageSummary.complete,
    metadataWouldChange: plan.changedProfileFields.length > 0,
    hasSectionOverrides: packageSummary.hasSectionOverrides,
    overriddenSections: packageSummary.overriddenSections,
    packageCompleteness: packageSummary.packageCompleteness,
    packageHealth: packageSummary.packageHealth,
    packageConsistencySummary: packageSummary.packageConsistencySummary,
    packageLevelProfileWouldChange: false,
    wouldIntroduceSectionOverrides,
    wouldLeaveSectionOverrides,
    overrideImpactSummary,
    ...plan,
  };
}

export function planPackageUpdate(input: PreviewPackageUpdateInput): PackageUpdatePlanResult {
  return previewPackageUpdate(input);
}

export function buildProductionPackageContents(input: ProductionPackageInput): Omit<ProductionPackageResult, "packageRoot" | "metadataPath" | "metadata"> & {
  packageRoot: string;
  metadataPath: string;
  metadata: ProductionPackageMetadata;
  filesContent: Record<PackageLayoutKey, string>;
} {
  const generatedAt = new Date().toISOString();
  const resolvedInput = buildResolvedInput(input);
  const trackSlug = slugifyTrackName(resolvedInput.trackName);
  const packageRoot = getPackageRoot(resolvedInput.outputDir, trackSlug);
  const metadataPath = getMetadataPath(packageRoot);
  const mixActions = buildMixActions(resolvedInput);

  const filesContent: Record<PackageLayoutKey, string> = {
    projectPlan: renderProjectPlan(resolvedInput, generatedAt),
    routing: renderRoutingSheet(resolvedInput, generatedAt),
    automation: renderAutomationBlueprint(resolvedInput, generatedAt),
    mix: renderMixActionsMarkdown(resolvedInput.trackName, mixActions, generatedAt),
    soundDesign: renderSoundDesignPack(resolvedInput, generatedAt),
    checklists: renderProducerChecklist(resolvedInput, generatedAt),
  };

  const files = buildDocumentPathMap(packageRoot);
  const metadata = createMetadata(resolvedInput, trackSlug, generatedAt, PACKAGE_GENERATOR_TOOL);

  return { packageRoot, trackSlug, filesContent, files, metadataPath, metadata, mixActions };
}

export function writeProductionPackage(input: ProductionPackageInput): ProductionPackageResult {
  const { packageRoot, files, filesContent, mixActions, trackSlug, metadataPath, metadata } = buildProductionPackageContents(input);

  // Workspace provenance: if outputDir has a workspace.json, record the workspace name.
  if (workspaceExists(input.outputDir)) {
    try {
      const ws = readWorkspace(input.outputDir);
      metadata.workspaceRef = ws.name;
    } catch {
      // Non-fatal — workspace detection is best-effort.
    }
  }

  fs.mkdirSync(packageRoot, { recursive: true });

  for (const [key, filePath] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, filesContent[key as PackageLayoutKey], "utf8");
  }

  writeMetadataFile(metadataPath, metadata);

  return { packageRoot, trackSlug, files, metadataPath, metadata, mixActions };
}

export function regenerateProductionPackageSection(input: RegeneratePackageSectionInput): RegeneratePackageSectionResult {
  const section = ensureSectionId(input.section);
  const packageRoot = resolvePackageRoot(input);
  const summary = getPackageSummary({ packagePath: packageRoot });

  if (!summary.metadata) {
    throw new Error("Package metadata is missing. Generate the package first so selective regeneration can stay honest.");
  }

  const outputDir = outputDirFromPackageRoot(packageRoot);
  const mergedInput = mergeInputOverMetadata(summary.metadata, input, outputDir);
  const generatedAt = new Date().toISOString();
  const plan = buildPackageUpdatePlan(summary.metadata, mergedInput);
  const sectionPlan = getSectionPlanForSection(section, plan);
  const mixActions = buildMixActions(mergedInput);
  const layoutKey = SECTION_LAYOUT_BY_ID[section].key;
  const updatedFile = getDocumentPath(packageRoot, layoutKey);
  const markdown = renderSectionMarkdown(section, mergedInput, generatedAt, mixActions);

  fs.mkdirSync(path.dirname(updatedFile), { recursive: true });
  fs.writeFileSync(updatedFile, markdown, "utf8");

  const metadata = createMetadata(
    mergedInput,
    summary.metadata.trackSlug,
    generatedAt,
    PACKAGE_REGEN_TOOL,
    summary.metadata,
    section,
  );
  const metadataPath = getMetadataPath(packageRoot);
  writeMetadataFile(metadataPath, metadata);

  const packageSummary = getPackageSummary({ packagePath: packageRoot });
  const untouchedFiles = ALL_LAYOUT_KEYS
    .filter((key) => key !== layoutKey)
    .map((key) => getDocumentPath(packageRoot, key))
    .filter((filePath) => fs.existsSync(filePath));
  const metadataUpdatedFields = getMetadataUpdatedFields(summary.metadata, metadata);

  return {
    packageRoot,
    packageSummary,
    updatedSection: section,
    updatedFile,
    untouchedFiles,
    metadataPath,
    metadata,
    mixActions,
    changedProfileFields: plan.changedProfileFields,
    sectionJustifyingProfileFields: sectionPlan?.changedFields ?? [],
    updatedSectionPriority: sectionPlan?.priority ?? null,
    sectionRecommendationReasons: sectionPlan?.reasons ?? [],
    remainingRecommendedSections: plan.recommendedSections.filter((sectionId) => sectionId !== section),
    metadataUpdatedFields,
    packageLevelProfileRemainsUnchanged: true,
    hasSectionOverridesAfterUpdate: packageSummary.hasSectionOverrides,
    overriddenSectionsAfterUpdate: packageSummary.overriddenSections,
    packageHealthAfterUpdate: packageSummary.packageHealth,
    packageConsistencySummaryAfterUpdate: packageSummary.packageConsistencySummary,
  };
}

// ─── Batch regeneration ─────────────────────────────────────────────────────────

export const PACKAGE_BATCH_REGEN_TOOL = "fornix_batch_regenerate_package";

export interface BatchRegenerateInput extends Partial<Omit<ProductionPackageInput, "outputDir">> {
  outputDir?: string;
  packagePath?: string;
  trackSlug?: string;
  sections?: PackageSectionId[];
}

export interface BatchRegenerateResult {
  packageRoot: string;
  regeneratedSections: PackageSectionId[];
  skippedSections: PackageSectionId[];
  updatedFiles: string[];
  metadataPath: string;
  metadata: ProductionPackageMetadata;
  packageSummary: ProductionPackageSummary;
  changedProfileFields: PackageProfileFieldChange[];
}

export function batchRegeneratePackage(input: BatchRegenerateInput): BatchRegenerateResult {
  const packageRoot = resolvePackageRoot(input);
  const summary = getPackageSummary({ packagePath: packageRoot });

  if (!summary.metadata) {
    throw new Error("Package metadata is missing. Generate the package first so batch regeneration can stay honest.");
  }

  const outputDir = outputDirFromPackageRoot(packageRoot);
  const mergedInput = mergeInputOverMetadata(summary.metadata, input, outputDir);
  const plan = buildPackageUpdatePlan(summary.metadata, mergedInput);

  // If caller specified sections, use those; otherwise use recommended from the plan.
  const targetSections = input.sections?.length
    ? input.sections.map(ensureSectionId)
    : plan.recommendedSections.length > 0
      ? plan.recommendedSections
      : ALL_SECTION_IDS;

  const regeneratedSections: PackageSectionId[] = [];
  const skippedSections: PackageSectionId[] = [];
  const updatedFiles: string[] = [];
  const generatedAt = new Date().toISOString();
  const mixActions = buildMixActions(mergedInput);

  let currentMetadata = summary.metadata;

  for (const section of targetSections) {
    const layoutKey = SECTION_LAYOUT_BY_ID[section].key;
    const filePath = getDocumentPath(packageRoot, layoutKey);

    try {
      const markdown = renderSectionMarkdown(section, mergedInput, generatedAt, mixActions);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, markdown, "utf8");

      currentMetadata = createMetadata(
        mergedInput,
        currentMetadata.trackSlug,
        generatedAt,
        PACKAGE_BATCH_REGEN_TOOL,
        currentMetadata,
        section,
      );

      regeneratedSections.push(section);
      updatedFiles.push(filePath);
    } catch {
      skippedSections.push(section);
    }
  }

  const metadataPath = getMetadataPath(packageRoot);
  writeMetadataFile(metadataPath, currentMetadata);

  return {
    packageRoot,
    regeneratedSections,
    skippedSections,
    updatedFiles,
    metadataPath,
    metadata: currentMetadata,
    packageSummary: getPackageSummary({ packagePath: packageRoot }),
    changedProfileFields: plan.changedProfileFields,
  };
}
