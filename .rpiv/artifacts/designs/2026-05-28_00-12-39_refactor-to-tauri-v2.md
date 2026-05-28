---
date: 2026-05-28T00:12:39+0800
author: SHLE1
commit: 1d20d76
branch: refactor/tauri
repository: auth-switch
topic: "Refactor auth-switch from Electron to Tauri v2"
tags: [design, tauri, desktop, codex, migration]
status: ready
last_updated: 2026-05-28T00:12:39+0800
last_updated_by: SHLE1
---

# Refactor auth-switch from Electron to Tauri v2 Design

## Summary

Refactor `auth-switch` from an Electron main process, preload bridge, and electron-builder package into a Tauri v2 desktop app with a Rust backend and the existing React renderer. The product behavior stays focused on Codex only: local account database, atomic `~/.codex/auth.json` switching, API-key profile support through API-key-shaped `auth.json` plus one managed top-level `openai_base_url` line, first-run import, tray quick switching, macOS and Windows packaging, English and Simplified Chinese UI, and README parity.

Point of view: the Tauri migration should be a native-shell replacement, not a product rewrite. Keep the React UI vocabulary and storage layout stable, move privileged local operations into Rust, and delete Electron-specific preload and updater surfaces rather than carrying compatibility shims that obscure ownership.

## Mature Product Benchmarks

- Raycast: keeps heavy utility behavior behind a compact native shell and menu bar presence, which matches auth-switch's one-click switching goal.
- 1Password desktop: keeps secrets local-first with explicit native confirmations, predictable tray behavior, and no hidden cloud dependency in the core flow.
- Linear desktop: treats the web UI as a fast app surface while native code owns shell concerns like window lifecycle, menus, and notifications.

## Visual Direction

- **Visual thesis**: retain the existing dense console utility style, dark-first, low decoration, compact account rows, and high-confidence status language.
- **Content plan**: utility mode only, orient with current account, show account state, enable switch/import/API actions, surface errors inline.
- **Interaction thesis**: keep click-to-switch immediate, use subtle press feedback already present in the renderer, and make tray switch feedback visible through native notification plus account refresh event.

CSS strategy remains Tailwind plus existing component CSS. Do not introduce CSS Modules or CSS-in-JS during the migration.

## Desired End State

- `pnpm dev` runs the app through Tauri v2 with Vite serving the existing React renderer.
- `pnpm build` type-checks the renderer and builds the Tauri app.
- `pnpm dist:mac` builds a DMG on macOS and reports the expected release artifact path, size, and SHA256 after implementation.
- `pnpm dist:win` builds a Windows installer on Windows or in CI.
- The app uses `src-tauri` Rust code for filesystem, database, dialog, tray, notification, window, and OS environment cleanup operations.
- The renderer calls a typed `authSwitch` adapter backed by Tauri `invoke` and `listen`, not `window.authSwitch` or Electron preload.
- The existing SQLite file at `~/.auth-switch/auth-switch.db` remains the source of truth and keeps schema compatibility with the current app.
- The live Codex paths remain official only: `${CODEX_HOME:-$HOME/.codex}/auth.json` and `~/.codex/config.toml` derived from that directory.
- Closing the main window hides it, quitting from the tray exits the app.
- Tray/menu bar supports quick switch, open window, add auth file, and quit on macOS and Windows.
- No network updater is added in Tauri, preserving the local-only product rule. Remove the existing Electron update check surface.
- README and README.zh explain Tauri development, Tauri build outputs, and unchanged user workflows.

## Scope

### Building

- Add `src-tauri` with Tauri v2 configuration, Rust commands, tray/menu setup, notification/dialog plugins, and Rust modules for Codex, database, and account services.
- Replace Electron runtime dependencies, scripts, and config with Tauri and Vite equivalents.
- Preserve the existing React renderer and i18n files, with only API boundary changes and copy updates required by updater removal or Tauri build documentation.
- Port Electron IPC handlers to Tauri commands with equivalent input and output shapes.
- Port Electron tray logic to Tauri tray/menu APIs with checked current account behavior where supported.
- Port filesystem/database logic from Node and `better-sqlite3` to Rust `std`, `rusqlite`, `serde_json`, and small helper modules.
- Preserve API profile safety rules, especially never backfilling live auth into API-key profiles.
- Update README.md and README.zh in the same change.

### Not Building

- No support for Claude, Cursor, Gemini, or non-Codex tools.
- No custom Codex path picker.
- No provider-table rewrite of `~/.codex/config.toml`.
- No encryption or cloud sync.
- No Tauri mobile target.
- No auto-update network check in the migrated app.
- No visual redesign beyond keeping the existing UI coherent under the Tauri webview.

## Architecture

### Runtime split

Current Electron ownership:

```text
src/main/*              Electron main process, IPC, tray, db, Codex filesystem
src/preload/index.ts    contextBridge exposes window.authSwitch
src/renderer/*          React UI, i18n, account actions
```

Target Tauri ownership:

```text
src-tauri/src/lib.rs                  app builder, command registration, setup, close behavior
src-tauri/src/commands.rs             Tauri command functions matching AuthSwitchApi
src-tauri/src/accounts_service.rs     account import, switch, rename, delete, first-run state
src-tauri/src/db.rs                   rusqlite connection, schema migrations, account/settings queries
src-tauri/src/codex/*                 paths, parser, writer, config.toml, env cleanup, API profile builder
src-tauri/src/tray.rs                 tray/menu construction and event handling
src-tauri/src/notifications.rs        native notification helper
src-tauri/src/models.rs               serde DTOs matching TypeScript shared types
src/renderer/api/authSwitch.ts        typed Tauri invoke/listen adapter
src/renderer/*                        same UI, no Electron globals
```

### Dependency decisions

