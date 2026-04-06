
// ─── Fornix Studio MCP – Production Package Tools ────────────────────────────
//
// File-first hardstyle production package generation and selective regeneration.
// No live Studio One dependency.

import fs from "fs";
import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { guardPath } from "../services/workspace.js";
import { logAction, formatToolResult } from "../services/logger.js";
import {
  type PreviewPackageUpdateInput,
  type ProductionPackageInput,
  type RegeneratePackageSectionInput,
  type BatchRegenerateInput,
  PACKAGE_GENERATOR_TOOL,
  PACKAGE_METADATA_LAYOUT,
  PACKAGE_PLAN_TOOL,
  PACKAGE_PREVIEW_TOOL,
  PACKAGE_REGEN_TOOL,
  PACKAGE_BATCH_REGEN_TOOL,
  batchRegeneratePackage,
  buildMixActions,
  getPackageSummary,
  planPackageUpdate,
  previewPackageUpdate,
  regenerateProductionPackageSection,
  renderMixActionsMarkdown,
  slugifyTrackName,
  writeProductionPackage,
} from "../services/production-package.js";
import {
  type TemplateCategory,
  getTemplate,
  listTemplates,
} from "../services/template-library.js";

const styleVariantSchema = z.enum([
  "cinematic-euphoric",
  "rawphoric",
  "anthemic-euphoric",
  "festival-hardstyle",
]);

const leadStyleSchema = z.enum(["euphoric", "screech", "hybrid"]);

const dropStrategySchema = z.enum([
  "anti-climax-to-melodic",
  "melodic-then-anti-climax",
  "double-anti-climax",
  "festival-main-drop",
]);

const energyProfileSchema = z.enum([
  "patient-cinematic",
  "steady-escalation",
  "front-loaded",
  "late-payoff",
]);

const packageSectionSchema = z.enum([
  "project_plan",
  "routing",
  "automation",
  "mix",
  "sound_design",
  "checklist",
]);

const productionPackageInputShape = {
  outputDir: z.string().describe("Base output directory inside the allowed workspace"),
  trackName: z.string().min(1).describe("Hardstyle track working title"),
  artistName: z.string().default("Fornix").describe("Artist/project name"),
  tempo: z.number().int().min(135).max(170).default(150).describe("Target BPM"),
  keySignature: z.string().default("F# minor").describe("Musical key or tonal center"),
  styleVariant: styleVariantSchema.default("cinematic-euphoric"),
  leadStyle: leadStyleSchema.default("hybrid"),
  dropStrategy: dropStrategySchema.default("anti-climax-to-melodic"),
  energyProfile: energyProfileSchema.default("steady-escalation"),
  targetBars: z.number().int().min(128).max(256).default(160).describe("Target arrangement length in bars"),
  creativeBrief: z.string().optional().describe("Short custom brief for the package"),
  mixConcerns: z.array(z.string()).optional().describe("Specific mix concerns to reflect in the mix report"),
  signatureHooks: z.array(z.string()).optional().describe("Named hooks or motifs to keep central to the package"),
  mood: z.string().optional().describe("Overall mood descriptor"),
  focus: z.string().optional().describe("Primary production focus"),
  concerns: z.array(z.string()).optional().describe("General track concerns to keep visible in package output"),
  substyle: z.string().optional().describe("Substyle descriptor such as rawphoric or cinematic euphoric"),
  kickStyle: z.string().optional().describe("Kick style intent"),
  antiClimaxStyle: z.string().optional().describe("Anti-climax style intent"),
  arrangementFocus: z.string().optional().describe("Arrangement focus or pacing intent"),
  vocalMode: z.string().optional().describe("Instrumental, featured-vocal, vocal-chops, spoken-texture, etc."),
  djUtilityPriority: z.string().optional().describe("Low, medium, high, or a custom DJ utility note"),
  referenceNotes: z.array(z.string()).optional().describe("Reference notes or direction reminders"),
  sectionGoals: z.record(z.string()).optional().describe("Section-specific goals keyed by section name"),
  cinematicIntensity: z.string().optional().describe("Low, medium, high, or a custom cinematic intensity note"),
  aggressionLevel: z.string().optional().describe("Low, medium, high, or a custom aggression note"),
  emotionalTone: z.string().optional().describe("Emotional tone descriptor"),
} satisfies Record<keyof ProductionPackageInput, z.ZodTypeAny>;

