
// ─── Fornix Studio MCP – Workspace Profile Service ────────────────────────────
//
// Multi-track workspace layer: workspace.json schema, read/write helpers,
// and profile inheritance resolver (workspace defaults → track overrides).

import fs from "fs";
import path from "path";
import {
  type DropStrategy,
  type EnergyProfile,
  type LeadStyle,
  type ProductionPackageInput,
  type ProductionPackageMetadata,
  type ProductionPackageResult,
  type StyleVariant,
  FORNIX_OUTPUT_ROOT,
  getPackageSummary,
  slugifyTrackName,
  writeProductionPackage,
} from "./production-package.js";
import { type ProductionTemplate, getTemplate } from "./template-library.js";

// ─── Types ──────────────────────────────────────────────────────────────────────

export const WORKSPACE_FORMAT_VERSION = "1.0.0";
export const WORKSPACE_FILENAME = "workspace.json";

export interface BpmRange {
  min: number;
  max: number;
}

/** Inheritable style fields — workspace defaults and per-track overrides share this shape. */
export interface WorkspaceStyleDefaults {
  styleVariant?: StyleVariant;
  leadStyle?: LeadStyle;
  dropStrategy?: DropStrategy;
  energyProfile?: EnergyProfile;
  keySignature?: string;
  targetBars?: number;
  substyle?: string;
  kickStyle?: string;
  antiClimaxStyle?: string;
  arrangementFocus?: string;
  vocalMode?: string;
  djUtilityPriority?: string;
  cinematicIntensity?: string;
  aggressionLevel?: string;
  emotionalTone?: string;
  mood?: string;
  focus?: string;
  mixConcerns?: string[];
  referenceNotes?: string[];
  sectionGoals?: Record<string, string>;
}

export interface WorkspaceTrackEntry {
  trackName: string;
  trackSlug: string;
  tempo: number;
  creativeBrief?: string;
  signatureHooks?: string[];
  overrides?: Partial<WorkspaceStyleDefaults>;
  packageGenerated: boolean;
  addedAt: string;
}

export interface WorkspaceProfile {
  workspaceFormatVersion: string;
  name: string;
  artistName: string;
  bpmRange?: BpmRange;
  defaults: WorkspaceStyleDefaults;
  tracks: WorkspaceTrackEntry[];
  createdAt: string;
  lastModifiedAt: string;
}

// ─── Read / Write ───────────────────────────────────────────────────────────────

export function workspacePath(outputDir: string): string {
  return path.join(outputDir, WORKSPACE_FILENAME);
}

export function workspaceExists(outputDir: string): boolean {
  return fs.existsSync(workspacePath(outputDir));
}

export function readWorkspace(outputDir: string): WorkspaceProfile {
  const filePath = workspacePath(outputDir);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No workspace.json found at ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as WorkspaceProfile;
}

export function writeWorkspace(outputDir: string, workspace: WorkspaceProfile): void {
  workspace.lastModifiedAt = new Date().toISOString();
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(workspacePath(outputDir), JSON.stringify(workspace, null, 2), "utf8");
}

// ─── Factory ────────────────────────────────────────────────────────────────────

export interface CreateWorkspaceInput {
  outputDir: string;
  name: string;
  artistName?: string;
  bpmRange?: BpmRange;
  defaults?: WorkspaceStyleDefaults;
}

export function createWorkspace(input: CreateWorkspaceInput): WorkspaceProfile {
  if (workspaceExists(input.outputDir)) {
    throw new Error(`workspace.json already exists at ${workspacePath(input.outputDir)}`);
  }

  if (input.bpmRange) {
    validateBpmRange(input.bpmRange);
  }

  const now = new Date().toISOString();
  const workspace: WorkspaceProfile = {
    workspaceFormatVersion: WORKSPACE_FORMAT_VERSION,
    name: input.name,
    artistName: input.artistName ?? "Fornix",
    bpmRange: input.bpmRange,
    defaults: input.defaults ?? {},
    tracks: [],
    createdAt: now,
    lastModifiedAt: now,
  };

  writeWorkspace(input.outputDir, workspace);
  return workspace;
}

