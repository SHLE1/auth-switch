# Codex subscription quota display

## Goal

Show remaining usage for Codex subscription `auth.json` accounts in auth-switch, following the cc-switch implementation where applicable.

## Decisions

- Scope is Codex `auth_json` accounts only. API-key profiles do not have Codex subscription quota and should not query usage.
- Query the same Codex endpoint used by cc-switch: `https://chatgpt.com/backend-api/wham/usage` with `Authorization: Bearer <access_token>`, `User-Agent: codex-cli`, and optional `ChatGPT-Account-Id` from `auth.json`.
- Read credentials from the stored account `auth_json` content in the local database, not only the live `~/.codex/auth.json`, so each imported account row can show its own quota after switching/importing.
- Do not query automatically for every account. Auto-query only the current Codex auth account; other auth accounts get a refresh button to avoid needless network calls.
- Keep local-only storage behavior unchanged. This feature necessarily contacts OpenAI/ChatGPT only when the user views/refreshes subscription usage; document that exception.

## Implementation

- Add Rust quota models and `get_account_usage_quota(id)` Tauri command.
- Parse `auth_mode == "chatgpt"`, `tokens.access_token`, `tokens.account_id`, and stale `last_refresh` from `auth.json`.
- Return a frontend-friendly result with credential status, tier utilization percentages, reset times, and computed remaining percentage.
- Add typed frontend API and a compact quota footer on Codex account rows/current card.
- Add English and Chinese i18n strings.
- Update AGENTS.md and both READMEs.

## Verification

- Rust unit tests for parsing/mapping quota behavior.
- `pnpm typecheck`.
- `cargo test --manifest-path src-tauri/Cargo.toml`.
- `pnpm dist:mac`, then report DMG path, size, SHA256.
