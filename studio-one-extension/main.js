// ─── Fornix MCP Bridge – Studio One Extension (Experimental) ────────────────
// Runs inside Studio One if the host actually loads this script.
// Native loading and manifest validity are not proven by this repo.
// Keep file-based fallback workflows first-class.
/* global Song, Tracks, Host */

const BRIDGE_PORT = 7890;
const EXTENSION_VERSION = "1.0.0";
const POLL_INTERVAL_MS = 5000;

let wsServer = null;
let pollTimer = null;
const clients = new Set();

// Tracks what actually happened during activate() so runSelfTest() can report
// it truthfully if the WebSocket ever connects.
let _activationState = {
  serverStarted: false,
  serverError: null,
  pollerStarted: false,
  pollerError: null,
  startupMarkerWritten: false,
};

function activate() {
  log("Activating Fornix MCP Bridge v" + EXTENSION_VERSION + " (experimental)");

  _activationState = {
    serverStarted: false,
    serverError: null,
    pollerStarted: false,
    pollerError: null,
    startupMarkerWritten: false,
  };

  // Write startup marker BEFORE WebSocket setup. This is the only externally
  // observable evidence that Studio One executed the extension at all.
  _activationState.startupMarkerWritten = writeStartupMarker();
  if (_activationState.startupMarkerWritten) {
    log("Startup marker written to FornixMCP/logs");
  } else {
    log("Startup marker could not be written (Host.FileSystem.writeFile unavailable or path error)");
  }

  try {
    startServer();
    _activationState.serverStarted = true;
  } catch (error) {
    _activationState.serverError = errorMessage(error);
    log("WebSocket server failed to start: " + _activationState.serverError);
  }

  try {
    startPendingPoller();
    _activationState.pollerStarted = true;
  } catch (error) {
    _activationState.pollerError = errorMessage(error);
    log("Pending poller failed to start: " + _activationState.pollerError);
  }
}

function deactivate() {
  writeShutdownMarker();
  stopPendingPoller();
  stopServer();
  clients.clear();
  log("Deactivated Fornix MCP Bridge");
}

function startServer() {
  if (!Host || !Host.WebSocket || typeof Host.WebSocket.createServer !== "function") {
    throw new Error("Host.WebSocket.createServer unavailable");
  }

  wsServer = Host.WebSocket.createServer(BRIDGE_PORT);
  wsServer.onconnection = (client) => {
    clients.add(client);
    log("Client connected");

    client.onmessage = (raw) => handle(client, raw);
    client.onclose = () => {
      clients.delete(client);
      log("Client disconnected");
    };
    client.onerror = () => {
      clients.delete(client);
      log("Client error");
    };
  };

  log("WebSocket server listening on port " + BRIDGE_PORT);
}

function stopServer() {
  if (wsServer && typeof wsServer.close === "function") {
    try {
      wsServer.close();
    } catch (error) {
      log("Error closing server: " + errorMessage(error));
    }
  }

  wsServer = null;
}

function stopPendingPoller() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function sendEnvelope(client, envelope) {
  if (client && typeof client.send === "function") {
    client.send(JSON.stringify(envelope));
  }

  return envelope;
}

function successResponse(command, data, requestId) {
  return {
    requestId: requestId ?? null,
    ok: true,
    command,
    data: data ?? {},
  };
}

function errorResponse(command, errorCode, errorMessage, requestId) {
  return {
    requestId: requestId ?? null,
    ok: false,
    command,
    errorCode,
    errorMessage,
  };
}

function parseRawMessage(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : JSON.parse(String(raw));
    return parsed && typeof parsed === "object"
      ? parsed
      : { command: null, params: {}, requestId: null };
  } catch (_error) {
    return null;
  }
}

