
import test from "node:test";
import assert from "node:assert/strict";

import {
  parseMcuMessage,
  buildFaderMessage,
  buildButtonPress,
  buildButtonRelease,
  buildVpotTurn,
  buildPlay,
  buildStop,
  buildRecord,
  buildSolo,
  buildMute,
  buildBankLeft,
  buildBankRight,
  buildSave,
  buildUndo,
  MCU_BUTTONS,
} from "../../dist/services/mcu-protocol.js";

// ─── Parsing tests ────────────────────────────────────────────────────────────

test("parseMcuMessage: pitch bend → fader", () => {
  // Channel 0, value = 8192 (mid-point)
  const msg = parseMcuMessage([0xe0, 0x00, 0x40]);
  assert.equal(msg.type, "fader");
  assert.equal(msg.channel, 0);
  assert.equal(msg.value, 8192);
  assert.ok(Math.abs(msg.normalized - 0.5) < 0.01);
});

test("parseMcuMessage: pitch bend channel 8 → master fader", () => {
  const msg = parseMcuMessage([0xe8, 0x7f, 0x7f]);
  assert.equal(msg.type, "fader");
  assert.equal(msg.channel, 8);
  assert.equal(msg.value, 16383);
  assert.ok(Math.abs(msg.normalized - 1.0) < 0.001);
});

test("parseMcuMessage: pitch bend zero → fader at 0", () => {
  const msg = parseMcuMessage([0xe0, 0x00, 0x00]);
  assert.equal(msg.type, "fader");
  assert.equal(msg.value, 0);
  assert.equal(msg.normalized, 0);
});

test("parseMcuMessage: note on → button press", () => {
  // Play button (note 94), velocity 0x7F
  const msg = parseMcuMessage([0x90, 94, 0x7f]);
  assert.equal(msg.type, "button");
  assert.equal(msg.note, 94);
  assert.equal(msg.pressed, true);
  assert.equal(msg.name, "play");
});

test("parseMcuMessage: note on velocity 0 → button release", () => {
  const msg = parseMcuMessage([0x90, 93, 0x00]);
  assert.equal(msg.type, "button");
  assert.equal(msg.name, "stop");
  assert.equal(msg.pressed, false);
});

test("parseMcuMessage: solo button (note 8-15)", () => {
  const msg = parseMcuMessage([0x90, 10, 0x7f]);
  assert.equal(msg.type, "button");
  assert.equal(msg.name, "solo_3");
  assert.equal(msg.pressed, true);
});

test("parseMcuMessage: mute button (note 16-23)", () => {
  const msg = parseMcuMessage([0x90, 19, 0x7f]);
  assert.equal(msg.type, "button");
  assert.equal(msg.name, "mute_4");
});

test("parseMcuMessage: channel pressure → VU meter", () => {
  // Channel 2, level 8
  const raw = (2 << 4) | 8; // 0x28
  const msg = parseMcuMessage([0xd0, raw]);
  assert.equal(msg.type, "vu");
  assert.equal(msg.channel, 2);
  assert.equal(msg.level, 8);
});

test("parseMcuMessage: control change → vpot ring", () => {
  const msg = parseMcuMessage([0xb0, 50, 0x2a]);
  assert.equal(msg.type, "vpot_ring");
  assert.equal(msg.channel, 2); // CC 50 = channel 2
  assert.equal(msg.value, 0x2a);
});

test("parseMcuMessage: control change → timecode digit", () => {
  const msg = parseMcuMessage([0xb0, 67, 0x35]); // CC 67, char '5'
  assert.equal(msg.type, "timecode");
  assert.equal(msg.digit, 3); // 67 - 64
  assert.equal(msg.char, "5");
});

test("parseMcuMessage: SysEx → LCD text", () => {
  // F0 00 00 66 14 12 [offset] [text bytes...] F7
  const text = "Kick   ";
  const bytes = [0xf0, 0x00, 0x00, 0x66, 0x14, 0x12, 0x00,
    ...Array.from(text).map(c => c.charCodeAt(0)),
    0xf7];
  const msg = parseMcuMessage(bytes);
  assert.equal(msg.type, "lcd");
  assert.equal(msg.offset, 0);
  assert.equal(msg.text, "Kick   ");
  assert.equal(msg.row, 0);
  assert.equal(msg.col, 0);
});

