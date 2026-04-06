# Rawphoric Screech Synthesis — Fornix Production Bible

> Synthesizer: **Serum** (Xfer Records)
> Style variants: rawphoric, anthemic-euphoric (hybrid lead), festival-hardstyle (accent screech)
> Feeds: Sound Design Pack generator (`sd_generate_hardstyle_lead`, `fornix_generate_production_package` → `05_Sound_Design`)

---

## 1. Oscillator Configuration

### OSC A — Primary Screech Voice

| Parameter | Value | Notes |
|-----------|-------|-------|
| Wavetable | `Dist Growl`, `Analog_Brassy`, or custom digital table with sharp zero-crossings | Custom tables with high harmonic density produce the most aggressive results |
| Wavetable position | 50–75% | Leave modulation headroom — never park at 0% or 100% |
| Unison voices | 5 | Sweet spot: wide enough for presence, CPU-efficient. Use 7 for ultra-wide festival variant only |
| Detune | 0.15–0.25 (Serum units — at default 2-semitone range ≈ 30–50 cents) | Enough spread for width without phase mud in the 1–3 kHz core |
| Blend | 0.00–0.20 | Keep voices distinct — high blend blurs the screech character into a pad |
| Octave | 0 (C4 root region) | Stack at +1 for brightness variant |
| Phase | Random | Prevents comb-filtering on retrigger |

### OSC B — Body Layer (Optional)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Wavetable | `Basic_SawRound` or `Analog_BrSaw` | Stable body foundation |
| Wavetable position | 0–20% (fixed) | No modulation — this is the anchor |
| Unison voices | 3 | Tighter than OSC A |
| Detune | 0.08–0.12 | Narrow — body must not compete with OSC A width |
| Level | −6 to −12 dB below OSC A | Supporting role only |
| Octave | 0 or −1 | −1 adds low-mid weight for raw variants |

### Noise Oscillator

| Parameter | Value |
|-----------|-------|
| Enabled | Optional — adds air and texture |
| Type | `BrightWhite` or `Pink` |
| Level | −18 to −24 dB |
| Filter | HPF at 4 kHz (internal) |
| Purpose | Top-end sizzle that rides above the wavetable content |

---

## 2. Filter Configuration

| Parameter | Screech Type: Raw Growl | Screech Type: Metallic | Screech Type: Formant/Vowel |
|-----------|------------------------|------------------------|-----------------------------|
| Filter type | MG Low 24 (Moog-style) | Comb + | French LP |
| Cutoff (start position) | 30–45% | 40–55% | 35–50% |
| Resonance | 55–70% | 65–80% | 60–75% |
| Drive (filter internal) | 20–35% | 30–45% | 15–30% |
| Key tracking | 50–100% | 75–100% | 50–75% |
| Routing | Serial (OSC A → Filter → out) | Serial | Serial |

**Why high resonance matters:** Resonance creates the "scream" quality. Below 50% the filter just darkens/brightens — it does not produce the formant-like peak that defines a screech. Above 80% on MG Low 24 the self-oscillation becomes uncontrollable.

**Key tracking rationale:** Without key tracking, higher notes sound muffled because the cutoff stays fixed while harmonic content shifts upward. 50–100% tracking keeps the brightness proportional to pitch.

---

## 3. LFO Configuration

### LFO 1 → Filter Cutoff (Primary Rhythmic Movement)

This is the single most important modulation in the patch. It IS the screech character.

| Parameter | Value | Notes |
|-----------|-------|-------|
| Mode | **Envelope (Env)** | Retriggered per note — creates predictable rhythmic patterns instead of free-running drift |
| Rate | 1/8 synced (primary), 1/4 or 1/16 for variants | 1/8 at 150 BPM = 200 ms cycle — the standard rawphoric pulse |
| Amount → Filter cutoff | 40–70% | Below 40% the sweep is too subtle; above 70% it clips the resonance into noise |
| Shape options by screech type: | | |
| — Wub screech | Sine or triangle | Smooth, predictable vowel-like movement |
| — Growl screech | Custom: sharp attack (30% rise), slow decay (70% fall) | Aggressive bite on the front, organic release |
| — Vowel screech | Custom: double-peak shape | Mimics formant movement (open-close-open within one cycle) |
| — Staccato screech | Custom: narrow spike (10% width at top) | Brief bright flash, long dark sustain — rhythmic punctuation |

