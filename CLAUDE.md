# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # Installs deps and rebuilds better-sqlite3 against Electron's Node ABI
npm run rebuild    # Re-run the native rebuild if Electron version changes
npm start          # Build and launch the Electron app
npm run build      # Compile main + renderer + copy HTML/CSS to dist/
npx tsc --noEmit   # Type-check main process
npx tsc -p src/renderer/tsconfig.json --noEmit  # Type-check renderer
```

## Architecture

Electron app organized by process boundary. The session key never leaves the main process.

```
src/
  main/      # Node-only — runs in the main Electron process
  preload/   # Bridge — runs in the preload context
  renderer/  # Browser-only — vanilla TS SPA, no Node access
  shared/    # Types and IPC channel names imported by all three
```

**Main (`src/main/`)** — `main.ts` boots the app and wires modules; `session.ts` owns the in-memory key + 10-minute idle timeout (emits `vault:locked` on expiry); `ipc.ts` registers every `ipcMain.handle` and gates them on `session.requireKey()` (throws `LOCKED`); `db.ts` owns SQLite queries; `crypto.ts` owns PBKDF2 + AES-256-GCM; `commands.ts` composes db + crypto for each handler.

**Preload (`src/preload/preload.ts`)** — exposes `window.api` via `contextBridge` with `contextIsolation: true` and `nodeIntegration: false`. Uses the `IPC` channel-name map from `shared/api.ts` so main and preload can't drift.

**Renderer (`src/renderer/`)** — vanilla TS SPA. `renderer.ts` swaps `innerHTML` to render unlock/setup/list/modal screens. No framework, no bundler. Imports only `import type` from `shared/` — no runtime Node access.

**Shared (`src/shared/`)** — `types.ts` (domain types: `Credential`, `Meta`, `CredentialInput`, etc.) and `api.ts` (the `Api` interface that preload implements and renderer types against, plus the `IPC` channel-name constant). Single source of truth for the IPC contract.

**Vault location:** `app.getPath('userData')/vault.db`.

## Build pipeline

Two separate TypeScript compilations because main is CommonJS (Node16) and renderer is ES2022 modules (browser):

- `tsconfig.json` (root) — compiles `src/main/`, `src/preload/`, `src/shared/` to `dist/{main,preload,shared}/` as CommonJS.
- `src/renderer/tsconfig.json` — compiles `src/renderer/renderer.ts` to `dist/renderer/renderer.js` as ES modules. `rootDir` is `..` (src/) so the shared files are visible to the type-checker; only `renderer.ts` produces runtime output since renderer uses `import type` from `shared/`.
- `copy:assets` copies `index.html` and `styles.css` to `dist/renderer/`.

`main.ts` loads the renderer via `path.join(__dirname, '..', 'renderer', 'index.html')` and the preload via `path.join(__dirname, '..', 'preload', 'preload.js')`.

## Native modules

`better-sqlite3` is a native module and must be rebuilt against Electron's Node ABI (not system Node). `@electron/rebuild` handles this. Run `npm run rebuild` after upgrading Electron.