// ─── Track management ───────────────────────────────────────────────────────────

export interface AddTrackInput {
  outputDir: string;
  trackName: string;
  tempo: number;
  creativeBrief?: string;
  signatureHooks?: string[];
  overrides?: Partial<WorkspaceStyleDefaults>;
}

export function addTrackToWorkspace(input: AddTrackInput): { workspace: WorkspaceProfile; track: WorkspaceTrackEntry } {
  const workspace = readWorkspace(input.outputDir);
  const slug = slugifyTrackName(input.trackName);

  if (workspace.tracks.some((t) => t.trackSlug === slug)) {
    throw new Error(`Track "${input.trackName}" (slug: ${slug}) already exists in workspace`);
  }

  if (workspace.bpmRange) {
    validateTempoInRange(input.tempo, workspace.bpmRange);
  }

  const track: WorkspaceTrackEntry = {
    trackName: input.trackName,
    trackSlug: slug,
    tempo: input.tempo,
    creativeBrief: input.creativeBrief,
    signatureHooks: input.signatureHooks,
    overrides: input.overrides,
    packageGenerated: false,
    addedAt: new Date().toISOString(),
  };

  workspace.tracks.push(track);
  writeWorkspace(input.outputDir, workspace);

  return { workspace, track };
}

// ─── Remove track ──────────────────────────────────────────────────────────────

export interface RemoveTrackResult {
  workspace: WorkspaceProfile;
  removedTrack: WorkspaceTrackEntry;
  packageCleaned: boolean;
}

export function removeTrackFromWorkspace(
  outputDir: string,
  trackSlug: string,
  options?: { cleanPackage?: boolean },
): RemoveTrackResult {
  const workspace = readWorkspace(outputDir);
  const idx = workspace.tracks.findIndex((t) => t.trackSlug === trackSlug);

  if (idx === -1) {
    throw new Error(`Track with slug "${trackSlug}" not found in workspace "${workspace.name}"`);
  }

  const [removedTrack] = workspace.tracks.splice(idx, 1);
  writeWorkspace(outputDir, workspace);

  let packageCleaned = false;
  if (options?.cleanPackage) {
    const packageRoot = path.join(outputDir, FORNIX_OUTPUT_ROOT, trackSlug);
    if (fs.existsSync(packageRoot)) {
      fs.rmSync(packageRoot, { recursive: true, force: true });
      packageCleaned = true;
    }
  }

  return { workspace, removedTrack, packageCleaned };
}

// ─── Update defaults ───────────────────────────────────────────────────────────

export interface UpdateDefaultsResult {
  workspace: WorkspaceProfile;
  updatedFields: string[];
  removedFields: string[];
}

export function updateWorkspaceDefaults(
  outputDir: string,
  defaults: Partial<WorkspaceStyleDefaults>,
  options?: { merge?: boolean },
): UpdateDefaultsResult {
  const workspace = readWorkspace(outputDir);
  const merge = options?.merge !== false; // default: merge

  const updatedFields: string[] = [];
  const removedFields: string[] = [];

  if (merge) {
    for (const [key, value] of Object.entries(defaults)) {
      if (value !== undefined) {
        const prev = (workspace.defaults as Record<string, unknown>)[key];
        if (JSON.stringify(prev) !== JSON.stringify(value)) {
          updatedFields.push(key);
        }
        (workspace.defaults as Record<string, unknown>)[key] = value;
      }
    }
  } else {
    // Replace mode: track what was added/changed and what was removed
    const oldKeys = new Set(
      Object.keys(workspace.defaults).filter(
        (k) => (workspace.defaults as Record<string, unknown>)[k] !== undefined,
      ),
    );
    const newKeys = new Set(
      Object.keys(defaults).filter(
        (k) => (defaults as Record<string, unknown>)[k] !== undefined,
      ),
    );

    for (const key of newKeys) {
      const prev = (workspace.defaults as Record<string, unknown>)[key];
      const next = (defaults as Record<string, unknown>)[key];
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        updatedFields.push(key);
      }
    }

    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        removedFields.push(key);
      }
    }

    workspace.defaults = defaults as WorkspaceStyleDefaults;
  }

  writeWorkspace(outputDir, workspace);
  return { workspace, updatedFields, removedFields };
}

