# Studio One 7 Extension API Findings

Verified 2026-04-04 through 2026-04-05 against Studio One 7.2.2.107056 (Win x64).

## Methodology

A diagnostic extension (`com.fornix.mcp-bridge`) was deployed as an
IComponent/FrameworkService via the standard `.package` format. Host APIs
were probed across 5 extension versions (v9–v24) using progressively
crash-safe strategies. Key learnings about the scripting engine:

- Properties on native C++ objects are **non-enumerable** (`for-in` finds nothing)
- `Object.getPrototypeOf` on native objects causes **fatal unrecoverable crashes**
- `Object.getOwnPropertyNames` on native objects causes fatal crashes
- Bracket notation (`Host.IO[name]`) for non-existent props causes fatal crashes
- `eval()` causes fatal crashes
- `typeof obj.prop` with direct property names works safely (even for non-existent props)
- All safe probes require individual `try/catch` per property check

## Available APIs

| API                                  | Type     | Notes |
|--------------------------------------|----------|-------|
| `Host.Console`                       | object   |       |
| `Host.Console.writeLine`             | function | Primary logging mechanism |
| `Host.IO`                            | object   | No enumerable keys |
| `Host.IO.File`                       | function | **Factory** (NOT constructor): `Host.IO.File(path)` |
| `Host.IO.File().exists`              | function |       |
| `Host.IO.File().remove`              | function |       |
| `Host.IO.File().rename`              | function |       |
| `Host.IO.File().path`                | object   | Sub-object with toString() |
| `Host.IO.File().toString`            | function |       |
| `Host.Interfaces`                    | object   |       |
| `Host.Interfaces.IComponent`         | object   | Required for FrameworkService extensions |
| `Host.Interfaces.IObserver`          | object   |       |
| `Host.Results`                       | object   |       |
| `Host.Results.kResultOk`             | number   |       |
| `Host.Results.kResultFalse`          | number   |       |
| `Host.FileTypes`                     | object   |       |
| `Host.FileTypes.registerHandler`     | function |       |
| `Host.GUI`                           | object   |       |
| `Host.GUI.Commands`                  | object   | No enumerable keys |
| `Host.GUI.Commands.interpretCommand` | function | Executes S1 command, returns number (0) |
| `Host.GUI.Commands.deferCommand`     | function |       |
| `Host.GUI.Commands.registerCommand`  | function | Can register custom commands |
| `Host.Signals`                       | object   |       |
| `Host.Signals.signal`                | function |       |
| `Host.Url`                           | function | Factory: `Host.Url(path)` returns URL object |
| `Host.Url().toString`                | function |       |
| `Host.Url().extension`               | string   | e.g. `"json"` |
| `Host.Classes`                       | object   | No enumerable keys |
| `CCL`                                | function | SDK framework |
| `CCL.JS`                             | function | JavaScript utilities module |
| `CCL.JS.getApplication`              | function | Returns opaque app object (no accessible methods) |
| `CCL.JS.getWindowManager`            | function | Returns opaque wm object (no accessible methods) |
| `CCL.JS.EndLine`                     | function |       |
| `CCL.JS.ResourceUrl`                 | function |       |
| `CCL.JS.LegalFileName`              | function | Sanitizes filenames |
| `CCL.JS.Columns`                     | object   | UI column definitions |
| `CCL.JS.kChanged`                    | string   | Event constant |
| `CCL.JS.kExtendMenu`                | string   | Event constant |
| `CCL.JS.kRequestFocus`              | string   | Event constant |
| `CCL.JS.kSelectionChanged`          | string   | Event constant |
| `CCL.JS.kItemOpened`                | string   | Event constant |
| `CCL.JS.kItemFocused`               | string   | Event constant |
| `CCL.JS.kEditItemCell`              | string   | Event constant |
| `CCL.JS.kCommandSelected`           | string   | Event constant |

### Globals

| Name           | Type     |
|----------------|----------|
| `CCL`          | function |
| `include_file` | function |
| `__init`       | function |

## Confirmed absent

### Host.IO.File — read methods (ALL undefined)

`read`, `readText`, `readAllText`, `readAll`, `readLine`, `readLines`,
`getText`, `getContent`, `load`, `loadText`, `open`, `text`, `content`, `data`

### Host.IO.File — write methods (ALL undefined)

