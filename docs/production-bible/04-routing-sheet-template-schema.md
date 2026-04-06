# Routing Sheet Template Schema — Fornix Production Bible

> Feeds: Routing Sheet generator (`02_Routing/Routing_Sheet.md`)
> Defines the complete signal flow hierarchy as a tree structure for each style variant.
> The MCP routing sheet generator uses these trees to produce per-track routing sheets with bus names, insert intent, and risk notes.

---

## 1. Cinematic-Euphoric

Full orchestral section, wide reverb architecture, patient arrangement.

```
MASTER
├── KICK & BASS (glue bus)
│   ├── KICK (tok + punch + body + tail print)
│   │   ├── Kick Tok (transient layer)
│   │   ├── Kick Punch (mid-body attack)
│   │   ├── Kick Body (100–300 Hz weight)
│   │   └── Kick Tail (pitched tail print)
│   └── SUB (mono sub + reverse bass)
│       ├── Sub Sine (root-tuned sine)
│       └── Reverse Bass (mono core + harmonic layer)
│
├── LEAD (euphoric lead stack)
│   ├── Main Supersaw (center, mono-compatible)
│   ├── Octave Support (+1 oct, −6 dB)
│   ├── Note-Center Layer (single-voice mono for hook clarity)
│   └── Counter Melody (optional, lower register fill)
│
├── ORCHESTRAL (full section — cinematic weight)
│   ├── Strings High (violins, violas)
│   ├── Strings Low (cellos, basses)
│   ├── Brass (horns, trumpets — power accents)
│   ├── Woodwinds (flute, clarinet — texture/color)
│   ├── Choir / Vocal Pad (sustained harmonic bed)
│   └── Orchestral Percussion (timpani, taiko — impact only)
│
├── MUSIC (chords, pads, harmonic support)
│   ├── Chord Stack (supersaw chords, plucks)
│   ├── Pad Layer (atmospheric sustain)
│   ├── Pluck / Arp (rhythmic harmonic motion)
│   └── Cinematic Theme (melodic motif separate from lead)
│
├── DRUM TOPS (everything except kick)
│   ├── Clap / Snare (body + crack layers)
│   ├── Hi-Hats (closed, open, pedal)
│   ├── Rides (intro/outro only)
│   ├── Percussion (shakers, tambourines, ethnic perc)
│   └── Fills (snare rolls, tom fills, transition hits)
│
├── FX / ATMOS (spatial and transition elements)
│   ├── Impacts (sub boom + mid hit + transient top)
│   ├── Risers (tonal + noise)
│   ├── Downlifters (tonal + noise)
│   ├── Sub Drops (sine pitch drop)
│   ├── Reverses (reversed melody/vocal fragments)
│   └── Atmospheric Beds (field recordings, textures)
│
├── VOX / STORY (vocal and narrative)
│   ├── Lead Vocal (spoken or sung)
│   ├── Vocal Doubles (width support)
│   ├── Vocal Chops (rhythmic cut-ups)
│   └── Texture Layer (granular vocal processing)
│
└── SENDS / RETURNS
    ├── FX_LONG (large hall/cathedral reverb, decay 2.5–4.0 s)
    ├── FX_SHORT (plate/room reverb, decay 0.8–1.5 s)
    ├── DUCKED_VERB (reverb sidechained to kick, for MUSIC bus)
    ├── DELAY_THROW (1/4 or dotted 1/8, transition-only throws)
    ├── PARALLEL_CLIP (parallel compression for DRUM TOPS)
    └── ORCH_VERB (dedicated orchestral hall, decay 3.0–5.0 s)
```

### Bus Insert Intent — Cinematic-Euphoric

