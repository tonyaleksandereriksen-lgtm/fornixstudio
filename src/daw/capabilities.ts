// ─── Fornix Studio – DAW Capability Helpers ──────────────────────────────────

import type { DawCapability, DawCapabilityName, DawCapabilityLevel } from "./types.js";

const LEVEL_RANK: Record<DawCapabilityLevel, number> = { none: 0, read: 1, write: 2 };

/** Check whether a capability is available at a minimum level. */
export function hasCapability(
  capabilities: DawCapability[],
  name: DawCapabilityName,
  minimumLevel: DawCapabilityLevel = "read",
): boolean {
  const found = capabilities.find((cap) => cap.name === name);
  if (!found || found.status === "blocked") return false;
  return LEVEL_RANK[found.level] >= LEVEL_RANK[minimumLevel];
}

/** One-line summary per capability for diagnostics. */
export function summarizeCapabilities(capabilities: DawCapability[]): string[] {
  return capabilities.map((cap) => {
    const parts = [cap.name, `${cap.level}/${cap.status}`];
    if (cap.note) parts.push(`(${cap.note})`);
    return parts.join(" — ");
  });
}

/** Return all capabilities that meet a minimum level. */
export function filterCapabilities(
  capabilities: DawCapability[],
  minimumLevel: DawCapabilityLevel = "read",
): DawCapability[] {
  return capabilities.filter(
    (cap) => cap.status !== "blocked" && LEVEL_RANK[cap.level] >= LEVEL_RANK[minimumLevel],
  );
}
