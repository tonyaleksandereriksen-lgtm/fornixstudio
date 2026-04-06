# Frequency Masking Solutions — Fornix Production Bible

> Specific to hardstyle mix challenges
> Feeds: Mix Report generator (`04_Mix/Mix_Report.md`), format as decision tables for the AI
> Plugins referenced: FabFilter Pro-Q 3, FabFilter Pro-MB, FabFilter Saturn 2

---

## 1. The Five Primary Collision Zones in Hardstyle

| Zone | Hz Range | Instruments Involved | Severity | Why It Happens |
|------|----------|---------------------|----------|----------------|
| **Zone 1: Sub Collision** | 30–80 Hz | Kick fundamental vs. reverse bass fundamental vs. sub sine | Critical | All three share the same root note frequency. Phase cancellation is the primary risk. |
| **Zone 2: Kick Tail vs. Bass Body** | 80–250 Hz | Kick tail harmonics vs. reverse bass harmonics vs. pad low-end | High | The kick tail's pitch sweep generates harmonics in this range. Reverse bass body sits here permanently. |
| **Zone 3: Kick Mid vs. Lead Body** | 250–500 Hz | Kick mid-body harmonics vs. lead synth low-mids vs. orchestral warmth | High | The kick's distortion chain generates dense harmonics here. Leads and orchestral elements have fundamental weight here. |
| **Zone 4: Presence Fight** | 1–5 kHz | Kick tok/click vs. lead presence vs. screech core vs. vocal fundamentals | Critical | The most contested frequency range in hardstyle. Tok, lead, screech, and vocal ALL need presence here. |
| **Zone 5: Air Congestion** | 5–10 kHz | Hi-hats vs. cymbal wash vs. vocal sibilance vs. screech air vs. lead air | Moderate | Multiple bright elements stack up. Causes fatigue at loud monitoring levels. |

---

## 2. Resolution Hierarchy

Five steps from least invasive to most aggressive. Try step 1 first. Only escalate when the current step doesn't resolve the collision.

### Step 1 — Arrangement-Level Separation

**What:** Don't play colliding elements at the same time.

| Technique | Example | When to Use |
|-----------|---------|-------------|
| Time-split | Reverse bass plays only between kicks (offbeat). Sub sine sustains, kick ducks it via sidechain. | Always — this is the default for kick vs. bass. |
| Section-split | Orchestral pads play in breakdowns, not during drops. Screech plays in anti-climax, not melodic drops. | When elements fight for the same frequency space and can be assigned to different sections. |
| Rhythmic interleaving | Lead plays on beats 2 and 4 (between kick hits). Or lead phrases alternate with screech call-response. | When both elements must exist in the same section but can alternate rhythmically. |

**Test:** If arrangement separation alone solves the masking, NO processing is needed. Check by soloing the contested bus — if elements are clear when heard together, the arrangement is doing the work.

### Step 2 — Complementary EQ Carving

**What:** Cut one element where the other needs space. Boost one where the other is cut.

| Collision | Element A (Cut) | Element B (Boost) | Values |
|-----------|----------------|------------------|--------|
| Kick tail vs. lead body | Lead: cut 250–400 Hz | Kick: boost 250–400 Hz (+1–2 dB, Q 2) | Lead cut: −2 to −4 dB, Q 2–4 |
| Kick tok vs. lead presence | Lead: narrow dip at 2–3 kHz | Kick tok: natural presence at 2–3 kHz (no boost needed) | Lead dip: −2 to −3 dB, Q 4–6 |
| Screech core vs. vocal | Screech: cut 1–3 kHz during vocal sections | Vocal: boost 2–4 kHz (presence) | Screech cut: −3 to −5 dB, Q 2–3 |
| Reverse bass body vs. kick tail | Reverse bass: cut 250–350 Hz | Kick tail: boost 250–350 Hz (+1 dB) | RB cut: −2 to −3 dB, Q 3 |

**Rule:** Never cut both elements in the same range. One yields, the other claims the space. Decide which element owns each frequency band.

### Step 3 — Dynamic EQ (Frequency-Dependent Sidechain)

**What:** Use Pro-Q 3's dynamic EQ bands to duck frequencies ONLY when the competing element is active.

This is the most powerful tool for hardstyle masking problems because the kick is rhythmic — the duck only happens on the beat, not constantly.

