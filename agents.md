# Agent Preferences

## Project

- App name: `auth-switch`.
- Goal: macOS/Windows desktop app for switching OpenAI Codex accounts by managing Codex `auth.json` files and optional API-key profiles.
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
- The app should primarily manage `auth.json`. For API-key profiles only, it may minimally manage the single top-level `openai_base_url` line in `~/.codex/config.toml`; do not add/modify `[model_providers.*]`, `model_provider`, profiles, MCP, sandbox, or other config sections.
- Imported accounts should be stored in a local database.
- Store complete `auth.json` content in the database.
- Parse email from `auth.json` when possible.
- Allow users to set/edit a custom account display name.
- Switching should directly replace the live Codex `auth.json`.
- Before switching away from the current account, read the current live `~/.codex/auth.json` and backfill it into the current database record so Codex token refreshes are not lost.
- Use atomic file replacement when writing `auth.json`.

## Codex API-key profile handling

- API profiles are for third-party/OpenAI-compatible base URLs without full Codex provider config rewrites.
- API profile `auth.json` should use Codex's API-key auth shape:
  ```json
  {
    "auth_mode": "apikey",
    "OPENAI_API_KEY": "..."
  }
  ```
- Switching to an API profile should:
  - Write that API-key `auth.json`.
  - Add or update only this line in `~/.codex/config.toml`:
    ```toml
    openai_base_url = "https://example.com/v1" # auth-switch managed
    ```
  - If a user already has an active `openai_base_url`, preserve it as a commented backup, e.g. `# auth-switch previous: openai_base_url = "..."`.
- Switching back to a normal auth profile should:
  - Write the selected stored `auth.json`.
  - Comment out the auth-switch-managed `openai_base_url` line rather than deleting unrelated config.
  - Clean up older environment-variable based switching leftovers (`OPENAI_API_KEY`, `CODEX_API_KEY`, `OPENAI_BASE_URL`, auth-switch shell blocks, macOS `launchctl` env) when possible.
- Do not rely on `source ~/.zshrc` for Codex App support. Codex App should use file-based state (`auth.json` + top-level `openai_base_url`) rather than shell environment.
- Do not backfill live `auth.json` into API-key profiles when switching away; doing so can overwrite the stored API key and later cause `API key cannot be empty`. Only backfill live auth into normal `auth_json` profiles.
- If a user tested an older broken build and an API profile lost its key, tell them to delete/recreate that API profile.

## UX decisions

- First launch should detect an existing `~/.codex/auth.json` and ask whether to import it as the first account.
- Closing the main window should keep the app running in the tray/menu bar.
- The tray/menu bar menu should allow quick account switching, opening the main window, adding an auth file, and quitting.
- Product name should be `auth-switch`.

## i18n — Internationalization

- The app supports **English (en)** and **Simplified Chinese (zh)**.
- Translation files live at `src/renderer/i18n/locales/en.json` and `src/renderer/i18n/locales/zh.json`.
- i18n is initialized in `src/renderer/i18n/index.ts` using `i18next` + `react-i18next` with statically bundled JSON files — **no CDN, no network calls**.
- Language preference is persisted in `localStorage` under the key `auth-switch-lang`.
- A language toggle (**EN / 中文**) is displayed in the app header.

### i18n rule for all new UI text
**Every time a hardcoded string is added or changed in any renderer component, the corresponding key must be added/updated in BOTH `en.json` and `zh.json` in the same commit.**

- Use `useTranslation()` from `react-i18next` in every renderer component.
- Call `t("key")` for static strings and `t("key", { name })` for interpolated strings.
- Key naming convention: `<feature>.<description>` e.g. `firstRun.title`, `common.cancel`, `notice.switchedTo`.
- Do **not** hardcode UI strings in `.tsx` components — always go through `t()`.
- Tray/native menu strings (in `src/main/tray.ts`) are system-rendered and do not go through i18n; keep them in English.

## Repository/process preferences

- Use `pnpm` for dependency management and scripts. Do not use `npm install`, `npm run`, or commit `package-lock.json`.
- Keep implementation plans in the `plans/` folder.
- Save each agent-generated plan as a separate file in `plans/`.
- Build a DMG whenever there is a new feature or fix, without waiting to be asked.
- After building a DMG, report the path, size, and SHA256. Current release path convention: `release/auth-switch-0.1.0-arm64.dmg`.
- macOS builds are currently unsigned; mention that users may need right-click/Open or allow the app in Privacy & Security.

## Pi conversation summary / recent decisions

- Added API profile support on branch `feat/support-api`.
- Initial full `config.toml` provider-table approach was rejected because broad config changes can break unrelated Codex settings.
- Environment-variable approach was explored but proved awkward for Codex App and unreliable for `OPENAI_BASE_URL`; avoid depending on shell reloads or `launchctl` as the primary solution.
- Current accepted approach: API profile writes API-key `auth.json` and manages only the single top-level `openai_base_url` line in `config.toml`.
- A bug was found where switching API → auth → API could empty the API key; the fix is to skip live-auth backfill for API profiles.
- User strongly prefers always producing a fresh DMG after implementation changes so functionality can be tested immediately.