- Use `@tauri-apps/api` and `@tauri-apps/cli` v2 on the frontend side.
- Use Rust `tauri = "2"`, `tauri-plugin-dialog`, `tauri-plugin-notification`, `tauri-plugin-single-instance`, `rusqlite` with `bundled`, `serde`, `serde_json`, `sha2`, `uuid`, `dirs`, `thiserror`, and `url`.
- Do not use `tauri-plugin-sql` because the app has a narrow local schema, needs compatibility with an existing better-sqlite3 file, and benefits from explicit transactions in Rust.
- Do not use a Tauri updater plugin because the product instruction says local-only and never contact external services.

### Package and script changes

**File**: `package.json`
**Changes**: Replace Electron scripts and dependencies with Vite and Tauri scripts. Keep React, i18n, Radix, lucide, Tailwind, and type tooling.

```json
{
  "name": "auth-switch",
  "version": "0.1.8",
  "description": "Local desktop app for switching OpenAI Codex auth.json accounts.",
  "author": "SHLE1",
  "license": "MIT",
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "typecheck": "tsc --noEmit",
    "build:renderer": "vite build",
    "build": "pnpm run typecheck && tauri build --no-bundle",
    "dist": "pnpm run typecheck && tauri build",
    "dist:mac": "pnpm run typecheck && tauri build --bundles dmg",
    "dist:win": "pnpm run typecheck && tauri build --bundles nsis"
  },
  "dependencies": {
    "@fontsource-variable/geist": "^5.2.9",
    "@fontsource/jetbrains-mono": "^5.2.8",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-scroll-area": "^1.2.10",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@tauri-apps/api": "^2.0.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "i18next": "^26.2.0",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-i18next": "^17.0.8",
    "tailwind-merge": "^3.6.0",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/node": "^20.17.10",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vite": "^5.4.11"
  },
  "packageManager": "pnpm@11.1.2"
}
```

**Remove**: `electron-builder.yml`, `electron.vite.config.ts`, `src/main/**`, `src/preload/**` after equivalent Tauri modules are in place.

**Add**: `vite.config.ts`

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname, "src/renderer"),
  clearScreen: false,
  server: {
    strictPort: true,
    port: 1420
  },
  envPrefix: ["VITE_", "TAURI_"],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/renderer")
    }
  },
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "src/renderer/index.html")
    }
  }
});
```

### Tauri configuration

**File**: `src-tauri/tauri.conf.json`
**Changes**: Add app identity, dev/build hooks, bundle targets, icons, and conservative security settings.

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "auth-switch",
  "version": "0.1.8",
  "identifier": "com.authswitch.app",
  "build": {
    "beforeDevCommand": "pnpm vite --host 127.0.0.1",
    "beforeBuildCommand": "pnpm build:renderer",
    "devUrl": "http://127.0.0.1:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "auth-switch",
        "width": 720,
        "height": 560,
        "minWidth": 400,
        "minHeight": 280,
        "resizable": true,
        "visible": false,
        "center": true,
        "decorations": true,
        "transparent": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: data:; font-src 'self' data:; connect-src 'self' ipc: http://127.0.0.1:1420 ws://127.0.0.1:1420"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["dmg", "nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOS": {
      "category": "public.app-category.utilities",
      "hardenedRuntime": false
    },
    "windows": {
      "nsis": {
        "displayLanguageSelector": false,
        "installMode": "currentUser",
        "languages": ["English", "SimpChinese"]
      }
    },
    "resources": ["../assets/tray-icon.png", "../assets/tray-icon@2x.png"]
  }
}
```

**File**: `src-tauri/capabilities/default.json`
**Changes**: Minimal permissions. App filesystem work is done inside Rust commands, so broad frontend filesystem permissions are not needed.

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions for auth-switch desktop window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "notification:default"
  ]
}
```

**File**: `src-tauri/Cargo.toml`

```toml
[package]
name = "auth-switch"
version = "0.1.8"
description = "Local desktop app for switching OpenAI Codex auth.json accounts."
authors = ["SHLE1"]
license = "MIT"
edition = "2021"

