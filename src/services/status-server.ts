// ─── Fornix Studio MCP – Local HTTP Status Server ────────────────────────────
//
// Runs alongside the MCP stdio transport on port 7891.
// Powers the local dashboard at http://localhost:7891
// Read-only: never accepts write commands via HTTP.

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getBridgeStatus } from "./bridge.js";
import { readRecentLogs } from "./logger.js";
import { getStatus as getGitStatus } from "./checkpoint.js";
import { getConfig } from "./workspace.js";
import { SERVER_VERSION } from "../constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_PORT = 7891;

let _server: http.Server | null = null;
let _startTime = Date.now();
let _toolCallCount = 0;

export function incrementToolCall(): void {
  _toolCallCount++;
}

export function startStatusServer(): void {
  _startTime = Date.now();

  _server = http.createServer(async (req, res) => {
    // CORS for local dev
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${DASHBOARD_PORT}`);

    try {
      if (url.pathname === "/" || url.pathname === "/dashboard") {
        serveDashboard(res);
        return;
      }

      if (url.pathname === "/api/status") {
        const cfg = getConfig();
        let gitStatus = null;
        try { gitStatus = await getGitStatus(); } catch { /* git may not be available */ }

        const payload = {
          server: { version: SERVER_VERSION, uptimeSeconds: Math.round((Date.now() - _startTime) / 1000) },
          bridge: { status: getBridgeStatus() },
          workspace: { allowedDirs: cfg.allowedDirs, dryRunByDefault: cfg.dryRunByDefault ?? false },
          git: gitStatus,
          stats: { toolCallsThisSession: _toolCallCount },
          timestamp: new Date().toISOString(),
        };
        json(res, payload);
        return;
      }

      if (url.pathname === "/api/log") {
        const n = parseInt(url.searchParams.get("n") ?? "50");
        const entries = readRecentLogs(Math.min(n, 200));
        json(res, { entries, count: entries.length });
        return;
      }

      if (url.pathname === "/api/tools") {
        // Static tool manifest — list all registered tools
        const tools = TOOL_MANIFEST;
        json(res, { tools, count: tools.length });
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: String(e) }));
    }
  });

  _server.listen(DASHBOARD_PORT, "127.0.0.1", () => {
    process.stderr.write(
      `[dashboard] Running at http://localhost:${DASHBOARD_PORT}\n`
    );
  });

  _server.on("error", (e: NodeJS.ErrnoException) => {
    if (e.code === "EADDRINUSE") {
      process.stderr.write(
        `[dashboard] Port ${DASHBOARD_PORT} in use – dashboard disabled.\n`
      );
    }
  });
}

export function stopStatusServer(): void {
  _server?.close();
  _server = null;
}

function json(res: http.ServerResponse, data: unknown): void {
  res.setHeader("Content-Type", "application/json");
  res.writeHead(200);
  res.end(JSON.stringify(data, null, 2));
}

function serveDashboard(res: http.ServerResponse): void {
  // Inline the dashboard HTML directly so no extra files needed
  const dashboardPath = path.join(__dirname, "../../dashboard.html");
  if (fs.existsSync(dashboardPath)) {
    res.setHeader("Content-Type", "text/html");
    res.writeHead(200);
    res.end(fs.readFileSync(dashboardPath, "utf8"));
  } else {
    res.setHeader("Content-Type", "text/html");
    res.writeHead(200);
    res.end(`<!DOCTYPE html><html><body>
      <h2>Fornix Studio MCP Dashboard</h2>
      <p>Dashboard file not found. Place <code>dashboard.html</code> in the project root.</p>
      <p><a href="/api/status">View status JSON</a> | <a href="/api/log">View log</a></p>
    </body></html>`);
  }
}

// ── Tool manifest ─────────────────────────────────────────────────────────────

