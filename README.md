# auth-switch

[中文](./README.zh.md) · English

A local-only macOS/Windows desktop app for switching OpenAI Codex accounts by managing `auth.json` profiles and optional API-key profiles.

---

## Features

- **One-click account switching** — replaces `~/.codex/auth.json` atomically.
- **Multiple account import** — import any number of Codex `auth.json` files.
- **Auto-detect email** — parses account email from `auth.json` automatically.
- **Custom display names** — rename any account to something memorable.
- **API-key profiles** — add OpenAI-compatible endpoints (e.g. AiHubMix, custom proxies); manages only the `openai_base_url` line in `~/.codex/config.toml`.
- **Tray / menu-bar quick switcher** — switch accounts without opening the main window.
- **Dark / light theme** — follows system preference; toggleable in the header.
- **English / Simplified Chinese UI** — language toggle in the header, preference saved locally.
- **Local-only** — no network calls, no cloud sync. All data is stored in `~/.auth-switch/auth-switch.db` (SQLite).
- **Token refresh safe** — before switching away from the current account, the live `auth.json` is read back and stored, so Codex token refreshes are never lost.

---

## Platforms

| Platform | Architecture | Status |
|----------|-------------|--------|
| macOS | Apple Silicon (arm64) | ✅ DMG available |
| macOS | Intel (x64) | build from source |
| Windows | x64 | build from source |

> **macOS unsigned build:** You may need to right-click → Open, or allow the app in **System Settings → Privacy & Security**.

---

## Install (macOS, pre-built DMG)

1. Download `auth-switch-0.1.0-arm64.dmg` from the `release/` folder.
2. Open the DMG and drag **auth-switch** to Applications.
3. Launch the app; on first run it will offer to import your existing `~/.codex/auth.json`.

---

## Usage

### First run
On first launch the app checks for an existing `~/.codex/auth.json`. If found, it will ask whether to import it as your first account.

### Add a Codex account
Click **Add auth.json** in the main window, or use **Tray → Add auth.json**. Select a Codex `auth.json` file.

### Switch account
Click **Switch** next to any account in the list. The app:
1. Reads the current live `~/.codex/auth.json` and updates the database (so no token is lost).
2. Atomically writes the selected account's stored `auth.json` to `~/.codex/auth.json`.

### Add an API-key profile
Click **Add API** in the header. Provide a name, base URL, and API key. The app will:
- Write an API-key-shaped `auth.json` (`{ "auth_mode": "apikey", "OPENAI_API_KEY": "..." }`).
- Add or update only `openai_base_url = "..."` in `~/.codex/config.toml`.

Switching back to a normal auth account comments out the `openai_base_url` line rather than deleting it.

### Tray / menu bar
The tray menu lets you switch accounts, open the main window, add an auth file, and quit without opening the window.

### Rename / Delete
Right-click or use the inline buttons on any account row.

---

## Codex auth file path

```
${CODEX_HOME:-$HOME/.codex}/auth.json
```
Normally: `~/.codex/auth.json`

The app only reads and writes this path. It never modifies other Codex configuration.

---

## Development

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9

### Setup
```bash
pnpm install
```

### Run in development
```bash
pnpm dev
```

### Type-check
```bash
pnpm typecheck
```

### Build (production bundle)
```bash
pnpm build
```

### Package (DMG / NSIS installer)
```bash
pnpm dist
```

The DMG will be written to `release/auth-switch-<version>-arm64.dmg`.

---

## Project structure

```
src/
  main/          # Electron main process (IPC, tray, window, Codex services)
    codex/       # auth.json read/write, config.toml management
    db/          # SQLite database layer
    services/    # account switching logic
  renderer/      # React UI
    components/  # AccountList, AccountRow, dialogs, …
    hooks/       # useAccounts, useTheme
    i18n/        # i18next setup + en.json / zh.json locale files
  preload/       # contextBridge API exposure
  shared/        # shared TypeScript types
plans/           # agent-generated implementation plans
```

---

## Data storage

| Item | Location |
|------|----------|
| Account database | `~/.auth-switch/auth-switch.db` |
| Live Codex auth | `~/.codex/auth.json` |
| Codex config (url only) | `~/.codex/config.toml` |

---

## License

MIT