test("parseMcuMessage: LCD bottom row (offset >= 56)", () => {
  const bytes = [0xf0, 0x00, 0x00, 0x66, 0x14, 0x12, 60,
    0x41, 0x42, 0x43, // "ABC"
    0xf7];
  const msg = parseMcuMessage(bytes);
  assert.equal(msg.type, "lcd");
  assert.equal(msg.row, 1);
  assert.equal(msg.col, 4); // 60 - 56
});

test("parseMcuMessage: returns null for unknown messages", () => {
  assert.equal(parseMcuMessage([0xf2, 0x00, 0x00]), null);
  assert.equal(parseMcuMessage([]), null);
});

// ─── Builder tests ────────────────────────────────────────────────────────────

test("buildFaderMessage produces valid pitch bend", () => {
  const bytes = buildFaderMessage(3, 0.5);
  assert.equal(bytes[0], 0xe3); // channel 3
  assert.equal(bytes.length, 3);
  // Reconstruct value
  const value = (bytes[2] << 7) | bytes[1];
  assert.ok(Math.abs(value - 8192) < 2); // near midpoint
});

test("buildFaderMessage clamps values", () => {
  const low = buildFaderMessage(0, -0.5);
  const lowVal = (low[2] << 7) | low[1];
  assert.equal(lowVal, 0);

  const high = buildFaderMessage(0, 1.5);
  const highVal = (high[2] << 7) | high[1];
  assert.equal(highVal, 16383);
});

test("buildButtonPress sends note on with velocity 0x7F", () => {
  const bytes = buildButtonPress(94); // play
  assert.deepEqual(bytes, [0x90, 94, 0x7f]);
});

test("buildButtonRelease sends note on with velocity 0x00", () => {
  const bytes = buildButtonRelease(94);
  assert.deepEqual(bytes, [0x90, 94, 0x00]);
});

test("buildVpotTurn: positive steps = right turn", () => {
  const bytes = buildVpotTurn(2, 5); // channel 2, 5 steps right
  assert.equal(bytes[0], 0xb0);
  assert.equal(bytes[1], 18); // CC 16+2
  assert.equal(bytes[2], 5);
});

test("buildVpotTurn: negative steps = left turn", () => {
  const bytes = buildVpotTurn(0, -3);
  assert.equal(bytes[0], 0xb0);
  assert.equal(bytes[1], 16); // CC 16+0
  assert.equal(bytes[2], 0x43); // 0x40 | 3
});

test("transport builders produce correct note numbers", () => {
  assert.deepEqual(buildPlay(), [0x90, 94, 0x7f]);
  assert.deepEqual(buildStop(), [0x90, 93, 0x7f]);
  assert.deepEqual(buildRecord(), [0x90, 95, 0x7f]);
  assert.deepEqual(buildSave(), [0x90, 80, 0x7f]);
  assert.deepEqual(buildUndo(), [0x90, 81, 0x7f]);
});

test("channel builders use correct offset", () => {
  const solo3 = buildSolo(2); // channel 2 (0-indexed)
  assert.deepEqual(solo3, [0x90, 10, 0x7f]); // SOLO_BASE=8 + 2 = 10

  const mute1 = buildMute(0);
  assert.deepEqual(mute1, [0x90, 16, 0x7f]); // MUTE_BASE=16 + 0

  const bankL = buildBankLeft();
  assert.deepEqual(bankL, [0x90, 46, 0x7f]);

  const bankR = buildBankRight();
  assert.deepEqual(bankR, [0x90, 47, 0x7f]);
});

// ─── Roundtrip tests ──────────────────────────────────────────────────────────

test("fader roundtrip: build → parse", () => {
  const built = buildFaderMessage(5, 0.74);
  const parsed = parseMcuMessage(built);
  assert.equal(parsed.type, "fader");
  assert.equal(parsed.channel, 5);
  assert.ok(Math.abs(parsed.normalized - 0.74) < 0.001);
});

test("button roundtrip: build → parse", () => {
  const built = buildButtonPress(MCU_BUTTONS.RECORD);
  const parsed = parseMcuMessage(built);
  assert.equal(parsed.type, "button");
  assert.equal(parsed.name, "record");
  assert.equal(parsed.pressed, true);
});
