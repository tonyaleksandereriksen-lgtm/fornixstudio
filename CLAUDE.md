# CLAUDE.md

This file provides guidance to Claude Code (`claude.ai/code`) when working in this repository.

## Project identity

**Project:** Fornix Studio MCP  
**Purpose:** A real production tool for Tony's artist workflow as Fornix — not a demo, not a toy MCP, and not a fake Studio One integration.  
**Primary value today:** file-first production packages, workspace/profile orchestration, arrangement analysis, session watching, dashboard/status truthfulness, and guarded filesystem/project tooling.  
**Real-time path today:** MCU bridge over virtual MIDI is the real-time bidirectional path.  
**Dormant path today:** the original WebSocket Studio One bridge remains in the repo, but is dormant on Studio One 7 and must not be misrepresented as working.

## Mission

The repo should help the user do real music-production work faster and more safely by:

1. generating structured production packages for tracks, EPs, and albums
2. analyzing arrangement and session changes from `.song` files on disk
3. providing trustworthy project/session status through MCP and dashboard surfaces
4. supporting real-time Studio One interaction where there is actual proof, not assumed proof
5. preserving a clean fallback-first architecture so the product remains useful even when live integration is unavailable

## Current repo reality

Treat these as ground truth unless the repository itself proves otherwise:

- The file-first production package workflow is real and valuable.
- The workspace/profile system is core product functionality, not a side feature.
- The song watcher is part of the real “listening” story and should be treated as a first-class integration path.
- The MCU bridge is the live-control path that can actually be made real on Studio One 7.
- The original WebSocket bridge is dormant on Studio One 7 because the required Studio One host APIs are absent.
- Dashboard truthfulness is a product requirement, not a cosmetic detail.
- “Connected” is not the same as “working”.
- No claim of live Studio One control is acceptable without runtime proof.

## Non-negotiable engineering rules

1. Do not invent runtime verification, extension success, bridge readiness, or Studio One capabilities.
2. Do not describe mocked behavior, unit-test behavior, or socket simulations as live Studio One proof.
3. Do not mark dashboard states optimistically.
4. Do not widen scope without reason.
5. Do not rewrite broad areas when a small strong fix is available.
6. Do not break the fallback-first package workflow while improving other systems.
7. Do not touch unrelated code.
8. Do not remove evidence-producing diagnostics unless they are replaced by something better.
9. Do not bypass instrumentation wrappers when registering tools.
10. Do not weaken path guards, allowed-directory enforcement, or dry-run safety.
11. Do not silently change user-facing behavior in production package generation.
12. Do not claim code is verified unless there is explicit evidence: build output, test output, logs, runtime probe, or diff inspection.

## Preferred execution style

For any non-trivial task, follow this order:

1. inspect current code and constraints
2. map impacted files and behavior
3. identify the smallest robust path
4. implement with tight blast radius
5. validate with the most relevant proof available
6. summarize exactly what changed, risk level, and how to verify

When making decisions:

- prefer correctness over cleverness
- prefer maintainability over novelty
- prefer explicitness over hidden magic
- prefer evidence over assumptions
- prefer partial real functionality over broad fake functionality

## Commands

```bash
npm run build          # tsc → dist/
npm run check          # tsc --noEmit (type-check only, no output)
npm run dev            # tsc --watch
npm start              # node dist/index.js

npm test               # build + all tests
npm run test:bridge    # build + bridge handshake/cleanup tests only
npm run test:extension # extension router tests (no build step required)

node validate-setup.mjs   # pre-flight check: config, ports, extension evidence
```

Run a single test file:

```bash
node --test tests/bridge/bridge-handshake.test.js
```

Tests use Node's built-in `node:test` runner — no Jest, no Vitest. Tests import from `dist/`, so a build is required before running bridge tests.

## Architecture

