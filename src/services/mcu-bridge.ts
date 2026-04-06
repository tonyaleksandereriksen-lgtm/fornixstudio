// ─── Fornix Studio MCP – MCU Bridge Service ──────────────────────────────────
//
// Connects to Studio One via a virtual MIDI port using the Mackie Control
// Universal protocol. S1 pushes state continuously (faders, transport, VU,
// track names). We can send commands back (transport, fader moves, mute/solo).
//
// Requirements:
//   - loopMIDI (or similar virtual MIDI driver) installed
//   - A virtual port created in loopMIDI (e.g. "Fornix MCU")
//   - S1: Options → External Devices → Add → Mackie Control → select the port
//   - The MCP server connects to the same virtual port
//
// The bridge is fully optional — the server works without it.

import {
  parseMcuMessage,
  MCU_CHANNELS,
  buildFaderMessage,
  buildButtonRelease,
  buildDeviceEnquiryResponse,
  buildHostConnectionReply,
  MCU_BUTTONS,
  type McuMessage,
  type McuFaderMessage,
  type McuButtonMessage,
  type McuVuMessage,
  type McuLcdMessage,
} from "./mcu-protocol.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface McuChannelState {
  name: string;
  fader: number;       // 0.0-1.0 normalized
  vu: number;          // 0-12
  solo: boolean;
  mute: boolean;
  recArm: boolean;
  select: boolean;
}

export interface McuTransportState {
  playing: boolean;
  recording: boolean;
  rewinding: boolean;
  forwarding: boolean;
}

export interface McuBridgeState {
  connected: boolean;
  handshakeOk: boolean;
  inputPort: string | null;
  outputPort: string | null;
  channels: McuChannelState[];
  transport: McuTransportState;
  bankOffset: number;
  timecode: string;
  lcdTop: string;      // 56 chars (track names)
  lcdBottom: string;   // 56 chars (values)
  messageCount: number;
  lastMessageAt: string | null;
}

// ─── State ────────────────────────────────────────────────────────────────────

let _jzz: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any -- JZZ is untyped
let _midiIn: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
let _midiOut: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
let _inputPortName: string | null = null;
let _outputPortName: string | null = null;
let _mcuHandshakeOk = false;
let _bankOffset = 0;
let _messageCount = 0;
let _lastMessageAt: string | null = null;
let _handshakeResolve: (() => void) | null = null;

const _channels: McuChannelState[] = Array.from({ length: MCU_CHANNELS }, () => ({
  name: "",
  fader: 0,
  vu: 0,
  solo: false,
  mute: false,
  recArm: false,
  select: false,
}));

const _transport: McuTransportState = {
  playing: false,
  recording: false,
  rewinding: false,
  forwarding: false,
};

let _timecodeDigits: string[] = Array(10).fill(" ");
let _lcdChars: string[] = Array(112).fill(" ");

const _onMessageCallbacks: Array<(msg: McuMessage) => void> = [];

// ─── JZZ dynamic import ──────────────────────────────────────────────────────

