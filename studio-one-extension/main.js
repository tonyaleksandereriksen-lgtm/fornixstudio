// ─── Fornix MCP Bridge – Studio One Extension v1.1 ───────────────────────────
// Runs inside Studio One. Opens WebSocket on port 7890.
// Install path (Windows): %AppData%\PreSonus\Studio One 7\Extensions\FornixMCPBridge\
// Install path (macOS):   ~/Library/Application Support/PreSonus/Studio One 7/Extensions/FornixMCPBridge/
/* global Song, Transport, Tracks, Host */

const BRIDGE_PORT = 7890;
let wsServer = null;
const clients = new Set();
let pollTimer = null;

// ── Lifecycle ──────────────────────────────────────────────────────────────────

function activate() {
  log('Activating Fornix MCP Bridge v1.1');
  startServer();
  startPendingPoller();
}

function deactivate() {
  if (wsServer) wsServer.close();
  if (pollTimer) clearInterval(pollTimer);
  clients.clear();
}

// ── Server ─────────────────────────────────────────────────────────────────────

function startServer() {
  wsServer = Host.WebSocket.createServer(BRIDGE_PORT);
  wsServer.onconnection = (c) => {
    clients.add(c);
    log('Client connected');
    c.onmessage = (raw) => handle(c, raw);
    c.onclose   = () => { clients.delete(c); log('Client disconnected'); };
    c.onerror   = () => clients.delete(c);
  };
}

function reply(client, id, ok, data, error) {
  client.send(JSON.stringify({ requestId: id, ok, data: data ?? null, error: error ?? null }));
}

// ── Router ─────────────────────────────────────────────────────────────────────

