# Gain Staging Values for Hardstyle Mix Sessions — Fornix Production Bible

> DAW: **Studio One 7** (32-bit float internal processing by default; 64-bit double precision available in Options → Audio Setup → Process Precision)
> Feeds: Producer Checklist generator (`06_Checklists/Producer_Checklist.md`), Mix Report generator (`04_Mix/Mix_Report.md`)

---

## 1. Individual Channel Targets

| Channel Type | Average Level (RMS/VU) | Peak Level | Notes |
|-------------|----------------------|------------|-------|
| Kick (combined layers) | −12 to −8 dBFS RMS | −6 to −3 dBFS peak | Kick is the loudest element pre-bus. Peak headroom here determines how hard the bus compressor works. |
| Reverse bass | −18 to −14 dBFS RMS | −10 to −6 dBFS peak | Must sit below kick peaks. Sidechain creates the pocket — gain staging sets the static relationship. |
| Sub sine | −20 to −16 dBFS RMS | −12 to −8 dBFS peak | Lowest level of the low-end elements. Sub provides foundation, not volume. |
| Lead synth (supersaw/screech) | −16 to −12 dBFS RMS | −8 to −4 dBFS peak | Peak headroom prevents the bus compressor from over-reacting to transient spikes. |
| Orchestral elements | −20 to −14 dBFS RMS | −10 to −6 dBFS peak | Orchestral sections are dense — each element must be conservative to prevent bus overload. |
| Pads / chords | −22 to −16 dBFS RMS | −12 to −8 dBFS peak | Background support — should never approach lead levels. |
| Clap / snare | −16 to −12 dBFS RMS | −6 to −3 dBFS peak | Transient-heavy — peak headroom critical. |
| Hi-hats | −24 to −18 dBFS RMS | −14 to −10 dBFS peak | Low level, high frequency. Level set by ear in context. |
| Vocal (lead) | −16 to −12 dBFS RMS | −8 to −4 dBFS peak | After compression. Pre-compression peaks may be higher. |
| FX / impacts | −18 to −12 dBFS RMS | −6 to −2 dBFS peak (impacts are transient-heavy) | Impacts have huge peak-to-RMS ratio. Don't chase the meter — listen. |

---

## 2. Kick Peak Target Before Bus Processing

The kick channel output (after the full distortion chain, before hitting the KICK & BASS bus) should peak at **−6 to −3 dBFS**.

Why this specific range:
- Below −6 dBFS: The kick doesn't have enough level to drive the bus compressor into its sweet spot (1–3 dB GR)
- Above −3 dBFS: The kick peaks are too hot for the bus compressor — it over-reacts and kills the tok transient
- The bus compressor's threshold should be set so the kick peaks hit it gently, not slam it

**Test:** Solo the KICK bus. The bus compressor GR meter should show 1–3 dB on each kick hit. If it shows more, reduce the kick channel output. If it shows less, the bus isn't doing its job.

---

## 3. Sub-Bus and Group Bus Targets

| Bus | Target Peak | Target Average | Processing Headroom Needed |
|-----|------------|---------------|--------------------------|
| KICK bus (pre-KICK & BASS) | −6 to −3 dBFS | −12 to −8 dBFS | Moderate — alternating EQ/distortion chain already compressed |
| SUB bus | −10 to −6 dBFS | −18 to −14 dBFS | High — sub elements need headroom for sidechain pumping |
| KICK & BASS bus (output) | −4 to −1 dBFS | −10 to −6 dBFS | Low — this bus does light glue only |
| LEAD bus | −6 to −3 dBFS | −14 to −10 dBFS | Moderate — compression and sidechain need room |
| SCREECH bus (rawphoric) | −6 to −3 dBFS | −14 to −10 dBFS | Moderate — dual distortion stages but compressed |
| ORCHESTRAL bus | −8 to −4 dBFS | −16 to −12 dBFS | High — many summed elements, reverb tail adds level |
| MUSIC bus | −8 to −4 dBFS | −16 to −12 dBFS | Moderate — sidechain reduces dynamic range |
| DRUM TOPS bus | −6 to −3 dBFS | −14 to −10 dBFS | Moderate — transient-heavy material |
| FX / ATMOS bus | −8 to −4 dBFS | −18 to −12 dBFS | High — impacts have extreme peak-to-average ratio |
| VOCAL bus | −6 to −3 dBFS | −14 to −10 dBFS | Moderate — compressed but must retain dynamics for expression |

---

## 4. Mix Bus Target Arriving at Master Chain

The summed signal arriving at the MASTER bus (before any master processing) should peak at **−6 to −3 dBFS** and average around **−14 to −10 dBFS**.

This provides:
- **6–10 dB of headroom** before digital clipping (0 dBFS)
- Enough level for the glue compressor to engage meaningfully (1–3 dB GR)
- Room for the limiter to work without distortion artifacts
- A comfortable range where all master bus plugins operate in their designed sweet spot

### If the mix bus is too hot (peaking above −1 dBFS)