[lib]
name = "auth_switch_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
dirs = "5"
rusqlite = { version = "0.32", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sha2 = "0.10"
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-dialog = "2"
tauri-plugin-notification = "2"
tauri-plugin-single-instance = "2"
thiserror = "1"
url = "2"
uuid = { version = "1", features = ["v4", "serde"] }
```

**File**: `src-tauri/src/main.rs`

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    auth_switch_lib::run();
}
```

### Rust command surface

**File**: `src-tauri/src/models.rs`
**Changes**: Mirror existing TypeScript DTOs with serde rename support where needed.

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub kind: AccountKind,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub is_current: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_used_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AccountKind {
    AuthJson,
    ApiKey,
}

impl AccountKind {
    pub fn as_db_value(&self) -> &'static str {
        match self {
            Self::AuthJson => "auth_json",
            Self::ApiKey => "api_key",
        }
    }

    pub fn from_db_value(value: &str) -> Self {
        if value == "api_key" { Self::ApiKey } else { Self::AuthJson }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexApiProfileInput {
    pub name: String,
    pub api_key: String,
    pub base_url: String,
    pub model: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub already_current: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account: Option<Account>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cancelled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duplicate: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub same_email_exists: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account: Option<Account>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LiveAuthStatus {
    pub exists: bool,
    pub hash: Option<String>,
    pub email: Option<String>,
    pub path: String,
}
```

**File**: `src-tauri/src/commands.rs`
**Changes**: Register one command per existing renderer API method.

```rust
use crate::accounts_service::AccountsService;
use crate::models::{Account, CodexApiProfileInput, ImportResult, LiveAuthStatus, SwitchResult};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn get_accounts(service: State<'_, AccountsService>) -> Result<Vec<Account>, String> {
    service.list_accounts().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_current_account(service: State<'_, AccountsService>) -> Result<Option<Account>, String> {
    service.current_account().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn switch_account(app: AppHandle, service: State<'_, AccountsService>, id: String) -> SwitchResult {
    let result = service.switch_account(&id);
    if result.success {
        crate::tray::rebuild_tray_menu(&app, &service);
        let _ = app.emit("accounts-changed", ());
        if result.already_current != Some(true) {
            if let Some(account) = result.account.as_ref() {
                crate::notifications::notify(&app, "auth-switch", &format!("Switched to {}.", account.name));
            }
        }
    }
    result
}

#[tauri::command]
pub async fn import_auth_file(app: AppHandle, service: State<'_, AccountsService>) -> ImportResult {
    let Some(path) = crate::dialog::pick_auth_json(&app).await else {
        return ImportResult::cancelled();
    };
    let result = service.import_auth_file_from_path(path.to_string_lossy().as_ref(), None, false);
    if result.success {
        crate::tray::rebuild_tray_menu(&app, &service);
        let _ = app.emit("accounts-changed", ());
    }
    result
}

#[tauri::command]
pub fn create_api_profile(app: AppHandle, service: State<'_, AccountsService>, input: CodexApiProfileInput) -> ImportResult {
    let result = service.create_api_profile(input);
    if result.success {
        crate::tray::rebuild_tray_menu(&app, &service);
        let _ = app.emit("accounts-changed", ());
    }
    result
}

#[tauri::command]
pub fn import_live_auth_file(app: AppHandle, service: State<'_, AccountsService>, name: Option<String>, set_current: Option<bool>) -> ImportResult {
    let result = service.import_live_auth_file(name, set_current.unwrap_or(true));
    if result.success {
        crate::tray::rebuild_tray_menu(&app, &service);
        let _ = app.emit("accounts-changed", ());
    }
    result
}

#[tauri::command]
pub fn rename_account(app: AppHandle, service: State<'_, AccountsService>, id: String, name: String) -> Result<(), String> {
    service.rename_account(&id, &name).map_err(|error| error.to_string())?;
    crate::tray::rebuild_tray_menu(&app, &service);
    let _ = app.emit("accounts-changed", ());
    Ok(())
}

#[tauri::command]
pub fn delete_account(app: AppHandle, service: State<'_, AccountsService>, id: String) -> Result<(), String> {
    service.remove_account(&id).map_err(|error| error.to_string())?;
    crate::tray::rebuild_tray_menu(&app, &service);
    let _ = app.emit("accounts-changed", ());
    Ok(())
}

#[tauri::command]
pub async fn native_confirm(app: AppHandle, title: String, message: String, confirm_label: String, cancel_label: String) -> Result<bool, String> {
    crate::dialog::confirm(&app, &title, &message, &confirm_label, &cancel_label).await
}

#[tauri::command]
pub async fn native_message(app: AppHandle, title: String, message: String, button_label: String) -> Result<(), String> {
    crate::dialog::message(&app, &title, &message, &button_label).await
}

#[tauri::command]
pub fn get_live_auth_status(service: State<'_, AccountsService>) -> LiveAuthStatus {
    service.get_live_auth_status()
}

#[tauri::command]
pub fn dismiss_first_run(service: State<'_, AccountsService>) -> Result<(), String> {
    service.set_bool_setting("first_run_done", true).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn should_show_first_run(service: State<'_, AccountsService>) -> Result<bool, String> {
    service.get_bool_setting("first_run_done").map(|done| !done).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_language(app: AppHandle, service: State<'_, AccountsService>, locale: String) -> Result<(), String> {
    service.set_locale(&locale).map_err(|error| error.to_string())?;
    crate::tray::rebuild_tray_menu(&app, &service);
    Ok(())
}
```

### Rust app builder and lifecycle

**File**: `src-tauri/src/lib.rs`
**Changes**: Thin builder, single instance, plugins, command registration, tray setup, hide-on-close, show-on-ready.

```rust
mod accounts_service;
mod codex;
mod commands;
mod db;
mod dialog;
mod i18n;
mod models;
mod notifications;
mod tray;

use accounts_service::AccountsService;
use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(AccountsService::new().expect("failed to initialize auth-switch service"))
        .invoke_handler(tauri::generate_handler![
            commands::get_accounts,
            commands::get_current_account,
            commands::switch_account,
            commands::import_auth_file,
            commands::create_api_profile,
            commands::import_live_auth_file,
            commands::rename_account,
            commands::delete_account,
            commands::native_confirm,
            commands::native_message,
            commands::get_live_auth_status,
            commands::dismiss_first_run,
            commands::should_show_first_run,
            commands::set_language
        ])
        .setup(|app| {
            let service = app.state::<AccountsService>();
            tray::create_tray(app.handle(), &service);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running auth-switch");
}
```

### Database compatibility

**File**: `src-tauri/src/db.rs`
**Changes**: Use same path and schema migrations as Electron. Preserve `user_version` 1 to 3.

```rust
use crate::models::{Account, AccountKind};
use rusqlite::{params, Connection, OptionalExtension};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open() -> Result<Self, DbError> {
        let dir = app_data_dir()?;
        fs::create_dir_all(&dir)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&dir, fs::Permissions::from_mode(0o700))?;
        }
        let path = dir.join("auth-switch.db");
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        run_migrations(&conn)?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn list_accounts(&self) -> Result<Vec<Account>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        let mut stmt = conn.prepare(
            "SELECT id, name, email, kind, base_url, model, is_current, created_at, updated_at, last_used_at FROM accounts ORDER BY created_at ASC"
        )?;
        let rows = stmt.query_map([], row_to_account)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
    }

    pub fn get_current_account(&self) -> Result<Option<Account>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        conn.query_row(
            "SELECT id, name, email, kind, base_url, model, is_current, created_at, updated_at, last_used_at FROM accounts WHERE is_current = 1 LIMIT 1",
            [],
            row_to_account,
        ).optional().map_err(DbError::from)
    }

    pub fn set_current_account(&self, id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        let tx = conn.unchecked_transaction()?;
        tx.execute("UPDATE accounts SET is_current = 0", [])?;
        tx.execute("UPDATE accounts SET is_current = 1, last_used_at = ?1, updated_at = ?1 WHERE id = ?2", params![now_ms(), id])?;
        tx.commit()?;
        Ok(())
    }
}

pub fn app_data_dir() -> Result<PathBuf, DbError> {
    let home = dirs::home_dir().ok_or(DbError::NoHomeDir)?;
    Ok(home.join(".auth-switch"))
}

fn run_migrations(conn: &Connection) -> Result<(), DbError> {
    let version: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version < 1 {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT,
                auth_json TEXT NOT NULL,
                auth_hash TEXT NOT NULL,
                is_current INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                last_used_at INTEGER
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_auth_hash ON accounts(auth_hash);
            CREATE INDEX IF NOT EXISTS idx_accounts_is_current ON accounts(is_current);
            CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
            PRAGMA user_version = 1;"
        )?;
    }
    let version: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version < 2 {
        conn.execute_batch(
            "ALTER TABLE accounts ADD COLUMN kind TEXT NOT NULL DEFAULT 'auth_json';
            ALTER TABLE accounts ADD COLUMN base_url TEXT;
            ALTER TABLE accounts ADD COLUMN model TEXT;
            PRAGMA user_version = 2;"
        )?;
    }
    let version: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version < 3 {
        conn.execute_batch(
            "DROP INDEX IF EXISTS idx_accounts_auth_hash;
            CREATE INDEX IF NOT EXISTS idx_accounts_auth_hash ON accounts(auth_hash);
            PRAGMA user_version = 3;"
        )?;
    }
    Ok(())
}
```

The full implementation should fill the insert, update, delete, settings, duplicate checks, and row-by-id methods as direct equivalents of `src/main/db/accounts.ts` and `src/main/db/settings.ts`.

### Codex auth and API profile modules

**File**: `src-tauri/src/codex/paths.rs`

```rust
use std::env;
use std::path::PathBuf;

pub fn codex_auth_path() -> PathBuf {
    let base = env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|home| home.join(".codex")))
        .expect("home directory unavailable");
    base.join("auth.json")
}

pub fn codex_dir() -> PathBuf {
    codex_auth_path().parent().expect("auth path has parent").to_path_buf()
}

pub fn codex_config_path() -> PathBuf {
    codex_dir().join("config.toml")
}
```

**File**: `src-tauri/src/codex/writer.rs`

```rust
use std::fs;
use std::io;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn atomic_write(target: &Path, content: &str) -> io::Result<()> {
    let dir = target.parent().expect("target has parent");
    fs::create_dir_all(dir)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(dir, fs::Permissions::from_mode(0o700))?;
    }

    let millis = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let tmp = dir.join(format!("{}.tmp.{}.{}", target.file_name().unwrap().to_string_lossy(), std::process::id(), millis));
    fs::write(&tmp, content)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&tmp, fs::Permissions::from_mode(0o600))?;
    }
    #[cfg(windows)]
    if target.exists() {
        fs::remove_file(target)?;
    }
    fs::rename(&tmp, target).or_else(|error| {
        let _ = fs::remove_file(&tmp);
        Err(error)
    })
}
```

**File**: `src-tauri/src/codex/api_profile.rs`

```rust
use serde_json::json;
use url::Url;

