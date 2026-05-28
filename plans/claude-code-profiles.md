# Plan: Claude Code API Key Profile Switching

Add Claude Code (`~/.claude/settings.json`) profile management to auth-switch, alongside the existing Codex (`~/.codex/auth.json`) management. Users can manage and switch Claude Code API key profiles independently from their Codex accounts.

## Key decisions

- Add `app TEXT NOT NULL DEFAULT 'codex'` to the `accounts` table; Claude rows use `app = 'claude'`.
- Keep `kind = 'api_key'` for Claude profiles; `app` determines whether the profile belongs to Codex or Claude Code.
- Scope `is_current` by app so switching Codex does not clear the current Claude profile and vice versa.
- Store Claude Code settings JSON in the existing `auth_json` column.
- Switch Claude profiles by backfilling current live `~/.claude/settings.json`, atomically writing the selected profile to that path, then updating the app-scoped current account.
- Claude profile model mapping follows cc-switch's current approach: write `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, and `ANTHROPIC_DEFAULT_OPUS_MODEL`; avoid writing legacy `ANTHROPIC_MODEL` for custom third-party models.
- Do not manage any Claude TOML/config file; Claude Code profile state lives in `settings.json` only.
- Frontend uses tabs: Codex and Claude Code.
- Tray menu shows separate Codex and Claude Code sections.

## Files

New:
- `src-tauri/src/claude/mod.rs`
- `src-tauri/src/claude/paths.rs`
- `src-tauri/src/claude/settings.rs`
- `src/renderer/components/ClaudeProfileDialog.tsx`

Modified:
- `src-tauri/src/db.rs`
- `src-tauri/src/models.rs`
- `src-tauri/src/accounts_service.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/tray.rs`
- `src/shared/types.ts`
- `src/renderer/api/authSwitch.ts`
- `src/renderer/hooks/useAccounts.ts`
- `src/renderer/App.tsx`
- `src/renderer/components/CurrentAccountCard.tsx`
- `src/renderer/components/AccountList.tsx`
- `src/renderer/i18n/locales/en.json`
- `src/renderer/i18n/locales/zh.json`
- `README.md`
- `README.zh.md`

## Verification

- Run Rust tests.
- Run TypeScript typecheck.
- Build release DMG via project script.
- Report DMG path, size, SHA256.
