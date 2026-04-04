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

export type S1BridgeStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "ready"
  | "degraded"
  | "error";

/** Derived, non-collapsed lifecycle for dashboards and tooling (socket ≠ ready ≠ proven live). */
export type S1BridgeLifecyclePhase =
  | "disconnected"
  | "connecting"
  | "socket_connected"
  | "extension_responded"
  | "handshake_ok"
  | "live_read_verified"
  | "runtime_verified"
  | "degraded"
  | "error";

export interface S1BridgeCapabilities {
  transport: boolean;
  song: boolean;
  tracks: boolean;
  plugins: boolean;
  automation: boolean;
  midi: boolean;
  markers: boolean;
  filesystem: boolean;
  websocketServer: boolean;
}

export interface S1BridgeErrorInfo {
  code: string;
  message: string;
}

export interface S1BridgeExtensionEvidence {
  logsDir: string;
  startupMarkerFound: boolean;
  lastStartupAt: string | null;
  lastStartupPath: string | null;
  listenerDeclaredAvailable: boolean | null;
  filesystemWriteAvailable: boolean | null;
  source: "startup_marker" | "runtime" | "none";
}

export interface S1BridgeProofStates {
  extensionLoaded: boolean;
  listenerCreated: boolean;
  handshakeOk: boolean;
  liveReadVerified: boolean;
  liveWriteVerified: boolean;
  runtimeVerified: boolean;
  hasRealRuntimeProof: boolean;
  nextRequiredState:
    | "extension_loaded"
    | "listener_created"
    | "handshake_ok"
    | "live_read_verified"
    | "live_write_verified"
    | "runtime_verified"
    | null;
  packageMode: "file_first" | "bridge_experimental" | "runtime_verified";
  acceptanceSummary: string;
}

export interface S1BridgeRuntimeStatus {
  state: S1BridgeStatus;
  /** Same as state === "ready" && lastHandshakeAt set. */
  handshakeOk: boolean;
  lifecyclePhase: S1BridgeLifecyclePhase;
  /** First successful `ping` response (extension router executed). */
  extensionRespondedAt: string | null;
  lastHandshakeAt: string | null;
  lastPingAt: string | null;
  capabilities: S1BridgeCapabilities | null;
  lastError: S1BridgeErrorInfo | null;
  /** First successful live read in this process (e.g. getTransportState). */
  runtimeReadVerifiedAt: string | null;
  /** First successful live write in this process (e.g. setTempo). */
  runtimeWriteVerifiedAt: string | null;
  extensionEvidence: S1BridgeExtensionEvidence;
  proof: S1BridgeProofStates;
}

export interface S1Command {
  command: string;
  params?: Record<string, unknown>;
  requestId?: string;
}

export interface S1Response {
  requestId?: string | null;
  ok: boolean;
  command: string;
  data?: unknown;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
}

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
