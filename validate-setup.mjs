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

      if (cfg.allowedDirs?.length) {
        for (const dir of cfg.allowedDirs) {
          if (fs.existsSync(dir)) {
            ok(`Allowed dir exists: ${dir}`);
          } else {
            warn(`Allowed dir not found: ${dir}`, "Create it or update config");
          }
        }
      } else {
        warn("allowedDirs is empty in config");
      }

      if (cfg.s1BridgeEnabled) {
        ok("Studio One bridge enabled in config");
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
    ok("Port 7890 in use – Studio One Extension is likely running ✓");
  } else {
    warn("Port 7890 is free – Studio One not running or Extension not loaded");
    warn("File-based fallback tools will still work");
  }

  // ── 8. Claude Desktop config ──────────────────────────────────────────────
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