/** Mark a track as having a generated package. */
export function markTrackGenerated(outputDir: string, trackSlug: string): void {
  const workspace = readWorkspace(outputDir);
  const track = workspace.tracks.find((t) => t.trackSlug === trackSlug);
  if (track) {
    track.packageGenerated = true;
    writeWorkspace(outputDir, workspace);
  }
}

// ─── Inheritance resolver ───────────────────────────────────────────────────────

/**
 * Resolve a track's effective ProductionPackageInput by merging:
 *   track explicit value → track overrides → workspace defaults → (resolveProfile fills the rest)
 *
 * The returned object is ready to pass directly to writeProductionPackage().
 */
export function resolveTrackInput(
  workspace: WorkspaceProfile,
  track: WorkspaceTrackEntry,
): ProductionPackageInput {
  const d = workspace.defaults;
  const o = track.overrides ?? {};

  return {
    // Per-track fields (never inherited)
    outputDir: "",  // caller sets this
    trackName: track.trackName,
    tempo: track.tempo,
    creativeBrief: track.creativeBrief,
    signatureHooks: track.signatureHooks,

    // Inherited: track override wins → workspace default
    artistName: workspace.artistName,
    keySignature: pick(o.keySignature, d.keySignature) ?? "F# minor",
    styleVariant: pick(o.styleVariant, d.styleVariant) ?? "cinematic-euphoric",
    leadStyle: pick(o.leadStyle, d.leadStyle) ?? "hybrid",
    dropStrategy: pick(o.dropStrategy, d.dropStrategy) ?? "anti-climax-to-melodic",
    energyProfile: pick(o.energyProfile, d.energyProfile) ?? "steady-escalation",
    targetBars: pick(o.targetBars, d.targetBars) ?? 160,
    substyle: pick(o.substyle, d.substyle),
    kickStyle: pick(o.kickStyle, d.kickStyle),
    antiClimaxStyle: pick(o.antiClimaxStyle, d.antiClimaxStyle),
    arrangementFocus: pick(o.arrangementFocus, d.arrangementFocus),
    vocalMode: pick(o.vocalMode, d.vocalMode),
    djUtilityPriority: pick(o.djUtilityPriority, d.djUtilityPriority),
    cinematicIntensity: pick(o.cinematicIntensity, d.cinematicIntensity),
    aggressionLevel: pick(o.aggressionLevel, d.aggressionLevel),
    emotionalTone: pick(o.emotionalTone, d.emotionalTone),
    mood: pick(o.mood, d.mood),
    focus: pick(o.focus, d.focus),
    mixConcerns: pickArray(o.mixConcerns, d.mixConcerns),
    referenceNotes: pickArray(o.referenceNotes, d.referenceNotes),
    sectionGoals: pickRecord(o.sectionGoals, d.sectionGoals),
  };
}

// ─── Workspace summary ──────────────────────────────────────────────────────────

export interface WorkspaceSummary {
  name: string;
  artistName: string;
  bpmRange: BpmRange | null;
  defaultsSet: string[];
  trackCount: number;
  generatedCount: number;
  tracks: Array<{
    trackName: string;
    trackSlug: string;
    tempo: number;
    packageGenerated: boolean;
    overrideCount: number;
  }>;
}

