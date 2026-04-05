/**
 * TOOL_MANIFEST drift test
 *
 * Registers every tool family against a fake McpServer and compares the
 * collected names against the static TOOL_MANIFEST list in status-server.ts.
 *
 * Why: TOOL_MANIFEST is maintained by hand.  This test catches tool additions,
 * removals, or renames that are not reflected in the manifest, before they
 * silently produce a wrong tool count in the dashboard.
 *
 * No build step required — this test imports from dist/, so npm run build must
 * have been run first (it is included in "npm test").
 */

import test from "node:test";
import assert from "node:assert/strict";

import { TOOL_MANIFEST } from "../../dist/services/status-server.js";

import { registerFilesystemTools }        from "../../dist/tools/filesystem.js";
import { registerGitTools }               from "../../dist/tools/git.js";
import { registerProjectTools }           from "../../dist/tools/project.js";
import { registerSoundDesignTools }       from "../../dist/tools/sound-design.js";
import { registerSessionTools }           from "../../dist/tools/session.js";
import { registerProductionPackageTools } from "../../dist/tools/production-package.js";
import { registerTransportTools }         from "../../dist/tools/studio-one/transport.js";
import { registerTrackTools }             from "../../dist/tools/studio-one/tracks.js";
import { registerPluginTools }            from "../../dist/tools/studio-one/plugins.js";
import { registerFallbackTools }          from "../../dist/tools/studio-one/fallback.js";
import { registerMidiTools }              from "../../dist/tools/studio-one/midi.js";
import { registerArrangementTools }       from "../../dist/tools/studio-one/arrangement.js";
import { registerAutomationTools }        from "../../dist/tools/studio-one/automation.js";
import { registerWorkspaceProfileTools } from "../../dist/tools/workspace-profile.js";

function collectRegisteredNames() {
  const names = [];
  const fakeServer = {
    registerTool(name) {
      names.push(name);
    },
  };

  registerFilesystemTools(fakeServer);
  registerGitTools(fakeServer);
  registerProjectTools(fakeServer);
  registerSoundDesignTools(fakeServer);
  registerSessionTools(fakeServer);
  registerProductionPackageTools(fakeServer);
  registerTransportTools(fakeServer);
  registerTrackTools(fakeServer);
  registerPluginTools(fakeServer);
  registerFallbackTools(fakeServer);
  registerMidiTools(fakeServer);
  registerArrangementTools(fakeServer);
  registerAutomationTools(fakeServer);
  registerWorkspaceProfileTools(fakeServer);

  return names;
}

test("TOOL_MANIFEST matches every tool name that each register* function registers", () => {
  const registered = collectRegisteredNames();
  const manifestNames = TOOL_MANIFEST.map((t) => t.name);

  const inRegisteredNotManifest = registered.filter((n) => !manifestNames.includes(n));
  const inManifestNotRegistered = manifestNames.filter((n) => !registered.includes(n));

  assert.deepEqual(
    inRegisteredNotManifest,
    [],
    `Tools registered in code but missing from TOOL_MANIFEST:\n  ${inRegisteredNotManifest.join(", ")}`,
  );

  assert.deepEqual(
    inManifestNotRegistered,
    [],
    `Tools in TOOL_MANIFEST but not registered by any register* function:\n  ${inManifestNotRegistered.join(", ")}`,
  );
});

test("TOOL_MANIFEST has no duplicate tool names", () => {
  const manifestNames = TOOL_MANIFEST.map((t) => t.name);
  const seen = new Set();
  const duplicates = [];

  for (const name of manifestNames) {
    if (seen.has(name)) {
      duplicates.push(name);
    }
    seen.add(name);
  }

  assert.deepEqual(duplicates, [], `Duplicate names in TOOL_MANIFEST: ${duplicates.join(", ")}`);
});
