# Fornix Studio MCP

Local MCP server for project/workspace tooling, hardstyle production helpers, and an **optional experimental** Studio One bridge.

## Current status

- **MCP server:** usable
- **Dashboard/status server:** usable
- **Workspace/file/git/project tools:** usable
- **Hardstyle/session/fallback tools:** wired and usable
- **File-based production package generator:** usable
- **Selective regeneration + preview + prioritized planning + package summary:** usable
- **Studio One native bridge:** **experimental / unverified**, now with runtime probe + handshake state

The uploaded diagnostics do **not** show the Fornix extension as loaded inside Studio One, and the repo files do not prove that the current `manifest.json` format is a valid Studio One extension manifest. Treat live DAW control as optional and experimental. Use fallback workflows first.

## Architecture

```text
Claude / MCP client
  ↓ stdio
fornix-studio-mcp (TypeScript / Node.js)
  ├── Filesystem tools
  ├── Git checkpoint tools
  ├── Project/build tools
  ├── Hardstyle/session helpers
  ├── File-based Studio One fallback tools
  └── Optional experimental Studio One bridge
        ├── WebSocket socket connection
        ├── runtime probe handshake (ping + getCapabilities)
        └── ready only after handshake success
              ↓ ws://127.0.0.1:7890
            studio-one-extension/main.js
```

## Tool families

- Filesystem
- Git
- Project
- Sound Design
- Session
- Studio One Transport
- Studio One Tracks
- Studio One Plugins
- Studio One MIDI
- Studio One Arrangement
- Studio One Automation
- Studio One Fallback
- Production Package
- Mix

## What is strong right now

- Standardized file-based production package generation for Package Metadata, Project Plan, Routing Sheet, Automation Blueprint, Mix Report, Sound Design Pack, and Producer Checklist
- Read-only preview and prioritized update planning for existing Fornix packages before any rewrite
- Selective regeneration of one package document family at a time from an existing package
- Read-only package summary/introspection for existing Fornix packages
- Hardstyle-specific package content tailored for cinematic intros, anti-climax planning, euphoric/screech lead work, and actionable mix fixes

## Bridge runtime model

The native Studio One bridge now has an explicit runtime state model:

- `disconnected`
- `connecting`
- `connected`
- `ready`
- `degraded`
- `error`

Important: **`connected` does not mean verified**. The Node bridge now sends `ping` and `getCapabilities` first. Only after both succeed does the bridge move to `ready`.

The extension now exposes shallow probe commands:

- `ping`
- `getHostInfo`
- `getCapabilities`
- `runSelfTest`

These probes are defensive and are intended for runtime visibility, not feature expansion.

- Workspace-safe file reads/writes/patches
- Git checkpoints and restore flows
- Build/test/typecheck tools
- Hardstyle track/bus/session planning
- Arrangement and MIDI planning helpers
- File-based instruction export for manual DAW handoff
- Local dashboard at `http://localhost:7891`
- Truthful bridge state, handshake state, and last reported capabilities via status API/dashboard

## What is not proven

- That Studio One will accept the current `studio-one-extension/manifest.json` format
- That `Host.WebSocket.createServer` is exposed by Studio One's scripting engine
- That `Host.FileSystem.writeFile` is available (it is guarded; failure is silent)
- That the extension is discovered and loaded from the documented directory
- That port `7890` is opened by Studio One in a real session
- The startup marker mechanism is the primary way to reduce these unknowns — if a marker appears, execution is confirmed; if `host.websocketServer` is `false` in the marker, the bridge cannot work via WebSocket


## File-based package workflow

Generated packages use this structure:

```text
Fornix/<track-slug>/
  00_Metadata/Package_Metadata.json
  01_Project_Plan/Project_Plan.md
  02_Routing/Routing_Sheet.md
  03_Automation/Automation_Blueprint.md
  04_Mix/Mix_Report.md
  05_Sound_Design/Sound_Design_Pack.md
  06_Checklists/Producer_Checklist.md
```

The package system is file-first. It can now:

- generate the full package from a track brief
- read an existing package and summarize its current state
- preview which sections would likely change from revised profile inputs without writing files
- plan which sections should be updated first, ranked as primary, secondary, or optional
- regenerate one selected document family at a time while preserving untouched files
- update package metadata timestamps and revision fields without claiming any live Studio One control
- track package-level `resolvedProfile` plus per-section `sectionResolvedProfiles` so selective regeneration can stay honest when a section’s rendered profile differs from the package identity
- surface package completeness, section override state, and a short consistency/health summary in summary, preview, and planning tool output

