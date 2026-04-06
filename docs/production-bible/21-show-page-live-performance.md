# Show Page Live Performance Setup — Fornix Production Bible

> DAW: Studio One 7 Show Page
> Feeds: Producer Checklist generator (`06_Checklists`) for live-readiness validation

---

## 1. Three Player Types

Studio One's Show Page uses three player types. Each serves a different role in live performance.

| Player Type | What It Does | Fornix Use Case |
|-------------|-------------|----------------|
| **Backing Track** | Plays pre-rendered audio files (WAV/MP3). No processing — just playback. | Primary use: stem playback. Each stem group (Kick, Leads, Pads, etc.) gets its own Backing Track player. |
| **Virtual Instrument** | Loads a software instrument for live MIDI performance. | Secondary use: live synthesis during interludes. A single Serum instance for real-time motif performance over stems. |
| **Real Instrument** | Audio input from hardware (guitar, mic, synth). | Tertiary use: hardware synth integration if performing with external gear. |

### How Fornix Would Use Each

| Setup | Players per Song | Configuration |
|-------|-----------------|---------------|
| **Stem playback set** (primary) | 5–7 Backing Track players per song | One per stem group: Kick, Drums, Leads, Pads, VocalsFX, Orchestral (if applicable), Full Reference (backup) |
| **Live synthesis interlude** | 1 Virtual Instrument (Serum or Sylenth1) | Loaded with the leitmotif patch. Performed live during interludes between tracks. |
| **Full backing** (simple fallback) | 1 Backing Track (full stereo mix) | For emergency: one player with the complete mixed track. If stem setup fails, switch to full backing. |

---

## 2. Perform Mode

### Assignable Controls

| Limit | Value | Notes |
|-------|-------|-------|
| Total assignable controls | 48 (16 knobs + 16 faders + 16 buttons) | Per-song — each song in the setlist can have different assignments |
| Knobs | Up to 16 | Continuous controls — filter cutoff, reverb send, etc. |
| Faders | Up to 16 | Volume, send levels, etc. |
| Buttons | Up to 16 | Toggle mute/unmute, trigger FX, switch patches |

### How Patches Save

- Each **Song** in the Show Page setlist saves its own patch configuration
- Moving between songs loads the corresponding patch — all levels, mutes, and assignments reset to the saved state
- Changes made during performance are NOT saved unless explicitly written

### What Does NOT Work in Show Page vs. Song Page

| Feature | Song Page | Show Page |
|---------|-----------|-----------|
| Full plugin insert chains per channel | Yes | Limited — basic inserts only, lower count |
| Automation lanes | Full automation | No automation — levels are manual/MIDI-controlled |
| Bus routing complexity | Unlimited | Simplified — fewer buses available |
| Sidechain compression | Yes | Limited support — depends on plugin |
| Plugin delay compensation | Full | May not be as precise — keep plugin count low |
| Recording | Yes | No (Show Page is playback-only) |
| Arranger track | Yes | No — songs play start to finish |

---

## 3. Stem Packing Strategy for Live Performance

### Which Stem Groups to Export

| Stem # | Name | Content | Live Control Purpose |
|--------|------|---------|---------------------|
| 1 | **KICK** | Kick layers + sub sine + reverse bass | Fader: kick level. Mute button: kill the kick for transitions. |
| 2 | **DRUMS** | Clap, hats, rides, fills | Fader: percussion level. Can be muted during breakdowns for dynamic effect. |
| 3 | **LEADS** | Lead synth + screech layers | Fader: lead/screech balance. Key mute target for anti-climax/euphoric switching live. |
| 4 | **PADS** | Chords, pads, orchestral | Fader: harmonic bed level. Increase in breakdowns, decrease in drops. |
| 5 | **VOX/FX** | Vocals, FX, risers, impacts | Fader: FX/vocal level. Can ride for dramatic effect. |

### Organization in the Show Page Setlist