function executeCommand(command, params, requestId) {
  try {
    switch (command) {
      case "ping":
        return successResponse("ping", { pong: true }, requestId);

      case "getHostInfo":
        return successResponse("getHostInfo", getHostInfo(), requestId);

      case "getCapabilities":
        return successResponse("getCapabilities", getCapabilities(), requestId);

      case "runSelfTest":
        return successResponse("runSelfTest", runSelfTest(), requestId);

      case "getTransportState":
        return successResponse("getTransportState", getTransportState(), requestId);

      case "setTempo":
        return successResponse("setTempo", setTempo(params), requestId);

      case "setLoopRange":
        return successResponse("setLoopRange", setLoopRange(params), requestId);

      case "getSongMetadata":
        return successResponse("getSongMetadata", getSongMetadata(), requestId);

      case "createTrack":
        return successResponse("createTrack", createTrack(params), requestId);

      case "renameTrack":
        return successResponse("renameTrack", renameTrack(params), requestId);

      case "setTrackMute":
        return successResponse("setTrackMute", setTrackMute(params), requestId);

      case "setTrackSolo":
        return successResponse("setTrackSolo", setTrackSolo(params), requestId);

      case "setTrackVolume":
        return successResponse("setTrackVolume", setTrackVolume(params), requestId);

      case "createSend":
        return successResponse("createSend", createSend(params), requestId);

      case "addPlugin":
        return successResponse("addPlugin", addPlugin(params), requestId);

      case "setPluginParam":
        return successResponse("setPluginParam", setPluginParam(params), requestId);

      case "getPluginParams":
        return successResponse("getPluginParams", getPluginParams(params), requestId);

      case "loadPluginPreset":
        return successResponse("loadPluginPreset", loadPluginPreset(params), requestId);

      case "addMidiNotes":
        return successResponse("addMidiNotes", addMidiNotes(params), requestId);

      case "clearMidiPart":
        return successResponse("clearMidiPart", clearMidiPart(params), requestId);

      case "quantizePart":
        return successResponse("quantizePart", quantizePart(params), requestId);

      case "addMarker":
        return successResponse("addMarker", addMarker(params), requestId);

      case "addMarkersMulti":
        return successResponse("addMarkersMulti", addMarkersMulti(params), requestId);

      case "getMarkers":
        return successResponse("getMarkers", getMarkers(), requestId);

      case "deleteMarker":
        return successResponse("deleteMarker", deleteMarker(params), requestId);

      case "addAutomationPoints":
        return successResponse("addAutomationPoints", addAutomationPoints(params), requestId);

      case "clearAutomation":
        return successResponse("clearAutomation", clearAutomation(params), requestId);

      case "triggerMacro":
        return successResponse("triggerMacro", triggerMacro(params), requestId);

      default:
        return errorResponse(command || "unknown", "UNKNOWN_COMMAND", "Unknown command: " + command, requestId);
    }
  } catch (error) {
    const messageText = errorMessage(error);
    log("Error in " + command + ": " + messageText);
    return errorResponse(command || "unknown", "RUNTIME_ERROR", messageText, requestId);
  }
}

function handle(client, raw) {
  const message = parseRawMessage(raw);

  if (!message) {
    sendEnvelope(client, errorResponse("unknown", "INVALID_JSON", "Invalid JSON", null));
    return;
  }

  const command = typeof message.command === "string" ? message.command : "unknown";
  const params = message.params && typeof message.params === "object" ? message.params : {};
  const requestId = message.requestId ?? null;

  log("CMD: " + command);
  sendEnvelope(client, executeCommand(command, params, requestId));
}

function getTransportState() {
  const song = activeSong();
  const transport = song.getTransport();

  return {
    playing: transport.isPlaying(),
    recording: transport.isRecording(),
    tempo: transport.getTempo(),
    position: transport.getPosition(),
    timeSignature: {
      n: song.getTimeSignatureNumerator(),
      d: song.getTimeSignatureDenominator(),
    },
    loopEnabled: transport.isLoopEnabled(),
    loopStart: transport.getLoopStart(),
    loopEnd: transport.getLoopEnd(),
  };
}

function setTempo(params) {
  const bpm = num(params.bpm, 20, 300);
  activeSong().getTransport().setTempo(bpm);
  return { bpm };
}

function setLoopRange(params) {
  const startBar = int(params.startBar, 1, 9999);
  const endBar = int(params.endBar, startBar, 9999);
  const transport = activeSong().getTransport();

  transport.setLoopStart(startBar - 1);
  transport.setLoopEnd(endBar - 1);
  transport.setLoopEnabled(true);

  return { startBar, endBar };
}

