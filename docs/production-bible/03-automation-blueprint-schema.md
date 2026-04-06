# Automation Blueprint Parameter Format — Fornix Production Bible

> Feeds: Automation Blueprint generator (`03_Automation/Automation_Blueprint.md`)
> The MCP server generates automation blueprints as structured documents. This section defines the exact schema, reference parameters, and worked examples.

---

## 1. Automation Entry Schema

Each automation entry in the blueprint follows this format:

```
{
  "entryId":        string,    // Unique: "{sectionName}_{parameterName}_{channel}" (snake_case)
  "parameterName":  string,    // Human-readable parameter name
  "channel":        string,    // Channel, bus, or send name (matches routing sheet)
  "startValue":     number,    // Numeric start value
  "startUnit":      string,    // Unit: "dB", "Hz", "%", "ms", "ratio", "semitones", "bars"
  "endValue":       number,    // Numeric end value
  "endUnit":        string,    // Unit (same type as startUnit)
  "sectionName":    string,    // Arrangement section name (matches project plan sections)
  "startBar":       number,    // Absolute bar number where automation begins
  "durationBars":   number,    // Length of the automation move in bars
  "curveType":      string,    // "linear" | "exponential" | "logarithmic" | "step" | "s-curve"
  "purpose":        string     // One sentence: why this move exists
}
```

### Field Rules

| Field | Constraints | Example |
|-------|-------------|---------|
| `entryId` | Unique across the blueprint. Convention: `{section}_{param}_{channel}` | `buildup1_filterCutoff_musicBus` |
| `parameterName` | Use the plugin parameter name where possible. For sends: `sendLevel_{returnName}` | `filterCutoff`, `sendLevel_longVerb`, `stereoWidth` |
| `channel` | Must match a channel or bus name from the routing sheet | `LEAD_BUS`, `KICK_BASS`, `MASTER`, `FX_LONG_RETURN` |
| `startValue` / `endValue` | Always numeric. Percentages as 0–100, not 0–1 | `startValue: 8000`, `startUnit: "Hz"` |
| `curveType` | See curve type definitions below | `"exponential"` |
| `sectionName` | Must match a section name from the project plan | `"Build-Up 1"`, `"Drop 2"`, `"Breakdown"` |
| `startBar` | Absolute bar number (1-indexed from song start) | `65` |
| `durationBars` | Must be positive integer, multiple of 1 (sub-bar automation described as 1 bar with curve) | `16` |
| `purpose` | One sentence, starts with a verb | `"Reveal harmonic content gradually to prevent burning brightness before the drop."` |

### Curve Type Definitions

| Curve | Behavior | When to Use |
|-------|----------|-------------|
| `linear` | Constant rate of change from start to end | Default for most automation. Predictable, clean. |
| `exponential` | Slow start, accelerating toward end value | Filter sweeps that should "explode" at the end of a build. Human perception of frequency is logarithmic — exponential filter moves sound linear to the ear. |
| `logarithmic` | Fast start, decelerating toward end value | Volume fade-outs. Reverb decay pull-backs. Natural energy dissipation. |
| `step` | Instant jump at the start bar, holds at end value | Mute/unmute automation. Section-boundary resets. "Hard cut" before drop entries. |
| `s-curve` | Slow start → fast middle → slow arrival | Smooth transitions between sections where neither the departure nor arrival should feel abrupt. Stereo width changes. |

---

## 2. Top 10 Most Commonly Automated Parameters

Ranked by frequency of use across all Fornix production packages.

| Rank | Parameter | Typical Channel | Why It's Automated | Typical Sections |
|------|-----------|----------------|-------------------|-----------------|
| 1 | **Filter cutoff (LPF)** | MUSIC bus, LEAD bus, riser channels | Controls frequency reveal/concealment — the primary tension/release tool | Build-ups (sweep open), intros (gradual reveal), transitions |
| 2 | **Reverb send level** | LEAD bus → FX_LONG, MUSIC bus → DUCKED_VERB | Wet in breakdowns for space, dry in drops for punch | Breakdowns (increase), pre-drop (hard cut), drops (minimal) |
| 3 | **Sidechain depth** | SUB bus, LEAD bus, MUSIC bus | Deeper in drops for kick clarity, relaxed in breakdowns for sustain | Drops (deep), breakdowns (shallow/off), intros (moderate) |
| 4 | **Stereo width** | LEAD bus, MASTER bus, MUSIC bus | Narrow in intros/verses, wide in climax for maximum impact | Intros (narrow), builds (gradually widen), drops (widest) |
| 5 | **HPF cutoff** | MUSIC bus, FX bus, orchestral bus | Reveal bass content gradually, clean transitions | Intros (high → sweep down), pre-drops (sweep up to clear sub) |
| 6 | **Delay send level** | LEAD bus → DELAY_THROW, VOX → delay return | Transition punctuation, pre-drop throws | Pre-drop final 2–4 bars (spike then cut), breakdown phrase endings |
| 7 | **Distortion drive** | KICK bus, SCREECH bus | Aggression changes per section | Anti-climax (increase), euphoric drop (decrease), fills (spike) |
| 8 | **Volume rides** | Individual channels, VOX, FX hits | Balance per section, dynamic emphasis | Throughout — continuous micro-rides, especially on vocals and FX |
| 9 | **LPF/HPF on FX returns** | FX_LONG_RETURN, DUCKED_VERB_RETURN | Control reverb/delay brightness per section | Drops (darken returns), breakdowns (open returns) |
| 10 | **Pan / stereo position** | FX hits, transition elements, vocal doubles | Movement and spatial interest | Transitions (panned sweeps), drops (centered), intros (wide placement) |

