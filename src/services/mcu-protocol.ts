// ─── Fornix Studio MCP – Mackie Control Protocol ──────────────────────────────
//
// Pure protocol layer: parsing incoming MCU MIDI messages from a DAW and
// building outgoing messages to send TO the DAW. No I/O — fully testable.
//
// MCU uses standard MIDI messages with specific assignments:
//   Pitch Bend (0xEn)    → Fader positions (14-bit, channels 0-7 + 8=master)
//   Note On/Off (0x90)   → Buttons/LEDs (transport, solo, mute, arm, etc.)
//   Channel Pressure (0xD0) → VU meters (nibble-packed: channel + level)
//   Control Change (0xBn) → V-Pot rings, timecode digits, jog wheel
//   SysEx (F0…F7)        → LCD text, handshake

// ─── Constants ────────────────────────────────────────────────────────────────

export const MCU_CHANNELS = 8;
export const MCU_SYSEX_HEADER = [0x00, 0x00, 0x66, 0x10]; // Mackie Control Universal (0x10 = main unit, 0x14 = extender)

// Button note assignments (MIDI channel 0)
export const MCU_BUTTONS = {
  // Per-channel (add channel 0-7)
  REC_ARM_BASE:  0,   // 0-7
  SOLO_BASE:     8,   // 8-15
  MUTE_BASE:    16,   // 16-23
  SELECT_BASE:  24,   // 24-31
  VPOT_PRESS_BASE: 32, // 32-39

  // Mode
  TRACK:        40,
  SEND:         41,
  PAN:          42,
  PLUGIN:       43,
  EQ:           44,
  INSTRUMENT:   45,

  // Navigation
  BANK_LEFT:    46,
  BANK_RIGHT:   47,
  CHANNEL_LEFT: 48,
  CHANNEL_RIGHT:49,
  FLIP:         50,

  // Function keys
  F1:           54,
  F2:           55,
  F3:           56,
  F4:           57,
  F5:           58,
  F6:           59,
  F7:           60,
  F8:           61,

  // Modifiers
  SHIFT:        70,
  OPTION:       71,
  CONTROL:      72,
  ALT:          73,

  // Automation
  AUTO_READ:    74,
  AUTO_WRITE:   75,
  AUTO_TRIM:    76,
  AUTO_TOUCH:   77,
  AUTO_LATCH:   78,

  // Utility
  SAVE:         80,
  UNDO:         81,
  CANCEL:       82,
  ENTER:        83,

  // Transport
  REWIND:       91,
  FORWARD:      92,
  STOP:         93,
  PLAY:         94,
  RECORD:       95,

  // Cursor
  CURSOR_UP:    96,
  CURSOR_DOWN:  97,
  CURSOR_LEFT:  98,
  CURSOR_RIGHT: 99,

  // Fader touch (receive only — DAW sends these to indicate fader is being touched)
  FADER_TOUCH_BASE: 104, // 104-112 (ch1-8 + master)
} as const;

// ─── Incoming message types ───────────────────────────────────────────────────

export interface McuFaderMessage {
  type: "fader";
  channel: number;     // 0-7 = strips, 8 = master
  value: number;       // 0-16383 (14-bit)
  normalized: number;  // 0.0-1.0
}

export interface McuButtonMessage {
  type: "button";
  note: number;
  pressed: boolean;
  name: string;        // human-readable label
}

export interface McuVuMessage {
  type: "vu";
  channel: number;     // 0-7
  level: number;       // 0-12 (13 levels), 14=overload, 15=clear overload
}

export interface McuLcdMessage {
  type: "lcd";
  offset: number;      // character position (0-111)
  text: string;
  row: number;         // 0 = top (track names), 1 = bottom (values)
  col: number;         // character column within row
}

export interface McuTimecodeMessage {
  type: "timecode";
  digit: number;       // 0-9 position (right to left)
  char: string;
}

export interface McuVpotRingMessage {
  type: "vpot_ring";
  channel: number;     // 0-7
  value: number;       // ring position data
}

export interface McuDeviceEnquiryMessage {
  type: "device_enquiry";
}

export interface McuHostConnectionQueryMessage {
  type: "host_connection_query";
  serial: number[];    // 7 bytes
  challenge: number[]; // 4 bytes
}

export interface McuHostConnectionConfirmMessage {
  type: "host_connection_confirm";
  serial: number[];    // 7 bytes
}

export type McuMessage =
  | McuFaderMessage
  | McuButtonMessage
  | McuVuMessage
  | McuLcdMessage
  | McuTimecodeMessage
  | McuVpotRingMessage
  | McuDeviceEnquiryMessage
  | McuHostConnectionQueryMessage
  | McuHostConnectionConfirmMessage;

// ─── Button name resolver ─────────────────────────────────────────────────────