```text
Claude / MCP client
  ↓ stdio
src/index.ts   (McpServer, StdioServerTransport)
  ├── src/services/workspace.ts          path guard, allowedDirs, dryRun, config
  ├── src/services/logger.ts             action log (.fornix-mcp.log)
  ├── src/services/checkpoint.ts         git checkpoints (simple-git)
  ├── src/services/bridge.ts             WebSocket bridge to Studio One (experimental/dormant on S1v7)
  ├── src/services/status-server.ts      HTTP server port 7891 (dashboard + /api/status)
  ├── src/services/workspace-profile.ts  workspace.json schema, inheritance resolver
  ├── src/services/template-library.ts   pre-built hardstyle production templates
  ├── src/services/song-watcher.ts       chokidar file watcher + .song diff engine
  ├── src/services/song-file.ts          Studio One .song probing/parsing helpers
  ├── src/services/arrangement.ts        arrangement analysis engine
  ├── src/services/mcu-protocol.ts       pure MCU MIDI protocol layer
  ├── src/services/mcu-bridge.ts         real-time MCU bridge via virtual MIDI
  └── src/tools/
        filesystem.ts        fs_* tools (guarded by workspace.ts)
        git.ts               git_* tools
        project.ts           project_* tools (build, test, lint, typecheck)
        sound-design.ts      sd_* tools
        session.ts           session_* tools
        arrangement.ts       fornix_analyze_arrangement
        song-watcher.ts      s1_watch_session, s1_session_snapshot, s1_session_diff, s1_stop_watching
        workspace-profile.ts fornix_create/get/add workspace + pipeline + consistency tools
        production-package.ts
        production-package-planning.ts   package planning + selective/batch regeneration
        studio-one/
          transport.ts       s1_get_transport_state, s1_set_tempo, s1_probe_runtime …
          tracks.ts          s1_create_track, s1_rename_track …
          plugins.ts         s1_add_plugin, s1_set_plugin_param …
          midi.ts            s1_add_midi_notes, s1_add_chord …
          arrangement.ts     s1_add_marker, s1_build_arrangement …
          automation.ts      s1_add_automation_point …
          fallback.ts        s1_export_instruction, s1_generate_track_plan …
```

**Config file:** `fornix-mcp.config.json` at workspace root. Key fields: `allowedDirs`, `readOnlyDirs`, `dryRunByDefault`, `gitRoot`, `s1BridgeEnabled`. The workspace guard (`guardPath`) rejects all file operations outside `allowedDirs`.

**Dashboard:** `http://localhost:7891` — served from `dashboard.html` at project root. Status JSON at `/api/status`.

## Product priorities

When several directions compete, prefer them in roughly this order:

1. **Truthful runtime status and safe behavior**
   - no fake green states
   - no implied live capability without proof
   - no silent no-ops for live tools

2. **File-first production workflow quality**
   - production package generation must stay reliable
   - selective regeneration must stay coherent
   - workspace/profile inheritance must stay consistent across all rendered documents

3. **Workspace/profile system robustness**
   - one resolved profile source of truth
   - drift detection must remain trustworthy
   - defaults/overrides/template inheritance must remain explicit

4. **Song watcher and arrangement value**
   - watcher should remain stable, useful, and evidence-based
   - arrangement output should stay actionable, not vague

5. **MCU bridge hardening**
   - improve real-time control only on evidence-backed paths
   - keep protocol logic testable and isolated from I/O concerns

6. **Dormant bridge containment**
   - keep the WebSocket bridge honest
   - do not let dormant code contaminate dashboard truth or product claims

## Bridge lifecycle model

The Studio One bridge (`src/services/bridge.ts`) is **dormant on Studio One 7**. API probing confirmed that `Host.WebSocket` and `Host.FileSystem` do not exist in Studio One 7.2.2 — the bridge cannot connect and no file markers can be written from inside the extension. The bridge code remains in place only for possible future Studio One versions that add the missing host APIs.

State progression:

```text
disconnected → connecting → socket_connected → extension_responded
  → handshake_ok → live_read_verified → runtime_verified
```