function handle(client, raw) {
  let msg;
  try { msg = JSON.parse(raw); }
  catch { reply(client, null, false, null, 'Invalid JSON'); return; }

  const { command, params = {}, requestId } = msg;
  log('CMD: ' + command);

  try {
    switch (command) {

      // ── Transport ────────────────────────────────────────────────────────────
      case 'getTransportState': {
        const song = activeSong();
        const t = song.getTransport();
        reply(client, requestId, true, {
          playing: t.isPlaying(), recording: t.isRecording(),
          tempo: t.getTempo(), position: t.getPosition(),
          timeSignature: { n: song.getTimeSignatureNumerator(), d: song.getTimeSignatureDenominator() },
          loopEnabled: t.isLoopEnabled(), loopStart: t.getLoopStart(), loopEnd: t.getLoopEnd(),
        });
        break;
      }
      case 'setTempo': {
        const bpm = num(params.bpm, 20, 300);
        activeSong().getTransport().setTempo(bpm);
        reply(client, requestId, true, { bpm });
        break;
      }
      case 'setLoopRange': {
        const s = int(params.startBar, 1, 9999) - 1;
        const e = int(params.endBar, 2, 9999) - 1;
        const t = activeSong().getTransport();
        t.setLoopStart(s); t.setLoopEnd(e); t.setLoopEnabled(true);
        reply(client, requestId, true, { startBar: params.startBar, endBar: params.endBar });
        break;
      }

      // ── Song metadata ────────────────────────────────────────────────────────
      case 'getSongMetadata': {
        const song = activeSong();
        const tracks = song.getTracks();
        reply(client, requestId, true, {
          title: song.getName(),
          tempo: song.getTransport().getTempo(),
          timeSignatureNumerator: song.getTimeSignatureNumerator(),
          timeSignatureDenominator: song.getTimeSignatureDenominator(),
          sampleRate: song.getSampleRate(),
          tracks: tracks.map(t => ({
            id: t.getId(), name: t.getName(), type: t.getType(),
            muted: t.isMuted(), soloed: t.isSoloed(),
            volume: t.getVolume(), pan: t.getPan(),
          })),
        });
        break;
      }

      // ── Tracks ───────────────────────────────────────────────────────────────
      case 'createTrack': {
        const song = activeSong();
        const typeMap = { audio: Tracks.AUDIO, instrument: Tracks.INSTRUMENT,
          automation: Tracks.AUTOMATION, bus: Tracks.BUS, fx: Tracks.FX, folder: Tracks.FOLDER };
        const tt = typeMap[params.type] ?? Tracks.AUDIO;
        const track = song.createTrack(tt, params.insertAtPosition ?? -1);
        track.setName(params.name);
        if (params.color && track.setColor) track.setColor(params.color);
        reply(client, requestId, true, { id: track.getId(), name: track.getName(), type: params.type });
        break;
      }
      case 'renameTrack': {
        const t = findTrack(params.trackId, params.currentName);
        t.setName(params.newName);
        reply(client, requestId, true, { id: t.getId(), name: params.newName });
        break;
      }
      case 'setTrackMute': {
        const t = findTrack(params.trackId, params.trackName);
        t.setMuted(params.muted);
        reply(client, requestId, true, { muted: params.muted });
        break;
      }
      case 'setTrackSolo': {
        const t = findTrack(params.trackId, params.trackName);
        t.setSoloed(params.soloed);
        reply(client, requestId, true, { soloed: params.soloed });
        break;
      }
      case 'setTrackVolume': {
        const t = findTrack(params.trackId, params.trackName);
        t.setVolume(dbToLinear(params.volumeDb));
        reply(client, requestId, true, { volumeDb: params.volumeDb });
        break;
      }
      case 'createSend': {
        const src = findTrack(null, params.fromTrackName);
        const dst = findTrack(null, params.toBusName);
        const send = src.createSend(dst);
        if (send) {
          send.setLevel(dbToLinear(params.sendLevelDb ?? 0));
          if (params.preFader && send.setPreFader) send.setPreFader(true);
        }
        reply(client, requestId, true, { from: params.fromTrackName, to: params.toBusName });
        break;
      }

      // ── Plugins ──────────────────────────────────────────────────────────────
      case 'addPlugin': {
        const t = findTrack(null, params.trackName);
        const chain = t.getInsertChain ? t.getInsertChain() : null;
        if (!chain) throw new Error('Track has no insert chain');
        const plugin = chain.addPlugin(params.pluginName, params.insertPosition ?? -1);
        if (!plugin) throw new Error('Plugin not found: ' + params.pluginName);
        if (params.preset && plugin.loadPreset) plugin.loadPreset(params.preset);
        reply(client, requestId, true, { trackName: params.trackName, pluginName: params.pluginName });
        break;
      }
      case 'setPluginParam': {
        const plugin = findPlugin(params.trackName, params.pluginName);
        const p = plugin.getParameterByName(params.paramName);
        if (!p) throw new Error('Parameter not found: ' + params.paramName);
        params.isAbsolute ? p.setValue(params.value) : p.setNormalizedValue(Math.max(0, Math.min(1, params.value)));
        reply(client, requestId, true, { paramName: params.paramName, value: params.value });
        break;
      }
      case 'getPluginParams': {
        const plugin = findPlugin(params.trackName, params.pluginName);
        const count = plugin.getParameterCount ? plugin.getParameterCount() : 0;
        const list = [];
        for (let i = 0; i < count; i++) {
          const p = plugin.getParameter(i);
          if (p) list.push({ name: p.getName(), value: p.getValue(),
            normalized: p.getNormalizedValue ? p.getNormalizedValue() : null });
        }
        reply(client, requestId, true, { params: list });
        break;
      }
      case 'loadPluginPreset': {
        const plugin = findPlugin(params.trackName, params.pluginName);
        if (!plugin.loadPreset) throw new Error('Plugin does not support preset loading');
        if (!plugin.loadPreset(params.presetName)) throw new Error('Preset not found: ' + params.presetName);
        reply(client, requestId, true, { presetName: params.presetName });
        break;
      }

      // ── MIDI ─────────────────────────────────────────────────────────────────
      case 'addMidiNotes': {
        const song = activeSong();
        const t = findTrack(null, params.trackName);
        const firstBar = params.notes[0]?.start?.bar ?? 1;
        const part = getOrCreatePart(t, firstBar, params.createPartIfMissing, params.partName, song);
        let inserted = 0;
        for (const note of params.notes) {
          const startTick = posToTick(note.start, song);
          const durTick = durToTick(note.duration, song);
          if (part.addNote) { part.addNote(note.pitch, note.velocity ?? 100, startTick, durTick, note.channel ?? 1); inserted++; }
        }
        reply(client, requestId, true, { inserted });
        break;
      }
      case 'clearMidiPart': {
        const song = activeSong();
        const t = findTrack(null, params.trackName);
        const s = barToTick(params.startBar, song);
        const e = barToTick(params.endBar + 1, song);
        let cleared = 0;
        for (const part of (t.getParts ? t.getParts() : [])) {
          if (part.getStart() >= s && part.getStart() < e) {
            if (part.clearNotes) { part.clearNotes(); cleared++; }
          }
        }
        reply(client, requestId, true, { cleared });
        break;
      }
      case 'quantizePart': {
        const t = findTrack(null, params.trackName);
        if (!t.quantize) throw new Error('Quantize API unavailable in this S1 version');
        t.quantize(params.startBar, params.endBar, params.gridValue, (params.strength ?? 100) / 100);
        reply(client, requestId, true, { quantized: true });
        break;
      }

      // ── Markers ──────────────────────────────────────────────────────────────
      case 'addMarker': {
        const song = activeSong();
        if (!song.addMarker) throw new Error('Marker API unavailable in this S1 version');
        const tick = barToTick(params.bar, song);
        const m = song.addMarker(tick, params.name);
        if (params.color && m?.setColor) m.setColor(params.color);
        reply(client, requestId, true, { bar: params.bar, name: params.name });
        break;
      }
      case 'addMarkersMulti': {
        const song = activeSong();
        if (!song.addMarker) throw new Error('Marker API unavailable in this S1 version');
        let added = 0;
        for (const m of params.markers) {
          const tick = barToTick(m.bar, song);
          const marker = song.addMarker(tick, m.name);
          if (marker) { if (m.color && marker.setColor) marker.setColor(m.color); added++; }
        }
        reply(client, requestId, true, { added });
        break;
      }
      case 'getMarkers': {
        const song = activeSong();
        const markers = song.getMarkers ? song.getMarkers() : [];
        reply(client, requestId, true, {
          markers: markers.map(m => ({ name: m.getName(), tick: m.getPosition(), bar: tickToBar(m.getPosition(), song) }))
        });
        break;
      }
      case 'deleteMarker': {
        const song = activeSong();
        const markers = song.getMarkers ? song.getMarkers() : [];
        let deleted = 0;
        for (const m of markers) {
          if ((params.name && m.getName().toLowerCase() === params.name.toLowerCase()) ||
              (params.bar  && tickToBar(m.getPosition(), song) === params.bar)) {
            if (song.removeMarker) { song.removeMarker(m); deleted++; }
          }
        }
        reply(client, requestId, true, { deleted });
        break;
      }

      // ── Macros ───────────────────────────────────────────────────────────────
      case 'triggerMacro': {
        if (!Host.Commands?.execute) throw new Error('Macro API unavailable');
        Host.Commands.execute(params.macroName);
        reply(client, requestId, true, { macroName: params.macroName, triggered: true });
        break;
      }

      default:
        reply(client, requestId, false, null, 'Unknown command: ' + command);
    }
  } catch(e) {
    log('Error in ' + command + ': ' + e);
    reply(client, requestId, false, null, String(e));
  }
}

