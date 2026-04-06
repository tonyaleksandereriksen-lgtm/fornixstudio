
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
  targetPlatform?: "festival" | "streaming" | "beatport" | "dj-set" | "sync";
  albumPosition?: number;
  albumContext?: string;
}

export interface MixAction {
  section: string;
  likelyIssue: string;
  whyItMatters: string;
  actionToTest: string;
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
  energyProfile: EnergyProfile;
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
    energyProfile: input.energyProfile,
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
  const leadBus = profile.isRawphoric ? "LEAD / SCREECH" : "LEAD / SCREECH";

  // ── Kick bus insert intent ─────────────────────────────────────────────────

  const kickInserts = profile.aggressionLevel === "high"
    ? "Transient and tail on separate channels — never merge before KICK_BUS. Tail chain (4–6 stages): Pro-Q 3 (HPF 30–40 Hz, boost 400–900 Hz +12–15 dB, 24 dB/oct slope) → clip distortion (60–85% drive, minimum-phase) → Pro-Q 3 (cut 300 Hz –2 dB, cut 1.4 kHz –3 dB, boost 3–5 kHz +2 dB) → tube saturation (30–50%) → Pro-Q 3 (refine) → tape saturation (15–25%) → hard clipper 0 dBFS. Transient channel: HPF 80 Hz, presence boost 4–8 kHz only."
    : "Transient and tail processed separately. Tail chain (2–3 stages): Pro-Q 3 (HPF 30 Hz, boost 400–800 Hz +8–12 dB) → clip distortion (45–65% drive) → Pro-Q 3 (cut 300 Hz –2 dB, boost 3–4 kHz +1.5 dB) → tube saturation (15–25%) → hard clipper 0 dBFS. Transient channel: HPF 80 Hz, light presence boost only.";

  const kickRisk = profile.aggressionLevel === "high"
    ? "Tok loss and tail smear are the primary risks at high aggression — each distortion stage must be followed by an EQ stage or harmonics compound uncontrollably. Over-glue on KICK & BASS bus destroys transient snap. Sub collision at 50–160 Hz with reverse bass: multiband SC on BASS_BUS, band 20–150 Hz, ratio ∞:1, attack 0 ms, release 80 ms, range –18 dB."
    : "Tok definition loss from insufficient transient layer separation. Sub collision at 50–160 Hz: multiband SC on BASS_BUS, band 20–150 Hz, –12 dB range. Over-compression on KICK & BASS bus flattens tok impact.";

  // ── Lead/Screech bus insert intent ────────────────────────────────────────

  const leadInserts = profile.isRawphoric
    ? "Pro-Q 3 (HPF 150–200 Hz, dynamic cut at 800 Hz if nasal, boost 2.5–4 kHz +2 dB) → Pro-MB (800 Hz–2 kHz: –2 to –4 dB GR, 2 kHz–6 kHz: –1 to –2 dB GR, controls harshness dynamically) → Saturn 2 hard clip (25–45% drive, adds aggression) → Pro-Q 3 (shape post-distortion harmonics, notch resonances above 5 kHz) → Pro-C 2 sidechain from kick (–6 to –10 dB GR, rhythmic gating). Send to REVERB_SCREECH (short plate, 0.6–1.2s, HPF 400 Hz on return, sidechained)."
    : "Pro-Q 3 (HPF 80–120 Hz, cut 200–400 Hz –2 dB, boost 3–5 kHz +1.5 dB) → Pro-C 2 (2:1, attack 8–15 ms, release 80–150 ms, –2 to –3 dB GR) → Saturn 2 tube (10–20% drive) → stereo widener (mono below 200 Hz, widen sides above 2 kHz) → Pro-C 2 sidechain from kick (–8 to –14 dB GR, attack 0.1–1 ms, release 150–300 ms). Reverb send: hall 1.5–2.5s. Delay send: dotted 1/8 (300 ms at 150 BPM), LPF 3 kHz on return.";

  const leadRisk = profile.isRawphoric
    ? "Screech vs kick mid-character collision at 400 Hz–4 kHz: apply dynamic EQ on LEAD_BUS, external sidechain from kick, –3 to –5 dB at 500–800 Hz, attack 0 ms, release 80 ms. Screech vs euphoric lead at 2–4 kHz: if leadStyle is hybrid, apply dynamic EQ on SCREECH_BUS, SC from LEAD_BUS, –2 to –3 dB at 2.5–3.5 kHz when lead is sounding. Raw midrange fatigue builds fast at high aggressionLevel — Pro-MB multiband control is mandatory, not optional."
    : "Harshness accumulates at 2–5 kHz once reverb returns, drum tops, and impacts enter at the drop. Stereo widener must enforce mono below 200 Hz — violation causes phase cancellation on mono playback. Lead vs vocal collision at 1.5–3 kHz: dynamic EQ on LEAD_BUS triggered by vocal, –3 dB at 2 kHz when vocal is singing.";

  // ── Orchestral bus ────────────────────────────────────────────────────────

  const orchInserts = profile.wantsCinematicWeight
    ? "Strings sub-bus: Pro-Q 3 HPF 60 Hz, presence +1 dB at 3–5 kHz, Saturn 2 tape (10% drive). Brass sub-bus: Pro-Q 3 HPF 80 Hz, cut 2–3 kHz –2 dB (de-harsh), Saturn 2 tube (8% drive). Choir sub-bus: de-ess 5–8 kHz (–3 to –5 dB), HPF 120 Hz, cut low-mid 200–400 Hz. Master ORCH_BUS: Pro-Q 3 corrective (HPF 60 Hz, broad tonal balance), Pro-MB light (1–2 dB GR max), Saturn 2 tape (8–12% drive — bridges orchestral and electronic worlds), sidechain from kick (–1 to –3 dB GR, slow attack 15–25 ms, release 200 ms)."
    : "ORCH_BUS (accents only): Pro-Q 3 HPF 80 Hz, Saturn 2 tape (5–8% drive), sidechain from kick (–1 to –2 dB GR). Reverb send: REVERB_ORCH_HALL (decay 2.5–3.5s).";

  const orchRisk = profile.wantsCinematicWeight
    ? "Orchestral/lead masking at 400 Hz–2 kHz: complementary EQ — boost orchestral strings at 600 Hz–1 kHz, cut pads at same frequency. Orchestral bus must sidechain from kick (slow attack) or cinematic depth washes the drop completely. Long reverb tails from REVERB_ORCH_HALL must be hard-muted 1 beat before each drop entry."
    : "Orchestral accents sitting too high in the mix create mud at 200–600 Hz during drops. HPF aggressively at 80–100 Hz; keep orchestral content below –14 dBFS during drops.";

  // ── Master bus ────────────────────────────────────────────────────────────

  const masterInserts = "At mix stage (allowed): Pro-Q 3 corrective (±1.5 dB max moves), SSL-style glue compressor (2:1, attack 3 ms, auto release, –1 to –2 dB GR only), spectrum analyser for reference comparison. At mastering stage (added for print): Pro-Q 3 M/S (Side HPF 150 Hz), Pro-MB (multiband dynamics, –2 to –3 dB GR per band), soft clipper (–1 to –2 dB below ceiling), Pro-L 2 (Aggressive style for rawphoric / Modern for cinematic, 4× oversampling, –0.3 dBTP ceiling for club, –1.0 dBTP for streaming). Gain staging checkpoint: if Pro-L 2 shows >2–3 dB GR during mixing, the mix is too loud upstream — fix source levels, do not compensate with the limiter.";