#### Pro-Q 3 Dynamic EQ Setup for Lead Ducking Under Kick

| Parameter | Value |
|-----------|-------|
| Band type | Bell |
| Frequency | 200–400 Hz (for kick body collision) or 2–4 kHz (for tok collision) |
| Gain | 0 dB static (no permanent cut) |
| Dynamic range | −4 to −8 dB (maximum cut when triggered) |
| Dynamic threshold | Set so the kick triggers the duck (typically −20 to −10 dBFS at the sidechain input) |
| Sidechain source | External — kick channel (pre-fader send) |
| Attack | 1–5 ms (must catch the kick onset) |
| Release | 50–150 ms (must recover before the next kick at 150 BPM = 400 ms between kicks) |
| Q | 2–4 (broad enough to cover the collision zone, narrow enough to preserve the rest) |

**How it works:** The lead plays at full brightness. When the kick hits, Pro-Q 3 dynamically cuts the lead's 200–400 Hz (or 2–4 kHz) by 4–8 dB for ~50–150 ms, then restores it. The listener hears the kick tok cut through cleanly, then the lead returns. The cut is fast enough that it's perceived as "kick clarity" rather than "lead being ducked."

#### When to Use Dynamic EQ vs. Full-Band Sidechain

| Situation | Use Dynamic EQ | Use Full-Band Sidechain |
|-----------|---------------|------------------------|
| Specific frequency collision (tok vs. lead presence) | Yes — only duck the colliding band | Overkill — ducks the entire lead |
| General level collision (lead too loud during kick) | No — this is a level problem, not frequency | Yes — simple volume ducking |
| Multiple collision zones simultaneously | Yes — use multiple dynamic bands | Less precise |
| Lead and kick share the same section permanently | Yes — surgical, preserves lead character | Yes if acceptable pump amount |

### Step 4 — Multiband Sidechain (Pro-MB)

**What:** Split the signal into frequency bands and sidechain only specific bands.

For the reverse bass — kick collision specifically:

| Band | Range | Sidechain | Ratio | Attack | Release | Range |
|------|-------|-----------|-------|--------|---------|-------|
| Sub | 30–100 Hz | From kick | ∞:1 | 0.5 ms | 80–120 ms | −12 to −20 dB |
| Body | 100–300 Hz | From kick | 4:1 | 1 ms | 60–100 ms | −6 to −10 dB |
| Upper | 300+ Hz | No sidechain | — | — | — | — |

