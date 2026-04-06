# Vocal Processing and Atmospheric Texture Design — Fornix Production Bible

> Feeds: Sound Design Pack generator (`05_Sound_Design`), Routing Sheet generator (`02_Routing`)
> DAW: Studio One 7
> Two distinct areas: VOCAL PROCESSING and ATMOSPHERIC TEXTURES

---

# PART A — VOCAL PROCESSING

---

## 1. Spoken Word Cinematic Intro Treatment

For `vocalPresenceType: "spoken-intro"` or `"spoken-texture"`.

| Insert Position | Plugin | Settings | Purpose |
|----------------|--------|----------|---------|
| 1 | **HPF** (Pro-Q 3) | 80–120 Hz, 18 dB/oct. Male: 100–120 Hz. Female: 80–100 Hz. | Remove room rumble, proximity effect, handling noise |
| 2 | **Compression** (Pro-C 2) | Style: Opto. Ratio: 3:1. Attack: 20–40 ms. Release: 100–200 ms. Threshold for 3–5 dB GR. | Even out dynamics — spoken word has large dynamic range |
| 3 | **EQ** (Pro-Q 3) | Presence boost: +2–4 dB at 3–5 kHz (broad, Q 1.5–2.5). Cut mud: −2–3 dB at 200–400 Hz if boxy. | Clarity and intelligibility |
| 4 | **Reverb** (inserted or send) | Hall or cathedral. Decay: 2.5–4.0 s. Wet: 25–40%. Pre-delay: 40–80 ms. | Cinematic space — the spoken word should sound like it's in a vast space |
| 5 | **Delay** (send only) | 1/4 dotted, 2–3 repeats, HPF 300 Hz on return. Wet: 15–25%. | Spatial depth and cinematic echo. Automate: on during phrase endings, off during next phrase. |

### Key settings for cinematic spoken word

- **Pre-delay on reverb (40–80 ms):** Separates the dry voice from the reverb onset. Intelligibility stays high even with wet reverb.
- **HPF on delay return (300 Hz):** Prevents low-frequency buildup in the delay repeats. The echoes are bright and clear, not muddy.
- **Reverb decay by style:** Cinematic-euphoric: 3–4 s. Rawphoric: 1.5–2 s (drier). Festival: 1–2 s.

---

## 2. Vocal Chop Technique

For `vocalPresenceType: "vocal-chops"`.

### Pitch Shifting Method

| Parameter | Value | Notes |
|-----------|-------|-------|
| Pitch shift range | ±5 semitones from source | Beyond ±5, artifacts become obvious |
| Algorithm | S1's built-in pitch shift (Sound Variations) or Melodyne | Formant-independent pitch shifting preferred |
| Formant preservation | **Yes** — always preserve formants when pitch shifting | Without formant preservation, pitched-up vocals sound like chipmunks |

### Formant Shifting Direction Rules

| Pitch Direction | Formant Shift Direction | Amount | Result |
|----------------|------------------------|--------|--------|
| Pitch UP (+semitones) | Formant DOWN (−1 to −3 semitones) | Counteracts the natural formant rise | Voice stays natural-sounding despite higher pitch |
| Pitch DOWN (−semitones) | Formant UP (+1 to +3 semitones) | Counteracts the natural formant drop | Voice stays natural-sounding despite lower pitch |
| No pitch shift | No formant shift | — | Natural voice |

**Why:** Pitch shifting moves all frequencies proportionally — including formants. Human formants (vowel sounds) live at fixed frequency ranges. When you pitch up a vocal, the formants also move up, making the voice sound unnatural. Counteracting the formant shift restores natural vowel quality.

### Slicing and MIDI Assignment

1. **Import vocal** into S1's Sample One XT or Impact XT
2. **Slice at transients** — use S1's auto-slice at transient peaks
3. **Map slices to MIDI notes** — each slice gets a pad/key
4. **Play the chops rhythmically** via MIDI — create patterns by triggering slices in new orders
5. **Process the sampler output** — HPF 150 Hz, compression 4:1, reverb send

---

## 3. Lead Vocal Hardstyle Processing Chain

For `vocalPresenceType: "featured-vocal"` or `"sung-hook"`.