  const buses: RoutingBus[] = [
    {
      bus: "KICK",
      sources: "Kick transient layer, kick tail/body layer, kick sub reinforcement",
      insertsIntent: kickInserts,
      risk: kickRisk,
    },
    {
      bus: "SUB / REVERSE BASS",
      sources: "Reverse bass, sub anchor, low support elements",
      insertsIntent: `Pro-Q 3 (HPF 30–35 Hz, LPF 1.5–2 kHz pre-distortion) → Saturn 2 waveshaping (40–70% drive) → Pro-Q 3 (boost 400–600 Hz +3–5 dB, cut 250 Hz –2 dB) → Saturn 2 tube (15–25% drive) → Pro-Q 3 final (HPF 50 Hz, LPF 1.5 kHz) → Pro-C 2 sidechain from kick (attack 0.1–1 ms, release ${profile.aggressionLevel === "high" ? "80–120 ms" : "120–180 ms"}, ratio ∞:1, –12 to –18 dB GR). Sub content: mono-enforce below 120 Hz with Pro-Q 3 M/S HPF on Side channel.`,
      risk: "Sub collision at 50–160 Hz with kick fundamental (40–80 Hz): multiband sidechain on SUB_BUS, band 20–150 Hz, range –18 to –24 dB. Everything below 120 Hz must be mono — verify with correlation meter. Reverse bass root must match kick tail pitch and key signature.",
    },
    {
      bus: "KICK & BASS",
      sources: "KICK bus + SUB/REVERSE BASS bus",
      insertsIntent: `Glue compressor only (SSL-style, 2:1, attack 3 ms, auto release, –1 to –2 dB GR maximum). Final kick/sub balance at this stage. Peak target: –6 to –3 dBFS before hitting master bus. Do not add EQ or distortion here — all shaping belongs upstream on the individual buses.`,
      risk: "Over-compressing this bus eliminates tok impact and exaggerates tail pumping. More than –2 dB GR here means the problem is upstream — reduce individual bus levels rather than compressing harder. Tok definition must survive at matched loudness with master chain enabled.",
    },
    {
      bus: leadBus,
      sources: input.leadStyle === "hybrid"
        ? "Euphoric lead stack, screech counter layer, note-center mono layer"
        : input.leadStyle === "screech"
        ? "Screech lead, answer layer, octave texture"
        : "Supersaw layers, mid-weight support, mono center note layer",
      insertsIntent: leadInserts,
      risk: leadRisk,
    },
    {
      bus: "MUSIC",
      sources: "Chords, pads, plucks, and cinematic theme elements",
      insertsIntent: `Pro-Q 3 (HPF 80–100 Hz, cut 200–400 Hz –2 dB to prevent low-mid mud during drops) → stereo widener (mono below 200 Hz) → Pro-C 2 sidechain from kick (–4 to –8 dB GR, slow attack 10–20 ms, release 150–250 ms). Reverb send: MUSIC → DUCKED_VERB (hall, decay 2–3s, sidechains harder than the dry bus). LPF automation: close to 800–1 kHz at drop entry using step automation, open to full range at breakdown entry over 2 bars using exponential curve.`,
      risk: "If MUSIC bus stays wide and wet during drops, the center loses punch and lead melody focus. Enforce step automation to close filters at drop entry. Pad vs vocal collision at 1–4 kHz: EQ pad with –3 to –5 dB at 1.5–3 kHz wide bell (Q 0.8–1.5) or use dynamic EQ triggered by vocal.",
    },
    {
      bus: "DRUM TOPS",
      sources: "Clap, snare, hats, rides, fills, tops",
      insertsIntent: "Pro-Q 3 (HPF 200–300 Hz, cut 500–800 Hz –1 to –2 dB if clap is fighting kick tail, air shelf +1 dB at 10–12 kHz) → transient shaper (attack +2 dB, sustain –3 dB) → Pro-C 2 (3:1, attack 2–5 ms, release 80–150 ms, –2 to –3 dB GR). Optional parallel clip send (DRUM TOPS → PARALLEL_CLIP): only for extra bite at high-density drops, at –8 to –12 dB relative to dry.",
      risk: "Too much top-bus limiting makes the anti-climax feel flat — the drum tops must retain snap and energy during the rawphoric section. Snare/clap sitting at 200–500 Hz: notch kick tail at the same range, or notch the clap. Never both — one must own the frequency.",
    },
  ];

  if (profile.wantsCinematicWeight) {
    buses.push({
      bus: "ORCHESTRAL",
      sources: "Strings sub-bus, brass sub-bus, choir sub-bus, orchestral percussion",
      insertsIntent: orchInserts,
      risk: orchRisk,
    });
  }

  buses.push({
    bus: "FX / ATMOS",
    sources: "Impacts, downlifters, uplifters, reverses, risers, cinematic tails, drones, pads",
    insertsIntent: "Spatial management only — no compression. Pro-Q 3 HPF 60 Hz. Hard-mute long tails 1 beat before each drop using step automation. Send: FX/ATMOS → DELAY_THROW (transition-only, 1/4 note delay, phrase-end automation). Reverb returns for atmospheres: REVERB_HALL (decay 3–5s for breakdowns), HPF 80 Hz on return, LPF 12 kHz on return, sidechain from kick (–2 to –4 dB GR, slow attack).",
    risk: "This bus washes the arrangement if long reverb tails survive drop entries. Hard step automation on reverb returns is mandatory. Riser stereo width: automate 100% → 0% (mono) in final 2 beats before drop for width contrast effect.",
  });

  if (profile.isVocalFocused) {
    buses.push({
      bus: "VOCALS / STORY",
      sources: "Lead vocal, spoken texture, chops, support doubles, choir",
      insertsIntent: `HPF 120 Hz → Pro-DS (de-ess 6.5 kHz, –6 dB range) → Pro-C 2 (3:1–4:1, attack 5–8 ms, release 60–100 ms, –4 to –6 dB GR) → pitch correction → Pro-Q 3 (cut 200 Hz –2 dB, boost 3–5 kHz +2 dB) → stereo widener (mono below 800 Hz). Send to VOC_DUCKED_THROW (1/4 note delay, LPF 3 kHz, –12 dB send level, phrase-end automation). Dynamic EQ on LEAD_BUS triggered by VOCALS: –3 dB at 1.5–3 kHz when vocal is above –18 dBFS.`,
      risk: "Competing lead mids bury the vocal at 1.5–3 kHz. If dynamic EQ is not sufficient, arrange vocal and lead so they do not overlap rhythmically. Intelligibility check: mono playback at conversation volume — vocal must still be understandable. Wide support layers collapse to center in mono, causing level jump — keep all support layers below –10 dB relative to lead vocal.",
    });
  }

  buses.push({
    bus: "MASTER",
    sources: "All buses",
    insertsIntent: masterInserts,
    risk: `If Pro-L 2 shows more than 2–3 dB GR during drop sections, the mix has a gain staging problem — reduce upstream bus levels rather than pushing the limiter harder. Master bus target before limiter: peaks –6 to –3 dBFS. Target LUFS after limiter: ${profile.isRawphoric ? "–4 to –5 LUFS (club/festival)" : profile.wantsCinematicWeight ? "–5 to –7 LUFS (club/festival), –13 to –15 LUFS (streaming)" : "–5 to –6 LUFS"}. True peak ceiling: –0.3 dBTP (club), –1.0 dBTP (streaming).`,
  });

  return buses;
}