async function loadJzz(): Promise<any> {
  if (_jzz) return _jzz;
  try {
    // JZZ is CommonJS — use createRequire for ESM compatibility
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    _jzz = require("jzz");
    return _jzz;
  } catch {
    return null;
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────

function handleMidiMessage(data: number[]): void {
  const msg = parseMcuMessage(data);
  if (!msg) return;

  _messageCount++;
  _lastMessageAt = new Date().toISOString();

  switch (msg.type) {
    case "fader":
      handleFader(msg);
      break;
    case "button":
      handleButton(msg);
      break;
    case "vu":
      handleVu(msg);
      break;
    case "lcd":
      handleLcd(msg);
      break;
    case "timecode":
      _timecodeDigits[msg.digit] = msg.char;
      break;
    case "device_enquiry":
      handleDeviceEnquiry();
      break;
    case "host_connection_query":
      handleHostConnectionQuery(msg.serial, msg.challenge);
      break;
    case "host_connection_confirm":
      handleHostConnectionConfirm();
      break;
  }

  for (const cb of _onMessageCallbacks) {
    try { cb(msg); } catch { /* ignore */ }
  }
}

function handleFader(msg: McuFaderMessage): void {
  if (msg.channel >= 0 && msg.channel < MCU_CHANNELS) {
    _channels[msg.channel].fader = msg.normalized;
  }
  // channel 8 = master (not tracked in channel array)
}

function handleButton(msg: McuButtonMessage): void {
  const n = msg.note;
  const on = msg.pressed;

  // Per-channel buttons
  if (n >= 0 && n <= 7)   _channels[n].recArm = on;
  if (n >= 8 && n <= 15)  _channels[n - 8].solo = on;
  if (n >= 16 && n <= 23) _channels[n - 16].mute = on;
  if (n >= 24 && n <= 31) _channels[n - 24].select = on;

  // Transport LEDs
  if (n === 91) _transport.rewinding = on;
  if (n === 92) _transport.forwarding = on;
  if (n === 93 && on) { _transport.playing = false; _transport.recording = false; }
  if (n === 94) _transport.playing = on;
  if (n === 95) _transport.recording = on;
}

function handleVu(msg: McuVuMessage): void {
  if (msg.channel >= 0 && msg.channel < MCU_CHANNELS) {
    // Levels 0-12 are real levels; 14 = overload set, 15 = overload clear
    if (msg.level <= 12) {
      _channels[msg.channel].vu = msg.level;
    }
  }
}

function handleLcd(msg: McuLcdMessage): void {
  for (let i = 0; i < msg.text.length && msg.offset + i < 112; i++) {
    _lcdChars[msg.offset + i] = msg.text[i];
  }

  // Extract track names from top row (first 56 chars, 7 per channel)
  if (msg.row === 0) {
    for (let ch = 0; ch < MCU_CHANNELS; ch++) {
      const start = ch * 7;
      const name = _lcdChars.slice(start, start + 7).join("").trim();
      if (name) _channels[ch].name = name;
    }
  }
}

// ─── Handshake handlers ──────────────────────────────────────────────────────

function handleDeviceEnquiry(): void {
  process.stderr.write("[mcu-bridge] Received Device Enquiry — sending Identity Reply\n");
  sendMidi(buildDeviceEnquiryResponse());
}

function handleHostConnectionQuery(serial: number[], challenge: number[]): void {
  process.stderr.write(`[mcu-bridge] Host Connection Query — serial=${serial.map(b => b.toString(16).padStart(2, "0")).join(" ")}, responding\n`);
  sendMidi(buildHostConnectionReply(serial, challenge));
}

function handleHostConnectionConfirm(): void {
  _mcuHandshakeOk = true;
  process.stderr.write("[mcu-bridge] Host Connection Confirmed — handshake complete, S1 streaming\n");
  if (_handshakeResolve) {
    _handshakeResolve();
    _handshakeResolve = null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** List available MIDI ports. Returns null if JZZ is not available. */
export async function listMidiPorts(): Promise<{ inputs: string[]; outputs: string[] } | null> {
  const JZZ = await loadJzz();
  if (!JZZ) return null;

  return new Promise((resolve) => {
    const engine = JZZ();
    engine.or(() => resolve(null));
    engine.and(function (this: any) {
      const info = this.info();
      resolve({
        inputs: info.inputs.map((p: any) => p.name),
        outputs: info.outputs.map((p: any) => p.name),
      });
      this.close();
    });
  });
}

/**
 * Perform the MCU SysEx handshake with Studio One.
 * 1. Send Device Enquiry Response proactively to kick off the sequence.
 * 2. S1 sends Device Enquiry Request → we reply (handled in handleDeviceEnquiry).
 * 3. S1 sends Host Connection Query → we reply (handled in handleHostConnectionQuery).
 * 4. S1 sends Host Connection Confirmation → handshakeOk = true.
 * Resolves true if handshake completes within timeout, false otherwise.
 */
async function performMcuHandshake(timeoutMs = 5000): Promise<boolean> {
  if (_mcuHandshakeOk) return true;

  // Send proactive Device Enquiry Response to kick things off
  sendMidi(buildDeviceEnquiryResponse());
  process.stderr.write("[mcu-bridge] Sent proactive Device Enquiry Response\n");

  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      _handshakeResolve = null;
      if (_mcuHandshakeOk) {
        resolve(true);
      } else {
        process.stderr.write("[mcu-bridge] Handshake timeout — S1 may not have responded yet. Bridge still listening.\n");
        resolve(false);
      }
    }, timeoutMs);

    _handshakeResolve = () => {
      clearTimeout(timer);
      resolve(true);
    };

    // If it already completed (race), resolve immediately
    if (_mcuHandshakeOk) {
      clearTimeout(timer);
      _handshakeResolve = null;
      resolve(true);
    }
  });
}

