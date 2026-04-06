// ─── Fornix Studio MCP – Arrangement Analysis ────────────────────────────────
//
// Derives section structure from song file probe data or manual input,
// then produces actionable arrangement consultation.

import type { SongFileResult, Marker } from "./song-file.js";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface Section {
  name: string;
  startBar: number;
  lengthBars: number;
  lengthSeconds: number;
}

export interface TempoEvent {
  bar: number;
  tempo: number;
}

export interface Gap {
  afterSection: string;
  startBar: number;
  lengthBars: number;
}

export interface SectionFlag {
  section: string;
  startBar: number;
  flag: "too-short" | "too-long" | "ok" | "identical-length";
  detail: string;
}

export interface ArrangementSummary {
  sections: Section[];
  totalLengthBars: number;
  totalLengthSeconds: number;
  tempo: number;
  tempoMap: TempoEvent[];
  trackList: string[];
  sectionGaps: Gap[];
  sectionFlags: SectionFlag[];
}

export interface ManualSectionInput {
  name: string;
  lengthBars: number;
}

export interface ArrangementProblem {
  severity: "critical" | "warning" | "info";
  bar: number;
  section: string;
  problem: string;
}

export interface ArrangementAction {
  priority: number;
  targetBar: number;
  section: string;
  action: string;
}

export interface EnergyArc {
  assessment: string;
  phases: Array<{ name: string; bars: string; energyLevel: string }>;
  verdict: "strong" | "needs-work" | "broken";
}

export interface ArrangementAnalysis {
  summary: ArrangementSummary;
  sectionMap: Array<{
    name: string;
    bars: number;
    seconds: number;
    barRange: string;
    flag: string;
  }>;
  energyArc: EnergyArc;
  problems: ArrangementProblem[];
  actions: ArrangementAction[];
  parseEvidence: string;
}

// ─── Build summary from song file data ──────────────────────────────────────────

export function buildArrangementSummary(
  song: SongFileResult,
  fallbackTempo?: number,
): ArrangementSummary {
  const tempo = song.tempo ?? fallbackTempo ?? 150;
  const markers = [...song.markers].sort((a, b) => a.positionBars - b.positionBars);

  const sections = deriveSectionsFromMarkers(markers, tempo);
  const totalLengthBars = sections.reduce((sum, s) => sum + s.lengthBars, 0);

  return {
    sections,
    totalLengthBars,
    totalLengthSeconds: barsToSeconds(totalLengthBars, tempo),
    tempo,
    tempoMap: [{ bar: 1, tempo }],
    trackList: song.tracks.map((t) => t.name),
    sectionGaps: findGaps(sections),
    sectionFlags: flagSections(sections),
  };
}

// ─── Build summary from manual input ─────────────────────────────────────────────

export function buildArrangementFromManual(
  manualSections: ManualSectionInput[],
  tempo: number,
): ArrangementSummary {
  let currentBar = 1;
  const sections: Section[] = manualSections.map((s) => {
    const section: Section = {
      name: s.name,
      startBar: currentBar,
      lengthBars: s.lengthBars,
      lengthSeconds: barsToSeconds(s.lengthBars, tempo),
    };
    currentBar += s.lengthBars;
    return section;
  });

  const totalLengthBars = sections.reduce((sum, s) => sum + s.lengthBars, 0);

  return {
    sections,
    totalLengthBars,
    totalLengthSeconds: barsToSeconds(totalLengthBars, tempo),
    tempo,
    tempoMap: [{ bar: 1, tempo }],
    trackList: [],
    sectionGaps: findGaps(sections),
    sectionFlags: flagSections(sections),
  };
}

// ─── Full analysis ──────────────────────────────────────────────────────────────