### Typical Value Ranges Per Section Type

| Parameter | Intro | Build-Up | Drop | Breakdown | Outro |
|-----------|-------|----------|------|-----------|-------|
| LPF cutoff (Hz) | 2000–8000 → opens | 8000 → 18000+ | Full open (20000) | Full open | 18000 → 4000 |
| Reverb send (dB) | −12 to −6 | −18 to −6 | −24 to −18 (minimal) | −6 to 0 (wet) | −12 to −6 |
| Sidechain depth (dB) | −4 to −6 | −6 to −8 | −8 to −12 (deepest) | 0 to −3 (light/off) | −4 to −6 |
| Stereo width (%) | 60–80% | 70–90% | 90–110% (widest) | 80–100% | 70 → 50% |
| HPF cutoff (Hz) | 200–80 (sweeping down) | 60–30 (revealing sub) | 30 (full range) | 30–60 | 60 → 200 |
| Delay send (dB) | −18 (off) | −12 → −6 (throws) | −24 (off) | −12 to −6 | −18 |
| Distortion drive (%) | 15–20% | 20–25% | 25–40% (style-dependent) | 10–15% | 10–15% |
| Volume rides (dB) | ±1–2 dB | ±1–3 dB | ±0.5–1.5 dB | ±1–3 dB | ±2–4 dB (stripping) |
| Return filter (Hz) | LPF 12000 | LPF 14000 | LPF 8000 (darken) | LPF 18000 (open) | LPF 10000 |
| Pan position | Fixed or slow | Center-pulling | Centered | Wide, moving | Widening out |

---

## 3. Worked Examples

### Example 1 — Filter Sweep (Build-Up)

```json
{
  "entryId": "buildup1_lpfCutoff_musicBus",
  "parameterName": "Low-pass filter cutoff",
  "channel": "MUSIC_BUS",
  "startValue": 800,
  "startUnit": "Hz",
  "endValue": 18000,
  "endUnit": "Hz",
  "sectionName": "Build-Up 1",
  "startBar": 65,
  "durationBars": 16,
  "curveType": "exponential",
  "purpose": "Reveal harmonic content across the full build-up so the drop opens with maximum brightness contrast."
}
```

### Example 2 — Sidechain Depth Change (Breakdown → Drop)

```json
{
  "entryId": "drop1_sidechainDepth_leadBus",
  "parameterName": "Sidechain compressor threshold",
  "channel": "LEAD_BUS",
  "startValue": -3,
  "startUnit": "dB",
  "endValue": -10,
  "endUnit": "dB",
  "sectionName": "Drop 1",
  "startBar": 81,
  "durationBars": 1,
  "curveType": "step",
  "purpose": "Snap sidechain to full depth on the first downbeat of the drop so the kick punches through the lead immediately."
}
```

### Example 3 — Reverb Send Increase (Breakdown)

```json
{
  "entryId": "breakdown1_verbSend_leadBus",
  "parameterName": "sendLevel_FX_LONG",
  "channel": "LEAD_BUS",
  "startValue": -18,
  "startUnit": "dB",
  "endValue": -4,
  "endUnit": "dB",
  "sectionName": "Breakdown 1",
  "startBar": 49,
  "durationBars": 16,
  "curveType": "logarithmic",
  "purpose": "Gradually introduce long reverb tail to create emotional depth in the breakdown melody."
}
```

### Example 4 — Stereo Width Automation (Intro → Build)

```json
{
  "entryId": "intro_stereoWidth_masterBus",
  "parameterName": "Stereo width",
  "channel": "MASTER_BUS",
  "startValue": 65,
  "startUnit": "%",
  "endValue": 85,
  "endUnit": "%",
  "sectionName": "Intro",
  "startBar": 1,
  "durationBars": 32,
  "curveType": "s-curve",
  "purpose": "Gradually widen the stereo field from a focused intro into a broader mid-intro, reserving full width for the drop."
}
```