function buildAutomationRows(input: ProductionPackageInput): AutomationRow[] {
  const profile = resolveProfile(input);
  const leadTarget = input.leadStyle === "screech" ? "SCREECH bus distortion drive" : "LEAD bus high-shelf";

  // ── Utility ───────────────────────────────────────────────────────────────

  const filterOpenCurve = profile.energyProfile === "patient-cinematic" ? "exponential over 32 bars" : "exponential over 16 bars";
  const reverbBuildLevel = profile.wantsCinematicWeight ? "–18 dB → –6 dB" : "–18 dB → –8 dB";
  const reverbBuildDuration = profile.energyProfile === "patient-cinematic" ? "8 bars" : "4 bars";
  const screeChDriveTarget = profile.aggressionLevel === "high" ? "30% → 55%" : profile.aggressionLevel === "medium" ? "20% → 45%" : "15% → 35%";
  const widthAtDrop = profile.isRawphoric ? "40%" : "80–90%";
  const negativeBeatCount = profile.aggressionLevel === "high" ? "1 beat (400 ms)" : "½ beat (200 ms)";

  // ── Mandatory intro rows ──────────────────────────────────────────────────

  const introRows: AutomationRow[] = [
    {
      section: "Intro – Cinematic Establishment",
      parameter: "MUSIC bus low-pass cutoff",
      action: `Open slowly from 800 Hz → full range across ${profile.energyProfile === "patient-cinematic" ? "32" : "16"} bars using logarithmic curve`,
      purpose: "Reveal the harmonic world gradually without burning the drop brightness too early.",
    },
    {
      section: "Intro – Cinematic Establishment",
      parameter: "FX / ATMOS tail mute group",
      action: "Cut long cinematic tails 1 beat before any section handoff using step automation",
      purpose: "Keep cinematic scale while preserving transition definition at section boundaries.",
    },
  ];

  // ── Mandatory breakdown rows ───────────────────────────────────────────────

  const breakdownRows: AutomationRow[] = [
    {
      section: "Breakdown – Theme Reveal",
      parameter: "MUSIC bus LP cutoff",
      action: `200 Hz → 8 kHz over ${reverbBuildDuration} using exponential — pads bloom back in gradually`,
      purpose: "Restore harmonic world after drop without sounding like an abrupt switch.",
    },
    {
      section: "Breakdown – Theme Reveal",
      parameter: `REVERB_HALL send level`,
      action: `${reverbBuildLevel} over ${reverbBuildDuration} using exponential`,
      purpose: `Create cinematic space for the breakdown — large hall reverb is the emotional signature of ${profile.wantsCinematicWeight ? "the full orchestral reveal" : "the melodic section"}.`,
    },
    {
      section: "Breakdown – Theme Reveal",
      parameter: "ORCH_BUS volume",
      action: profile.wantsCinematicWeight
        ? "–18 dB → ��3 dB over 8 bars using logarithmic — orchestral reveal is gradual"
        : "–18 dB → –6 dB over 4 bars using exponential",
      purpose: "Orchestral elements enter softly then swell — fast intro of full-volume orchestra kills the drama.",
    },
    {
      section: "Breakdown – Theme Reveal",
      parameter: "Lead teaser send to REVERB_LONG",
      action: "Increase on final 4 beats before vocal/theme handoff using linear, then pull back to –18 dB",
      purpose: "Make the breakdown feel larger without flooding the first melody exposure with wash.",
    },
    ...(profile.isVocalFocused ? [{
      section: "Breakdown – Theme Reveal",
      parameter: "VOCALS / STORY ride level",
      action: "Ride center vocal up 0.5 dB only on key phrase endings using linear",
      purpose: "Keep lyric intelligibility without flattening the whole vocal lane with static automation.",
    }] : []),
  ];

  // ── Mandatory build rows ───────────────────────────────────────────────────

  const buildRows: AutomationRow[] = [
    {
      section: "Build-Up",
      parameter: "Riser group LP cutoff",
      action: `${profile.energyProfile === "front-loaded" ? "400 Hz → 18 kHz over 4 bars" : "300 Hz → 18 kHz over 8 bars"} using exponential`,
      purpose: "Riser brightness increases with anticipation — opening too early reduces impact; opening too late loses energy.",
    },
    {
      section: "Build-Up",
      parameter: "Riser group HP cutoff",
      action: "Sweep upward so final bar carries almost no sub energy: 40 Hz → 200 Hz using linear over 4 bars",
      purpose: "Leave headroom for kick re-entry — sub content in the riser prevents the first downbeat feeling clean.",
    },
    {
      section: "Build-Up",
      parameter: "Riser stereo width",
      action: "100% → 0% (mono) over final 2 beats using linear",
      purpose: "Mono collapse immediately before the drop makes the subsequent wide stereo field feel dramatically wider.",
    },
    {
      section: "Build-Up",
      parameter: leadTarget,
      action: `Add 5–10% extra ${input.leadStyle === "screech" ? "drive" : "brightness"} in final 2 bars, then snap back to 0% on drop using step`,
      purpose: "Create expectation and a controlled contrast hit at the section transition.",
    },
    {
      section: "Build-Up",
      parameter: "Snare roll subdivision",
      action: "1/4 (bars 1–4) → 1/8 (bar 5–6) → 1/16 (bar 7) → 1/32 fill (bar 7 beat 4) → 64th note burst → silence → DROP",
      purpose: "Snare roll acceleration creates urgency — subdivisions should only begin changing in the final 4 bars of the build.",
    },
    {
      section: "Build-Up – Pre-Drop",
      parameter: "ALL BUSES volume",
      action: `0 dB → –∞ dB over ${negativeBeatCount} using step — ${negativeBeatCount} before bar 1 beat 1 of drop`,
      purpose: "Negative space technique: silence before the drop maximises perceived impact on the first downbeat. This is the highest-impact automation move in the track.",
    },
  ];

  // ── Mandatory drop-entry rows ─────────────────────────────────────────────

  const dropEntryRows: AutomationRow[] = [
    {
      section: "Drop 1 – Entry",
      parameter: "PAD_BUS LP cutoff",
      action: "1 kHz → 200 Hz over 1 beat using step",
      purpose: "Clear pads instantly so kick lands clean — pads remaining at full frequency during drop blur the kick attack.",
    },
    {
      section: "Drop 1 – Entry",
      parameter: "REVERB_LONG send level",
      action: "–8 dB → –∞ dB over 1 beat using step",
      purpose: "Prevent breakdown reverb tail bleeding into the dry anti-climax or euphoric drop.",
    },
    {
      section: "Drop 1 – Entry",
      parameter: "Sidechain depth on BASS_BUS",
      action: `–10 dB → –${profile.aggressionLevel === "high" ? "22" : "18"} dB over 1 beat using step`,
      purpose: "Maximum kick/bass separation at drop — sidechain depth is the primary driver of hardstyle groove.",
    },
    {
      section: "Drop 1 – Entry",
      parameter: "LEAD_BUS stereo width",
      action: `60% → ${widthAtDrop} over 1 beat using step`,
      purpose: `Lead width expands when pads are cleared — the contrast with the preceding breakdown mono makes the drop feel wider than its actual width.`,
    },
    ...(profile.isRawphoric ? [{
      section: "Drop 1 – Anti-Climax",
      parameter: "SCREECH bus distortion drive",
      action: `${screeChDriveTarget} over 1 bar using exponential — ramp aggression after initial kick statement`,
      purpose: "Instant maximum screech on bar 1 causes fatigue before the groove is established. Ramp in over bar 1 for controlled aggression.",
    }, {
      section: "Drop 1 – Anti-Climax",
      parameter: "SCREECH bus resonance macro",
      action: "Push only on call-response fills, not on every bar — use step automation per 2-bar phrase",
      purpose: "Keeps the anti-climax aggressive without turning the midrange into static noise that fatigues within 8 bars.",
    }] : []),
  ];

  // ── Mandatory drop-groove rows ─────────────────────────────────────────────

  const dropGrooveRows: AutomationRow[] = [
    {
      section: "Drop 1",
      parameter: "KICK & BASS bus clip/glue amount",
      action: "Keep stable on bars 1–8, +1 small step on fill bars only using step",
      purpose: "Maintain impact while letting fill bars feel more aggressive than sustained groove bars.",
    },
    {
      section: "Drop 1",
      parameter: "FX / ATMOS return level",
      action: "Cut –2 to –3 dB on the first reset bar after Drop 1, then rebuild over 2 bars",
      purpose: "Clear space after Drop 1 peak and make the next break feel intentional instead of crowded.",
    },
  ];

  // ── Drop 2 escalation rows ────────────────────────────────────────────────

  const hasTwoDrop = ["anti-climax-to-melodic", "melodic-then-anti-climax", "double-anti-climax"].includes(input.dropStrategy);
  const drop2Rows: AutomationRow[] = hasTwoDrop
    ? [
        {
          section: "Breakdown 2 – Lift",
          parameter: "Main melody note-center level",
          action: "Automate up 0.5–1 dB across final 8 bars of breakdown using linear",
          purpose: "Increase emotional focus without widening the whole lead bus prematurely.",
        },
        {
          section: "Build-Up 2",
          parameter: "Master bus pre-drop reverb tail",
          action: "Hard mute or gate to –∞ dB in final beat before Drop 2 using step",
          purpose: "Protect the Drop 2 downbeat from reverb wash — impact comes from contrast, not volume.",
        },
        {
          section: "Drop 2 – Entry",
          parameter: "LEAD_BUS stereo width",
          action: input.dropStrategy === "anti-climax-to-melodic"
            ? `${widthAtDrop} → 100% over 1 beat using step — Drop 2 is wider than Drop 1`
            : `60% → ${widthAtDrop} over 1 beat using step`,
          purpose: "Drop 2 must feel measurably wider or brighter than Drop 1 to justify the listener's continued investment.",
        },
        {
          section: "Drop 2",
          parameter: "Lead width macro",
          action: "Keep first 4 beats at 70% width, open to 100% from bar 5 onward using step",
          purpose: "Make the climax feel bigger while preserving punch on the first downbeat — instant full width risks swallowing the kick.",
        },
      ]
    : [];

  // ── Outro rows ────────────────────────────────────────────────────────────

  const outroRows: AutomationRow[] = [
    {
      section: "Outro / DJ Tail",
      parameter: "Master bus saturation/clip stage",
      action: "Return to neutral (0% extra drive) while removing melodic layers using linear over 4 bars",
      purpose: "Keep the outro clean and usable for DJ transitions — the final bars must be plain enough to mix over.",
    },
    ...(profile.wantsHighDjUtility ? [{
      section: "Outro / DJ Tail",
      parameter: "Melodic bus volume",
      action: "0 dB → –∞ dB over 16 bars using linear — strip all pitched content by bar 16",
      purpose: "16-bar percussion-only outro for DJ utility — no pitched bass or melody in the mixing zone.",
    }] : []),
  ];

  return [
    ...introRows,
    ...breakdownRows,
    ...buildRows,
    ...dropEntryRows,
    ...dropGrooveRows,
    ...drop2Rows,
    ...outroRows,
  ];
}