function getSongMetadata() {
  const song = activeSong();
  const tracks = song.getTracks();

  return {
    title: song.getName(),
    tempo: song.getTransport().getTempo(),
    timeSignatureNumerator: song.getTimeSignatureNumerator(),
    timeSignatureDenominator: song.getTimeSignatureDenominator(),
    sampleRate: song.getSampleRate ? song.getSampleRate() : null,
    tracks: tracks.map((track) => ({
      id: safeCall(track, "getId"),
      name: safeCall(track, "getName"),
      type: safeCall(track, "getType"),
      muted: safeCall(track, "isMuted"),
      soloed: safeCall(track, "isSoloed"),
      volume: safeCall(track, "getVolume"),
      pan: safeCall(track, "getPan"),
    })),
  };
}

function createTrack(params) {
  const song = activeSong();
  const typeMap = {
    audio: Tracks && Tracks.AUDIO,
    instrument: Tracks && Tracks.INSTRUMENT,
    automation: Tracks && Tracks.AUTOMATION,
    bus: Tracks && Tracks.BUS,
    fx: Tracks && Tracks.FX,
    folder: Tracks && Tracks.FOLDER,
  };

  const trackType = typeMap[params.type] || typeMap.audio;
  const track = song.createTrack(trackType, params.insertAtPosition ?? -1);
  if (!track) {
    throw new Error("Track creation failed");
  }

  if (params.name && typeof track.setName === "function") {
    track.setName(params.name);
  }
  if (params.color && typeof track.setColor === "function") {
    track.setColor(params.color);
  }

  return {
    id: safeCall(track, "getId"),
    name: safeCall(track, "getName"),
    type: params.type || "audio",
  };
}

function renameTrack(params) {
  const track = findTrack(params.trackId, params.currentName);
  track.setName(params.newName);
  return { id: track.getId(), name: params.newName };
}

function setTrackMute(params) {
  const track = findTrack(params.trackId, params.trackName);
  track.setMuted(!!params.muted);
  return { muted: !!params.muted };
}

function setTrackSolo(params) {
  const track = findTrack(params.trackId, params.trackName);
  track.setSoloed(!!params.soloed);
  return { soloed: !!params.soloed };
}

function setTrackVolume(params) {
  const track = findTrack(params.trackId, params.trackName);
  track.setVolume(dbToLinear(num(params.volumeDb, -144, 24)));
  return { volumeDb: params.volumeDb };
}

function createSend(params) {
  const source = findTrack(null, params.fromTrackName);
  const target = findTrack(null, params.toBusName);
  if (typeof source.createSend !== "function") {
    throw new Error("Send creation unavailable on source track");
  }

  const send = source.createSend(target);
  if (!send) {
    throw new Error("Send creation failed");
  }

  if (typeof send.setLevel === "function") {
    send.setLevel(dbToLinear(params.sendLevelDb ?? 0));
  }
  if (params.preFader && typeof send.setPreFader === "function") {
    send.setPreFader(true);
  }

  return {
    from: params.fromTrackName,
    to: params.toBusName,
  };
}

function addPlugin(params) {
  const track = findTrack(null, params.trackName);
  const chain = getInsertChain(track);

  if (typeof chain.addPlugin !== "function") {
    throw new Error("Insert chain addPlugin unavailable");
  }

  const plugin = chain.addPlugin(params.pluginName, params.insertPosition ?? -1);
  if (!plugin) {
    throw new Error("Plugin not found: " + params.pluginName);
  }

  if (params.preset && typeof plugin.loadPreset === "function") {
    plugin.loadPreset(params.preset);
  }

  return {
    trackName: params.trackName,
    pluginName: params.pluginName,
  };
}

function setPluginParam(params) {
  const plugin = findPlugin(params.trackName, params.pluginName);
  const parameter = getPluginParameter(plugin, params.paramName);

  if (params.isAbsolute) {
    if (typeof parameter.setValue !== "function") {
      throw new Error("Absolute parameter setValue unavailable");
    }
    parameter.setValue(params.value);
  } else {
    if (typeof parameter.setNormalizedValue !== "function") {
      throw new Error("Normalized parameter setNormalizedValue unavailable");
    }
    parameter.setNormalizedValue(clamp(params.value, 0, 1));
  }

  return {
    paramName: params.paramName,
    value: params.value,
  };
}

