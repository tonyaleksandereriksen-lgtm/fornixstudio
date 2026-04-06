
// ─── Fornix Studio MCP – Template Library ───────────────────────────────────────
//
// Pre-built creative brief templates for common hardstyle production scenarios.
// Each template provides a complete set of style defaults + creative direction
// that can be used to populate workspace defaults or individual track profiles.

import type {
  DropStrategy,
  EnergyProfile,
  LeadStyle,
  StyleVariant,
} from "./production-package.js";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ProductionTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  styleVariant: StyleVariant;
  leadStyle: LeadStyle;
  dropStrategy: DropStrategy;
  energyProfile: EnergyProfile;
  keySignature: string;
  targetBars: number;
  substyle: string;
  kickStyle: string;
  antiClimaxStyle: string;
  arrangementFocus: string;
  vocalMode: string;
  djUtilityPriority: string;
  cinematicIntensity: string;
  aggressionLevel: string;
  emotionalTone: string;
  mood: string;
  focus: string;
  creativeBrief: string;
  mixConcerns: string[];
  referenceNotes: string[];
}

export type TemplateCategory =
  | "euphoric"
  | "raw"
  | "cinematic"
  | "festival"
  | "hybrid";

// ─── Template library ───────────────────────────────────────────────────────────

const TEMPLATES: ProductionTemplate[] = [
  {
    id: "cinematic-euphoric-epic",
    name: "Cinematic Euphoric Epic",
    description: "Long-form cinematic build with emotional payoff — patient tension, cathedral atmosphere, euphoric climax",
    category: "cinematic",
    styleVariant: "cinematic-euphoric",
    leadStyle: "euphoric",
    dropStrategy: "anti-climax-to-melodic",
    energyProfile: "patient-cinematic",
    keySignature: "F# minor",
    targetBars: 192,
    substyle: "cinematic-euphoric",
    kickStyle: "clean hardstyle tok with controlled body and mono tail discipline",
    antiClimaxStyle: "controlled anti-climax with melodic contrast",
    arrangementFocus: "long-form tension and reveal",
    vocalMode: "featured-vocal",
    djUtilityPriority: "medium",
    cinematicIntensity: "high",
    aggressionLevel: "low",
    emotionalTone: "melancholic with hopeful resolution",
    mood: "cinematic grandeur with emotional depth",
    focus: "atmospheric build and euphoric payoff",
    creativeBrief: "Build a cinematic world in the intro, let the tension breathe, and deliver a euphoric climax that earns its impact through patience.",
    mixConcerns: ["reverb wash before drops", "lead width vs kick clarity", "pad buildup masking"],
    referenceNotes: ["intro must feel cinematic not filler", "save widest lead for final payoff"],
  },
  {
    id: "rawphoric-banger",
    name: "Rawphoric Banger",
    description: "Aggressive raw energy with screech leads and hostile anti-climax — front-loaded impact, relentless drive",
    category: "raw",
    styleVariant: "rawphoric",
    leadStyle: "screech",
    dropStrategy: "double-anti-climax",
    energyProfile: "front-loaded",
    keySignature: "E minor",
    targetBars: 160,
    substyle: "rawphoric",
    kickStyle: "hard transient tok with gritty tail control",
    antiClimaxStyle: "aggressive screech-led anti-climax",
    arrangementFocus: "fast payoff and direct impact",
    vocalMode: "instrumental",
    djUtilityPriority: "high",
    cinematicIntensity: "low",
    aggressionLevel: "high",
    emotionalTone: "hostile and relentless",
    mood: "dark aggression with controlled chaos",
    focus: "kick impact and screech dominance",
    creativeBrief: "No patience needed — hit hard from the first drop. Double anti-climax structure keeps pressure constant. Screech leads carry the aggression.",
    mixConcerns: ["kick tail against reverse bass", "screech harshness in climax", "low-end mono discipline"],
    referenceNotes: ["kick must punch through at festival volume", "screech needs presence without fatigue"],
  },
  {
    id: "anthemic-festival",
    name: "Anthemic Festival",
    description: "Big-room festival anthem with singalong hooks — melodic drops, high DJ utility, crowd-ready arrangement",
    category: "festival",
    styleVariant: "festival-hardstyle",
    leadStyle: "euphoric",
    dropStrategy: "festival-main-drop",
    energyProfile: "steady-escalation",
    keySignature: "G minor",
    targetBars: 160,
    substyle: "festival-hardstyle",
    kickStyle: "clean hardstyle tok with controlled body and mono tail discipline",
    antiClimaxStyle: "controlled anti-climax with melodic contrast",
    arrangementFocus: "steady lift with controlled contrast",
    vocalMode: "featured-vocal",
    djUtilityPriority: "high",
    cinematicIntensity: "medium",
    aggressionLevel: "low",
    emotionalTone: "uplifting and triumphant",
    mood: "festival energy with euphoric peaks",
    focus: "hook memorability and crowd singalong",
    creativeBrief: "Festival-ready anthem built for big rooms. Vocal hook is the centerpiece. Every section serves the singalong moment. DJ-friendly intro/outro.",
    mixConcerns: ["vocal clarity against lead", "kick punch at festival SPL", "transition energy maintenance"],
    referenceNotes: ["vocal hook must be instantly memorable", "build sections should feel like crowd anticipation"],
  },
  {
    id: "hybrid-dark-melodic",
    name: "Hybrid Dark Melodic",
    description: "Dark melodic hybrid with screech-euphoric blend — anti-climax tension into emotional melodic payoff",
    category: "hybrid",
    styleVariant: "anthemic-euphoric",
    leadStyle: "hybrid",
    dropStrategy: "anti-climax-to-melodic",
    energyProfile: "late-payoff",
    keySignature: "D minor",
    targetBars: 176,
    substyle: "dark melodic hybrid",
    kickStyle: "clean hardstyle tok with controlled body and mono tail discipline",
    antiClimaxStyle: "aggressive screech-led anti-climax",
    arrangementFocus: "long-form tension and reveal",
    vocalMode: "spoken-texture",
    djUtilityPriority: "medium",
    cinematicIntensity: "medium",
    aggressionLevel: "medium",
    emotionalTone: "melancholic but violent",
    mood: "dark tension with emotional contrast",
    focus: "drop contrast and hook clarity",
    creativeBrief: "Dark hybrid that blends raw aggression with melodic depth. Anti-climax drops carry the hostility, final melodic payoff carries the emotion. The contrast IS the hook.",
    mixConcerns: ["screech-to-melodic transition smoothness", "kick tail against reverse bass", "wet FX before drops"],
    referenceNotes: ["anti-climax must feel intentionally hostile", "melodic payoff should feel earned not sudden"],
  },
  {
    id: "euphoric-classic",
    name: "Euphoric Classic",
    description: "Traditional euphoric hardstyle with clean melodic leads — steady escalation, proven arrangement, timeless sound",
    category: "euphoric",
    styleVariant: "cinematic-euphoric",
    leadStyle: "euphoric",
    dropStrategy: "melodic-then-anti-climax",
    energyProfile: "steady-escalation",
    keySignature: "A minor",
    targetBars: 160,
    substyle: "classic euphoric",
    kickStyle: "clean hardstyle tok with controlled body and mono tail discipline",
    antiClimaxStyle: "controlled anti-climax with melodic contrast",
    arrangementFocus: "steady lift with controlled contrast",
    vocalMode: "featured-vocal",
    djUtilityPriority: "high",
    cinematicIntensity: "medium",
    aggressionLevel: "low",
    emotionalTone: "uplifting with nostalgic warmth",
    mood: "classic euphoric energy",
    focus: "melodic lead clarity and emotional arc",
    creativeBrief: "Classic euphoric formula executed cleanly. Melodic lead carries the track. Steady escalation with no gimmicks. Prove the fundamentals work.",
    mixConcerns: ["lead stereo width vs mono compatibility", "reverb tail management", "kick clarity under dense leads"],
    referenceNotes: ["lead melody should work standalone", "arrangement follows proven euphoric formula"],
  },
];

// ─── Public API ─────────────────────────────────────────────────────────────────

export function listTemplates(category?: TemplateCategory): ProductionTemplate[] {
  if (category) {
    return TEMPLATES.filter((t) => t.category === category);
  }
  return [...TEMPLATES];
}

export function getTemplate(id: string): ProductionTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function getTemplateCategories(): TemplateCategory[] {
  return [...new Set(TEMPLATES.map((t) => t.category))];
}
