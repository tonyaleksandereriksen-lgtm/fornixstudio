# Stem Export Conventions and Mix Referencing Workflow — Fornix Production Bible

> DAW: Studio One 7
> Feeds: Producer Checklist generator (`06_Checklists/Producer_Checklist.md`)

---

## 1. Standard 7 Stem Groups for Hardstyle

| # | Stem Name | Contents | Bus Source |
|---|-----------|----------|-----------|
| 1 | **Kick** | All kick layers (tok, punch, body, tail), sub sine, reverse bass | KICK & BASS bus solo |
| 2 | **Drums / Percussion** | Clap, snare, hi-hats, rides, fills, shakers, percussion loops | DRUM TOPS bus solo |
| 3 | **Leads / Screeches** | Main lead, octave supports, screech layers, note-center layer | LEAD bus + SCREECH bus solo |
| 4 | **Pads / Atmospheres** | Chord stacks, pads, plucks, atmospheric textures, cinematic drones | MUSIC bus + orchestral elements |
| 5 | **Vocals / FX** | All vocal layers, vocal chops, FX hits, risers, downlifters, impacts | VOX bus + FX bus solo |
| 6 | **Orchestral** (if applicable) | Strings, brass, woodwinds, choir, orchestral percussion | ORCHESTRAL bus solo (cinematic/anthemic only) |
| 7 | **Full Stereo Reference** | Complete mix, no master bus processing (or with master bus, clearly labeled) | Full mix solo, master bus bypassed |

### Stem grouping rules

- **Stem 1 (Kick)** includes the sub and reverse bass because they are rhythmically and tonally locked to the kick. Separating them creates phase issues when recombined.
- **Stem 3 (Leads)** includes screech because they share the same frequency range and bus processing. The screech IS a lead variant.
- **Stem 5 (Vocals / FX)** combines vocals and FX because in hardstyle, vocal content is sparse and FX are transitional — both are "event-based" rather than continuous.
- **Stem 6 (Orchestral)** is only exported for cinematic-euphoric and anthemic-euphoric variants. Rawphoric and festival tracks skip this stem.
- **Stem 7 (Reference)** is the complete mix with master bus processing bypassed. This is the summing reference — all stems should sum to match this exactly.

---

## 2. Stem Export Settings

| Parameter | Value | Reason |
|-----------|-------|--------|
| **Format** | WAV | Lossless. No lossy formats for stems. |
| **Sample rate** | 44.1 kHz | Matches the session rate. Do NOT upsample on export. |
| **Bit depth** | 24-bit | Sufficient dynamic range (144 dB). No dither on stems — dither is for final masters only. |
| **Master bus bypass** | **YES** — bypass the master bus chain when exporting stems | Stems must be raw bus outputs. If the master chain is baked in, stems cannot be remixed. |
| **Start point** | Bar 1, beat 1 (song start) | All stems must start at the same point for perfect alignment when imported elsewhere. |
| **Length** | Full song length (all stems same length) | Pad with silence if a stem doesn't play for the full song. Length alignment is critical. |
| **Normalization** | **OFF** — never normalize stems | Normalization changes the relative levels. Stems must maintain their mix-level relationships. |
| **Tail capture** | Enable "Tail" option (2–4 seconds) | Captures reverb/delay tails that extend past the last bar. Without this, stems end abruptly. |
| **Dither** | **OFF** for stems | Dither is only applied once, at the final master. Dithering stems introduces noise that compounds when stems are summed. |
| **Mixdown mode** | Stem export (solo each bus, render) | Use S1's "Export Stems" feature or manually solo each bus and render |

### Studio One 7 Stem Export Steps

1. **Song** → **Export Stems** (if available) OR manually:
2. Solo the KICK & BASS bus → **Song** → **Export Mixdown** → save as `Fornix_TrackTitle_Kick_150_AmCamelot.wav`
3. Solo the DRUM TOPS bus → Export → save as `Fornix_TrackTitle_Drums_150_AmCamelot.wav`
4. Repeat for each stem group
5. Unsolo all → Bypass master bus chain → Export full reference mix
6. **Verify:** Import all stems into a new S1 session. They should sum to match the reference mix exactly (null test: invert reference, sum with stems — silence = pass).

---

## 3. Naming Convention

```
{ArtistName}_{TrackTitle}_{StemType}_{BPM}_{KeyCamelot}.wav
```

