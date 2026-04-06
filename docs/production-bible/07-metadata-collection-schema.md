# MCP Metadata Collection Schema — Fornix Production Bible

> Feeds: `ProductionPackageInput` interface in `src/services/production-package.ts`
> Expands the current input schema with every field the server should collect during project initialization.
> Each field documents: data type, valid options, which generated documents it affects, and a worked example.

---

## Current Input Fields (Already Implemented)

These fields exist in the current `ProductionPackageInput` interface. Documented here for completeness.

| Field | Type | Required | Current Options | Documents Affected |
|-------|------|----------|----------------|-------------------|
| `outputDir` | string | Yes | File system path | All (determines output location) |
| `trackName` | string | Yes | Free text | All (document titles, file paths) |
| `artistName` | string | Yes | Free text (default: "Fornix") | All (metadata headers) |
| `tempo` | number | Yes | 140–160 (hardstyle range) | Project Plan, Automation, Sound Design |
| `keySignature` | string | Yes | e.g. "A minor", "F# minor", "D minor" | Project Plan, Sound Design, Automation |
| `styleVariant` | StyleVariant | Yes | `cinematic-euphoric`, `rawphoric`, `anthemic-euphoric`, `festival-hardstyle` | ALL — this is the primary branching key |
| `leadStyle` | LeadStyle | Yes | `euphoric`, `screech`, `hybrid` | Routing, Sound Design, Mix Report |
| `dropStrategy` | DropStrategy | Yes | `anti-climax-to-melodic`, `melodic-then-anti-climax`, `double-anti-climax`, `festival-main-drop` | Project Plan, Automation, Sound Design |
| `energyProfile` | EnergyProfile | Yes | `patient-cinematic`, `steady-escalation`, `front-loaded`, `late-payoff` | Project Plan, Automation |
| `targetBars` | number | Yes | 128–224 (typical range) | Project Plan, Automation |
| `creativeBrief` | string | No | Free text | Project Plan |
| `mixConcerns` | string[] | No | Free text array | Mix Report, Checklist |
| `signatureHooks` | string[] | No | Free text array | Project Plan, Sound Design |
| `mood` | string | No | Free text | Project Plan, Sound Design |
| `focus` | string | No | Free text | Mix Report, Checklist |
| `concerns` | string[] | No | Free text array | Mix Report |
| `substyle` | string | No | Free text | Sound Design |
| `kickStyle` | string | No | Free text | Routing, Sound Design, Mix Report |
| `antiClimaxStyle` | string | No | Free text | Sound Design, Automation |
| `arrangementFocus` | string | No | Free text | Project Plan, Automation |
| `vocalMode` | string | No | See expanded definition below | Routing, Sound Design |
| `djUtilityPriority` | string | No | Free text | Checklist |
| `referenceNotes` | string[] | No | Free text array | All (appended as guidance) |
| `sectionGoals` | Record<string, string> | No | Section name → goal description | Project Plan, Automation |
| `cinematicIntensity` | string | No | Free text | Project Plan, Routing, Sound Design |
| `aggressionLevel` | string | No | Free text | Sound Design, Mix Report |
| `emotionalTone` | string | No | Free text | Project Plan, Sound Design |

---

## Expanded Fields (New)

These fields should be added to the `ProductionPackageInput` interface to capture the full creative and technical context.

### Energy & Narrative Fields

#### `energyArcPattern`

| Attribute | Value |
|-----------|-------|
| Type | `"linear-rise" \| "inverted-u" \| "w-shape" \| "slow-burn" \| "front-heavy" \| "bookend"` |
| Default | Derived from `energyProfile`: patient-cinematic → slow-burn, steady-escalation → linear-rise, front-loaded → front-heavy, late-payoff → inverted-u |
| Documents affected | **Project Plan** (section ordering), **Automation** (curve aggressiveness per section) |
| Description | Defines the macro energy shape across the full track. Different from `energyProfile` which is about pacing — this is about the literal shape of the energy graph. |

Worked example:
- `energyArcPattern: "w-shape"` → The track has two energy peaks (Drop 1 and Drop 2) with a valley between them. The Project Plan will place a significant energy reset between drops. The Automation Blueprint will include a dramatic pull-back (reverb increase, width decrease, filter close) in the mid-section.

| Pattern | Shape | Use Case |
|---------|-------|----------|
| `linear-rise` | ↗ steady climb | Festival tracks, steady escalation to main drop |
| `inverted-u` | ↗ peak ↘ | Cinematic — single climactic moment, then resolution |
| `w-shape` | ↗↘↗↘ | Standard two-drop tracks — most common in hardstyle |
| `slow-burn` | → → → ↗ | Extended cinematic builds with late payoff |
| `front-heavy` | ↗↘ → → | Rawphoric — hits hard immediately, maintains energy |
| `bookend` | ↗↘ → → ↗↘ | Concept album — strong open and close, exploratory middle |

