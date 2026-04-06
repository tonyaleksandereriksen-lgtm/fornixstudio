// ─── Fornix Studio – Studio One DAW Adapter ──────────────────────────────────
//
// Implements DawAdapter by composing the 3 available integration paths:
//   1. MCU bridge (real-time bidirectional via MIDI)
//   2. Song watcher (file-based session awareness)
//   3. Extension (fire-and-forget command trigger — very limited)
//
// Capabilities are reported honestly based on which paths are active.

import type {
  DawAdapter,
  DawCapability,
  DawSessionSnapshot,
  DawTrackSummary,
  DawSectionSummary,
  DawTransportState,
  ActionPreview,
  ApplyRequest,
  ApplyResult,
  RollbackResult,
} from "./types.js";
import {
  isMcuConnected,
  getMcuBridgeState,
} from "../services/mcu-bridge.js";
import {
  getWatcherStatus,
  getCurrentSnapshot,
} from "../services/song-watcher.js";

export class StudioOneAdapter implements DawAdapter {
  readonly id = "studio-one-7";
  readonly displayName = "Studio One 7";

  async getCapabilities(): Promise<DawCapability[]> {
    const mcuConnected = isMcuConnected();
    const mcuState = mcuConnected ? getMcuBridgeState() : null;
    const mcuHandshake = mcuState?.handshakeOk ?? false;
    const watcherActive = getWatcherStatus().active;

    const capabilities: DawCapability[] = [
      {
        name: "session.read",
        level: mcuHandshake ? "read" : watcherActive ? "read" : "none",
        status: mcuHandshake ? "partial" : watcherActive ? "partial" : "unknown",
        source: mcuHandshake ? "probe" : watcherActive ? "probe" : "config",
        note: mcuHandshake
          ? "Real-time via MCU (implemented, not yet verified end-to-end with S1)"
          : watcherActive
            ? "File-based, updates on save"
            : "No active connection",
      },
      {
        name: "transport.control",
        level: mcuHandshake ? "write" : "none",
        status: mcuHandshake ? "partial" : "blocked",
        source: "probe",
        note: mcuHandshake
          ? "MCU transport commands (implemented, awaiting end-to-end verification)"
          : "Requires MCU bridge",
      },
      {
        name: "track.control",
        level: mcuHandshake ? "write" : "none",
        status: mcuHandshake ? "partial" : "blocked",
        source: "probe",
        note: mcuHandshake
          ? "Fader/solo/mute via MCU (implemented, awaiting end-to-end verification)"
          : "Requires MCU bridge",
      },
      {
        name: "arrangement.read",
        level: watcherActive ? "read" : "none",
        status: watcherActive ? "partial" : "unknown",
        source: watcherActive ? "probe" : "config",
        note: watcherActive
          ? "Markers and tracks parsed from .song file; section boundaries are heuristic"
          : "Start song watcher first",
      },
      {
        name: "arrangement.write",
        level: "none",
        status: "blocked",
        source: "config",
        note: "No write path to S1 arrangement — use instruction-based guidance",
      },
      {
        name: "session.write",
        level: mcuHandshake ? "write" : "none",
        status: mcuHandshake ? "partial" : "blocked",
        source: "probe",
        note: mcuHandshake
          ? "Limited to MCU commands (fader, transport, solo/mute)"
          : "Requires MCU bridge",
      },
      {
        name: "plugin.context",
        level: "none",
        status: "blocked",
        source: "config",
        note: "S1 extension cannot read plugin state",
      },
      {
        name: "audio.capture",
        level: "none",
        status: "blocked",
        source: "config",
        note: "No audio capture path available",
      },
      {
        name: "render.read",
        level: "none",
        status: "blocked",
        source: "config",
        note: "Cannot read render output programmatically",
      },
      {
        name: "rollback",
        level: "write",
        status: "partial",
        source: "adapter",
        note: "Git checkpoints proven; MCU undo implemented but not yet verified",
      },
    ];

    return capabilities;
  }