function resolveButtonName(note: number): string {
  if (note >= 0 && note <= 7) return `rec_arm_${note + 1}`;
  if (note >= 8 && note <= 15) return `solo_${note - 7}`;
  if (note >= 16 && note <= 23) return `mute_${note - 15}`;
  if (note >= 24 && note <= 31) return `select_${note - 23}`;
  if (note >= 32 && note <= 39) return `vpot_press_${note - 31}`;
  if (note >= 104 && note <= 112) return `fader_touch_${note - 103}`;

  const names: Record<number, string> = {
    40: "track", 41: "send", 42: "pan", 43: "plugin", 44: "eq", 45: "instrument",
    46: "bank_left", 47: "bank_right", 48: "channel_left", 49: "channel_right",
    50: "flip", 51: "global_view",
    54: "f1", 55: "f2", 56: "f3", 57: "f4", 58: "f5", 59: "f6", 60: "f7", 61: "f8",
    70: "shift", 71: "option", 72: "control", 73: "alt",
    74: "auto_read", 75: "auto_write", 76: "auto_trim", 77: "auto_touch", 78: "auto_latch",
    80: "save", 81: "undo", 82: "cancel", 83: "enter",
    91: "rewind", 92: "forward", 93: "stop", 94: "play", 95: "record",
    96: "cursor_up", 97: "cursor_down", 98: "cursor_left", 99: "cursor_right",
  };

  return names[note] ?? `unknown_${note}`;
}

// ─── Parse incoming MIDI bytes ────────────────────────────────────────────────

export function parseMcuMessage(data: number[]): McuMessage | null {
  if (data.length < 1) return null;

  const status = data[0] & 0xf0;
  const channel = data[0] & 0x0f;

  // Pitch Bend → Fader position
  if (status === 0xe0 && data.length >= 3) {
    const value = (data[2] << 7) | data[1]; // 14-bit
    return {
      type: "fader",
      channel,
      value,
      normalized: value / 16383,
    };
  }

  // Note On → Button press / LED state
  if (status === 0x90 && data.length >= 3) {
    const note = data[1];
    const velocity = data[2];
    return {
      type: "button",
      note,
      pressed: velocity >= 0x40,
      name: resolveButtonName(note),
    };
  }

  // Channel Pressure → VU meters
  if (status === 0xd0 && data.length >= 2) {
    const raw = data[1];
    const ch = (raw >> 4) & 0x07;
    const level = raw & 0x0f;
    return {
      type: "vu",
      channel: ch,
      level,
    };
  }

  // Control Change → V-Pot rings, timecode
  if (status === 0xb0 && data.length >= 3) {
    const cc = data[1];
    const value = data[2];

    // V-Pot LED rings (CC 48-55)
    if (cc >= 48 && cc <= 55) {
      return {
        type: "vpot_ring",
        channel: cc - 48,
        value,
      };
    }

    // Timecode digits (CC 64-73)
    if (cc >= 64 && cc <= 73) {
      return {
        type: "timecode",
        digit: cc - 64,
        char: String.fromCharCode(value & 0x7f),
      };
    }
  }

  // SysEx messages
  if (data[0] === 0xf0 && data.length >= 6) {
    // Universal SysEx: Device Enquiry Request (F0 7E 7F 06 01 F7)
    if (data[1] === 0x7e && data[3] === 0x06 && data[4] === 0x01) {
      return { type: "device_enquiry" };
    }

    // MCU SysEx: F0 00 00 66 10 <command> ...
    if (data.length >= 8 && data[1] === 0x00 && data[2] === 0x00 && data[3] === 0x66 && data[4] === 0x10) {
      const command = data[5];

      // Host Connection Query (command 0x01): serial[7] + challenge[4]
      if (command === 0x01 && data.length >= 18) {
        return {
          type: "host_connection_query",
          serial: data.slice(6, 13),
          challenge: data.slice(13, 17),
        };
      }

      // Host Connection Confirmation (command 0x03): serial[7]
      if (command === 0x03 && data.length >= 14) {
        return {
          type: "host_connection_confirm",
          serial: data.slice(6, 13),
        };
      }

      // LCD update (command 0x12)
      if (command === 0x12 && data.length >= 8) {
        const offset = data[6];
        const textBytes = data.slice(7, -1); // exclude trailing F7
        const text = textBytes.map(b => String.fromCharCode(b & 0x7f)).join("");
        const row = offset < 56 ? 0 : 1;
        const col = offset < 56 ? offset : offset - 56;
        return {
          type: "lcd",
          offset,
          text,
          row,
          col,
        };
      }
    }
  }

  return null;
}

// ─── Build outgoing MIDI messages ─────────────────────────────────────────────