export function analyzeArrangement(
  summary: ArrangementSummary,
  options: {
    genre?: string;
    targetLengthMinutes?: number;
    problemDescription?: string;
  } = {},
): ArrangementAnalysis {
  const genre = options.genre ?? "hardstyle";
  const targetLengthMinutes = options.targetLengthMinutes ?? 5.5;
  const targetLengthSeconds = targetLengthMinutes * 60;

  const sectionMap = summary.sections.map((s) => {
    const flag = summary.sectionFlags.find((f) => f.section === s.name && f.startBar === s.startBar);
    return {
      name: s.name,
      bars: s.lengthBars,
      seconds: Math.round(s.lengthSeconds * 10) / 10,
      barRange: `${s.startBar}–${s.startBar + s.lengthBars - 1}`,
      flag: flag?.flag ?? "ok",
    };
  });

  const energyArc = assessEnergyArc(summary.sections, genre);
  const problems = findProblems(summary, targetLengthSeconds, genre, options.problemDescription);
  const actions = deriveActions(problems, summary);

  const parseEvidence = [
    `Tempo: ${summary.tempo} BPM`,
    `Sections: ${summary.sections.length}`,
    `Total length: ${summary.totalLengthBars} bars (${formatTime(summary.totalLengthSeconds)})`,
    `Target length: ${formatTime(targetLengthSeconds)}`,
    `Tracks: ${summary.trackList.length || 0}`,
  ].join(" | ");

  return {
    summary,
    sectionMap,
    energyArc,
    problems: problems.slice(0, 10),
    actions: actions.slice(0, 10),
    parseEvidence,
  };
}

// ─── Section derivation ─────────────────────────────────────────────────────────

function deriveSectionsFromMarkers(markers: Marker[], tempo: number): Section[] {
  if (markers.length === 0) return [];

  const sections: Section[] = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].positionBars;
    const end = i < markers.length - 1
      ? markers[i + 1].positionBars
      : start + 16; // assume 16 bars for the last section

    const lengthBars = Math.round((end - start) * 100) / 100;
    sections.push({
      name: markers[i].name,
      startBar: Math.round(start * 100) / 100,
      lengthBars: Math.max(lengthBars, 0),
      lengthSeconds: barsToSeconds(lengthBars, tempo),
    });
  }

  return sections;
}

// ─── Gap detection ───────────────────────────────────────────────────────���──────

function findGaps(sections: Section[]): Gap[] {
  const gaps: Gap[] = [];
  for (let i = 0; i < sections.length - 1; i++) {
    const expectedNext = sections[i].startBar + sections[i].lengthBars;
    const actualNext = sections[i + 1].startBar;
    const gap = Math.round((actualNext - expectedNext) * 100) / 100;
    if (gap > 0.5) {
      gaps.push({
        afterSection: sections[i].name,
        startBar: expectedNext,
        lengthBars: gap,
      });
    }
  }
  return gaps;
}

// ─── Section flagging ───────────────────────────────────────────────────────���──

function flagSections(sections: Section[]): SectionFlag[] {
  const flags: SectionFlag[] = [];

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];

    // Transition cues (fills, risers, impacts) are naturally short — don't flag them
    if (s.lengthBars < 8 && s.lengthBars > 0 && !isTransitionCue(s.name)) {
      flags.push({
        section: s.name,
        startBar: s.startBar,
        flag: "too-short",
        detail: `${s.lengthBars} bars — most sections need at least 8 bars to establish an idea`,
      });
    } else if (s.lengthBars > 64) {
      flags.push({
        section: s.name,
        startBar: s.startBar,
        flag: "too-long",
        detail: `${s.lengthBars} bars — consider splitting into subsections for listener engagement`,
      });
    } else {
      flags.push({
        section: s.name,
        startBar: s.startBar,
        flag: "ok",
        detail: `${s.lengthBars} bars`,
      });
    }

    // Check for identical consecutive lengths
    if (i > 0 && sections[i - 1].lengthBars === s.lengthBars && s.lengthBars > 0) {
      flags.push({
        section: s.name,
        startBar: s.startBar,
        flag: "identical-length",
        detail: `Same length as previous section "${sections[i - 1].name}" (${s.lengthBars} bars) — listeners may perceive repetition`,
      });
    }
  }

  return flags;
}

// ─── Energy arc assessment ─────────────────────────────────────────────────────

const SECTION_ENERGY: Record<string, number> = {
  intro: 2,
  breakdown: 3,
  "breakdown 2": 3,
  "breakdown 3": 3,
  "breakdown, vocal": 3,
  build: 6,
  "build-up": 6,
  "build-up 2": 6,
  "build-up 3": 6,
  buildup: 6,
  "16 bar buildup": 6,
  climax: 9,
  drop: 9,
  "drop 1": 9,
  "drop 2": 10,
  chorus: 9,
  "chorus end": 5,
  "main drop": 10,
  "main drop & climax": 10,
  "mid intro drop": 8,
  melody: 8,
  "melody + buildup": 7,
  "anti-climax": 8,
  "anti climax": 8,
  bridge: 4,
  interlude: 3,
  outro: 2,
  "mid-intro": 4,
  "mid intro": 4,
  "mid intro continue": 5,
  "reverse bass": 7,
  "rev bass": 7,
  vocal: 4,
  start: 3,
  end: 2,
};

