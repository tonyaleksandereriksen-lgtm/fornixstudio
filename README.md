# Fornix Studio MCP

> AI-assisted production environment – Hardstyle / Trance  
> Gives Claude live, safe, logged control over your project workspace **and** PreSonus Studio One 7.

---

## Architecture

```
Claude (conversation)
      ↓  MCP protocol (stdio)
fornix-studio-mcp  (Node.js / TypeScript)
      ├── Filesystem tools   read/write/patch/search/move
      ├── Git tools          checkpoint/diff/restore/revert
      ├── Project tools      build/test/lint/typecheck/log
      └── Studio One tools   tracks/tempo/plugins/sends/macros
                ↓  WebSocket  ws://127.0.0.1:7890
      Studio One Extension (main.js – runs inside S1)
                ↓  PreSonus JS Extensions API
      Studio One Professional 7
```

All writes are logged. Every destructive action has dry-run mode. Git checkpoints allow full rollback.

---

## Feasibility Audit

| Capability | Category | Status |
|---|---|---|
| File read / write / patch / search | A – Direct | ✅ |
| Git checkpoint & rollback | A – Direct | ✅ |
| Build / test / lint / typecheck | A – Shell | ✅ |
| Transport: tempo, loop, position | A – S1 Extensions API | ✅ |
| Track: create / rename / mute / solo / volume | A – S1 Extensions API | ✅ |
| FX Send routing | A – S1 Extensions API | ✅ |
| Plugin insert + parameter control | B – Name-match bridge | ✅ (best-effort) |
| Preset loading | B – Indirect | ✅ |
| Macro triggering | A – S1 Macro Organizer | ✅ |
| Offline instruction files | B – File polling | ✅ |
| MIDI note insertion | B – Timing-sensitive | ⚠️ Phase 4 |
| Real-time audio routing graph | C – No public API | ❌ Deferred |
| Plugin GUI automation | C – Unreliable | ❌ Deferred |

---

## Setup

### 1. Install MCP Server

```bash
cd fornix-studio-mcp
npm install
npm run build
```

### 2. Create Workspace Config

Create `fornix-mcp.config.json` in your project root:

```json
{
  "allowedDirs": ["C:/Users/Fornix/Projects/fornix-hardstyle"],
  "readOnlyDirs": [],
  "dryRunByDefault": false,
  "gitRoot": "C:/Users/Fornix/Projects/fornix-hardstyle",
  "s1BridgeEnabled": true
}
```

### 3. Install Studio One Extension

**Windows:**
```
%AppData%\PreSonus\Studio One 7\Extensions\FornixMCPBridge\
```
Copy both `main.js` and `manifest.json` there.

**macOS:**
```
~/Library/Application Support/PreSonus/Studio One 7/Extensions/FornixMCPBridge/
```

In Studio One → Extensions → Enable → FornixMCPBridge. Restart S1.

### 4. Connect to Claude Desktop

`claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "fornix-studio": {
      "command": "node",
      "args": ["C:/path/to/fornix-studio-mcp/dist/index.js"],
      "env": {
        "WORKSPACE_ROOT": "C:/Users/Fornix/Projects/fornix-hardstyle"
      }
    }
  }
}
```

### 5. Initialise Git

```bash
cd your-project-folder
git init && git add -A && git commit -m "Initial state"
```

---

## Example Prompts

```
"Set tempo to 150 BPM, create a bus called 'LEAD' with colour #FF6600,
 then add FabFilter Pro-R 2 to it"

"Create a git checkpoint called 'before-mix-pass', then set
 the Ozone 12 Dynamics threshold on the Master bus to -8 dB"

"Generate the Fornix standard bus template and export it to
 my project/s1-instructions folder"

"Query the song metadata and tell me what tracks I have
 and what plugins are on the Master bus"

"Mute all tracks except the Kick & Bass bus"

"Revert the workspace to the last checkpoint –
 something went wrong with the plugin settings"
```

---

## Tool Families (36 tools total)

| Family | Tools | Key capability |
|---|---|---|
| Filesystem | 6 | read/write/patch/list/search/move |
| Git | 6 | status/diff/checkpoint/list/restore/revert |
| Project | 6 | inspect/build/test/lint/typecheck/log |
| S1 Transport | 5 | transport/tempo/loop/metadata/status |
| S1 Tracks | 6 | create/rename/mute/solo/volume/send |
| S1 Plugins | 5 | add/params/set-param/preset/macro |
| S1 Fallback | 3 | export-instruction/track-plan/bus-template |

---

## Safety

- **Workspace allowlist** – AI can only touch files in `allowedDirs`
- **Dry-run mode** – All write tools support preview without committing
- **Git checkpoints** – Rollback any change set instantly
- **Action log** – Every AI action written to `.fornix-mcp.log`
- **Destructive guard** – Hard revert requires explicit confirmation string

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Bridge not connecting | Open Studio One + enable FornixMCPBridge extension, check port 7890 |
| "Track not found" | Names are case-sensitive – run `s1_query_song_metadata` first |
| Plugin not found | Use exact name from S1 browser e.g. "FabFilter Pro-L 2" |
| Git tools failing | Run `git init` in project root, set `gitRoot` in config |
