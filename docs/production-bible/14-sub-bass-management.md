# Sub-Bass Management Rules for Hardstyle — Fornix Production Bible

> Feeds: Producer Checklist generator (`06_Checklists`), Sound Design Pack generator (`05_Sound_Design`), Mix Report generator (`04_Mix`)
> Plugins referenced: FabFilter Pro-Q 3, FabFilter Pro-MB

---

## 1. The Hardstyle Fundamental Principle

**In hardstyle, the kick drum IS the bass.** The kick's pitched tail provides the sub-bass energy (30–80 Hz) that other genres assign to a bass guitar, 808, or synth bass. This means:

- The sub region (below 80 Hz) belongs **exclusively** to the kick fundamental and the dedicated sub sine layer
- Any additional sub element (reverse bass, pads, orchestral low-end) must **time-split** or **frequency-split** around the kick
- If two elements compete in the sub region simultaneously, the result is phase cancellation, limiter stress, and lost kick impact

This is not a preference — it's physics. Sub frequencies have wavelengths of 4–12 meters. Two sub sources at slightly different phases create destructive interference that removes energy rather than adding it.

---

## 2. Mono Below 100–120 Hz (Pro-Q 3 M/S Mode)

All sub content must be mono. Stereo information below 100–120 Hz causes:
- Phase cancellation on mono playback systems (club subs, festival PAs, phone speakers)
- Vinyl cutting issues (if relevant for DJ promo)
- Uneven bass response across the stereo field (left side louder than right, or vice versa)

### Pro-Q 3 M/S Mode Setup

| Parameter | Value |
|-----------|-------|
| Insert on | MASTER bus (position 5 in the chain — after glue comp and tape sat, before multiband) |
| Channel mode | M/S |
| Band 1 | **Side channel:** High-pass filter |
| Filter type | High-pass, Brickwall or 96 dB/oct minimum (Brickwall is steeper than 96 dB/oct — they are separate Pro-Q 3 options) |
| Frequency | 100–120 Hz (rawphoric: 120 Hz for maximum mono safety. Cinematic: 100 Hz to preserve some low-mid width.) |
| Purpose | Removes ALL stereo information below the cutoff. Bass becomes pure mono. |

### Alternative: Per-channel mono enforcement

Instead of (or in addition to) the master M/S cut, enforce mono on individual channels:

| Channel | Mono enforcement method |
|---------|----------------------|
| Sub sine | Pan: Center. Utility/Mixtool: Mono. Already mono by nature (pure sine = no stereo content). |
| Reverse bass | Pan: Center. Pro-Q 3 M/S: HPF on side at 150 Hz. The pitch sweep may create brief stereo artifacts from processing. |
| Kick (all layers) | Pan: Center. Should be mono from synthesis. If using stereo saturation plugins, check the output. |
| Pads/chords | Pro-Q 3 M/S: HPF on side at 200–300 Hz. Pads have no business being stereo below 200 Hz. |

---

## 3. Multiband Sidechain for Kick/Sub Collision (Pro-MB)

When a sub element (reverse bass, sub sine, 808) must coexist with the kick, use multiband sidechain compression to duck only the sub frequencies.

### Pro-MB Configuration

| Band | Frequency Range | Sidechain Source | Ratio | Attack | Release | Range (Max GR) |
|------|----------------|-----------------|-------|--------|---------|---------------|
| **Band 1 (Sub)** | 30–80 Hz | Kick (pre-fader send) | ∞:1 | 0.5 ms | 80–120 ms | −12 to −20 dB |
| **Band 2 (Low body)** | 80–200 Hz | Kick (pre-fader send) | 4:1–8:1 | 1 ms | 60–100 ms | −6 to −10 dB |
| **Band 3 (Upper body)** | 200–500 Hz | No sidechain | — | — | — | — |
| **Band 4 (Harmonics)** | 500+ Hz | No sidechain (or very light, 2:1) | — | — | — | — |

### Why multiband instead of full-band