/** Marker names that represent transition cues, not full arrangement sections */
function isTransitionCue(name: string): boolean {
  const lower = name.toLowerCase();
  return /\bfill\b|\bdownlifter\b|\briser\b|\bimpact\b|\buplifter\b/.test(lower)
    || /\bscreetch fill\b|\bvocal fill\b|\bclap\b|\bwhite noise\b/.test(lower)
    || /\brev kick\b|\breverse kick\b/.test(lower);
}

function assessEnergyArc(sections: Section[], _genre: string): EnergyArc {
  if (sections.length === 0) {
    return {
      assessment: "No sections detected — cannot assess energy arc.",
      phases: [],
      verdict: "broken",
    };
  }

  const phases = sections.map((s) => {
    const energy = SECTION_ENERGY[s.name.toLowerCase()] ?? estimateEnergy(s.name);
    return {
      name: s.name,
      bars: `${s.startBar}–${s.startBar + s.lengthBars - 1}`,
      energyLevel: energyLabel(energy),
    };
  });

  // Analyze the energy curve
  const energyValues = sections.map((s) =>
    SECTION_ENERGY[s.name.toLowerCase()] ?? estimateEnergy(s.name),
  );

  const hasBuild = energyValues.some((e) => e >= 5 && e <= 7);
  const hasPeak = energyValues.some((e) => e >= 8);
  const hasResolution = energyValues.length > 0 &&
    energyValues[energyValues.length - 1] <= 4;
  const hasIntro = energyValues.length > 0 && energyValues[0] <= 4;

  let verdict: EnergyArc["verdict"] = "strong";
  const issues: string[] = [];

  if (!hasIntro) {
    issues.push("starts at high energy without an intro to ease the listener in");
    verdict = "needs-work";
  }
  if (!hasBuild) {
    issues.push("missing a clear build-up phase to create tension before the payoff");
    verdict = "needs-work";
  }
  if (!hasPeak) {
    issues.push("no high-energy peak section (drop/climax) — the arrangement lacks a payoff");
    verdict = "broken";
  }
  if (!hasResolution) {
    issues.push("ends at high energy without resolution — add an outro for DJ utility");
    verdict = verdict === "broken" ? "broken" : "needs-work";
  }

  // Check for energy monotony (all sections similar energy)
  const uniqueEnergies = new Set(energyValues.map((e) => Math.round(e / 2)));
  if (uniqueEnergies.size <= 2 && sections.length > 3) {
    issues.push("energy levels are too similar across sections — the arrangement feels flat");
    verdict = "needs-work";
  }

  const assessment = issues.length === 0
    ? "Energy arc follows a strong intro → build → peak → resolution pattern. The arrangement should keep listener attention."
    : `Energy arc issues: ${issues.join("; ")}.`;

  return { assessment, phases, verdict };
}

function estimateEnergy(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes("drop") || lower.includes("climax")) return 9;
  if (lower.includes("chorus") && !lower.includes("end")) return 9;
  if (lower.includes("melody") && !lower.includes("buildup")) return 8;
  if (lower.includes("build") || lower.includes("riser")) return 6;
  if (lower.includes("break")) return 3;
  if (lower.includes("intro")) return 2;
  if (lower.includes("outro") || lower.includes("end")) return 2;
  if (lower.includes("vocal") || lower.includes("bridge")) return 4;
  if (lower.includes("kick start")) return 7;
  if (isTransitionCue(name)) return 5;
  return 5; // unknown → mid
}

function energyLabel(energy: number): string {
  if (energy <= 2) return "low";
  if (energy <= 4) return "medium-low";
  if (energy <= 6) return "medium-high";
  if (energy <= 8) return "high";
  return "peak";
}

// ─── Problem detection ──────────────────────────────────────────────────────────

