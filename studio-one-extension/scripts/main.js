/* Fornix MCP Bridge — Studio One 7 extension
 *
 * Verified against Studio One 7.2.2.107056 (Win x64), 2026-04-04.
 *
 * What this extension CAN do:
 *   - Log to Host.Console.writeLine
 *   - Check file existence via Host.IO.File(path).exists()
 *   - Remove/rename files via Host.IO.File(path).remove/rename()
 *
 * What is NOT available in Studio One 7:
 *   - Host.FileSystem (undefined) — no file read/write
 *   - Host.WebSocket (undefined) — no WebSocket bridge
 *   - Host.Network / Host.Http — no network access
 *
 * The bridge architecture (src/services/bridge.ts) remains in the
 * codebase but is permanently dormant on Studio One 7.
 * packageMode stays "file_first".
 *
 * See docs/studio-one-7-api-findings.md for the full API probe.
 */

include_file("resource://{main}/sdk/cclapp.js");

function log(msg) {
  Host.Console.writeLine("[FornixMCPBridge] " + msg);
}

// ─── IComponent service ──────────────────────────────────────────────────────

function FornixMCPBridgeService() {
  this.interfaces = [Host.Interfaces.IComponent];

  this.initialize = function() {
    log("initialize — Studio One 7 extension loaded (file-first mode)");
    log("Host.WebSocket: " + typeof Host.WebSocket + " (bridge not available)");
    log("Host.FileSystem: " + typeof Host.FileSystem + " (file write not available)");
    return Host.Results.kResultOk;
  };

  this.terminate = function() {
    log("terminate");
    return Host.Results.kResultOk;
  };
}

// ─── Class factory entry point ───────────────────────────────────────────────

function createInstance(args) {
  __init(args);
  log("createInstance");
  return new FornixMCPBridgeService;
}
