# auth-switch

[中文](./README.zh.md) · English

A local-only macOS/Windows Tauri desktop app for switching Codex accounts and Claude Code API-key profiles by managing each tool's official local config files.

---

## Features

- **One-click account switching** — replaces `~/.codex/auth.json` atomically.
- **Multiple account import** — import Codex `auth.json` by choosing a local file or pasting JSON content manually.
- **Auto-detect email** — parses account email from `auth.json` automatically.
- **Custom display names** — rename any account to something memorable.
- **Usage and balance display** — shows remaining Codex subscription quota for ChatGPT/OAuth `auth.json` accounts and API-key profile balance for supported new-api/sub2api endpoints.
- **API-key profiles** — add OpenAI-compatible endpoints (e.g. AiHubMix, custom proxies); manages only the `openai_base_url` line in `~/.codex/config.toml`.
- **Claude Code API profiles** — add and switch Claude Code API-key profiles by writing `~/.claude/settings.json`.
- **Tray / menu-bar quick switcher** — switch accounts without opening the main window.
- **Dark / light theme** — follows system preference; toggleable in the header.
- **English / Simplified Chinese UI** — language toggle in the header, preference saved locally.
- **Local-first Tauri backend** — no cloud sync, no app telemetry, and no in-app update checks. All data is stored in `~/.auth-switch/auth-switch.db` (SQLite). The only external requests are explicit usage/balance checks to OpenAI/ChatGPT, new-api, or sub2api endpoints for the selected profile.
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
Click **Add auth.json** in the main window. Choose **Choose local file** to select a Codex `auth.json`, or choose **Paste JSON content** to paste the full file contents manually.

### Switch account
Click **Switch** next to any account in the list. The app:
1. Reads the current live `~/.codex/auth.json` and updates the database for normal auth profiles (so no token is lost).
2. Atomically writes the selected account's stored `auth.json` to `~/.codex/auth.json`.
3. For API-key profiles only, updates the single managed top-level `openai_base_url` line in `~/.codex/config.toml`.

### Add a Codex API-key profile
Click **Add API** in the Codex tab. Provide a name, base URL, and API key. The app will:
- Write an API-key-shaped `auth.json` (`{ "auth_mode": "apikey", "OPENAI_API_KEY": "..." }`).
- Add or update only `openai_base_url = "..."` in `~/.codex/config.toml`.

Switching back to a normal auth account comments out the auth-switch-managed `openai_base_url` line rather than deleting unrelated config.

### Check usage and API balance
For normal Codex `auth.json` accounts using ChatGPT/OAuth auth, the current account card shows remaining subscription usage for Codex rate-limit windows. For Codex API-key profiles, auth-switch tries supported provider balance endpoints: sub2api `/v1/usage` first, then new-api `/dashboard/billing/subscription` and `/dashboard/billing/usage`.

Claude Code API profiles also show provider balance when the configured base URL supports the sub2api `/v1/usage` endpoint. Profiles refresh once when the main window opens, and manual refresh remains available per row.

### Add a Claude Code API profile
Switch to the **Claude Code** tab and click **Add Claude API**. Provide a name, auth token, optional base URL, and optional Haiku / Sonnet / Opus model mappings. The app writes the selected profile to `~/.claude/settings.json` when you switch to it.

Claude Code switching is independent from Codex switching: one current Codex account and one current Claude Code profile can be active at the same time.

### Switch account or profile
Click **Switch** next to any account/profile in the active tab. For Codex, the app updates `~/.codex/auth.json` and, for API-key profiles, the managed `openai_base_url` line. For Claude Code, the app reads back the current live `~/.claude/settings.json` before switching, then atomically writes the selected profile to that file.

### Tray / menu bar
The tray menu lets you switch Codex accounts and Claude Code profiles, open the main window, and quit without opening the window. It uses the monochrome system tray/menu-bar icon and shows localized labels plus shortcuts for **Open Window** (`Command+,` on macOS, `Ctrl+W` on Windows) and **Quit** (`Command+Q` on macOS, `Ctrl+Q` on Windows). Closing the main window keeps auth-switch running in the tray/menu bar; use **Quit** to exit.

### Rename / Delete / Edit
Use the **⋯** menu on any account row. The menu always shows **Rename** and **Delete**. For API-key profiles (Codex API or Claude Code), it also shows **Edit** to update the name, URL, key, or model mappings.

---

## Codex auth file path

```
${CODEX_HOME:-$HOME/.codex}/auth.json
```
Normally: `~/.codex/auth.json`

The app only reads and writes this official Codex path. It never supports custom Codex paths and never rewrites provider tables, MCP, profiles, sandbox, or other Codex configuration sections.

## Claude Code settings path

```
~/.claude/settings.json
```

Claude Code API profiles are stored as `env` settings containing `ANTHROPIC_AUTH_TOKEN`, plus optional `ANTHROPIC_BASE_URL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, and `ANTHROPIC_DEFAULT_OPUS_MODEL`. auth-switch only writes this official Claude Code settings file.

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
| Live Claude Code settings | `~/.claude/settings.json` |
| Codex config (URL line only) | `~/.codex/config.toml` |

---

## License

MIT
