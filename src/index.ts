// ─── Fornix Studio MCP – Main Entry Point ────────────────────────────────────

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { loadWorkspaceConfig } from "./services/workspace.js";
import { initLogger } from "./services/logger.js";
import { initGit } from "./services/checkpoint.js";
import { getBridgeRuntimeStatus, tryConnectBridge } from "./services/bridge.js";
import {
  TOOL_MANIFEST,
  incrementToolCall,
  startStatusServer,
} from "./services/status-server.js";

import { registerFilesystemTools }  from "./tools/filesystem.js";
import { registerGitTools }         from "./tools/git.js";
import { registerProjectTools }     from "./tools/project.js";
import { registerSoundDesignTools } from "./tools/sound-design.js";
import { registerSessionTools }     from "./tools/session.js";
import { registerProductionPackageTools } from "./tools/production-package.js";
import { registerTransportTools }   from "./tools/studio-one/transport.js";
import { registerTrackTools }       from "./tools/studio-one/tracks.js";
import { registerPluginTools }      from "./tools/studio-one/plugins.js";
import { registerFallbackTools }    from "./tools/studio-one/fallback.js";
import { registerMidiTools }        from "./tools/studio-one/midi.js";
import { registerArrangementTools } from "./tools/studio-one/arrangement.js";
import { registerAutomationTools }  from "./tools/studio-one/automation.js";
import { registerWorkspaceProfileTools } from "./tools/workspace-profile.js";
import { registerArrangementAnalysisTools } from "./tools/arrangement.js";
import { registerSongWatcherTools } from "./tools/song-watcher.js";

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? process.cwd();

function instrumentToolRegistration(server: McpServer): void {
  const rawServer = server as unknown as {
    registerTool: (name: string, config: unknown, handler: (...args: unknown[]) => unknown) => unknown;
  };

  const originalRegisterTool = rawServer.registerTool.bind(server);

  rawServer.registerTool = (name, config, handler) => {
    return originalRegisterTool(name, config, async (...args: unknown[]) => {
      incrementToolCall();
      return await handler(...args);
    });
  };
}

async function main(): Promise<void> {
  process.stderr.write(`\n[Fornix Studio MCP v${SERVER_VERSION}] Starting...\n`);

  const cfg = loadWorkspaceConfig(WORKSPACE_ROOT);
  process.stderr.write(`[init] Workspace: ${cfg.allowedDirs.join(", ")}\n`);

  initLogger(WORKSPACE_ROOT);

  try {
    initGit(cfg.gitRoot ?? WORKSPACE_ROOT);
    process.stderr.write("[init] Git ready\n");
  } catch {
    process.stderr.write("[init] Git unavailable – git tools disabled.\n");
  }

  if (cfg.s1BridgeEnabled !== false) {
    await tryConnectBridge();
    const bridgeRuntime = getBridgeRuntimeStatus();

    if (bridgeRuntime.handshakeOk) {
      process.stderr.write("[init] Studio One live bridge is enabled, experimental, and handshaken.\n");
    } else {
      process.stderr.write(
        `[init] Studio One live bridge enabled but not verified (state=${bridgeRuntime.state}, handshake=${bridgeRuntime.handshakeOk ? "ok" : "pending"}).\n`,
      );
      process.stderr.write("[init] Fallback Studio One workflows remain first-class.\n");
    }
  } else {
    process.stderr.write("[init] Studio One live bridge disabled in config; fallback tools remain available.\n");
  }

  startStatusServer();

  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  instrumentToolRegistration(server);

  registerFilesystemTools(server);
  registerGitTools(server);
  registerProjectTools(server);
  registerSoundDesignTools(server);
  registerSessionTools(server);
  registerProductionPackageTools(server);
  registerTransportTools(server);
  registerTrackTools(server);
  registerPluginTools(server);
  registerFallbackTools(server);
  registerMidiTools(server);
  registerArrangementTools(server);
  registerAutomationTools(server);
  registerWorkspaceProfileTools(server);
  registerArrangementAnalysisTools(server);
  registerSongWatcherTools(server);

  const familyCount = new Set(TOOL_MANIFEST.map((tool) => tool.family)).size;
  process.stderr.write(`[init] ${TOOL_MANIFEST.length} tools ready across ${familyCount} families.\n`);
  process.stderr.write("[init] Dashboard → http://localhost:7891\n\n");

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[fatal] ${err}\n`);
  process.exit(1);
});
