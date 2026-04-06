// ─── Fornix Studio – DAW Abstraction Layer ───────────────────────────────────
//
// Universal interface for DAW communication. Adapters implement this for
// each DAW, exposing capabilities honestly via the capability matrix.
// Studio One is the first adapter; the interface is DAW-agnostic.

// ─── Capability model ────────────────────────────────────────────────────────

export type DawCapabilityLevel = "none" | "read" | "write";
export type DawCapabilityStatus = "proven" | "partial" | "blocked" | "unknown";

export type DawCapabilityName =
  | "session.read"
  | "session.write"
  | "arrangement.read"
  | "arrangement.write"
  | "transport.control"
  | "track.control"
  | "plugin.context"
  | "audio.capture"
  | "render.read"
  | "rollback";

export interface DawCapability {
  name: DawCapabilityName;
  level: DawCapabilityLevel;
  status: DawCapabilityStatus;
  source: "adapter" | "probe" | "config" | "inference";
  note?: string;
}

// ─── Session model ───────────────────────────────────────────────────────────

export interface DawSectionSummary {
  id: string;
  name: string;
  startBar?: number;
  endBar?: number;
}

export interface DawTrackSummary {
  id: string;
  name: string;
  kind?: "audio" | "instrument" | "bus" | "fx" | "folder" | "automation" | "unknown";
  muted?: boolean;
  soloed?: boolean;
  armed?: boolean;
  faderDb?: number;
}

export interface DawTransportState {
  playing: boolean;
  recording: boolean;
  tempo?: number;
  timeSignature?: string;
  position?: string;
}

export interface DawSessionSnapshot {
  dawId: string;
  sessionId: string;
  title?: string;
  tempo?: number;
  key?: string;
  timeSignature?: string;
  transport?: DawTransportState;
  sections: DawSectionSummary[];
  tracks: DawTrackSummary[];
  warnings: string[];
  capturedAt: string;
}

// ─── Action model ────────────────────────────────────────────────────────────

export interface ActionPreview {
  actionId: string;
  title: string;
  summary: string;
  requires: DawCapabilityName[];
  canApply: boolean;
  canRollback: boolean;
  warnings: string[];
}

export interface ApplyRequest {
  actionId: string;
  dryRun?: boolean;
  input?: Record<string, unknown>;
}

export interface ApplyResult {
  actionId: string;
  applied: boolean;
  summary: string;
  rollbackToken?: string;
  warnings: string[];
}

export interface RollbackResult {
  ok: boolean;
  summary: string;
  warnings: string[];
}

// ─── Adapter interface ───────────────────────────────────────────────────────

export interface DawAdapter {
  /** Unique identifier for this adapter (e.g. "studio-one-7"). */
  id: string;

  /** Human-readable name (e.g. "Studio One 7"). */
  displayName: string;

  /** Query current capabilities — results may change at runtime. */
  getCapabilities(): Promise<DawCapability[]>;

  /** Read current session state from the DAW. */
  getSessionSnapshot(): Promise<DawSessionSnapshot>;

  /** Preview what an action would do without executing it. */
  previewAction(actionId: string, session: DawSessionSnapshot): Promise<ActionPreview>;

  /** Execute an action against the DAW. */
  applyAction(request: ApplyRequest): Promise<ApplyResult>;

  /** Undo a previously applied action (optional — not all adapters support this). */
  rollback?(token: string): Promise<RollbackResult>;
}