export function getWorkspaceSummary(outputDir: string): WorkspaceSummary {
  const ws = readWorkspace(outputDir);

  const defaultsSet = Object.entries(ws.defaults)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k]) => k);

  return {
    name: ws.name,
    artistName: ws.artistName,
    bpmRange: ws.bpmRange ?? null,
    defaultsSet,
    trackCount: ws.tracks.length,
    generatedCount: ws.tracks.filter((t) => t.packageGenerated).length,
    tracks: ws.tracks.map((t) => ({
      trackName: t.trackName,
      trackSlug: t.trackSlug,
      tempo: t.tempo,
      packageGenerated: t.packageGenerated,
      overrideCount: t.overrides ? Object.keys(t.overrides).length : 0,
    })),
  };
}

// ─── Consistency check ──────────────────────────────────────────────────────────

export interface ConsistencyIssue {
  trackSlug: string;
  trackName: string;
  field: string;
  expected: unknown;
  actual: unknown;
  severity: "warning" | "error";
}

export interface WorkspaceConsistencyResult {
  workspaceName: string;
  consistent: boolean;
  issues: ConsistencyIssue[];
  tracksChecked: number;
  tracksWithPackage: number;
  tracksMissingPackage: string[];
}

const CHECKED_FIELDS = [
  "styleVariant", "leadStyle", "dropStrategy", "energyProfile",
  "keySignature", "targetBars", "substyle", "kickStyle",
  "antiClimaxStyle", "arrangementFocus", "vocalMode",
  "djUtilityPriority", "cinematicIntensity", "aggressionLevel",
  "emotionalTone", "mood", "focus",
] as const;

export function checkWorkspaceConsistency(outputDir: string): WorkspaceConsistencyResult {
  const workspace = readWorkspace(outputDir);
  const issues: ConsistencyIssue[] = [];
  const tracksMissingPackage: string[] = [];
  let tracksWithPackage = 0;

  for (const track of workspace.tracks) {
    const packageRoot = path.join(outputDir, FORNIX_OUTPUT_ROOT, track.trackSlug);

    let summary;
    try {
      summary = getPackageSummary({ packagePath: packageRoot });
    } catch {
      tracksMissingPackage.push(track.trackSlug);
      continue;
    }

    if (!summary.metadata) {
      tracksMissingPackage.push(track.trackSlug);
      continue;
    }

    tracksWithPackage++;
    const meta = summary.metadata;
    const expected = resolveTrackInput(workspace, track);

    // Check tempo
    if (meta.tempo !== track.tempo) {
      issues.push({
        trackSlug: track.trackSlug,
        trackName: track.trackName,
        field: "tempo",
        expected: track.tempo,
        actual: meta.tempo,
        severity: "error",
      });
    }

    // Check inheritable fields
    for (const field of CHECKED_FIELDS) {
      const expectedVal = expected[field];
      const actualVal = meta[field as keyof ProductionPackageMetadata];

      if (expectedVal !== undefined && actualVal !== undefined && expectedVal !== actualVal) {
        issues.push({
          trackSlug: track.trackSlug,
          trackName: track.trackName,
          field,
          expected: expectedVal,
          actual: actualVal,
          severity: "warning",
        });
      }
    }
  }

  return {
    workspaceName: workspace.name,
    consistent: issues.length === 0 && tracksMissingPackage.length === 0,
    issues,
    tracksChecked: workspace.tracks.length,
    tracksWithPackage,
    tracksMissingPackage,
  };
}

// ─── Workspace → Package pipeline ───────────────────────────────────────────────

export interface GenerateWorkspacePackagesResult {
  workspaceName: string;
  generated: Array<{ trackName: string; trackSlug: string; packageRoot: string }>;
  skipped: Array<{ trackName: string; trackSlug: string; reason: string }>;
  alreadyGenerated: Array<{ trackName: string; trackSlug: string }>;
}

