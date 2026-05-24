# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Run the interactive REPL
npm test           # Run all tests (vitest)
npm run test:watch # Run tests in watch mode
npm run build      # Compile TypeScript to dist/
npx tsc --noEmit   # Type-check without emitting

# Run a single test file
npx vitest run tests/crypto.test.ts

# Run a single test by name
npx vitest run --reporter=verbose -t "round-trips plaintext"
```

## Architecture

The app is a single-process Node.js REPL. `src/index.ts` owns all I/O and session state; the four other modules are pure functions with no side effects beyond SQLite.

**Data flow:**

1. `index.ts` opens the SQLite vault via `db.ts`
2. On startup, `crypto.ts` derives the AES-256-GCM key from the master password + stored salt (PBKDF2, 200k iterations). The key lives only in the module-level `sessionKey: Buffer | null` variable — it is never written to disk.
3. Every command goes through `commands.ts`, which calls `db.ts` for storage and `crypto.ts` for encrypt/decrypt. Passwords are encrypted individually per row; the stored format is `base64(iv[12] + authTag[16] + ciphertext)`.
4. The `meta` table holds the salt and a known-plaintext verification blob (`"pw-manager-ok"` encrypted) used to validate the master password without storing it.
5. Session timeout (10 min inactivity) is checked before each command using `Date.now()`; re-authentication follows the same 3-attempt limit as startup.

**Module responsibilities:**

| File | Owns |
|---|---|
| `src/index.ts` | REPL loop, session key, timeout, auth flow, command dispatch |
| `src/commands.ts` | Command handler functions — no I/O, pure DB+crypto logic |
| `src/db.ts` | All SQLite queries; `initDb(':memory:')` used in tests |
| `src/crypto.ts` | Key derivation, AES-256-GCM encrypt/decrypt, salt generation |
| `src/clipboard.ts` | Thin `clipboardy` wrapper |
| `src/types.ts` | `Credential` and `Meta` interfaces shared across modules |

**Vault location:** `data/vault.db` (relative to process CWD, gitignored).

## Testing notes

Tests use in-memory SQLite (`initDb(':memory:')`), so no files are created. `src/index.ts` has no unit tests — it is I/O orchestration and is verified by manual smoke-test. The `tests/` directory is excluded from `tsconfig.json`; tests import directly from `src/` using bare (non-`.js`) paths, which vitest resolves correctly.