The mix is likely summing too many buses at too-high levels. Do NOT turn down the master fader — that's a band-aid. Instead:
1. Check each group bus output level
2. Identify which bus is contributing the most peak energy (usually KICK & BASS)
3. Reduce individual channel levels within that bus
4. Recheck the mix bus

### If the mix bus is too cold (peaking below −10 dBFS)

The individual channels are too conservative. The master chain plugins (especially the compressor) may not engage properly. Increase individual channel levels, starting with the kick.

---

## 5. Where to Apply Gain in Studio One 7

Three gain application points exist. Using the wrong one causes problems.

### Input Controls Gain Knob (Channel Strip Input Gain)

| When to use | When NOT to use |
|-------------|----------------|
| Calibrating recorded audio to target level | Adjusting mix balance (that's the fader's job) |
| Compensating for hot/cold plugin outputs | Real-time automation (input gain is not automatable in S1) |
| Setting initial level BEFORE any inserts process the signal | |

- **Location:** Channel Inspector → Input Controls → Gain knob
- **Effect:** Changes level BEFORE the insert chain
- **Why it matters:** If a compressor is first in the insert chain, the input gain determines how hard you hit that compressor. Changing the fader instead would not affect the compressor behavior at all.

### Channel Fader

| When to use | When NOT to use |
|-------------|----------------|
| Mix balance — relative levels between channels | Changing the level hitting the first insert (use input gain) |
| Real-time mix rides (fader is automatable) | Gain staging for plugin input (use input gain or Mixtool) |
| Final balance decisions | |

- **Location:** Console / Mixer → Channel fader
- **Effect:** Changes level AFTER the insert chain, BEFORE the bus send
- **Why it matters:** The fader controls the balance in the mix. It does NOT affect how inserts process the signal.

### Mixtool Insert (Gain Utility)

| When to use | When NOT to use |
|-------------|----------------|
| Gain staging BETWEEN plugins in the insert chain | As a substitute for proper input gain calibration |
| Compensating for a plugin that adds or removes gain | Blanket gain changes (use input gain or fader) |
| A/B testing at matched loudness (insert Mixtool after the plugin, match gain) | |

- **Location:** Insert a Mixtool (Studio One native) at any position in the insert chain
- **Effect:** Adds/removes gain at that exact position in the chain
- **Why it matters:** If Saturn 2 adds 3 dB of gain, insert a Mixtool after it and reduce 3 dB. This prevents the next plugin from receiving a hotter signal than intended. Also critical for honest A/B comparison — louder always sounds "better."

### Gain Staging Flow Diagram

```
Audio Source / Synth Output
  │
  ▼
┌─────────────────────────────┐
│ Input Controls Gain Knob    │  ← Set level BEFORE inserts
│ Target: peaks at −12 to −6  │     (calibration stage)
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Insert Chain                │
│  Plugin 1 → [Mixtool] →    │  ← Mixtool compensates gain
│  Plugin 2 → [Mixtool] →    │     changes between plugins
│  Plugin 3 → ...            │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Channel Fader               │  ← Mix balance (post-insert)
│ Target: near 0 dB (unity)  │     Automate for mix rides
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Bus Send (pre/post fader)   │  ← Signal goes to group bus
│                             │     Post-fader default
└──────────┬──────────────────┘
           │
           ▼
      Group Bus Input
```

**Goal:** Channel faders should hover near **0 dB (unity)** in the final mix. If a fader is at −15 dB, the channel is too hot at the input stage. If a fader is at +8 dB, the channel is too cold. Adjust input gain to get faders near unity, THEN balance with faders.

---

## 6. 32-Bit Float Internal Processing

Studio One 7 uses 32-bit floating-point internally. This affects gain staging decisions.

### What 32-bit float means

- Internal processing has approximately **1528 dB** of dynamic range
- **Clipping between plugins is mathematically impossible** — even if a signal peaks at +100 dBFS internally, it doesn't clip until it reaches an output (DAC, bounce, plugin with fixed-point processing)
- Gain staging is NOT about preventing internal clipping — it's about **keeping plugins in their designed operating range**

### When to dither

| Scenario | Dither? | Why |
|----------|---------|-----|
| Between plugins within S1 | **No** | 32-bit float has more precision than any dither algorithm provides |
| Bouncing to 24-bit WAV | **Yes** — use TPDF dither or the limiter's built-in dither | Truncation from 32-bit to 24-bit introduces quantization error that dither randomizes |
| Bouncing to 32-bit float WAV | **No** | No bit-depth reduction = no quantization error |
| Bouncing to 16-bit WAV (CD) | **Yes** — use noise-shaped dither (Pro-L 2 dither or S1 master dither) | 16-bit truncation artifacts are audible without dither |
| Final master export | **Yes, once** — at the limiter (last plugin in chain) | Dither should be applied exactly once, at the final bit-depth reduction |

### When NOT to dither

- Never dither between plugins — 32-bit float internal does not need it
- Never double-dither (limiter dither ON + export dither ON) — apply once
- Never dither when bouncing stems at 32-bit float for internal use

---

## 7. Identifying Gain Staging Problems