pub struct CodexApiProfile {
    pub auth_json: String,
    pub auth_hash_material: String,
    pub base_url: String,
}

pub fn build_codex_api_profile(api_key: &str, base_url: &str) -> Result<CodexApiProfile, String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("API key cannot be empty".into());
    }
    let base_url = normalize_http_url(base_url, "Base URL")?;
    let auth_json = format!("{}\n", serde_json::to_string_pretty(&json!({
        "auth_mode": "apikey",
        "OPENAI_API_KEY": api_key
    })).map_err(|error| error.to_string())?);
    Ok(CodexApiProfile {
        auth_json,
        auth_hash_material: format!("{}\n{}", api_key, base_url),
        base_url,
    })
}

fn normalize_http_url(value: &str, label: &str) -> Result<String, String> {
    let trimmed = value.trim().split_whitespace().collect::<String>();
    if trimmed.is_empty() {
        return Err(format!("{} cannot be empty", label));
    }
    let parsed = Url::parse(&trimmed).map_err(|_| format!("{} must be a valid URL", label))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(format!("{} must start with http:// or https://", label));
    }
    Ok(trimmed.trim_end_matches('/').to_string())
}
```

**File**: `src-tauri/src/codex/config.rs`
**Changes**: Port the current line-preserving `openai_base_url` logic exactly. Keep constants `openai_base_url`, `# auth-switch managed`, and `# auth-switch previous: `. Preserve previous active values as commented backups.

**File**: `src-tauri/src/codex/env.rs`
**Changes**: Port cleanup of `OPENAI_API_KEY`, `CODEX_API_KEY`, and `OPENAI_BASE_URL`. On macOS run `launchctl unsetenv`. On Windows run `reg delete HKCU\Environment /F /V <name>`. On Unix-like shells only replace the previous auth-switch block if present, do not append new shell switching state.

### Account switching service

**File**: `src-tauri/src/accounts_service.rs`
**Changes**: Preserve current semantics, especially API profile backfill safety.