export function generateWorkspacePackages(
  outputDir: string,
  options?: { regenerate?: boolean },
): GenerateWorkspacePackagesResult {
  const workspace = readWorkspace(outputDir);

  if (workspace.tracks.length === 0) {
    throw new Error(`Workspace "${workspace.name}" has no tracks. Add tracks first.`);
  }

  const generated: GenerateWorkspacePackagesResult["generated"] = [];
  const skipped: GenerateWorkspacePackagesResult["skipped"] = [];
  const alreadyGenerated: GenerateWorkspacePackagesResult["alreadyGenerated"] = [];

  for (const track of workspace.tracks) {
    if (track.packageGenerated && !options?.regenerate) {
      alreadyGenerated.push({ trackName: track.trackName, trackSlug: track.trackSlug });
      continue;
    }

    try {
      const input = resolveTrackInput(workspace, track);
      input.outputDir = outputDir;
      const result = writeProductionPackage(input);

      generated.push({
        trackName: track.trackName,
        trackSlug: track.trackSlug,
        packageRoot: result.packageRoot,
      });

      markTrackGenerated(outputDir, track.trackSlug);
    } catch (e) {
      skipped.push({
        trackName: track.trackName,
        trackSlug: track.trackSlug,
        reason: String(e),
      });
    }
  }

  return {
    workspaceName: workspace.name,
    generated,
    skipped,
    alreadyGenerated,
  };
}

// ─── Template → Workspace ───────────────────────────────────────────────────────

export interface CreateWorkspaceFromTemplateInput {
  outputDir: string;
  name: string;
  templateId: string;
  artistName?: string;
  bpmRange?: BpmRange;
}

export function createWorkspaceFromTemplate(input: CreateWorkspaceFromTemplateInput): WorkspaceProfile {
  const template = getTemplate(input.templateId);
  if (!template) {
    throw new Error(`Template "${input.templateId}" not found`);
  }

  const defaults: WorkspaceStyleDefaults = {
    styleVariant: template.styleVariant,
    leadStyle: template.leadStyle,
    dropStrategy: template.dropStrategy,
    energyProfile: template.energyProfile,
    keySignature: template.keySignature,
    targetBars: template.targetBars,
    substyle: template.substyle,
    kickStyle: template.kickStyle,
    antiClimaxStyle: template.antiClimaxStyle,
    arrangementFocus: template.arrangementFocus,
    vocalMode: template.vocalMode,
    djUtilityPriority: template.djUtilityPriority,
    cinematicIntensity: template.cinematicIntensity,
    aggressionLevel: template.aggressionLevel,
    emotionalTone: template.emotionalTone,
    mood: template.mood,
    focus: template.focus,
    mixConcerns: [...template.mixConcerns],
    referenceNotes: [...template.referenceNotes],
  };

  return createWorkspace({
    outputDir: input.outputDir,
    name: input.name,
    artistName: input.artistName,
    bpmRange: input.bpmRange,
    defaults,
  });
}

// ─── Validation ─────────────────────────────────────────────────────────────────

function validateBpmRange(range: BpmRange): void {
  if (range.min < 100 || range.max > 200) {
    throw new Error(`BPM range must be within 100–200 (got ${range.min}–${range.max})`);
  }
  if (range.min > range.max) {
    throw new Error(`BPM range min (${range.min}) cannot exceed max (${range.max})`);
  }
}

function validateTempoInRange(tempo: number, range: BpmRange): void {
  if (tempo < range.min || tempo > range.max) {
    throw new Error(
      `Tempo ${tempo} is outside workspace BPM range ${range.min}–${range.max}`,
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function pick<T>(override: T | undefined, base: T | undefined): T | undefined {
  return override !== undefined ? override : base;
}

function pickArray(override: string[] | undefined, base: string[] | undefined): string[] | undefined {
  if (override?.length) return [...override];
  if (base?.length) return [...base];
  return undefined;
}

function pickRecord(
  override: Record<string, string> | undefined,
  base: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (override && Object.keys(override).length) return { ...override };
  if (base && Object.keys(base).length) return { ...base };
  return undefined;
}