| Bus | Inserts Intent | Primary Risk |
|-----|---------------|--------------|
| KICK | Alternating EQ/distortion sandwich (5–8 stages), transient shaper before distortion. Clean tok, controlled tail. | Over-distorting the tail makes it fight the reverse bass. Euphoric kicks need a cleaner tail than raw. |
| SUB | Mono enforcement (Pro-Q 3 M/S HPF side at 120 Hz), gentle saturation for warmth, sidechain from kick. | Phase issues between sub sine and reverse bass. Check mono correlation. |
| KICK & BASS | Light glue compression (2:1, 1–2 dB GR), shared peak control. | Over-compressing kills the tok. This bus is for cohesion, not dynamics control. |
| LEAD | HPF 150 Hz, compression (3:1), light saturation, presence EQ 3–5 kHz, stereo widener (above 2 kHz), sidechain. | Width fighting kick clarity. The lead must survive in mono — check frequently. |
| ORCHESTRAL | Saturation for cohesion, bus compression (2:1–3:1), reverb insert 15–30% mix, HPF 80–100 Hz. | Reverb buildup in the low-mids. The orchestral bus can swallow the entire mix if the HPF and decay aren't managed. |
| MUSIC | HPF 100 Hz, sidechain from kick (moderate depth), stereo width control. | Pad sustain masking the lead melody. Duck pads harder during lead phrases. |
| DRUM TOPS | Transient shaping, bus compression for groove, HPF per channel. | Too much compression flattens the groove and makes the anti-climax feel cheap. |
| FX / ATMOS | Mute automation at section boundaries. Tail management is the #1 job. | Long tails surviving into drops. Every cinematic tail must be cut before the kick returns. |
| VOX / STORY | De-ess, compression, presence EQ, reverb/delay sends automated per phrase. | Vocal masking the lead melody in the same frequency range. Use frequency-split sidechain. |
| MASTER | Reference → surgical EQ → glue comp → tape sat → M/S EQ → multiband → imager → limiter. | Fixing mix problems on the master bus hides the real issue. If you need more than a narrow cut here, go back to the source. |

### Bus Risks to Watch — Cinematic-Euphoric

- **ORCHESTRAL bus** is the biggest risk in this variant. It adds warmth and weight but can mask everything if uncontrolled. Automate orchestral volume per section — full during breakdowns, −3 to −6 dB in drops.
- **FX_LONG return** with 2.5–4.0 s decay will bleed across section boundaries. Hard-mute or automate the send level down before every drop entry.
- **ORCH_VERB** dedicated return prevents the orchestral hall from affecting leads/drums. Do not route non-orchestral elements to this return.

---

## 2. Rawphoric

Distortion-heavy, minimal orchestral, screech-focused. More distortion stages on kick and screech buses.

```
MASTER
├── KICK & BASS (glue bus)
│   ├── KICK (heavy distortion chain — 8–10+ stages)
│   │   ├── Kick Tok (aggressive transient layer)
│   │   ├── Kick Punch (mid-body, heavily saturated)
│   │   ├── Kick Body (distorted 150–500 Hz content)
│   │   └── Kick Tail (pitched, gritty — longer decay for raw character)
│   └── SUB (mono sub + reverse bass)
│       ├── Sub Sine (root-tuned, clean)
│       └── Reverse Bass (mono, distortion on harmonics only above 200 Hz)
│
├── SCREECH (primary lead role — replaces euphoric lead)
│   ├── Main Screech (center, mono core)
│   ├── Screech Width Layer (stereo support, above 2 kHz only)
│   └── Screech Sub-Layer (optional body reinforcement 200–500 Hz)
│
├── LEAD (secondary — melodic moments only, if hybrid)
│   ├── Melodic Lead (appears only in euphoric payoff sections)
│   └── Counter Melody (minimal)
│
├── MUSIC (minimal — raw tracks use less harmonic padding)
│   ├── Stab / Chord Hit (short, percussive chord stabs)
│   ├── Dark Pad (atmospheric, filtered, background only)
│   └── Arp / Sequence (rhythmic texture)
│
├── DRUM TOPS
│   ├── Clap / Snare (harder, more distorted than euphoric)
│   ├── Hi-Hats (minimal, tight)
│   ├── Rides (intro/outro, sparse)
│   └── Fills (aggressive rolls, pitched fills)
│
├── FX / ATMOS (shorter, drier than cinematic)
│   ├── Impacts (sub boom + distorted mid hit)
│   ├── Risers (noise-heavy, filtered)
│   ├── Downlifters (short, aggressive)
│   └── Sub Drops (shorter than cinematic — 1–2 bars max)
│
├── VOX / STORY (minimal or absent)
│   ├── Spoken Sample (if used — short, processed)
│   └── Vocal Chop (rhythmic, distorted)
│
└── SENDS / RETURNS
    ├── FX_SHORT (plate/room, decay 0.6–1.2 s — shorter than cinematic)
    ├── DELAY_THROW (1/8 or 1/16, aggressive, transition-only)
    ├── PARALLEL_CLIP (parallel compression for DRUM TOPS — more aggressive)
    └── DISTORTION_SEND (parallel distortion return for screech bus — blend control)
```

