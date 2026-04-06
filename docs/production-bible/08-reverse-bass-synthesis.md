# Reverse Bass Synthesis and Placement — Fornix Production Bible

> Feeds: Sound Design Pack generator (`05_Sound_Design/Sound_Design_Pack.md`) for euphoric and rawphoric variants
> Plugins referenced: Serum, FabFilter Pro-Q 3, FabFilter Saturn 2, FabFilter Pro-MB

---

## Core Misconception

**A reverse bass is NOT a reversed audio file.** The name describes the *sound character* (pitch dropping from high to low, like a bass note played in reverse), not the production technique. A reverse bass is synthesized — it is a pitched envelope sweep that plays on the offbeat, creating the driving groove that defines hardstyle.

---

## 1. Three Valid Synthesis Methods

### Method A — Synthesized Pitch Envelope (Primary Method)

The standard and most controllable approach. The reverse bass is a synthesizer patch with a rapid pitch drop.

**Serum configuration:**

| Parameter | Value | Notes |
|-----------|-------|-------|
| OSC A wavetable | Basic Shapes → Saw, or Analog_BrSaw | Saw wave provides the harmonic richness needed for the pitch sweep to be audible |
| Unison voices | 1 (mono) | Reverse bass is ALWAYS mono. Multiple voices cause phase issues in sub. |
| OSC A octave | Match kick root note octave (typically C2–G2) | Must share the same fundamental as the kick |
| Pitch envelope enabled | Yes | This IS the reverse bass |
| ENV pitch start | +12 to +24 semitones above root (+1 to +2 octaves) | Higher start = more dramatic sweep. +12 for subtle, +24 for aggressive. |
| ENV pitch end | 0 semitones (root note) | Pitch lands on the root — this is the bass note |
| ENV pitch decay | 80–200 ms | 80 ms = tight, snappy (festival). 200 ms = longer sweep (cinematic). |
| ENV pitch curve | Exponential (fast start, slow arrival) | Linear sounds unnatural. Exponential mimics natural pitch drop. |
| Filter | LP 24 dB/oct, cutoff 60–80% | Tames harsh high harmonics during the pitch sweep |
| AMP envelope | A: 0 ms, D: 0 ms, S: 100%, R: 150–300 ms | Sustain must be full — the reverse bass rings between kicks |

**Pitch envelope values by style:**

| Style | Start Pitch | Decay Time | Root Note | Character |
|-------|------------|-----------|-----------|-----------|
| Euphoric (clean) | +12 semitones | 120–180 ms | Root key of track | Smooth, warm sweep |
| Rawphoric (aggressive) | +18 to +24 semitones | 80–120 ms | Root key | Dramatic, aggressive sweep |
| Festival (punchy) | +12 semitones | 80–120 ms | Root key | Short, tight, clean |
| Cinematic | +12 to +18 semitones | 150–200 ms | Root key | Longer, more dramatic |

### Method B — Kick Tail Reversal (Sample-Based)

Take the kick's tail layer, reverse the audio, and use it as the reverse bass source.

1. Export the kick tail (post-distortion) as a one-shot WAV
2. Reverse the WAV in a sampler
3. The reversed tail naturally sweeps from high harmonics → low fundamental
4. Time-stretch to fit the offbeat position

**Advantages:** Perfect tonal match with the kick (same harmonics, same fundamental).
**Disadvantages:** Less controllable than synthesized. Fixed tonal character — can't easily adjust the sweep.

### Method C — Sidechain Pump Method (Hybrid)

A sustained bass note with extreme sidechain compression creating the rhythmic "reverse" feel.

1. Play a sustained bass note (sub sine or filtered saw) on the root key
2. Apply aggressive sidechain compression from the kick (ratio ∞:1, attack 0 ms, release 80–150 ms)
3. The sidechain creates the characteristic amplitude shape: silence on kick → swell between kicks
4. Apply a pitch LFO (Env mode, 1 bar, slight upward sweep during swell) for tonal movement

**When to use:** When you want the reverse bass to be tonally simple and rhythmically locked to the kick without a pitch sweep. More common in early hardstyle and slower tempos.

---

## 2. Post-Synthesis Processing Chain

| Position | Plugin | Settings | Purpose |
|----------|--------|----------|---------|
| 1 | **HPF** (Pro-Q 3) | 30 Hz, 48 dB/oct | Remove sub-sub rumble from the pitch sweep. The fundamental at root note is ~55–100 Hz — nothing useful exists below 30 Hz. |
| 2 | **LPF** (Pro-Q 3) | 2000–4000 Hz, 24 dB/oct | Remove harsh upper harmonics from the pitch sweep. The reverse bass is a sub/low-mid element — high frequencies fight the lead. |
| 3 | **Distortion Stage 1** (Saturn 2) | Band 1 (30–150 Hz): Bypass or Gentle Sat 5–10%. Band 2 (150–500 Hz): Tape 15–25%. Band 3 (500+ Hz): Off. | Add harmonic warmth to the body (150–500 Hz) WITHOUT distorting the sub fundamental. |
| 4 | **EQ Shaping** (Pro-Q 3) | Boost body at 100–200 Hz (+1–2 dB, Q 2). Cut mud at 250–350 Hz (−1–3 dB, Q 3–5). | Shape the tonal weight. The body boost gives the reverse bass presence; the mud cut prevents it from fighting the kick tail. |
| 5 | **Multiband Compression** (Pro-MB) | Band 1 (30–100 Hz): Ratio 2:1, gentle. Band 2 (100–500 Hz): Ratio 3:1, moderate. | Control dynamics of the pitch sweep — the high-pitch start is louder than the low-pitch landing. Multiband prevents the sweep from sounding uneven. |
| 6 | **Sidechain Compressor** | Source: Kick, Attack 0.5–1 ms, Release 60–120 ms, Ratio ∞:1, GR 6–12 dB | The most important insert. Creates the pocket for the kick. The reverse bass MUST duck when the kick hits. |