function getPluginParams(params) {
  const plugin = findPlugin(params.trackName, params.pluginName);
  const count = typeof plugin.getParameterCount === "function" ? plugin.getParameterCount() : 0;
  const values = [];

  for (let i = 0; i < count; i += 1) {
    const parameter = plugin.getParameter(i);
    if (!parameter) {
      continue;
    }

    values.push({
      name: safeCall(parameter, "getName"),
      value: safeCall(parameter, "getValue"),
      normalized: typeof parameter.getNormalizedValue === "function"
        ? parameter.getNormalizedValue()
        : null,
    });
  }

  return { params: values };
}

function loadPluginPreset(params) {
  const plugin = findPlugin(params.trackName, params.pluginName);

  if (typeof plugin.loadPreset !== "function") {
    throw new Error("Plugin does not support preset loading");
  }

  if (!plugin.loadPreset(params.presetName)) {
    throw new Error("Preset not found: " + params.presetName);
  }

  return { presetName: params.presetName };
}

function addMidiNotes(params) {
  const song = activeSong();
  const track = findTrack(null, params.trackName);
  const notes = Array.isArray(params.notes) ? params.notes : [];
  if (!notes.length) {
    throw new Error("No notes provided");
  }

  const firstBar = notes[0].start && notes[0].start.bar ? notes[0].start.bar : 1;
  const part = getOrCreatePart(track, firstBar, params.createPartIfMissing !== false, params.partName, song);

  let inserted = 0;
  for (const note of notes) {
    if (typeof part.addNote !== "function") {
      throw new Error("Part.addNote unavailable");
    }

    part.addNote(
      int(note.pitch, 0, 127),
      int(note.velocity ?? 100, 1, 127),
      posToTick(note.start, song),
      durToTick(note.duration, song),
      int(note.channel ?? 1, 1, 16),
    );
    inserted += 1;
  }

  return { inserted };
}

function clearMidiPart(params) {
  const song = activeSong();
  const track = findTrack(null, params.trackName);
  const startTick = barToTick(params.startBar, song);
  const endTick = barToTick(params.endBar + 1, song);

  let cleared = 0;
  for (const part of track.getParts ? track.getParts() : []) {
    const start = typeof part.getStart === "function" ? part.getStart() : null;
    if (start !== null && start >= startTick && start < endTick && typeof part.clearNotes === "function") {
      part.clearNotes();
      cleared += 1;
    }
  }

  return { cleared };
}

function quantizePart(params) {
  const track = findTrack(null, params.trackName);
  if (typeof track.quantize !== "function") {
    throw new Error("Quantize API unavailable in this Studio One version");
  }

  track.quantize(
    params.startBar,
    params.endBar,
    params.gridValue,
    (params.strength ?? 100) / 100,
  );

  return { quantized: true };
}

function addMarker(params) {
  const song = activeSong();
  if (typeof song.addMarker !== "function") {
    throw new Error("Marker API unavailable in this Studio One version");
  }

  const marker = song.addMarker(barToTick(params.bar, song), params.name);
  if (params.color && marker && typeof marker.setColor === "function") {
    marker.setColor(params.color);
  }

  return { bar: params.bar, name: params.name };
}

function addMarkersMulti(params) {
  const song = activeSong();
  if (typeof song.addMarker !== "function") {
    throw new Error("Marker API unavailable in this Studio One version");
  }

  let added = 0;
  for (const item of params.markers || []) {
    const marker = song.addMarker(barToTick(item.bar, song), item.name);
    if (marker) {
      if (item.color && typeof marker.setColor === "function") {
        marker.setColor(item.color);
      }
      added += 1;
    }
  }

  return { added };
}

function getMarkers() {
  const song = activeSong();
  const markers = typeof song.getMarkers === "function" ? song.getMarkers() : [];

  return {
    markers: markers.map((marker) => ({
      name: marker.getName(),
      tick: marker.getPosition(),
      bar: tickToBar(marker.getPosition(), song),
    })),
  };
}

function deleteMarker(params) {
  const song = activeSong();
  const markers = typeof song.getMarkers === "function" ? song.getMarkers() : [];
  if (typeof song.removeMarker !== "function") {
    throw new Error("Marker removal unavailable in this Studio One version");
  }

  let deleted = 0;
  for (const marker of markers) {
    const matchesName = params.name
      && marker.getName().toLowerCase() === String(params.name).toLowerCase();
    const matchesBar = params.bar
      && tickToBar(marker.getPosition(), song) === params.bar;

    if (matchesName || matchesBar) {
      song.removeMarker(marker);
      deleted += 1;
    }
  }

  return { deleted };
}