### Bus Insert Intent — Rawphoric

| Bus | Inserts Intent | Primary Risk |
|-----|---------------|--------------|
| KICK | Full 8–10 stage alternating EQ/distortion chain. More aggressive drive values (+30–50% on mid bands). Hard clipper before limiter. | Transient destruction — the tok must survive the distortion chain. Transient shaper BEFORE distortion is mandatory. |
| SUB | Same as cinematic but distortion on reverse bass harmonics (above 200 Hz only, never on sub sine). | Distorting the sub sine itself. Keep sub sine clean — only distort the harmonic layer of the reverse bass. |
| SCREECH | HPF 200 Hz, dual distortion stages (Saturn 2 → Pro-Q 3 → Saturn 2), compression, presence EQ, sidechain. | 2–5 kHz fatigue. The screech lives here permanently — automate brightness down in longer sections. |
| KICK & BASS | Glue compression slightly more aggressive (3:1, 2–3 dB GR). | Over-compression flattening the kick tok. Raw kicks need to HIT — don't squash the bus. |
| MUSIC | HPF 150 Hz, heavy sidechain, minimal processing. | Stabs masking the screech. In rawphoric, the screech IS the lead — everything else serves it. |
| FX / ATMOS | Shorter tails than cinematic. Mute automation mandatory. | Less room for FX error in raw — the mix is already dense with distortion. Keep FX minimal and precise. |

### Bus Risks to Watch — Rawphoric

- **No FX_LONG return.** Rawphoric should NOT have a cathedral reverb. Long tails fight the aggressive, dry character. Use FX_SHORT only.
- **DISTORTION_SEND** is unique to rawphoric — a parallel distortion return that lets the screech bus blend clean/distorted signal. This prevents over-distorting the direct path.
- **SCREECH bus is the priority.** In rawphoric, the screech replaces the euphoric lead as the primary melodic/textural voice. Route accordingly — it gets the best real estate in the frequency spectrum.

---

## 3. Anthemic-Euphoric

Balanced vocal-forward approach. Strong hook, moderate orchestral, festival-ready.

