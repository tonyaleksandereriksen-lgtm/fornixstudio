// ─── Fornix Studio MCP – Main Entry Point ────────────────────────────────────

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { loadWorkspaceConfig } from "./services/workspace.js";
import { initLogger } from "./services/logger.js";
import { initGit } from "./services/checkpoint.js";
import { tryConnectBridge } from "./services/bridge.js";
import { startStatusServer } from "./services/status-server.js";

import { registerFilesystemTools }   from "./tools/filesystem.js";
import { registerGitTools }          from "./tools/git.js";
import { registerProjectTools }      from "./tools/project.js";
import { registerSoundDesignTools }  from "./tools/sound-design.js";
import { registerSessionTools }      from "./tools/session.js";
import { registerTransportTools }    from "./tools/studio-one/transport.js";
import { registerTrackTools }        from "./tools/studio-one/tracks.js";
import { registerPluginTools }       from "./tools/studio-one/plugins.js";
import { registerFallbackTools }     from "./tools/studio-one/fallback.js";
import { registerMidiTools }         from "./tools/studio-one/midi.js";
import { registerArrangementTools }  from "./tools/studio-one/arrangement.js";
import { registerAutomationTools }   from "./tools/studio-one/automation.js";

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? process.cwd();

async function main(): Promise<void> {
  process.stderr.write(`\n[Fornix Studio MCP v${SERVER_VERSION}] Starting...\n`);

  const cfg = loadWorkspaceConfig(WORKSPACE_ROOT);
  process.stderr.write(`[init] Workspace: ${cfg.allowedDirs.join(", ")}\n`);

  initLogger(WORKSPACE_ROOT);

  try {
    initGit(cfg.gitRoot ?? WORKSPACE_ROOT);
    process.stderr.write(`[init] Git ready\n`);
  } catch {
    process.stderr.write(`[init] Git unavailable – git tools disabled.\n`);
  }

  if (cfg.s1BridgeEnabled !== false) {
    await tryConnectBridge();
  }

  // Start local HTTP dashboard on port 7891
  startStatusServer();

  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  registerFilesystemTools(server);
  registerGitTools(server);
  registerProjectTools(server);
  registerSoundDesignTools(server);
  registerSessionTools(server);
  registerTransportTools(server);
  registerTrackTools(server);
  registerPluginTools(server);
  registerFallbackTools(server);
  registerMidiTools(server);
  registerArrangementTools(server);
  registerAutomationTools(server);

  process.stderr.write(`[init] 57 tools ready across 12 families.\n`);
  process.stderr.write(`[init] Dashboard → http://localhost:7891\n\n`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[fatal] ${err}\n`);
  process.exit(1);
});
