# Fornix Studio MCP

MCP server for Fornix — hardstyle production workspace tooling with file-based Studio One integration.

## Quick start

```bash
npm install
npm run build
npm start          # stdio MCP server
```

Dashboard: `http://localhost:7891`

## Tool families (92 tools, 19 families)

| Family | Tools | Status |
|--------|-------|--------|
| Filesystem | fs_read_file, fs_write_file, fs_patch_file, fs_list_tree, fs_search_code, fs_move_file | Working |
| Git | git_status, git_diff, git_commit_checkpoint, git_list_checkpoints, git_restore_file, git_revert_checkpoint | Working |
| Project | project_inspect_structure, project_run_build, project_run_tests, project_lint, project_typecheck, project_read_action_log | Working |
| Production Package | generate, preview, plan, regenerate, summary, batch regen, mix actions | Working |
| Workspace | create, summary, add track, generate packages, template, consistency, remove, update | Working |
| Template Library | fornix_list_templates, fornix_get_template | Working |
| Session | session_kickstart, session_apply_mix_preset, session_health_check, session_list_mix_presets | Working |
| Sound Design | sd_describe_patch, sd_generate_hardstyle_lead | Working |
| Song Watcher | s1_watch_session, s1_session_snapshot, s1_session_diff, s1_stop_watching | Working |
| Arrangement Analysis | fornix_analyze_arrangement | Working |
| S1 Fallback | s1_export_instruction, s1_generate_track_plan, s1_generate_bus_template | Working |
| MCU Bridge | mcu_list_ports, mcu_connect, mcu_state, mcu_transport, mcu_fader, mcu_solo, mcu_mute, mcu_bank, mcu_save, mcu_undo | Blocked (Win11 25H2 MIDI) |
| S1 Transport/Tracks/Plugins/MIDI/Arrangement/Automation | 27 live DAW tools | Blocked (bridge disabled) |

## Architecture

```
Claude / MCP client
  ↓ stdio
src/index.ts   (McpServer, StdioServerTransport)
  ├── src/services/workspace.ts       path guard, allowedDirs, config
  ├── src/services/logger.ts          action log
  ├── src/services/checkpoint.ts      git checkpoints (simple-git)
  ├── src/services/bridge.ts          WebSocket bridge (dormant on S1 7)
  ├── src/services/status-server.ts   HTTP dashboard on port 7891
  ├── src/services/song-watcher.ts    chokidar .song/.autosave watcher
  ├── src/services/mcu-bridge.ts      MCU protocol via virtual MIDI
  ├── src/services/mcu-protocol.ts    MCU message parser/builder
  ├── src/services/song-file.ts       .song ZIP/XML parser
  ├── src/services/arrangement.ts     arrangement analysis engine
  └── src/tools/                      MCP tool registration
```

## Song watcher

Watches Studio One project directories for `.song` and `.song.autosave` file changes. On each save, re-parses the file and diffs against the previous snapshot.

```
s1_watch_session  → start watching a directory or .song file
s1_session_snapshot → get latest parsed state (tempo, tracks, markers, analysis)
s1_session_diff   → show what changed between saves
s1_stop_watching  → stop the watcher
```

## Production packages

File-first structured packages under `Fornix/<track-slug>/` with 7 document families:
Metadata, Project Plan, Routing, Automation, Mix, Sound Design, Checklists.

5 pre-built hardstyle templates: euphoric, raw, cinematic, festival, hybrid.

## Configuration

`fornix-mcp.config.json` at project root:

```json
{
  "allowedDirs": [".", "C:\\Users\\...\\Studio One\\Songs"],
  "readOnlyDirs": ["C:\\Users\\...\\Studio One\\Songs"],
  "dryRunByDefault": false,
  "gitRoot": ".",
  "s1BridgeEnabled": false
}
```

## Commands

```bash
npm run build          # tsc → dist/
npm run check          # tsc --noEmit
npm run lint           # eslint src/
npm test               # build + all tests
npm start              # node dist/index.js
```

## Known limitations

- **S1 WebSocket bridge**: dormant. `Host.WebSocket` does not exist in S1 7.2.2.
- **MCU bridge**: code ready, blocked by Windows 11 25H2 WinMM not surfacing virtual MIDI ports.
- **Bridge-gated tools**: 27 S1 live tools are only registered when `s1BridgeEnabled: true`.