/** Build a fader move message (Pitch Bend). */
export function buildFaderMessage(channel: number, normalizedValue: number): number[] {
  const value = Math.round(Math.max(0, Math.min(1, normalizedValue)) * 16383);
  const lsb = value & 0x7f;
  const msb = (value >> 7) & 0x7f;
  return [0xe0 | (channel & 0x0f), lsb, msb];
}

/** Build a button press (Note On with velocity 0x7F). */
export function buildButtonPress(note: number): number[] {
  return [0x90, note & 0x7f, 0x7f];
}

/** Build a button release (Note On with velocity 0x00). */
export function buildButtonRelease(note: number): number[] {
  return [0x90, note & 0x7f, 0x00];
}

/** Build a V-Pot turn (CC 16-23, value: 0x01-0x0F = right, 0x41-0x4F = left). */
export function buildVpotTurn(channel: number, steps: number): number[] {
  const cc = 16 + (channel & 0x07);
  const value = steps > 0
    ? Math.min(steps, 15)
    : (0x40 | Math.min(-steps, 15));
  return [0xb0, cc, value];
}

/** Build bank switch commands (move 8 channels). */
export function buildBankLeft(): number[]  { return buildButtonPress(MCU_BUTTONS.BANK_LEFT); }
export function buildBankRight(): number[] { return buildButtonPress(MCU_BUTTONS.BANK_RIGHT); }

/** Build transport commands. */
export function buildPlay(): number[]    { return buildButtonPress(MCU_BUTTONS.PLAY); }
export function buildStop(): number[]    { return buildButtonPress(MCU_BUTTONS.STOP); }
export function buildRecord(): number[]  { return buildButtonPress(MCU_BUTTONS.RECORD); }
export function buildRewind(): number[]  { return buildButtonPress(MCU_BUTTONS.REWIND); }
export function buildForward(): number[] { return buildButtonPress(MCU_BUTTONS.FORWARD); }
export function buildSave(): number[]    { return buildButtonPress(MCU_BUTTONS.SAVE); }
export function buildUndo(): number[]    { return buildButtonPress(MCU_BUTTONS.UNDO); }

/** Build solo/mute/select/arm toggle for a channel strip (0-7). */
export function buildSolo(channel: number): number[] {
  return buildButtonPress(MCU_BUTTONS.SOLO_BASE + (channel & 0x07));
}
export function buildMute(channel: number): number[] {
  return buildButtonPress(MCU_BUTTONS.MUTE_BASE + (channel & 0x07));
}
export function buildSelect(channel: number): number[] {
  return buildButtonPress(MCU_BUTTONS.SELECT_BASE + (channel & 0x07));
}
export function buildRecArm(channel: number): number[] {
  return buildButtonPress(MCU_BUTTONS.REC_ARM_BASE + (channel & 0x07));
}

// ─── Handshake SysEx builders ────────────────────────────────────────────────

/**
 * Build Device Enquiry Response (Identity Reply).
 * F0 7E 7F 06 02  00 00 66  10  56 31 2E 34 32  F7
 * Universal SysEx  Mackie   MCU   "V1.42"        EOX
 */
export function buildDeviceEnquiryResponse(): number[] {
  return [
    0xf0, 0x7e, 0x7f, 0x06, 0x02,  // Universal SysEx Identity Reply
    0x00, 0x00, 0x66,                // Manufacturer: Mackie
    0x10,                            // Device: MCU main unit
    0x56, 0x31, 0x2e, 0x34, 0x32,   // Version: "V1.42"
    0xf7,
  ];
}

/**
 * Compute the MCU challenge response.
 * Standard MCU handshake math (Mackie Control specification):
 *   R[0] = 0x7F & (C[0] + (C[3] ^ 0x0A))
 *   R[1] = 0x7F & (C[1] + (C[2] ^ 0x0A))
 *   R[2] = 0x7F & (C[2] + (C[1] ^ 0x0A))
 *   R[3] = 0x7F & (C[3] + (C[0] ^ 0x0A))
 */
export function computeChallengeResponse(challenge: number[]): number[] {
  return [
    0x7f & (challenge[0] + (challenge[3] ^ 0x0a)),
    0x7f & (challenge[1] + (challenge[2] ^ 0x0a)),
    0x7f & (challenge[2] + (challenge[1] ^ 0x0a)),
    0x7f & (challenge[3] + (challenge[0] ^ 0x0a)),
  ];
}

/**
 * Build Host Connection Reply.
 * F0 00 00 66 10 02  <serial[7]> <response[4]>  F7
 */
export function buildHostConnectionReply(serial: number[], challenge: number[]): number[] {
  const response = computeChallengeResponse(challenge);
  return [
    0xf0, ...MCU_SYSEX_HEADER, 0x02,  // command 0x02 = Host Connection Reply
    ...serial,
    ...response,
    0xf7,
  ];
}