**`connected` is not ready.** A bare socket must still pass `ping` + `getCapabilities`. Only after that may `handshakeOk` be considered true and `isBridgeReady()` return true.

Live tools must never silently no-op. If `isBridgeReady()` is false, tools such as `s1_get_transport_state`, `s1_set_tempo`, and similar must return a truthful error message.

### Proof-state policy

Treat these proof states as the only acceptable runtime bar:

- `extensionLoaded`
- `listenerCreated`
- `handshakeOk`
- `liveReadVerified`
- `liveWriteVerified`
- `runtimeVerified`

A system is **not** live unless the proof chain supports that claim.

### Evidence policy for bridge work

Accepted evidence:

- Studio One logs showing extension activity
- extension startup markers
- status endpoint proof states
- real successful read/write operations against a live S1 session
- reproducible manual verification steps

Not accepted as live proof:

- unit tests alone
- mocked sockets
- simulated servers
- CI success alone
- dashboard state without evidence backing it

Use `s1_probe_runtime` or `GET /api/status` to inspect the current truth.

## Studio One extension

`studio-one-extension/` contains the JavaScript extension that runs inside Studio One. It is **not** a Node module — it is loaded by Studio One's internal scripting engine.

- `scripts/main.js`: IComponent/FrameworkService format. Logs startup confirmation to `Host.Console.writeLine`. Reports `Host.WebSocket` and `Host.FileSystem` availability.
- Full bridge mode (legacy/original `main.js`): WebSocket server on port 7890 with command routing. Keep it classified as dormant on Studio One 7 unless future runtime proof says otherwise.

Install path (Windows):

```text
%APPDATA%\PreSonus\Studio One 7\Extensions\FornixMCPBridge\
```

## Workspace profile system

`workspace.json` sits at the output directory root and defines an EP/album-level workspace with shared style defaults and an optional BPM range. Tracks added to the workspace inherit defaults unless overridden per track.

Inheritance chain:

```text
track override → workspace default → hardcoded fallback → resolveProfile fills the rest
```

Core tools:

- `fornix_create_workspace`
- `fornix_get_workspace_summary`
- `fornix_add_track_to_workspace`
- `fornix_generate_workspace_packages`
- `fornix_create_workspace_from_template`
- `fornix_check_workspace_consistency`
- `fornix_remove_track_from_workspace`
- `fornix_update_workspace_defaults`

When `writeProductionPackage` runs inside a directory with a `workspace.json`, it records `workspaceRef` in package metadata for provenance.

### Workspace/profile rules

1. The resolved profile must behave as a single source of truth.
2. Metadata and rendered sections must agree on resolved values.
3. If a renderer uses profile data, it must use the same resolved source as the metadata layer.
4. Any change to defaults or overrides should be checked with consistency tooling.
5. Package drift is a product concern, not a cosmetic concern.

## Production package system

`fornix_generate_production_package` generates a structured file-first package under:

```text
<workspace>/Fornix/<track-slug>/
```

Document families include:

- Metadata
- Project Plan
- Routing
- Automation
- Mix
- Sound Design
- Checklists

This package flow is entirely independent of the dormant WebSocket bridge.

Selective regeneration and preview/planning tools must remain stable on existing packages without forcing full rewrites.

`fornix_batch_regenerate_package` applies an entire update plan in one call and should preserve coherence across regenerated sections.

### Production package rules

1. Do not break package generation while improving unrelated systems.
2. Prefer small renderer fixes over broad workflow rewrites.
3. If profile values are resolved once, all sections must consume the same resolved result.
4. Preserve metadata accuracy on partial regeneration.
5. A package with internally conflicting profile values is a real bug, not a formatting issue.
6. Changes should be reviewable at the section/document level.

## Template library

There are 5 pre-built hardstyle production templates exposed through `fornix_list_templates` and `fornix_get_template`.

Categories:

- euphoric
- raw
- cinematic
- festival
- hybrid