| Component | Format | Example |
|-----------|--------|---------|
| ArtistName | PascalCase, no spaces | `Fornix` |
| TrackTitle | PascalCase, no spaces, abbreviated if long | `CathedralOfRuin` |
| StemType | From standard list: `Kick`, `Drums`, `Leads`, `Pads`, `VocalsFX`, `Orchestral`, `FullRef` | `Kick` |
| BPM | Integer | `150` |
| KeyCamelot | Key in Camelot notation | `11A` (F# minor) |

**Examples:**
- `Fornix_CathedralOfRuin_Kick_150_11A.wav`
- `Fornix_CathedralOfRuin_Leads_150_11A.wav`
- `Fornix_CathedralOfRuin_FullRef_150_11A.wav`

### Camelot Notation Reference (Common Hardstyle Keys)

| Key | Camelot | Frequency (root) |
|-----|---------|-----------------|
| A minor | 8A | 110 Hz |
| D minor | 7A | 73 Hz |
| E minor | 9A | 82 Hz |
| F# minor | 11A | 92 Hz |
| G minor | 6A | 98 Hz |
| C minor | 5A | 65 Hz |
| B minor | 10A | 123 Hz |

---

## 4. Which Stems to Prepare Per Use Case

| Use Case | Required Stems | Optional Stems | Notes |
|----------|---------------|---------------|-------|
| **DJ use** | Kick, Leads, FullRef | Drums, VocalsFX | DJs use kick stem for mashups and leads for acapella-style layering |
| **Mastering engineer** | FullRef (with master bus active + bypassed) | All 7 stems | Engineer needs the full reference to understand intent, plus bypassed version to work from |
| **Live performance** | Kick, Drums, Leads, Pads, VocalsFX | Orchestral (if applicable) | Show Page backing tracks. Each stem = one player. |
| **Remix** | All 7 stems (master bypassed) | Additional: individual vocal stem isolated | Full separation for remix flexibility |
| **Collaboration** | All 7 stems + S1 project file | — | Project file allows the collaborator to modify the session directly |

---

## 5. Studio One Project Page Mix Reference Setup

The Project Page is S1's mastering environment. Use it for A/B referencing against commercial tracks.

### Reference Track Setup

1. **Create a new Project** → **Song** → **Insert Song** (import your mix)
2. **Add reference tracks:**
   - Drag reference WAVs into the Project Page as separate songs
   - OR use a reference plugin (ADPTR Metric AB) on the master bus in the Song Page
3. **Level matching (critical):**
   - References are mastered (loud). Your mix is unmastered (quieter).
   - Level-match to the QUIETER source — turn the reference DOWN, not your mix up.
   - In Metric AB: enable auto-level-match. It adjusts reference playback to match your mix's LUFS.
   - Manual method: use a LUFS meter on both. Adjust reference fader until integrated LUFS matches.
4. **A/B workflow:**
   - Play your mix for 10–20 seconds → switch to reference → listen for 10–20 seconds
   - Compare: low-end weight, mid-range clarity, high-end air, stereo width, dynamic range
   - **Never compare at different loudness levels.** Louder always sounds "better."

### Reference Plugin Position

| Method | Plugin | Position | Pros | Cons |
|--------|--------|----------|------|------|
| Metric AB on master | ADPTR Metric AB | Position 1 (first insert on master bus) | Auto-level-match, instant switching, built-in EQ comparison | Extra plugin on master |
| Project Page comparison | S1 Project Page | Separate mastering environment | No extra plugin, native S1 workflow | Requires bouncing mix first, no real-time switching during mixing |

Recommendation: Use **Metric AB on the master bus** during mixing for real-time A/B. Use the **Project Page** for final mastering comparisons.

---

## 6. How to Use Reference Tracks Technically

### Level Matching (Most Critical)

| Step | Action | Why |
|------|--------|-----|
| 1 | Measure your mix's integrated LUFS (full playback or drop section) | Establish the baseline |
| 2 | Set the reference track to play at the same integrated LUFS | Remove loudness bias |
| 3 | A/B at matched levels | Now differences are MIX decisions, not LOUDNESS |

### Frequency Spectrum Comparison

1. Open a spectrum analyzer (SPAN or Pro-Q 3 analyzer) on the master bus
2. Play your mix — note the overall spectral shape
3. Switch to reference — compare the spectral shape
4. Look for: excessive sub buildup (30–80 Hz), missing body (100–300 Hz), harsh presence (2–5 kHz), missing air (10+ kHz)
5. **Don't EQ-match blindly.** The reference is a different track with different instruments. Use it as a guide for overall spectral balance, not a target curve.

### Stereo Width Comparison

1. Use a stereo correlation meter (S1 built-in or SPAN)
2. Play your mix: note the correlation value during drops (should be 0.3–0.8, never negative)
3. Play reference: compare correlation
4. Use a stereo vectorscope: your mix's "shape" should be similar width to the reference during equivalent sections
5. If your mix is narrower: check M/S processing, lead width, reverb return width
6. If your mix is wider: check for phase issues (correlation < 0.3 is suspicious)

---

## 7. Final Master Metadata

Embed in the final master WAV/FLAC before distribution.

| Field | Format | Example | Where |
|-------|--------|---------|-------|
| **ISRC** | CC-XXX-YY-NNNNN | NL-XXX-26-00001 | ID3 tag / BWF metadata |
| **BPM** | Integer | 150 | ID3 tag (TBPM) |
| **Key** | Camelot notation | 11A | ID3 tag (TKEY or custom field) |
| **Key (musical)** | Standard notation | F# minor | ID3 tag (TKEY) |
| **Artist** | Text | Fornix | ID3 tag (TPE1) |
| **Title** | Text | Cathedral of Ruin | ID3 tag (TIT2) |
| **Genre** | Text | Hardstyle | ID3 tag (TCON) |
| **Label** | Text (if applicable) | — | ID3 tag (TPUB) |
| **Year** | YYYY | 2026 | ID3 tag (TDRC) |
| **Master type** | Custom tag | Club Master / Streaming Master | Comment field |

### How to embed in Studio One 7

- **Export Mixdown** → Metadata section → fill in Artist, Title, Genre
- For BPM/Key: S1 doesn't have dedicated fields. Add to the Comment field: `150 BPM | F# minor | 11A`
- For ISRC: Add to the ISRC field in the Project Page export settings
- **Alternative:** Use Kid3 or Mp3tag post-export to add all metadata fields

---

_Fornix Production Bible — feeds `06_Checklists/Producer_Checklist.md` stem export and mix referencing sections._