  async getSessionSnapshot(): Promise<DawSessionSnapshot> {
    const mcuConnected = isMcuConnected();
    const mcuState = mcuConnected ? getMcuBridgeState() : null;
    const watcherSnapshot = getCurrentSnapshot();

    // Merge MCU real-time state with watcher file-based state
    const tracks: DawTrackSummary[] = [];
    const sections: DawSectionSummary[] = [];
    let transport: DawTransportState | undefined;
    let tempo: number | undefined;
    let title: string | undefined;
    let timeSignature: string | undefined;
    const warnings: string[] = [];

    // MCU provides real-time transport + channel strips
    if (mcuState?.handshakeOk) {
      transport = {
        playing: mcuState.transport.playing,
        recording: mcuState.transport.recording,
        tempo: undefined, // MCU doesn't report tempo
        position: mcuState.timecode || undefined,
      };

      for (let i = 0; i < 8; i++) {
        const ch = mcuState.channels[i];
        if (ch.name) {
          tracks.push({
            id: `mcu-${mcuState.bankOffset + i}`,
            name: ch.name,
            kind: "unknown",
            muted: ch.mute,
            soloed: ch.solo,
            armed: ch.recArm,
            faderDb: ch.fader > 0 ? ch.fader : undefined,
          });
        }
      }
    }

    // Watcher provides file-based session data
    if (watcherSnapshot) {
      const r = watcherSnapshot.result;
      title = watcherSnapshot.filePath.split(/[\\/]/).pop() ?? undefined;
      tempo = r.tempo ?? undefined;
      timeSignature = r.timeSignature ?? undefined;

      for (const m of r.markers) {
        sections.push({
          id: `marker-${m.name}`,
          name: m.name,
          startBar: m.positionBars,
        });
      }

      // Add watcher tracks if MCU didn't provide them
      if (tracks.length === 0) {
        for (const t of r.tracks) {
          tracks.push({
            id: `watcher-${t.name}`,
            name: t.name,
            kind: (t.type as DawTrackSummary["kind"]) ?? "unknown",
          });
        }
      }
    }

    if (!mcuState?.handshakeOk && !watcherSnapshot) {
      warnings.push("No active DAW connection. Connect MCU bridge or start song watcher.");
    }
    if (mcuState && !mcuState.handshakeOk) {
      warnings.push("MCU bridge connected but handshake pending — S1 may not be streaming yet.");
    }

    return {
      dawId: this.id,
      sessionId: watcherSnapshot?.filePath ?? "unknown",
      title,
      tempo,
      timeSignature,
      transport,
      sections,
      tracks,
      warnings,
      capturedAt: new Date().toISOString(),
    };
  }

  async previewAction(actionId: string, session: DawSessionSnapshot): Promise<ActionPreview> {
    const capabilities = await this.getCapabilities();

    // Transport actions
    if (["play", "stop", "record", "rewind", "forward"].includes(actionId)) {
      const canApply = capabilities.some(
        (c) => c.name === "transport.control" && c.level === "write" && c.status !== "blocked",
      );
      return {
        actionId,
        title: `Transport: ${actionId}`,
        summary: `Send ${actionId} command to Studio One via MCU`,
        requires: ["transport.control"],
        canApply,
        canRollback: actionId === "play" || actionId === "record",
        warnings: canApply ? [] : ["MCU bridge not connected — cannot control transport"],
      };
    }

    // Default: unknown action
    return {
      actionId,
      title: `Unknown action: ${actionId}`,
      summary: `Action "${actionId}" is not recognized by the Studio One adapter`,
      requires: [],
      canApply: false,
      canRollback: false,
      warnings: [`Action "${actionId}" not implemented in ${this.displayName} adapter`],
    };
  }

  async applyAction(request: ApplyRequest): Promise<ApplyResult> {
    // Stub — will be connected to MCU bridge commands
    return {
      actionId: request.actionId,
      applied: false,
      summary: `Action "${request.actionId}" execution not yet implemented`,
      warnings: ["Action execution will be connected to MCU bridge in a future iteration"],
    };
  }

  async rollback(token: string): Promise<RollbackResult> {
    // Stub — will connect to git checkpoint restore + MCU undo
    return {
      ok: false,
      summary: `Rollback for token "${token}" not yet implemented`,
      warnings: ["Rollback will be connected to git checkpoints and MCU undo"],
    };
  }
}