const productionPackageSchema = z.object(productionPackageInputShape);

const packageRevisionShape = {
  packagePath: z.string().optional().describe("Existing package root, e.g. /workspace/Fornix/track-slug"),
  outputDir: z.string().optional().describe("Base output directory if packagePath is not provided"),
  trackName: z.string().min(1).optional().describe("Track name used to locate the package when packagePath is omitted"),
  trackSlug: z.string().min(1).optional().describe("Track slug used to locate the package when packagePath is omitted"),
  section: packageSectionSchema.describe("Document family to regenerate"),
  artistName: z.string().optional(),
  tempo: z.number().int().min(135).max(170).optional(),
  keySignature: z.string().optional(),
  styleVariant: styleVariantSchema.optional(),
  leadStyle: leadStyleSchema.optional(),
  dropStrategy: dropStrategySchema.optional(),
  energyProfile: energyProfileSchema.optional(),
  targetBars: z.number().int().min(128).max(256).optional(),
  creativeBrief: z.string().optional(),
  mixConcerns: z.array(z.string()).optional(),
  signatureHooks: z.array(z.string()).optional(),
  mood: z.string().optional(),
  focus: z.string().optional(),
  concerns: z.array(z.string()).optional(),
  substyle: z.string().optional(),
  kickStyle: z.string().optional(),
  antiClimaxStyle: z.string().optional(),
  arrangementFocus: z.string().optional(),
  vocalMode: z.string().optional(),
  djUtilityPriority: z.string().optional(),
  referenceNotes: z.array(z.string()).optional(),
  sectionGoals: z.record(z.string()).optional(),
  cinematicIntensity: z.string().optional(),
  aggressionLevel: z.string().optional(),
  emotionalTone: z.string().optional(),
};

const packageRevisionSchema = z.object(packageRevisionShape).superRefine((input, ctx) => {
  if (!input.packagePath && !input.outputDir) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide packagePath or outputDir.",
      path: ["packagePath"],
    });
  }

  if (!input.packagePath && !input.trackName && !input.trackSlug) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "When packagePath is omitted, provide trackName or trackSlug.",
      path: ["trackName"],
    });
  }
});

const { section: _packageSection, ...packageUpdateInputShape } = packageRevisionShape;

const packageUpdateSchema = z.object(packageUpdateInputShape).superRefine((input, ctx) => {
  if (!input.packagePath && !input.outputDir) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide packagePath or outputDir.",
      path: ["packagePath"],
    });
  }

  if (!input.packagePath && !input.trackName && !input.trackSlug) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "When packagePath is omitted, provide trackName or trackSlug.",
      path: ["trackName"],
    });
  }
});

const packageLocatorInputShape = {
  packagePath: z.string().optional().describe("Existing package root, e.g. /workspace/Fornix/track-slug"),
  outputDir: z.string().optional().describe("Base output directory if packagePath is not provided"),
  trackName: z.string().min(1).optional().describe("Track name used to locate the package when packagePath is omitted"),
  trackSlug: z.string().min(1).optional().describe("Track slug used to locate the package when packagePath is omitted"),
};

const packageLocatorSchema = z.object(packageLocatorInputShape).superRefine((input, ctx) => {
  if (!input.packagePath && !input.outputDir) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide packagePath or outputDir.",
      path: ["packagePath"],
    });
  }

  if (!input.packagePath && !input.trackName && !input.trackSlug) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "When packagePath is omitted, provide trackName or trackSlug.",
      path: ["trackName"],
    });
  }
});

function guardLocatorPath(input: { packagePath?: string; outputDir?: string; trackName?: string; trackSlug?: string }) {
  if (input.packagePath) {
    return {
      packagePath: guardPath(input.packagePath),
      trackName: input.trackName,
      trackSlug: input.trackSlug,
    };
  }

  return {
    outputDir: input.outputDir ? guardPath(input.outputDir) : undefined,
    trackName: input.trackName,
    trackSlug: input.trackSlug,
  };
}

