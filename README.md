# auth-switch

`auth-switch` is a local-only macOS/Windows desktop app for switching OpenAI Codex accounts by managing Codex `auth.json` profiles.

## Product scope

- Import multiple Codex `auth.json` files.
- Parse account email when possible.
- Let users set custom account names.
- Switch the active Codex account by replacing the official Codex auth file:
  - `${CODEX_HOME:-$HOME/.codex}/auth.json`
  - normally `~/.codex/auth.json`
- Provide both a main management window and a tray/menu-bar quick switcher.
- Store data locally only; the app must not contact external services.

## Development status

The repository is initialized. Implementation has not started yet.

## Planning

Agent-generated implementation plans should be saved under [`plans/`](./plans/).