```rust
use crate::codex::{config, env, paths, writer};
use crate::db::Database;
use crate::models::{AccountKind, CodexApiProfileInput, ImportResult, LiveAuthStatus, SwitchResult};
use std::sync::Mutex;

pub struct AccountsService {
    db: Database,
    switch_in_progress: Mutex<bool>,
    locale: Mutex<String>,
}

impl AccountsService {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            db: Database::open().map_err(|error| error.to_string())?,
            switch_in_progress: Mutex::new(false),
            locale: Mutex::new("en".to_string()),
        })
    }

    pub fn switch_account(&self, id: &str) -> SwitchResult {
        let mut guard = match self.switch_in_progress.lock() {
            Ok(guard) => guard,
            Err(_) => return SwitchResult::error("Switch lock is unavailable."),
        };
        if *guard {
            return SwitchResult::error("Another switch is already in progress.");
        }
        *guard = true;

        let result = self.switch_account_inner(id);
        *guard = false;
        result
    }

    fn switch_account_inner(&self, id: &str) -> SwitchResult {
        let target = match self.db.get_account_by_id(id) {
            Ok(Some(row)) => row,
            Ok(None) => return SwitchResult::error("Account not found."),
            Err(error) => return SwitchResult::error(error.to_string()),
        };

        if target.is_current {
            return SwitchResult::already_current(target.into_account());
        }

        if let Ok(Some(current)) = self.db.get_current_account_row() {
            if current.id != target.id && current.kind == AccountKind::AuthJson {
                if let Ok(Some(live)) = crate::codex::auth_file::read_live_auth_file() {
                    let _ = self.db.update_account_live_snapshot(&current.id, &live.content, &live.hash, crate::db::now_ms());
                }
            }
        }

        let auth_path = paths::codex_auth_path();
        let write_result = if target.kind == AccountKind::ApiKey {
            let parsed: serde_json::Value = match serde_json::from_str(&target.auth_json) {
                Ok(parsed) => parsed,
                Err(error) => return SwitchResult::error(error.to_string()),
            };
            let api_key = parsed.get("OPENAI_API_KEY").and_then(|value| value.as_str()).unwrap_or("");
            if api_key.is_empty() {
                return SwitchResult::error("API key cannot be empty. Please recreate this API profile.");
            }
            writer::atomic_write(&auth_path, &target.auth_json)
                .and_then(|_| env::disable_codex_api_environment())
                .and_then(|_| config::enable_codex_base_url(target.base_url.as_deref().unwrap_or("")))
        } else {
            writer::atomic_write(&auth_path, &target.auth_json)
                .and_then(|_| env::disable_codex_api_environment())
                .and_then(|_| config::disable_codex_base_url())
        };

        if let Err(error) = write_result {
            return SwitchResult::error(error.to_string());
        }

        match self.db.set_current_account(&target.id).and_then(|_| self.db.get_account_by_id(&target.id)) {
            Ok(Some(updated)) => SwitchResult::success(updated.into_account()),
            Ok(None) => SwitchResult::success(target.into_account()),
            Err(error) => SwitchResult::error(error.to_string()),
        }
    }
}
```

The implementation must add the import, rename, delete, duplicate detection, auth parsing, and settings methods as direct Rust ports of the current TypeScript service.

### Tray and native shell

**File**: `src-tauri/src/tray.rs`
**Changes**: Use Tauri tray APIs. Build menu from accounts each time state changes. On macOS a click opens the menu by default, double click or explicit menu item opens the window. On Windows, left click opens the window and right click opens the menu.

```rust
use crate::accounts_service::AccountsService;
use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

pub fn create_tray(app: &AppHandle, service: &AccountsService) {
    let menu = build_menu(app, service);
    let _ = TrayIconBuilder::with_id("main-tray")
        .tooltip("auth-switch")
        .icon(app.default_window_icon().cloned().unwrap_or_default())
        .menu(&menu)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                #[cfg(windows)]
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app);
}

pub fn rebuild_tray_menu(app: &AppHandle, service: &AccountsService) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let menu = build_menu(app, service);
        let _ = tray.set_menu(Some(menu));
        let _ = tray.set_tooltip(Some("auth-switch"));
    }
}

fn build_menu(app: &AppHandle, service: &AccountsService) -> tauri::menu::Menu<tauri::Wry> {
    let mut builder = MenuBuilder::new(app);
    builder = builder.item(&MenuItemBuilder::with_id("title", "auth-switch").enabled(false).build(app).unwrap());
    builder = builder.item(&PredefinedMenuItem::separator(app).unwrap());

    match service.list_accounts() {
        Ok(accounts) if !accounts.is_empty() => {
            for account in accounts {
                let item = CheckMenuItemBuilder::with_id(format!("switch:{}", account.id), account.name)
                    .checked(account.is_current)
                    .enabled(true)
                    .build(app)
                    .unwrap();
                builder = builder.item(&item);
            }
        }
        _ => {
            builder = builder.item(&MenuItemBuilder::with_id("empty", "No accounts").enabled(false).build(app).unwrap());
        }
    }

    builder = builder.item(&PredefinedMenuItem::separator(app).unwrap());
    builder = builder.item(&MenuItemBuilder::with_id("add-auth", "Add auth.json").build(app).unwrap());
    builder = builder.item(&MenuItemBuilder::with_id("open-window", "Open Window").build(app).unwrap());
    builder = builder.item(&PredefinedMenuItem::separator(app).unwrap());
    builder = builder.item(&MenuItemBuilder::with_id("quit", "Quit").build(app).unwrap());
    builder.build().unwrap()
}
```

`lib.rs` must attach `on_menu_event` to handle `switch:<id>`, `add-auth`, `open-window`, and `quit`. Switching from a tray item must call the same `AccountsService::switch_account`, rebuild the tray menu, emit `accounts-changed`, and show a native notification on success.

### Renderer adapter

**File**: `src/renderer/api/authSwitch.ts`
**Changes**: Replace `window.authSwitch` with a typed Tauri adapter.