function addAutomationPoints(params) {
  const song = activeSong();
  const track = findTrack(null, params.trackName);
  const lane = getOrCreateAutomationLane(track, params.parameter);

  let added = 0;
  for (const point of params.points || []) {
    if (typeof lane.addPoint !== "function") {
      throw new Error("Automation lane addPoint unavailable");
    }

    lane.addPoint(pointToTick(point, song), point.value);
    added += 1;
  }

  return { added };
}

function clearAutomation(params) {
  const song = activeSong();
  const track = findTrack(null, params.trackName);
  const lane = getAutomationLane(track, params.parameter);

  if (!lane) {
    throw new Error("Automation lane not found for: " + params.parameter);
  }
  if (typeof lane.clearRange !== "function") {
    throw new Error("Automation lane clearRange unavailable");
  }

  const startTick = barToTick(params.startBar, song);
  const endTick = barToTick(params.endBar + 1, song);
  lane.clearRange(startTick, endTick);

  return { removed: 1 };
}

function triggerMacro(params) {
  if (!Host || !Host.Commands || typeof Host.Commands.execute !== "function") {
    throw new Error("Macro API unavailable");
  }

  Host.Commands.execute(params.macroName);
  return {
    macroName: params.macroName,
    triggered: true,
  };
}

function startPendingPoller() {
  stopPendingPoller();

  const pendingDir = getPendingDir();
  if (!pendingDir) {
    log("Pending poller disabled: Host.getDocumentsPath unavailable");
    return;
  }

  pollTimer = setInterval(processPendingFiles, POLL_INTERVAL_MS);
  processPendingFiles();
  log("Pending poller watching " + pendingDir);
}

function processPendingFiles() {
  if (!Host || !Host.FileSystem || typeof Host.FileSystem.listFiles !== "function") {
    return;
  }

  const pendingDir = getPendingDir();
  if (!pendingDir) {
    return;
  }

  const files = Host.FileSystem.listFiles(pendingDir, "*.json") || [];
  for (const file of files) {
    try {
      const raw = Host.FileSystem.readFile(file);
      const batch = JSON.parse(raw);
      log("Executing pending batch: " + (batch.label || file));

      for (const instruction of batch.instructions || []) {
        const sink = {
          send: (message) => log("Pending result: " + message),
        };
        handle(sink, JSON.stringify({
          command: instruction.command,
          params: instruction.params || {},
          requestId: "pending-" + Date.now(),
        }));
      }

      movePendingFileToDone(file);
    } catch (error) {
      log("Pending file error: " + errorMessage(error));
    }
  }
}

function movePendingFileToDone(filePath) {
  if (!Host || !Host.FileSystem || typeof Host.FileSystem.moveFile !== "function") {
    return;
  }

  const doneDir = getDoneDir();
  if (doneDir && typeof Host.FileSystem.createDirectory === "function") {
    try {
      Host.FileSystem.createDirectory(doneDir);
    } catch (_error) {
      // Ignore if the directory already exists or the host does not support it.
    }
  }

  const movedPath = replacePathSegment(filePath, "pending", "done");
  Host.FileSystem.moveFile(filePath, movedPath);
}

function getPendingDir() {
  if (!Host || typeof Host.getDocumentsPath !== "function") {
    return null;
  }

  return joinPath(Host.getDocumentsPath(), "FornixMCP", "pending");
}

function getDoneDir() {
  if (!Host || typeof Host.getDocumentsPath !== "function") {
    return null;
  }

  return joinPath(Host.getDocumentsPath(), "FornixMCP", "done");
}

function joinPath() {
  const parts = Array.prototype.slice.call(arguments).filter(Boolean);
  const separator = parts.some((part) => String(part).indexOf("\\") !== -1) ? "\\" : "/";
  return parts
    .map((part, index) => {
      const value = String(part);
      if (index === 0) {
        return value.replace(/[\\/]+$/, "");
      }
      return value.replace(/^[\\/]+/, "").replace(/[\\/]+$/, "");
    })
    .join(separator);
}

function replacePathSegment(filePath, fromSegment, toSegment) {
  return String(filePath).replace(/([\\/])pending([\\/])/, "$1" + toSegment + "$2");
}

