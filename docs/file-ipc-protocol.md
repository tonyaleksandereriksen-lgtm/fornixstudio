# File-Based IPC Protocol — Forward Reference

> **Status: NOT IMPLEMENTABLE on Studio One 7.2.2**
>
> This document describes the file-based IPC protocol that would connect
> the Fornix MCP server to a Studio One extension for live DAW control.
> It is a forward reference — the protocol is fully designed but cannot
> be implemented until PreSonus adds file read/write APIs to the Studio
> One extension scripting engine.
>
> See `docs/studio-one-7-api-findings.md` for the complete API probe
> results that confirm this limitation.

## Protocol overview

```
MCP Server (Node.js)                    Studio One Extension (S1 scripting)
─────────────────────                   ──────────────────────────────────
 1. Write cmd/pending.json  ──────────►  Poll cmd/pending.json every 200ms
 2. Wait for response       ◄──────────  Read command, execute, write response
 3. Read rsp/<requestId>.json            Delete cmd/pending.json
 4. Delete response file
```

No WebSocket. No network. Communication is entirely through JSON files
in a shared directory that both processes can access.

## Directory structure

```
<allowedDir>/FornixIPC/
├── cmd/
│   ├── pending.json      ← current command (one at a time)
│   └── pending.lock      ← lock file prevents double-execution
└── rsp/
    └── <requestId>.json  ← response file (one per completed command)
```

## Command file schema

`cmd/pending.json`:

```json
{
  "requestId": "a1b2c3d4",
  "command": "getTransportState",
  "args": {},
  "issuedAt": "2026-04-05T17:00:00.000Z",
  "timeoutMs": 3000
}
```

| Field       | Type   | Required | Description |
|-------------|--------|----------|-------------|
| `requestId` | string | yes      | Unique ID (8-char hex or UUID) |
| `command`   | string | yes      | Command name (see supported commands) |
| `args`      | object | yes      | Command-specific arguments (empty `{}` if none) |
| `issuedAt`  | string | yes      | ISO 8601 timestamp |
| `timeoutMs` | number | yes      | Max wait time before MCP server gives up |

## Response file schema

`rsp/<requestId>.json`:

```json
{
  "requestId": "a1b2c3d4",
  "ok": true,
  "result": {
    "tempo": 150,
    "timeSignature": "4/4",
    "isPlaying": false,
    "positionBars": 1,
    "positionSeconds": 0
  },
  "error": null,
  "respondedAt": "2026-04-05T17:00:00.150Z"
}
```

| Field         | Type         | Required | Description |
|---------------|--------------|----------|-------------|
| `requestId`   | string       | yes      | Must match the command's requestId |
| `ok`          | boolean      | yes      | `true` if command succeeded |
| `result`      | object       | yes      | Command-specific result (empty `{}` on error) |
| `error`       | string/null  | yes      | Error message if `ok` is false, null otherwise |
| `respondedAt` | string       | yes      | ISO 8601 timestamp |

## Extension behavior

1. On startup: check if `cmd/` and `rsp/` directories exist, create if needed
2. Poll `cmd/pending.json` every 200ms using `Host.IO.File(path).exists()`
3. On detection:
   a. Write `cmd/pending.lock` (prevents re-read on slow cycles)
   b. Read `cmd/pending.json` and parse as JSON
   c. Execute the command via the appropriate Host API
   d. Write `rsp/<requestId>.json` with the result
   e. Delete `cmd/pending.json`
   f. Delete `cmd/pending.lock`
4. If execution throws: write error response, then clean up command file
5. If command file is older than its `timeoutMs`: delete it, skip execution

## MCP server behavior

1. On startup:
   - Ensure `FornixIPC/cmd/` and `FornixIPC/rsp/` directories exist
   - Delete any stale `cmd/pending.json` (leftover from previous session)
2. To send a command:
   a. Generate a unique `requestId`
   b. Write `cmd/pending.json` with the command
   c. Watch `rsp/` directory using chokidar (already a project dependency)
   d. On `rsp/<requestId>.json` appearing: read, parse, resolve promise
   e. On timeout (default 3s): reject with `COMMAND_TIMEOUT`, clean up
3. Concurrency: one pending command at a time. Queue additional commands.
4. On shutdown: clean up any pending command file.

## Supported commands (initial set)

| Command              | Args    | Result |
|----------------------|---------|--------|
| `ping`               | `{}`    | `{ pong: true, timestamp: string }` |
| `getCapabilities`    | `{}`    | `{ commands: string[] }` |
| `getTransportState`  | `{}`    | `{ tempo, timeSignature, isPlaying, positionBars, positionSeconds }` |
| `getSongMetadata`    | `{}`    | `{ title, path, trackCount, tempo }` |
| `setTempo`           | `{ bpm: number }` | `{ previousTempo, newTempo }` |

## Edge cases

### Studio One not running
MCP server writes command file, waits for timeout, receives no response.
Returns `COMMAND_TIMEOUT` to the MCP tool caller with a message explaining
that Studio One does not appear to be responding.

### Extension not loaded
Same as "not running" — no one is polling the command directory.
The `s1_probe_runtime` tool can distinguish this from a slow response
by checking for the extension's startup marker.

### Stale command files on startup
Both the MCP server and the extension check for and delete stale
`pending.json` on initialization. A command file is stale if:
- Its `issuedAt` timestamp is older than 30 seconds
- OR the MCP server is starting fresh (no prior session state)

### Response directory missing
MCP server creates `FornixIPC/cmd/` and `FornixIPC/rsp/` on startup
if they don't exist. The extension also creates them on startup.

### Double execution (slow poll cycle)
The `pending.lock` file prevents this. The extension checks for the lock
before reading the command. If the lock exists, it skips the poll cycle.

### Large responses
Responses are capped at 12,000 characters (matching the existing
`CHARACTER_LIMIT` constant). The extension truncates oversized results
and sets a `truncated: true` flag in the response.

## Implementation files (when viable)

```
src/services/ipc-bridge.ts          — IpcBridge class
src/services/bridge.ts              — Add ipc transport option
studio-one-extension/scripts/main.js — Add IPC polling loop

tests/ipc/ipc-bridge.test.js        — Command/response lifecycle
tests/ipc/ipc-protocol.test.js      — Schema validation
```

## What blocks implementation

Studio One 7.2.2 extension scripting engine provides `Host.IO.File` with
only `exists()`, `remove()`, and `rename()`. There are **zero** read or
write methods. The extension cannot:

- Read `cmd/pending.json` to receive commands
- Write `rsp/<requestId>.json` to send responses
- Write `cmd/pending.lock` to prevent double-execution

Until PreSonus adds file read/write capabilities to the extension API,
this protocol remains a forward reference only. The minimum viable
addition would be:

```
Host.IO.File(path).readText()   → string
Host.IO.File(path).writeText(content: string) → void
```

With just these two methods, the entire protocol becomes implementable.
