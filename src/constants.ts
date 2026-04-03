// ─── Fornix Studio MCP – Constants ──────────────────────────────────────────

export const SERVER_NAME = "fornix-studio-mcp";
export const SERVER_VERSION = "1.0.0";

// Max chars returned in a single tool response before truncation
export const CHARACTER_LIMIT = 12_000;

// Max lines returned from a file read
export const FILE_READ_LINE_LIMIT = 500;

// Studio One WebSocket bridge defaults
export const S1_BRIDGE_HOST = "127.0.0.1";
export const S1_BRIDGE_PORT = 7890;
export const S1_BRIDGE_TIMEOUT_MS = 5_000;

// Git checkpoint prefix used by this system
export const CHECKPOINT_PREFIX = "fornix-mcp-checkpoint";

// Action log path (relative to workspace root)
export const ACTION_LOG_FILENAME = ".fornix-mcp.log";

// Workspace config filename
export const WORKSPACE_CONFIG_FILENAME = "fornix-mcp.config.json";

// Hardcoded Fornix bus names for documentation purposes
export const KNOWN_BUSES = [
  "LEAD",
  "Kick & Bass",
  "Percussion",
  "Chords",
  "Pads",
  "FX",
  "Master",
] as const;

// Known plugin categories
export const PLUGIN_CATEGORIES = [
  "Dynamics",
  "EQ",
  "Reverb",
  "Delay",
  "Saturation",
  "Limiting",
  "Instrument",
  "Utility",
] as const;