// ── Startup / shutdown markers ────────────────────────────────────────────────
//
// Writing a file during activate() is the only externally observable evidence
// that Studio One actually executed this extension. The file is completely
// independent of the WebSocket server — it works even when Host.WebSocket is
// unavailable. The MCP server's s1_read_extension_log tool reads these files.

function getExtensionLogDir() {
  if (!Host || typeof Host.getDocumentsPath !== "function") {
    return null;
  }
  const docsPath = Host.getDocumentsPath();
  if (!docsPath) {
    return null;
  }
  return joinPath(docsPath, "FornixMCP", "logs");
}

function writeStartupMarker() {
  if (!Host || !Host.FileSystem || typeof Host.FileSystem.writeFile !== "function") {
    return false;
  }
  try {
    const logDir = getExtensionLogDir();
    if (!logDir) {
      return false;
    }
    if (typeof Host.FileSystem.createDirectory === "function") {
      Host.FileSystem.createDirectory(logDir);
    }
    const marker = {
      event: "activate",
      version: EXTENSION_VERSION,
      timestamp: new Date().toISOString(),
      host: {
        logging: hasConsoleLogging(),
        filesystem: hasFileSystem(),
        filesystemWrite: hasFileSystemWrite(),
        websocketServer: hasWebSocketServer(),
        commands: hasHostCommands(),
        documentsPath: typeof Host.getDocumentsPath === "function" ? Host.getDocumentsPath() : null,
      },
      song: {
        exists: hasSongAccess(),
      },
    };
    Host.FileSystem.writeFile(
      joinPath(logDir, "startup-" + Date.now() + ".json"),
      JSON.stringify(marker, null, 2),
    );
    return true;
  } catch (_error) {
    return false;
  }
}

function writeShutdownMarker() {
  if (!Host || !Host.FileSystem || typeof Host.FileSystem.writeFile !== "function") {
    return;
  }
  try {
    const logDir = getExtensionLogDir();
    if (!logDir) {
      return;
    }
    Host.FileSystem.writeFile(
      joinPath(logDir, "shutdown-" + Date.now() + ".json"),
      JSON.stringify({
        event: "deactivate",
        version: EXTENSION_VERSION,
        timestamp: new Date().toISOString(),
      }, null, 2),
    );
  } catch (_error) {
    // Non-fatal — ignore silently.
  }
}


function getHostInfo() {
  return {
    host: {
      exists: typeof Host !== "undefined" && !!Host,
      logging: hasConsoleLogging(),
      filesystem: hasFileSystem(),
      filesystemWrite: hasFileSystemWrite(),
      websocketServer: hasWebSocketServer(),
      commands: hasHostCommands(),
    },
    song: {
      exists: hasSongAccess(),
      activeSongAvailable: !!safeActiveSong(),
    },
  };
}

function getCapabilities() {
  const song = safeActiveSong();
  const tracks = safeSongTracks(song);

  return {
    transport: !!safeTransport(song),
    song: !!song,
    tracks: Array.isArray(tracks),
    plugins: collectionHasMethod(tracks, "getInsertChain"),
    automation: collectionHasMethod(tracks, "getAutomationLane") || collectionHasMethod(tracks, "createAutomationLane"),
    midi: collectionHasMethod(tracks, "createPart") || collectionHasMethod(tracks, "getParts"),
    markers: !!(song && (typeof song.getMarkers === "function" || typeof song.addMarker === "function")),
    filesystem: hasFileSystem(),
    websocketServer: hasWebSocketServer(),
  };
}

function collectionHasMethod(items, methodName) {
  if (!Array.isArray(items)) {
    return false;
  }

  for (const item of items) {
    if (item && typeof item[methodName] === "function") {
      return true;
    }
  }

  return false;
}

function runSelfTest() {
  const capabilities = getCapabilities();
  const hostInfo = getHostInfo();
  const checks = [
    shallowCheck("host.exists", hostInfo.host.exists, "Global Host object present"),
    shallowCheck("host.logging", hostInfo.host.logging, "Host.Console.writeLine available"),
    shallowCheck("host.filesystem", hostInfo.host.filesystem, "Host.FileSystem basic access available"),
    shallowCheck("host.websocketServer", hostInfo.host.websocketServer, "Host.WebSocket.createServer available"),
    shallowCheck("song.exists", hostInfo.song.exists, "Song object exposed"),
    shallowCheck("song.activeSongAvailable", hostInfo.song.activeSongAvailable, "Active song retrievable"),
    shallowCheck("cap.transport", capabilities.transport, "Transport accessor available"),
    shallowCheck("cap.tracks", capabilities.tracks, "Track collection available"),
  ];

  return {
    ok: checks.every((check) => check.ok || check.name === "host.websocketServer"),
    hostInfo,
    capabilities,
    checks,
    activation: _activationState,
  };
}