### Example 5 — Delay Throw (Pre-Drop)

```json
{
  "entryId": "buildup1_delayThrow_leadBus",
  "parameterName": "sendLevel_DELAY_THROW",
  "channel": "LEAD_BUS",
  "startValue": -24,
  "startUnit": "dB",
  "endValue": -6,
  "endUnit": "dB",
  "sectionName": "Build-Up 1",
  "startBar": 77,
  "durationBars": 4,
  "curveType": "exponential",
  "purpose": "Spike the delay throw in the final 4 bars before the drop for rhythmic intensification."
}
```

### Example 6 — Delay Send Hard Cut (Drop Entry)

```json
{
  "entryId": "drop1_delayCut_leadBus",
  "parameterName": "sendLevel_DELAY_THROW",
  "channel": "LEAD_BUS",
  "startValue": -6,
  "startUnit": "dB",
  "endValue": -60,
  "endUnit": "dB",
  "sectionName": "Drop 1",
  "startBar": 81,
  "durationBars": 1,
  "curveType": "step",
  "purpose": "Kill the delay send instantly on the drop downbeat so the kick entry is clean and unmasked."
}
```

### Example 7 — Reverb Return Darkening (Drop)

```json
{
  "entryId": "drop1_returnLPF_fxLongReturn",
  "parameterName": "Low-pass filter cutoff",
  "channel": "FX_LONG_RETURN",
  "startValue": 16000,
  "startUnit": "Hz",
  "endValue": 6000,
  "endUnit": "Hz",
  "sectionName": "Drop 1",
  "startBar": 81,
  "durationBars": 1,
  "curveType": "step",
  "purpose": "Darken the reverb return in the drop so residual reverb tails do not compete with the kick and screech brightness."
}
```

### Example 8 — Distortion Drive Aggression (Anti-Climax)

```json
{
  "entryId": "drop1ac_distDrive_screechBus",
  "parameterName": "Saturn 2 mid-band drive",
  "channel": "SCREECH_BUS",
  "startValue": 25,
  "startUnit": "%",
  "endValue": 40,
  "endUnit": "%",
  "sectionName": "Drop 1 (Anti-Climax)",
  "startBar": 81,
  "durationBars": 32,
  "curveType": "linear",
  "purpose": "Gradually increase screech aggression across the anti-climax section to build intensity toward the transition."
}
```

---

## 4. Blueprint Document Structure

The full automation blueprint for a track follows this structure:

```markdown
# Automation Blueprint – {Track Name}

{metadata header: artist, tempo, key, style, etc.}

## Automation Grid

| Section | Parameter | Channel | Start → End | Curve | Duration | Purpose |
|---------|-----------|---------|-------------|-------|----------|---------|
{one row per automation entry, sorted by startBar}

## Tension / Release Notes

{3–5 prose guidelines about the emotional arc of automation in this track}

## Section Transition Checklist

{For each major transition: what must be automated at the boundary}
```

### Grid Column Mapping

| Grid Column | Schema Field(s) |
|-------------|----------------|
| Section | `sectionName` |
| Parameter | `parameterName` |
| Channel | `channel` |
| Start → End | `{startValue}{startUnit} → {endValue}{endUnit}` |
| Curve | `curveType` |
| Duration | `{durationBars} bars (from bar {startBar})` |
| Purpose | `purpose` |

---

## 5. Automation Density Guidelines

| Section Type | Expected Entry Count | Reason |
|--------------|---------------------|--------|
| Intro (16–32 bars) | 3–5 entries | Minimal — atmosphere builds should be subtle, not busy |
| Build-Up (8–16 bars) | 5–8 entries | High density — this is where tension tools activate |
| Drop (32–64 bars) | 4–6 entries | Moderate — the drop should be stable, not constantly moving. Automation here is about maintaining energy, not building it. |
| Breakdown (16–32 bars) | 4–7 entries | Moderate-high — emotional development through spatial and tonal shifts |
| Transition (1–4 bars) | 2–4 entries (step/instant) | Short, decisive moves at section boundaries |
| Outro (16–32 bars) | 3–5 entries | Reverse of intro — stripping layers, narrowing, reducing |

### Total blueprint entries per track

| Track Length | Expected Total Entries |
|--------------|----------------------|
| 160 bars (standard) | 25–40 entries |
| 192 bars (cinematic extended) | 35–50 entries |
| 128 bars (festival short) | 20–30 entries |

---

_Fornix Production Bible — defines the output format for `03_Automation/Automation_Blueprint.md` generator._
