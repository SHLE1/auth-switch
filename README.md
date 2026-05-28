# auth-switch

[中文](./README.zh.md) · English

A local-only macOS/Windows Tauri desktop app for switching OpenAI Codex accounts by managing `auth.json` profiles and optional API-key profiles.

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
- **Local-only Tauri backend** — no network calls, no in-app update checks, no cloud sync. All data is stored in `~/.auth-switch/auth-switch.db` (SQLite).
- **Token refresh safe** — before switching away from a normal auth account, the live `auth.json` is read back and stored, so Codex token refreshes are never lost.

---

## Platforms

| Platform | Architecture | Status |
|----------|-------------|--------|
| macOS | Apple Silicon (arm64) | ✅ DMG available |
| macOS | Intel (x64) | build from source / CI release |
| Windows | x64 | NSIS installer from CI release |

> **macOS unsigned build:** You may need to right-click → Open, or allow the app in **System Settings → Privacy & Security**.
>
> **Windows prerequisite:** WebView2 Runtime is required. It is included on most current Windows installations; install it from Microsoft if the app does not launch.

---

## Install (macOS, pre-built DMG)

1. Download `auth-switch-1.0.0-arm64.dmg` from the `release/` folder or GitHub Actions release artifacts.
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
1. Reads the current live `~/.codex/auth.json` and updates the database for normal auth profiles (so no token is lost).
2. Atomically writes the selected account's stored `auth.json` to `~/.codex/auth.json`.
3. For API-key profiles only, updates the single managed top-level `openai_base_url` line in `~/.codex/config.toml`.

### Add an API-key profile
Click **Add API** in the header. Provide a name, base URL, and API key. The app will:
- Write an API-key-shaped `auth.json` (`{ "auth_mode": "apikey", "OPENAI_API_KEY": "..." }`).
- Add or update only `openai_base_url = "..."` in `~/.codex/config.toml`.

Switching back to a normal auth account comments out the auth-switch-managed `openai_base_url` line rather than deleting unrelated config.

### Tray / menu bar
The tray menu lets you switch accounts, open the main window, add an auth file, and quit without opening the window. It uses the monochrome system tray/menu-bar icon and shows shortcuts for **Open Window** (`Command+,` on macOS, `Ctrl+W` on Windows) and **Quit** (`Command+Q` on macOS, `Ctrl+Q` on Windows). Closing the main window keeps auth-switch running in the tray/menu bar; use **Quit** to exit.

### Rename / Delete
Right-click or use the inline buttons on any account row.

---

## Codex auth file path

```
${CODEX_HOME:-$HOME/.codex}/auth.json
```
Normally: `~/.codex/auth.json`

The app only reads and writes this official Codex path. It never supports custom Codex paths and never rewrites provider tables, MCP, profiles, sandbox, or other Codex configuration sections.

---

## Development

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9
- Rust stable (`rustup` recommended)
- Tauri v2 platform prerequisites
- macOS: Xcode Command Line Tools
- Windows: Microsoft C++ Build Tools and WebView2 Runtime

### Setup
```bash
pnpm install
```

### Run in development
```bash
pnpm dev
```
This starts Vite and launches the Tauri v2 app.

### Type-check
```bash
pnpm typecheck
```

### Rust checks
```bash
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

### Build (production app without installer bundle)
```bash
pnpm build
```

### Package
```bash
pnpm dist        # all configured bundles
pnpm dist:mac    # macOS DMG
pnpm dist:win    # Windows NSIS installer
```

Tauri bundle outputs are written under `src-tauri/target/release/bundle/`. The macOS script also copies the latest DMG to `release/auth-switch-<version>-<arch>.dmg` for release/Homebrew compatibility and prints its size and SHA256.

GitHub releases should be published through GitHub Actions, preferably `.github/workflows/manual-release.yml`.

---

## Project structure

```
src-tauri/       # Tauri v2 Rust backend
  src/           # commands, tray, dialogs, notifications, SQLite, Codex services
  capabilities/  # Tauri v2 permissions
  icons/         # Tauri bundle icons
src/
  renderer/      # React UI
    api/         # typed Tauri invoke/listen adapter
    components/  # AccountList, AccountRow, dialogs, …
    hooks/       # useAccounts, useTheme
    i18n/        # i18next setup + en.json / zh.json locale files
  shared/        # shared TypeScript types
plans/           # agent-generated implementation plans
```

---

## Data storage

| Item | Location |
|------|----------|
| Account database | `~/.auth-switch/auth-switch.db` |
| Live Codex auth | `~/.codex/auth.json` |
| Codex config (URL line only) | `~/.codex/config.toml` |

---

## License

MIT