#### `moodNarrativeIntent`

| Attribute | Value |
|-----------|-------|
| Type | string (free text, 1–3 sentences) |
| Default | None |
| Documents affected | **Project Plan** (creative direction), **Sound Design** (texture choices), **Automation** (emotional arc guidance) |
| Description | The story or emotional journey the track should tell. Not a technical parameter — this is the creative seed. |

Worked example:
- `moodNarrativeIntent: "A warrior entering a cathedral for the last time. Reverence gives way to rage, rage gives way to acceptance."` → The Project Plan's section goals will map this arc. Sound Design will specify reverb-heavy cathedral textures in the intro transitioning to dry aggression. Automation will include a dramatic textural shift at the anti-climax entry.

#### `emotionalTone` (Expanded from free text to structured)

| Attribute | Value |
|-----------|-------|
| Type | `"euphoric" \| "melancholic" \| "aggressive" \| "dark" \| "hopeful" \| "nostalgic" \| "triumphant" \| "anxious" \| "serene"` or free text |
| Default | Derived from styleVariant: cinematic → melancholic, rawphoric → aggressive, anthemic → euphoric, festival → triumphant |
| Documents affected | **Project Plan** (section mood annotations), **Sound Design** (timbre and texture guidance) |

### Technical Specification Fields

#### `targetPlatforms`

| Attribute | Value |
|-----------|-------|
| Type | `("beatport" \| "spotify" \| "apple-music" \| "soundcloud" \| "festival-usb" \| "dj-pool")[]` |
| Default | `["beatport", "spotify"]` |
| Documents affected | **Mix Report** (loudness targets per platform), **Checklist** (export format requirements, metadata embedding) |
| Description | Determines which loudness targets, true peak limits, and export formats are included in the Mix Report and Checklist. |

Worked example:
- `targetPlatforms: ["beatport", "festival-usb"]` → Mix Report includes both club master (−5 to −7 LUFS, −0.3 dBTP) and festival master (−6 to −8 LUFS, −0.5 dBTP). Checklist includes stem export for DJ use. No streaming master generated (no Spotify/Apple Music in targets).

#### `vocalPresenceType` (Replaces free text `vocalMode`)

| Attribute | Value |
|-----------|-------|
| Type | `"none" \| "spoken-intro" \| "spoken-texture" \| "vocal-chops" \| "featured-vocal" \| "sung-hook" \| "choir"` |
| Default | `"none"` |
| Documents affected | **Routing** (vocal bus structure), **Sound Design** (vocal processing chain), **Mix Report** (vocal-specific risks), **Checklist** (vocal recording/session checklist) |

| Value | Routing Impact | Sound Design Impact |
|-------|---------------|-------------------|
| `none` | No VOX bus | No vocal processing section |
| `spoken-intro` | Minimal VOX bus (1 channel) | HPF, compression, reverb for spoken word. Short section only. |
| `spoken-texture` | VOX bus with 1–2 channels | Processing for atmospheric spoken elements scattered throughout |
| `vocal-chops` | VOX bus with chop channels | Sampler/slicer processing, formant shifting, rhythmic placement |
| `featured-vocal` | Full VOX bus (main + doubles + harmonies) | Full vocal chain: gate, de-ess, EQ, comp, parallel comp, sends |
| `sung-hook` | Full VOX bus, elevated to primary alongside LEAD | Full chain + hook-specific treatment (delay throws, width automation) |
| `choir` | VOX bus with ensemble routing | Choir processing: bus comp, shared reverb, blend control |

#### `orchestralComplexity`

| Attribute | Value |
|-----------|-------|
| Type | `"none" \| "minimal" \| "moderate" \| "full" \| "cinematic-full"` |
| Default | Derived from styleVariant: cinematic → full, rawphoric → none, anthemic → moderate, festival → none |
| Documents affected | **Routing** (orchestral bus structure), **Sound Design** (orchestral arrangement guidance), **Checklist** (sample library requirements) |

| Value | Bus Structure | Typical Style |
|-------|--------------|---------------|
| `none` | No orchestral bus | Rawphoric, festival |
| `minimal` | Theme elements route to MUSIC bus | Raw with melodic moments |
| `moderate` | Combined ORCHESTRAL bus, 2–3 channels | Anthemic-euphoric |
| `full` | ORCHESTRAL bus with strings/brass/perc sub-buses | Cinematic-euphoric |
| `cinematic-full` | Full ORCHESTRAL + choir + woodwinds + dedicated ORCH_VERB | Extended cinematic (192+ bars) |