function findProblems(
  summary: ArrangementSummary,
  targetLengthSeconds: number,
  genre: string,
  problemDescription?: string,
): ArrangementProblem[] {
  const problems: ArrangementProblem[] = [];
  const sections = summary.sections;

  // Length problems
  const lengthDiff = summary.totalLengthSeconds - targetLengthSeconds;
  if (Math.abs(lengthDiff) > 30) {
    const direction = lengthDiff > 0 ? "long" : "short";
    problems.push({
      severity: "warning",
      bar: lengthDiff > 0 ? summary.totalLengthBars : 1,
      section: "(overall)",
      problem: `Arrangement is ${Math.abs(Math.round(lengthDiff))}s too ${direction} for the ${formatTime(targetLengthSeconds)} target (currently ${formatTime(summary.totalLengthSeconds)})`,
    });
  }

  // Missing intro
  if (sections.length > 0) {
    const firstName = sections[0].name.toLowerCase();
    if (!firstName.includes("intro") && !firstName.includes("start")) {
      problems.push({
        severity: "warning",
        bar: 1,
        section: sections[0].name,
        problem: `No intro section — track starts with "${sections[0].name}". DJs need 16–32 bars of intro for mixing in.`,
      });
    }
  }

  // Missing outro
  if (sections.length > 0) {
    const lastName = sections[sections.length - 1].name.toLowerCase();
    if (!lastName.includes("outro") && !lastName.includes("end")) {
      problems.push({
        severity: "warning",
        bar: sections[sections.length - 1].startBar,
        section: sections[sections.length - 1].name,
        problem: `No outro section — track ends with "${sections[sections.length - 1].name}". Add 16–32 bars of outro for DJ utility.`,
      });
    }
  }

  // Section-level flags (transition cues already filtered in flagSections)
  for (const flag of summary.sectionFlags) {
    if (flag.flag === "too-short") {
      problems.push({
        severity: "warning",
        bar: flag.startBar,
        section: flag.section,
        problem: `"${flag.section}" is only ${flag.detail.split(" ")[0]} bars — too short to establish its musical idea.`,
      });
    }
    if (flag.flag === "too-long") {
      problems.push({
        severity: "warning",
        bar: flag.startBar,
        section: flag.section,
        problem: `"${flag.section}" runs ${flag.detail.split(" ")[0]} bars — listener attention may drop. Consider an internal transition.`,
      });
    }
    if (flag.flag === "identical-length") {
      problems.push({
        severity: "info",
        bar: flag.startBar,
        section: flag.section,
        problem: `${flag.detail}`,
      });
    }
  }

  // Gaps
  for (const gap of summary.sectionGaps) {
    problems.push({
      severity: "warning",
      bar: gap.startBar,
      section: gap.afterSection,
      problem: `${gap.lengthBars}-bar gap after "${gap.afterSection}" at bar ${gap.startBar} — unmarked dead space.`,
    });
  }

  // Hardstyle-specific checks
  if (genre === "hardstyle") {
    const drops = sections.filter((s) => {
      const n = s.name.toLowerCase();
      return n.includes("drop") || n.includes("climax")
        || (n.includes("chorus") && !n.includes("end"))
        || n.includes("melody");
    });
    if (drops.length === 0) {
      problems.push({
        severity: "critical",
        bar: 1,
        section: "(overall)",
        problem: "No drop or climax section detected. A hardstyle track needs at least one high-energy drop.",
      });
    }

    const antiClimax = sections.filter((s) =>
      s.name.toLowerCase().includes("anti") || s.name.toLowerCase().includes("reverse"),
    );

    for (const drop of drops) {
      if (drop.lengthBars < 16) {
        problems.push({
          severity: "warning",
          bar: drop.startBar,
          section: drop.name,
          problem: `"${drop.name}" is only ${drop.lengthBars} bars — hardstyle drops typically need 32 bars to deliver the full kick pattern + melodic payload.`,
        });
      }
    }

    // Check for build before drop
    for (const drop of drops) {
      const beforeDrop = sections.filter((s) =>
        s.startBar + s.lengthBars <= drop.startBar &&
        s.startBar + s.lengthBars > drop.startBar - 20,
      );
      const hasBuild = beforeDrop.some((s) =>
        s.name.toLowerCase().includes("build"),
      );
      if (!hasBuild) {
        problems.push({
          severity: "info",
          bar: drop.startBar,
          section: drop.name,
          problem: `No build-up detected immediately before "${drop.name}" — consider adding 8 bars of tension before bar ${drop.startBar}.`,
        });
      }
    }
  }

  // Producer's stated problem (add as context if provided)
  if (problemDescription) {
    problems.unshift({
      severity: "critical",
      bar: 1,
      section: "(producer)",
      problem: `Producer reports: "${problemDescription}"`,
    });
  }

  // Sort: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  problems.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return problems;
}