The sub band ducks completely (the kick owns this range). The body band ducks partially (shared space). The upper band is untouched (reverse bass harmonics don't collide with kick here).

### Step 5 — Mid/Side Processing

**What:** Separate the problem into mono (mid) and stereo (side) components and process independently.

| Application | M/S Technique | Pro-Q 3 Settings |
|-------------|--------------|-------------------|
| Bass mono enforcement | HPF on Side channel at 100–150 Hz | Removes any stereo content below 150 Hz. Bass becomes pure mono. |
| Lead width without center masking | Boost Side channel at 3–6 kHz, cut Mid at 3–6 kHz by −1 dB | Lead presence lives more in the sides; kick tok (which is mono center) gets more space. |
| Screech center control | Cut Mid channel at 2–4 kHz by −2 dB | Reduces screech energy in the center (where the kick tok lives) while preserving wide presence. |
| Vocal center clarity | Boost Mid channel at 2–5 kHz by +1–2 dB | Emphasizes vocal (which is center-panned) in the presence range. |

---

## 3. Kick Tail EQ Moves (Hardstyle-Specific)

These are the standard EQ moves on the kick tail layer, applied during the distortion chain (between distortion stages).

| Move | Frequency | Gain | Q | Purpose |
|------|-----------|------|---|---------|
| **Mid boost** (body presence) | 150–250 Hz | +1 to +3 dB | 1.5–3 | Adds weight and "chest punch." This is the kick's body signature. |
| **Boxiness cut** | 300–500 Hz | −2 to −4 dB | 2–4 | Removes the cardboard/boxy quality that distortion generates. The most common kick EQ problem. |
| **Upper mid resonance fix** | 800–1500 Hz | −1 to −3 dB | 4–8 (narrow) | Distortion creates resonant peaks here. Sweep to find the worst peak, cut it. |
| **Presence clarity** | 2–4 kHz | +1 to +2 dB | 1.5–2.5 | Adds clarity and definition. Be careful — this range competes with the tok. If the tok is a separate layer, this is safe. If it's the same layer, boost less. |
| **Air control** | 6–10 kHz | −1 to −2 dB (or shelf cut) | Shelf | Tame harsh artifacts from the distortion chain. If the kick sounds harsh or "fizzy" in headphones, this range is the problem. |
| **Sub cleanup** | 30 Hz HPF | — | 48 dB/oct | Remove DC offset and sub-sub rumble that the distortion chain generates. |

### Reciprocal EQ Between Kick and Lead (500 Hz – 4 kHz)

This is the core carving technique for the most contested frequency range in hardstyle.

```
Frequency:    250    500    1k     2k     4k     8k
              ─────────────────────────────────────
Kick:         +2     ──     ──    -1     ──     ──     (boost body, cut 2k)
Lead:         -2     ──     ──    +2     ──     ──     (cut body, boost 2k)
              ─────────────────────────────────────
Result: Each element owns different frequency bands in the contested range.
```

| Element | Boost Range | Cut Range | Reasoning |
|---------|------------|-----------|-----------|
| Kick | 150–350 Hz (+2 dB) | 2–3 kHz (−1 to −2 dB) | Kick body is felt, not heard in the presence range. The tok provides presence naturally. |
| Lead | 2–5 kHz (+2 dB) | 250–400 Hz (−2 to −3 dB) | Lead is heard for its melody and brightness, not for low-mid body. |

---

## 4. Decision Table: When to Use Multiband Sidechain vs. Full-Band Sidechain

| Condition | Use Multiband SC | Use Full-Band SC |
|-----------|-----------------|-----------------|
| Only the sub/low-mid collides | Yes — preserve upper harmonics | No — unnecessary ducking of the full spectrum |
| The element has important high-frequency content that must persist during the kick | Yes — only duck the low bands | No — the high content would be lost |
| The element is purely sub (e.g., sub sine) | Either works — full-band is simpler | Yes — no upper content to preserve |
| The element is a pad with energy across the full spectrum | Yes — only duck the low/mid bands | Only if the pump effect is desired for the style |
| Rawphoric screech (500 Hz–8 kHz) vs. kick (30–500 Hz) | Yes — screech needs its 500 Hz+ content to persist | No — most screech energy is above the kick range anyway |
| Lead supersaw vs. kick | Dynamic EQ is better (Step 3) | Acceptable if pump amount is musical |

---

## 5. Collision Resolution Quick-Reference

For the mix report generator to produce actionable recommendations:

| Collision | Resolution (try in order) |
|-----------|--------------------------|
| Kick sub vs. reverse bass sub | 1. Sidechain (∞:1, full duck). 2. Verify shared root note tuning. 3. Check phase correlation. |
| Kick tail vs. reverse bass body | 1. Reciprocal EQ (kick boost 200 Hz, RB cut 200 Hz). 2. Multiband SC on RB body band. |
| Kick tail vs. lead low-mids | 1. Lead HPF at 150–200 Hz. 2. Reciprocal EQ. 3. Dynamic EQ at 250–400 Hz. |
| Kick tok vs. lead presence | 1. Dynamic EQ on lead at 2–4 kHz (SC from kick). 2. Sidechain on lead bus. |
| Lead vs. vocal | 1. Frequency-split SC (duck lead 2–5 kHz when vocal active). 2. Reciprocal EQ. 3. M/S processing. |
| Screech vs. kick tok | 1. Sidechain on screech bus. 2. Screech HPF at 200 Hz. 3. Dynamic EQ at 2–4 kHz. |
| Screech vs. vocal | 1. Arrangement separation (screech in AC, vocal in melodic). 2. Frequency-split SC. |
| Pads vs. everything | 1. Aggressive HPF (150 Hz). 2. Full-band SC from kick. 3. Automate pad level per section. |
| Hi-hats vs. vocal sibilance | 1. De-ess the vocal (4–8 kHz). 2. HPF hi-hats aggressively (400–600 Hz). 3. Dynamic EQ on hi-hat bus. |
| Orchestral vs. lead | 1. Automate orchestral level down in drops (−3 to −6 dB). 2. Orchestral HPF at 100 Hz. 3. SC on orchestral bus. |

---

_Fornix Production Bible — feeds `04_Mix/Mix_Report.md` frequency masking sections as a decision table._