// ── Pending file poller ────────────────────────────────────────────────────────

function startPendingPoller() {
  const dir = Host.getDocumentsPath ? Host.getDocumentsPath() + '/FornixMCP/pending' : null;
  if (!dir) return;
  pollTimer = setInterval(() => {
    if (!Host.FileSystem) return;
    const files = Host.FileSystem.listFiles(dir, '*.json') ?? [];
    for (const file of files) {
      try {
        const batch = JSON.parse(Host.FileSystem.readFile(file));
        log('Executing pending batch: ' + batch.label);
        for (const instr of batch.instructions ?? []) {
          const fakeCl = { send: (msg) => log('Pending result: ' + msg) };
          handle(fakeCl, JSON.stringify({ ...instr, requestId: 'pending-' + Date.now() }));
        }
        Host.FileSystem.moveFile(file, file.replace('/pending/', '/done/'));
      } catch(e) { log('Pending file error: ' + e); }
    }
  }, 5000);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function activeSong() {
  const s = Song.getActiveSong();
  if (!s) throw new Error('No active song open in Studio One');
  return s;
}

function findTrack(id, name) {
  const tracks = activeSong().getTracks();
  const t = id   ? tracks.find(t => t.getId() === id) :
            name ? tracks.find(t => t.getName().toLowerCase() === name.toLowerCase()) : null;
  if (!t) throw new Error('Track not found: ' + (name ?? id));
  return t;
}

function findPlugin(trackName, pluginName) {
  const track = findTrack(null, trackName);
  const chain = track.getInsertChain ? track.getInsertChain() : null;
  if (!chain) throw new Error('Track has no insert chain: ' + trackName);
  const count = chain.getPluginCount ? chain.getPluginCount() : 0;
  for (let i = 0; i < count; i++) {
    const p = chain.getPlugin(i);
    if (p && p.getName().toLowerCase() === pluginName.toLowerCase()) return p;
  }
  throw new Error('Plugin not found: ' + pluginName + ' on track: ' + trackName);
}

function getOrCreatePart(track, bar, create, name, song) {
  const tick = barToTick(bar, song);
  const parts = track.getParts ? track.getParts() : [];
  const existing = parts.find(p => Math.abs(p.getStart() - tick) < 20);
  if (existing) return existing;
  if (!create) throw new Error('No MIDI part found at bar ' + bar + ' and createPartIfMissing=false');
  if (!track.createPart) throw new Error('Track does not support MIDI parts');
  const part = track.createPart(tick, barToTick(bar + 4, song) - tick);
  if (name && part.setName) part.setName(name);
  return part;
}

function barToTick(bar, song) {
  const ppqn = song.getPPQN ? song.getPPQN() : 480;
  const beatsPerBar = song.getTimeSignatureNumerator ? song.getTimeSignatureNumerator() : 4;
  return (bar - 1) * beatsPerBar * ppqn;
}

function tickToBar(tick, song) {
  const ppqn = song.getPPQN ? song.getPPQN() : 480;
  const beatsPerBar = song.getTimeSignatureNumerator ? song.getTimeSignatureNumerator() : 4;
  return Math.floor(tick / (beatsPerBar * ppqn)) + 1;
}

function posToTick(pos, song) {
  const ppqn = song.getPPQN ? song.getPPQN() : 480;
  const beatsPerBar = song.getTimeSignatureNumerator ? song.getTimeSignatureNumerator() : 4;
  return ((pos.bar - 1) * beatsPerBar + (pos.beat - 1)) * ppqn + (pos.tick ?? 0);
}

function durToTick(dur, song) {
  const ppqn = song.getPPQN ? song.getPPQN() : 480;
  const beatsPerBar = song.getTimeSignatureNumerator ? song.getTimeSignatureNumerator() : 4;
  return (dur.bars * beatsPerBar + (dur.beats ?? 0)) * ppqn + (dur.ticks ?? 0);
}

function dbToLinear(db) {
  if (db <= -144) return 0;
  return Math.pow(10, db / 20);
}

function num(v, min, max) {
  const n = parseFloat(v);
  if (isNaN(n) || n < min || n > max) throw new Error('Value ' + v + ' out of range ' + min + '–' + max);
  return n;
}

function int(v, min, max) {
  return Math.round(num(v, min, max));
}

function log(msg) {
  Host.Console.writeLine('[FornixMCPBridge] ' + msg);
}

module.exports = { activate, deactivate };

// ── Automation extension (appended) ──────────────────────────────────────────
// Patch the handle() switch via a separate dispatcher called after the main switch.
// In production this would be merged into the main switch above.

const _origHandle = handle;
// Use var assignment (not a function declaration) so _origHandle captures the
// original handle before this replacement takes effect. Function declarations
// are hoisted above the const assignment, causing infinite recursion.
// eslint-disable-next-line no-func-assign
var handle = function handleWithAutomation(client, raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { reply(client, null, false, null, 'Invalid JSON'); return; }
  const { command, params = {}, requestId } = msg;

  // Automation commands
  if (command === 'addAutomationPoints') {
    try {
      const song = Song.getActiveSong();
      if (!song) throw new Error('No active song');
      const tracks = song.getTracks();
      const track = tracks.find(t => t.getName().toLowerCase() === params.trackName.toLowerCase());
      if (!track) throw new Error('Track not found: ' + params.trackName);

      let lane = null;
      if (track.getAutomationLane) {
        lane = track.getAutomationLane(params.parameter);
        if (!lane && track.createAutomationLane) {
          lane = track.createAutomationLane(params.parameter);
        }
      }
      if (!lane) throw new Error('Automation lane unavailable for: ' + params.parameter);

      let added = 0;
      const ppqn = song.getPPQN ? song.getPPQN() : 480;
      const bpb   = song.getTimeSignatureNumerator ? song.getTimeSignatureNumerator() : 4;

      for (const pt of params.points) {
        const tick = ((pt.bar - 1) * bpb + (pt.beat - 1)) * ppqn;
        const value = params.isAbsolute ? pt.value : pt.value;
        if (lane.addPoint) { lane.addPoint(tick, value); added++; }
      }
      reply(client, requestId, true, { added });
    } catch(e) {
      reply(client, requestId, false, null, String(e));
    }
    return;
  }

  if (command === 'clearAutomation') {
    try {
      const song = Song.getActiveSong();
      const tracks = song.getTracks();
      const track = tracks.find(t => t.getName().toLowerCase() === params.trackName.toLowerCase());
      if (!track) throw new Error('Track not found: ' + params.trackName);
      const lane = track.getAutomationLane ? track.getAutomationLane(params.parameter) : null;
      if (!lane) throw new Error('Automation lane not found for: ' + params.parameter);

      const ppqn = song.getPPQN ? song.getPPQN() : 480;
      const bpb  = song.getTimeSignatureNumerator ? song.getTimeSignatureNumerator() : 4;
      const s = (params.startBar - 1) * bpb * ppqn;
      const e = (params.endBar - 1) * bpb * ppqn;
      let removed = 0;
      if (lane.clearRange) { lane.clearRange(s, e); removed = 1; }
      reply(client, requestId, true, { removed });
    } catch(e) {
      reply(client, requestId, false, null, String(e));
    }
    return;
  }

  // Fall through to original handler
  _origHandle(client, raw);
}