/** Connect to a MIDI port pair for MCU communication. */
export async function connectMcu(inputPortName: string, outputPortName: string): Promise<{ ok: boolean; message: string }> {
  const JZZ = await loadJzz();
  if (!JZZ) {
    return { ok: false, message: "MIDI library (jzz) not available. Install with: npm install jzz" };
  }

  // Disconnect existing
  await disconnectMcu();

  return new Promise((resolve) => {
    try {
      const engine = JZZ();

      engine.or(() => {
        resolve({ ok: false, message: "Failed to start MIDI engine" });
      });

      engine.and(function (this: any) {
        const info = this.info();
        const inputExists = info.inputs.some((p: any) => p.name === inputPortName);
        const outputExists = info.outputs.some((p: any) => p.name === outputPortName);

        if (!inputExists) {
          resolve({ ok: false, message: `MIDI input "${inputPortName}" not found. Available: ${info.inputs.map((p: any) => p.name).join(", ")}` });
          return;
        }
        if (!outputExists) {
          resolve({ ok: false, message: `MIDI output "${outputPortName}" not found. Available: ${info.outputs.map((p: any) => p.name).join(", ")}` });
          return;
        }

        // Open input
        const midiIn = this.openMidiIn(inputPortName);
        midiIn.or(() => {
          resolve({ ok: false, message: `Failed to open MIDI input "${inputPortName}"` });
        });
        midiIn.and(function () {
          _midiIn = midiIn;
          _inputPortName = inputPortName;

          // Connect message handler
          midiIn.connect(function (msg: any) {
            const bytes: number[] = [];
            for (let i = 0; i < msg.length; i++) {
              bytes.push(msg[i]);
            }
            handleMidiMessage(bytes);
          });

          // Open output
          const midiOut = engine.openMidiOut(outputPortName);
          midiOut.or(() => {
            resolve({ ok: false, message: `Failed to open MIDI output "${outputPortName}"` });
          });
          midiOut.and(async function () {
            _midiOut = midiOut;
            _outputPortName = outputPortName;
            process.stderr.write(`[mcu-bridge] Ports open: in="${inputPortName}" out="${outputPortName}"\n`);

            // Perform MCU handshake (5s timeout)
            const handshakeOk = await performMcuHandshake();
            const handshakeNote = handshakeOk
              ? "Handshake complete — S1 is streaming."
              : "Handshake pending — S1 may start streaming after it detects the surface.";

            resolve({
              ok: true,
              message: `MCU bridge connected. Input: ${inputPortName}, Output: ${outputPortName}. ${handshakeNote}`,
            });
          });
        });
      });
    } catch (e) {
      resolve({ ok: false, message: `MIDI connection error: ${e}` });
    }
  });
}