Each template provides style defaults, creative brief, mix concerns, and reference notes suitable for workspace defaults or individual track profiles.

## Arrangement analysis (POC)

`fornix_analyze_arrangement` reads a Studio One `.song` file from disk or accepts manual section input, then returns actionable arrangement consultation.

Probe strategies:

1. ZIP extraction (`.song` as ZIP with XML)
2. raw XML parse
3. binary string scan

If unreadable, the tool should return evidence of what was found and still accept `manualSections` as fallback.

Analysis output should stay concrete:

- section map with bar ranges and flags
- energy arc assessment
- specific problems with bar references
- concrete actions with bar targets
- hardstyle-specific checks such as missing drops, short drops, and missing build-ups

Files:

- `src/services/song-file.ts`
- `src/services/arrangement.ts`
- `src/tools/arrangement.ts`

## Song watcher (session listener)

`src/services/song-watcher.ts` uses chokidar to watch a Studio One project directory for `.song` file changes. When the user saves in Studio One, the watcher reparses the file and diffs against the previous snapshot.

Core tools:

- `s1_watch_session`
- `s1_session_snapshot`
- `s1_session_diff`
- `s1_stop_watching`

Implementation notes:

- debounce: 1.5s
- uses `awaitWriteFinish`
- parser may need to recover from temporary file locks during save
- watcher status surfaces through `/api/status`

### Watcher rules

1. Treat watcher output as evidence-based file-state awareness, not fake live control.
2. Parsing failures should degrade gracefully and recover on the next save.
3. Snapshot/diff output should stay useful even if one parse pass fails.
4. Keep watcher logic resilient to Studio One multi-pass save behavior.

## MCU bridge (real-time bidirectional)

`src/services/mcu-bridge.ts` connects to Studio One via a virtual MIDI port using the Mackie Control Universal protocol.

This is the real-time bidirectional path that matters on Studio One 7.

### Design rules for MCU work

1. Keep protocol parsing/building pure and testable in `mcu-protocol.ts`.
2. Keep transport/I/O concerns in `mcu-bridge.ts` and surrounding integration code.
3. Prefer deterministic state handling over event spaghetti.
4. Protect reconnect/disconnect flows from state leaks.
5. When adding commands, update both protocol understanding and user-facing state/reporting.

### What Studio One pushes to us

- track names (7 chars via LCD SysEx)
- fader positions (14-bit)
- transport state
- solo/mute/arm per channel
- VU levels
- pan positions
- timecode/bar position

### What we can send to Studio One

- transport commands
- fader moves
- solo/mute toggles
- bank switching
- save
- undo

Tools:

- `mcu_list_ports`
- `mcu_connect`
- `mcu_disconnect`
- `mcu_state`
- `mcu_transport`
- `mcu_fader`
- `mcu_solo`
- `mcu_mute`
- `mcu_bank`
- `mcu_save`
- `mcu_undo`

One-time setup:

1. Install loopMIDI and create a port (for example `Fornix MCU`)
2. In Studio One: Options → External Devices → Add → Mackie Control
3. Select the same loopMIDI port for both Receive and Send
4. Call `mcu_connect` with the port name

MCU bridge state should remain visible from `/api/status`.

## Key constraints

- `s1BridgeEnabled` defaults to `false`. Do not enable it casually.
- All file tool operations go through `guardPath`.
- Paths outside `allowedDirs` must throw.
- `CHARACTER_LIMIT = 12_000` and `FILE_READ_LINE_LIMIT = 500` cap tool output.
- Tool registration is wrapped in `instrumentToolRegistration`, which increments `_toolCallCount` for the dashboard.
- Internal bridge test helpers exported from `bridge.ts` are for tests only.

## Safe-change rules by subsystem

### When touching `src/index.ts`

- preserve tool registration discipline
- preserve dashboard/status server startup behavior
- preserve MCP transport behavior
- do not break boot order casually

### When touching `src/services/status-server.ts` or `dashboard.html`