function shallowCheck(name, ok, details) {
  return { name, ok: !!ok, details };
}

function hasConsoleLogging() {
  return !!(typeof Host !== "undefined" && Host && Host.Console && typeof Host.Console.writeLine === "function");
}

function hasFileSystem() {
  return !!(typeof Host !== "undefined" && Host && Host.FileSystem);
}

function hasFileSystemWrite() {
  return !!(typeof Host !== "undefined" && Host && Host.FileSystem && typeof Host.FileSystem.writeFile === "function");
}

function hasWebSocketServer() {
  return !!(typeof Host !== "undefined" && Host && Host.WebSocket && typeof Host.WebSocket.createServer === "function");
}

function hasHostCommands() {
  return !!(typeof Host !== "undefined" && Host && Host.Commands);
}

function hasSongAccess() {
  return typeof Song !== "undefined" && !!Song;
}

function safeActiveSong() {
  try {
    if (typeof Song === "undefined" || !Song || typeof Song.getActiveSong !== "function") {
      return null;
    }

    return Song.getActiveSong();
  } catch (_error) {
    return null;
  }
}

function safeTransport(song) {
  try {
    return song && typeof song.getTransport === "function" ? song.getTransport() : null;
  } catch (_error) {
    return null;
  }
}

function safeSongTracks(song) {
  try {
    if (!song || typeof song.getTracks !== "function") {
      return null;
    }

    const tracks = song.getTracks();
    return Array.isArray(tracks) ? tracks : null;
  } catch (_error) {
    return null;
  }
}

function activeSong() {
  if (!Song || typeof Song.getActiveSong !== "function") {
    throw new Error("Song.getActiveSong unavailable");
  }

  const song = Song.getActiveSong();
  if (!song) {
    throw new Error("No active song open in Studio One");
  }

  return song;
}

function findTrack(trackId, trackName) {
  const tracks = activeSong().getTracks();
  const targetName = trackName ? String(trackName).toLowerCase() : null;

  for (const track of tracks) {
    if (trackId && track.getId && track.getId() === trackId) {
      return track;
    }
    if (targetName && track.getName && track.getName().toLowerCase() === targetName) {
      return track;
    }
  }

  throw new Error("Track not found: " + (trackName || trackId));
}

function getInsertChain(track) {
  const chain = track && typeof track.getInsertChain === "function" ? track.getInsertChain() : null;
  if (!chain) {
    throw new Error("Track has no insert chain");
  }

  return chain;
}

function findPlugin(trackName, pluginName) {
  const chain = getInsertChain(findTrack(null, trackName));
  const count = typeof chain.getPluginCount === "function" ? chain.getPluginCount() : 0;
  const target = String(pluginName).toLowerCase();

  for (let i = 0; i < count; i += 1) {
    const plugin = chain.getPlugin(i);
    if (plugin && plugin.getName && plugin.getName().toLowerCase() === target) {
      return plugin;
    }
  }

  throw new Error("Plugin not found: " + pluginName + " on track: " + trackName);
}

function getPluginParameter(plugin, paramName) {
  if (typeof plugin.getParameterByName === "function") {
    const parameter = plugin.getParameterByName(paramName);
    if (parameter) {
      return parameter;
    }
  }

  const count = typeof plugin.getParameterCount === "function" ? plugin.getParameterCount() : 0;
  const target = String(paramName).toLowerCase();

  for (let i = 0; i < count; i += 1) {
    const parameter = plugin.getParameter(i);
    if (parameter && parameter.getName && parameter.getName().toLowerCase() === target) {
      return parameter;
    }
  }

  throw new Error("Parameter not found: " + paramName);
}

