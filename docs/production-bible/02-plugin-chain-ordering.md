# Plugin Chain Ordering — Fornix Production Bible

> Feeds: Routing Sheet generator (`02_Routing/Routing_Sheet.md`), Mix Report generator (`04_Mix/Mix_Report.md`)
> EQ mode rule: All EQ in the kick chain and on transient-heavy material uses **Zero Latency** mode (Pro-Q 3's minimum-phase processing mode). Linear phase causes pre-ringing that smears transients. Natural Phase mode is also acceptable. Exception: narrow surgical cuts above 2 kHz where pre-ring is inaudible.

---

## 1. Hardstyle Kick Channel

The Fornix kick chain is 5–10+ plugin instances. This is NOT excessive — the alternating EQ/distortion sandwich is the core identity. Each EQ stage shapes the spectrum for the NEXT distortion stage. Order is non-negotiable.

### Full Chain

| Position | Plugin | Role | Key Parameters | Why This Position |
|----------|--------|------|----------------|-------------------|
| 1 | **Serum / Kick synth** | Source waveform generation | Pitch start 200–800 Hz, pitch end 40–60 Hz (root-tuned), decay 150–350 ms | Source — everything downstream depends on this |
| 2 | **Transient Shaper** (Neutron TS or SPL Transient Designer) | Preserve/enhance tok before distortion compresses it | Attack: +2 to +6 dB, Sustain: −2 to −6 dB | **MUST be before distortion.** Distortion compresses dynamics — if the transient is not shaped first, it gets buried permanently. |
| 3 | **EQ Stage 1** (Pro-Q 3) | Pre-distortion cleanup | HPF at 25–30 Hz (remove DC offset / sub-sub rumble), cut ugly resonances you do NOT want distortion to amplify | Distortion amplifies everything proportionally. Bad frequencies before distortion become worse frequencies after. Clean first. |
| 4 | **Distortion Stage 1** (Saturn 2) | Primary harmonic generation | Low (30–150 Hz): Gentle Sat 15–25%; Mid (150–800 Hz): Warm Tube 25–40%; High (800+ Hz): Tape 10–20% | First distortion pass works on a relatively clean signal — generates the foundational harmonic character |
| 5 | **EQ Stage 2** (Pro-Q 3) | Mid-chain sculpting | Cut boxiness 300–500 Hz (−2 to −4 dB, Q 2–4), boost kick body 100–200 Hz (+1–2 dB), tame harsh peaks from stage 1 | Each distortion stage adds frequencies. If you don't sculpt between stages, mud accumulates exponentially. |
| 6 | **Distortion Stage 2** (Saturn 2 or Decapitator) | Second harmonic pass — character and aggression | Single-band or focused mid-band, Drive 20–35%, Mix 70–90% (use parallel blend if too harsh at 100%) | Builds on the sculpted output of stages 4+5. This is where the kick "character" emerges — warm, gritty, or aggressive. |
| 7 | **EQ Stage 3** (Pro-Q 3) | Pre-final distortion prep | Tighten low end if needed, presence boost at 2–4 kHz (+1–3 dB) to feed the final distortion stage bright harmonics | Controls exactly what the final distortion "eats." A presence boost here becomes harmonic richness after stage 8. |
| 8 | **Distortion Stage 3** (Saturn 2 or Trash 2) | Final aggression layer | Drive 15–25%, focus on mid-high bands | **Rawphoric only.** Euphoric/cinematic kicks may skip this stage entirely. Third pass for maximum harmonic density. |
| 9 | **Final EQ** (Pro-Q 3) | Post-distortion cleanup | HPF 30 Hz steep (48 dB/oct), cut harsh resonances above 5 kHz, check with linear phase analyzer (but apply cuts in minimum-phase) | Last chance to clean up before the ceiling stage. 48 dB/oct HPF removes DC and sub rumble that distortion chains generate. |
| 10 | **Hard Clipper / Limiter** (Pro-L 2 or StandardCLIP) | Ceiling control and final loudness | Ceiling: −0.5 to −1.0 dBTP, Style: Modern or Transparent (Pro-L 2). For hard clip: StandardCLIP or GClip before Pro-L 2. | End of chain. Hard clip before limiter is the "clip-before-limit" technique for maximum density. |

### Chain Variants by Kick Style

| Kick Style | Skip Stages | Modify | Add |
|------------|-------------|--------|-----|
| Clean euphoric tok | Skip stage 8 (third distortion) | Lower drive on stages 4+6 by 30% | — |
| Gritty rawphoric | Use all 10 stages | Increase mid-band drive on stages 4+6 | Consider parallel distortion bus for stage 6 |
| Festival punch | Skip stage 8 | Boost transient shaper attack +2 dB more | Add Pultec-style low shelf boost before limiter |
| Cinematic controlled | Skip stages 7+8 | Focus Saturn on Tape/Tube modes only | Add subtle room reverb (10–15% mix) after final EQ |

### Critical Rule: Transient Before Distortion

The kick transient (tok/click) must be shaped BEFORE any distortion stage. Here's why:

1. Distortion is a compressor — it reduces the ratio between peaks and sustain
2. The tok is the highest peak in the kick waveform
3. If distortion hits before the transient is enhanced, the tok gets compressed into the tail
4. After distortion flattens it, no amount of transient shaping can recover the original peak shape
5. Enhance the peak first → distortion compresses the enhanced version → the tok survives with character

---

## 2. Lead Synth Channel

| Position | Plugin | Role | Key Parameters | Why This Position |
|----------|--------|------|----------------|-------------------|
| 1 | **HPF** (Pro-Q 3) | Remove sub content | 100–200 Hz, 24 dB/oct. Euphoric leads: 150 Hz. Screech leads: 200 Hz. | First — prevents all downstream processors from reacting to low frequencies that will be removed anyway. Saves compressor headroom. |
| 2 | **Compression** (Pro-C 2) | Even out dynamics from filter sweeps / LFO modulation | Style: Opto or Vocal, Ratio 3:1, Attack 10–30 ms, Release 50–150 ms, Target 3–6 dB GR | Before distortion — stabilizes the dynamic range so the distortion stage receives consistent input levels. Inconsistent input = inconsistent distortion character. |
| 3 | **Distortion** (Saturn 2) | Harmonic richness and presence | Mid band (500 Hz–4 kHz): Warm Tube or Tape, Drive 15–30%. Keep low band off or very gentle. | After compression — drive amount stays consistent across the dynamic range. |
| 4 | **Presence EQ** (Pro-Q 3) | Tonal shaping | Boost 2–5 kHz (+2–4 dB, broad Q 1.5–3), cut harshness at 1–2 kHz if Saturn created resonances | After distortion — shapes the harmonics that distortion generated. Cutting before distortion would just be re-generated. |
| 5 | **Stereo Widener** (Ozone Imager, optional) | Width enhancement for drops | Widen above 2 kHz only, mono/narrow below 2 kHz | After EQ — stereo image is shaped after all tonal decisions are finalized. |
| 6 | **Sidechain Compressor** | Kick ducking | Attack 0.5–2 ms, Release 80–150 ms, Ratio 8:1+, Threshold for 4–8 dB GR | **Always last.** Must be the final dynamic processor — it's shaping the finished sound relative to the kick, not the raw sound. |

### Lead Channel Variants

| Lead Type | Position 1 HPF | Position 3 Drive | Position 5 Width | Notes |
|-----------|---------------|-----------------|-----------------|-------|
| Euphoric supersaw | 150 Hz | 15–20% Warm Tube | Moderate widen | Priority: clarity and stereo spread |
| Rawphoric screech | 200 Hz | 25–35% Tape + Tube | Narrow center, wide top only | Priority: cut-through and mono compatibility |
| Hybrid | 150 Hz | 20–25% Tape | Moderate | Balance between clarity and aggression |
| Pluck/stab | 120 Hz | 10–15% or bypass | Bypass | Short transient material — distortion can smear the attack |

---

## 3. Orchestral Bus

| Position | Plugin | Role | Key Parameters | Why This Position |
|----------|--------|------|----------------|-------------------|
| 1 | **Saturation** (Saturn 2 or Decapitator) | Warmth and cohesion | Tape mode, Drive 10–20%, Mix 60–80% | First — glues disparate orchestral samples/patches together by adding shared harmonic coloring. |
| 2 | **Bus Compression** (Pro-C 2) | Dynamic control across full orchestral section | Style: Bus or Glue, Ratio 2:1–3:1, Attack 20–50 ms, Release 100–200 ms, Target 2–4 dB GR | After saturation — dynamics are slightly tamed by the saturation, compression finishes the control. |
| 3 | **Reverb** (Valhalla VintageVerb or similar) | Spatial depth and cohesion | Decay: 2.5–4.0 s (cinematic), 1.2–2.0 s (festival). Mix: 15–30% (inserted). | After compression — if reverb were before compression, the tail would pump and breathe unnaturally. |
| 4 | **HPF** (Pro-Q 3) | Remove orchestral sub content | 80–120 Hz, 12 dB/oct slope | Last — after reverb, so reverb's low-end buildup is also cleaned. 12 dB/oct (gentler than leads) preserves orchestral warmth. |

### Why 12 dB/oct for orchestral HPF

Orchestral instruments produce meaningful harmonic content down to 80–100 Hz (cello, tuba, bass drum). A steep 24 dB/oct cut sounds surgical and unnatural on these sources. 12 dB/oct provides a gentle rolloff that removes problematic sub content while preserving the body that makes orchestral sections feel weighty.

### Reverb decay by style variant

| Style | Decay | Character | Reason |
|-------|-------|-----------|--------|
| Cinematic-euphoric | 2.5–4.0 s | Cathedral, large hall | Cinematic weight demands long tails — the space IS the emotion |
| Rawphoric | 1.0–1.5 s | Short room/plate | Long tails fight with screech and aggressive kick — keep it tight |
| Anthemic-euphoric | 1.5–2.5 s | Medium hall | Balance between weight and clarity |
| Festival-hardstyle | 1.2–2.0 s | Plate or medium room | Must translate on festival PAs where long reverb becomes mud |

---

## 4. Master Bus

| Position | Plugin | Role | Key Parameters | Why This Position |
|----------|--------|------|----------------|-------------------|
| 1 | **Reference Plugin** (ADPTR Metric AB) | Level-matched A/B comparison | Load 2–3 reference tracks, auto-level-match enabled | **Always position 1.** The reference must hear the raw mix, not the processed version. Never process through the reference plugin. |
| 2 | **Surgical EQ** (Pro-Q 3) | Fix problems only — NOT tonal shaping | Narrow cuts only for specific problems (resonances, buildups). **No broad boosts on the master.** | Early — fix problems before they're amplified by compression and limiting. Must use **minimum-phase** — linear phase pre-ring affects the full mix transient response. |
| 3 | **Glue Compressor** (SSL-style: Pro-C 2 Bus mode, or Waves SSL G-Master) | Mix cohesion | Ratio 2:1–4:1, Attack 10–30 ms, Release Auto or 300 ms, Target 1–3 dB GR. **Never more than 3 dB GR.** | After surgical EQ — compressor works on a cleaned signal. Glue compression makes the mix feel like one instrument. |
| 4 | **Tape Saturation** (Saturn 2 Tape mode, or Waves J37) | Harmonic warmth and subtle compression | Drive 10–15%. You should barely hear it — if you can obviously hear the saturation, the drive is too high. | After glue compression — adds the harmonic glue that tape machines provided in analog mixing. Must be subtle. |
| 5 | **M/S EQ** (Pro-Q 3 in M/S mode) | Stereo field management | **Mid channel:** no changes unless fixing a problem. **Side channel:** HPF at 100–150 Hz (mono the bass), gentle boost at 8–12 kHz (+1–2 dB shelf) for air. | After saturation — the M/S processing shapes the final stereo image. Side HPF ensures mono bass compatibility on all systems. |
| 6 | **Multiband Dynamics** (Pro-MB or Ozone Dynamics) | Frequency-specific dynamic control | 3–4 bands. Gentle ratios 1.5:1–2:1. Focus on taming low-mid (200–500 Hz) energy and controlling high-mid (2–5 kHz) peaks. | After M/S EQ — catches frequency-specific dynamic problems that the broadband glue compressor cannot address. |
| 7 | **Stereo Imager** (Ozone Imager) | Final stereo width check/adjustment | Narrow below 200 Hz, widen 4+ kHz slightly (+10–20%). Leave 200 Hz–4 kHz untouched. | After multiband — final stereo adjustment on the dynamically controlled signal. |
| 8 | **Limiter** (Pro-L 2) | Final loudness ceiling | See targets below. **Uses lookahead** (NOT zero-latency). Zero-latency limiting causes transient overshoot. | **Always last.** The limiter works on the fully processed signal. |

### Limiter settings by delivery target

| Target | Integrated LUFS | True Peak Limit | Pro-L 2 Style | Notes |
|--------|----------------|-----------------|---------------|-------|
| Club / DJ master | −5 to −7 LUFS | −0.3 dBTP | Modern or Aggressive | Maximum loudness for DJ playback. Clip-before-limit recommended (add GClip before Pro-L 2). |
| Streaming master | −10 to −12 LUFS | −1.0 dBTP | Transparent | Streaming platforms normalize to −14 LUFS — overly loud masters get turned DOWN and lose dynamics. |
| Festival USB | −6 to −8 LUFS | −0.5 dBTP | Modern | Festival PAs handle loudness well but true peak headroom prevents PA limiter artifacts. |

### Master bus rules

1. **No broad boosts on the master EQ.** If the mix needs a broad 3 kHz boost on the master, the problem is in the individual channels. Fix it there.
2. **Glue compression never exceeds 3 dB GR.** More than 3 dB means the mix balance is wrong — fix the bus levels.
3. **Tape saturation must be inaudible in isolation.** Bypass it — if the difference is obvious, the drive is too high.
4. **Two limiters for two masters.** Render the club master and streaming master separately, not by just turning down the limiter threshold.

---

## Chain Position Cheat Sheet

Why each processor sits where it does — the general principle:

| Principle | Example |
|-----------|---------|
| **Remove before you amplify** | EQ before distortion removes frequencies you don't want distortion to generate harmonics from |
| **Shape before you compress** | Transient shaper before distortion, because distortion is a form of compression |
| **Compress before you distort** (leads) | Compression stabilizes dynamic range so distortion drive stays consistent |
| **Distort before you EQ** (post-shaping) | Presence EQ after distortion shapes the harmonics that distortion created |
| **Sidechain is always last** | Sidechain shapes the finished sound relative to the kick, not raw material |
| **Reverb before HPF** (orchestral) | HPF after reverb cleans up reverb's low-end buildup |
| **Reference is always first** (master) | Reference hears the raw mix, compares against processed references |
| **Limiter is always last** (master) | Limiter works on the fully processed, final signal |

---

_Fornix Production Bible — feeds `02_Routing/Routing_Sheet.md` and `04_Mix/Mix_Report.md` generators._