- status must remain truthful
- do not promote unverified states to “working”
- UI polish must never hide system uncertainty
- dashboard copy must match real backend state

### When touching `src/services/bridge.ts`

- keep dormant classification intact on Studio One 7
- do not weaken readiness checks
- do not blur socket-connected and runtime-verified
- do not break proof-state reporting

### When touching production package renderers or planners

- preserve single-source resolved profile behavior
- preserve metadata/renderer consistency
- preserve selective regeneration behavior
- preserve batch regeneration coherence

### When touching watcher or arrangement systems

- preserve graceful degradation
- preserve useful output even on partial file-read failure
- keep findings actionable, not generic

### When touching MCU systems

- do not mix protocol logic with ad hoc state mutations
- protect connect/disconnect/reconnect paths
- keep command/state mapping explicit
- validate against real port behavior where possible

## Testing and validation policy

Choose validation based on the subsystem changed.

### General validation

- `npm run check`
- `npm run build`
- targeted test file(s)
- full `npm test` when scope justifies it

### Bridge-related validation

- `npm run test:bridge`
- `node validate-setup.mjs`
- status endpoint review
- runtime proof inspection

### Extension-related validation

- `npm run test:extension`
- review extension packaging/install assumptions
- do not confuse extension load with runtime verification

### Package/workspace validation

- generate or preview affected packages
- run consistency checks when defaults/overrides/renderers change
- confirm metadata and rendered docs agree on resolved profile values

### Watcher/arrangement validation

- use a representative `.song` file
- verify snapshot usefulness
- verify diff usefulness across two saves
- verify fallback behavior when parsing is incomplete

### MCU validation

- port listing
- connect/disconnect cycle
- real message/state observation where possible
- regression check on state reporting

## Task-specific instructions

### When asked to map the repo

Return:

- current architecture
- active subsystems
- dormant or risky subsystems
- high-value next steps
- exact impacted files for the next round

### When asked to fix a bug

Return or perform in this order:

1. likely root cause
2. smallest robust fix
3. files touched
4. risk level
5. validation steps

### When asked to build a feature

First decide whether the feature belongs in:

- file-first workflow
- watcher/analysis workflow
- MCU real-time workflow
- dormant bridge / future-facing code

If it lands in dormant bridge code, be explicit about that risk.

### When asked to improve the dashboard

Treat dashboard truthfulness as mandatory:

- do not overstate readiness
- do not hide uncertainty
- show proof states where relevant
- prefer precise labels over marketing language

## Response format preference

Unless the user asks otherwise, non-trivial responses should end with:

- **Changed files**
- **Risk level**
- **How to verify**

When work is incomplete, say exactly what remains blocked and why.

## Definition of done

A task is not done just because code changed.

It is done when:

1. the change matches the requested scope
2. the repo still builds or the failure is explicitly explained
3. the relevant validation path has been used
4. runtime claims match available evidence
5. fallback behavior remains intact where applicable
6. the summary clearly states what changed and how to verify it

## Project-specific context

**Stack:** TypeScript, Node.js, MCP server, WebSocket experiments, HTTP dashboard, Studio One extension JS, MIDI/MCU integration  
**Entry point:** `src/index.ts`  
**Primary dashboard port:** `7891`  
**Experimental/dormant bridge port:** `7890`  
**Run command:** `npm start`  
**Build command:** `npm run build`  
**Type-check command:** `npm run check`  
**Test command:** `npm test`  
**Critical constraints:** keep fallback-first flow intact; do not fake live Studio One success; do not bypass path guards; do not break package consistency  
**Forbidden behavior:** marking dormant bridge as production-ready; reporting simulated success as runtime proof; broad rewrites without need  
**Current strategic goal:** make the repo a reliable production assistant for Fornix workflow with truthful status, robust file-first generation, strong watcher/analysis tooling, and evidence-based real-time control paths

## Optional repo-specific notes

Add new repo-specific constraints here as the project evolves.