| Position | Plugin | Settings | Purpose |
|----------|--------|----------|---------|
| 1 | **Gate** (built-in or Pro-G) | Threshold: −40 to −30 dBFS. Range: −20 dB. Attack: 0.5 ms. Release: 50–100 ms. | Remove room noise, mic bleed, breathing between phrases |
| 2 | **De-esser** (Pro-DS or built-in) | Frequency: 4–8 kHz (sweep to find the worst sibilance). Range: −4 to −8 dB. | Reduce "s" and "t" sibilance before compression amplifies it |
| 3 | **EQ** (Pro-Q 3) | HPF: 80–120 Hz, 18 dB/oct. Presence: +2–3 dB at 3–5 kHz. Cut mud: −2–3 dB at 200–400 Hz. | Tonal shaping |
| 4 | **Compression** (Pro-C 2) | Style: Vocal or Opto. Ratio: 3:1–4:1. Attack: 10–25 ms. Release: 80–150 ms. Target: 4–6 dB GR. | Dynamic control — vocal must sit consistently in the mix |
| 5 | **Parallel compression** (bus send) | Send to a parallel bus with: Pro-C 2, Punch mode, Ratio 8:1, fast attack/release, mixed back −8 to −6 dB | Adds size and presence without squashing the main vocal dynamics |
| 6 | **Reverb send** | VOCAL_VERB return: Plate, 1.2–1.8 s, pre-delay 30–50 ms, HPF 300 Hz on return | Spatial depth. Dedicated return — do not share with leads |
| 7 | **Delay send** | DELAY_THROW: dotted 1/8, 2–3 repeats, HPF 400 Hz. Automate: on for phrase endings, off before next phrase. | Rhythmic depth. Throws on phrase endings only — never constant. |
| 8 | **Sidechain to kick** | Light — Attack: 2–5 ms. Release: 80–120 ms. Ratio: 3:1–4:1. GR: −3 to −4 dB. | Vocal must remain intelligible through the kick. Light sidechain — not aggressive. |

### Vocal chain order rationale

- **Gate before de-esser:** Remove noise before processing. The de-esser won't trigger on room noise.
- **De-esser before compression:** Compression amplifies everything proportionally — sibilance that's barely acceptable pre-compression becomes painful post-compression.
- **EQ before compression:** Shape the tone that the compressor reacts to. If mud is present, the compressor will react to mud energy — remove it first.
- **Sidechain is last:** Shape the finished vocal relative to the kick. Must be light (−3 to −4 dB) — aggressive vocal sidechain destroys intelligibility.

---

## 4. When to Use Each Vocal Mode

| Mode | Style Variants | Routing Impact | Sound Design Impact |
|------|---------------|---------------|-------------------|
| `none` | Rawphoric (default), festival (optional) | No VOX bus in routing sheet | No vocal processing section in Sound Design Pack |
| `spoken-intro` | Cinematic-euphoric | Minimal VOX bus (1 channel, first 16–32 bars only) | Spoken word chain (§1) |
| `spoken-texture` | Any | VOX bus with 1–2 channels | Atmospheric spoken processing, scattered throughout |
| `vocal-chops` | Any | VOX bus with sampler channel | Chop technique (§2), rhythmic processing |
| `featured-vocal` | Anthemic-euphoric, cinematic | Full VOX bus with main + doubles + harmonies | Full vocal chain (§3), dedicated VOCAL_VERB return |
| `sung-hook` | Anthemic-euphoric, festival | Full VOX bus, elevated priority (lead and vocal share center) | Full chain + hook-specific delay throws and width automation |
| `choir` | Cinematic-euphoric | VOX bus or ORCHESTRAL bus sub-channel | Bus compression, shared reverb, blend control |

---

# PART B — ATMOSPHERIC TEXTURES

---

## 5. Pad Synthesis Using Paulstretch Technique

Paulstretch is an extreme time-stretching algorithm that converts any audio into a slowly evolving atmospheric texture. In Studio One:

### How to Apply in Studio One

