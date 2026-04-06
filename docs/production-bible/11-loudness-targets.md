# Loudness Targets by Platform, Section, and Style Variant — Fornix Production Bible

> Feeds: Mix Report generator (`04_Mix`), Producer Checklist generator (`06_Checklists`)
> Plugin referenced: FabFilter Pro-L 2

---

## 1. Integrated LUFS Targets Per Platform

| Platform | Normalization Target | Normalization Behavior | True Peak Limit | Fornix Club Master Target | Fornix Streaming Master Target |
|----------|---------------------|----------------------|----------------|--------------------------|-------------------------------|
| **Beatport** | None (no normalization) | Track plays at encoded loudness — louder IS louder | −0.3 dBTP | −5 to −7 LUFS | Not applicable (Beatport doesn't normalize) |
| **Spotify** | −14 LUFS | Normalizes both UP and DOWN toward −14 LUFS. Tracks louder than −14 are turned down; tracks quieter than −14 are boosted (up to −1 dBTP true peak limit). User can select Quiet (−19), Normal (−14), or Loud (−11) modes. | −1.0 dBTP | N/A | −11 to −13 LUFS (targeting above −14 preserves dynamics while not being turned down much) |
| **Apple Music** | −16 LUFS (Sound Check) | Sound Check normalizes to −16 LUFS. On by default on iOS and Mac since 2022. | −1.0 dBTP | N/A | −11 to −13 LUFS |
| **SoundCloud** | −14 LUFS | Normalizes both up and down to −14 LUFS (Gain Matching feature). Consistent behavior since ~2023. | −1.0 dBTP | N/A | −10 to −12 LUFS |
| **Festival USB** | None | No normalization — PA system plays at encoded loudness. PA limiter may engage on true peak overs. | −0.5 dBTP (tighter to prevent PA limiter artifacts) | −5 to −7 LUFS | N/A |
| **DJ Pool / Promo** | None | Same as Beatport — no normalization | −0.3 dBTP | −5 to −7 LUFS | N/A |
| **YouTube** | −14 LUFS | Normalizes down. Does NOT normalize up (quiet tracks stay quiet). | −1.0 dBTP | N/A | −12 to −13 LUFS |

### Key insight

Most streaming platforms normalize both UP and DOWN toward their target. Spotify and SoundCloud boost quiet tracks and turn down loud tracks. YouTube only normalizes DOWN (quiet tracks stay quiet). This means:

- A track mastered at −5 LUFS on Spotify gets turned down ~9 dB → it sounds quieter AND more compressed than a track mastered at −11 LUFS that only gets turned down ~3 dB
- A track mastered at −18 LUFS on Spotify gets boosted toward −14 LUFS (up to the true peak limit) — but it will still sound thinner than a track with more intentional loudness
- For streaming, **less limiting = more dynamic range = better perceived quality after normalization**
- For club/festival/Beatport, loudness IS competitive advantage — maximize it within the true peak limit

---

## 2. Hardstyle-Specific Integrated LUFS by Style Variant

| Style Variant | Club/DJ Master | Streaming Master | Festival Master | Rationale |
|---------------|---------------|-----------------|----------------|-----------|
| **Cinematic-Euphoric** | −6 to −8 LUFS | −11 to −13 LUFS | −7 to −8 LUFS | Wider dynamic range suits cinematic builds. Breakdowns must breathe. Less aggressive limiting preserves orchestral nuance. |
| **Rawphoric** | −5 to −7 LUFS | −10 to −12 LUFS | −5 to −7 LUFS | Maximum density and aggression. The distortion chain already compresses heavily — the limiter just caps peaks. Less dynamic material = more limiting tolerance. |
| **Anthemic-Euphoric** | −6 to −8 LUFS | −11 to −13 LUFS | −6 to −7 LUFS | Vocal clarity requires dynamic headroom. Over-limiting crushes vocal transients and de-essing becomes audible. |
| **Festival-Hardstyle** | −5 to −7 LUFS | −10 to −12 LUFS | −5 to −7 LUFS | Loud and punchy. Festival PAs handle density well. The kick must hit at maximum impact at 100+ dB SPL. |

---

## 3. Short-Term LUFS: Drops vs. Breakdowns

The loudness contrast between sections is what creates perceived impact. A drop that's 2 dB louder than the breakdown feels like a whisper compared to a drop that's 8 dB louder.

### Required Minimum Contrast Between Sections

| Section Transition | Minimum Contrast (Short-Term LUFS) | Target Contrast | Style Notes |
|-------------------|-----------------------------------|----------------|-------------|
| Breakdown → Drop (any style) | **6 dB minimum** | 8–12 dB | The "6 dB rule" — below 6 dB contrast, the drop doesn't "land." Flag in mix report. |
| Intro → First Energy (mid-intro kick entry) | 4–6 dB | 6–10 dB | The intro should feel quiet and spacious. |
| Drop → Mid-section reset | 3–6 dB (drop louder) | 4–8 dB | The reset should feel like a breath, not a cliff. |
| Build-up peak → Drop entry | 2–4 dB (drop louder) | 3–6 dB | Build-ups should approach drop loudness but not reach it. |
| Drop → Outro | 4–8 dB (drop louder) | 6–10 dB | The outro strips energy for DJ mixing. |

### Short-Term LUFS Targets Per Section

At 150 BPM, short-term LUFS is measured over 3-second windows.

| Section | Cinematic-Euphoric | Rawphoric | Anthemic-Euphoric | Festival-Hardstyle |
|---------|-------------------|-----------|-------------------|-------------------|
| Intro (percussion only) | −18 to −14 LUFS | −16 to −12 LUFS | −18 to −14 LUFS | −14 to −10 LUFS |
| Mid-intro (kick enters) | −12 to −8 LUFS | −10 to −6 LUFS | −12 to −8 LUFS | −10 to −6 LUFS |
| Breakdown (melody, no kick) | −14 to −10 LUFS | −12 to −8 LUFS | −14 to −10 LUFS | −12 to −8 LUFS |
| Build-up (escalating) | −10 to −6 LUFS | −8 to −4 LUFS | −10 to −6 LUFS | −8 to −4 LUFS |
| **Drop (maximum energy)** | **−6 to −4 LUFS** | **−4 to −2 LUFS** | **−6 to −4 LUFS** | **−4 to −2 LUFS** |
| Anti-climax drop | −6 to −4 LUFS | −4 to −2 LUFS | −6 to −4 LUFS | N/A |
| Outro (stripping) | −14 to −10 LUFS | −12 to −8 LUFS | −14 to −10 LUFS | −12 to −8 LUFS |

---

## 4. Multi-Master Delivery Strategy

Every Fornix track requires TWO masters: club and streaming. They are separate renders, not the same file with different loudness.

### What Changes Between Masters

| Parameter | Club/DJ Master | Streaming Master |
|-----------|---------------|-----------------|
| Integrated LUFS | −5 to −8 (style-dependent) | −10 to −13 (style-dependent) |
| True peak limit | −0.3 dBTP | −1.0 dBTP |
| Pro-L 2 style | Modern or Aggressive | Transparent |
| Pro-L 2 gain | Higher (more limiting) | Lower (less limiting) |
| Clip-before-limit | Often yes (GClip before Pro-L 2) | Rarely (clipping is audible at lower loudness) |
| Dynamic range | Less (3–6 dB integrated-to-peak) | More (6–10 dB integrated-to-peak) |
| Dither | TPDF or none (24-bit output) | TPDF (24-bit) or noise-shaped (16-bit) |
| Sample rate | 44.1 kHz (Beatport/DJ standard) | 44.1 kHz or 48 kHz (platform-dependent) |
| Bit depth | 24-bit WAV | 24-bit WAV (or 16-bit for specific platforms) |

### Rendering Workflow

1. **Mix is finalized** — all bus levels, EQ, compression, spatial decisions are locked
2. **Render club master:** Set Pro-L 2 gain for −5 to −8 LUFS target. Use Modern/Aggressive style. Render to 24-bit/44.1 kHz WAV.
3. **Render streaming master:** Reduce Pro-L 2 gain for −10 to −13 LUFS target. Switch to Transparent style. Render to 24-bit/44.1 kHz WAV.
4. **Render festival master (if applicable):** Use club master settings but tighten true peak to −0.5 dBTP. Render separately.

**Do NOT create the streaming master by simply reducing the volume of the club master.** The club master has different limiter behavior (more GR, different time constants) that changes the transient character and dynamic envelope. Each master must be rendered from the mix session with its own limiter settings.

---

## 5. Clip-Before-Limit Approach with Pro-L 2

The clip-before-limit technique uses a hard clipper BEFORE the limiter to catch the highest peaks. This lets the limiter work less hard, producing a louder result with fewer limiting artifacts.

### Signal Chain

```
Mix Bus → [GClip or StandardCLIP] → [Pro-L 2]
```

### GClip / Hard Clipper Settings

| Parameter | Value |
|-----------|-------|
| Clip ceiling | −1.0 to −0.5 dBFS (1–2 dB below the limiter ceiling) |
| Soft clip | Enabled, 50–75% softness |
| Oversampling | 4× or 8× (reduces aliasing from clipping) |
| Target clipping | 1–3 dB of peak reduction |

### Pro-L 2 Settings (After Clipper)

| Parameter | Club Master | Streaming Master |
|-----------|-------------|-----------------|
| Gain | Set for target LUFS | Set for target LUFS |
| Ceiling | −0.3 dBTP | −1.0 dBTP |
| Style | Modern (clean) or Aggressive (dense) | Transparent |
| Lookahead | On (default) | On (default) |
| Unity gain | On for A/B comparison | On for A/B comparison |

### Why It Works for Hardstyle

Hardstyle kicks have extreme peak-to-average ratio — the tok/click is a sharp spike sitting 6–12 dB above the tail RMS. Without clipping:
- The limiter must catch these peaks alone → works harder → more artifacts
- The limiter's GR meter shows 6–10 dB on every kick hit → audible pumping

With clip-before-limit:
- The clipper catches the top 1–3 dB of the tok peak → rounds it slightly
- The limiter receives a signal with less extreme peaks → works 1–3 dB less hard
- The result is 1–3 dB louder at the same perceived limiting artifacts
- The tok's subjective "punch" is preserved because the clip is on the very tip of the transient — most of the tok's energy is below the clip threshold

### When NOT to Use Clip-Before-Limit

- Streaming masters (clipping artifacts become audible at lower loudness)
- Cinematic-euphoric tracks with delicate orchestral sections (clipping smears orchestral transients)
- Any section with prominent vocal transients (clip distorts vocal attacks)

---

## 6. When to Flag Insufficient Dynamic Contrast (The 6 dB Rule)

The mix report generator should flag a track for **insufficient dynamic contrast** when:

| Condition | Flag | Priority |
|-----------|------|----------|
| Breakdown-to-drop short-term LUFS difference < 6 dB | "Drop impact is weak — insufficient contrast. Target: ≥6 dB difference." | P1 |
| Intro-to-drop short-term LUFS difference < 8 dB | "Drop will not feel impactful from cold start. Add more dynamic range to intro." | P2 |
| Build-up peaks within 2 dB of drop peaks | "Build-up steals drop energy — the drop should be noticeably louder." | P2 |
| Two consecutive drops have < 2 dB difference (no escalation) | "Second drop should feel bigger. Consider louder limiting target or wider arrangement." | P3 |
| Integrated LUFS of the full track exceeds −5 LUFS (club master) | "Over-limited. Check for transient destruction, pumping artifacts, and listening fatigue." | P1 |
| Integrated LUFS of streaming master exceeds −9 LUFS | "Streaming master is too loud — platforms will normalize it down, losing dynamics." | P2 |

### How to Create Contrast

If the 6 dB rule is not met, the fix is NOT to make the drop louder. The fix is to make the breakdown QUIETER:

1. Automate bus levels down in the breakdown (−2 to −4 dB on LEAD, MUSIC, DRUM TOPS buses)
2. Reduce the number of active elements in the breakdown
3. Automate stereo width narrower in the breakdown
4. Remove sub elements from the breakdown entirely (the drop's sub return creates impact)
5. Automate reverb sends higher in the breakdown (wet signal has less peak energy than dry)

---

## 7. How LUFS Targets Interact with Style Variant

| Style Variant | Loudness Philosophy | Limiter Behavior | Dynamic Range Priority |
|---------------|-------------------|-----------------|----------------------|
| **Cinematic-Euphoric** | Loudness serves the emotion, not the other way around. The cinematic breakdown must breathe. Accept −7 to −8 LUFS if it preserves the orchestral dynamics. | Transparent. Low GR. The limiter is a safety net, not a loudness tool. | Highest — 8–12 dB breakdown-to-drop contrast. |
| **Rawphoric** | Maximum density is part of the aesthetic. The distortion chain already reduces dynamics. The limiter finishes the job. −5 to −6 LUFS is expected. | Modern/Aggressive. Higher GR (4–6 dB). Clip-before-limit recommended. | Lowest — 6–8 dB contrast. The track is dense throughout. |
| **Anthemic-Euphoric** | Vocal dynamics must survive. Over-limiting makes de-essing audible and vocal compression obvious. Balance loudness with vocal quality. | Modern. Moderate GR (3–5 dB). No clip-before-limit on vocal sections. | Moderate — 7–10 dB contrast. |
| **Festival-Hardstyle** | Loud and clean. Festival PAs reward loudness but punish true peak overs. The kick must hit at maximum impact. | Modern. Clip-before-limit recommended. True peak headroom critical (−0.5 dBTP). | Moderate — 6–8 dB contrast. Efficiency over artistry. |

---

_Fornix Production Bible — feeds `04_Mix/Mix_Report.md` loudness sections and `06_Checklists/Producer_Checklist.md` mastering checks._
