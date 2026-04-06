# Transient Shaping on Kick — Fornix Production Bible

> Primary subject: Hardstyle kick drum
> Feeds: Sound Design Pack generator (`05_Sound_Design`), Mix Report generator (`04_Mix`), Routing Sheet generator (`02_Routing`)
> Plugins referenced: iZotope Neutron Transient Shaper, SPL Transient Designer, FabFilter Saturn 2, FabFilter Pro-Q 3

---

## 1. Why the Kick Transient Must Never Be Distorted

The kick transient (tok/click) is a short burst of broadband energy (0–10 kHz, lasting 2–10 ms) that sits at the very front of the kick waveform. The tail that follows (pitched body, lasting 100–400 ms) is a separate sonic event with different harmonic content.

**The phase relationship between transient and tail is critical:**
- The transient is a sharp impulse — near-zero phase deviation across frequencies
- The tail is a sustained waveform — phase evolves over time as the pitch drops
- Distortion (which is nonlinear) alters the phase relationships between frequency components
- If distortion hits the transient, the sharp impulse gets "smeared" — its time-domain accuracy degrades
- The result: the tok loses its click, the attack becomes soft, the kick loses perceived punch

**Once distortion smears the transient, no amount of post-processing can recover it.** Distortion is not a reversible process — the original waveform shape is destroyed. This is why the Fornix kick chain places the transient shaper BEFORE any distortion stage.

---

## 2. The Layer Separation Method

The most effective hardstyle kick design separates the transient and tail into independent layers that are processed separately and recombined.

### Layer Structure

| Layer | Content | Processing Goal | Recombination |
|-------|---------|----------------|---------------|
| **Tok/Click layer** | Initial transient only (2–10 ms). Generated from: noise burst, high-pitched sine click, or dedicated transient sample. | Preserve attack clarity. Shape with transient shaper + EQ. Minimal or no distortion. | Summed at the top of the KICK bus, before bus processing. |
| **Tail layer** | Pitched body and decay (100–400 ms). Generated from: Serum pitch envelope, dedicated kick synth, or layered sub. | Shape with the full alternating EQ/distortion sandwich. The tail IS the distortion showcase. | Summed below the tok layer. Tail enters slightly after (0–2 ms delay for phase alignment). |
| **Sub layer** (optional) | Pure sub fundamental (30–80 Hz). Clean sine at root note. | Minimal processing — HPF at 25 Hz, mono enforcement, sidechain from kick onset. | Summed at the bottom. Provides clean sub weight that distortion cannot generate. |

### Why separation works

When tok and tail are on separate layers:
- The tok receives transient shaping and NO distortion → attack stays sharp
- The tail receives heavy distortion → character and warmth develop fully
- Neither layer's processing compromises the other
- The recombined kick has both: sharp attack AND rich harmonics

