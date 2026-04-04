// ─── Fornix Studio MCP – Types ───────────────────────────────────────────────

// ── Tool response format ──────────────────────────────────────────────────────

export interface ToolSuccess<T = unknown> {
  ok: true;
  data: T;
  summary: string;
  dryRun?: boolean;
}

export interface ToolError {
  ok: false;
  error: string;
  hint?: string;
}

export type ToolResult<T = unknown> = ToolSuccess<T> | ToolError;

// ── Action log ────────────────────────────────────────────────────────────────

export type ActionType =
  | "read"
  | "write"
  | "patch"
  | "delete"
  | "move"
  | "git"
  | "exec"
  | "s1_bridge"
  | "plan";

export interface ActionLogEntry {
  ts: string;          // ISO timestamp
  tool: string;        // tool name
  action: ActionType;
  target?: string;     // file path or resource name
  summary: string;
  dryRun: boolean;
  ok: boolean;
  error?: string;
}

// ── Workspace ─────────────────────────────────────────────────────────────────

export interface WorkspaceConfig {
  allowedDirs: string[];         // Absolute paths AI can access
  readOnlyDirs?: string[];       // Subset that is read-only
  dryRunByDefault?: boolean;     // If true, all writes are dry-run unless overridden
  gitRoot?: string;              // Git root (defaults to workspace root)
  s1BridgeEnabled?: boolean;     // Enable Studio One WebSocket bridge
}

// ── Git ───────────────────────────────────────────────────────────────────────

export interface CheckpointInfo {
  hash: string;
  message: string;
  date: string;
  isMcpCheckpoint: boolean;
}

// ── Studio One Bridge ─────────────────────────────────────────────────────────

export type S1BridgeStatus = "connected" | "disconnected" | "error";

export interface S1Command {
  command: string;
  params?: Record<string, unknown>;
  requestId?: string;
}

export interface S1Response {
  requestId?: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

// ── Bridge runtime proof model ───────────────────────────────────────────────

export type BridgeRuntimeState =
  | "disconnected"
  | "connecting"
  | "degraded"
  | "ready";

export type BridgeLifecyclePhase =
  | "idle"
  | "handshake_ok"
  | "live_read_verified"
  | "runtime_verified";

export type BridgeErrorCode =
  | "HANDSHAKE_FAILED"
  | "COMMAND_TIMEOUT"
  | "LIVE_READ_REQUIRED"
  | "DISCONNECTED"
  | "SEND_FAILED";

export interface BridgeProof {
  packageMode: "bridge_experimental";
  extensionLoaded: boolean;
  listenerCreated: boolean;
  handshakeOk: boolean;
  liveReadVerified: boolean;
  liveWriteVerified: boolean;
  nextRequiredState: BridgeLifecyclePhase | null;
}

export interface BridgeLastError {
  code: BridgeErrorCode;
  message: string;
  ts: string;
}

export interface BridgeCapabilities {
  commands: string[];
  apiVersion: string;
  extensionVersion: string;
}

export interface BridgeRuntimeStatus {
  state: BridgeRuntimeState;
  lifecyclePhase: BridgeLifecyclePhase;
  proof: BridgeProof;
  capabilities: BridgeCapabilities | null;
  lastError: BridgeLastError | null;
  extensionRespondedAt: string | null;
  lastHandshakeAt: string | null;
  lastPingAt: string | null;
  connectedAt: string | null;
}

export const BRIDGE_READ_COMMANDS = new Set([
  "getTransportState",
  "getSongMetadata",
  "getMarkers",
  "getPluginParams",
]);

export const BRIDGE_WRITE_COMMANDS = new Set([
  "setTempo",
  "setLoopRange",
  "createTrack",
  "renameTrack",
  "setTrackMute",
  "setTrackSolo",
  "setTrackVolume",
  "createSend",
  "addPlugin",
  "setPluginParam",
  "loadPluginPreset",
  "addMidiNotes",
  "clearMidiPart",
  "quantizePart",
  "addMarker",
  "addMarkersMulti",
  "deleteMarker",
  "triggerMacro",
  "addAutomationPoints",
  "clearAutomation",
]);

// ── Track types ───────────────────────────────────────────────────────────────

export type TrackType =
  | "audio"
  | "instrument"
  | "automation"
  | "bus"
  | "fx"
  | "folder";

export interface TrackInfo {
  id: string;
  name: string;
  type: TrackType;
  muted: boolean;
  soloed: boolean;
  volume: number;
  pan: number;
  color?: string;
}

// ── Song metadata ─────────────────────────────────────────────────────────────

export interface SongMetadata {
  title: string;
  tempo: number;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
  sampleRate: number;
  tracks: TrackInfo[];
}

// ── Project structure ─────────────────────────────────────────────────────────

export interface FileNode {
  path: string;
  type: "file" | "dir";
  size?: number;
  ext?: string;
  children?: FileNode[];
}

export interface ProjectStructure {
  root: string;
  tree: FileNode[];
  languages: string[];
  entryPoints: string[];
  risks: string[];
}