### LFO 2 → Wavetable Position (OSC A)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Mode | Envelope or synced | |
| Rate | 1/2 to 1/4 synced | Slower than LFO 1 — provides longer timbral arcs over 2–4 beats |
| Shape | Saw (down) or triangle | |
| Amount → WT position | 20–50% | Too high and the timbre jumps between unrelated harmonics |

### ENV 2 → Filter Cutoff (Note Attack Bite)

| Parameter | Value |
|-----------|-------|
| Attack | 0–5 ms |
| Decay | 50–200 ms |
| Sustain | 30–60% |
| Release | 100–300 ms |
| Amount → Filter cutoff | 15–30% |
| Purpose | Adds per-note transient bite before LFO 1 takes over the rhythmic sweep |

**Envelope Mode explained:** In Serum, setting an LFO to "Env" mode means it fires once from its start point each time a note triggers, then holds at the end position until release. This is critical for rawphoric screech because:
1. Each note starts the filter sweep at the same phase → predictable rhythm
2. The sweep is locked to note-on, not free-running → no drift between kick and screech
3. You can shape the exact attack/movement per note without worrying about where in the LFO cycle you happen to be

Without Env mode, the screech sounds inconsistent — some notes catch the LFO at the top (bright), some at the bottom (dark). The rawphoric audience expects mechanical precision.

---

## 4. Modulation Routing Table

| Source | Destination | Amount | Purpose |
|--------|-------------|--------|---------|
| LFO 1 (Env mode) | Filter 1 cutoff | 40–70% | Primary rhythmic movement — defines the screech character |
| LFO 2 | OSC A wavetable position | 20–50% | Timbral evolution within phrases |
| ENV 2 | Filter 1 cutoff | 15–30% | Note-attack transient bite |
| Velocity | Filter 1 cutoff | 10–25% | Dynamic expression — harder hits sweep further |
| Velocity | LFO 1 rate or amount | 5–15% | Harder hits = more rhythmic intensity |
| Mod Wheel | Serum FX → Distortion drive | 0–40% | Live performance control over aggression |
| Aftertouch | OSC A wavetable position | 10–20% | Held-note timbral shifts for variation |
| Note (key tracking) | Filter 1 cutoff | 50–100% | Higher notes naturally brighter |
| LFO 1 (Env mode) | OSC A level (optional) | 5–15% | Subtle amplitude pulsing synced to filter sweep — adds "breathing" |
| ENV 1 (Amp) | — | Standard ADSR | A: 0 ms, D: 0 ms, S: 100%, R: 50–150 ms |

---

## 5. Post-Serum FX Chain

Order matters. Each stage prepares the signal for the next.

### Position 1 — HPF (FabFilter Pro-Q 3)

| Parameter | Value |
|-----------|-------|
| Filter type | High-pass, 24 dB/oct (4th order) |
| Frequency | 150–200 Hz |
| Purpose | Remove ALL sub content — screech has no business below 150 Hz. Prevents distortion stages from generating sub-harmonic artifacts. |
| EQ mode | Zero-latency / minimum-phase |

### Position 2 — Distortion Stage 1 (FabFilter Saturn 2)

| Band | Range | Type | Drive | Mix |
|------|-------|------|-------|-----|
| Low | 200–800 Hz | Warm Tube | 20–30% | 100% |
| Mid | 800 Hz–4 kHz | Tape | 30–50% | 100% |
| High | 4–12 kHz | Tube | 15–25% | 100% |