export function registerProductionPackageTools(server: McpServer): void {
  server.registerTool("fornix_generate_production_package", {
    title: "Generate Production Package",
    description:
      "Generate and save a full file-based Fornix hardstyle production package. " +
      "Writes Package_Metadata.json plus Project Plan, Routing Sheet, Automation Blueprint, Mix Report, Sound Design Pack, and Producer Checklist " +
      "to a standardized workspace folder structure. No live Studio One bridge required.",
    inputSchema: productionPackageInputShape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async (rawInput) => {
    try {
      const input = productionPackageSchema.parse(rawInput);
      const outputDir = guardPath(input.outputDir);
      const result = writeProductionPackage({ ...input, outputDir });

      const summary =
        `Production package written for "${input.trackName}" ` +
        `(metadata + ${Object.keys(result.files).length} document files, file-based workflow only)`;

      logAction({
        tool: "fornix_generate_production_package",
        action: "write",
        target: result.packageRoot,
        summary,
        dryRun: false,
        ok: true,
      });

      return {
        content: [{
          type: "text",
          text: formatToolResult(true, summary, {
            packageRoot: result.packageRoot,
            metadataPath: result.metadataPath,
            metadataDir: PACKAGE_METADATA_LAYOUT.dir,
            files: result.files,
            mixActions: result.mixActions.length,
            bridgeDependency: "none",
          }),
        }],
      };
    } catch (e) {
      const err = String(e);
      logAction({
        tool: "fornix_generate_production_package",
        action: "write",
        summary: err,
        dryRun: false,
        ok: false,
        error: err,
      });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });

  server.registerTool("fornix_generate_mix_actions", {
    title: "Generate Mix Actions",
    description:
      "Generate an actionable hardstyle mix action list using a fixed format: section, likely issue, why it matters, exact action to test, priority. " +
      "Can return the report in chat and optionally save it as Mix_Report.md inside a workspace folder.",
    inputSchema: {
      trackName: productionPackageInputShape.trackName,
      artistName: productionPackageInputShape.artistName,
      tempo: productionPackageInputShape.tempo,
      keySignature: productionPackageInputShape.keySignature,
      styleVariant: productionPackageInputShape.styleVariant,
      leadStyle: productionPackageInputShape.leadStyle,
      dropStrategy: productionPackageInputShape.dropStrategy,
      energyProfile: productionPackageInputShape.energyProfile,
      targetBars: productionPackageInputShape.targetBars,
      mixConcerns: productionPackageInputShape.mixConcerns,
      mood: productionPackageInputShape.mood,
      focus: productionPackageInputShape.focus,
      concerns: productionPackageInputShape.concerns,
      substyle: productionPackageInputShape.substyle,
      kickStyle: productionPackageInputShape.kickStyle,
      antiClimaxStyle: productionPackageInputShape.antiClimaxStyle,
      arrangementFocus: productionPackageInputShape.arrangementFocus,
      vocalMode: productionPackageInputShape.vocalMode,
      djUtilityPriority: productionPackageInputShape.djUtilityPriority,
      referenceNotes: productionPackageInputShape.referenceNotes,
      sectionGoals: productionPackageInputShape.sectionGoals,
      cinematicIntensity: productionPackageInputShape.cinematicIntensity,
      aggressionLevel: productionPackageInputShape.aggressionLevel,
      emotionalTone: productionPackageInputShape.emotionalTone,
      outputDir: z.string().optional().describe("Optional output directory to save Mix_Report.md"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async (rawInput) => {
    try {
      const input = z.object({
        trackName: productionPackageInputShape.trackName,
        artistName: productionPackageInputShape.artistName,
        tempo: productionPackageInputShape.tempo,
        keySignature: productionPackageInputShape.keySignature,
        styleVariant: productionPackageInputShape.styleVariant,
        leadStyle: productionPackageInputShape.leadStyle,
        dropStrategy: productionPackageInputShape.dropStrategy,
        energyProfile: productionPackageInputShape.energyProfile,
        targetBars: productionPackageInputShape.targetBars,
        mixConcerns: productionPackageInputShape.mixConcerns,
        mood: productionPackageInputShape.mood,
        focus: productionPackageInputShape.focus,
        concerns: productionPackageInputShape.concerns,
        substyle: productionPackageInputShape.substyle,
        kickStyle: productionPackageInputShape.kickStyle,
        antiClimaxStyle: productionPackageInputShape.antiClimaxStyle,
        arrangementFocus: productionPackageInputShape.arrangementFocus,
        vocalMode: productionPackageInputShape.vocalMode,
        djUtilityPriority: productionPackageInputShape.djUtilityPriority,
        referenceNotes: productionPackageInputShape.referenceNotes,
        sectionGoals: productionPackageInputShape.sectionGoals,
        cinematicIntensity: productionPackageInputShape.cinematicIntensity,
        aggressionLevel: productionPackageInputShape.aggressionLevel,
        emotionalTone: productionPackageInputShape.emotionalTone,
        outputDir: z.string().optional(),
      }).parse(rawInput);

      const baseInput: ProductionPackageInput = {
        ...input,
        outputDir: input.outputDir ?? ".",
        creativeBrief: undefined,
        signatureHooks: undefined,
      };

      const mixActions = buildMixActions(baseInput);
      const markdown = renderMixActionsMarkdown(input.trackName, mixActions, new Date().toISOString());
      let savedPath: string | null = null;

      if (input.outputDir) {
        const outputDir = guardPath(input.outputDir);
        const mixDir = path.join(outputDir, "Fornix", slugifyTrackName(input.trackName), "04_Mix");
        fs.mkdirSync(mixDir, { recursive: true });
        savedPath = path.join(mixDir, "Mix_Report.md");
        fs.writeFileSync(savedPath, markdown, "utf8");
      }

      const summary = `Generated ${mixActions.length} actionable mix item(s) for "${input.trackName}"`;
      logAction({
        tool: "fornix_generate_mix_actions",
        action: input.outputDir ? "write" : "plan",
        target: savedPath ?? undefined,
        summary,
        dryRun: false,
        ok: true,
      });

      return {
        content: [{
          type: "text",
          text: formatToolResult(true, summary, {
            savedPath,
            priorities: mixActions.map((action) => ({
              priority: action.priority,
              section: action.section ?? null,
              area: action.area,
              likelyIssue: action.likelyIssue,
              exactActionToTest: action.exactActionToTest,
            })),
            report: markdown,
          }),
        }],
      };
    } catch (e) {
      const err = String(e);
      logAction({
        tool: "fornix_generate_mix_actions",
        action: "plan",
        summary: err,
        dryRun: false,
        ok: false,
        error: err,
      });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });


  server.registerTool("fornix_preview_package_update", {
    title: "Preview Package Update",
    description:
      "Read an existing file-based Fornix production package, compare revised profile inputs against Package_Metadata.json, and preview which sections would likely need regeneration without writing files.",
    inputSchema: packageUpdateInputShape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (rawInput) => {
    try {
      const parsed = packageUpdateSchema.parse(rawInput);
      const guarded = guardLocatorPath(parsed);
      const result = previewPackageUpdate({ ...parsed, ...guarded } satisfies PreviewPackageUpdateInput);

      const trackName = result.packageSummary.metadata?.trackName ?? parsed.trackName ?? result.packageSummary.trackSlug;
      const summary =
        result.changedProfileFields.length > 0
          ? `Previewed package update for "${trackName}" (${result.recommendedSections.length} recommended sections, read-only).`
          : `Previewed package update for "${trackName}" (no profile changes detected, read-only).`;

      logAction({
        tool: PACKAGE_PREVIEW_TOOL,
        action: "read",
        target: result.packageRoot,
        summary,
        dryRun: true,
        ok: true,
      });

      return {
        content: [{
          type: "text",
          text: formatToolResult(true, summary, {
            targetPackagePath: result.targetPackagePath,
            currentPackageComplete: result.currentPackageComplete,
            changedProfileFields: result.changedProfileFields,
            recommendedSections: result.recommendedSections,
            primarySections: result.primarySections,
            secondarySections: result.secondarySections,
            optionalSections: result.optionalSections,
            sectionPlans: result.sectionPlans,
            metadataWouldChange: result.metadataWouldChange,
            packageCompleteness: result.packageCompleteness,
            hasSectionOverrides: result.hasSectionOverrides,
            overriddenSections: result.overriddenSections,
            packageHealth: result.packageHealth,
            packageConsistencySummary: result.packageConsistencySummary,
            packageLevelProfileWouldChange: result.packageLevelProfileWouldChange,
            wouldIntroduceSectionOverrides: result.wouldIntroduceSectionOverrides,
            wouldLeaveSectionOverrides: result.wouldLeaveSectionOverrides,
            overrideImpactSummary: result.overrideImpactSummary,
          }, true),
        }],
      };
    } catch (e) {
      const err = String(e);
      logAction({
        tool: PACKAGE_PREVIEW_TOOL,
        action: "read",
        summary: err,
        dryRun: true,
        ok: false,
        error: err,
      });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });

  server.registerTool("fornix_plan_package_update", {
    title: "Plan Package Update",
    description:
      "Read an existing file-based Fornix production package, detect changed profile inputs, and rank which sections should be regenerated first. Read-only and bridge-independent.",
    inputSchema: packageUpdateInputShape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (rawInput) => {
    try {
      const parsed = packageUpdateSchema.parse(rawInput);
      const guarded = guardLocatorPath(parsed);
      const result = planPackageUpdate({ ...parsed, ...guarded } satisfies PreviewPackageUpdateInput);

      const trackName = result.packageSummary.metadata?.trackName ?? parsed.trackName ?? result.packageSummary.trackSlug;
      const summary =
        result.changedProfileFields.length > 0
          ? `Planned package update for "${trackName}" (${result.primarySections.length} primary, ${result.secondarySections.length} secondary, ${result.optionalSections.length} optional sections).`
          : `Planned package update for "${trackName}" (no profile changes detected).`;

      logAction({
        tool: PACKAGE_PLAN_TOOL,
        action: "read",
        target: result.packageRoot,
        summary,
        dryRun: true,
        ok: true,
      });

      return {
        content: [{
          type: "text",
          text: formatToolResult(true, summary, {
            targetPackagePath: result.targetPackagePath,
            currentPackageComplete: result.currentPackageComplete,
            changedProfileFields: result.changedProfileFields,
            recommendedSections: result.recommendedSections,
            primarySections: result.primarySections,
            secondarySections: result.secondarySections,
            optionalSections: result.optionalSections,
            priorityReasoning: result.sectionPlans,
            metadataWouldChange: result.metadataWouldChange,
            packageCompleteness: result.packageCompleteness,
            hasSectionOverrides: result.hasSectionOverrides,
            overriddenSections: result.overriddenSections,
            packageHealth: result.packageHealth,
            packageConsistencySummary: result.packageConsistencySummary,
            packageLevelProfileWouldChange: result.packageLevelProfileWouldChange,
            wouldIntroduceSectionOverrides: result.wouldIntroduceSectionOverrides,
            wouldLeaveSectionOverrides: result.wouldLeaveSectionOverrides,
            overrideImpactSummary: result.overrideImpactSummary,
          }, true),
        }],
      };
    } catch (e) {
      const err = String(e);
      logAction({
        tool: PACKAGE_PLAN_TOOL,
        action: "read",
        summary: err,
        dryRun: true,
        ok: false,
        error: err,
      });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });

  server.registerTool("fornix_regenerate_package_section", {
    title: "Regenerate Package Section",
    description:
      "Regenerate one selected production package document family at a time from an existing package. " +
      "Loads Package_Metadata.json, merges revised inputs if provided, rewrites only the targeted section, and updates metadata honestly.",
    inputSchema: packageRevisionShape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async (rawInput) => {
    try {
      const parsed = packageRevisionSchema.parse(rawInput);
      const guarded = guardLocatorPath(parsed);

      const result = regenerateProductionPackageSection({
        ...parsed,
        ...guarded,
      } satisfies RegeneratePackageSectionInput);

      const justification =
        result.sectionJustifyingProfileFields.length > 0
          ? ` driven by ${result.sectionJustifyingProfileFields.join(", ")}`
          : "";
      const priorityNote = result.updatedSectionPriority ? ` (${result.updatedSectionPriority} priority)` : "";
      const summary =
        `Regenerated ${parsed.section} for "${result.metadata.trackName}"${priorityNote}${justification} without touching the other package documents.`;

      logAction({
        tool: PACKAGE_REGEN_TOOL,
        action: "write",
        target: result.updatedFile,
        summary,
        dryRun: false,
        ok: true,
      });

      return {
        content: [{
          type: "text",
          text: formatToolResult(true, summary, {
            packageRoot: result.packageRoot,
            updatedSection: result.updatedSection,
            updatedFile: result.updatedFile,
            updatedSectionPriority: result.updatedSectionPriority,
            changedProfileFields: result.changedProfileFields,
            sectionJustifyingProfileFields: result.sectionJustifyingProfileFields,
            sectionRecommendationReasons: result.sectionRecommendationReasons,
            remainingRecommendedSections: result.remainingRecommendedSections,
            untouchedFiles: result.untouchedFiles,
            metadataPath: result.metadataPath,
            metadataUpdatedFields: result.metadataUpdatedFields,
            lastUpdatedTimestamp: result.metadata.lastUpdatedTimestamp,
            updatedSections: result.metadata.updatedSections,
            packageLevelProfileRemainsUnchanged: result.packageLevelProfileRemainsUnchanged,
            hasSectionOverridesAfterUpdate: result.hasSectionOverridesAfterUpdate,
            overriddenSectionsAfterUpdate: result.overriddenSectionsAfterUpdate,
            packageHealthAfterUpdate: result.packageHealthAfterUpdate,
            packageConsistencySummaryAfterUpdate: result.packageConsistencySummaryAfterUpdate,
          }),
        }],
      };
    } catch (e) {
      const err = String(e);
      logAction({
        tool: "fornix_regenerate_package_section",
        action: "write",
        summary: err,
        dryRun: false,
        ok: false,
        error: err,
      });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });

  server.registerTool("fornix_get_package_summary", {
    title: "Get Package Summary",
    description:
      "Read an existing file-based Fornix production package and report its identity, metadata, existing documents, timestamps, completeness, section override state, and package health. " +
      "Read-only and independent from the Studio One bridge.",
    inputSchema: packageLocatorInputShape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (rawInput) => {
    try {
      const parsed = packageLocatorSchema.parse(rawInput);
      const guarded = guardLocatorPath(parsed);
      const summaryData = getPackageSummary({ ...parsed, ...guarded });

      const trackName = summaryData.metadata?.trackName ?? parsed.trackName ?? summaryData.trackSlug;
      const summary = `Read package summary for "${trackName}" (${summaryData.complete ? "complete" : "partial"} package).`;

      logAction({
        tool: "fornix_get_package_summary",
        action: "read",
        target: summaryData.packageRoot,
        summary,
        dryRun: false,
        ok: true,
      });

      return {
        content: [{
          type: "text",
          text: formatToolResult(true, summary, {
            packageRoot: summaryData.packageRoot,
            packageFormatVersion: summaryData.packageFormatVersion,
            metadataPath: summaryData.metadataPath,
            metadataExists: summaryData.metadataExists,
            trackIdentity: summaryData.metadata ? {
              trackName: summaryData.metadata.trackName,
              trackSlug: summaryData.metadata.trackSlug,
              artistName: summaryData.metadata.artistName,
            } : null,
            styleProfile: summaryData.metadata ? {
              styleVariant: summaryData.metadata.styleVariant,
              leadStyle: summaryData.metadata.leadStyle,
              dropStrategy: summaryData.metadata.dropStrategy,
              energyProfile: summaryData.metadata.energyProfile,
              substyle: summaryData.metadata.substyle ?? null,
              kickStyle: summaryData.metadata.kickStyle ?? null,
              antiClimaxStyle: summaryData.metadata.antiClimaxStyle ?? null,
              vocalMode: summaryData.metadata.vocalMode ?? null,
              djUtilityPriority: summaryData.metadata.djUtilityPriority ?? null,
            } : null,
            generationTimestamp: summaryData.generationTimestamp,
            lastUpdatedTimestamp: summaryData.lastUpdatedTimestamp,
            complete: summaryData.complete,
            packageCompleteness: summaryData.packageCompleteness,
            hasSectionOverrides: summaryData.hasSectionOverrides,
            overriddenSections: summaryData.overriddenSections,
            packageHealth: summaryData.packageHealth,
            packageConsistencySummary: summaryData.packageConsistencySummary,
            sectionResolvedProfiles: summaryData.metadata?.sectionResolvedProfiles ?? null,
            existingDocuments: summaryData.existingDocuments,
            missingDocuments: summaryData.missingDocuments,
            documents: summaryData.documents,
          }),
        }],
      };
    } catch (e) {
      const err = String(e);
      logAction({
        tool: "fornix_get_package_summary",
        action: "read",
        summary: err,
        dryRun: false,
        ok: false,
        error: err,
      });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });

  // ── fornix_batch_regenerate_package ─────────────────────────────────────────
  server.registerTool("fornix_batch_regenerate_package", {
    title: "Batch Regenerate Package",
    description:
      "Apply an entire update plan in one call: regenerate multiple (or all) sections of an existing production package. " +
      "If sections are not specified, regenerates all recommended sections from the update plan. " +
      "Metadata is updated once after all sections are processed.",
    inputSchema: {
      ...packageUpdateInputShape,
      sections: z.array(packageSectionSchema).optional()
        .describe("Sections to regenerate (default: all recommended from update plan)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async (rawInput) => {
    try {
      const { sections, ...rest } = rawInput;
      const parsed = packageUpdateSchema.parse(rest);
      const guarded = guardLocatorPath(parsed);

      const result = batchRegeneratePackage({
        ...parsed,
        ...guarded,
        sections: sections as BatchRegenerateInput["sections"],
      });

      const trackName = result.metadata.trackName;
      const summary =
        `Batch regenerated ${result.regeneratedSections.length} sections for "${trackName}"` +
        (result.skippedSections.length > 0 ? ` (${result.skippedSections.length} skipped)` : "");

      logAction({
        tool: PACKAGE_BATCH_REGEN_TOOL,
        action: "write",
        target: result.packageRoot,
        summary,
        dryRun: false,
        ok: true,
      });

      return {
        content: [{
          type: "text",
          text: formatToolResult(true, summary, {
            packageRoot: result.packageRoot,
            regeneratedSections: result.regeneratedSections,
            skippedSections: result.skippedSections,
            updatedFiles: result.updatedFiles,
            changedProfileFields: result.changedProfileFields,
            metadataPath: result.metadataPath,
            packageHealth: result.packageSummary.packageHealth,
            packageConsistencySummary: result.packageSummary.packageConsistencySummary,
          }),
        }],
      };
    } catch (e) {
      const err = String(e);
      logAction({
        tool: PACKAGE_BATCH_REGEN_TOOL,
        action: "write",
        summary: err,
        dryRun: false,
        ok: false,
        error: err,
      });
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });

  // ── fornix_list_templates ──────────────────────────────────────────────────
  server.registerTool("fornix_list_templates", {
    title: "List Production Templates",
    description:
      "List available pre-built production templates for common hardstyle scenarios. " +
      "Optionally filter by category (euphoric, raw, cinematic, festival, hybrid).",
    inputSchema: {
      category: z.enum(["euphoric", "raw", "cinematic", "festival", "hybrid"]).optional()
        .describe("Filter templates by category"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (rawInput) => {
    try {
      const templates = listTemplates(rawInput.category as TemplateCategory | undefined);

      const lines: string[] = [
        `Templates: ${templates.length}${rawInput.category ? ` (${rawInput.category})` : ""}`,
        "",
      ];

      for (const t of templates) {
        lines.push(`  [${t.id}] ${t.name} (${t.category})`);
        lines.push(`    ${t.description}`);
      }

      logAction({
        tool: "fornix_list_templates",
        action: "read",
        summary: `Listed ${templates.length} templates`,
        dryRun: false,
        ok: true,
      });

      return {
        content: [{
          type: "text",
          text: formatToolResult(true, `${templates.length} templates available`, lines.join("\n")),
        }],
      };
    } catch (e) {
      const err = String(e);
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });

  // ── fornix_get_template ────────────────────────────────────────────────────
  server.registerTool("fornix_get_template", {
    title: "Get Production Template",
    description:
      "Get the full details of a specific production template by ID. " +
      "Returns all style defaults, creative brief, mix concerns, and reference notes.",
    inputSchema: {
      id: z.string().min(1).describe("Template ID (e.g. 'cinematic-euphoric-epic', 'rawphoric-banger')"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (rawInput) => {
    try {
      const template = getTemplate(rawInput.id);

      if (!template) {
        const available = listTemplates().map((t) => t.id).join(", ");
        return {
          content: [{
            type: "text",
            text: `✗ Template "${rawInput.id}" not found. Available: ${available}`,
          }],
          isError: true,
        };
      }

      logAction({
        tool: "fornix_get_template",
        action: "read",
        summary: `Retrieved template "${template.name}"`,
        dryRun: false,
        ok: true,
      });

      return {
        content: [{
          type: "text",
          text: formatToolResult(true, `Template: ${template.name}`, template),
        }],
      };
    } catch (e) {
      const err = String(e);
      return { content: [{ type: "text", text: `✗ ${err}` }], isError: true };
    }
  });
}
