# Voice Leading for Synthesizer Chord Patches — Fornix Production Bible

> Adapted for layered synthesizer production rather than traditional notation
> Feeds: Sound Design Pack generator (`05_Sound_Design`) for chord design sections
> Synths referenced: Serum, Sylenth1

---

## 1. Core Voice Leading Rules (Translated to MIDI)

Traditional voice leading principles still apply when writing MIDI chords for synth stacks. The goal: smooth harmonic motion with minimal voice movement.

| Rule | Traditional | MIDI / Synth Translation |
|------|-------------|------------------------|
| **Common tones hold** | If two consecutive chords share a note, keep that voice stationary | In the MIDI piano roll, the shared note stays on the exact same MIDI pitch. Do not re-trigger it — extend the note or overlap. |
| **Stepwise motion** | Voices move by step (semitone or whole tone), not by leap | Each MIDI note in the chord should move ≤2 semitones to the next chord. If a voice must leap (>2 semitones), it's acceptable but should be the exception. |
| **Avoid parallel fifths** | Two voices moving in parallel perfect fifths sounds hollow | In a 4-voice pad stack, check that no two MIDI notes are always 7 semitones apart moving in the same direction. |
| **Avoid parallel octaves** | Two voices doubling at the octave remove independence | If two MIDI notes are always 12 semitones apart, one of them is redundant. Remove or re-voice. |
| **Contrary motion** | When one voice ascends, another descends | When the bass note moves down, the top note should move up (or vice versa). Creates a sense of expansion/contraction. |
| **Resolve tendency tones** | Leading tones (7th scale degree) resolve up; 7ths of chords resolve down | In A minor: G# resolves to A. In a Dm7 chord, the C resolves down to B or stays. Apply in the MIDI voicing — don't leave tendency tones hanging. |

---

## 2. Inversion Strategy for Smooth Harmonic Motion

The single most impactful voice leading technique for electronic producers: **choose the inversion that minimizes total voice movement.**

### How to Choose Inversions

For each chord change, calculate the total semitone movement if you use:
1. Root position of the new chord
2. First inversion (3rd in the bass)
3. Second inversion (5th in the bass)

Choose the inversion with the smallest total movement.

### Worked Example: Am → F → C → G in A minor

**Root position (naive — no voice leading):**
```
Am: A3  C4  E4       → total voices move:
F:  F3  A3  C4       → A→F (4↓), C→A (3↓), E→C (4↓) = 11 semitones total
C:  C3  E3  G3       → F→C (5↓), A→E (5↓), C→G (5↓) = 15 semitones total
G:  G3  B3  D4       → C→G (5↓), E→B (5↓), G→D (5↓) = 15 semitones total
```

**Voice-led (optimal inversions):**
```
Am: A3  C4  E4       → total voices move:
F:  A3  C4  F4       → A→A (0), C→C (0), E→F (1↑) = 1 semitone total ✓
C:  G3  C4  E4       → A→G (2↓), C→C (0), F→E (1↓) = 3 semitones total ✓
G:  G3  B3  D4       → G→G (0), C→B (1↓), E→D (2↓) = 3 semitones total ✓
```

The voice-led version moves 7 total semitones vs. 41 for the naive root position version. The listener perceives smooth, connected harmony rather than choppy block chords.

### Quick Rules for Inversion Selection

| Chord Movement | Preferred Inversion Approach |
|---------------|----------------------------|
| Root moves by step (e.g., Am → Bm) | Keep two common tones, move the third by step |
| Root moves by third (e.g., Am → F) | At least one common tone exists — hold it, move others minimally |
| Root moves by fourth/fifth (e.g., Am → Em) | One common tone. Hold it, move other voices by step. |
| Root moves by tritone (rare) | No common tones. Move all voices by the smallest intervals possible. |

---

## 3. Guide Tone Tracking

Guide tones are the 3rd and 7th of each chord. They define the chord quality (major/minor/dominant) and their movement creates the strongest sense of harmonic direction.

### Guide Tones in ii-V-I Motion (D minor → G → C, relative to A minor's parallel major)

```
Dm7:  F4 (3rd)  C5 (7th)
G7:   F4 (7th ← held from Dm7!)  B4 (3rd ← C stepped down)
Cmaj: E4 (3rd ← F stepped down)  B4 (7th ← held from G7!)
```

Notice: the guide tones move by step or hold. This is the fundamental engine of smooth harmony. Even in a dense supersaw stack, if the 3rd and 7th move smoothly, the harmony sounds connected.

### Application to hardstyle chord progressions

In minor key hardstyle (which is nearly always minor), the guide tones of the i chord are:
- 3rd = minor 3rd (e.g., C in Am)
- 7th = minor 7th (e.g., G in Am) or no 7th in triads

Track where these notes go in each chord change. If a guide tone leaps by 3+ semitones, re-voice the chord.

---

## 4. Register Assignment for the Fornix Layered Stack

The full Fornix synth stack occupies specific frequency registers. Voice leading applies within each layer independently.

| Layer | Register | MIDI Range | Synth | Voice Leading Priority |
|-------|----------|-----------|-------|----------------------|
| **Sub root** | Sub | C1–G2 (32–98 Hz) | Serum (sine) | Root note only — no voice leading (single note, follows root) |
| **Pad body** | Low-mid | C3–G4 (130–392 Hz) | Sylenth1 (warm pad) | **Primary voice leading layer.** All inversion and smooth motion rules apply here. This is where the harmony lives. |
| **Supersaw color tones** | Mid-high | C4–C6 (262–1046 Hz) | Serum (supersaw) | Voice-led, but can take more leaps for energy. The unison detune blurs small movements. |
| **Lead melody** | High | C5–C7 (523–2093 Hz) | Serum (lead) | Melodic motion — not chord voice leading. The lead follows its own melodic line, independent of the chord voicing below. |

