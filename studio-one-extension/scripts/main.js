/* Fornix MCP Bridge - Stage 1b diagnostic
 *
 * Evidence levels:
 *   level-0 : top-level file evaluation (runs at parse/eval time)
 *   level-1 : createInstance() called by Studio One
 *   level-2 : initialize() called on the returned object
 *
 * Write targets (tried in order, first success wins per level):
 *   C:/Users/Tony Eriksen/Documents/FornixMCP/logs/
 *   C:/Users/Tony Eriksen/AppData/Local/Temp/FornixMCP/logs/
 *
 * No modern JS syntax. No assumptions about Host availability.
 */

// Load Studio One's built-in CCL SDK (defines __init, Host setup, etc.)
// Wrapped so a missing SDK doesn't abort file evaluation.
try { include_file("resource://{main}/sdk/cclapp.js"); } catch (e) {}

var FORNIX_WRITE_DIRS = [
  "C:/Users/Tony Eriksen/Documents/FornixMCP",
  "C:/Users/Tony Eriksen/AppData/Local/Temp/FornixMCP"
];

// ─── utilities ───────────────────────────────────────────────────────────────

function pad2(n) {
  return (n < 10 ? "0" : "") + String(n);
}

function makeTimestamp() {
  var d = new Date();
  return String(d.getFullYear()) +
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) + "-" +
    pad2(d.getHours()) +
    pad2(d.getMinutes()) +
    pad2(d.getSeconds());
}

function escapeJson(v) {
  if (v === null || v === undefined) { return ""; }
  return String(v)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function toJson(obj) {
  if (typeof JSON !== "undefined" && JSON && typeof JSON.stringify === "function") {
    try { return JSON.stringify(obj, null, 2); } catch (e) {}
  }
  // manual fallback
  var lines = ["{"];
  var keys = [];
  for (var k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) { keys.push(k); }
  }
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var val = obj[key];
    var comma = (i < keys.length - 1) ? "," : "";
    if (val === null || val === undefined) {
      lines.push('  "' + key + '": null' + comma);
    } else if (typeof val === "boolean" || typeof val === "number") {
      lines.push('  "' + key + '": ' + String(val) + comma);
    } else if (typeof val === "object" && val.join) {
      // array
      lines.push('  "' + key + '": ' + JSON.stringify(val) + comma);
    } else {
      lines.push('  "' + key + '": "' + escapeJson(val) + '"' + comma);
    }
  }
  lines.push("}");
  return lines.join("\n");
}

// ─── Host capability probe ────────────────────────────────────────────────────

function probeHost() {
  var info = {
    hostTypeof: typeof Host,
    hostTruthy: false,
    hostKeys: [],
    hasFileSystem: false,
    fsTypeof: "undefined",
    fsKeys: [],
    hasCreateDirectory: false,
    hasWriteFile: false,
    hasWriteTextFile: false,
    hasSaveTextFile: false,
    hasInterfaces: false,
    interfacesTypeof: "undefined",
    hasIComponent: false,
    hasResults: false,
    hasResultOk: false,
    hasConsole: false
  };

  try {
    if (typeof Host !== "undefined" && Host) {
      info.hostTruthy = true;
      try {
        var hkeys = [];
        for (var k in Host) { hkeys.push(k); }
        info.hostKeys = hkeys;
      } catch (e) { info.hostKeys = ["(enum-failed: " + String(e) + ")"]; }

      info.hasFileSystem = !!(Host.FileSystem);
      info.fsTypeof = typeof Host.FileSystem;
      if (Host.FileSystem) {
        try {
          var fkeys = [];
          for (var fk in Host.FileSystem) { fkeys.push(fk); }
          info.fsKeys = fkeys;
        } catch (e2) { info.fsKeys = ["(enum-failed: " + String(e2) + ")"]; }
        info.hasCreateDirectory = typeof Host.FileSystem.createDirectory === "function";
        info.hasWriteFile       = typeof Host.FileSystem.writeFile       === "function";
        info.hasWriteTextFile   = typeof Host.FileSystem.writeTextFile   === "function";
        info.hasSaveTextFile    = typeof Host.FileSystem.saveTextFile    === "function";
      }

      info.hasInterfaces     = !!(Host.Interfaces);
      info.interfacesTypeof  = typeof Host.Interfaces;
      if (Host.Interfaces) {
        info.hasIComponent = !!(Host.Interfaces.IComponent);
      }
      info.hasResults   = !!(Host.Results);
      info.hasResultOk  = !!(Host.Results && Host.Results.kResultOk !== undefined);
      info.hasConsole   = !!(Host.Console && typeof Host.Console.writeLine === "function");
    }
  } catch (e) {
    info.probeError = String(e);
  }

  return info;
}

// ─── logging ─────────────────────────────────────────────────────────────────

function logLine(msg) {
  var text = "[FornixMCPBridge] " + String(msg);
  try {
    if (typeof Host !== "undefined" && Host && Host.Console &&
        typeof Host.Console.writeLine === "function") {
      Host.Console.writeLine(text);
      return;
    }
  } catch (e) {}
  try {
    if (typeof console !== "undefined" && console &&
        typeof console.log === "function") {
      console.log(text);
    }
  } catch (e) {}
}