```ts
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AuthSwitchApi, CodexApiProfileInput, ImportResult, SwitchResult, LiveAuthStatus, Account } from "../../shared/types";

export const authSwitch: AuthSwitchApi = {
  getAccounts: () => invoke<Account[]>("get_accounts"),
  getCurrentAccount: () => invoke<Account | null>("get_current_account"),
  switchAccount: (id: string) => invoke<SwitchResult>("switch_account", { id }),
  importAuthFile: () => invoke<ImportResult>("import_auth_file"),
  createApiProfile: (input: CodexApiProfileInput) => invoke<ImportResult>("create_api_profile", { input }),
  importLiveAuthFile: (name?: string, setCurrent?: boolean) =>
    invoke<ImportResult>("import_live_auth_file", { name, setCurrent }),
  renameAccount: (id: string, name: string) => invoke<void>("rename_account", { id, name }),
  deleteAccount: (id: string) => invoke<void>("delete_account", { id }),
  nativeConfirm: (title: string, message: string, confirmLabel: string, cancelLabel: string) =>
    invoke<boolean>("native_confirm", { title, message, confirmLabel, cancelLabel }),
  nativeMessage: (title: string, message: string, buttonLabel: string) =>
    invoke<void>("native_message", { title, message, buttonLabel }),
  setLanguage: (locale: string) => invoke<void>("set_language", { locale }),
  getLiveAuthStatus: () => invoke<LiveAuthStatus>("get_live_auth_status"),
  dismissFirstRun: () => invoke<void>("dismiss_first_run"),
  shouldShowFirstRun: () => invoke<boolean>("should_show_first_run"),
  onAccountsChanged: (callback: () => void) => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listen("accounts-changed", () => callback()).then((nextUnlisten) => {
      if (disposed) nextUnlisten();
      else unlisten = nextUnlisten;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }
};
```

**File**: `src/renderer/global.d.ts`
**Changes**: Delete Electron global API declaration, or reduce it to no custom globals.

```ts
export {};
```

**Required renderer edits**:

- `src/renderer/hooks/useAccounts.ts`: import `{ authSwitch }` and replace `window.authSwitch` calls.
- `src/renderer/App.tsx`: import `{ authSwitch }` and replace all `window.authSwitch` calls.
- `src/renderer/i18n/index.ts`: import `{ authSwitch }` and gate startup sync through the adapter.
- Any dialog or component with `window.authSwitch` must use the adapter.
- Keep all user-visible renderer strings in `en.json` and `zh.json` if copy changes.

### i18n and tray language

The renderer keeps `i18next` with static JSON files and `localStorage` key `auth-switch-lang`. `setLanguage` invokes Rust `set_language`, and Rust stores the locale in memory for tray labels. Because tray/native menu strings are allowed to stay English by project instruction, the minimum viable Tauri tray can remain English. If tray i18n is retained, port `src/main/i18n.ts` keys into Rust as a tiny two-locale map and keep the same labels.

### README changes

Both README files must update:

- Project structure: replace `src/main` and `src/preload` with `src-tauri` and `src/renderer/api`.
- Development commands: Tauri `pnpm dev`, `pnpm build`, `pnpm dist`, `pnpm dist:mac`, `pnpm dist:win`.
- Prerequisites: Node.js, pnpm, Rust stable, Tauri platform prerequisites. Windows needs WebView2 runtime. macOS needs Xcode command line tools.
- Packaging outputs: Tauri bundle location plus release copy convention if implementation adds a copy step.
- Local-only note: no auto-update check.

## File Map

### New files

- `vite.config.ts`: Vite renderer build replacing electron-vite.
- `src/renderer/api/authSwitch.ts`: typed Tauri adapter.
- `src-tauri/Cargo.toml`: Rust crate and Tauri dependencies.
- `src-tauri/build.rs`: `tauri_build::build()`.
- `src-tauri/tauri.conf.json`: Tauri app and bundle config.
- `src-tauri/capabilities/default.json`: frontend permission scope.
- `src-tauri/src/main.rs`: thin Rust entry point.
- `src-tauri/src/lib.rs`: Tauri builder and lifecycle.
- `src-tauri/src/commands.rs`: command surface.
- `src-tauri/src/models.rs`: serde DTOs.
- `src-tauri/src/db.rs`: SQLite compatibility layer.
- `src-tauri/src/accounts_service.rs`: account business logic.
- `src-tauri/src/tray.rs`: tray/menu behavior.
- `src-tauri/src/dialog.rs`: native file, confirm, message dialogs.
- `src-tauri/src/notifications.rs`: native notifications.
- `src-tauri/src/i18n.rs`: optional tray label translations.
- `src-tauri/src/codex/mod.rs`: module exports.
- `src-tauri/src/codex/paths.rs`: official Codex paths.
- `src-tauri/src/codex/parser.rs`: auth JSON parsing and email extraction.
- `src-tauri/src/codex/auth_file.rs`: read, validate, hash live/imported auth.
- `src-tauri/src/codex/writer.rs`: atomic auth write.
- `src-tauri/src/codex/config.rs`: top-level `openai_base_url` management.
- `src-tauri/src/codex/env.rs`: legacy env cleanup.
- `src-tauri/src/codex/api_profile.rs`: API profile builder.

### Modified files

- `package.json`: replace Electron dependencies/scripts with Tauri/Vite.
- `pnpm-lock.yaml`: dependency graph update through `pnpm install`.
- `tsconfig.json`: remove Electron/preload include assumptions if present.
- `src/renderer/App.tsx`: use Tauri adapter, remove update-check assumptions if surfaced.
- `src/renderer/hooks/useAccounts.ts`: use Tauri adapter.
- `src/renderer/i18n/index.ts`: use Tauri adapter safely.
- `src/renderer/global.d.ts`: remove `window.authSwitch` declaration.
- `src/shared/types.ts`: keep API shape, adjust argument naming only if required by adapter.
- `src/renderer/i18n/locales/en.json`: update changed UI copy.
- `src/renderer/i18n/locales/zh.json`: matching Simplified Chinese copy.
- `README.md`: Tauri development and packaging docs.
- `README.zh.md`: matching Simplified Chinese docs.
- `.github/workflows/ci.yml`: install Rust and Tauri system dependencies for build checks.
- `.github/workflows/manual-release.yml`: use Tauri bundle paths.

### Removed files