```
SETLIST
├── Song 1: "Cathedral of Ruin"
│   ├── Player: KICK (Backing Track → Fornix_CathedralOfRuin_Kick_150_11A.wav)
│   ├── Player: DRUMS (Backing Track)
│   ├── Player: LEADS (Backing Track)
│   ├── Player: PADS (Backing Track)
│   └── Player: VOX/FX (Backing Track)
│
├── INTERLUDE 1→2 (dedicated song entry)
│   └── Player: INTERLUDE (Backing Track → 45-second composed bridge)
│   └── Player: LIVE SERUM (Virtual Instrument → leitmotif patch)
│
├── Song 2: "Ascendant"
│   ├── Player: KICK
│   ├── Player: DRUMS
│   ├── Player: LEADS
│   ├── Player: PADS
│   └── Player: VOX/FX
│
├── INTERLUDE 2→3
│   └── ...
└── Song 3: ...
```

### How to Handle Cinematic Interludes

Cinematic interludes (30–60 second composed bridges between tracks) are Fornix's live signature.

| Approach | Setup | Pros | Cons |
|----------|-------|------|------|
| **Pre-rendered interlude** | Backing Track player with the composed interlude WAV | Consistent, no risk of performance error | Cannot adapt to crowd energy |
| **Live-performed interlude** | Virtual Instrument (Serum) with the leitmotif patch, performed over a pre-rendered atmospheric bed | Dynamic, can extend or shorten based on crowd | Requires rehearsal, risk of wrong notes |
| **Hybrid** | Pre-rendered atmospheric bed + live Serum melody on top | Best of both — atmosphere is safe, melody is dynamic | Requires two players for one interlude |

Recommendation: **Hybrid approach.** The atmospheric bed (reverb, pad, drone) is pre-rendered as a Backing Track. The leitmotif melody is performed live on a Virtual Instrument. This ensures the atmosphere is always correct while allowing live expression.

---

## 4. CDJ-3000 Integration Alongside Laptop

For hybrid DJ/live sets where the laptop (S1 Show Page) plays alongside CDJ-3000s.

### MIDI Clock Sync

| Parameter | Setting |
|-----------|---------|
| Clock source | Laptop as master (recommended), or CDJ via third-party bridge (choose ONE) |
| S1 Show Page | Options → External Devices → MIDI Clock send (if laptop is master) or receive (if using bridge) |
| CDJ-3000 | **Does NOT natively send MIDI clock.** CDJs use Pro DJ Link (Ethernet). To get MIDI clock from CDJ data, use a third-party bridge (e.g., CDJ Clock software that converts Pro DJ Link → MIDI beat clock). Alternatively, use the DJM mixer's MIDI clock output. |
| BPM lock | Both sources MUST be at the same BPM. At 150 BPM, even ±0.5 BPM causes drift over 30 seconds. |

### Phase-Locking Both Sources

| Method | How | When to Use |
|--------|-----|-------------|
| **MIDI clock via bridge** | Third-party software (CDJ Clock) converts Pro DJ Link to MIDI beat clock, S1 follows | When the CDJ track needs to be the timing reference (mixing into a stem set). Adds latency — test thoroughly. |
| **Manual beatmatch** | No MIDI sync — DJ matches by ear using S1's play button and CDJ tempo | When sync latency is unacceptable or MIDI connection is unreliable |
| **Ableton Link** | Network-based sync (if both support it) | Not natively supported by CDJ-3000. Requires third-party bridge. Not recommended. |

### Practical Setup

1. CDJ-3000 plays the outgoing track (standard DJ mix)
2. At the transition point, the DJ starts the S1 Show Page song (stem set begins)
3. If MIDI synced: S1 starts on the downbeat automatically
4. If manual: the DJ presses play on S1 on the correct downbeat (rehearse this)
5. CDJ fades out, S1 stems take over
6. At the end of the stem set, the DJ starts the next CDJ track and fades out S1

---

## 5. MIDI Mapping Workflow in Studio One

### How to Assign Hardware Controls to Show Page Parameters