`write`, `writeText`, `writeAllText`, `writeAll`, `writeLine`,
`setText`, `setContent`, `save`, `saveText`, `create`, `append`

### Host.IO siblings (ALL undefined)

`Directory`, `Path`, `Stream`, `TextFile`, `BinaryFile`, `DataStream`,
`TextStream`, `InputStream`, `OutputStream`, `FileStream`, `Reader`,
`Writer`, `StreamReader`, `StreamWriter`, `FileReader`, `FileWriter`,
`BufferedReader`, `BufferedWriter`, `Encoding`, `FileMode`, `FileAccess`,
`createFile`, `openFile`, `readFile`, `writeFile`, `copyFile`,
`createDirectory`, `listFiles`

### CCL.JS.getApplication() — all methods (ALL undefined)

`getDocument`, `getActiveDocument`, `getSong`, `getActiveSong`,
`getProject`, `getActiveProject`, `documents`, `song`, `project`,
`openFile`, `saveFile`, `readFile`, `writeFile`, `exportFile`,
`getPath`, `getUserPath`, `getDataPath`, `getTransport`, `getMixer`,
`getTracks`, `getMarkers`, `tempo`, `sampleRate`, `executeCommand`,
`sendCommand`, `runMacro`, `notify`, `getContext`, `getHost`,
`getServices`, `getExtension`

### Host top-level (ALL undefined)

`Host.Application`, `Host.Document`, `Host.Editor`, `Host.Preferences`,
`Host.Environment`, `Host.System`, `Host.Storage`, `Host.Scripting`,
`Host.Network`, `Host.WebSocket`, `Host.FileSystem`, `Host.Process`,
`Host.Shell`, `Host.Timer`, `Host.Clipboard`

## interpretCommand behavior

`Host.GUI.Commands.interpretCommand(commandString)` executes Studio One
UI commands and returns a numeric status code (observed: 0 for all tested).
Tested commands: `Transport/Tempo`, `View/Console`, `Edit/Select All`,
`Song/Song Information`. This triggers UI actions but cannot return data.

## Conclusions

1. **File read/write is impossible.** `Host.IO.File` can check existence,
   remove, and rename files. It has zero read or write methods. No sibling
   classes exist in `Host.IO`. No static file functions exist. No global
   file functions exist.

2. **Song/document access is impossible from extensions.** `CCL.JS.getApplication()`
   returns an opaque object with no accessible document, song, transport,
   or mixer APIs. The app object has no enumerable keys and all probed
   method names return undefined.

3. **WebSocket bridge is impossible.** `Host.WebSocket` does not exist.

4. **Network access is impossible.** `Host.Network`, `Host.Http`,
   `XMLHttpRequest`, `fetch` — all absent.

5. **File-based IPC is impossible.** Without file read or write, the
   extension cannot participate in any file-based communication protocol.
   It can detect file existence and delete files, but cannot read commands
   or write responses.

6. **The extension does execute.** IComponent `createInstance` and
   `initialize` are called. `Host.Console.writeLine` produces visible
   output. Stage 1 is proven.

7. **interpretCommand works** but is fire-and-forget (returns status code,
   not data). Could theoretically trigger export operations but cannot
   read results.

8. **File-first is the only viable mode.** `packageMode` stays
   `"file_first"` for Studio One 7. Live DAW control would require
   PreSonus to add file I/O, WebSocket, or document access APIs in a
   future version.

## What would unlock IPC

For file-based IPC to become viable, Studio One would need to add ANY of:
- `Host.IO.File().read()` / `Host.IO.File().write()` methods
- `Host.IO.TextFile` or `Host.IO.StreamWriter` classes
- `Host.FileSystem` with read/write support
- `Host.WebSocket` for direct socket communication
- `CCL.JS.getApplication()` methods that expose song data

## Extension install path

```
%APPDATA%\PreSonus\Studio One 7\Extensions\FornixMCPBridge\
├── installdata.xml
├── metainfo.xml
└── scripts/
    ├── classfactory.xml
    ├── fornixmcp.package   (zip containing classfactory.xml, metainfo.xml, main.js)
    ├── main.js              (loose copy, Studio One loads from .package)
    └── metainfo.xml
```

Studio One loads scripts from inside the `.package` zip, not from loose
files in the `scripts/` directory.