## Setup

### 1. Install

```bash
npm install
npm run build
```

### 2. Configure the workspace

A safe default `fornix-mcp.config.json` is included:

```json
{
  "allowedDirs": ["."],
  "readOnlyDirs": [],
  "dryRunByDefault": false,
  "gitRoot": ".",
  "s1BridgeEnabled": false
}
```

Enable `s1BridgeEnabled` only after you have verified that Studio One actually loads the extension.

### 3. Run

```bash
npm start
```

### 4. Optional: Studio One bridge

The bridge files live in `studio-one-extension/`, but this repo does **not** currently prove that the extension manifest and loading model are valid for Studio One. Keep this path experimental.

Even if a socket connects, the MCP side will not report the bridge as ready until the extension answers both runtime probe commands:

- `ping`
- `getCapabilities`

Use `s1_probe_runtime` or the dashboard/status API to inspect the current bridge truthfully.

#### 4a. Installing the extension

Studio One looks for script extensions in a specific directory. Copy the **entire `studio-one-extension/` folder** into one of these locations and restart Studio One:

**Windows (most common):**
```
%USERPROFILE%\Documents\Studio One\Extensions\FornixMCPBridge\
```
Result: `...\Extensions\FornixMCPBridge\manifest.json` and `main.js`

**If `Extensions` does not work, try:**
```
%USERPROFILE%\Documents\Studio One\Scripts\FornixMCPBridge\
```

> The exact directory depends on Studio One version and platform. If neither location causes the extension to load, open Studio One's Extension/Script Manager (if available) and check which directory it scans.

#### 4b. Verifying the extension actually ran

The extension writes a startup marker file to `Documents\FornixMCP\logs\` during `activate()`. This happens **before** any WebSocket setup and is completely independent of bridge connectivity.

**Option A — use the MCP tool (after starting the server):**
```
s1_read_extension_log
```
This tells you whether a marker exists, when the extension last ran, and whether `Host.WebSocket.createServer` was available.

**Option B — use the setup validator:**
```bash
node validate-setup.mjs
```
The "Extension Runtime Evidence" section reports startup markers and key capability flags.

**Option C — check manually:**
```
%USERPROFILE%\Documents\FornixMCP\logs\startup-*.json
```
If this file exists, Studio One executed the extension. Open it and check `host.websocketServer`:
- `true` → WebSocket server API is available; bridge may work
- `false` → `Host.WebSocket.createServer` is unavailable; port 7890 will never open; use file-based fallback only

**If no startup marker exists after restarting Studio One:**
1. The extension is not in the correct directory
2. The extension was installed but not enabled in Studio One's settings
3. `Host.FileSystem.writeFile` is unavailable and the console log shows `[FornixMCPBridge]` lines instead — check Studio One's script/extension console

### 5. Claude Desktop

Use `claude-desktop-config.example.json` or `claude_desktop_config.example.json` as a starting point and point it at `dist/index.js`.

## Standardized production package output

```text
<workspace>/Fornix/<track-slug>/
  01_Project_Plan/Project_Plan.md
  02_Routing/Routing_Sheet.md
  03_Automation/Automation_Blueprint.md
  04_Mix/Mix_Report.md
  05_Sound_Design/Sound_Design_Pack.md
  06_Checklists/Producer_Checklist.md
```

Use `fornix_generate_production_package` to generate the full package in one pass. It is file-based and does not depend on the experimental Studio One bridge.

## Recommended fallback workflow

1. Use the MCP server for file, git, project, planning, session, arrangement, and MIDI helper tools.
2. Use `s1_export_instruction` for structured manual handoff files.
3. Use `s1_generate_track_plan`, `s1_generate_bus_template`, and `s1_export_arrangement_plan` to prepare session structure outside the DAW.
4. Treat live Studio One control as an extra, not a requirement.

## Validation

```bash
npm run check
npm run build
npm run test
node validate-setup.mjs
```

## Troubleshooting

- If the dashboard opens but Studio One is disconnected, the MCP server is still usable.
- If the dashboard shows `connected` but not `ready`, the socket exists but the runtime is still unverified.
- If port `7890` is closed, use fallback tools.
- If Studio One diagnostics do not list the extension, do not assume the bridge is running.
- If you need deterministic behaviour today, stay on the fallback workflow.