/** Disconnect and clean up. */
export async function disconnectMcu(): Promise<void> {
  if (_midiIn) {
    try { _midiIn.close(); } catch { /* ignore */ }
    _midiIn = null;
  }
  if (_midiOut) {
    try { _midiOut.close(); } catch { /* ignore */ }
    _midiOut = null;
  }
  _inputPortName = null;
  _outputPortName = null;
  _mcuHandshakeOk = false;
  _handshakeResolve = null;
  _messageCount = 0;
  _lastMessageAt = null;

  // Reset channel state
  for (let i = 0; i < MCU_CHANNELS; i++) {
    _channels[i] = { name: "", fader: 0, vu: 0, solo: false, mute: false, recArm: false, select: false };
  }
  _transport.playing = false;
  _transport.recording = false;
  _transport.rewinding = false;
  _transport.forwarding = false;
  _timecodeDigits = Array(10).fill(" ");
  _lcdChars = Array(112).fill(" ");
  _bankOffset = 0;
}

/** Send raw MIDI bytes to S1. */
export function sendMidi(bytes: number[]): boolean {
  if (!_midiOut) return false;
  try {
    _midiOut.send(bytes);
    return true;
  } catch {
    return false;
  }
}

/** Send a button press followed by release (MCU expects both). */
function sendMidiPressRelease(note: number): boolean {
  const pressOk = sendMidi([0x90, note & 0x7f, 0x7f]);
  if (!pressOk) return false;
  return sendMidi(buildButtonRelease(note));
}

/** Send a transport command (press + release). */
export function sendTransport(command: "play" | "stop" | "record" | "rewind" | "forward"): boolean {
  const noteMap: Record<string, number> = {
    play: MCU_BUTTONS.PLAY, stop: MCU_BUTTONS.STOP, record: MCU_BUTTONS.RECORD,
    rewind: MCU_BUTTONS.REWIND, forward: MCU_BUTTONS.FORWARD,
  };
  return sendMidiPressRelease(noteMap[command]);
}

/** Send a button press+release (for tool-level use). */
export function sendButton(note: number): boolean {
  return sendMidiPressRelease(note);
}

/** Send a fader move. */
export function sendFader(channel: number, normalizedValue: number): boolean {
  return sendMidi(buildFaderMessage(channel, normalizedValue));
}

/** Send a solo/mute toggle (press + release). */
export function sendSolo(channel: number): boolean {
  return sendMidiPressRelease(MCU_BUTTONS.SOLO_BASE + (channel & 0x07));
}

export function sendMute(channel: number): boolean {
  return sendMidiPressRelease(MCU_BUTTONS.MUTE_BASE + (channel & 0x07));
}

/** Switch bank (8 channels at a time). */
export function sendBankLeft(): boolean {
  const ok = sendMidiPressRelease(MCU_BUTTONS.BANK_LEFT);
  if (ok && _bankOffset > 0) _bankOffset -= 8;
  return ok;
}

export function sendBankRight(): boolean {
  const ok = sendMidiPressRelease(MCU_BUTTONS.BANK_RIGHT);
  if (ok) _bankOffset += 8;
  return ok;
}

/** Get full bridge state. */
export function getMcuBridgeState(): McuBridgeState {
  return {
    connected: _midiIn !== null && _midiOut !== null,
    handshakeOk: _mcuHandshakeOk,
    inputPort: _inputPortName,
    outputPort: _outputPortName,
    channels: _channels.map(ch => ({ ...ch })),
    transport: { ..._transport },
    bankOffset: _bankOffset,
    timecode: _timecodeDigits.slice().reverse().join("").trim(),
    lcdTop: _lcdChars.slice(0, 56).join(""),
    lcdBottom: _lcdChars.slice(56, 112).join(""),
    messageCount: _messageCount,
    lastMessageAt: _lastMessageAt,
  };
}

/** Register a callback for incoming MCU messages. */
export function onMcuMessage(callback: (msg: McuMessage) => void): void {
  _onMessageCallbacks.push(callback);
}

/** Check if the MCU bridge is connected and receiving data. */
export function isMcuConnected(): boolean {
  return _midiIn !== null && _midiOut !== null;
}