Purpose: Primary harmonic generation. The mid band (800 Hz–4 kHz) is the screech core — this is where most of the character comes from. Low band adds body warmth without muddying the sub. High band adds sizzle.

### Position 3 — Surgical EQ (FabFilter Pro-Q 3)

| Action | Frequency | Gain | Q | Notes |
|--------|-----------|------|---|-------|
| Cut harsh resonance | 2.5–3.5 kHz (find by sweeping) | −2 to −4 dB | 6–10 (narrow) | Remove the single worst resonance peak from Saturn's distortion |
| Cut boxiness if needed | 400–600 Hz | −1 to −3 dB | 2–4 | Only if OSC B body layer makes it thick |

Purpose: Clean up artifacts from distortion stage 1 BEFORE they compound in stage 2.

### Position 4 — Distortion Stage 2 (FabFilter Saturn 2 or iZotope Trash 2)

| Parameter | Value |
|-----------|-------|
| Mode | Single-band |
| Type | Tape or Warm Tube |
| Drive | 15–25% |
| Mix | 80–100% |
| Purpose | Upper harmonic sheen — adds the final aggression layer. Lighter than stage 1 because the signal is already harmonically rich. |

### Position 5 — Compression (FabFilter Pro-C 2)

| Parameter | Value |
|-----------|-------|
| Style | Opto or Vocal |
| Ratio | 3:1–4:1 |
| Attack | 10–20 ms |
| Release | 50–100 ms |
| Threshold | Set for 3–6 dB gain reduction |
| Purpose | Tame the dynamic range of the LFO-driven filter sweep. Without this, the screech is too loud at sweep peaks and too quiet in troughs. |

### Position 6 — Presence EQ (FabFilter Pro-Q 3)

| Action | Frequency | Gain | Q |
|--------|-----------|------|---|
| Presence boost | 3–5 kHz | +2 to +3 dB | 1.5–2.5 (broad) |
| Air shelf (optional) | 8 kHz+ | +1 to +2 dB | shelf |
| LPF (optional) | 12–14 kHz | — | 12 dB/oct |

Purpose: Final tonal shaping for cut-through in the mix. The presence boost ensures the screech is audible over the kick in small speakers and earbuds.

### Position 7 — Stereo Management

| Parameter | Value |
|-----------|-------|
| Plugin | Ozone Imager or similar |
| Below 1.5 kHz | Narrow toward mono |
| Above 2 kHz | Widen 10–25% |
| Purpose | Keep the low-mid content mono-compatible (kick territory). Only widen the top where stereo enhances presence without fighting the kick. |

### Position 8 — Sidechain Compressor

| Parameter | Value |
|-----------|-------|
| Source | Kick channel (pre-fader send) |
| Attack | 0.5–2 ms |
| Release | 80–150 ms |
| Ratio | 8:1–∞:1 |
| Gain reduction | 4–8 dB |
| Purpose | Create rhythmic pocket for kick transient. Must be last in chain — all prior processing is "done" before the sidechain shapes dynamics. |

---

## 6. Primary Frequency Content Ranges

| Region | Hz Range | Character | Role in Mix |
|--------|----------|-----------|-------------|
| **Body** | 200–500 Hz | Growl weight, thickness | Provides substance. Fights directly with kick tail harmonics — manage with sidechain or reciprocal EQ carving. |
| **Core** | 500–2000 Hz | Screech identity | This IS the screech. If this range is wrong, no amount of processing fixes it. Protect this in the mix. |
| **Presence** | 2–5 kHz | Cut-through bite | Makes the screech audible on small speakers, earbuds, and festival PAs where sub is less relevant. |
| **Air** | 5–10 kHz | Sizzle and edge | Adds aggression and excitement. Causes listener fatigue if uncontrolled — automate down in longer screech sections. |
| **Ultra-high** | 10+ kHz | Noise, aliasing artifacts | Usually unwanted. LPF at 12–14 kHz unless the air is intentional. Digital aliasing from distortion chains lives here. |