- `electron.vite.config.ts`
- `electron-builder.yml`
- `src/preload/index.ts`
- `src/main/index.ts`
- `src/main/ipc.ts`
- `src/main/window.ts`
- `src/main/tray.ts`
- `src/main/menu.ts`
- `src/main/updater.ts`
- `src/main/notifications.ts`
- `src/main/logger.ts`
- `src/main/i18n.ts`
- `src/main/codex/**` after Rust equivalents exist
- `src/main/db/**` after Rust equivalents exist
- `src/main/services/**` after Rust equivalents exist

## Ordering Constraints

1. Package and Tauri scaffold must land before renderer adapter changes can run.
2. Rust models, database, and Codex modules must land before commands and tray can compile.
3. Renderer adapter can be introduced after commands are registered, then `window.authSwitch` usage can be removed.
4. Tray/menu behavior depends on account service and event emission.
5. README and workflow updates come after scripts and bundle paths are finalized.
6. Phases 4 and 5 can run in parallel only after Phase 3 exposes a compiling command surface.
7. The final cleanup phase removes Electron only after Tauri dev, typecheck, and package commands pass.

## Verification Notes

- Verify `pnpm typecheck` after adapter changes.
- Verify `pnpm tauri dev` opens the main window and first-run dialog still appears when `first_run_done` is false.
- Verify importing an existing `auth.json` creates or reuses `~/.auth-switch/auth-switch.db` without changing schema meaning.
- Verify switching normal auth to normal auth backfills the previous live `auth.json`.
- Verify switching API profile to auth profile does not backfill API profile content and does not empty the stored API key.
- Verify API profile switching writes API-key-shaped `auth.json` and manages only the top-level managed `openai_base_url` line.
- Verify switching back to normal auth comments out the managed `openai_base_url` line.
- Verify legacy environment cleanup on macOS and Windows best-effort paths.
- Verify closing the main window keeps tray resident and Quit exits.
- Verify tray/menu quick switch updates renderer state without reopening the window.
- Verify macOS DMG builds and is reported with path, size, and SHA256.
- Verify Windows bundle path is correct in documentation and CI config, even if local Windows build is not run on macOS.
- Verify README.md and README.zh stay synchronized.
- Verify no code path adds network update checks.

## Performance Considerations

- Tauri should reduce idle memory compared with Electron, but Rust command handlers must avoid holding the SQLite mutex across long UI operations such as dialogs.
- Account switching is filesystem-bound and should stay synchronous inside a short command, guarded by `switch_in_progress` to preserve current semantics.
- Tray rebuilds should query the small accounts table only after mutations or language changes, not on a timer.
- Renderer event listener setup must unlisten on unmount to avoid duplicate refreshes during hot reload.
- `rusqlite` bundled SQLite avoids native Node rebuild problems and should simplify macOS and Windows packaging.

## Migration Notes

- The existing database at `~/.auth-switch/auth-switch.db` is reused in place. No export/import step is required.
- Existing Electron WAL sidecar files are compatible with SQLite. The Rust app should open the same DB path and set `journal_mode = WAL`.
- Existing stored API profiles remain valid because `auth_json`, `kind`, `base_url`, and `model` columns keep the same meaning.
- Removing Electron updater UI is intentional to satisfy the local-only product rule. Release publishing remains via GitHub Actions, not in-app update checks.
- macOS builds remain unsigned unless signing is configured separately. README must keep the right-click/Open and Privacy & Security note.
- If an older broken build already emptied an API key, the migration does not repair it. The user should delete and recreate that API profile.

## Slices

### Slice 1: Tauri scaffold and renderer build pipeline

**Files**: `package.json`, `vite.config.ts`, `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`

**Delivers**: A minimal Tauri v2 app that launches the existing React renderer, has correct macOS and Windows bundle identity, and has no Electron build pipeline dependency.

#### Automated Verification:
- [ ] `pnpm install` completes with Tauri dependencies and without adding `package-lock.json`.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm build:renderer` produces `dist/index.html`.
- [ ] `pnpm tauri info` reports a valid Tauri v2 project.
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` passes for the scaffold.

#### Manual Verification:
- [ ] On macOS, `pnpm dev` opens an `auth-switch` Tauri window with the existing renderer shell.
- [ ] On Windows design review, `tauri.conf.json` uses Windows-safe identifier, NSIS target, and nontransparent decorated window defaults.
- [ ] No Electron window, preload, or electron-builder command is needed to launch the scaffold.

### Slice 2: Rust Codex and SQLite core

**Files**: `src-tauri/src/models.rs`, `src-tauri/src/db.rs`, `src-tauri/src/accounts_service.rs`, `src-tauri/src/codex/mod.rs`, `src-tauri/src/codex/paths.rs`, `src-tauri/src/codex/parser.rs`, `src-tauri/src/codex/auth_file.rs`, `src-tauri/src/codex/writer.rs`, `src-tauri/src/codex/config.rs`, `src-tauri/src/codex/env.rs`, `src-tauri/src/codex/api_profile.rs`

**Delivers**: Rust equivalents of the current local storage and Codex switching rules, preserving database compatibility and API profile safety.

#### Automated Verification:
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` passes.
- [ ] Rust unit tests cover `set_managed_openai_base_url` preserving a previous active line as `# auth-switch previous: ...`.
- [ ] Rust unit tests cover `comment_managed_openai_base_url` commenting only the auth-switch-managed line.
- [ ] Rust unit tests cover API profile builder rejects empty API keys and normalizes trailing slashes from base URLs.
- [ ] Rust unit tests cover `atomic_write` writes a file and cleans a failed temp file path where practical.
- [ ] A fixture SQLite DB at schema version 3 can be opened and queried by the Rust database layer.

#### Manual Verification:
- [ ] Code review confirms `CODEX_HOME` fallback remains `${HOME}/.codex` and no custom path UI is introduced.
- [ ] Code review confirms switching away from an API profile skips live-auth backfill.
- [ ] Code review confirms environment cleanup remains best-effort and does not become the primary API profile mechanism.