### Cross-layer voice leading rule

When the bass note (sub root) moves DOWN, the top note of the supersaw layer should move UP (contrary motion). This creates a sense of harmonic expansion that feels powerful in cinematic hardstyle.

```
Am:  Sub=A1    Pad=A3 C4 E4    Saw=E5 A5 C6
F:   Sub=F1↓   Pad=A3 C4 F4↑   Saw=F5↑ A5 C6
```

Bass went down (A→F), top went up (E→F). The harmony opens outward.

---

## 5. Hocketing / Counterpoint for Counter-Melodies

Hocketing is a technique where two melodic lines alternate, filling each other's gaps. In hardstyle, this creates the call-and-response texture between lead and counter-melody (or lead and screech in hybrid drops).

### Rhythmic Gap-Filling

```
Beat:    1    &    2    &    3    &    4    &
Lead:    X    ──   X    ──   ──   X    ──   ──
Counter: ──   X    ──   X    X    ──   X    X
```

The counter-melody plays in the rhythmic spaces where the lead is silent. Neither plays simultaneously — they interlock like gears.

### Intervallic rules for counter-melodies

| Interval from lead | Quality | Use |
|-------------------|---------|-----|
| 3rd above or below | Consonant, warm | Default for euphoric counter-melodies |
| 6th above or below | Consonant, open | Alternative to 3rds — sounds wider |
| Octave | Unison (power, no independence) | Only for emphasis moments, not sustained counterpoint |
| 2nd or 7th | Dissonant, tense | Use momentarily for tension — resolve within 1 beat |
| 4th or 5th | Hollow, powerful | Use for rawphoric screeches — the "hollow" quality suits aggression |

---

## 6. Contrary Motion Rule

**When the lead ascends, the bass/pad descends.** This is the simplest and most effective way to create harmonic expansion in cinematic hardstyle.

### Application

```
Section: Buildup → Climax reveal

Lead melody: C5 → D5 → E5 → F5 → G5 (ascending — building energy)
Pad bass:    A3 → G3 → F3 → E3 → D3 (descending — opening the harmonic space)
Sub root:    A1 → G1 → F1 → E1 → D1 (following pad bass — mono sub follows root)
```

The listener perceives the harmony "opening up" — the treble goes higher while the bass goes lower. This maximizes the perceived frequency range and creates a sense of grandeur suited for cinematic hardstyle breakdowns.

### When to break the rule

- **Parallel motion** (both ascending) is acceptable in short phrases (2–4 bars) for energy and urgency
- **Oblique motion** (one voice holds while the other moves) is useful for stability in transitions
- The contrary motion rule applies most strongly during breakdowns and buildup sections where the emotional arc is paramount

---

## 7. Worked Examples for Primary Fornix Progressions

### Progression 1: i – VI – III – VII (Am – F – C – G)

The most common euphoric hardstyle progression.

```
Voice:     Soprano    Alto     Tenor    Bass (pad root)
Am:        E5         C5       A4       A3
F:         F5  (↑1)   C5 (0)   A4 (0)   A3→F3 (↓4)    ← A is common, C is common
C:         E5  (↓1)   C5 (0)   G4 (↓2)  G3  (↑2)      ← C is common
G:         D5  (↓2)   B4 (↓1)  G4 (0)   G3  (0)       ← G is common
Am:        E5  (↑2)   C5 (↑1)  A4 (↑2)  A3  (↑2)      ← cycle complete
```

Total movement: 20 semitones across 4 changes (avg 5 per change — very smooth).

### Progression 2: i – iv – VI – V (Am – Dm – F – E)

The emotional minor progression with the Picardy-adjacent E major (dominant).

```
Voice:     Soprano    Alto     Tenor    Bass
Am:        E5         C5       A4       A3
Dm:        F5  (↑1)   D5 (↑2)  A4 (0)   D3  (↓5)*     ← *bass leap acceptable (root motion)
F:         F5  (0)    C5 (↓2)  A4 (0)   F3  (↑3)
E:         E5  (↓1)   B4 (↓1)  G#4(↓1)  E3  (↓1)      ← G# is the leading tone → resolves to A
Am:        E5  (0)    C5 (↑1)  A4 (↑1)  A3  (↑5)*     ← *bass returns, leading tone resolved
```

### Progression 3: Phrygian I – bII – I (E – F – E, in E Phrygian)

Maximum tension through the semitone root movement.

```
Voice:     Soprano    Alto     Tenor    Bass
E:         B4         G#4      E4       E3
F:         C5  (↑1)   A4 (↑1)  F4 (↑1)  F3  (↑1)     ← everything moves up by one semitone
E:         B4  (↓1)   G#4(↓1)  E4 (↓1)  E3  (↓1)     ← everything returns
```

This is pure parallel motion — normally avoided, but in the Phrygian I–bII–I context, the parallel semitone movement IS the effect. The entire harmonic field shifts up and back by one semitone, creating a wave of tension and release. This is the sound of dark cinematic hardstyle.

---

_Fornix Production Bible — feeds `05_Sound_Design/Sound_Design_Pack.md` chord design and harmonic arrangement sections._
