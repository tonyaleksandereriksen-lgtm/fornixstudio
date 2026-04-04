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

export interface S1BridgeRuntimeStatus {
  state: S1BridgeStatus;
  handshakeOk: boolean;
  lastHandshakeAt: string | null;
  lastPingAt: string | null;
  capabilities: S1BridgeCapabilities | null;
  lastError: S1BridgeErrorInfo | null;
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