1. **External Devices:** Options → External Devices → Add → New Keyboard (or specific controller)
2. **MIDI Learn:** In the Show Page, right-click any assignable parameter → "MIDI Learn" → move the hardware control
3. **Perform Mode assignments:** Perform panel → right-click a slot → assign to hardware knob/fader/button

### Recommended MIDI Controller Layout for Fornix Live

| Hardware Control | Assigned To | Purpose |
|-----------------|------------|---------|
| Fader 1 | KICK player volume | Ride kick level for transitions |
| Fader 2 | DRUMS player volume | Pull drums during breakdowns |
| Fader 3 | LEADS player volume | Control lead/screech presence |
| Fader 4 | PADS player volume | Atmospheric control |
| Fader 5 | VOX/FX player volume | Vocal and FX rides |
| Button 1 | KICK mute | Kill kick for dramatic effect |
| Button 2 | LEADS mute | Switch between anti-climax and melodic sections live |
| Button 3 | Next Song (Show Page) | Advance to next song in setlist |
| Knob 1 | Master filter (if using a bus filter) | Live filter sweeps |
| Knob 2 | Reverb send level | Live reverb throws |

---

## 6. The Custom Cinematic Interlude Strategy

Why 30–60 second composed bridges between set tracks are Fornix's live signature.

### Purpose

| Function | Explanation |
|----------|------------|
| **Narrative continuity** | Interludes carry the leitmotif between tracks, maintaining the concept album narrative in a live set. |
| **Energy management** | After a high-energy drop, the interlude provides a breath before the next track — the audience needs peaks AND valleys. |
| **Key transition** | The interlude modulates from the outgoing track's key to the incoming track's key. No harsh key clashes. |
| **Brand identity** | Custom interludes are rare in hardstyle. They distinguish a Fornix set from a standard DJ mix. |

### Interlude Design for Live Sets

| Timing | Content |
|--------|---------|
| 0–15 s | Atmospheric tail from previous track fades + ambient texture rises |
| 15–30 s | Leitmotif fragment plays (live on Serum or pre-rendered) |
| 30–45 s | Harmonic modulation occurs (key shift toward next track) |
| 45–60 s | Texture morphs into next track's intro atmosphere, fading to meet the incoming song |

### Sequencing in the Show Page

Each interlude is a separate Song entry in the setlist:
1. Song: "Cathedral of Ruin" (stem set)
2. **Song: "Interlude 1→2"** (backing track + virtual instrument)
3. Song: "Ascendant" (stem set)

The DJ triggers each song transition manually (Button 3: Next Song). The interlude begins immediately after the previous song's last note.

---

## 7. CPU Management in Show Page

### Show Page vs. Song Page CPU

| Factor | Song Page | Show Page |
|--------|-----------|-----------|
| Active plugins | Full session (50–200 plugins) | Per-song only (5–15 players + effects) |
| CPU load | High — all plugins active | Lower — only current song's players consume CPU |
| Pre-loading | All tracks loaded | Next song pre-loads while current plays |
| Buffer size | Low (128–256 samples for recording) | Can be higher (512–1024) — no recording, only playback |

### Optimizing for Large Stem Configurations

| Optimization | How | Impact |
|-------------|-----|--------|
| Increase buffer size | Options → Audio Setup → Buffer: 512 or 1024 samples | Major CPU reduction. Latency doesn't matter for backing tracks. |
| Render stems at session rate | Export at 44.1 kHz / 24-bit (matching the Show Page session) | Avoids real-time sample rate conversion |
| Limit Virtual Instruments | Maximum 1–2 Serum instances per song | Serum is CPU-heavy. More than 2 instances risks dropouts. |
| Freeze Virtual Instruments | If not performing live, freeze (render) the VI to audio | Eliminates CPU cost entirely |
| Disable unused players | Mute or deactivate Backing Track players not needed for a specific song | Reduces disk read load |
| Use SSD for stems | Store all stem WAVs on an SSD, not HDD | Eliminates disk bottleneck for 5–7 simultaneous audio streams |

---

_Fornix Production Bible — feeds `06_Checklists/Producer_Checklist.md` live-readiness validation section._
