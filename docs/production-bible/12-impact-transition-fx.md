# Impact and Transition FX Design — Fornix Production Bible

> Feeds: Sound Design Pack generator (`05_Sound_Design`), Automation Blueprint generator (`03_Automation`)
> Covers all FX that stitch arrangement sections together.
> For each FX type: synthesis method, parameter values, automation targets, stereo treatment, placement convention.

---

## 1. Tonal Downlifters

A sustained tone that sweeps downward in pitch, signaling the end of a section or a descent in energy.

| Parameter | Value |
|-----------|-------|
| **Oscillator** | Saw or square wave (harmonically rich — pitch movement must be audible) |
| **Pitch start** | 2000–6000 Hz (above the lead's primary range) |
| **Pitch end** | 100–300 Hz (below the lead, approaching kick territory) |
| **Sweep duration** | 4–16 bars (8 bars is standard; 16 for cinematic builds) |
| **Pitch curve** | Logarithmic (fast start, slow arrival — mimics gravity) |
| **Filter** | LP 24 dB/oct, cutoff automated from 8 kHz → 2 kHz alongside pitch drop |
| **Resonance** | 20–40% (adds whistling character to the sweep) |
| **Stereo** | Mono center if below 500 Hz at landing; start wide, narrow as pitch drops |
| **Reverb send** | FX_SHORT (0.6–1.2 s plate). Automate dry on the last bar. |
| **Processing** | Light saturation (Tape 10–15%), compression (3:1, medium release) |
| **Placement** | Final 4–16 bars of a break/build. Must end 1 beat before the drop downbeat. |
| **Style difference** | Cinematic: 8–16 bar slow sweep, heavy reverb. Rawphoric: 4–8 bar fast sweep, dry. |

---

## 2. Noise Downlifters

A noise source with a filter sweep moving from open to closed, creating a descending "whoosh."

| Parameter | Value |
|-----------|-------|
| **Source** | White noise or pink noise oscillator |
| **Filter type** | Band-pass or low-pass, 12–24 dB/oct |
| **Cutoff start** | 6000–12000 Hz |
| **Cutoff end** | 200–800 Hz |
| **Sweep duration** | 2–8 bars |
| **Filter curve** | Exponential (accelerating close — tension builds as the filter narrows) |
| **Resonance** | 30–60% (higher creates a more dramatic "whistling" character) |
| **Stereo** | Start wide (100%), narrow to mono as cutoff drops below 500 Hz |
| **Processing** | HPF at 80 Hz (no sub from noise). Light compression. |
| **Placement** | Last 2–8 bars before a drop. Can overlap with tonal downlifter. |
| **Automation** | Volume: fade from −12 dB to −3 dB across the sweep (builds presence as filter closes) |

---

## 3. Sub Drops

A sine wave with a rapid pitch drop that creates a low-frequency impact felt in the chest/subwoofer.

| Parameter | Value |
|-----------|-------|
| **Oscillator** | Pure sine wave (no harmonics — sub drops are felt, not heard) |
| **Pitch start** | 150–400 Hz |
| **Pitch end** | 30–50 Hz (the sub-bass floor) |
| **Pitch drop timing** | 100–500 ms (fast = punchy impact; slow = dramatic weight) |
| **Pitch curve** | Exponential (fast attack, settling toward the low note) |
| **Tail length** | 200 ms–2 bars (depending on section timing) |
| **Stereo** | **Pure mono.** Sub drops must be 100% mono. Any stereo content below 100 Hz causes speaker/sub issues. |
| **Processing** | Soft clip or limiter to prevent speaker excursion on very low content. HPF at 20 Hz. |
| **Placement** | Bar 1, beat 1 of a drop (simultaneous with kick entry). OR: last beat of the build-up (landing into silence before the drop). |
| **Duration by style** | Cinematic: 1–2 bars (dramatic). Rawphoric: 0.5–1 bar (tight). Festival: 0.5 bar (punchy). |

### Sub drop + kick collision prevention

The sub drop and kick hit on the same downbeat. Prevent collision by:
1. Sub drop pitch starts ABOVE the kick fundamental (150+ Hz) and sweeps down
2. By the time the sub drop reaches kick territory (30–80 Hz), the kick transient has passed
3. Sidechain the sub drop from the kick (fast attack, 60–100 ms release) — kick wins the first 60 ms, sub drop fills the rest

---

## 4. White Noise Risers

A noise source with a filter sweep moving from closed to open, creating an ascending "whoosh" that builds anticipation.

| Parameter | Value |
|-----------|-------|
| **Source** | White noise (brighter, more energy) or pink noise (warmer) |
| **Filter type** | High-pass or band-pass, 12–24 dB/oct |
| **Cutoff start** | 200–1000 Hz (dark, filtered, barely audible) |
| **Cutoff end** | 12000–18000 Hz (bright, open, maximum energy) |
| **Sweep duration** | 4–16 bars (match build-up length) |
| **Filter curve** | Exponential (slow start → accelerating brightness — tension builds exponentially) |
| **Resonance** | 30–50% (creates a pitched "whistle" riding the filter sweep) |
| **Stereo behavior** | Start mono center → widen to 80–100% as filter opens. The rising brightness reveals stereo width. |
| **Volume automation** | −24 dB → −6 dB across the sweep. The riser starts barely audible and builds. |
| **Processing** | HPF at 100 Hz. Light compression (4:1, fast release). Reverb send increases across the sweep. |
| **Placement** | Aligned with build-up section. Starts at the build-up onset, peaks 1 beat before the drop. |
| **Hard cut** | The riser MUST stop completely on the drop downbeat. Either hard mute or a reverb tail kill (step automation on reverb send). |

---

## 5. Tonal Risers

A pitched oscillator sweeping upward, creating a melodic sense of ascent.

| Parameter | Value |
|-----------|-------|
| **Oscillator** | Saw wave, detuned +5 cents for movement (or supersaw 3-voice) |
| **Pitch start** | 200–500 Hz (below the lead range) |
| **Pitch end** | 2000–8000 Hz (into or above the lead range) |
| **Sweep duration** | 4–16 bars |
| **Pitch curve** | Exponential or logarithmic (experiment — exponential = dramatic acceleration; logarithmic = steady rise) |
| **LFO rate acceleration** | LFO on pitch or filter cutoff. Rate: 1/4 at start → 1/32 at end (accelerating rhythm creates urgency). Automate LFO rate from slow to fast across the sweep. |
| **Filter** | LP tracking the pitch (cutoff moves with pitch so brightness stays proportional) |
| **Stereo** | Narrow at start, widen as pitch rises. Above 1 kHz: widen to 80%. |
| **Processing** | Distortion increases across the sweep (automate Saturn drive from 10% → 25%). The riser gets "hotter" as it climbs. |
| **Placement** | Build-up section. Often layered with noise riser for combined tonal + noise energy. |
| **Hard cut** | Same as noise riser — hard kill on drop downbeat. |

---

## 6. Impact Stacks

The moment the drop hits. A layered impact combining sub energy, mid body, and high transient for maximum "hit" perception.

### Three-Layer Impact Stack

| Layer | Synthesis | Frequency Range | Timing | Stereo |
|-------|-----------|----------------|--------|--------|
| **Sub Boom** | Sine wave, pitch from 100 Hz → 40 Hz in 200–500 ms | 30–100 Hz | Trigger on beat 1 of the drop. 200–500 ms decay. | **Mono.** Sub impacts must be mono. |
| **Mid Impact** | Noise burst or short sine, filtered at 200–2000 Hz | 200–2000 Hz | Simultaneous with sub boom. 50–150 ms decay (shorter than sub). | Moderate width (50–70%). |
| **High Transient** | Noise click, stick hit, or synthesized transient | 2000–10000 Hz | Simultaneous. 5–30 ms duration (extremely short). | Wide (80–100%). |

### Layer timing and processing

| Layer | Attack | Decay | Processing |
|-------|--------|-------|-----------|
| Sub Boom | 0–2 ms | 200–500 ms | Soft clip, HPF 20 Hz, mono enforce, sidechain from kick |
| Mid Impact | 0–1 ms | 50–150 ms | Saturation (light), compression (4:1), HPF 150 Hz |
| High Transient | 0 ms | 5–30 ms | None or light HPF 1 kHz. This is pure attack. |

### Why three layers

Each layer triggers a different perceptual mechanism:
- **Sub Boom:** Felt in the body. Physical impact. Engages the subwoofer.
- **Mid Impact:** Heard as the "body" of the impact. Provides weight on small speakers.
- **High Transient:** Perceived as "attack." The click that tells the brain "something just hit." Cuts through any mix.

A single-layer impact cannot achieve all three simultaneously. The sub boom is too slow for transient perception; the transient is too short for sub weight.

---

## 7. The Negative Space Technique

Silence before the drop. The most powerful impact tool is not a sound — it's the absence of sound.

### Implementation

| Parameter | Value |
|-----------|-------|
| **Duration** | 0.5–2 beats at 150 BPM (200–800 ms). 1 beat is most common. |
| **What survives** | Almost nothing. Options: (1) complete silence, (2) reverb tail decay only, (3) single sustained note dying out, (4) the last tick of the snare roll |
| **What must NOT survive** | Sub energy, kick, noise risers, full reverb tails, delay repeats. All must be hard-muted. |
| **Automation** | Step-automate ALL send levels to −∞ on the silence beat. Master bus reverb return: hard mute. |
| **Duration by style** | Cinematic: 1–2 beats (dramatic pause). Rawphoric: 0.5–1 beat (tight, aggressive). Festival: 0.5–1 beat (functional). |

### Why it works

The human auditory system perceives loudness relative to context. After a build-up with noise riser, filter sweep, and snare roll, the listener's ears are "calibrated" to a high level. The silence resets this calibration. When the drop hits, the contrast from silence to full energy is perceived as louder and more impactful than a seamless transition would be — even at the same dBFS.

### What makes the silence feel intentional vs. like a mistake

| Intentional | Mistake |
|-------------|---------|
| Preceded by a clear build-up with escalating energy | No clear build-up — silence appears randomly |
| Duration is a musical division (1 beat, 0.5 beat) | Duration is an awkward non-musical length |
| One element fading out during silence (reverb tail, last note) | Complete dead silence with no decay |
| Followed immediately by a strong downbeat (kick + impact stack) | Followed by a soft entrance that doesn't reward the tension |

---

## 8. Style Variant Differences

| FX Element | Cinematic-Euphoric | Rawphoric | Anthemic-Euphoric | Festival-Hardstyle |
|-----------|-------------------|-----------|-------------------|-------------------|
| Tonal downlifter | 8–16 bars, slow, heavily reverbed. Often pitched to a scale tone. | 4–8 bars, fast, dry. More aggressive filter resonance. | 8 bars, moderate reverb. | 4–8 bars, clean, functional. |
| Noise downlifter | 4–8 bars, wide stereo. | 2–4 bars, narrow, aggressive. | 4–8 bars, moderate. | 2–4 bars, tight. |
| Sub drop | 1–2 bars, dramatic slow pitch drop. | 0.5–1 bar, punchy fast drop. | 1 bar, moderate. | 0.5 bar, short, clean. |
| White noise riser | 8–16 bars, gradual, wide → very wide. Heavy reverb send. | 4–8 bars, narrow, less reverb. More resonance. | 8 bars, moderate. | 4–8 bars, direct. |
| Tonal riser | 8–16 bars, slow LFO acceleration, melodic pitch movement. | 4–8 bars, fast acceleration, more dissonant pitch. | 8 bars, melodic. | Optional. Keep simple if used. |
| Impact stack | All three layers, long sub boom (400–500 ms). | All three layers, shorter sub (200–300 ms), heavier mid impact. | All three layers, balanced. | Sub boom + transient (skip mid impact for cleanliness). |
| Negative space | 1–2 beats. Dramatic. Reverb tail lingers. | 0.5–1 beat. Tight. Nothing survives. | 1 beat. Clean. | 0.5–1 beat. Functional. |
| FX density per transition | 3–5 elements layered. | 2–3 elements. Raw is aggressive but sparse. | 3–4 elements. | 2–3 elements. Keep it clean. |

---

## 9. Transition FX Placement Timeline (Standard Build-Up)

For a 16-bar build-up at 150 BPM:

```
Bar:   1    2    3    4    5    6    7    8    9    10   11   12   13   14   15   16   DROP
       │    │    │    │    │    │    │    │    │    │    │    │    │    │    │    │    │
       │◄── Noise riser starts (HPF sweep begins) ──────────────────────────────────►│
       │              │◄── Tonal riser starts ──────────────────────────────────►│   │
       │                                      │◄── Snare roll accelerates ──────►│   │
       │                                                          │◄── Tonal DL ─►│  │
       │                                                                    │◄─NST─►│
       │                                                                         │SB │
                                                                              silence│
```

- **Bar 1:** Noise riser starts (barely audible, filter closed)
- **Bar 5:** Tonal riser enters (slow pitch ascent)
- **Bar 9:** Snare roll begins (1/8 notes, accelerating to 1/32 by bar 15)
- **Bar 13:** Tonal downlifter enters (fast 4-bar sweep)
- **Bar 15 beat 3–4:** Negative space (all elements hard-muted)
- **Bar 15 beat 4:** Sub drop may trigger (landing into the silence)
- **Bar 16 beat 1:** Impact stack + kick + drop = maximum energy

---

_Fornix Production Bible — feeds `05_Sound_Design/Sound_Design_Pack.md` FX sections and `03_Automation/Automation_Blueprint.md` transition automation._