// ─── Action derivation ──────────────────────────────────────────────────────────

function deriveActions(
  problems: ArrangementProblem[],
  summary: ArrangementSummary,
): ArrangementAction[] {
  const actions: ArrangementAction[] = [];
  let priority = 1;

  for (const p of problems) {
    if (p.severity === "info") continue; // info = observation, not actionable
    if (p.section === "(producer)") continue; // context, not directly actionable

    // Overall length deviation — distinct from section-level "too short"
    if (p.section === "(overall)" && p.problem.includes("target")) {
      if (p.problem.includes("too short")) {
        const breakdowns = summary.sections.filter((s) => s.name.toLowerCase().includes("break"));
        const suggestion = breakdowns.length > 0
          ? `Extend "${breakdowns[0].name}" by 16 bars at bar ${breakdowns[0].startBar}, or add a second drop variation.`
          : "Add a 16-bar breakdown or extend an existing section.";
        actions.push({
          priority: priority++,
          targetBar: summary.totalLengthBars,
          section: "(overall)",
          action: `Arrangement is ${formatTime(summary.totalLengthSeconds)} — needs ~${formatTime(summary.totalLengthSeconds + 100)} for the target. ${suggestion}`,
        });
      } else {
        const longest = summary.sections.reduce((a, b) => a.lengthBars > b.lengthBars ? a : b);
        actions.push({
          priority: priority++,
          targetBar: longest.startBar,
          section: longest.name,
          action: `Trim "${longest.name}" (currently ${longest.lengthBars} bars at bar ${longest.startBar}) — this is the best candidate to bring total length closer to target.`,
        });
      }
      continue;
    }

    // No drop detected
    if (p.section === "(overall)" && p.problem.includes("No drop")) {
      const midpoint = Math.round(summary.totalLengthBars * 0.4);
      actions.push({
        priority: priority++,
        targetBar: midpoint,
        section: "Drop",
        action: `Add a 32-bar drop section around bar ${midpoint}. This is where the kick pattern, bass, and lead should hit at full intensity.`,
      });
      continue;
    }

    if (p.problem.includes("too short to establish")) {
      actions.push({
        priority: priority++,
        targetBar: p.bar,
        section: p.section,
        action: `Extend "${p.section}" to at least 8 bars. Duplicate the core pattern or add a 4-bar variation before the repeat.`,
      });
    } else if (p.problem.includes("listener attention may drop")) {
      const midpoint = p.bar + 32;
      actions.push({
        priority: priority++,
        targetBar: midpoint,
        section: p.section,
        action: `Insert a transition or variation at bar ${midpoint} to break up "${p.section}". A 2-bar filter sweep or fill can reset listener attention.`,
      });
    } else if (p.problem.includes("No intro")) {
      actions.push({
        priority: priority++,
        targetBar: 1,
        section: "Intro",
        action: `Insert a 16–32 bar intro before bar 1. Use a filtered kick pattern and gradually introduce elements. This gives DJs mix-in room.`,
      });
    } else if (p.problem.includes("No outro")) {
      actions.push({
        priority: priority++,
        targetBar: summary.totalLengthBars,
        section: "Outro",
        action: `Add a 16–32 bar outro after bar ${summary.totalLengthBars}. Strip back to kick + minimal elements. Mirror the intro for DJ mix-out.`,
      });
    } else if (p.problem.includes("No build-up")) {
      actions.push({
        priority: priority++,
        targetBar: p.bar - 8,
        section: p.section,
        action: `Insert an 8-bar build-up before "${p.section}" starting at bar ${Math.max(1, p.bar - 8)}. Use a rising filter, snare roll, and increasing FX density.`,
      });
    } else if (p.problem.includes("gap")) {
      actions.push({
        priority: priority++,
        targetBar: p.bar,
        section: p.section,
        action: `Fill the gap at bar ${p.bar} with a transition element or extend the previous section to cover it.`,
      });
    }
  }

  // Deduplicate actions on the same section
  const seen = new Set<string>();
  return actions.filter((a) => {
    const key = `${a.section}:${a.targetBar}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function barsToSeconds(bars: number, tempo: number): number {
  const beatsPerBar = 4;
  return Math.round(((bars * beatsPerBar * 60) / tempo) * 10) / 10;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