export function buildMixActions(input: ProductionPackageInput): MixAction[] {
  const profile = resolveProfile(input);
  const actions: MixAction[] = [];

  // ── Zone 1: Kick vs sub/bass (all variants) ──────────────────────────────

  actions.push({
    section: "Drop",
    likelyIssue: "Sub collision at 50–160 Hz between kick fundamental and reverse bass body",
    whyItMatters: "The kick's sub fundamental (40–80 Hz) and reverse bass body (100–500 Hz) occupy the same range. In a loud mix both elements lose definition, the sub sounds boomy, and the kick loses weight.",
    actionToTest: "Enable multiband sidechain on SUB/BASS bus: Pro-MB band 20–150 Hz, threshold –24 dB, ratio ∞:1, attack 0 ms, release 80 ms, range –18 dB. Verify kick tok is audible at –14 LUFS reference. Alternatively: HPF all non-kick bass above 80–100 Hz at 24 dB/oct.",
    priority: "P1",
  });
  // ── Zone 2: Kick mid vs leads (all variants) ─────────────────────────────

  actions.push({
    section: "Drop",
    likelyIssue: "Kick tail masking lead melody at 400–900 Hz",
    whyItMatters: "The kick's distorted tail concentrates energy at 500–800 Hz — the same range where lead synths carry their fundamental harmonic body. Result: lead sounds small or recessed during the drop even at full fader.",
    actionToTest: `Apply Pro-Q 3 dynamic EQ on ${input.leadStyle === "screech" ? "SCREECH" : "LEAD"}_BUS: external sidechain from kick, attenuate –3 to –5 dB at 500–800 Hz (Q 2.0), attack 0 ms, release 80 ms. Alternatively: cut kick tail at 600–700 Hz –2 dB narrow (Q 3.0) after the final distortion stage. A/B at matched loudness — lead should remain present without adding gain.`,
    priority: "P1",
  });

  // ── Zone 5: Screech vs lead presence (rawphoric / hybrid) ─────────────────

  if (profile.isRawphoric || input.leadStyle === "hybrid") {
    actions.push({
      section: "Drop",
      likelyIssue: `Screech and ${input.leadStyle === "hybrid" ? "euphoric lead" : "kick character"} competing at 2–4 kHz causing listener fatigue`,
      whyItMatters: "Sustained energy between 2–4 kHz from both screech and lead simultaneously causes ear fatigue within 8 bars. The anti-climax loses its hostile character and becomes noise.",
      actionToTest: "Define frequency ownership: screech owns 1.5–3.5 kHz, lead owns 3.5–6 kHz. Apply complementary EQ on both buses. If leadStyle is hybrid: dynamic EQ on SCREECH_BUS, SC from LEAD_BUS, –2 to –3 dB at 2–3 kHz when lead is sounding. Verify by soloing each bus and checking for mutual frequency invasion above –12 dBFS.",
      priority: profile.aggressionLevel === "high" ? "P1" : "P2",
    });
  }

  // ── Zone 3: Pads vs vocals ────────────────────────────────────────────────

  if (profile.isVocalFocused) {
    actions.push({
      section: "Breakdown",
      likelyIssue: "Synth pads or lead masking vocal intelligibility at 1–4 kHz",
      whyItMatters: "The vocal intelligibility zone (1.5–3.5 kHz) is competed for by both pads and lead synths during breakdowns. Vocal becomes indistinct and the emotional impact of the lyric is lost.",
      actionToTest: "Apply dynamic EQ on MUSIC bus (pad/chord layer): external sidechain from VOCALS/STORY bus, –3 to –5 dB at 1.5–3 kHz (Q 1.0), attack 0 ms, release 80 ms. Verify: play breakdown in mono at conversation volume — vocal must be understandable. If not, reduce MUSIC bus level during vocal phrases via automation.",
      priority: "P1",
    });
  }

  // ── Zone 4: Orchestral vs pads (cinematic variants) ──────────────────────

  if (profile.wantsCinematicWeight) {
    actions.push({
      section: "Breakdown",
      likelyIssue: "Orchestral strings and synth pads creating mud at 300 Hz–3 kHz",
      whyItMatters: "Both orchestral strings (200 Hz–3 kHz body) and synth pads occupy the same mid-frequency register. The result is an indistinct wash rather than clear orchestral texture — the breakdown loses cinematic weight.",
      actionToTest: "Register separation: assign strings to 200 Hz–2 kHz, pads to 1 kHz–8 kHz using high voicings only. Complementary EQ: boost strings at 600 Hz–1 kHz +2 dB, cut pads at same frequency –2 dB. Apply tape saturation on ORCH_BUS (Saturn 2, tape mode, 10–15% drive) — harmonic richness helps strings sit above pads without EQ fighting. Verify with ORCH and MUSIC buses soloed together.",
      priority: "P2",
    });

    actions.push({
      section: "Drop entry",
      likelyIssue: "Orchestral reverb tails surviving into the drop, washing the kick attack",
      whyItMatters: "Long hall reverb tails from orchestral elements (decay 3–5s) extend across section boundaries and blur the drop's first downbeat. The kick sounds small against a wash of reverb.",
      actionToTest: "Verify step automation on REVERB_ORCH_HALL send: should drop to –∞ dB exactly 1 beat before bar 1 of each drop. Check by solo-ing the reverb return and playing the 4 bars before the drop — no orchestral tail should be audible at beat 1 of the drop. If automation is missing, add it now.",
      priority: "P1",
    });
  }

  // ── Gain staging ──────────────────────────────────────────────────────────

  actions.push({
    section: "Full mix",
    likelyIssue: "Gain staging problem: Pro-L 2 working more than 3 dB on drop peaks",
    whyItMatters: "When the limiter is doing heavy lifting, transient character and perceived punch are lost. Hardstyle kicks need the limiter as a safety net, not as a loudness tool — over-limitation destroys the tok definition.",
    actionToTest: "Check each group bus peak level during drop playback: KICK_BUS target –6 to –3 dBFS, LEAD_BUS target –10 to –6 dBFS, ORCH_BUS target –12 to –8 dBFS. If any bus exceeds its target, reduce using Input Controls trim on individual channels — do not use the group fader alone. Re-test limiter: should reduce by 1–3 dB maximum at drop peaks.",
    priority: "P1",
  });

  // ── Stereo mono compatibility ─────────────────────────────────────────────

  actions.push({
    section: "Full mix",
    likelyIssue: "Mono incompatibility: phase cancellation below 200 Hz when summed to mono",
    whyItMatters: "Festival PA systems and many club systems check mono compatibility. Phase cancellation in the sub range eliminates kick and bass weight entirely — the track sounds thin and loses its physical impact.",
    actionToTest: "Temporarily sum the master bus to mono. Lead synth: should lose some width but remain present. Sub/kick: should lose no volume (mono enforcement is correct). If the kick loses significant level in mono, check that the sub is mono (Pro-Q 3 M/S HPF on Side at 120–150 Hz). If the lead vanishes, check for inverted phase on duplicate layers or incorrect stereo processor settings.",
    priority: "P2",
  });

  // ── DJ utility mix check ──────────────────────────────────────────────────

  if (profile.wantsHighDjUtility) {
    actions.push({
      section: "Intro / Outro",
      likelyIssue: "Pitched bass or melodic content present in the first or last 16 bars",
      whyItMatters: "DJ mixing requires 16 bars of percussion-only content at the start and end of a track. Pitched bass in the mixing zone causes key clashes when two tracks play simultaneously during a transition.",
      actionToTest: "Solo the bass and melody buses and play bars 1–16 and the final 16 bars. Both should be silent (no output above –40 dBFS). If content is present, check that automation has stripped all pitched elements from these zones. Verify on the final export WAV — not just the session.",
      priority: "P2",
    });
  }

  // ── Concerns passed in by user ────────────────────────────────────────────

  for (const concern of profile.concerns) {
    actions.push({
      section: "Mix",
      likelyIssue: `User-flagged concern: ${concern}`,
      whyItMatters: "Flagged by producer before or during the session as a known risk area — address before final print.",
      actionToTest: `Isolate the elements involved in "${concern}". A/B the mix with and without the identified element soloed. Apply the lightest fix that resolves the issue — start with arrangement changes, then EQ, then dynamics.`,
      priority: "P2",
    });
  }

  // Sort by priority
  return actions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

export function renderMixActionsMarkdown(
  trackName: string,
  mixActions: MixAction[],
  generatedAt: string,
): string {
  const sections = mixActions.map((action) => [
    `## ${action.priority} – ${action.section}`,
    `- **Likely issue:** ${action.likelyIssue}`,
    `- **Why it matters:** ${action.whyItMatters}`,
    `- **Action to test:** ${action.actionToTest}`,
    `- **Priority:** ${action.priority}`,
    "",
  ].filter(Boolean).join("\n"));

  return [
    `# Mix Report – ${trackName}`,
    "",
    `- **Generated:** ${generatedAt}`,
    `- **Format:** likely issue / why it matters / action to test / priority`,
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

  // ── Screech / Lead ────────────────────────────────────────────────────────

  const screeChSynthDir = profile.aggressionLevel === "high"
    ? "Serum OSC A: Basic Shapes sawtooth, 7–9 unison, 20–35% detune. OSC B: Analog or Vocal wavetable, 5–7 unison, 25–40% detune, +7 or +12 semitones. Filter: Peak 12 bandpass, resonance 65–75%, cutoff 1.5–3.5 kHz. LFO 1: Envelope mode (one-shot), simultaneous cutoff (+50%) + wavetable position (+30%) modulation, total sweep 200–400 ms. Warp: Bend+ on OSC A. Drive: 45–55%."
    : profile.aggressionLevel === "medium"
    ? "Serum OSC A: sawtooth, 7 unison, 25–35% detune. OSC B: vocal or analog wavetable, 5 unison, 30% detune, +7 semitones. Filter: Peak 12, resonance 55–65%, cutoff 2–3 kHz. LFO 1: Envelope mode, cutoff (+40%) + wavetable (+25%). Drive: 35–50%."
    : "Serum OSC A: sawtooth, 5–7 unison, 20–28% detune. OSC B: soft wavetable, 4 unison, 20% detune, +12 semitones. Filter: MG Low 24, resonance 35–50%, cutoff 2.5–4 kHz. LFO 1: Envelope mode, cutoff (+35%) + wavetable (+20%). Drive: 20–35%.";

  const screeChPostProcess = profile.aggressionLevel === "high"
    ? "Post-Serum: Hyper/Dimension (rate 4 Hz, size 50%, mix 30–40%) → Pro-MB (800 Hz–2 kHz band: –3 to –4 dB GR, 2 kHz–6 kHz: –1 to –2 dB GR) → Pro-Q 3 (HPF 150–200 Hz, +2 dB at 2.5–4 kHz, LPF 10 kHz on reverb return) → short reverb send (decay 0.6–1.0s, HPF 400 Hz on return, sidechained from kick –8 to –10 dB GR)."
    : "Post-Serum: Hyper/Dimension (rate 4 Hz, size 50%, mix 25–35%) → Pro-MB (800 Hz–5 kHz, –2 to –3 dB GR) → Pro-Q 3 (HPF 150 Hz, presence +1.5 dB at 3–4 kHz) → reverb send (decay 0.8–1.2s, sidechained from kick –6 to –8 dB GR).";

  const screeChRhythm = profile.isRawphoric
    ? "Distortion-as-rhythm: apply sidechain from kick to screech channel (–4 to –8 dB GR, 50–100 ms duck). Screech enters on beat 2 of the first bar in each 2-bar loop — the 'screech on the second kick' rawstyle convention. LFO 3 on drive (BPM sync, 1/8 note square) adds internal rhythmic gating –20 to –30%."
    : "Movement: envelope-mode LFO fires once per note; automate drive or resonance phrase-by-phrase rather than leaving it static across the full section.";

  const leadSynthDir = profile.isRawphoric
    ? "Hybrid saw stack with a firm mono center: OSC A sawtooth, 7 unison, 35% detune, Bend+ warp. OSC B sawtooth, 7 unison, 40% detune, +12 semitones. Filter: MG Low 24, cutoff automated per section. Mono center: enforce with stereo widener mono-below-200 Hz. Drive: tube saturation 10–20% for warmth without harshness."
    : "Supersaw stack: OSC A sawtooth, 7 unison, 35% detune, Bend+ warp. OSC B sawtooth, 7 unison, 40% detune, +12 semitones. Filter: MG Low 24, cutoff section-automated. Amp envelope: Attack 0 ms, Decay 0 ms, Sustain 100%, Release 150–300 ms. Glide: portamento 65 ms in mono mode for vocal-like legato movement.";

  const leadPostProcess = profile.wantsCinematicWeight
    ? "Post-Serum chain: Pro-Q 3 (HPF 80–120 Hz, cut 200–400 Hz –2 dB, boost 3–5 kHz +1.5 dB) → Pro-C 2 (2:1, attack 8–15 ms, release 80–150 ms, –2 to –3 dB GR) → Saturn 2 tube (10–20% drive) → stereo widener (mono below 200 Hz, widen sides above 2 kHz) → Pro-C 2 sidechain from kick (–8 to –14 dB GR, attack 0.1–1 ms, release 150–300 ms). Reverb send: hall 1.5–2.5s, sidechained. Delay send: dotted 1/8 at 150 BPM = 300 ms, LPF 3 kHz on return."
    : "Post-Serum chain: Pro-Q 3 (HPF 100 Hz, boost presence 3–5 kHz +2 dB) → Pro-C 2 (2:1, –2 dB GR) → Saturn 2 tube (10–15% drive) → stereo widener → Pro-C 2 sidechain from kick (–8 to –12 dB GR). Reverb send: medium hall 1.5–2.5s.";

  const leadRole: SoundDesignRole = input.leadStyle === "screech"
    ? {
        role: "Primary Screech Lead",
        synthesisDirection: screeChSynthDir,
        layering: "Mono center screech (primary character), one widened answer layer (–6 dB relative, 40–60% stereo), one quieter octave texture (+12 semitones, –12 dB). Total: 3 layers maximum. No giant stereo stack — hostile aggression comes from rhythm and midrange bite, not width.",
        movement: screeChRhythm,
        mixPlacement: `SCREECH_BUS: Pro-Q 3 HPF 150–200 Hz → Pro-MB (${profile.aggressionLevel === "high" ? "aggressive" : "moderate"} midrange control) → clip/saturation → Pro-C 2 sidechain. Primary energy: 800 Hz–5 kHz. Reserve 500–800 Hz for kick tail. Reverb return HPF at 400 Hz, sidechained from kick.`,
      }
    : {
        role: "Primary Euphoric Lead",
        synthesisDirection: leadSynthDir,
        layering: profile.isVocalFocused
          ? "Wide outer supersaw layer, mid-weight support layer (–3 dB relative), strict mono center note layer. When vocal is active in center, pull outer layer width to 60% and reduce mid layer –2 dB."
          : "Wide outer supersaw layer (brightest, widest), mid-weight support layer (–3 dB), mono center note layer (fundamental only). Reserve widest setting for final climax only.",
        movement: `Slow vibrato depth (LFO rate 4–6 Hz, amount 2–5 semitones, fade-in 200 ms). Automate stereo width: 60% during builds → 80–90% at drop. Filter cutoff: closed during breakdown, open at drop entry using step automation.`,
        mixPlacement: leadPostProcess,
      };

  // ── Hybrid counter role ────────────────────────────────────────────────────

  const hybridRoles: SoundDesignRole[] = input.leadStyle === "hybrid"
    ? [{
        role: "Hybrid Counter Lead",
        synthesisDirection: `${screeChSynthDir.split(".").slice(0, 3).join(".")}. Drive reduced to ${profile.aggressionLevel === "high" ? "35–45%" : "25–35%"} — the counter layer answers the euphoric lead, it does not dominate.`,
        layering: "One center screech, one narrower support layer (–6 dB). Treat as punctuation between euphoric melody phrases, not a continuous wall.",
        movement: "Automate distortion drive and resonance only on call-response fill bars. Euphoric lead owns sustained bars; screech answers the gaps. Sidechain screech channel from the euphoric lead output for automatic ducking during lead phrases.",
        mixPlacement: "SCREECH_BUS processed separately from LEAD_BUS. Ensure screech sits above the euphoric lead at 1.5–3.5 kHz; euphoric lead sits above screech at 3.5–6 kHz. Dynamic EQ on screech triggered by lead: –2 to –3 dB at 2–3 kHz when lead is sounding.",
      }]
    : [];

  // ── Kick / Sub ─────────────────────────────────────────────────────────────

  const kickTailSpec = profile.aggressionLevel === "high"
    ? "4–6 alternating EQ/distortion stages: Pro-Q 3 (HPF 30–40 Hz, boost 400–900 Hz +12–15 dB) → clip distortion (60–85% drive) → Pro-Q 3 (shape harmonics, cut 300 Hz –2 dB, notch 1.4 kHz –3 dB) → tube saturation (30–50% drive) → Pro-Q 3 (final shape, boost 3–5 kHz +2 dB) → tape saturation (15–25%) → hard clipper at 0 dBFS."
    : "2–3 EQ/distortion stages: Pro-Q 3 (HPF 30 Hz, boost 400–800 Hz +8–12 dB) → clip distortion (45–65% drive) → Pro-Q 3 (cut 300 Hz –2 dB, boost 3–4 kHz +1.5 dB) → tube saturation (15–25% drive) → hard clipper at 0 dBFS.";

  const reverseBassMethod = /(melodic|tuned|pitched)/.test(profile.kickStyle.toLowerCase())
    ? "Synthesis from scratch: sine oscillator, pitch envelope C4→key root in octave 1 over 100–150 ms exponential curve. Process: Pro-Q 3 (HPF 30 Hz, LPF 2 kHz) → Saturn 2 waveshaping (40–60% drive) → Pro-Q 3 (boost 400–600 Hz +3 dB, cut 250 Hz –2 dB). Root note matches kick tail pitch. Place on offbeat AND of beat 4, extending through beat 1."
    : "Kick tail duplication method: duplicate processed kick tail, reverse, re-pitch to key root (F1–G1 = 43–49 Hz at key), add Saturn 2 tube saturation (20–35% drive) to restore body attenuated by reversal. Place so reversed tail peak aligns with the kick downbeat. Frequency allocation: sub (40–100 Hz, mono), body growl (100–500 Hz), harmonics (up to 2 kHz max).";

  const kickRole: SoundDesignRole = {
    role: "Kick / Sub Layering",
    synthesisDirection: `Tail chain (${profile.aggressionLevel} aggression): ${kickTailSpec} Transient layer: process separately — zero distortion, single EQ (HPF 80 Hz, presence +2 dB at 4–8 kHz), merge on KICK_BUS with transient at –3 to 0 dB relative to tail. Kick fundamental: key root in octave 1–2 (e.g. F# minor = F# at 46 Hz or 92 Hz). Sub: HPF 30–35 Hz, keep mono below 120 Hz.`,
    layering: `Transient/attack layer + tail/body layer on separate channels, merged on KICK_BUS. Reverse bass on SUB_BUS: ${reverseBassMethod} Frequency layers: sub (40–100 Hz, mono) / body (100–500 Hz) / harmonics (500 Hz–2 kHz) / tok definition (2–6 kHz, transient layer only).`,
    movement: `Sidechain reverse bass from kick: Pro-C 2, attack 0.1–1 ms, release ${profile.aggressionLevel === "high" ? "80–120 ms" : "120–180 ms"}, ratio ∞:1, –12 to –18 dB GR. Automate kick tail release around busy fill sections to prevent sub smear. Do not automate during sustained groove bars — only at peak density fills.`,
    mixPlacement: `KICK_BUS channel chain: 5+ alternating EQ/distortion stages described above. KICK & BASS group: gentle glue compressor (2:1, attack 3 ms, auto release, –1 to –2 dB GR only). All sub content below 120 Hz: mono — enforce with Pro-Q 3 M/S mode HPF on Side channel at 120–150 Hz (24 dB/oct). Peak target: KICK_BUS peaks at –6 to –3 dBFS before the master bus.`,
  };

  // ── Atmosphere ─────────────────────────────────────────────────────────────

  const atmosphereDensity = profile.cinematicIntensity === "high"
    ? "Full atmospheric architecture: Paulstretch bed (source: 1–2 chord cluster from track's main motif, stretched 20–50×, HPF 120 Hz, at –12 dB), 3–4 drone layers (sine fundamentals at tonic and perfect fifth with 0.5–2 Hz beating between detuned pairs), main pad (Serum spectral wavetable, LFO on wavetable position 1–4 bar cycle, reverb hall 4–6s decay at –8 dB send)."
    : profile.cinematicIntensity === "medium"
    ? "Standard atmospheric architecture: 1–2 drone layers (tonic + fifth, –16 to –18 dBFS), main pad (Serum, spectral wavetable, LFO 2–4 bar cycle, hall reverb 3–4s at –10 dB send). No Paulstretch unless manually added for specific sections."
    : "Minimal atmospheric texture: single pad (spectral or string-like wavetable, minimal LFO movement, plate reverb 2–3s at –12 dB send). Drones optional.";

  const atmospherePerSection = "Density by section: Intro 20–30% (sparse) → Breakdown first half 55–70% (full atmosphere) → Breakdown second half 40–60% (transitioning to riser) → Drop 0–10% (cleared completely) → Outro 30–40% (gradual return). Clear all atmosphere with step automation 1 beat before each drop entry.";

  const atmosphereRole: SoundDesignRole = {
    role: "Cinematic Intro Architecture",
    synthesisDirection: profile.wantsCinematicWeight
      ? `Textural impacts, reversed tonal swells, filtered theme motif, and dark atmospheres. ${atmosphereDensity}`
      : "Filtered theme hint, sparse pad, short riser accent. Single pad layer. Reserve full atmosphere for the breakdown.",
    layering: profile.wantsCinematicWeight
      ? "Layers in order of introduction: sub drone (bar 1) → main pad bloom (bar 5–8) → Paulstretch bed (bar 9–12 if present) → orchestral accent (bar 13–16). Each layer adds a new frequency range — never two layers in the same register simultaneously."
      : "1–2 elements maximum: kick + sparse pad or atmospheric sweep. Clear by bar 16 to leave space for the mid-intro section.",
    movement: atmospherePerSection,
    mixPlacement: profile.wantsCinematicWeight
      ? `FX/ATMOS bus: Pro-Q 3 HPF 60 Hz → spatial management → sidechain from kick (–2 to –4 dB GR at drops, slow attack 15–25 ms). Reverb returns: REVERB_HALL decay ${profile.cinematicIntensity === "high" ? "4–6s" : "3–4s"}, predelay 40–60 ms, HPF 80 Hz on return, LPF 12 kHz on return. Hard-mute long reverb tails 1 beat before each drop using step automation.`
      : "FX/ATMOS bus: Pro-Q 3 HPF 100 Hz, plate reverb 2–3s, sidechained from kick. Keep levels at –16 to –10 dBFS peak. Clear before drops.",
  };

  // ── Impact FX ──────────────────────────────────────────────────────────────

  const impactRole: SoundDesignRole = {
    role: "Drop Impact FX",
    synthesisDirection: `3-layer impact composite: (1) Sub boom — sine oscillator, pitch envelope 200 Hz → 30 Hz over 50–100 ms, mono, at –3 dB relative to impact group. (2) Mid impact — distorted noise burst (white noise through bandpass 200–800 Hz, heavy compression ratio ∞:1, attack 0 ms, 80–150 ms duration). (3) High transient — click/crack, 5–10 ms, emphasis 3–8 kHz. All three hit simultaneously on bar 1 beat 1 of each drop. Riser: noise through lowpass, cutoff automated ${profile.energyProfile === "patient-cinematic" ? "over 16 bars" : "over 8 bars"} from ${profile.energyProfile === "patient-cinematic" ? "300 Hz → 18 kHz" : "400 Hz → 18 kHz"}, resonance 5% → 20–35% as cutoff opens. Stereo width: 100% → 0% (mono) in final 2 beats before drop.`,
    layering: "Riser stack: (1) white noise through lowpass, (2) tonal riser (+7 semitones relative to noise, –6 dB), (3) reversed crash cymbal (peak timed to drop point, –9 dB). Downlifter: white noise or tonal oscillator through bandpass, cutoff automated high → low over 4–8 bars before section change.",
    movement: `Negative space technique: insert ${profile.aggressionLevel === "high" ? "1 beat" : "½ beat"} of complete silence (200–400 ms at 150 BPM) immediately before each drop downbeat. Implementation: step automation dropping all buses to –∞ dB at beat 3.5 of the final pre-drop bar, returning to 0 dB at bar 1 beat 1. Riser volume: exponential curve from –18 dB → –3 dB over the riser duration. Hard-mute all reverb returns 1 beat before the drop.`,
    mixPlacement: "FX_BUS: spatial management only — no compression. Impact stack peak: –3 dBFS on the mix bus during playback. Riser levels: –18 dB at start, –3 dB at peak. All transition FX on dedicated FX_BUS with no master bus insert applied — allows independent muting before drops without affecting master bus signal chain.",
  };

  // ── Vocal ──────────────────────────────────────────────────────────────────

  const roles: SoundDesignRole[] = [
    atmosphereRole,
    leadRole,
    ...hybridRoles,
    kickRole,
    impactRole,
  ];

  if (profile.isVocalFocused) {
    const isSpokenTexture = /(spoken|texture|story)/.test(profile.vocalMode.toLowerCase());
    roles.push({
      role: "Vocal / Story Lane",
      synthesisDirection: isSpokenTexture
        ? "Spoken word chain: HPF 100–150 Hz (remove room rumble) → Pro-C 2 (2:1–3:1, attack 8–12 ms, release 80–120 ms, –3 to –4 dB GR) → Pro-Q 3 (cut 200–300 Hz –2 dB, boost 3–5 kHz +2 dB) → reverb send (plate or small hall, decay 2.5–4s, predelay 30–50 ms, 35–50% wet). Optional lo-fi insert (bandpass 200 Hz–4 kHz in parallel at –10 dB) for cinematic transmission character."
        : "Lead vocal chain: HPF 120 Hz → Pro-DS (de-ess at 6.5 kHz, –6 dB range) → Pro-C 2 (3:1–4:1, attack 5–8 ms, release 60–100 ms, –4 to –6 dB GR) → pitch correction (Melodyne, 80–100% speed for natural) → Pro-Q 3 (cut 200 Hz –2 dB, boost 3–5 kHz +2 dB, air shelf +1.5 dB at 12 kHz) → stereo widener (mono below 800 Hz, +10–15% sides above 800 Hz).",
      layering: isSpokenTexture
        ? "Main spoken phrase (center, dry intelligible) + one texture double (formant-shifted ±100 cents, panned ±40%, –10 dB). No pitch correction on spoken word — preserve natural delivery."
        : "Lead vocal (center, mono) + support double (±5 cents detuned, ±25% pan, –6 dB) + optional octave layer (±12 semitones, ±40% pan, –12 dB). Choir/texture: large hall reverb (decay 3–5s, predelay 60–80 ms, HPF 100 Hz on return), keep mono below 250 Hz.",
      movement: isSpokenTexture
        ? "Automate reverb send: –15 dB at phrase start, –8 dB at phrase end (wash into space). Pull all delay/reverb returns to –∞ dB 1 beat before kick re-entry. Lo-fi insert: automate parallel blend from 0% (clear speech) to –8 dB (subtle texture) for dramatic effect."
        : "Dynamic EQ on lead synth triggered by vocal: –3 dB at 1.5–3 kHz when vocal is singing (Pro-Q 3 external sidechain, attack 0 ms, release 80 ms). Automate lead synth level –2 to –3 dB during vocal phrases. Delay throw on phrase endings: 1/4 note delay, 30% feedback, automated send level from 0 to –6 dB on phrase end only.",
      mixPlacement: "VOCALS/STORY bus: Pro-Q 3 HPF 120 Hz → de-ess → Pro-C 2 → EQ → stereo widener (mono below 250 Hz). Send to VOC_DUCKED_THROW (1/4 note delay, filtered LP at 3 kHz, –12 dB send, phrase-end automation only). Center-lane sidechain: LEAD_BUS ducks –3 dB at 1.5–3 kHz when VOCALS/STORY bus is above –18 dBFS. VOCALS/STORY peak target: –12 to –8 dBFS.",
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

  // ── Core creative checks ──────────────────────────────────────────────────

  const creativeChecks = [
    profile.wantsCinematicWeight
      ? "Intro feels cinematic and intentional before it feels busy — each element has a reason to enter."
      : "Intro feels purposeful before it feels busy.",
    "Main theme is identifiable in the breakdown without full climax brightness.",
    input.leadStyle === "hybrid"
      ? "Euphoric lead and screech counter share bars without masking each other — melody owns sustained bars, screech answers the gaps."
      : input.leadStyle === "screech"
      ? "Screech aggression is rhythmic and phrase-based, not a static wall — gaps between phrases are intentional."
      : "First drop has a clear identity — euphoric statement, not a blurred compromise.",
    "Final drop is measurably wider, brighter, or more emotionally complete than Drop 1.",
    profile.isRawphoric
      ? "Anti-climax aggression comes from rhythm and controlled midrange bite, not from generic saturation stacking."
      : "Emotional contrast between breakdown and drop is immediate and clear on first listen.",
  ];

  // ── Gain staging checks ───────────────────────────────────────────────────

  const gainChecks = [
    "All individual tracks average at –18 dBFS (±2 dB) before any bus processing — check with VU meter.",
    "KICK_BUS peaks between –6 and –3 dBFS before hitting KICK & BASS bus.",
    "Master bus pre-limiter peaks between –6 and –3 dBFS — if lower, upstream levels need adjustment.",
    "Pro-L 2 gain reduction does not exceed 3 dB on drop peaks — if exceeded, fix upstream gain staging rather than pushing the limiter.",
    "No individual channel fader below –10 dB — use Input Controls trim knob to reduce level instead.",
    "Dithering enabled on final export: Pow-r 1 (24-bit) or Pow-r 3 (16-bit). Disable Studio One dither if using Pro-L 2 internal dither.",
  ];

  // ── Mix technical checks ──────────────────────────────────────────────────

  const mixChecks = [
    "Kick tok survives at matched loudness with the master chain enabled — reference at –14 LUFS.",
    "Sub anchor stays mono and controlled through the busiest fill sections — verify with correlation meter.",
    "Lead hook reads clearly in mono on the final climax — verify by temporarily summing to mono.",
    profile.isRawphoric
      ? "Screech layers leave intentional space between phrases instead of masking the kick continuously."
      : "Lead synth does not mask the kick tail in the 400–900 Hz range — dynamic EQ check.",
    "Long FX tails are muted or ducked 1 beat before all drop entries — check with solo on FX/ATMOS bus.",
    "All sub content below 120 Hz is mono — verify with Pro-Q 3 M/S mode or correlation meter.",
    "Routing reflects intentional bus ownership — every channel routes to exactly one bus, no orphans.",
    "Mix fixes are on source or bus channels before the master bus — master bus inserts are checkpoint only.",
    ...(profile.isVocalFocused
      ? ["Featured vocal stays readable in mono at the center throughout the breakdown — intelligibility test at conversation volume."]
      : []),
  ];

  // ── Arrangement checks ────────────────────────────────────────────────────

  const arrangementChecks = [
    `All section lengths are multiples of 8 bars — verify in Arranger Track at 150 BPM (${Math.round(150 / 60 * 8 * 10) / 10}s per 8 bars).`,
    "Breakdown, Drop 1, and Drop 2 each have their own energy identity — no two sections feel identical.",
    "Negative space automation verified: silence of 200–400 ms before each drop downbeat (½–1 beat at 150 BPM).",
    `Riser stereo width narrows to mono in final 2 beats before each drop — verified with ${input.leadStyle === "screech" ? "aggressive" : "standard"} riser.`,
    `Snare roll acceleration pattern confirmed: 1/4 → 1/8 → 1/16 → 1/32 → silence → DROP.`,
    ...(profile.wantsHighDjUtility
      ? [
          "First 16 bars of intro: percussion only, no pitched bass or melodic content — verified for DJ utility.",
          "Final 16 bars of outro: percussion only, no pitched bass — verified for DJ mix-out.",
        ]
      : []),
  ];

  // ── Delivery checks ───────────────────────────────────────────────────────

  const deliveryChecks = [
    "Club / Beatport master exported: WAV 24-bit 44.1 kHz, –0.3 dBTP ceiling, –5 to –6 LUFS integrated.",
    "Streaming master exported: WAV 24-bit 44.1 kHz, –1.0 dBTP ceiling, –13 to –15 LUFS integrated.",
    ...(profile.wantsHighDjUtility
      ? [
          "DJ stem pack exported with naming convention: FORNIX_TrackTitle_StemName_150BPM_Key.wav",
          "DJ stem pack includes: Kick, Bass, Melody, FX, FullMix stems — each starting at bar 1 beat 1.",
          "BPM and Camelot key confirmed in filename and embedded metadata.",
        ]
      : []),
    "Release metadata fields completed: ISRC, BPM (150), key in Camelot notation, genre (Hardstyle), artist (Fornix).",
    "Radio edit prepared if required: 3:30–4:00 duration, single drop retained, edit join at bar 1 beat 1 boundary.",
  ];

  return [
    ...renderHeader("Producer Checklist", input, generatedAt),

    "## Creative Review",
    "",
    ...creativeChecks.map((check) => `- [ ] ${check}`),

    "",
    "## Gain Staging",
    "",
    ...gainChecks.map((check) => `- [ ] ${check}`),

    "",
    "## Mix Technical",
    "",
    ...mixChecks.map((check) => `- [ ] ${check}`),

    "",
    "## Arrangement",
    "",
    ...arrangementChecks.map((check) => `- [ ] ${check}`),

    "",
    "## Final Print Readiness",
    "",
    "- [ ] Kick / sub relationship still feels locked after limiter audition at reference level.",
    "- [ ] Breakdown, Drop 1, and Drop 2 each have their own energy identity.",
    profile.wantsHighDjUtility
      ? "- [ ] Outro handoff clean enough for club transitions and DJ edits."
      : "- [ ] Outro keeps enough drum utility for edits and transitions.",

    "",
    "## Delivery",
    "",
    ...deliveryChecks.map((check) => `- [ ] ${check}`),

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