### Processing rules

- **NEVER distort the sub fundamental** (below 100 Hz) of the reverse bass. Distortion on sub frequencies creates intermodulation artifacts that fight the kick. Saturn 2 Band 1 stays off or at minimal gentle saturation.
- **Only distort the harmonic body** (150–500 Hz) — this adds warmth and character without sub damage.
- **The LPF is critical.** Without it, the pitch sweep's upper harmonics collide with the lead synth (1–5 kHz). The reverse bass should be felt, not heard as a separate bright element.

---

## 3. Frequency Content by Region

| Region | Hz Range | Character | Role |
|--------|----------|-----------|------|
| Sub | 30–80 Hz | Fundamental weight | Provides the bass presence between kicks. This is what you feel on a subwoofer. |
| Body | 80–200 Hz | Tonal warmth | The pitch sweep is most audible here. Where the "reverse" character lives. |
| Harmonics | 200–500 Hz | Upper body and grit | Adds character, especially in rawphoric. Fights kick tail — manage with reciprocal EQ. |
| Upper harmonics | 500–2000 Hz | Sweep sizzle | Usually unwanted in the final mix. The LPF at 2000–4000 Hz controls this. |

---

## 4. Placement Rules

### Offbeat Position

The reverse bass plays on the offbeat — beat 2 and beat 4 in a 4/4 bar (or on every "and" in straight 1/8th patterns at 150 BPM).

```
Beat:     1       &       2       &       3       &       4       &
Kick:     X                       X                       X
Rev Bass:         X                       X                       X
```

At 150 BPM, each 1/8 note = 200 ms. The reverse bass note triggers 200 ms after each kick hit.

### Root Note Convention

**The reverse bass and kick MUST share the same root note.**

- Default: G2 (approximately 98 Hz) — the most common hardstyle root
- The actual root note is determined by the track's key signature
- Common roots at 150 BPM: F2 (87 Hz), G2 (98 Hz), A2 (110 Hz)
- The kick's sub fundamental is tuned to this note. The reverse bass's pitch envelope LANDS on this note.

If the kick is tuned to G and the reverse bass is tuned to A, the sub region will have constant phase interference. This is audible on any speaker system with sub extension.

### Pitch Envelope and Kick Tail Relationship

The kick tail's pitch envelope sweeps DOWN (high → low, landing on root).
The reverse bass's pitch envelope ALSO sweeps down (high → low, landing on root).
But they occur at different times:
- Kick: sweep happens on the downbeat, landing on root within 100–300 ms
- Reverse bass: sweep happens on the offbeat, landing on root within 80–200 ms

The two pitch sweeps should NOT overlap in time. If the kick tail is long (300+ ms) and the reverse bass starts too early, their pitch sweeps collide. Solutions:
1. Shorten the kick tail
2. Delay the reverse bass trigger by 10–30 ms
3. Use sidechain to duck the reverse bass during the kick tail

---

## 5. Preventing Sub Collision

### Sidechain Method (Primary — Pro-C 2 or Pro-MB)

| Parameter | Value |
|-----------|-------|
| Source | Kick channel (pre-fader send) |
| Attack | 0.5–1 ms (must catch the kick onset immediately) |
| Hold | 5–20 ms (keep the reverse bass ducked through the kick transient) |
| Release | 60–120 ms (reverse bass swells back between kicks) |
| Ratio | ∞:1 (hard limiting / gating — the reverse bass should be inaudible during the kick) |
| Gain reduction | 6–12 dB |

### Multiband Sidechain Method (Pro-MB)

For more surgical control, sidechain only the sub band of the reverse bass:

| Band | Range | Sidechain | Ratio | Release |
|------|-------|-----------|-------|---------|
| Band 1 (Sub) | 30–100 Hz | From kick | ∞:1 | 80–120 ms |
| Band 2 (Body) | 100–500 Hz | From kick | 4:1 | 60–100 ms |
| Band 3 (Upper) | 500+ Hz | No sidechain | — | — |

This preserves the reverse bass's upper harmonic character (audible grit) while completely clearing the sub region for the kick. The sub band ducks fully; the body band ducks moderately; the upper band stays untouched.

### Phase Alignment Check

After setting up the sidechain, check phase correlation between kick sub and reverse bass sub:

1. Solo the KICK & BASS bus
2. Use a phase correlation meter (S1's built-in or SPAN)
3. The meter should stay positive during playback
4. If it dips negative, the kick and reverse bass are phase-canceling — adjust the reverse bass start time by 1–5 ms until the meter stays positive

---

## 6. Style Variant Differences

| Aspect | Euphoric | Rawphoric | Festival |
|--------|---------|-----------|---------|
| Pitch start | +12 semitones | +18 to +24 semitones | +12 semitones |
| Decay time | 120–180 ms | 80–120 ms | 80–120 ms |
| Post-processing distortion | Light (Tape 15%) | Moderate (Tape 20–30% on body) | Minimal (10% or bypass) |
| LPF cutoff | 2000–3000 Hz | 3000–4000 Hz (allow more upper harmonics for grit) | 2000 Hz (clean) |
| Sidechain depth | −8 to −10 dB | −10 to −14 dB | −8 to −10 dB |
| Character | Warm, smooth, supportive | Gritty, aggressive, prominent | Clean, tight, functional |

---

_Fornix Production Bible — feeds `05_Sound_Design/Sound_Design_Pack.md` reverse bass sections for all style variants._