1. **Record or import a source** — any audio: a chord hit, a vocal phrase, a field recording, a single piano note
2. **Bounce in Place** the clip (to ensure it's a standard audio file)
3. **Use S1's AudioBend** — stretch the clip to extreme lengths (10×–100× original duration)
4. **OR use an external Paulstretch tool** — export the audio, process externally, re-import

### Parameter Values

| Parameter | Value | Effect |
|-----------|-------|--------|
| Stretch amount | 10×–50× for pads, 50×–200× for drones | 10× produces slow-evolving textures. 200× produces near-static drones. |
| Window size | 0.25–1.0 seconds | Larger window = smoother, less grainy. Smaller window = more "granular" texture. |
| Source material | 1–5 seconds of rich audio (chord, vocal, orchestral hit) | The richer the source, the more interesting the stretched result. A single sine wave stretches to silence. |

### Processing the Paulstretched Pad

| Insert | Settings | Purpose |
|--------|----------|---------|
| HPF | 100–200 Hz, 12 dB/oct | Remove sub rumble from the stretched audio |
| LPF | 6000–10000 Hz, 12 dB/oct | Remove harsh artifacts from the stretching algorithm |
| Saturation | Tape 5–10%, very gentle | Warm up the digital artifacts |
| Reverb | Hall, 2–4 s, 20–30% mix | Add spatial depth. The pad IS atmosphere — it should live in a space. |
| Sidechain | From kick, light (−3 to −4 dB, long release) | Gentle pumping — the pad breathes with the kick. |

---

## 6. Drone and Tension Texture Design

For dark cinematic sections, anti-climax build-ups, and atmospheric intros.

### Oscillator Configuration (Serum)

| Parameter | Value | Notes |
|-----------|-------|-------|
| OSC A | Saw or triangle, 1 voice (no unison) | Unison creates a pad. Single voice creates a drone. |
| OSC B | Detuned +2–5 cents from OSC A, same waveform | The micro-detuning creates slow beating — the "alive" quality of drones |
| Sub Oscillator | Off or very quiet sine (−18 dB) | Drones don't need prominent sub — that's the kick's job |
| Filter | LP 24 dB/oct, cutoff 30–50% | Dark, filtered sound |
| Modulation depth | LFO → filter cutoff: 10–20%. LFO → OSC B pitch: ±5 cents. | Slow, subtle movement — the drone should barely change over 16 bars |
| LFO rate | 1/8 to 1 bar (very slow) | Fast LFOs create rhythmic textures. Slow LFOs create evolving atmospheres. For drones: slow. |
| Filter movement | LFO → filter cutoff, triangle wave, 2–4 bar cycle | The filter opens and closes slowly — the drone brightens and darkens over time |

### Tension Texture Layering

| Layer | Content | Register | Purpose |
|-------|---------|----------|---------|
| Drone root | Single note on the tonic, low register (C2–G3) | Low-mid | Harmonic anchor — establishes the key |
| Harmonic layer | Fifth or octave above, very quiet | Mid | Adds depth without melodic information |
| Noise texture | Filtered white/pink noise, very quiet | High | Adds "air" and unease |
| Movement layer | Granular texture or Paulstretched fragment | Full range | Evolving character — prevents the drone from feeling static |

---

## 7. Percussion Beyond Kick

### Clap / Snare Layer Anatomy

Every hardstyle clap/snare is a layered composite of three frequency components:

| Component | Frequency Range | Source | Processing |
|-----------|----------------|--------|-----------|
| **Body** | 150–500 Hz | Low-tuned snare sample or sine burst | Light compression, HPF 100 Hz |
| **Crack** | 1–5 kHz | High-tuned snare or noise transient | Transient shaping (+2–4 dB attack), HPF 500 Hz |
| **Noise tail** | 3–10 kHz | White noise burst, 30–80 ms decay | HPF 2 kHz, volume envelope shapes the "spread" |

**Layering rule:** Each component is a separate sample or synth layer. The body provides weight (felt on speakers), the crack provides definition (heard on earbuds), the noise tail provides width and "air."

### Hi-Hat Placement and EQ

| Parameter | Value | Notes |
|-----------|-------|-------|
| Placement | Straight 1/8 notes (default) or 1/16 patterns for energy | Open hi-hat on offbeats for groove variation |
| HPF | 300–600 Hz, 18 dB/oct | Aggressive — hi-hats are pure top-end elements. Remove everything below 300 Hz. |
| LPF | 10–14 kHz, 12 dB/oct (optional) | Only if the hi-hat sample is too bright or "tinny" |
| Velocity | 75–95% for closed, 100% for open, 60–80% for ghost notes | Velocity variation creates human groove |
| Pan | Slight L/R variation (±10–20%) or center | Avoid hard panning — hi-hats should feel part of the groove, not a separate element |
| Sidechain | From kick, very light (−2 to −3 dB) or none | Hi-hats sit above the kick frequency range — sidechain is optional |

### Ride Convention in Intros and Outros

| Position | Ride Use | Purpose |
|----------|---------|---------|
| Intro bars 1–16 | Ride on beats 1 and 3 (half notes) | Establishes pulse before the kick enters. DJs use the ride to identify the tempo. |
| Intro bars 17–32 | Ride continues, kick enters | Ride and kick together establish the groove foundation. |
| Drop | **No ride.** | The drop is kick + hats + clap territory. Rides add unwanted high-mid energy. |
| Outro bars 1–16 | Ride returns as other elements strip away | The ride signals "we're returning to DJ-safe territory." |
| Outro bars 17–end | Ride + kick only | Clean mixing point. Same energy as the intro. |

**Why rides in intros/outros specifically:** The ride cymbal has a distinctive sustained high-frequency character (2–8 kHz) that cuts through any DJ mix. DJs listen for the ride to identify where the intro's groove starts. It's a DJ utility convention — the ride IS the "I'm ready to be mixed" signal.

---

_Fornix Production Bible — feeds `05_Sound_Design/Sound_Design_Pack.md` vocal and atmospheric sections, `02_Routing/Routing_Sheet.md` vocal bus configuration._
