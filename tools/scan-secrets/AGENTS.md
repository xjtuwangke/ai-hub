# scan-secrets Tool

## Scope

This folder is an independent secret scanning tool. Changes in this folder should not alter core `src/` CLI behavior unless explicitly requested.

## Build & Run

- Install dependencies at repo root first: `npm install`.
- Build: `npm run build` under `tools/scan-secrets`.
- Run: `node dist/index.js --help`.

## Code Style

- Keep command-line behavior consistent with root `scan-secrets`.
- Preserve compatibility of flags and output formats (`summary`, `json`, `sarif`).
- Keep error messages actionable, especially for plugin loading and rule parsing.
- Prefer small, isolated changes in `src/secret-scan/*` when extending detection logic.