### Frequency collision zones with other elements

| Screech region | Collides with | Resolution |
|----------------|---------------|------------|
| 200–500 Hz (body) | Kick tail, reverse bass harmonics | Sidechain compression, reciprocal EQ carving (cut screech 250–350 Hz, boost kick there) |
| 500–1500 Hz (core) | Vocal fundamentals, pad harmonics | Frequency-split sidechain (duck screech mid only when vocal plays) |
| 2–5 kHz (presence) | Kick tok/click, clap/snare crack | The kick tok wins — sidechain handles this. Screech fills between kicks. |
| 5–10 kHz (air) | Hi-hats, cymbal wash, vocal sibilance | De-ess the vocal, HPF hi-hats to prevent overlap, automate screech air per section |

---

## 7. Distortion-as-Rhythm

The technique that separates rawphoric screech from a static synth pad. Three methods, combinable:

### Method A — LFO-Controlled Drive

Map an LFO (Env mode, 1/4 or 1/8 rate) to the **drive amount** on Saturn 2 Band 2 (mid band, 800 Hz–4 kHz).

- As the LFO cycles, distortion pulses rhythmically
- Moments of clean body alternate with moments of aggressive bite
- The screech "breathes" — rhythm emerges from timbral change, not from note placement
- LFO amount to drive: 15–35% (subtler than the filter LFO — you want texture variation, not on/off switching)

### Method B — Sidechain Gating

Insert a gate or Pro-MB in wideband mode, sidechained from the kick channel.

| Parameter | Value |
|-----------|-------|
| Threshold | Set so the kick triggers the gate reliably |
| Hold | 5–15 ms |
| Release | 30–80 ms |
| Range | −6 to −12 dB (not full mute) |

- When the kick hits, the gate ducks the screech for 30–80 ms, then reopens
- Creates a pumping pocket that lets the kick transient through
- Adds rhythmic movement tied to the kick pattern — screech grooves with the kick automatically

### Method C — Combined Approach (Recommended)

Use both simultaneously:

1. **LFO drives timbral movement** (filter sweep + drive modulation) — provides the melodic/textural character
2. **Sidechain provides dynamic pumping** — provides the groove lock to the kick

The two rhythms interlock. The LFO cycle does not need to align perfectly with the kick — the sidechain handles the timing relationship. This means the LFO can run at slightly different rates (e.g., dotted 1/8) for organic feel while the sidechain keeps everything locked to the groove.

### Distortion-as-rhythm parameter interaction

```
Note triggers → ENV 2 shapes attack bite
            → LFO 1 (Env mode) sweeps filter = timbral rhythm
            → LFO via Saturn drive = distortion rhythm
            → Sidechain from kick = dynamic rhythm
                                    ↓
            Three layers of rhythm from one sustained note
```

---

## Screech Variant Quick-Reference

| Variant | OSC A Table | Filter | LFO 1 Shape | LFO 1 Rate | Distortion Character | Use Case |
|---------|-------------|--------|-------------|------------|---------------------|----------|
| Raw Growl | Dist Growl | MG Low 24 | Sharp attack / slow decay | 1/8 | Heavy multiband Saturn | Anti-climax primary voice |
| Metallic Shred | Analog_Brassy | Comb + | Triangle | 1/16 | Single-band Tape, high drive | Fast rhythmic fills |
| Formant Vowel | Custom vocal WT | French LP | Double-peak custom | 1/4 | Light Warm Tube | Melodic screech lines |
| Staccato Stab | Digital harsh WT | MG Low 24 | Narrow spike | 1/8 | Heavy single-band Trash 2 | Rhythmic punctuation between kicks |
| Hybrid Melodic | Analog_BrSaw | MG Low 18 | Sine | 1/4 | Light Tape + presence EQ | Counter-melody in euphoric hybrid drops |

---

_Fornix Production Bible — feeds `05_Sound_Design/Sound_Design_Pack.md` for rawphoric and hybrid style variants._
