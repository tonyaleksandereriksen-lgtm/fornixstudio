/* Fornix MCP Bridge — Studio One 7 Extension (Stage 3e Final Probe)
 *
 * CONFIRMED from Stage 3d:
 *   - Host.IO.File: exists/remove/rename/path/toString ONLY
 *   - ALL read methods: undefined (14 checked)
 *   - ALL write methods: undefined (11 checked)
 *   - ALL Host.IO siblings: undefined
 *   - CCL.JS has rich API: getApplication, getWindowManager, etc.
 *
 * Stage 3e PURPOSE: Deep probe CCL.JS.getApplication() and
 *   CCL.JS.getWindowManager() — last possible path to file I/O
 *   or song/document access from inside the extension.
 *
 * Format: IComponent / FrameworkService (createInstance -> initialize).
 * NO modern JS: no const/let, no arrow functions, no template literals.
 */

include_file("resource://{main}/sdk/cclapp.js");

var PROBE_VERSION = 24;

function log(msg) {
  Host.Console.writeLine("[FornixMCPBridge] " + msg);
}

function safeEnum(obj, label) {
  var keys = [];
  try {
    for (var k in obj) {
      keys.push(k);
    }
  } catch (e) {
    log("  " + label + " — cannot enumerate: " + e);
    return;
  }
  if (keys.length === 0) {
    log("  " + label + " — no enumerable keys");
  } else {
    log("  " + label + " — " + keys.length + " keys:");
    for (var i = 0; i < keys.length; i++) {
      try {
        var val = obj[keys[i]];
        log("    ." + keys[i] + " = " + typeof val);
      } catch (e2) {
        log("    ." + keys[i] + " — error");
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROBE 1: CCL.JS.getApplication() — deep scan
// ═══════════════════════════════════════════════════════════════════════════

function probe1_getApplication() {
  log("=== PROBE 1: CCL.JS.getApplication() ===");

  var app;
  try {
    app = CCL.JS.getApplication();
    log("getApplication() = " + typeof app + " (" + app + ")");
  } catch (e) {
    log("getApplication() error: " + e);
    return;
  }

  if (!app) { log("app is null/undefined"); return; }

  // Enumerate all properties
  safeEnum(app, "app");

  // Check for document/song/file methods
  log("--- app: document/song APIs ---");
  try { log("  app.getDocument = " + typeof app.getDocument); } catch (e) { log("  — crash"); }
  try { log("  app.getActiveDocument = " + typeof app.getActiveDocument); } catch (e) { log("  — crash"); }
  try { log("  app.getSong = " + typeof app.getSong); } catch (e) { log("  — crash"); }
  try { log("  app.getActiveSong = " + typeof app.getActiveSong); } catch (e) { log("  — crash"); }
  try { log("  app.getProject = " + typeof app.getProject); } catch (e) { log("  — crash"); }
  try { log("  app.getActiveProject = " + typeof app.getActiveProject); } catch (e) { log("  — crash"); }
  try { log("  app.documents = " + typeof app.documents); } catch (e) { log("  — crash"); }
  try { log("  app.song = " + typeof app.song); } catch (e) { log("  — crash"); }
  try { log("  app.project = " + typeof app.project); } catch (e) { log("  — crash"); }

  // Check for file/IO methods
  log("--- app: file/IO APIs ---");
  try { log("  app.openFile = " + typeof app.openFile); } catch (e) { log("  — crash"); }
  try { log("  app.saveFile = " + typeof app.saveFile); } catch (e) { log("  — crash"); }
  try { log("  app.readFile = " + typeof app.readFile); } catch (e) { log("  — crash"); }
  try { log("  app.writeFile = " + typeof app.writeFile); } catch (e) { log("  — crash"); }
  try { log("  app.exportFile = " + typeof app.exportFile); } catch (e) { log("  — crash"); }
  try { log("  app.getPath = " + typeof app.getPath); } catch (e) { log("  — crash"); }
  try { log("  app.getUserPath = " + typeof app.getUserPath); } catch (e) { log("  — crash"); }
  try { log("  app.getDataPath = " + typeof app.getDataPath); } catch (e) { log("  — crash"); }

  // Check for transport/mixer/track methods
  log("--- app: transport/mixer ---");
  try { log("  app.getTransport = " + typeof app.getTransport); } catch (e) { log("  — crash"); }
  try { log("  app.getMixer = " + typeof app.getMixer); } catch (e) { log("  — crash"); }
  try { log("  app.getTracks = " + typeof app.getTracks); } catch (e) { log("  — crash"); }
  try { log("  app.getMarkers = " + typeof app.getMarkers); } catch (e) { log("  — crash"); }
  try { log("  app.tempo = " + typeof app.tempo); } catch (e) { log("  — crash"); }
  try { log("  app.sampleRate = " + typeof app.sampleRate); } catch (e) { log("  — crash"); }

  // Check for command/action methods
  log("--- app: commands/actions ---");
  try { log("  app.executeCommand = " + typeof app.executeCommand); } catch (e) { log("  — crash"); }
  try { log("  app.sendCommand = " + typeof app.sendCommand); } catch (e) { log("  — crash"); }
  try { log("  app.runMacro = " + typeof app.runMacro); } catch (e) { log("  — crash"); }
  try { log("  app.notify = " + typeof app.notify); } catch (e) { log("  — crash"); }

  // Check for extension/plugin APIs
  log("--- app: extension APIs ---");
  try { log("  app.getContext = " + typeof app.getContext); } catch (e) { log("  — crash"); }
  try { log("  app.getHost = " + typeof app.getHost); } catch (e) { log("  — crash"); }
  try { log("  app.getServices = " + typeof app.getServices); } catch (e) { log("  — crash"); }
  try { log("  app.getExtension = " + typeof app.getExtension); } catch (e) { log("  — crash"); }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROBE 2: CCL.JS.getWindowManager() — deep scan
// ═══════════════════════════════════════════════════════════════════════════

function probe2_getWindowManager() {
  log("=== PROBE 2: CCL.JS.getWindowManager() ===");

  var wm;
  try {
    wm = CCL.JS.getWindowManager();
    log("getWindowManager() = " + typeof wm + " (" + wm + ")");
  } catch (e) {
    log("getWindowManager() error: " + e);
    return;
  }

  if (!wm) { log("wm is null/undefined"); return; }

  safeEnum(wm, "wm");

  // Check for useful methods
  try { log("  wm.getWindows = " + typeof wm.getWindows); } catch (e) { log("  — crash"); }
  try { log("  wm.getActiveWindow = " + typeof wm.getActiveWindow); } catch (e) { log("  — crash"); }
  try { log("  wm.getMainWindow = " + typeof wm.getMainWindow); } catch (e) { log("  — crash"); }
  try { log("  wm.openWindow = " + typeof wm.openWindow); } catch (e) { log("  — crash"); }
  try { log("  wm.showDialog = " + typeof wm.showDialog); } catch (e) { log("  — crash"); }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROBE 3: CCL.JS remaining methods — EndLine, ResourceUrl, LegalFileName
// ═══════════════════════════════════════════════════════════════════════════

function probe3_CCLJSMethods() {
  log("=== PROBE 3: CCL.JS methods ===");

  // EndLine
  try {
    var el = CCL.JS.EndLine();
    log("  EndLine() = " + typeof el + " repr=" + JSON.stringify(el));
  } catch (e) {
    log("  EndLine() error: " + e);
  }

  // ResourceUrl
  try {
    var ru = CCL.JS.ResourceUrl("test.txt");
    log("  ResourceUrl('test.txt') = " + typeof ru + " (" + ru + ")");
  } catch (e) {
    log("  ResourceUrl() error: " + e);
  }

  // LegalFileName
  try {
    var lfn = CCL.JS.LegalFileName("test/file:name.txt");
    log("  LegalFileName('test/file:name.txt') = " + typeof lfn + " (" + lfn + ")");
  } catch (e) {
    log("  LegalFileName() error: " + e);
  }

  // Columns
  try {
    log("  Columns = " + typeof CCL.JS.Columns);
    safeEnum(CCL.JS.Columns, "Columns");
  } catch (e) {
    log("  Columns error: " + e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROBE 4: If getApplication returns an app, probe for song document
// ═══════════════════════════════════════════════════════════════════════════

function probe4_AppDocument() {
  log("=== PROBE 4: App document chain ===");

  var app;
  try { app = CCL.JS.getApplication(); } catch (e) { log("No app: " + e); return; }
  if (!app) { log("app is null"); return; }

  // If any document/song getter exists, call it and probe the result
  var doc;

  try {
    if (typeof app.getDocument === "function") {
      doc = app.getDocument();
      log("  app.getDocument() = " + typeof doc + " (" + doc + ")");
      if (doc) safeEnum(doc, "doc");
    }
  } catch (e) { log("  getDocument error: " + e); }

  try {
    if (typeof app.getActiveDocument === "function") {
      doc = app.getActiveDocument();
      log("  app.getActiveDocument() = " + typeof doc + " (" + doc + ")");
      if (doc) safeEnum(doc, "activeDoc");
    }
  } catch (e) { log("  getActiveDocument error: " + e); }

  try {
    if (typeof app.getSong === "function") {
      var song = app.getSong();
      log("  app.getSong() = " + typeof song + " (" + song + ")");
      if (song) {
        safeEnum(song, "song");
        try { log("  song.title = " + song.title); } catch (e2) { /* skip */ }
        try { log("  song.tempo = " + song.tempo); } catch (e2) { /* skip */ }
        try { log("  song.path = " + song.path); } catch (e2) { /* skip */ }
      }
    }
  } catch (e) { log("  getSong error: " + e); }

  try {
    if (typeof app.getActiveSong === "function") {
      var asong = app.getActiveSong();
      log("  app.getActiveSong() = " + typeof asong + " (" + asong + ")");
      if (asong) safeEnum(asong, "activeSong");
    }
  } catch (e) { log("  getActiveSong error: " + e); }

  // Try property access too
  try {
    if (typeof app.document !== "undefined") {
      log("  app.document = " + typeof app.document);
      if (app.document) safeEnum(app.document, "app.document");
    }
  } catch (e) { log("  app.document error: " + e); }

  try {
    if (typeof app.song !== "undefined") {
      log("  app.song = " + typeof app.song);
      if (app.song) safeEnum(app.song, "app.song");
    }
  } catch (e) { log("  app.song error: " + e); }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROBE 5: Host.GUI.Commands.interpretCommand test
// ═══════════════════════════════════════════════════════════════════════════

function probe5_Commands() {
  log("=== PROBE 5: interpretCommand tests ===");

  // Try some known S1 command strings (read-only, harmless)
  var commands = [
    "Transport/Tempo",
    "View/Console",
    "Edit/Select All",
    "Song/Song Information"
  ];

  for (var i = 0; i < commands.length; i++) {
    try {
      var result = Host.GUI.Commands.interpretCommand(commands[i]);
      log("  '" + commands[i] + "' = " + typeof result + " (" + result + ")");
    } catch (e) {
      log("  '" + commands[i] + "' error: " + e);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROBE 6: Remaining Host probes from 3c that we need to confirm
// ═══════════════════════════════════════════════════════════════════════════

function probe6_HostScan() {
  log("=== PROBE 6: Host top-level ===");

  try { log("  Host.Application = " + typeof Host.Application); } catch (e) { log("  Host.Application — crash"); }
  try { log("  Host.Document = " + typeof Host.Document); } catch (e) { log("  Host.Document — crash"); }
  try { log("  Host.Editor = " + typeof Host.Editor); } catch (e) { log("  Host.Editor — crash"); }
  try { log("  Host.Preferences = " + typeof Host.Preferences); } catch (e) { log("  Host.Preferences — crash"); }
  try { log("  Host.Environment = " + typeof Host.Environment); } catch (e) { log("  Host.Environment — crash"); }
  try { log("  Host.System = " + typeof Host.System); } catch (e) { log("  Host.System — crash"); }
  try { log("  Host.Storage = " + typeof Host.Storage); } catch (e) { log("  Host.Storage — crash"); }
  try { log("  Host.Scripting = " + typeof Host.Scripting); } catch (e) { log("  Host.Scripting — crash"); }
  try { log("  Host.Network = " + typeof Host.Network); } catch (e) { log("  Host.Network — crash"); }
  try { log("  Host.WebSocket = " + typeof Host.WebSocket); } catch (e) { log("  Host.WebSocket — crash"); }
  try { log("  Host.FileSystem = " + typeof Host.FileSystem); } catch (e) { log("  Host.FileSystem — crash"); }
  try { log("  Host.Process = " + typeof Host.Process); } catch (e) { log("  Host.Process — crash"); }
  try { log("  Host.Shell = " + typeof Host.Shell); } catch (e) { log("  Host.Shell — crash"); }
  try { log("  Host.Timer = " + typeof Host.Timer); } catch (e) { log("  Host.Timer — crash"); }
  try { log("  Host.Clipboard = " + typeof Host.Clipboard); } catch (e) { log("  Host.Clipboard — crash"); }
}

// ═══════════════════════════════════════════════════════════════════════════
// IComponent service
// ═══════════════════════════════════════════════════════════════════════════

function FornixMCPBridgeService() {
  this.interfaces = [Host.Interfaces.IComponent];

  this.initialize = function() {
    log("=== Fornix MCP Stage 3e Probe v" + PROBE_VERSION + " ===");
    log("Focus: CCL.JS.getApplication() and getWindowManager()");
    log("");

    try { probe1_getApplication(); } catch (e) { log("PROBE 1 FATAL: " + e); }
    try { probe2_getWindowManager(); } catch (e) { log("PROBE 2 FATAL: " + e); }
    try { probe3_CCLJSMethods(); } catch (e) { log("PROBE 3 FATAL: " + e); }
    try { probe4_AppDocument(); } catch (e) { log("PROBE 4 FATAL: " + e); }
    try { probe5_Commands(); } catch (e) { log("PROBE 5 FATAL: " + e); }
    try { probe6_HostScan(); } catch (e) { log("PROBE 6 FATAL: " + e); }

    log("");
    log("=== Stage 3e probe complete ===");
    return Host.Results.kResultOk;
  };

  this.terminate = function() {
    log("terminate");
    return Host.Results.kResultOk;
  };
}

function createInstance(args) {
  __init(args);
  log("createInstance (v" + PROBE_VERSION + ")");
  return new FornixMCPBridgeService;
}