### Slice 3: Tauri command, dialog, notification, tray, and lifecycle integration

**Files**: `src-tauri/src/commands.rs`, `src-tauri/src/dialog.rs`, `src-tauri/src/notifications.rs`, `src-tauri/src/tray.rs`, `src-tauri/src/i18n.rs`, `src-tauri/src/lib.rs`

**Delivers**: Native shell behavior that replaces Electron IPC, dialogs, notifications, tray quick switching, single-instance handling, and hide-on-close lifecycle.

#### Automated Verification:
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` passes with every command listed in `tauri::generate_handler!`.
- [ ] `rg "window.authSwitch|ipcMain|BrowserWindow|electron" src-tauri src/renderer` returns no accidental Electron command registrations or runtime imports.
- [ ] A command smoke test or manual invoke confirms `get_accounts`, `should_show_first_run`, and `get_live_auth_status` return serializable values.

#### Manual Verification:
- [ ] Closing the main window hides it and leaves the tray/menu bar icon active on macOS.
- [ ] The tray/menu bar can open the main window, add an auth file, switch accounts, and quit.
- [ ] On Windows design review, left-click tray behavior opens the window and Quit exits the process.
- [ ] Native notifications appear after a successful account switch when permissions allow notifications.

### Slice 4: Renderer API adapter and UI parity

**Files**: `src/renderer/api/authSwitch.ts`, `src/renderer/global.d.ts`, `src/renderer/hooks/useAccounts.ts`, `src/renderer/App.tsx`, `src/renderer/i18n/index.ts`, `src/shared/types.ts`, `src/renderer/i18n/locales/en.json`, `src/renderer/i18n/locales/zh.json`

**Delivers**: The existing React UI runs on Tauri commands without Electron preload, while i18n and user-visible text rules remain intact.

#### Automated Verification:
- [ ] `pnpm typecheck` passes with no `window.authSwitch` references.
- [ ] `rg "window\.authSwitch|contextBridge|ipcRenderer|preload" src` returns no live renderer dependency on Electron.
- [ ] `rg "updater|checkForUpdates|electron-updater" src` returns no user-facing updater surface.
- [ ] Any changed renderer strings are present in both `src/renderer/i18n/locales/en.json` and `src/renderer/i18n/locales/zh.json`.

#### Manual Verification:
- [ ] First-run import flow works through the Tauri adapter.
- [ ] Main-window account switch updates the current account card and account list state.
- [ ] API profile creation validates name, base URL, and API key through the Rust command and shows existing localized notices or errors.
- [ ] English and Simplified Chinese language toggle still updates renderer text and persists through restart.

### Slice 5: Packaging, documentation, and release workflow parity

**Files**: `README.md`, `README.zh.md`, `.github/workflows/ci.yml`, `.github/workflows/manual-release.yml`, `.gitignore`, `assets/**`, `src-tauri/icons/**`, `package.json`

**Delivers**: macOS and Windows build instructions, CI/release updates, icon resources, and synchronized docs for the Tauri app.

#### Automated Verification:
- [ ] `pnpm dist:mac` produces a DMG on macOS.
- [ ] The generated DMG path, byte size, and SHA256 can be printed after build.
- [ ] `.github/workflows/ci.yml` installs Rust and Tauri prerequisites before running typecheck and build checks.
- [ ] `.github/workflows/manual-release.yml` references Tauri bundle output paths, not electron-builder release paths.
- [ ] `README.md` and `README.zh.md` both mention Rust/Tauri prerequisites and no longer describe Electron main/preload structure.

#### Manual Verification:
- [ ] README English and Chinese sections remain synchronized for Features, Usage, Development, Project structure, and Packaging.
- [ ] macOS unsigned-build warning remains present.
- [ ] Windows build instructions mention WebView2 runtime and NSIS installer output.
- [ ] Release guidance still says GitHub releases are published through GitHub Actions.

### Slice 6: Electron removal and migration hardening

**Files**: `electron.vite.config.ts`, `electron-builder.yml`, `src/main/**`, `src/preload/**`, `package.json`, `pnpm-lock.yaml`, `README.md`, `README.zh.md`

**Delivers**: A clean Tauri-only repository with Electron code and dependencies removed only after functional parity is verified.

#### Automated Verification:
- [ ] `rg "electron|electron-builder|electron-vite|better-sqlite3|ipcMain|ipcRenderer|BrowserWindow|contextBridge" package.json src src-tauri README.md README.zh.md` returns only historical notes if intentionally kept, otherwise no matches.
- [ ] `pnpm typecheck` passes.
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` passes.
- [ ] `pnpm dist:mac` still produces a DMG after Electron files are removed.
- [ ] No `package-lock.json` is created.

#### Manual Verification:
- [ ] Existing imported accounts from `~/.auth-switch/auth-switch.db` appear in the Tauri app without migration prompts.
- [ ] Normal auth switching and API profile switching work on macOS after a clean app restart.
- [ ] Windows cross-platform review confirms path separators, registry cleanup, tray behavior, and NSIS config are Windows-safe.
- [ ] Final repository has one desktop shell architecture: Tauri v2 plus React renderer.

## Precedents and Lessons

- The earlier API profile provider-table approach was rejected because broad `config.toml` rewrites can break unrelated Codex settings. The Tauri design keeps the accepted single-line `openai_base_url` management.
- Environment-variable switching was unreliable for Codex App and must remain cleanup-only, not the primary mechanism.
- API profiles must not receive live-auth backfill. That bug previously emptied stored API keys, so the Rust port must encode the same guard explicitly.
- The app is local-only. A Tauri updater plugin would reintroduce network behavior and should not be included.

## Open Questions

None. This design chooses a direct Tauri v2 migration path with SQLite compatibility, Rust-owned local operations, unchanged React UI, and no in-app updater.