// ─── file writing ─────────────────────────────────────────────────────────────

function tryMkdir(path) {
  try {
    if (Host.FileSystem.createDirectory) { Host.FileSystem.createDirectory(path); return true; }
  } catch (e) {}
  try {
    if (Host.FileSystem.makeDirectory) { Host.FileSystem.makeDirectory(path); return true; }
  } catch (e) {}
  try {
    if (Host.FileSystem.ensureDirectory) { Host.FileSystem.ensureDirectory(path); return true; }
  } catch (e) {}
  return false;
}

function tryWrite(filePath, text) {
  try {
    if (typeof Host.FileSystem.writeFile === "function") {
      Host.FileSystem.writeFile(filePath, text); return true;
    }
  } catch (e) {}
  try {
    if (typeof Host.FileSystem.writeTextFile === "function") {
      Host.FileSystem.writeTextFile(filePath, text); return true;
    }
  } catch (e) {}
  try {
    if (typeof Host.FileSystem.saveTextFile === "function") {
      Host.FileSystem.saveTextFile(filePath, text); return true;
    }
  } catch (e) {}
  return false;
}

function writeMarker(level, hostProbe) {
  if (typeof Host === "undefined" || !Host || !Host.FileSystem) {
    logLine(level + " Host.FileSystem unavailable — cannot write marker");
    return { written: false, dir: null, reason: "no-filesystem" };
  }

  var ts = makeTimestamp();
  var filename = level + "-" + ts + ".json";

  for (var i = 0; i < FORNIX_WRITE_DIRS.length; i++) {
    var baseDir  = FORNIX_WRITE_DIRS[i];
    var logsDir  = baseDir + "/logs";
    var filePath = logsDir + "/" + filename;

    var rootOk = false;
    var logsOk = false;
    try { rootOk = tryMkdir(baseDir); } catch (e) {}
    try { logsOk = tryMkdir(logsDir); } catch (e) {}

    var payload = {
      level:           level,
      timestamp:       ts,
      writeDir:        logsDir,
      rootDirCreated:  rootOk,
      logsDirCreated:  logsOk,
      hostTypeof:      hostProbe.hostTypeof,
      hostTruthy:      hostProbe.hostTruthy,
      hostKeys:        hostProbe.hostKeys,
      hasFileSystem:   hostProbe.hasFileSystem,
      fsKeys:          hostProbe.fsKeys,
      hasCreateDirectory: hostProbe.hasCreateDirectory,
      hasWriteFile:    hostProbe.hasWriteFile,
      hasWriteTextFile: hostProbe.hasWriteTextFile,
      hasSaveTextFile: hostProbe.hasSaveTextFile,
      hasInterfaces:   hostProbe.hasInterfaces,
      hasIComponent:   hostProbe.hasIComponent,
      hasResults:      hostProbe.hasResults,
      hasResultOk:     hostProbe.hasResultOk,
      note:            "stage1b-diagnostic"
    };

    var ok = false;
    try { ok = tryWrite(filePath, toJson(payload)); } catch (e) {}

    logLine(level + " dir=" + logsDir + " rootOk=" + rootOk +
      " logsOk=" + logsOk + " written=" + ok + " file=" + filename);

    if (ok) {
      return { written: true, dir: logsDir, file: filename };
    }
  }

  return { written: false, dir: null, reason: "all-dirs-failed" };
}

// ─── level-0: top-level evaluation ───────────────────────────────────────────
// Runs when Studio One first evaluates this file.

logLine("file-eval begin");
var _fileEvalProbe = probeHost();
var _fileEvalResult = writeMarker("file-eval", _fileEvalProbe);
logLine("file-eval end written=" + _fileEvalResult.written);

// ─── IComponent factory ───────────────────────────────────────────────────────

function FornixMCPBridgeService() {
  // Defensive: do not assume Host.Interfaces exists
  try {
    if (typeof Host !== "undefined" && Host &&
        Host.Interfaces && Host.Interfaces.IComponent) {
      this.interfaces = [Host.Interfaces.IComponent];
    } else {
      this.interfaces = [];
    }
  } catch (e) {
    this.interfaces = [];
    logLine("constructor Host.Interfaces error: " + String(e));
  }

  this.initialize = function() {
    logLine("initialize begin");
    var probe = probeHost();
    writeMarker("startup", probe);
    logLine("initialize end");
    try {
      return Host.Results.kResultOk;
    } catch (e) {
      return 0;
    }
  };

  this.terminate = function() {
    logLine("terminate begin");
    var probe = probeHost();
    writeMarker("shutdown", probe);
    logLine("terminate end");
    try {
      return Host.Results.kResultOk;
    } catch (e) {
      return 0;
    }
  };
}

// ─── level-1: createInstance called ──────────────────────────────────────────
// Runs when Studio One instantiates this extension via the class factory.

function createInstance(args) {
  // Initialize package identifier (CCL SDK pattern; __init defined by cclapp.js)
  try { if (typeof __init === "function") { __init(args); } } catch (e) {}

  logLine("createInstance begin");
  var probe = probeHost();
  writeMarker("create-instance", probe);
  logLine("createInstance end");
  return new FornixMCPBridgeService();
}
