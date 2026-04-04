# Studio One 7 Extension API Findings

Verified 2026-04-04 against Studio One 7.2.2.107056 (Win x64).

## Methodology

A diagnostic extension (`com.fornix.mcp-bridge`) was deployed as an
IComponent/FrameworkService via the standard `.package` format. Host APIs
were probed by name (properties are not enumerable on the native C++ Host
object). Results were read from `Host.Console.writeLine` output and
intentional `throw new Error()` dialogs.

## Available APIs

| API                                  | Type     | Notes |
|--------------------------------------|----------|-------|
| `Host.Console`                       | object   |       |
| `Host.Console.writeLine`             | function | Primary logging mechanism |
| `Host.IO`                            | object   |       |
| `Host.IO.File`                       | function | Factory: `Host.IO.File(path)` returns a file reference |
| `Host.IO.File().exists`              | function |       |
| `Host.IO.File().remove`              | function |       |
| `Host.IO.File().rename`              | function |       |
| `Host.IO.File().path`                | object   |       |
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
| `Host.GUI.Commands`                  | object   |       |
| `Host.GUI.Commands.interpretCommand` | function |       |
| `Host.GUI.Commands.deferCommand`     | function |       |
| `Host.Signals`                       | object   |       |
| `Host.Signals.signal`                | function |       |
| `Host.Url`                           | function | Factory (not constructor): `Host.Url(path)` returns URL object |
| `Host.Url().toString`                | function |       |
| `Host.Url().extension`               | string   | e.g. `"json"` |
| `Host.Classes`                       | object   |       |

### Globals

| Name           | Type     |
|----------------|----------|
| `CCL`          | function |
| `include_file` | function |
| `__init`       | function |

## Confirmed absent

| API              | Consequence |
|------------------|-------------|
| `Host.FileSystem` | No file writing or reading from extensions |
| `Host.WebSocket`  | No WebSocket server or client — bridge is impossible |
| `Host.Network`    | No network access |
| `Host.Http`       | No HTTP requests |
| `XMLHttpRequest`  | Not available |
| `fetch`           | Not available |
| `require`         | Not a Node.js environment |
| `ActiveXObject`   | Not available |

## Conclusions

1. **File I/O is read-metadata-only.** `Host.IO.File` can check existence,
   remove, and rename files, but cannot open, read, write, or create them.
   Marker file writing from inside the extension is impossible.

2. **WebSocket bridge is impossible.** `Host.WebSocket` does not exist.
   The bridge architecture (`src/services/bridge.ts`) is correct but
   permanently dormant on Studio One 7.

3. **The extension does execute.** IComponent `createInstance` and
   `initialize` are called. `Host.Console.writeLine` produces visible
   output. Stage 1 is proven.

4. **File-first is the only viable mode.** `packageMode` stays
   `"file_first"` for Studio One 7. Live DAW control would require
   PreSonus to add WebSocket or file-write APIs in a future version.

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