### Symptom → Diagnosis Table

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Compressor GR meter constantly at −6 dB+ | Input too hot for compressor threshold | Reduce input gain or insert Mixtool before compressor to reduce −3 to −6 dB |
| Compressor GR meter barely moving | Input too cold | Increase input gain or lower compressor threshold |
| Distortion plugin sounds harsh/brittle even at low drive | Input level too hot — the signal is already near clipping before distortion adds harmonics | Reduce level entering the distortion plugin by 3–6 dB |
| Faders at extreme positions (below −15 or above +6) | Gain staging at input is wrong | Recalibrate input gain knobs so faders sit near 0 dB |
| Master bus limiter GR exceeds 6 dB | Mix bus level too hot OR bus compression not controlling peaks | Check group bus output levels. Add more bus compression to catch peaks before the master. |
| Mix sounds "crushed" or "flat" | Over-compression cascading through multiple buses — each bus compresses a little, but combined effect is severe | Reduce GR on each bus compressor by 1–2 dB. The fix is reducing each by a little, not removing any single compressor. |
| Mix sounds "thin" at loud monitoring levels | Individual channels are gain-staged too cold, causing over-reliance on makeup gain that introduces noise floor | Increase individual channel input levels. Re-threshold compressors. |
| A/B comparison always prefers the "processed" version | The processed version is louder. This is not a quality difference — it's a loudness bias. | Insert Mixtool after the plugin, match gain. Then A/B again. |

---

## 8. HPF Rule for Every Non-Bass Track

**Rule:** Every channel that is NOT the kick, sub sine, or reverse bass gets an HPF.

| Channel Type | HPF Frequency | Slope | Reason |
|-------------|--------------|-------|--------|
| Lead synth (supersaw) | 150 Hz | 24 dB/oct | Lead has no useful content below 150 Hz. Removing it prevents sub buildup and saves compressor headroom. |
| Lead synth (screech) | 200 Hz | 24 dB/oct | Screech body starts at 200 Hz. Everything below is noise and plugin artifacts. |
| Orchestral strings | 80–100 Hz | 12 dB/oct | Gentler slope preserves warmth. Cellos have content to ~65 Hz but it fights the kick. |
| Orchestral brass | 100 Hz | 18 dB/oct | Brass fundamentals reach ~80 Hz but contribute mud, not power, in a hardstyle mix. |
| Pads / chords | 120–150 Hz | 18 dB/oct | Pads accumulate sub energy from multiple voices. Remove it all. |
| Clap / snare | 100–150 Hz | 24 dB/oct | Claps and snares have no useful sub content. Low-frequency bleed from samples is common. |
| Hi-hats | 300–500 Hz | 18 dB/oct | Aggressive HPF. Hats are top-end only. Any low content is sample bleed or room noise. |
| Rides / cymbals | 400–600 Hz | 18 dB/oct | Even more aggressive. Rides are air and shimmer, not body. |
| Vocals | 80–120 Hz | 18 dB/oct | Remove room rumble and proximity effect. Male spoken: 100–120 Hz. Female sung: 80–100 Hz. |
| FX / impacts | Varies | Varies | Sub drops and impacts need low content. Risers and downlifters: HPF at 80–100 Hz, 12 dB/oct. |
| Percussion (shakers, tams) | 250–400 Hz | 18 dB/oct | Pure high-frequency elements. Any low content is unwanted bleed. |
| Reverb returns | 100–200 Hz | 18 dB/oct | Reverb generates low-frequency buildup. HPF every reverb return. |
| Delay returns | 100–150 Hz | 18 dB/oct | Same as reverb — delays accumulate low-end with each repeat. |

### Why this matters for hardstyle specifically

In hardstyle, the kick IS the bass. The sub region (below 80 Hz) belongs exclusively to the kick fundamental and the sub sine. Every other element that leaks into this region:

1. Adds phase-cancellation risk with the kick
2. Forces the sidechain compressor to work harder (it's compressing everything, not just the intended bass)
3. Reduces the perceived punch of the kick by filling the pocket between hits
4. Makes the limiter work harder on the master bus (sub energy = high peak energy)

The HPF rule is the single most impactful gain staging decision in hardstyle production.

---

## Headroom at the Group Bus Level — Why It Matters

Group bus headroom determines plugin behavior. Here's the chain reaction:

```
Individual channels too hot
  → Group bus input too hot
    → Bus compressor over-compresses (GR > 3 dB)
      → Bus EQ and saturation receive over-compressed signal
        → Master bus receives a squashed, characterless bus
          → Master chain can't fix what the bus chain broke
```

The reverse:

```
Individual channels properly gain-staged
  → Group bus receives clean, dynamic signal
    → Bus compressor works gently (1–3 dB GR)
      → Bus EQ shapes a natural-sounding signal
        → Master bus receives a dynamic, controlled sum
          → Master chain does final polish, not rescue work
```

**The single most important gain staging checkpoint is the group bus input.** If the group buses are receiving properly leveled signals, everything downstream works correctly. If they're receiving garbage, no amount of master bus processing fixes it.

---

_Fornix Production Bible — feeds `06_Checklists/Producer_Checklist.md` and `04_Mix/Mix_Report.md` gain staging sections._
