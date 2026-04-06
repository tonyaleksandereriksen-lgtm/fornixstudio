```prompt id="it800l"
### Role
Act as an experienced TypeScript / Node.js / MCP / audio-tools principal engineer with strong product-design instincts for DAW integrations, local-first desktop tooling, and plugin-assisted music workflows.

### Task
Audit the Fornix Studio repository and turn it into an implementation-ready coding starting point in VS Code for a Studio One-first, future cross-DAW producer assistant with a realistic MCP/bridge architecture, intuitive UI, patch/content update system, and a clear path to begin coding immediately.

### Context
- Repository scope: whole project.
- Primary repository: `https://github.com/tonyaleksandereriksen-lgtm/fornixstudio/tree/master`
- Assume the repo is already available locally in the working directory.
- There is also an architecture seed patch available locally at:
  - `/mnt/data/fornixstudio_architecture_seed.patch`
- Treat that patch as optional input/context:
  - inspect it,
  - reuse compatible ideas,
  - apply safe parts if they fit the codebase,
  - do not force incompatible hunks.
- Business/product goals:
  1. Have a working MCP bridge that can talk both ways where technically feasible.
  2. Make Fornix MCP able to add, remove, suggest, listen, critique, and help like a master music producer, mastering engineer, and music theorist.
  3. Have a design and UI that is easy to use and intuitive.
  4. Make it easy to update with patches and new content.
  5. Support Studio One Professional first, with future ability to support any DAW.
- Likely relevant areas to inspect and verify:
  - MCP server entrypoints and tool registration
  - bridge / transport / Studio One integration code
  - `studio-one-extension/`
  - dashboard / status UI
  - templates, production packages, workspace tooling
  - tests around handshake / bridge verification
  - any MCU / MIDI / JZZ integration
- Working assumptions to verify from the codebase:
  - The project already has a TypeScript MCP server foundation.
  - There may be a debug/status dashboard, a Studio One bridge attempt, fallback workflows, and tests around handshake or transport verification.
  - Studio One scripting/API limitations may block a true live script bridge; if confirmed, this must shape the architecture.
- Known constraints:
  - Prefer local-first architecture.
  - No cloud dependency should be required for core DAW control flows.
  - Keep security tight: no unsafe arbitrary shell/file behavior beyond project intent.
  - Avoid coupling musician UX directly to debug tooling.
  - Future-proof for cross-DAW adapters.
  - Keep recommendations incremental and realistic.
  - The result must help a developer open the repo in VS Code and start coding immediately.

### Expected Output
Provide the result in this exact structure:

1. **Repository Findings**
   - Summarize the current architecture as discovered from the codebase.
   - Identify what is already partially implemented vs. missing.
   - Call out contradictions between docs, code, tests, and implementation status.
   - Mention whether the seed patch contains useful direction.

2. **A. Prioritized file-by-file refactor plan**
   - Give a prioritized roadmap tied to actual files/folders in the repo.
   - For each item include:
     - why it matters,
     - current issue,
     - target state,
     - concrete changes,
     - risk level,
     - dependency ordering.
   - Be specific about files to edit, split, deprecate, or replace.

3. **B. Deep review of the Studio One bridge and extension**
   - Inspect the current Studio One integration path in detail.
   - Determine whether the current Studio One approach can truly support two-way communication.
   - Distinguish clearly between:
     - proven working,
     - partially working,
     - speculative,
     - blocked by host/API limitations.
   - Review transport logic, handshake logic, write-gating logic, failure handling, and tests.
   - If the current Studio One extension path is not viable, say so directly and recommend what it should become instead.

4. **C. DAW-agnostic architecture design**
   - Design a clean architecture that supports Studio One first but does not trap the product there.
   - Define:
     - core domain/session model,
     - producer-intent layer,
     - DAW capability model,
     - adapter interface,
     - patch/content system,
     - execution surfaces.
   - Propose concrete TypeScript interfaces and module boundaries.
   - Explain how capabilities degrade gracefully across DAWs.
   - Include a migration path from current repo structure to target architecture.