| Full-band sidechain | Multiband sidechain |
|--------------------|-------------------|
| Ducks the ENTIRE reverse bass signal when the kick hits | Only ducks the SUB frequencies when the kick hits |
| The reverse bass's harmonic character (200–500 Hz) disappears during the kick | The reverse bass's harmonics persist — only the sub-frequency collision is resolved |
| Sounds like "pumping" — the entire element breathes | Sounds natural — the kick's sub punches through while the reverse bass retains its body |
| Simpler to set up | More surgical and transparent |

### Attack and release rationale

- **Attack 0.5–1 ms:** Must be faster than the kick transient. If the sidechain engages after the kick's sub has already collided with the reverse bass, the phase cancellation has already happened.
- **Release 80–120 ms at 150 BPM:** Each beat = 400 ms. The kick's sub energy lasts ~100–200 ms. Release must be complete before the reverse bass needs to be fully audible on the offbeat (200 ms after the kick).
- **If release is too short:** The reverse bass returns too quickly and the "pocket" is too tight — feels rushed.
- **If release is too long:** The reverse bass doesn't fully recover before its own onset — the offbeat groove loses weight.

---

## 4. 808-Style Sub Alongside the Kick

If using an 808-style sub bass (common in hybrid hardstyle/trap crossover or festival-hardstyle), the same rules apply with tighter settings.

### 808 Sidechain Settings

| Parameter | Value | Notes |
|-----------|-------|-------|
| Sidechain source | Kick (pre-fader send) | |
| Compressor type | Pro-MB Band 1 (30–80 Hz) or Pro-C 2 full-band | Pro-MB preferred for same reasons as reverse bass |
| Threshold | Set so the kick triggers −10 to −15 dB GR | Aggressive — the 808 must fully clear for the kick |
| Ratio | ∞:1 | Hard limiting — no compromise in the sub |
| Attack | 0.3–0.5 ms | Faster than reverse bass — 808s have less harmonic content to preserve |
| Release | 60–100 ms | Shorter than reverse bass — 808s can return faster |
| Knee | Hard (0 dB) | No soft knee — the transition must be clean |

### 808 tuning rule

The 808 sub and kick fundamental **must be tuned to the same root note or an octave relationship.** A kick fundamental at G1 (49 Hz) and an 808 at A1 (55 Hz) creates a beating frequency of 6 Hz that sounds like rhythmic phase cancellation. Either tune the 808 to G1 or retune the kick.

---

## 5. Kick Fundamental Frequency Tuning Guide

The kick's sub frequency is determined by the track's root note. At 150 BPM, these are the common fundamental frequencies:

| Root Note | Octave 1 (Hz) | Octave 2 (Hz) | Most Common Octave | Notes |
|-----------|---------------|---------------|-------------------|-------|
| C | 32.7 | 65.4 | C2 (65 Hz) | Very low — pushes subwoofer limits. Works for dark cinematic. |
| D | 36.7 | 73.4 | D2 (73 Hz) | Common dark key. Good sub weight. |
| E | 41.2 | 82.4 | E2 (82 Hz) | Popular for rawphoric. Strong sub without excessive excursion. |
| F | 43.7 | 87.3 | F2 (87 Hz) | Works well. Mid-range sub weight. |
| F# | 46.2 | 92.5 | F#2 (92 Hz) | Fornix favorite. Cinematic weight with good speaker translation. |
| G | 49.0 | 98.0 | G2 (98 Hz) | The classic hardstyle root. Maximum kick impact at 98 Hz. |
| A | 55.0 | 110.0 | A2 (110 Hz) | Higher — more "punchy," less "deep." Good for festival. |
| B | 61.7 | 123.5 | B1 (62 Hz) | Low — cinematic depth. Pushes subs. |

### Which octave to use

- **Octave 1** (32–62 Hz): Very deep. Only works on systems with true sub extension. Cinematic-euphoric and concept album tracks. Risk: inaudible on small speakers.
- **Octave 2** (65–123 Hz): Standard. Audible on most playback systems. The overwhelming majority of hardstyle kicks live here.

### Tuning the kick sub