const TOOL_MANIFEST = [
  // Filesystem
  { name: "fs_read_file",       family: "Filesystem",     readOnly: true  },
  { name: "fs_write_file",      family: "Filesystem",     readOnly: false },
  { name: "fs_patch_file",      family: "Filesystem",     readOnly: false },
  { name: "fs_list_tree",       family: "Filesystem",     readOnly: true  },
  { name: "fs_search_code",     family: "Filesystem",     readOnly: true  },
  { name: "fs_move_file",       family: "Filesystem",     readOnly: false },
  // Git
  { name: "git_status",                family: "Git", readOnly: true  },
  { name: "git_diff",                  family: "Git", readOnly: true  },
  { name: "git_commit_checkpoint",     family: "Git", readOnly: false },
  { name: "git_list_checkpoints",      family: "Git", readOnly: true  },
  { name: "git_restore_file",          family: "Git", readOnly: false },
  { name: "git_revert_checkpoint",     family: "Git", readOnly: false },
  // Project
  { name: "project_inspect_structure", family: "Project", readOnly: true  },
  { name: "project_run_build",         family: "Project", readOnly: false },
  { name: "project_run_tests",         family: "Project", readOnly: false },
  { name: "project_lint",              family: "Project", readOnly: false },
  { name: "project_typecheck",         family: "Project", readOnly: true  },
  { name: "project_read_action_log",   family: "Project", readOnly: true  },
  // S1 Transport
  { name: "s1_bridge_status",          family: "S1 Transport", readOnly: true  },
  { name: "s1_get_transport_state",    family: "S1 Transport", readOnly: true  },
  { name: "s1_set_tempo",              family: "S1 Transport", readOnly: false },
  { name: "s1_set_loop_range",         family: "S1 Transport", readOnly: false },
  { name: "s1_query_song_metadata",    family: "S1 Transport", readOnly: true  },
  // S1 Tracks
  { name: "s1_create_track",           family: "S1 Tracks", readOnly: false },
  { name: "s1_rename_track",           family: "S1 Tracks", readOnly: false },
  { name: "s1_mute_track",             family: "S1 Tracks", readOnly: false },
  { name: "s1_solo_track",             family: "S1 Tracks", readOnly: false },
  { name: "s1_set_track_volume",       family: "S1 Tracks", readOnly: false },
  { name: "s1_create_send",            family: "S1 Tracks", readOnly: false },
  // S1 Plugins
  { name: "s1_add_plugin",             family: "S1 Plugins", readOnly: false },
  { name: "s1_get_plugin_params",      family: "S1 Plugins", readOnly: true  },
  { name: "s1_set_plugin_param",       family: "S1 Plugins", readOnly: false },
  { name: "s1_load_plugin_preset",     family: "S1 Plugins", readOnly: false },
  { name: "s1_trigger_macro",          family: "S1 Plugins", readOnly: false },
  // S1 MIDI
  { name: "s1_add_midi_notes",         family: "S1 MIDI", readOnly: false },
  { name: "s1_add_chord",              family: "S1 MIDI", readOnly: false },
  { name: "s1_add_drum_pattern",       family: "S1 MIDI", readOnly: false },
  { name: "s1_clear_midi_part",        family: "S1 MIDI", readOnly: false },
  { name: "s1_quantize_part",          family: "S1 MIDI", readOnly: false },
  // S1 Arrangement
  { name: "s1_add_marker",             family: "S1 Arrangement", readOnly: false },
  { name: "s1_get_markers",            family: "S1 Arrangement", readOnly: true  },
  { name: "s1_delete_marker",          family: "S1 Arrangement", readOnly: false },
  { name: "s1_build_arrangement",      family: "S1 Arrangement", readOnly: false },
  { name: "s1_export_arrangement_plan",family: "S1 Arrangement", readOnly: false },
  // S1 Automation
  { name: "s1_add_automation_point",   family: "S1 Automation", readOnly: false },
  { name: "s1_add_automation_ramp",    family: "S1 Automation", readOnly: false },
  { name: "s1_clear_automation",       family: "S1 Automation", readOnly: false },
  // S1 Fallback
  { name: "s1_export_instruction",     family: "S1 Fallback", readOnly: false },
  { name: "s1_generate_track_plan",    family: "S1 Fallback", readOnly: false },
  { name: "s1_generate_bus_template",  family: "S1 Fallback", readOnly: false },
  // Sound Design
  { name: "sd_describe_patch",         family: "Sound Design", readOnly: false },
  { name: "sd_generate_hardstyle_lead",family: "Sound Design", readOnly: false },
  // Kickstarter
  { name: "session_kickstart",         family: "Session",      readOnly: false },
  { name: "session_apply_mix_preset",  family: "Session",      readOnly: false },
  { name: "session_health_check",      family: "Session",      readOnly: true  },
];
