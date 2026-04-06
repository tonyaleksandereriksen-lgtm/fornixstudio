// ─── Fornix Studio MCP – MCU Bridge Tools ────────────────────────────────────
//
// MCP tools for the Mackie Control virtual surface bridge.
// Provides real-time bidirectional communication with Studio One via MIDI.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  listMidiPorts,
  connectMcu,
  disconnectMcu,
  getMcuBridgeState,
  isMcuConnected,
  sendTransport,
  sendFader,
  sendSolo,
  sendMute,
  sendBankLeft,
  sendBankRight,
  sendButton,
} from "../services/mcu-bridge.js";
import { MCU_BUTTONS } from "../services/mcu-protocol.js";
import { logAction, formatToolResult, truncate } from "../services/logger.js";

export function registerMcuBridgeTools(server: McpServer): void {

  // ── mcu_list_ports ──────────────────────────────────────────────────────────

  server.registerTool("mcu_list_ports", {
    title: "List MIDI Ports",
    description:
      "List all available MIDI input and output ports on this system. " +
      "Use this to find the correct loopMIDI port name for connecting the MCU bridge.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => {
    const ports = await listMidiPorts();
    if (!ports) {
      return {
        content: [{ type: "text", text:
          "✗ MIDI library not available.\n\n" +
          "The MCU bridge requires the 'jzz' npm package. It should already be installed.\n" +
          "If not: npm install jzz" }],
        isError: true,
      };
    }

    const lines = [
      "═══ MIDI Ports ═══",
      "",
      `Inputs (${ports.inputs.length}):`,
      ...ports.inputs.map(p => `  ← ${p}`),
      "",
      `Outputs (${ports.outputs.length}):`,
      ...ports.outputs.map(p => `  → ${p}`),
      "",
      "To use the MCU bridge:",
      "  1. Install loopMIDI and create a port (e.g. \"Fornix MCU\")",
      "  2. In Studio One: Options → External Devices → Add → Mackie Control",
      "     Set Receive From and Send To to your loopMIDI port",
      "  3. Call mcu_connect with the port name",
    ];

    return { content: [{ type: "text", text: lines.join("\n") }] };
  });

  // ── mcu_connect ─────────────────────────────────────────────────────────────

  server.registerTool("mcu_connect", {
    title: "Connect MCU Bridge",
    description:
      "Connect to Studio One via a virtual MIDI port using Mackie Control protocol. " +
      "Requires a loopMIDI virtual port configured as a Mackie Control surface in S1. " +
      "Once connected, S1 pushes track names, fader positions, transport state, and VU meters " +
      "continuously — no polling needed. Use mcu_list_ports to find available port names.",
    inputSchema: {
      portName: z.string().describe(
        "Name of the loopMIDI virtual port (used for both input and output). " +
        "Example: \"Fornix MCU\" or \"loopMIDI Port\""
      ),
      inputPort: z.string().optional().describe("Override: specific input port name (if different from output)"),
      outputPort: z.string().optional().describe("Override: specific output port name (if different from input)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ portName, inputPort, outputPort }) => {
    const inPort = inputPort ?? portName;
    const outPort = outputPort ?? portName;

    const result = await connectMcu(inPort, outPort);

    if (!result.ok) {
      return { content: [{ type: "text", text: `✗ ${result.message}` }], isError: true };
    }

    logAction({ tool: "mcu_connect", action: "s1_bridge", summary: result.message, dryRun: false, ok: true });
    return {
      content: [{ type: "text", text: formatToolResult(true, "MCU bridge connected",
        `${result.message}\n\n` +
        "S1 is now streaming state. Use these tools:\n" +
        "  mcu_state      — see all channel strips, transport, faders, VU\n" +
        "  mcu_transport   — play/stop/record\n" +
        "  mcu_fader       — set track volume\n" +
        "  mcu_solo/mute   — toggle solo/mute\n" +
        "  mcu_bank        — navigate to different track groups") }],
    };
  });

  // ── mcu_disconnect ──────────────────────────────────────────────────────────

  server.registerTool("mcu_disconnect", {
    title: "Disconnect MCU Bridge",
    description: "Disconnect the MCU MIDI bridge and clear state.",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async () => {
    if (!isMcuConnected()) {
      return { content: [{ type: "text", text: "MCU bridge is not connected." }] };
    }
    await disconnectMcu();
    logAction({ tool: "mcu_disconnect", action: "s1_bridge", summary: "MCU bridge disconnected", dryRun: false, ok: true });
    return { content: [{ type: "text", text: "✓ MCU bridge disconnected." }] };
  });

  // ── mcu_state ───────────────────────────────────────────────────────────────

  server.registerTool("mcu_state", {
    title: "MCU Bridge State",
    description:
      "Get the current state of the MCU bridge: all 8 visible channel strips " +
      "(names, fader positions, solo/mute/arm, VU levels), transport state, " +
      "timecode position, and LCD display. This is real-time data pushed by Studio One. " +
      "Call mcu_bank to navigate to different groups of 8 tracks.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, async () => {
    if (!isMcuConnected()) {
      return {
        content: [{ type: "text", text:
          "⚠ MCU bridge not connected.\n\n" +
          "Connect with mcu_connect first. Requires loopMIDI + S1 Mackie Control setup." }],
        isError: true,
      };
    }

    const state = getMcuBridgeState();
    const lines: string[] = [
      "═══ MCU Bridge State ═══",
      "",
      `Ports: in="${state.inputPort}" out="${state.outputPort}"`,
      `Handshake: ${state.handshakeOk ? "OK — S1 is streaming" : "PENDING — waiting for S1"}`,
      `Messages received: ${state.messageCount}`,
      `Last message: ${state.lastMessageAt ?? "never"}`,
      `Bank offset: ${state.bankOffset} (showing tracks ${state.bankOffset + 1}–${state.bankOffset + 8})`,
      `Timecode: ${state.timecode || "—"}`,
      "",
    ];

    // Transport
    const tParts: string[] = [];
    if (state.transport.playing)    tParts.push("▶ PLAYING");
    if (state.transport.recording)  tParts.push("⏺ RECORDING");
    if (state.transport.rewinding)  tParts.push("⏪ REW");
    if (state.transport.forwarding) tParts.push("⏩ FWD");
    if (tParts.length === 0)        tParts.push("⏹ STOPPED");
    lines.push(`Transport: ${tParts.join(" | ")}`, "");

    // Channel strips
    lines.push("── Channel Strips ──");
    lines.push("  #  Name       Fader   VU   Solo Mute Arm");
    lines.push("  ── ────────── ─────── ──── ──── ──── ───");
    for (let i = 0; i < 8; i++) {
      const ch = state.channels[i];
      const name = (ch.name || "—").padEnd(10).slice(0, 10);
      const faderDb = ch.fader > 0 ? faderToDb(ch.fader).toFixed(1).padStart(6) + " dB" : "  -inf dB";
      const vuBar = "█".repeat(Math.round(ch.vu * 1.5)) + "░".repeat(Math.max(0, 18 - Math.round(ch.vu * 1.5)));
      const solo = ch.solo ? " S " : "   ";
      const mute = ch.mute ? " M " : "   ";
      const arm = ch.recArm ? " R " : "   ";
      lines.push(`  ${(i + 1).toString().padStart(1)}  ${name} ${faderDb}  ${vuBar} ${solo} ${mute} ${arm}`);
    }

    // LCD
    if (state.lcdTop.trim() || state.lcdBottom.trim()) {
      lines.push("", "── LCD Display ──");
      lines.push(`  Top:    "${state.lcdTop.trimEnd()}"`);
      lines.push(`  Bottom: "${state.lcdBottom.trimEnd()}"`);
    }

    return { content: [{ type: "text", text: truncate(lines.join("\n")) }] };
  });

  // ── mcu_transport ───────────────────────────────────────────────────────────

  server.registerTool("mcu_transport", {
    title: "MCU Transport Control",
    description:
      "Send transport commands to Studio One via the MCU bridge: " +
      "play, stop, record, rewind, forward. Requires mcu_connect first.",
    inputSchema: {
      command: z.enum(["play", "stop", "record", "rewind", "forward"])
        .describe("Transport command to send"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ command }) => {
    if (!isMcuConnected()) {
      return { content: [{ type: "text", text: "✗ MCU bridge not connected." }], isError: true };
    }

    const ok = sendTransport(command);
    const summary = `Transport: ${command}`;
    logAction({ tool: "mcu_transport", action: "s1_bridge", summary, dryRun: false, ok });

    return {
      content: [{ type: "text", text: ok ? `✓ Sent: ${command}` : `✗ Failed to send: ${command}` }],
      isError: !ok,
    };
  });

  // ── mcu_fader ───────────────────────────────────────────────────────────────

  server.registerTool("mcu_fader", {
    title: "MCU Set Fader",
    description:
      "Set a channel strip fader position in Studio One via MCU. " +
      "Channel 1-8 maps to the currently visible bank. Channel 9 = master. " +
      "Value: 0.0 = -inf, 0.74 = 0 dB (unity), 1.0 = +6 dB. " +
      "Or use dB directly with the db parameter.",
    inputSchema: {
      channel: z.number().int().min(1).max(9).describe("Channel strip (1-8) or 9 for master"),
      value: z.number().min(0).max(1).optional().describe("Normalized fader position (0.0 to 1.0)"),
      db: z.number().min(-144).max(6).optional().describe("Fader position in dB (-inf to +6)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ channel, value, db }) => {
    if (!isMcuConnected()) {
      return { content: [{ type: "text", text: "✗ MCU bridge not connected." }], isError: true };
    }

    let normalizedValue: number;
    if (db !== undefined) {
      normalizedValue = dbToFader(db);
    } else if (value !== undefined) {
      normalizedValue = value;
    } else {
      return { content: [{ type: "text", text: "✗ Provide either value (0-1) or db (-inf to +6)" }], isError: true };
    }

    const mcuChannel = channel - 1; // MCU uses 0-indexed, 8 = master
    const ok = sendFader(mcuChannel, normalizedValue);
    const dbValue = faderToDb(normalizedValue);
    const summary = `Fader ch${channel}: ${dbValue.toFixed(1)} dB (${(normalizedValue * 100).toFixed(0)}%)`;
    logAction({ tool: "mcu_fader", action: "s1_bridge", summary, dryRun: false, ok });

    return {
      content: [{ type: "text", text: ok ? `✓ ${summary}` : `✗ Failed: ${summary}` }],
      isError: !ok,
    };
  });

  // ── mcu_solo ────────────────────────────────────────────────────────────────

  server.registerTool("mcu_solo", {
    title: "MCU Toggle Solo",
    description: "Toggle solo on a channel strip (1-8) in the current bank.",
    inputSchema: {
      channel: z.number().int().min(1).max(8).describe("Channel strip number (1-8)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ channel }) => {
    if (!isMcuConnected()) {
      return { content: [{ type: "text", text: "✗ MCU bridge not connected." }], isError: true };
    }
    const ok = sendSolo(channel - 1);
    const state = getMcuBridgeState();
    const name = state.channels[channel - 1]?.name || `ch${channel}`;
    const summary = `Solo toggle: ${name}`;
    logAction({ tool: "mcu_solo", action: "s1_bridge", summary, dryRun: false, ok });
    return { content: [{ type: "text", text: ok ? `✓ ${summary}` : `✗ Failed` }], isError: !ok };
  });

  // ── mcu_mute ────────────────────────────────────────────────────────────────

  server.registerTool("mcu_mute", {
    title: "MCU Toggle Mute",
    description: "Toggle mute on a channel strip (1-8) in the current bank.",
    inputSchema: {
      channel: z.number().int().min(1).max(8).describe("Channel strip number (1-8)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ channel }) => {
    if (!isMcuConnected()) {
      return { content: [{ type: "text", text: "✗ MCU bridge not connected." }], isError: true };
    }
    const ok = sendMute(channel - 1);
    const state = getMcuBridgeState();
    const name = state.channels[channel - 1]?.name || `ch${channel}`;
    const summary = `Mute toggle: ${name}`;
    logAction({ tool: "mcu_mute", action: "s1_bridge", summary, dryRun: false, ok });
    return { content: [{ type: "text", text: ok ? `✓ ${summary}` : `✗ Failed` }], isError: !ok };
  });

  // ── mcu_bank ────────────────────────────────────────────────────────────────

  server.registerTool("mcu_bank", {
    title: "MCU Bank Switch",
    description:
      "Navigate to a different group of 8 tracks. MCU shows 8 channels at a time. " +
      "Use 'left' to go to the previous bank, 'right' for the next bank. " +
      "After switching, use mcu_state to see the new channel names.",
    inputSchema: {
      direction: z.enum(["left", "right"]).describe("Bank direction"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ direction }) => {
    if (!isMcuConnected()) {
      return { content: [{ type: "text", text: "✗ MCU bridge not connected." }], isError: true };
    }
    const ok = direction === "left" ? sendBankLeft() : sendBankRight();
    const state = getMcuBridgeState();
    const summary = `Bank ${direction}: now showing tracks ${state.bankOffset + 1}–${state.bankOffset + 8}`;
    logAction({ tool: "mcu_bank", action: "s1_bridge", summary, dryRun: false, ok });
    return { content: [{ type: "text", text: ok ? `✓ ${summary}` : `✗ Failed` }], isError: !ok };
  });

  // ── mcu_save ────────────────────────────────────────────────────────────────

  server.registerTool("mcu_save", {
    title: "MCU Save Project",
    description: "Send Ctrl+S (save) to Studio One via the MCU bridge.",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async () => {
    if (!isMcuConnected()) {
      return { content: [{ type: "text", text: "✗ MCU bridge not connected." }], isError: true };
    }
    const ok = sendButton(MCU_BUTTONS.SAVE);
    logAction({ tool: "mcu_save", action: "s1_bridge", summary: "Save project", dryRun: false, ok });
    return { content: [{ type: "text", text: ok ? "✓ Save command sent" : "✗ Failed to send save" }], isError: !ok };
  });

  // ── mcu_undo ────────────────────────────────────────────────────────────────

  server.registerTool("mcu_undo", {
    title: "MCU Undo",
    description: "Send undo command to Studio One via the MCU bridge.",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async () => {
    if (!isMcuConnected()) {
      return { content: [{ type: "text", text: "✗ MCU bridge not connected." }], isError: true };
    }
    const ok = sendButton(MCU_BUTTONS.UNDO);
    logAction({ tool: "mcu_undo", action: "s1_bridge", summary: "Undo", dryRun: false, ok });
    return { content: [{ type: "text", text: ok ? "✓ Undo sent" : "✗ Failed" }], isError: !ok };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert normalized fader (0-1) to dB. MCU fader: 0.74 ≈ 0 dB, 1.0 ≈ +6 dB. */
function faderToDb(normalized: number): number {
  if (normalized <= 0.001) return -Infinity;
  // MCU fader curve approximation (log scale)
  // 0.0 = -inf, 0.12 = -60 dB, 0.35 = -20 dB, 0.55 = -10 dB, 0.74 = 0 dB, 1.0 = +6 dB
  if (normalized >= 0.74) {
    return ((normalized - 0.74) / 0.26) * 6;
  }
  return 20 * Math.log10(normalized / 0.74);
}

/** Convert dB to normalized fader position. */
function dbToFader(db: number): number {
  if (db <= -144) return 0;
  if (db >= 6) return 1.0;
  if (db >= 0) {
    return 0.74 + (db / 6) * 0.26;
  }
  return 0.74 * Math.pow(10, db / 20);
}
