# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

Run a single test file: `node --test tests/bridge/bridge-handshake.test.js`

Tests use Node's built-in `node:test` runner — no Jest, no Vitest. Tests import from `dist/`, so a build is required before running bridge tests.

## Architecture

```
Claude / MCP client
  ↓ stdio
src/index.ts   (McpServer, StdioServerTransport)
  ├── src/services/workspace.ts      path guard, allowedDirs, dryRun, config
  ├── src/services/logger.ts         action log (.fornix-mcp.log)
  ├── src/services/checkpoint.ts     git checkpoints (simple-git)
  ├── src/services/bridge.ts         WebSocket bridge to Studio One (experimental)
  ├── src/services/status-server.ts  HTTP server port 7891 (dashboard + /api/status)
  ├── src/services/workspace-profile.ts  workspace.json schema, inheritance resolver
  ├── src/services/template-library.ts   pre-built hardstyle production templates
  └── src/tools/
        filesystem.ts        fs_* tools (guarded by workspace.ts)
        git.ts               git_* tools
        project.ts           project_* tools (build, test, lint, typecheck)
        sound-design.ts      sd_* tools
        session.ts           session_* tools
        workspace-profile.ts fornix_create_workspace, fornix_get_workspace_summary, fornix_add_track_to_workspace
        production-package.ts + production-package-planning.ts (includes batch regen + template tools)
        studio-one/
          transport.ts       s1_get_transport_state, s1_set_tempo, s1_probe_runtime …
          tracks.ts          s1_create_track, s1_rename_track …
          plugins.ts         s1_add_plugin, s1_set_plugin_param …
          midi.ts            s1_add_midi_notes, s1_add_chord …
          arrangement.ts     s1_add_marker, s1_build_arrangement …
          automation.ts      s1_add_automation_point …
          fallback.ts        s1_export_instruction, s1_generate_track_plan …
```

**Config file:** `fornix-mcp.config.json` at workspace root. Key fields: `allowedDirs`, `readOnlyDirs`, `dryRunByDefault`, `gitRoot`, `s1BridgeEnabled`. The workspace guard (`guardPath`) rejects all file ops outside `allowedDirs`.

**Dashboard:** `http://localhost:7891` — served from `dashboard.html` at project root. Status JSON at `/api/status`.

## Bridge lifecycle model

The Studio One bridge (`src/services/bridge.ts`) is **dormant on Studio One 7**. API probing (2026-04-04) confirmed that `Host.WebSocket` and `Host.FileSystem` do not exist in Studio One 7.2.2 — the bridge cannot connect and no file markers can be written from inside the extension. See `docs/studio-one-7-api-findings.md` for the full API surface. The bridge code remains in place for potential future Studio One versions that add WebSocket support. States progress in order:

```
disconnected → connecting → socket_connected → extension_responded
  → handshake_ok → live_read_verified → runtime_verified
```

**`connected` ≠ ready.** A bare socket triggers a `ping` + `getCapabilities` probe. Only after both succeed does `handshakeOk` become `true` and `isBridgeReady()` return `true`. Live tools (`s1_get_transport_state`, `s1_set_tempo`, etc.) return an error message if `isBridgeReady()` is false — they never silently no-op.

Proof states (`S1BridgeProofStates`) track:
- `extensionLoaded` — startup marker found in `Documents/FornixMCP/logs/`
- `listenerCreated` — marker reports `host.websocketServer: true`
- `handshakeOk` — ping + capabilities both answered
- `liveReadVerified` — first real `getTransportState` / `getSongMetadata` succeeded
- `liveWriteVerified` — first real write command succeeded
- `runtimeVerified` — both read and write verified

Use `s1_probe_runtime` (MCP tool) or `GET /api/status` to inspect the current state truthfully.

## Studio One extension

`studio-one-extension/` contains the JS extension that runs inside Studio One. It is **not** a Node module — it is loaded by Studio One's internal scripting engine.

- **`scripts/main.js`**: IComponent/FrameworkService format. Logs startup confirmation to `Host.Console.writeLine`. Reports `Host.WebSocket` and `Host.FileSystem` availability (both absent on S1v7).
- **Full bridge** (original `main.js`): WebSocket server on port 7890, command routing. Verified impossible on Studio One 7 — `Host.WebSocket` does not exist.

Install path (Windows): `%APPDATA%\PreSonus\Studio One 7\Extensions\FornixMCPBridge\`

## Workspace profile system

`workspace.json` sits at the output directory root and defines an EP/album-level workspace with shared style defaults and an optional BPM range. Tracks added to the workspace inherit these defaults unless overridden per-track. Inheritance chain: **track override → workspace default → hardcoded fallback → resolveProfile fills the rest**.

- `fornix_create_workspace` — creates workspace.json with shared defaults
- `fornix_get_workspace_summary` — reads track list, generation status, override counts
- `fornix_add_track_to_workspace` — adds a track with tempo validation against BPM range

When `writeProductionPackage` runs inside a directory with a workspace.json, it records `workspaceRef` in the package metadata for provenance.

## Production package system

`fornix_generate_production_package` generates a file-first structured package under `<workspace>/Fornix/<track-slug>/` with seven document families (Metadata, Project Plan, Routing, Automation, Mix, Sound Design, Checklists). Entirely independent of the Studio One bridge. Selective regeneration and preview/planning tools operate on existing packages without full rewrites.

`fornix_batch_regenerate_package` applies an entire update plan in one call — regenerates multiple (or all) sections with a single metadata write. Accepts an explicit section list or auto-regenerates all recommended sections from the update plan.

## Template library

5 pre-built hardstyle production templates accessible via `fornix_list_templates` (with optional category filter) and `fornix_get_template`. Categories: euphoric, raw, cinematic, festival, hybrid. Each template provides a complete set of style defaults, creative brief, mix concerns, and reference notes ready to populate workspace defaults or individual track profiles.

## Key constraints

- `s1BridgeEnabled` defaults to `false`. Verified impossible on Studio One 7 — do not enable.
- All file tool ops go through `guardPath` — paths outside `allowedDirs` throw.
- `CHARACTER_LIMIT = 12_000` and `FILE_READ_LINE_LIMIT = 500` (constants.ts) cap tool output.
- Tool registration is wrapped in `instrumentToolRegistration` which increments `_toolCallCount` for the dashboard — don't bypass this wrapper when adding new tools.
- Tests expose internal bridge state via `__resetBridgeStateForTests`, `__setSocketFactoryForTests`, `__setBridgeTimeoutForTests` (exported from `bridge.ts` for test use only).