5. **Design and UI recommendations**
   - Propose a musician/producer-facing UX direction.
   - Separate clearly:
     - creator UX,
     - diagnostics/dev UX,
     - settings/content management UX.
   - Suggest information architecture, main screens, navigation, key workflows, and interaction principles.
   - Recommend “preview / apply / undo / rollback” behavior.
   - Include two MVP workflow designs:
     - “Critique this drop”
     - “Prepare for mastering”

6. **Direct in-DAW solution assessment**
   - Evaluate feasibility of a direct DAW solution such as a VST3/VSTi-style plugin or equivalent companion plugin.
   - Compare:
     - thin DAW plugin + local Fornix daemon
     - fully self-contained plugin
     - host-specific Studio One extension/plugin route
     - external desktop/web app only
   - Recommend the best near-term and long-term architecture.
   - Include a message protocol sketch between plugin companion and local Fornix service if recommended.
   - Explain realtime/audio-thread safety constraints.

7. **Concrete implementation blueprint**
   - Provide a proposed folder/file structure for:
     - `src/daw/`
     - `src/producer/`
     - UI app / desktop-web shell
     - content/patch packs
   - Include TypeScript interface stubs or skeleton code for the most important new modules.
   - Keep code focused and useful.

8. **VS Code coding bootstrap**
   - Add everything needed so a developer can start coding immediately in VS Code.
   - Include:
     - recommended `.vscode/` files to create or update,
     - `tasks.json`,
     - `launch.json`,
     - `settings.json`,
     - `extensions.json`,
     - any workspace recommendations,
     - npm scripts that should exist,
     - a minimal `README` developer quickstart section,
     - env/example files if needed,
     - lint/test/typecheck/dev commands,
     - debug entrypoints for server/UI/tests.
   - If useful, generate these files directly as code or unified diffs.
   - Prefer practical defaults over elaborate setup.

9. **Execution roadmap**
   - End with:
     - a 30-day MVP plan,
     - a 60–90 day expansion plan,
     - biggest technical risks,
     - biggest product risks,
     - recommended first 5 implementation tasks.

### Coding Deliverables
After the analysis/design sections, implement the highest-value safe changes now.

Deliver:
- a **unified diff patch** and/or new files,
- any `.vscode/` bootstrap files needed to start development in VS Code,
- minimal but real architectural scaffolding for:
  - `src/daw/`
  - `src/producer/`
  - UI shell separation from debug tooling
- updated or added npm scripts needed for local development,
- tests where practical.

Prefer changes that:
- improve project structure immediately,
- do not overcommit to unverified DAW behavior,
- make the repo easier to open, run, debug, and extend in VS Code.

### Guidance for Codex
1. Think step-by-step internally: inspect → map architecture → verify constraints → review seed patch → propose target model → bootstrap VS Code → implement safe scaffolding.
2. Run a self-critique loop once before finalizing.
3. Do not pretend unverified behavior is working.
4. Use repository evidence as the source of truth.
5. If docs and implementation disagree, call it out clearly.
6. Prefer realistic incremental architecture over idealized rewrites.
7. Treat DAW integration as a capability-matrix problem, not a Studio One-only hack.
8. Keep security, offline operation, rollback safety, and maintainability in mind.
9. Do not expose secrets, API keys, or user data.
10. No external network calls after `setup script`.
11. Keep generated code focused; avoid unnecessary boilerplate.
12. If the seed patch is useful, incorporate its intent and mention what was reused.

### Setup Script (if needed)
```bash
set -e

if [ -f package.json ]; then
  npm install
fi

if [ -f /mnt/data/fornixstudio_architecture_seed.patch ]; then
  echo "Seed patch detected: /mnt/data/fornixstudio_architecture_seed.patch"
fi

if [ -f tsconfig.json ]; then
  npx tsc --noEmit || true
fi

if npm run | grep -q "test"; then
  npm test || true
fi
```

### End
```
