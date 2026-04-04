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
  └── src/tools/
        filesystem.ts        fs_* tools (guarded by workspace.ts)
        git.ts               git_* tools
        project.ts           project_* tools (build, test, lint, typecheck)
        sound-design.ts      sd_* tools
        session.ts           session_* tools
        production-package.ts + production-package-planning.ts
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

The Studio One bridge (`src/services/bridge.ts`) is experimental. States progress in order:

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

- **Stage 1 smoke** (`scripts/main.js`): IComponent format, no WebSocket, just writes a startup/shutdown marker to `Documents/FornixMCP/logs/startup-*.json`. Used to confirm Studio One actually executes the extension.
- **Full bridge** (original `main.js`): WebSocket server on port 7890, command routing. Only usable if Stage 1 confirms execution and `Host.WebSocket.createServer` is available.

Install path (Windows): `%USERPROFILE%\Documents\Studio One\Extensions\FornixMCPBridge\`

## Production package system

`fornix_generate_production_package` generates a file-first structured package under `<workspace>/Fornix/<track-slug>/` with seven document families (Metadata, Project Plan, Routing, Automation, Mix, Sound Design, Checklists). Entirely independent of the Studio One bridge. Selective regeneration and preview/planning tools operate on existing packages without full rewrites.

## Key constraints

- `s1BridgeEnabled` defaults to `false`. Do not enable it in config unless Stage 1 smoke test has confirmed extension execution.
- All file tool ops go through `guardPath` — paths outside `allowedDirs` throw.
- `CHARACTER_LIMIT = 12_000` and `FILE_READ_LINE_LIMIT = 500` (constants.ts) cap tool output.
- Tool registration is wrapped in `instrumentToolRegistration` which increments `_toolCallCount` for the dashboard — don't bypass this wrapper when adding new tools.
- Tests expose internal bridge state via `__resetBridgeStateForTests`, `__setSocketFactoryForTests`, `__setBridgeTimeoutForTests` (exported from `bridge.ts` for test use only).