#### `trackDurationTarget`

| Attribute | Value |
|-----------|-------|
| Type | number (seconds) or string ("standard" \| "extended" \| "short" \| "radio-edit") |
| Default | Derived from `targetBars` and `tempo`: bars × (60 / tempo) × 4 |
| Documents affected | **Project Plan** (section length validation), **Checklist** (duration check) |

| Preset | Duration | Bars at 150 BPM |
|--------|----------|-----------------|
| `short` | 3:00–4:00 | 112–150 bars |
| `standard` | 4:00–5:00 | 150–188 bars |
| `extended` | 5:00–7:00 | 188–262 bars |
| `radio-edit` | 2:30–3:30 | 94–131 bars |

### Creative Direction Fields

#### `referenceTracks`

| Attribute | Value |
|-----------|-------|
| Type | `{ artist: string, title: string, aspect: string }[]` |
| Default | None |
| Documents affected | **Project Plan** (reference context), **Mix Report** (referencing targets), **Checklist** (reference track A/B checklist items) |
| Description | Specific tracks to reference, with what aspect to reference from each. |

Worked example:
```json
[
  { "artist": "Sub Zero Project", "title": "The Project", "aspect": "kick character and tail treatment" },
  { "artist": "Sound Rush", "title": "Breakaway", "aspect": "cinematic break structure and emotional arc" },
  { "artist": "Headhunterz", "title": "Dragonborn", "aspect": "vocal hook placement and singalong energy" }
]
```

#### `aggressionLevel` (Expanded from free text to enum)

| Attribute | Value |
|-----------|-------|
| Type | `"minimal" \| "low" \| "moderate" \| "high" \| "extreme"` |
| Default | Derived from styleVariant: cinematic → low, rawphoric → high, anthemic → low, festival → moderate |
| Documents affected | **Sound Design** (distortion amounts, screech presence), **Routing** (distortion stage count), **Mix Report** (harshness risk flagging) |

| Value | Distortion Character | Screech Presence | Kick Drive |
|-------|---------------------|-----------------|------------|
| `minimal` | Warm saturation only | None | 15–20% |
| `low` | Light tube/tape | Accent only | 20–30% |
| `moderate` | Moderate multi-stage | Counter-melody or accent | 25–35% |
| `high` | Heavy multi-band distortion | Primary voice | 30–45% |
| `extreme` | Aggressive, multiple parallel chains | Dominant, constant | 40–60% |

#### `cinematicIntensity` (Expanded from free text to enum)

| Attribute | Value |
|-----------|-------|
| Type | `"none" \| "low" \| "medium" \| "high" \| "cinematic-full"` |
| Default | Derived from styleVariant: cinematic → high, rawphoric → none, anthemic → medium, festival → low |
| Documents affected | **Project Plan** (break length, intro complexity), **Routing** (orchestral weight, FX bus complexity), **Automation** (transition density) |

| Value | Break Length | Orchestral | Reverb Tails | Intro Treatment |
|-------|-------------|-----------|-------------|-----------------|
| `none` | 16–24 bars | None | Short only | Percussion, direct |
| `low` | 16–32 bars | Theme elements only | Short–medium | Percussion + atmosphere |
| `medium` | 24–48 bars | Moderate section | Medium | Atmosphere + motif teaser |
| `high` | 32–64 bars | Full section | Long cathedral | Cinematic build, progressive reveal |
| `cinematic-full` | 48–80 bars | Full + choir + woodwinds | Very long (3–5 s) | Extended cinematic scene-setting |

#### `signatureHooks` (Documented)

| Attribute | Value |
|-----------|-------|
| Type | `string[]` |
| Default | None |
| Documents affected | **Project Plan** (hook placement strategy), **Sound Design** (hook sound design), **Automation** (hook reveal automation) |
| Description | Named hooks or motifs. Each becomes a tracking point in the Project Plan — where it's teased, developed, and fully revealed. |

Worked example:
- `signatureHooks: ["cathedral bell motif", "descending chromatic screech", "spoken word refrain"]` → Project Plan includes a hook reveal timeline showing when each hook first appears (tease in intro), develops (break), and pays off (drop). Sound Design includes dedicated design notes for each hook's sonic treatment.

#### `djUtilityPriority` (Expanded from free text to enum)

| Attribute | Value |
|-----------|-------|
| Type | `"low" \| "medium" \| "high"` |
| Default | Derived from styleVariant: cinematic → medium, rawphoric → medium, anthemic → high, festival → high |
| Documents affected | **Project Plan** (intro/outro length), **Routing** (intro/outro simplicity), **Checklist** (DJ mixing test, stem export) |

