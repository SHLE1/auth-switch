# Agent Preferences

## Project

- App name: `auth-switch`.
- Goal: macOS/Windows desktop app for switching OpenAI Codex accounts by managing Codex `auth.json` files.
- Only support Codex. Do not generalize to Claude, Cursor, Gemini, or other tools.

## Product decisions

- Target platforms: macOS and Windows.
- Tech stack preference: Electron + React.
- UI direction: tool-like console interface, clear and compact.
- Primary product value: minimal one-click switching.
- Must include both:
  - Main management window.
  - System tray/menu bar quick-switch menu.
- App should be local-only and never contact external services.
- No encryption required for stored auth data.

## Codex auth handling

- Use the official Codex path only; do not support custom paths.
- Codex auth file path: `${CODEX_HOME:-$HOME/.codex}/auth.json`, normally `~/.codex/auth.json`.
- The app should manage only `auth.json`; do not modify `~/.codex/config.toml` unless explicitly requested later.
- Imported accounts should be stored in a local database.
- Store complete `auth.json` content in the database.
- Parse email from `auth.json` when possible.
- Allow users to set/edit a custom account display name.
- Switching should directly replace the live Codex `auth.json`.
- Before switching away from the current account, read the current live `~/.codex/auth.json` and backfill it into the current database record so Codex token refreshes are not lost.
- Use atomic file replacement when writing `auth.json`.

## UX decisions

- First launch should detect an existing `~/.codex/auth.json` and ask whether to import it as the first account.
- Closing the main window should keep the app running in the tray/menu bar.
- The tray/menu bar menu should allow quick account switching, opening the main window, adding an auth file, and quitting.
- Product name should be `auth-switch`.

## Repository/process preferences

- Keep implementation plans in the `plans/` folder.
- Save each agent-generated plan as a separate file in `plans/`.
