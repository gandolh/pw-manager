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

Electron app with a strict main/renderer split. The session key never leaves the main process.

**Main process (`src/main.ts`)** — owns app lifecycle, the SQLite vault, the in-memory session key, and the 10-minute idle timeout. Every renderer request goes through `requireKey()`, which throws `LOCKED` if the timeout elapsed. Emits `vault:locked` to the renderer when a timeout is detected.

**Preload (`src/preload.ts`)** — exposes a typed `window.api` via `contextBridge` with `contextIsolation: true` and `nodeIntegration: false`. The renderer has no Node access — every privileged operation is an explicit IPC method.

**Renderer (`src/renderer/`)** — vanilla TS SPA. `renderer.ts` is the entry point; renders unlock/setup/list/modal screens by swapping innerHTML. No framework, no bundler — `tsc` emits ES2022 modules loaded via `<script type="module">`.

**Pure logic modules** — reused unchanged from the original CLI:

| File | Owns |
|---|---|
| `src/db.ts` | All SQLite queries; same schema as before (`meta`, `credentials`) |
| `src/crypto.ts` | PBKDF2 (200k iterations), AES-256-GCM, format `base64(iv[12] + authTag[16] + ct)` |
| `src/commands.ts` | DB+crypto operations invoked by IPC handlers |
| `src/types.ts` | Shared interfaces |

**Vault location:** `app.getPath('userData')/vault.db` (OS-standard per-user app data directory, not the project folder).

## Build pipeline

Two separate TypeScript compilations because main is CommonJS (Node16) and renderer is ES2022 modules (browser):

- `tsconfig.json` (root) — compiles `src/*.ts` except `src/renderer/**` to `dist/`
- `src/renderer/tsconfig.json` — compiles `src/renderer/renderer.ts` to `dist/renderer/`
- `copy:assets` copies `index.html` and `styles.css` to `dist/renderer/`

`main.ts` loads the renderer via `path.join(__dirname, 'renderer', 'index.html')`.

## Native modules

`better-sqlite3` is a native module and must be rebuilt against Electron's Node ABI (not system Node). `@electron/rebuild` handles this. Run `npm run rebuild` after upgrading Electron.
