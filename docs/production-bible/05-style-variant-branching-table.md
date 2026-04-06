# Style-Variant Branching Table — Fornix Production Bible

> Feeds: ALL production package generators — this is the core conditional logic table.
> Every production decision branches on style variant. This table is the single source of truth.
> Rows = production decisions. Columns = style variants.

---

## Master Branching Table

| # | Production Decision | Cinematic-Euphoric | Rawphoric | Anthemic-Euphoric | Festival-Hardstyle |
|---|--------------------|--------------------|-----------|-------------------|-------------------|
| **1** | **Kick character** | Clean tok, controlled body, pitched tail with moderate decay. Warm saturation. | Hard aggressive tok, heavily saturated body, gritty extended tail. Maximum harmonic density. | Clean punch-focused tok, tight body, shorter tail. Balance clarity with weight. | Maximum transient punch tok, tight body, shortest tail. Designed for fast DJ mixing. |
| **1a** | Kick distortion stages | 5–8 stages. Moderate drive values (15–30%). Tape and Warm Tube modes. | 8–10+ stages. Aggressive drive (25–50%). Tube, Tape, and Trash modes. Third distortion pass mandatory. | 5–7 stages. Moderate drive (15–25%). Warm Tube and Tape. | 5–6 stages. Conservative drive (10–20%). Clean saturation. Focus on transient preservation. |
| **1b** | Kick tail decay | 200–300 ms. Moderate — tail provides low-end weight. | 300–400 ms. Extended — gritty tail IS the rawphoric identity. | 150–250 ms. Controlled — must not mask vocal. | 100–200 ms. Short — clears before next downbeat at fast mix BPM. |
| | | | | | |
| **2** | **Orchestral weight** | Full orchestral section: strings high/low, brass, woodwinds, choir, orchestral percussion. Dedicated ORCHESTRAL bus. | None or minimal. Dark pad only. No dedicated orchestral bus. | Light: string ensemble (combined), brass accents (not sustained), choir pad. Lighter ORCHESTRAL bus. | None. If orchestral elements used, they route to MUSIC bus. No dedicated bus. |
| **2a** | Orchestral bus complexity | 6 sub-channels. Dedicated ORCH_VERB return (decay 3–5 s). | 0 sub-channels. No orchestral return. | 3 sub-channels. Shared FX_LONG return. | 0 sub-channels. |
| | | | | | |
| **3** | **Reverb decay targets** | ORCH_VERB: 3.0–5.0 s. FX_LONG: 2.5–4.0 s. FX_SHORT: 0.8–1.5 s. DUCKED_VERB: 1.5–2.5 s. | FX_SHORT: 0.6–1.2 s. No long reverb. | FX_LONG: 1.5–2.5 s. FX_SHORT: 0.6–1.2 s. VOCAL_VERB: 1.0–1.8 s. | FX_SHORT: 0.6–1.0 s. No long reverb. |
| **3a** | Reverb return count | 4 returns (FX_LONG, FX_SHORT, DUCKED_VERB, ORCH_VERB) | 1 return (FX_SHORT) | 4 returns (FX_LONG, FX_SHORT, DUCKED_VERB, VOCAL_VERB) | 1 return (FX_SHORT) |
| **3b** | Pre-drop reverb treatment | Hard-mute all sends 1 beat before drop. Cut ORCH_VERB tail completely. | Minimal — barely any reverb to manage. | Hard-mute FX_LONG. Automate VOCAL_VERB down but not off (vocal may carry into drop). | Minimal management needed. |
| | | | | | |
| **4** | **LUFS targets** | Club: −6 to −8 LUFS. Streaming: −11 to −13 LUFS. Festival: N/A (not primary delivery). | Club: −5 to −7 LUFS. Streaming: −10 to −12 LUFS. Festival: −6 to −8 LUFS. | Club: −6 to −8 LUFS. Streaming: −11 to −13 LUFS. Festival: −6 to −7 LUFS. | Club: −5 to −7 LUFS. Streaming: −10 to −12 LUFS. Festival: −5 to −7 LUFS (primary delivery). |
| **4a** | True peak limit | Club: −0.3 dBTP. Streaming: −1.0 dBTP. | Club: −0.3 dBTP. Streaming: −1.0 dBTP. | Club: −0.3 dBTP. Streaming: −1.0 dBTP. | Club: −0.3 dBTP. Streaming: −1.0 dBTP. Festival: −0.5 dBTP. |
| **4b** | Clip-before-limit | Optional — only if dynamics allow. | Recommended — raw needs maximum density. | Optional. | Recommended — festival needs maximum loudness. |
| | | | | | |
| **5** | **Sidechain depth and release** | Moderate depth. Sub bus: −6 to −8 dB. Leads: −4 to −6 dB. Release: 100–150 ms. Musical pumping. | Deep. Sub bus: −8 to −12 dB. Screech: −6 to −8 dB. Release: 80–120 ms. Aggressive pumping is part of the sound. | Moderate depth. Sub bus: −6 to −8 dB. Leads: −4 to −6 dB. Vocal: −3 to −4 dB (light). Release: 100–150 ms. | Deep. Sub bus: −8 to −10 dB. Leads: −4 to −6 dB. Release: 80–120 ms. Clean, punchy pumping. |
| **5a** | Sidechain on vocal | N/A or very light (−2 dB) if vocals present. | N/A (minimal vocal content). | Light — −3 to −4 dB. Vocal must remain intelligible through the kick. | Light if vocal present. |
| **5b** | Sidechain curve shape | Musical — slower attack (2–5 ms), longer release. Pumping should breathe. | Aggressive — fast attack (0.5–2 ms), shorter release. Hard pump. | Musical — moderate attack (2–4 ms). | Punchy — fast attack (1–3 ms), moderate release. Clean pocket. |
| | | | | | |
| **6** | **Screech / lead frequency focus** | Lead focus: 500 Hz–5 kHz supersaw. No screech unless hybrid. Presence peak: 3–4 kHz. | Screech focus: 500 Hz–8 kHz. Screech IS the primary melodic voice. Presence peak: 2–4 kHz. Air to 10 kHz. | Lead focus: 500 Hz–5 kHz. Lead shares space with vocal (1–5 kHz). Lead ducks for vocal in 2–5 kHz. | Lead focus: 500 Hz–5 kHz. Clean supersaw. Presence peak: 3–5 kHz. Maximum clarity. |
| **6a** | Lead distortion amount | Light — Warm Tube 15–20%, mix 80%. Character, not aggression. | Heavy — Tape + Tube 25–40%, dual stage. Aggression IS the character. | Light — 15–20%. Must not compete with vocal clarity. | Minimal — 10–15% or bypass. Clarity over character. |
| **6b** | Lead stereo width | Wide — 90–110% in drops. Supersaw spread is part of the euphoric experience. | Center-heavy — screech must punch through in mono. Width only above 2 kHz. | Moderate — 80–100%. Must leave room for vocal in center. | Moderate-wide — 85–105%. Clear but big. |
| | | | | | |
| **7** | **Arrangement section lengths** | Intro: 16–32 bars. Mid-intro: 16–32 bars. Break: 32–64 bars (cinematic extended). Climax: 32–64 bars. Mid-outro: 8–16 bars. Outro: 16–32 bars. Total: 160–192+ bars. | Intro: 16 bars. Mid-intro: 16 bars. Break: 16–32 bars (shorter — raw doesn't linger). Climax: 32–48 bars. Second drop: 32 bars. Outro: 16 bars. Total: 144–176 bars. | Intro: 16–32 bars. Break: 16–32 bars. Climax: 32–48 bars. Second break: 16 bars. Second climax: 32 bars. Outro: 16–32 bars. Total: 144–176 bars. | Intro: 16–32 bars. Break: 16–24 bars (concise). Climax: 32 bars. Second break: 8–16 bars. Second climax: 32 bars. Outro: 16–32 bars. Total: 136–168 bars. |
| **7a** | Break length philosophy | Extended cinematic breaks (48–64 bars) are the Fornix signature. The break IS the emotional core. | Short breaks. Get to the drop. The audience is here for aggression, not patience. | Moderate breaks. Long enough for vocal hook development but not so long the energy drops. | Short, efficient breaks. Festival crowds need momentum, not contemplation. |
| **7b** | Intro design | Cinematic atmosphere. Field recordings, textural pads, motif teasers. Progressive reveal over 32 bars. | Percussion + dark atmosphere. Kick enters early (bar 9–16). Minimal cinematic layering. | Vocal tease + percussion. Hook fragment in mid-intro. DJ-friendly 16-bar percussion intro. | Percussion only for 16 bars. Kick enters bar 9–16. Maximum DJ utility. Clean mixing point. |
| | | | | | |
| **8** | **Automation curve aggressiveness** | Smooth, gradual. S-curves and logarithmic for transitions. Exponential for build-ups. Automation serves the emotional arc. | Aggressive. Step changes at section boundaries. Fast exponential sweeps. Automation is percussive and dramatic. | Moderate. Musical curves. Vocal-aware — automation must not fight vocal dynamics. | Clean, predictable. Linear and step. Automation serves energy, not narrative. |
| **8a** | Filter sweep speed | Slow — 16–32 bar sweeps. Patient reveals. | Fast — 4–8 bar sweeps. Impatient energy. | Moderate — 8–16 bar sweeps. | Fast — 4–8 bar sweeps. Get to the payoff. |
| **8b** | Section transition style | Cinematic transitions — tails, swells, negative space. 2–4 bar transitions. | Hard cuts — step automation, minimal transition FX. 1–2 bar transitions. | Musical transitions — vocal phrase bridges the gap. 2 bar transitions. | Clean transitions — one riser, one impact, done. 1–2 bar transitions. |
| | | | | | |
| **9** | **Mix report priority risks** | P1: Reverb wash before drops. P1: Orchestral masking leads. P2: Pad buildup in low-mids. P2: Lead width vs mono compatibility. P3: Cinematic FX tail management. | P1: Kick tok survival through distortion chain. P1: Screech 2–5 kHz fatigue. P2: Kick tail vs reverse bass collision. P2: Overall harshness management. P3: Mono compatibility of distorted elements. | P1: Vocal clarity vs lead competition (2–5 kHz). P1: Vocal intelligibility in drops. P2: Lead/vocal sidechain balance. P2: Orchestral masking vocal. P3: Reverb management around vocal phrases. | P1: Kick punch at festival SPL. P1: Overall loudness vs dynamic contrast. P2: Mix translation (mono PA compatibility). P2: Transition energy maintenance. P3: True peak control under hard limiting. |
| | | | | | |
| **10** | **Producer checklist emphasis** | Cinematic intro quality check. Orchestral arrangement coherence. Break emotional arc test. Motif reveal pacing. Reverb tail cleanup at every boundary. | Kick distortion chain A/B test (bypass stages to verify each adds value). Screech fatigue test (listen to full drop at conversation volume). Mono check entire mix. | Vocal recording quality check. Vocal/lead separation test (mute lead — does vocal carry alone?). Hook memorability test (hum test after one listen). | DJ mixing test (mix intro/outro with another track). Festival SPL simulation. Mono collapse test. Overall loudness check against references. |

---

## Quick-Reference: When to Use Each Variant

| If the track needs... | Use variant |
|----------------------|-------------|
| Emotional depth, orchestral weight, patient storytelling | Cinematic-Euphoric |
| Raw aggression, screech-forward, hostile energy | Rawphoric |
| Vocal hook, singalong potential, balanced energy | Anthemic-Euphoric |
| Maximum DJ utility, festival loudness, clean impact | Festival-Hardstyle |
| Dark melodic with aggressive contrast (hybrid) | Rawphoric with `leadStyle: "hybrid"` and `dropStrategy: "anti-climax-to-melodic"` |

---

_Fornix Production Bible — core conditional logic source for all production package document generators._