1. In Serum (or kick synth): Set the pitch envelope's final note to the root
2. Use a tuner plugin (or S1's built-in tuner) on the kick tail (not the transient — the tail carries the pitch)
3. The tail should settle on the root note within ±5 cents
4. If the kick tail drifts sharp or flat, adjust the synth's fine-tuning until the tuner reads the root

---

## 6. HPF Cutoff for Sub Elements

Even sub-focused elements need a high-pass filter to remove inaudible rumble that wastes headroom.

| Element | HPF Frequency | Slope | Reason |
|---------|--------------|-------|--------|
| Kick (after full chain) | 25–30 Hz | 48 dB/oct (steep) | The distortion chain generates sub-harmonic content below the fundamental. Remove it. |
| Sub sine | 20–25 Hz | 24 dB/oct | The sine generator may produce DC offset or ultra-low drift. Remove content below hearing threshold. |
| Reverse bass | 25–30 Hz | 48 dB/oct | The pitch sweep generates momentary sub-sub content at the bottom of the sweep. Remove it. |
| 808 sub (if used) | 25 Hz | 24 dB/oct | Same as sub sine — remove DC and ultra-low content. |

### Why HPF on sub elements matters

Content below 25 Hz is inaudible to humans but:
- Consumes limiter headroom (the limiter catches the peaks, even if you can't hear them)
- Causes speaker excursion (subwoofer cone moves for inaudible content, wasting power)
- Creates intermodulation with audible content when compressed or limited
- Wastes bit depth (encoding energy that adds no perceptual value)

---

## 7. How Sub Management Changes Between Style Variants

| Aspect | Cinematic-Euphoric | Rawphoric | Anthemic-Euphoric | Festival-Hardstyle |
|--------|-------------------|-----------|-------------------|-------------------|
| Sub ownership | Kick fundamental + sub sine. Reverse bass is supportive. | Kick fundamental + heavily processed reverse bass. Sub sine may be minimal. | Kick fundamental + sub sine. Standard reverse bass. | Kick fundamental + tight sub sine. Short reverse bass. |
| Mono cutoff | 100 Hz (preserve some low-mid width for cinematic depth) | 120 Hz (maximum mono safety — the sub must be bulletproof) | 100–120 Hz | 120 Hz (festival PA translation) |
| Reverse bass distortion | Light (Tape 10–15% on body only) | Moderate (Tape 20–30% on harmonics, never on sub) | Light | Minimal (clean, functional) |
| Reverse bass LPF | 2000–3000 Hz | 3000–4000 Hz (allow more harmonics for rawphoric grit) | 2000–3000 Hz | 2000 Hz (clean) |
| Sidechain depth on RB | −8 to −10 dB | −10 to −14 dB (deeper pocket for aggressive kick) | −8 to −10 dB | −8 to −10 dB |
| 808 allowed | Rare (cinematic hybrid only) | Rare | No | Optional (festival hybrid) |
| Sub sine presence | Standard (sustained between kicks) | Optional (reverse bass may replace it) | Standard | Standard but shorter release |

---

## 8. Sub Management Checklist

For the Producer Checklist generator to include:

- [ ] Kick fundamental is tuned to the track's root note (within ±5 cents)
- [ ] Reverse bass pitch envelope lands on the same root note as the kick
- [ ] Sub sine is tuned to the root note
- [ ] All sub elements (kick, RB, sub sine) are mono — no stereo content below 120 Hz
- [ ] Pro-Q 3 M/S HPF on Side channel at 100–120 Hz is active on the master bus
- [ ] Multiband sidechain (Pro-MB) is active on the reverse bass/sub — sub band fully ducks for kick
- [ ] HPF at 25–30 Hz (48 dB/oct) is active on the kick channel (post-distortion chain)
- [ ] HPF at 20–25 Hz is active on sub sine and reverse bass
- [ ] Phase correlation between kick and reverse bass is positive (check with correlation meter)
- [ ] Mono compatibility test passed: full mix in mono retains kick punch and sub weight
- [ ] No sub content from non-bass elements (leads HPF'd at 150+ Hz, pads at 120+ Hz, etc.)
- [ ] Sub sine does not exceed −16 dBFS RMS on its own channel (supportive role, not dominant)

---

_Fornix Production Bible — feeds `06_Checklists`, `05_Sound_Design`, and `04_Mix` generators for sub-bass management._
