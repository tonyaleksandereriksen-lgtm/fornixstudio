#!/usr/bin/env node
// ─── Fornix Studio MCP – Setup Validator ─────────────────────────────────────
//
// Run this before launching the MCP server to check everything is wired up.
// Usage: node validate-setup.mjs
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { createServer } from "net";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RESET  = "\x1b[0m";
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";

let passed = 0;
let warnings = 0;
let failed = 0;

function ok(label, detail = "") {
  console.log(`  ${GREEN}✓${RESET} ${label}${detail ? `  ${YELLOW}${detail}${RESET}` : ""}`);
  passed++;
}

function warn(label, detail = "") {
  console.log(`  ${YELLOW}⚠${RESET} ${label}${detail ? `  – ${detail}` : ""}`);
  warnings++;
}

function fail(label, detail = "") {
  console.log(`  ${RED}✗${RESET} ${label}${detail ? `  – ${detail}` : ""}`);
  failed++;
}

function section(title) {
  console.log(`\n${BOLD}${CYAN}▸ ${title}${RESET}`);
}

function checkPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port, "127.0.0.1");
  });
}

async function main() {
  console.log(`\n${BOLD}╔══════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}║   Fornix Studio MCP – Setup Validator    ║${RESET}`);
  console.log(`${BOLD}╚══════════════════════════════════════════╝${RESET}`);

  // ── 1. Node.js version ────────────────────────────────────────────────────
  section("Node.js");
  try {
    const version = process.version;
    const major = parseInt(version.slice(1));
    if (major >= 18) {
      ok(`Node.js ${version}`);
    } else {
      fail(`Node.js ${version}`, "Version 18+ required");
    }
  } catch {
    fail("Cannot read Node.js version");
  }

  // ── 2. npm ────────────────────────────────────────────────────────────────
  try {
    const npmVer = execSync("npm --version", { encoding: "utf8" }).trim();
    ok(`npm ${npmVer}`);
  } catch {
    fail("npm not found");
  }

  // ── 3. TypeScript / build ─────────────────────────────────────────────────
  section("Build");
  const distPath = path.join(__dirname, "dist", "index.js");
  if (fs.existsSync(distPath)) {
    const stat = fs.statSync(distPath);
    const ageMin = (Date.now() - stat.mtimeMs) / 60000;
    if (ageMin > 60) {
      warn("dist/index.js exists but is old", `Last built ${Math.round(ageMin)} minutes ago – run npm run build`);
    } else {
      ok("dist/index.js built", `${Math.round(ageMin)} min ago`);
    }
  } else {
    fail("dist/index.js not found", "Run: npm run build");
  }

  const tscPath = path.join(__dirname, "node_modules", ".bin", "tsc");
  if (fs.existsSync(tscPath)) {
    ok("TypeScript compiler found");
  } else {
    fail("TypeScript not installed", "Run: npm install");
  }

  // ── 4. Dependencies ───────────────────────────────────────────────────────
  section("Dependencies");
  const required = [
    "@modelcontextprotocol/sdk",
    "zod",
    "simple-git",
    "ws",
    "glob",
  ];
  for (const pkg of required) {
    const pkgPath = path.join(__dirname, "node_modules", pkg);
    if (fs.existsSync(pkgPath)) {
      ok(pkg);
    } else {
      fail(pkg, "Not installed – run: npm install");
    }
  }

  // ── 5. Workspace config ───────────────────────────────────────────────────
  section("Workspace Config");
  const envRoot = process.env.WORKSPACE_ROOT;
  const configPath = envRoot
    ? path.join(envRoot, "fornix-mcp.config.json")
    : path.join(__dirname, "fornix-mcp.config.json");

  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
      ok("fornix-mcp.config.json found");

      const configDir = path.dirname(configPath);

      if (cfg.allowedDirs?.length) {
        for (const dir of cfg.allowedDirs) {
          const resolvedDir = path.isAbsolute(dir) ? dir : path.resolve(configDir, dir);
          if (fs.existsSync(resolvedDir)) {
            ok(`Allowed dir exists: ${resolvedDir}`);
          } else {
            warn(`Allowed dir not found: ${resolvedDir}`, "Create it or update config");
          }
        }
      } else {
        warn("allowedDirs is empty in config");
      }

      if (cfg.s1BridgeEnabled) {
        warn("Studio One bridge enabled in config", "Bridge support is experimental; keep fallback tools available");
      } else {
        warn("Studio One bridge disabled in config", "Set s1BridgeEnabled: true to enable DAW control");
      }
    } catch (e) {
      fail("fornix-mcp.config.json is invalid JSON", String(e));
    }
  } else {
    warn("fornix-mcp.config.json not found", `Expected at: ${configPath}`);
    warn("Using defaults – workspace access limited to current directory");
  }

  // ── 6. Git ────────────────────────────────────────────────────────────────
  section("Git");
  try {
    const gitVer = execSync("git --version", { encoding: "utf8" }).trim();
    ok(gitVer);
  } catch {
    fail("Git not found", "Install git for checkpoint/rollback support");
  }

  const gitRoot = envRoot ?? __dirname;
  const gitDir = path.join(gitRoot, ".git");
  if (fs.existsSync(gitDir)) {
    ok(`Git repo found at ${gitRoot}`);
  } else {
    warn(`No .git at ${gitRoot}`, "Run: git init && git commit --allow-empty -m 'init'");
  }

  // ── 7. Studio One bridge port ─────────────────────────────────────────────
  section("Studio One Bridge");
  const portFree = await checkPortFree(7890);
  if (!portFree) {
    warn("Port 7890 is in use", "This is only a hint. It does not prove the Fornix Studio One extension loaded successfully.");
  } else {
    warn("Port 7890 is free – Studio One is not running, the extension is not loaded, or another bridge is not listening");
    warn("File-based fallback tools will still work");
  }

  section("Bridge lifecycle (MCP-side honesty)");
  warn(
    "This validator cannot prove end-to-end Studio One control.",
    "Socket open ≠ handshake OK ≠ live read/write verified. After starting the MCP server with the bridge enabled, use the dashboard or s1_probe_runtime to inspect proof states: extensionLoaded → listenerCreated → handshakeOk → liveReadVerified → liveWriteVerified → runtimeVerified. Write commands are gated until one live read is verified. Full human checklist: scripts/bridge-runtime-checklist.txt",
  );

  // ── 8. Extension startup markers ─────────────────────────────────────────
  section("Extension Runtime Evidence");
  const homeDir = process.env.USERPROFILE ?? process.env.HOME ?? "";
  const extensionLogDir = path.join(homeDir, "Documents", "FornixMCP", "logs");

  if (!fs.existsSync(extensionLogDir)) {
    warn("Extension log directory not found: " + extensionLogDir,
      "The Studio One extension has never written a startup marker here.\n" +
      "    Either the extension has not been installed, not yet run, or\n" +
      "    Host.FileSystem.writeFile is unavailable in this Studio One version.\n" +
      "    See README.md for installation instructions.");
  } else {
    let logFiles;
    try {
      logFiles = fs.readdirSync(extensionLogDir).filter(
        (f) => f.startsWith("startup-") || f.startsWith("shutdown-"),
      );
    } catch {
      logFiles = [];
    }

    if (!logFiles.length) {
      warn("Log directory exists but contains no startup/shutdown markers",
        "The extension may have run but Host.FileSystem.writeFile was unavailable.\n" +
        "    Check Studio One's script console for [FornixMCPBridge] lines.");
    } else {
      const startups = logFiles.filter((f) => f.startsWith("startup-"));
      const shutdowns = logFiles.filter((f) => f.startsWith("shutdown-"));
      ok(`Extension has been observed running: ${startups.length} startup marker(s), ${shutdowns.length} shutdown marker(s)`);

      // Report the most recent startup marker contents
      const sorted = startups
        .map((f) => ({ name: f, ts: parseInt((f.match(/(\d{10,})/) || ["0", "0"])[1], 10) }))
        .sort((a, b) => b.ts - a.ts);

      if (sorted.length > 0) {
        try {
          const latest = JSON.parse(fs.readFileSync(path.join(extensionLogDir, sorted[0].name), "utf8"));
          const hostInfo = latest.host ?? {};
          if (hostInfo.websocketServer) {
            ok("Host.WebSocket.createServer: available in last run");
          } else {
            warn("Host.WebSocket.createServer: NOT available in last run",
              "The extension ran but could not open a WebSocket server port.\n" +
              "    Port 7890 will never be opened until this API becomes available.\n" +
              "    Bridge mode cannot work; use file-based fallback tools.");
          }
          if (hostInfo.filesystemWrite) {
            ok("Host.FileSystem.writeFile: available in last run");
          } else {
            warn("Host.FileSystem.writeFile: NOT available in last run");
          }
          const ts = latest.timestamp ? new Date(latest.timestamp).toLocaleString() : "unknown time";
          ok("Last startup: " + ts);
        } catch {
          warn("Could not parse most recent startup marker");
        }
      }
    }
  }

  // ── 9. Claude Desktop config ──────────────────────────────────────────────
  section("Claude Desktop");
  const claudeConfigPaths = [
    path.join(process.env.APPDATA ?? "", "Claude", "claude_desktop_config.json"),
    path.join(process.env.HOME ?? "", "Library", "Application Support", "Claude", "claude_desktop_config.json"),
  ];

  let claudeFound = false;
  for (const cfgPath of claudeConfigPaths) {
    if (fs.existsSync(cfgPath)) {
      claudeFound = true;
      try {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
        if (cfg.mcpServers?.["fornix-studio"]) {
          ok("fornix-studio MCP server configured in Claude Desktop");
          const serverCfg = cfg.mcpServers["fornix-studio"];
          if (serverCfg.env?.WORKSPACE_ROOT) {
            ok(`WORKSPACE_ROOT set: ${serverCfg.env.WORKSPACE_ROOT}`);
          } else {
            warn("WORKSPACE_ROOT not set in Claude Desktop config");
          }
        } else {
          warn("Claude Desktop config found but fornix-studio not in mcpServers");
          warn("Add the server config from claude_desktop_config.example.json");
        }
      } catch {
        warn("Could not parse Claude Desktop config");
      }
      break;
    }
  }
  if (!claudeFound) {
    warn("Claude Desktop config not found", "See README.md Step 4");
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${BOLD}─────────────────────────────────────────────${RESET}`);
  console.log(`  ${GREEN}✓ Passed:${RESET}   ${passed}`);
  if (warnings > 0) console.log(`  ${YELLOW}⚠ Warnings:${RESET} ${warnings}`);
  if (failed > 0) console.log(`  ${RED}✗ Failed:${RESET}   ${failed}`);
  console.log(`${BOLD}─────────────────────────────────────────────${RESET}\n`);

  if (failed > 0) {
    console.log(`${RED}Fix the failing checks above before starting the MCP server.${RESET}\n`);
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`${YELLOW}Warnings detected. The server will start but some features may be limited.${RESET}\n`);
  } else {
    console.log(`${GREEN}${BOLD}All checks passed. Ready to start the MCP server.${RESET}\n`);
    console.log(`Run: ${CYAN}node dist/index.js${RESET}\n`);
  }
}

main().catch(e => {
  console.error(`\nValidator crashed: ${e}\n`);
  process.exit(1);
});
