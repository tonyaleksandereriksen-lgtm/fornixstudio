// ─── Fornix Studio MCP – Bridge Guard Helpers ────────────────────────────────
//
// Shared tool-layer guards for Studio One bridge commands.
// All five write-tool modules (tracks, plugins, midi, arrangement, automation)
// import from here so the gating message is consistent.
//
// Two levels:
//   requireBridgeRead  – bridge must be ready (handshake OK)
//   requireBridgeWrite – bridge must be ready AND one live read must be verified
//
// Both return null when the condition is met (caller may proceed),
// or a human-readable string explaining the block (caller returns it as the
// tool response text).  The write gate is also enforced internally by
// sendBridgeRequest for commands in LIVE_WRITE_COMMANDS; this layer surfaces
// the same gate with an actionable message before the command is even sent.

import {
  getBridgeRuntimeStatus,
  isBridgeReady,
} from "../../services/bridge.js";

/**
 * Returns a blocking message if the bridge has not completed its handshake,
 * or null if the bridge is ready.  Use for read-only live bridge commands.
 */
export function requireBridgeRead(action: string): string | null {
  if (!isBridgeReady()) {
    const runtime = getBridgeRuntimeStatus();
    const hint =
      runtime.state === "disconnected" || runtime.state === "error"
        ? "Ensure Studio One is open and the experimental extension is actually running."
        : "The socket may be open, but the runtime probe handshake is not complete.";

    return (
      `⚠ Studio One bridge is not ready – cannot ${action}.\n` +
      `State: ${runtime.state}; handshakeOk=${runtime.handshakeOk ? "true" : "false"}.\n` +
      `${hint}\n` +
      "Use s1_export_instruction to generate a manual instruction file instead."
    );
  }
  return null;
}

/**
 * Returns a blocking message if the bridge is not ready OR if no live read
 * has been verified in this MCP process, or null if writes are allowed.
 * Use for all live DAW write commands.
 */
export function requireBridgeWrite(action: string): string | null {
  const readBlock = requireBridgeRead(action);
  if (readBlock) {
    return readBlock;
  }

  const runtime = getBridgeRuntimeStatus();
  if (!runtime.proof.liveReadVerified) {
    return (
      `⚠ Live Studio One WRITE is still gated — cannot ${action} yet.\n` +
      `Handshake is complete, but no live read has been verified in this MCP process.\n` +
      `Run s1_get_transport_state or s1_query_song_metadata first, confirm the returned ` +
      `values in Studio One, then retry the write.\n` +
      `Next required state: ${runtime.proof.nextRequiredState ?? "live_read_verified"}.`
    );
  }

  return null;
}