| Value | Intro Design | Outro Design | Export Priority |
|-------|-------------|-------------|----------------|
| `low` | Cinematic, complex, may sacrifice DJ utility | Artistic ending, may not mix cleanly | Album/streaming first |
| `medium` | 16-bar percussion intro before cinematic elements | 16-bar percussion outro after artistic ending | Club + streaming masters |
| `high` | 16–32 bar clean percussion intro, no pitched elements | 16–32 bar clean percussion outro, mirrored intro | Club master + DJ stems |

#### `sectionGoals` (Documented)

| Attribute | Value |
|-----------|-------|
| Type | `Record<string, string>` — map of section name to goal description |
| Default | None (falls back to style-variant defaults) |
| Documents affected | **Project Plan** (section descriptions), **Automation** (section-specific automation goals) |

Worked example:
```json
{
  "Intro": "Cathedral bells and distant choir establish the space before any rhythm",
  "Break 1": "Vocal hook carries the emotion — orchestral swells support but never overpower",
  "Drop 1 (Anti-Climax)": "Hostile screech subversion — audience expects melody, gets aggression",
  "Break 2": "Shorter, more intense — the melodic payoff is coming and the energy must not drop",
  "Drop 2 (Melodic)": "Full euphoric release — widest lead, full orchestral support, emotional climax"
}
```

#### `mixConcernsOverride`

| Attribute | Value |
|-----------|-------|
| Type | `{ area: string, priority: "P1" \| "P2" \| "P3", description: string }[]` |
| Default | None (auto-generated from style variant branching table) |
| Documents affected | **Mix Report** (priority risk list), **Checklist** (mix-specific checks) |
| Description | Override or supplement the auto-generated mix concerns with track-specific issues. |

---

## Field → Document Impact Matrix

| Field | Project Plan | Routing | Automation | Mix Report | Sound Design | Checklist |
|-------|-------------|---------|-----------|-----------|-------------|-----------|
| styleVariant | Primary branch | Primary branch | Primary branch | Primary branch | Primary branch | Primary branch |
| leadStyle | Section melody | Lead bus structure | Lead automation | Lead-specific risks | Lead synthesis | Lead checks |
| dropStrategy | Drop ordering | Anti-climax routing | Drop transition auto | Drop-specific risks | AC/melodic design | Drop validation |
| energyProfile | Section pacing | — | Curve aggressiveness | — | — | Energy arc check |
| energyArcPattern | Macro energy shape | — | Full-track arc | — | — | Arc validation |
| moodNarrativeIntent | Creative direction | — | Emotional arc | — | Texture guidance | — |
| targetPlatforms | — | — | — | Loudness targets | — | Export formats |
| vocalPresenceType | — | Vocal bus | Vocal automation | Vocal risks | Vocal processing | Vocal checks |
| orchestralComplexity | Orchestral sections | Orchestral bus | Orch automation | Orch risks | Orch arrangement | Sample library |
| referenceTracks | Reference context | — | — | A/B targets | — | Reference checklist |
| aggressionLevel | — | Distortion staging | Drive automation | Harshness risks | Distortion amounts | — |
| cinematicIntensity | Break length | FX complexity | Transition density | FX risks | Atmosphere design | — |
| signatureHooks | Hook timeline | — | Hook reveal auto | — | Hook design | Hook validation |
| djUtilityPriority | Intro/outro design | Intro simplicity | — | — | — | DJ mixing test |
| sectionGoals | Section descriptions | — | Per-section goals | — | — | — |

---

## Collection Order Recommendation

When the MCP server collects metadata interactively, this order minimizes back-and-forth:

1. **Identity:** `trackName`, `artistName`
2. **Core technical:** `tempo`, `keySignature`, `targetBars`
3. **Style branch:** `styleVariant` (everything else derives from this)
4. **Style refinement:** `leadStyle`, `dropStrategy`, `energyProfile`
5. **Creative seed:** `creativeBrief`, `mood`, `emotionalTone`, `moodNarrativeIntent`
6. **Detail fields:** `signatureHooks`, `sectionGoals`, `referenceTracks`
7. **Technical overrides:** `vocalPresenceType`, `orchestralComplexity`, `aggressionLevel`, `cinematicIntensity`
8. **Delivery:** `targetPlatforms`, `djUtilityPriority`, `trackDurationTarget`
9. **Concerns:** `mixConcerns`, `mixConcernsOverride`, `referenceNotes`

Fields in groups 5–9 are optional. The server should derive sensible defaults from `styleVariant` and only prompt for overrides when the user's creative brief suggests deviation from defaults.

---

_Fornix Production Bible — defines the complete project initialization metadata schema for `ProductionPackageInput`._