When tok and tail are on a single layer:
- Any distortion applied to the tail also hits the transient (they're the same audio)
- Reducing distortion to protect the tok means the tail loses character
- Increasing distortion for tail character destroys the tok
- It becomes a compromise with no clean solution

---

## 3. Transient Shaper Settings

### Dedicated Transient Shaper Plugin

**Plugin options:** iZotope Neutron Transient Shaper (preferred for multiband), SPL Transient Designer, Sonnox TransMod

**Global (single-band) settings:**

| Parameter | Euphoric Kick | Rawphoric Kick | Festival Kick |
|-----------|-------------|----------------|---------------|
| Attack | +2 to +4 dB | +4 to +6 dB | +4 to +6 dB |
| Sustain | −2 to −4 dB | −3 to −6 dB | −2 to −4 dB |

- **Attack boost:** Increases the perceived sharpness of the tok. +2 dB is subtle enhancement; +6 dB is aggressive click emphasis.
- **Sustain reduction:** Decreases the tail's perceived loudness relative to the attack. This makes the tok "pop" more. Rawphoric uses more sustain reduction because the heavy distortion on the tail layer will re-add sustain energy.

### Monitoring technique

1. Solo the kick channel
2. Loop a 4-bar section
3. Set attack to +6 dB, sustain to −6 dB (extreme settings)
4. Listen: the kick should sound like a sharp click with almost no body
5. Now back off to target values — you should hear the tok emerge clearly from the tail

If step 4 produces a dull thud instead of a sharp click, the transient in the source material is already damaged. Go back to the synthesizer and ensure the kick patch has a clear transient impulse at the onset.

---

## 4. Multiband Transient Shaping (iZotope Neutron)

Multiband transient shaping gives per-frequency control over attack and sustain. This is the precision tool for hardstyle kicks.

### Crossover Frequencies

Note: Neutron's Transient Shaper supports a maximum of **3 bands** (2 crossover points). The table below is designed for 3 bands. For a 4-band setup, use a different plugin or two instances.

| Band | Range | Attack | Sustain | Purpose |
|------|-------|--------|---------|---------|
| **Low** | 30–200 Hz | 0 to +2 dB | 0 to −2 dB | Sub punch. Gentle — over-emphasizing sub transients creates a "click" in the sub that distorts speakers. |
| **Mid** | 200–2000 Hz | +3 to +6 dB | −3 to −5 dB | **The primary tok/click frequency range.** Contains both the body "thump" (200–500 Hz) and the sharp click character (500–2000 Hz). Maximum attack emphasis here. |
| **High** | 2000–10000 Hz | +2 to +4 dB | −1 to −3 dB | Air and brilliance of the click. Too much causes a "tick" that's fatiguing. |

### Why multiband matters for kick

A single-band transient shaper treats the entire frequency spectrum equally. But the kick's transient energy is concentrated in the mid and high-mid bands (500–5000 Hz), while the tail's energy is concentrated in the low and low-mid bands (30–500 Hz). Single-band processing:
- Boosting attack also boosts sub-frequency transients → speaker stress
- Reducing sustain also reduces sub-frequency sustain → kick loses weight

Multiband processing:
- Boost attack only where the tok lives (500–5000 Hz) → sharp click, no speaker stress
- Reduce sustain only where the tail bloats (150–500 Hz) → tight body, sub weight preserved

---

## 5. Transient Shaper Position in the Kick FX Chain

**Position: BEFORE all distortion stages. After the source synthesizer, before EQ Stage 1.**

```
Kick Synth → TRANSIENT SHAPER → EQ Stage 1 → Distortion 1 → EQ 2 → Distortion 2 → ...
```

### Why before distortion (not after)

| Scenario | Result |
|----------|--------|
| Transient shaper BEFORE distortion | The enhanced transient peak hits the distortion stage at a higher level than the tail. Distortion compresses both, but the transient was already boosted — it survives with more emphasis. The tok is preserved THROUGH the distortion chain. |
| Transient shaper AFTER distortion | Distortion has already smeared the transient into the tail. The transient shaper tries to enhance an attack that doesn't exist clearly anymore. It ends up just boosting the first few milliseconds of distorted signal — a click artifact, not a natural tok. |

### The mathematics

Distortion is a gain-dependent process. At any input level, distortion adds harmonics proportional to the input amplitude. When the transient is boosted BEFORE distortion:
- The transient hits the distortion input at, say, −3 dBFS
- The tail hits at −9 dBFS
- The distortion generates harmonics from both, but the transient's higher level means it retains more relative energy after distortion's compression effect

When the transient is NOT boosted before distortion:
- Both transient and tail hit at similar levels (−6 to −9 dBFS)
- Distortion treats them equally
- The transient loses its level advantage and gets buried

### Exception: cosmetic transient shaping after the chain

A very light transient shaper (attack +1–2 dB, sustain 0 dB) can be placed AFTER the final EQ as a cosmetic touch. This is a polish step, not the primary transient shaping. It should be subtle — if it's doing heavy lifting, the pre-distortion shaping was insufficient.

---

## 6. Transient Shaping by Kick Style

| Kick Style | Pre-Distortion TS Attack | Pre-Distortion TS Sustain | Post-Chain TS (Cosmetic) | Character |
|------------|------------------------|--------------------------|--------------------------|-----------|
| **Hard tok (rawphoric)** | +4 to +6 dB | −4 to −6 dB | +1 to +2 dB (optional) | Aggressive click, heavy distortion on tail. The tok cuts through screech and heavy arrangements. |
| **Soft euphoric punch** | +2 to +3 dB | −1 to −3 dB | +1 dB (optional) | Warm, rounded attack. Less click, more body. The tok invites rather than attacks. |
| **Festival punch** | +4 to +6 dB | −2 to −4 dB | +1 to +2 dB | Sharp and clear but less tail reduction than raw. Must cut through festival PA at high SPL. |
| **Cinematic controlled** | +2 to +4 dB | −2 to −3 dB | None | Balanced — the kick supports the cinematic arrangement, not dominates it. |
| **Distorted tail (extreme raw)** | +5 to +7 dB (maximum) | −5 to −7 dB (maximum) | +2 dB | The tok must survive extreme distortion (40–60% drive). Maximum pre-emphasis needed. |

---

## 7. Effect on Generated Documents

### Routing Sheet Impact

The transient shaper position is annotated in the routing sheet's KICK bus insert chain:

```
KICK BUS Inserts:
  1. Transient Shaper (pre-distortion — attack +X dB, sustain −X dB)
  2. EQ Stage 1 (pre-distortion cleanup)
  3. Distortion Stage 1 (Saturn 2)
  ... [alternating EQ/distortion stages]
```

The routing sheet generator should:
- Always place transient shaper at position 1 in the KICK bus insert chain
- Annotate the attack/sustain values based on kick style from the branching table
- Flag if multiband TS is recommended (for rawphoric and festival styles)

### Mix Report Impact

The mix report generator should include a transient validation check:

```
P1 Risk: Kick transient survival
  Test: Solo the KICK bus. A/B bypass the entire distortion chain (positions 3–8).
  Pass: The tok is clearly audible with distortion active — the attack clicks through.
  Fail: The tok disappears or softens significantly when distortion is active.
  Fix: Increase transient shaper attack by +2 dB and/or reduce distortion drive by 10%.
```

### Sound Design Pack Impact

The Sound Design Pack should specify:
- Which transient shaping method to use (single-band vs multiband)
- Per-band settings if multiband
- The tok character goal (hard click, warm punch, etc.)
- Whether the tok is a synthesized transient or a sample layer

---

_Fornix Production Bible — feeds `05_Sound_Design`, `04_Mix`, and `02_Routing` generators for kick transient management._