```
MASTER
├── KICK & BASS (glue bus)
│   ├── KICK (clean tok, moderate chain — 5–7 stages)
│   │   ├── Kick Tok (clean transient)
│   │   ├── Kick Punch (controlled body)
│   │   └── Kick Tail (shorter than cinematic, pitched)
│   └── SUB
│       ├── Sub Sine
│       └── Reverse Bass
│
├── LEAD (melodic supersaw stack — primary voice alongside vocal)
│   ├── Main Supersaw (center)
│   ├── Octave Support (+1)
│   └── Note-Center Layer (mono hook)
│
├── VOCAL (elevated to primary bus — not sub-bus of VOX/STORY)
│   ├── Lead Vocal (center, dry, intelligible)
│   ├── Vocal Double L (−6 dB, panned 30% L)
│   ├── Vocal Double R (−6 dB, panned 30% R)
│   ├── Vocal Chops (rhythmic fills)
│   └── Harmony Stack (chorus sections only)
│
├── ORCHESTRAL (lighter than cinematic)
│   ├── String Ensemble (combined high+low)
│   ├── Brass Accent (power hits only, not sustained)
│   └── Choir Pad (background sustain)
│
├── MUSIC
│   ├── Chord Stack
│   ├── Pluck / Arp
│   └── Pad Layer
│
├── DRUM TOPS
│   ├── Clap / Snare
│   ├── Hi-Hats
│   ├── Rides
│   └── Fills
│
├── FX / ATMOS
│   ├── Impacts
│   ├── Risers
│   ├── Downlifters
│   └── Sub Drops
│
└── SENDS / RETURNS
    ├── FX_LONG (hall reverb, decay 1.5–2.5 s — shorter than cinematic)
    ├── FX_SHORT (plate, decay 0.6–1.2 s)
    ├── DUCKED_VERB (for MUSIC bus)
    ├── DELAY_THROW (1/4, vocal phrase endings)
    ├── VOCAL_VERB (dedicated vocal plate, decay 1.0–1.8 s)
    └── PARALLEL_CLIP (drum tops parallel)
```

### Bus Insert Intent — Anthemic-Euphoric

| Bus | Inserts Intent | Primary Risk |
|-----|---------------|--------------|
| KICK | Moderate 5–7 stage chain. Clean tok focus. Less aggressive distortion than raw. | Kick must punch through dense vocal+lead arrangement. Monitor kick clarity with vocals playing. |
| VOCAL | De-ess → compression (Opto 3:1) → presence EQ (3–5 kHz boost) → sidechain to kick (light, 3–4 dB). | Vocal masking the lead melody or vice versa. Vocal gets frequency priority 1–5 kHz; lead fills around it. |
| LEAD | HPF 150 Hz, compression, presence EQ. Sidechain from BOTH kick and vocal bus. | Lead and vocal fighting for the same 2–5 kHz space. Lead must duck slightly when vocal phrase is active. |
| ORCHESTRAL | Lighter processing than cinematic. Saturation + bus comp + shorter reverb (1.5–2.5 s). | Orchestral weight masking the vocal hook. Automate orchestral down −3 dB during vocal phrases. |

### Bus Risks to Watch — Anthemic-Euphoric

- **VOCAL bus as primary.** In anthemic-euphoric, the vocal hook IS the track. The lead supersaw supports the vocal, not the other way around. Route the vocal to a dedicated bus with its own return (VOCAL_VERB).
- **Lead sidechain from vocal.** The lead must duck 2–3 dB when the vocal phrase is active. This is frequency-split sidechain — only duck the lead's 2–5 kHz range, not the full band.
- **ORCHESTRAL lighter.** Strings are an ensemble (not split high/low), brass is accents only (not sustained power). This keeps the orchestral section from overpowering the vocal.

---

## 4. Festival-Hardstyle

Maximum DJ utility. Clean, punchy, loud. Minimal complexity, maximum impact.

