# Fornix VS Code quickstart

## Recommended placement
- Keep the prompt in `PROMPTS/fornix-codex-start.prompt.md`
- Keep editor bootstrap in `.vscode/`
- Keep architecture/reference notes in `docs/`
- Keep incoming patch files in `patches/` or `docs/seed/`

## Suggested developer flow
1. Open the repository root in VS Code.
2. Run `npm install`.
3. Start with:
   - `npm run dev`
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
4. Open the prompt file and paste it into Codex / ChatGPT / your coding assistant.
5. Let the assistant work against the repo root.

## Suggested npm scripts
Make sure these scripts exist in `package.json`:
```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  }
}
```

## Optional seed patch placement
Put architecture seed patches in:
- `patches/fornixstudio_architecture_seed.patch`
or
- `docs/seed/fornixstudio_architecture_seed.patch`