function getOrCreatePart(track, bar, createIfMissing, partName, song) {
  const tick = barToTick(bar, song);
  const parts = track.getParts ? track.getParts() : [];

  for (const part of parts) {
    if (typeof part.getStart === "function" && Math.abs(part.getStart() - tick) < 20) {
      return part;
    }
  }

  if (!createIfMissing) {
    throw new Error("No MIDI part found at bar " + bar + " and createPartIfMissing=false");
  }
  if (typeof track.createPart !== "function") {
    throw new Error("Track does not support MIDI parts");
  }

  const partLength = barToTick(bar + 4, song) - tick;
  const created = track.createPart(tick, partLength);
  if (partName && created && typeof created.setName === "function") {
    created.setName(partName);
  }

  return created;
}

function getAutomationLane(track, parameter) {
  return track && typeof track.getAutomationLane === "function"
    ? track.getAutomationLane(parameter)
    : null;
}

function getOrCreateAutomationLane(track, parameter) {
  let lane = getAutomationLane(track, parameter);

  if (!lane && typeof track.createAutomationLane === "function") {
    lane = track.createAutomationLane(parameter);
  }
  if (!lane) {
    throw new Error("Automation lane unavailable for: " + parameter);
  }

  return lane;
}

function barToTick(bar, song) {
  const ppqn = getPpqn(song);
  const beatsPerBar = getBeatsPerBar(song);
  return (int(bar, 1, 99999) - 1) * beatsPerBar * ppqn;
}

function tickToBar(tick, song) {
  const ppqn = getPpqn(song);
  const beatsPerBar = getBeatsPerBar(song);
  return Math.floor(tick / (beatsPerBar * ppqn)) + 1;
}

function posToTick(position, song) {
  if (!position) {
    throw new Error("Missing note position");
  }

  const ppqn = getPpqn(song);
  const beatsPerBar = getBeatsPerBar(song);
  const bar = int(position.bar, 1, 99999);
  const beat = int(position.beat, 1, 64);
  const tick = int(position.tick ?? 0, 0, ppqn - 1);

  return ((bar - 1) * beatsPerBar + (beat - 1)) * ppqn + tick;
}

function pointToTick(point, song) {
  const ppqn = getPpqn(song);
  const beatsPerBar = getBeatsPerBar(song);
  const bar = int(point.bar, 1, 99999);
  const beat = int(point.beat ?? 1, 1, 64);

  return ((bar - 1) * beatsPerBar + (beat - 1)) * ppqn;
}

function durToTick(duration, song) {
  if (!duration) {
    throw new Error("Missing note duration");
  }

  const ppqn = getPpqn(song);
  const beatsPerBar = getBeatsPerBar(song);
  const bars = int(duration.bars ?? 0, 0, 99999);
  const beats = int(duration.beats ?? 0, 0, 64);
  const ticks = int(duration.ticks ?? 0, 0, ppqn - 1);

  return (bars * beatsPerBar + beats) * ppqn + ticks;
}

function getPpqn(song) {
  return song && typeof song.getPPQN === "function" ? song.getPPQN() : 480;
}

function getBeatsPerBar(song) {
  return song && typeof song.getTimeSignatureNumerator === "function"
    ? song.getTimeSignatureNumerator()
    : 4;
}

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, Number(value)));
}

function dbToLinear(db) {
  if (db <= -144) {
    return 0;
  }
  return Math.pow(10, db / 20);
}

function num(value, minValue, maxValue) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < minValue || parsed > maxValue) {
    throw new Error("Value " + value + " out of range " + minValue + "–" + maxValue);
  }
  return parsed;
}

function int(value, minValue, maxValue) {
  return Math.round(num(value, minValue, maxValue));
}

function safeCall(target, methodName) {
  return target && typeof target[methodName] === "function"
    ? target[methodName]()
    : null;
}

function errorMessage(error) {
  return error && error.message ? error.message : String(error);
}

function log(message) {
  if (
    typeof Host !== "undefined" &&
    Host &&
    Host.Console &&
    typeof Host.Console.writeLine === "function"
  ) {
    Host.Console.writeLine("[FornixMCPBridge] " + message);
    return;
  }

  if (typeof console !== "undefined" && typeof console.log === "function") {
    console.log("[FornixMCPBridge] " + message);
  }
}

this.activate = activate;
this.deactivate = deactivate;

if (typeof module !== "undefined" && module && module.exports) {
  module.exports = {
    activate,
    deactivate,
    __test: {
      executeCommand,
      parseRawMessage,
      successResponse,
      errorResponse,
      handle,
      getHostInfo,
      getCapabilities,
      runSelfTest,
    },
  };
}