```
MASTER
├── KICK & BASS (glue bus)
│   ├── KICK (punchy, clean — 5–6 stages, focus on transient)
│   │   ├── Kick Tok (maximum transient punch)
│   │   ├── Kick Body (tight, controlled)
│   │   └── Kick Tail (short — clean for fast BPM mixing)
│   └── SUB
│       ├── Sub Sine (tight, short release)
│       └── Reverse Bass (standard offbeat)
│
├── LEAD (clear, memorable — singalong priority)
│   ├── Main Supersaw (center, clear)
│   ├── Octave Support (+1, bright)
│   └── Pluck Double (reinforces rhythm of melody)
│
├── MUSIC (simple, effective)
│   ├── Chord Stack (clean supersaw chords)
│   ├── Pluck / Stab (rhythmic accent)
│   └── Pad (minimal, fills gaps only)
│
├── DRUM TOPS
│   ├── Clap / Snare (punchy, prominent)
│   ├── Hi-Hats (driving, consistent)
│   └── Fills (simple, effective — snare rolls, no complex breaks)
│
├── FX / ATMOS (minimal — clean transitions)
│   ├── Impacts (punchy, short)
│   ├── Risers (clean, not over-processed)
│   ├── Downlifters (short)
│   └── Sub Drops (1 bar max)
│
├── VOX / STORY (optional)
│   ├── Vocal Hook (if present — short, catchy)
│   └── Vocal Chops
│
└── SENDS / RETURNS
    ├── FX_SHORT (plate/room, decay 0.6–1.0 s)
    ├── DELAY_THROW (1/8 dotted, transition fills)
    └── PARALLEL_CLIP (drum tops)
```

### Bus Insert Intent — Festival-Hardstyle

| Bus | Inserts Intent | Primary Risk |
|-----|---------------|--------------|
| KICK | 5–6 stage chain. Maximum transient focus. Transient shaper attack +4–6 dB. Short tail for fast mixing. | Tail too long for DJ mixing at 150 BPM. Festival kicks need a tight tail that clears before the next downbeat. |
| LEAD | HPF 150 Hz, compression, presence EQ, moderate width. No heavy distortion — clarity over aggression. | Overprocessing the lead. Festival leads must be instantly memorable and clear — don't over-distort or over-saturate. |
| MUSIC | Minimal processing. HPF, sidechain, done. | Adding too many elements. Festival tracks work because they're simple and loud. Don't fill the arrangement. |
| MASTER | Louder limiting target (−5 to −7 LUFS club master). Clip-before-limit approach. | Distortion from over-limiting. Use GClip before Pro-L 2 to catch peaks before the limiter works too hard. |

### Bus Risks to Watch — Festival-Hardstyle

- **No FX_LONG return.** Festival tracks should NOT have long reverb tails. They smear on festival PAs and fight the kick. Plate/room only.
- **No ORCHESTRAL bus.** Festival-hardstyle does not need a dedicated orchestral section. If orchestral elements are used, they route to the MUSIC bus as supporting layers.
- **Simplicity is the goal.** Fewer buses, fewer sends, fewer processing stages. The festival mix should be clean and loud, not complex and nuanced.

---

## 5. Cross-Variant Comparison

| Bus / Feature | Cinematic-Euphoric | Rawphoric | Anthemic-Euphoric | Festival-Hardstyle |
|--------------|-------------------|-----------|-------------------|-------------------|
| KICK chain stages | 5–8 | 8–10+ | 5–7 | 5–6 |
| KICK character | Clean tok, controlled tail | Aggressive tok, gritty tail | Clean punch | Maximum transient punch |
| Primary melodic bus | LEAD | SCREECH | VOCAL + LEAD | LEAD |
| ORCHESTRAL bus | Full section (6 sub-channels) | None | Light (3 sub-channels) | None |
| Reverb architecture | FX_LONG + FX_SHORT + ORCH_VERB | FX_SHORT only | FX_LONG + FX_SHORT + VOCAL_VERB | FX_SHORT only |
| Longest reverb decay | 2.5–5.0 s (ORCH_VERB) | 0.6–1.2 s | 1.5–2.5 s | 0.6–1.0 s |
| DISTORTION_SEND | No | Yes (screech parallel) | No | No |
| VOCAL_VERB return | No (vocals route to FX_LONG) | No | Yes (dedicated) | No |
| Total bus count | 10–12 | 8–10 | 10–11 | 7–8 |
| Total send/returns | 6 | 4 | 6 | 3 |
| Mix complexity | Highest | High (distortion management) | High (vocal management) | Lowest |

---

_Fornix Production Bible — defines signal flow hierarchy for `02_Routing/Routing_Sheet.md` generator per style variant._
