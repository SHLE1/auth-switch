---
date: 2026-05-28T00:19:53+0800
author: SHLE1
commit: 1d20d76
branch: refactor/tauri
repository: auth-switch
topic: "Refactor auth-switch from Electron to Tauri v2"
tags: [plan, tauri, desktop, codex, migration]
status: ready
parent: ".rpiv/artifacts/designs/2026-05-28_00-12-39_refactor-to-tauri-v2.md"
last_updated: 2026-05-28T00:19:53+0800
last_updated_by: SHLE1
---

# Refactor auth-switch from Electron to Tauri v2 Implementation Plan

## Overview

Refactor `auth-switch` from an Electron main process, preload bridge, and electron-builder package into a Tauri v2 desktop app with a Rust backend and the existing React renderer. This plan inherits the six verified slices from the design artifact 1:1 as implementation phases. The migration keeps product behavior focused on Codex only, preserves the existing local SQLite database shape, ports privileged filesystem/database/tray work to Rust, and removes Electron compatibility surfaces only after Tauri parity is verified.

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

## What We're NOT Doing

- No support for Claude, Cursor, Gemini, or non-Codex tools.
- No custom Codex path picker.
- No provider-table rewrite of `~/.codex/config.toml`.
- No encryption or cloud sync.
- No Tauri mobile target.
- No auto-update network check in the migrated app.
- No visual redesign beyond keeping the existing UI coherent under the Tauri webview.

## Phase 1: Tauri scaffold and renderer build pipeline

### Overview

A minimal Tauri v2 app launches the existing React renderer, carries the correct macOS and Windows identity, and replaces the Electron build pipeline foundation without yet removing the old source tree.

### Changes Required:

#### 1. Package and renderer build scripts
**File**: `package.json`
**Changes**: Replace Electron run/build scripts with Vite and Tauri scripts, add Tauri dependencies, and retain existing Electron runtime/build dependencies until Phase 6 so `tsconfig.json` can still type-check the old Electron files during the scaffold phase.

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
    "@electron-toolkit/utils": "^3.0.0",
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
    "better-sqlite3": "^12.10.0",
    "bindings": "^1.5.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "electron-updater": "^6.8.3",
    "file-uri-to-path": "^1.0.0",
    "i18next": "^26.2.0",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-i18next": "^17.0.8",
    "tailwind-merge": "^3.6.0",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@electron/asar": "^3.4.1",
    "@tauri-apps/cli": "^2.0.0",
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.17.10",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "electron": "^33.4.11",
    "electron-builder": "^24.13.3",
    "electron-vite": "^2.3.0",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vite": "^5.4.11"
  },
  "packageManager": "pnpm@11.1.2"
}
```

#### 2. Vite renderer config
**File**: `vite.config.ts`
**Changes**: Add Vite config for `src/renderer` with the existing `@` alias and Tauri dev server settings.

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

#### 3. Tauri app configuration
**File**: `src-tauri/tauri.conf.json`
**Changes**: Add app identity, dev/build hooks, bundle targets, icons, resources, and conservative CSP/security settings.

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

#### 4. Tauri icon resources
**File**: `src-tauri/icons/**`
**Changes**: Generate or copy Tauri-compatible icon files before `tauri.conf.json` references them. Use the existing `assets/icon.png` as the source and create `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, and `icon.ico` in `src-tauri/icons/`.

```text
src-tauri/icons/
  32x32.png
  128x128.png
  128x128@2x.png
  icon.icns
  icon.ico
```

#### 5. Tauri capabilities
**File**: `src-tauri/capabilities/default.json`
**Changes**: Add minimal frontend permissions because filesystem/database work is owned by Rust commands.

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

#### 6. Rust crate manifest
**File**: `src-tauri/Cargo.toml`
**Changes**: Add Tauri v2, plugin, SQLite, serde, URL, UUID, and error dependencies.

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

#### 7. Thin Rust entrypoint
**File**: `src-tauri/src/main.rs`
**Changes**: Add Windows subsystem attribute and delegate to the library entry point.

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    auth_switch_lib::run();
}
```

#### 8. Initial Rust app builder
**File**: `src-tauri/src/lib.rs`
**Changes**: Establish the app builder target that later phases fill with command, service, tray, and lifecycle modules.

```rust
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running auth-switch");
}
```

### Success Criteria:

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

---

## Phase 2: Rust Codex and SQLite core

### Overview

Port the local database, Codex auth/config filesystem rules, API profile creation, auth parsing, atomic writes, and legacy environment cleanup into Rust while preserving the current database and switching semantics.

### Changes Required:

#### 1. Shared Rust models
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

impl SwitchResult {
    pub fn success(account: Account) -> Self {
        Self { success: true, already_current: None, error: None, account: Some(account) }
    }

    pub fn already_current(account: Account) -> Self {
        Self { success: true, already_current: Some(true), error: None, account: Some(account) }
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self { success: false, already_current: None, error: Some(message.into()), account: None }
    }
}

impl ImportResult {
    pub fn cancelled() -> Self {
        Self { success: false, cancelled: Some(true), duplicate: None, same_email_exists: None, account: None, error: None }
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self { success: false, cancelled: None, duplicate: None, same_email_exists: None, account: None, error: Some(message.into()) }
    }
}

#[derive(Debug, Serialize)]
pub struct LiveAuthStatus {
    pub exists: bool,
    pub hash: Option<String>,
    pub email: Option<String>,
    pub path: String,
}
```

#### 2. SQLite compatibility layer
**File**: `src-tauri/src/db.rs`
**Changes**: Use `~/.auth-switch/auth-switch.db`, preserve migrations through `user_version = 3`, and add query/update methods equivalent to the current TypeScript database layer.

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
            "SELECT id, name, email, kind, base_url, model, is_current, created_at, updated_at, last_used_at FROM accounts WHERE is_current = 1 ORDER BY last_used_at DESC LIMIT 1",
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

The implementation must fill insert, update, delete, settings, duplicate checks, and row-by-id methods as direct equivalents of `src/main/db/accounts.ts` and `src/main/db/settings.ts`.

#### 3. Codex official paths
**File**: `src-tauri/src/codex/paths.rs`
**Changes**: Resolve `${CODEX_HOME:-$HOME/.codex}/auth.json` and derive `config.toml` from the same directory.

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

#### 4. Codex module exports and auth-file helpers
**File**: `src-tauri/src/codex/mod.rs`, `src-tauri/src/codex/auth_file.rs`, `src-tauri/src/codex/parser.rs`
**Changes**: Export all Codex submodules and port auth JSON read, validate, hash, and email parsing helpers used by `AccountsService`.

```rust
// src-tauri/src/codex/mod.rs
pub mod api_profile;
pub mod auth_file;
pub mod config;
pub mod env;
pub mod parser;
pub mod paths;
pub mod writer;
```

```rust
// src-tauri/src/codex/auth_file.rs
// Implement AuthFileSnapshot { content, hash, email, parsed } plus:
// - hash_auth_json(content) using SHA-256 hex
// - read_and_validate_auth_file(path) using serde_json and parser::parse_email
// - read_live_auth_file() using paths::codex_auth_path()
```

#### 5. Atomic auth writer
**File**: `src-tauri/src/codex/writer.rs`
**Changes**: Write auth files through temp-file replacement with Unix permissions and Windows-safe replace behavior.

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

#### 6. API profile builder
**File**: `src-tauri/src/codex/api_profile.rs`
**Changes**: Build Codex API-key-shaped `auth.json`, normalize base URLs, and reject empty API keys.

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

#### 7. Config and environment cleanup modules
**File**: `src-tauri/src/codex/config.rs`, `src-tauri/src/codex/env.rs`
**Changes**: Port single-line `openai_base_url` management and best-effort legacy environment cleanup exactly from the existing behavior.

```rust
// src-tauri/src/codex/config.rs
// Port the current line-preserving openai_base_url logic exactly:
// - KEY = "openai_base_url"
// - MANAGED_MARKER = "# auth-switch managed"
// - PREVIOUS_PREFIX = "# auth-switch previous: "
// - enable_codex_base_url(base_url) adds or updates only the managed top-level line.
// - If a user already has an active openai_base_url, preserve it as a commented backup.
// - disable_codex_base_url() comments the managed line instead of deleting unrelated config.
```

```rust
// src-tauri/src/codex/env.rs
// Port cleanup of OPENAI_API_KEY, CODEX_API_KEY, and OPENAI_BASE_URL:
// - remove variables from the current process environment
// - on macOS run `launchctl unsetenv <name>` best-effort
// - on Windows run `reg delete HKCU\\Environment /F /V <name>` best-effort
// - on Unix shell profiles only replace an existing auth-switch block, do not append new switching state
```

#### 8. Account switching service
**File**: `src-tauri/src/accounts_service.rs`
**Changes**: Preserve import, duplicate detection, rename, delete, current-account lookup, first-run setting, switch guard, live-auth backfill for normal accounts only, API profile switching, and status methods.

```rust
use crate::codex::{config, env, paths, writer};
use crate::db::Database;
use crate::models::{AccountKind, CodexApiProfileInput, ImportResult, LiveAuthStatus, SwitchResult};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

pub struct AccountsService {
    db: Database,
    switch_in_progress: AtomicBool,
    locale: Mutex<String>,
}

impl AccountsService {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            db: Database::open().map_err(|error| error.to_string())?,
            switch_in_progress: AtomicBool::new(false),
            locale: Mutex::new("en".to_string()),
        })
    }

    pub fn switch_account(&self, id: &str) -> SwitchResult {
        if self.switch_in_progress.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
            return SwitchResult::error("Another switch is already in progress.");
        }

        let result = self.switch_account_inner(id);
        self.switch_in_progress.store(false, Ordering::SeqCst);
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

The implementation must add import, rename, delete, duplicate detection, auth parsing, and settings methods as direct Rust ports of the current TypeScript service.

### Success Criteria:

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

---

## Phase 3: Tauri command, dialog, notification, tray, and lifecycle integration

### Overview

Replace Electron IPC, native dialogs, notifications, tray/menu quick switching, single-instance behavior, and hide-on-close lifecycle with Tauri v2 commands, plugins, and tray APIs.

### Changes Required:

#### 1. Tauri command surface
**File**: `src-tauri/src/commands.rs`
**Changes**: Register one command per existing renderer API method and emit account refresh events after mutations.

```rust
use crate::accounts_service::AccountsService;
use crate::models::{Account, CodexApiProfileInput, ImportResult, LiveAuthStatus, SwitchResult};
use tauri::{AppHandle, Emitter, State};

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

#### 2. App builder and lifecycle
**File**: `src-tauri/src/lib.rs`
**Changes**: Wire plugins, service state, command registration, single instance, tray setup, and hide-on-close behavior.

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

#### 3. Tray and menu
**File**: `src-tauri/src/tray.rs`
**Changes**: Build a native tray/menu from accounts, support open window, add auth file, switch account, and quit on macOS and Windows.

```rust
use crate::accounts_service::AccountsService;
use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

pub fn create_tray(app: &AppHandle, service: &AccountsService) {
    let menu = build_menu(app, service);
    let _ = TrayIconBuilder::with_id("main-tray")
        .tooltip("auth-switch")
        .icon(app.default_window_icon().expect("auth-switch bundle icon is required").clone())
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

#### 4. Dialog, notification, and optional i18n helpers
**File**: `src-tauri/src/dialog.rs`, `src-tauri/src/notifications.rs`, `src-tauri/src/i18n.rs`
**Changes**: Use Tauri plugins for file picker, confirm/message dialogs, native notifications, and optional tray label translations.

```rust
// src-tauri/src/dialog.rs
// Use tauri-plugin-dialog to implement:
// - pick_auth_json(app) with JSON and all-file filters
// - confirm(app, title, message, confirm_label, cancel_label) -> bool
// - message(app, title, message, button_label) -> ()
```

```rust
// src-tauri/src/notifications.rs
// Use tauri-plugin-notification to implement notify(app, title, body).
// Preserve local-only behavior: no remote update or network notification flow.
```

```rust
// src-tauri/src/i18n.rs
// Optional: a tiny en/zh map for tray labels if tray i18n is retained.
// It is acceptable for tray/native menu strings to remain English per project instruction.
```

### Success Criteria:

#### Automated Verification:
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` passes with every command listed in `tauri::generate_handler!`.
- [ ] `rg "window.authSwitch|ipcMain|BrowserWindow|electron" src-tauri src/renderer` returns no accidental Electron command registrations or runtime imports.
- [ ] A command smoke test or manual invoke confirms `get_accounts`, `should_show_first_run`, and `get_live_auth_status` return serializable values.

#### Manual Verification:
- [ ] Closing the main window hides it and leaves the tray/menu bar icon active on macOS.
- [ ] The tray/menu bar can open the main window, add an auth file, switch accounts, and quit.
- [ ] On Windows design review, left-click tray behavior opens the window and Quit exits the process.
- [ ] Native notifications appear after a successful account switch when permissions allow notifications.

---

## Phase 4: Renderer API adapter and UI parity

### Overview

Switch the React UI from Electron preload globals to a typed Tauri `invoke`/`listen` adapter while keeping the visible UI, i18n behavior, account flows, and localized text rules intact.

### Changes Required:

#### 1. Tauri renderer adapter
**File**: `src/renderer/api/authSwitch.ts`
**Changes**: Replace `window.authSwitch` with a typed adapter backed by `@tauri-apps/api/core` and `@tauri-apps/api/event`.

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

#### 2. Global declarations
**File**: `src/renderer/global.d.ts`
**Changes**: Remove the Electron global API declaration.

```ts
export {};
```

#### 3. Renderer call sites and i18n sync
**File**: `src/renderer/hooks/useAccounts.ts`, `src/renderer/App.tsx`, `src/renderer/i18n/index.ts`, `src/shared/types.ts`, `src/renderer/i18n/locales/en.json`, `src/renderer/i18n/locales/zh.json`
**Changes**: Import the Tauri adapter, replace all `window.authSwitch` calls, remove updater UI assumptions, and keep changed renderer strings synchronized in both locale files.

```ts
// Required renderer edits:
// - src/renderer/hooks/useAccounts.ts: import { authSwitch } and replace window.authSwitch calls.
// - src/renderer/App.tsx: import { authSwitch } and replace all window.authSwitch calls.
// - src/renderer/i18n/index.ts: import { authSwitch } and gate startup sync through the adapter.
// - Any dialog or component with window.authSwitch must use the adapter.
// - Keep all user-visible renderer strings in en.json and zh.json if copy changes.
```

```ts
// Example call-site conversion:
const nextAccounts = await authSwitch.getAccounts();

return authSwitch.onAccountsChanged(() => {
  void refresh();
});
```

### Success Criteria:

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

---

## Phase 5: Packaging, documentation, and release workflow parity

### Overview

Update documentation, icon resources, CI, and release workflows so macOS and Windows builds use Tauri bundle outputs and the project docs accurately describe the migrated architecture.

### Changes Required:

#### 1. README parity
**File**: `README.md`, `README.zh.md`
**Changes**: Update project structure, prerequisites, development commands, packaging outputs, local-only note, and platform build details in both languages.

```markdown
README.md and README.zh updates must stay synchronized:

- Project structure: replace `src/main` and `src/preload` with `src-tauri` and `src/renderer/api`.
- Development commands: Tauri `pnpm dev`, `pnpm build`, `pnpm dist`, `pnpm dist:mac`, `pnpm dist:win`.
- Prerequisites: Node.js, pnpm, Rust stable, Tauri platform prerequisites.
- Windows prerequisites: WebView2 runtime and NSIS bundle output.
- macOS prerequisites: Xcode command line tools and unsigned-build warning.
- Packaging outputs: Tauri bundle location plus release copy convention if implementation adds a copy step.
- Local-only note: no auto-update check.
```

#### 2. CI and release workflows
**File**: `.github/workflows/ci.yml`, `.github/workflows/manual-release.yml`, `.github/workflows/build-release.yml`
**Changes**: Install Rust and Tauri prerequisites, run Tauri build checks, migrate or delete the old Electron unsigned-artifact workflow, remove or rewrite electron-updater appcast/latest-yml metadata handling, and reference Tauri bundle output paths instead of electron-builder paths.

```yaml
# .github/workflows/ci.yml, .github/workflows/manual-release.yml, and .github/workflows/build-release.yml changes:
# - install Rust stable
# - install Tauri Linux/macOS/Windows prerequisites appropriate for each runner
# - run pnpm install without creating package-lock.json
# - run pnpm typecheck
# - run cargo check --manifest-path src-tauri/Cargo.toml
# - run Tauri build or bundle steps where supported
# - remove or rewrite the electron-updater appcast/latest-yml metadata branch for the no-updater Tauri release flow
# - migrate or delete build-release.yml so it no longer runs electron-builder
# - upload/reference src-tauri/target/release/bundle/** artifacts instead of electron-builder release/** outputs
```

#### 3. Icons, assets, ignore rules, and release paths
**File**: `.gitignore`, `assets/**`, `src-tauri/icons/**`, `package.json`
**Changes**: Ensure Tauri icon resources exist, `src-tauri/target/` is ignored, generated bundle outputs are ignored or retained intentionally, Tauri DMG artifacts are copied or renamed to preserve `auth-switch-${VERSION_NUMBER}-arm64.dmg` and `auth-switch-${VERSION_NUMBER}-x64.dmg` where release/Homebrew automation expects them, and macOS DMG reporting remains possible.

```text
assets/
  tray-icon.png
  tray-icon@2x.png
src-tauri/icons/
  32x32.png
  128x128.png
  128x128@2x.png
  icon.icns
  icon.ico
```

Implementation must generate or copy Tauri-compatible icon files from the existing `assets/icon.png` source, add `src-tauri/target/` to `.gitignore`, and keep generated bundle directories handled intentionally. Release packaging must either copy/rename Tauri DMGs to the existing Homebrew-compatible names or update the Homebrew workflow in the same phase.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm dist:mac` produces a DMG on macOS.
- [ ] The generated DMG path, byte size, and SHA256 can be printed after build.
- [ ] Tauri DMG artifacts are copied/renamed to `auth-switch-${VERSION_NUMBER}-arm64.dmg` and `auth-switch-${VERSION_NUMBER}-x64.dmg`, or the Homebrew tap workflow is updated to consume the new Tauri paths.
- [ ] `.github/workflows/ci.yml` installs Rust and Tauri prerequisites before running typecheck and build checks.
- [ ] `.github/workflows/manual-release.yml` references Tauri bundle output paths, not electron-builder release paths.
- [ ] `.github/workflows/build-release.yml` is migrated to Tauri or removed if redundant.
- [ ] Manual release metadata no longer references electron-updater appcast/latest-yml files.
- [ ] `README.md` and `README.zh.md` both mention Rust/Tauri prerequisites and no longer describe Electron main/preload structure.

#### Manual Verification:
- [ ] README English and Chinese sections remain synchronized for Features, Usage, Development, Project structure, and Packaging.
- [ ] macOS unsigned-build warning remains present.
- [ ] Windows build instructions mention WebView2 runtime and NSIS installer output.
- [ ] Release guidance still says GitHub releases are published through GitHub Actions.

---

## Phase 6: Electron removal and migration hardening

### Overview

Remove Electron files and dependencies only after Tauri parity is established, then harden the final migrated repository with cross-platform validation and existing-data checks.

### Changes Required:

#### 1. Remove Electron build/runtime files
**File**: `electron.vite.config.ts`, `electron-builder.yml`, `src/main/**`, `src/preload/**`
**Changes**: Delete the old Electron main process, preload bridge, Electron build config, updater, tray, database, and Codex TypeScript backend after Rust equivalents are verified.

```text
Delete after Tauri parity is verified:

electron.vite.config.ts
electron-builder.yml
src/preload/index.ts
src/main/index.ts
src/main/ipc.ts
src/main/window.ts
src/main/tray.ts
src/main/menu.ts
src/main/updater.ts
src/main/notifications.ts
src/main/logger.ts
src/main/i18n.ts
src/main/codex/**
src/main/db/**
src/main/services/**
```

Removal must happen only after the Rust equivalents are compiling and runtime parity checks have passed.

#### 2. Remove Electron dependencies and lockfile entries
**File**: `package.json`, `pnpm-lock.yaml`
**Changes**: Ensure Electron, electron-builder, electron-vite, electron-updater, better-sqlite3, and related native Node runtime dependencies are gone after Tauri parity.

```json
{
  "removeDependencies": [
    "@electron-toolkit/utils",
    "better-sqlite3",
    "bindings",
    "electron-updater",
    "file-uri-to-path"
  ],
  "removeDevDependencies": [
    "@electron/asar",
    "@types/better-sqlite3",
    "electron",
    "electron-builder",
    "electron-vite"
  ]
}
```

Run dependency cleanup with `pnpm`, update `pnpm-lock.yaml`, and confirm `package-lock.json` is not created.

#### 3. Final docs hardening
**File**: `README.md`, `README.zh.md`
**Changes**: Remove any stale Electron wording except explicit historical migration notes if intentionally kept.

```markdown
Final documentation cleanup:

- Remove stale Electron main/preload/electron-builder wording.
- Keep Tauri/Rust project structure current.
- Keep local-only behavior and no-updater note explicit.
- Keep macOS unsigned-build note.
- Keep Windows WebView2 and NSIS output note.
- Keep README.md and README.zh sections aligned.
```

### Success Criteria:

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

---

## Testing Strategy

### Automated:
- `pnpm install`
- `pnpm typecheck`
- `pnpm build:renderer`
- `pnpm tauri info`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- Rust unit tests for config.toml, API profile, atomic write, and SQLite schema compatibility
- `pnpm dist:mac` on macOS
- CI workflow build checks with Rust and Tauri prerequisites
- grep checks for stale Electron runtime dependencies and updater surfaces

### Manual Testing Steps:
1. Verify `pnpm tauri dev` opens the main window and first-run dialog still appears when `first_run_done` is false.
2. Verify importing an existing `auth.json` creates or reuses `~/.auth-switch/auth-switch.db` without changing schema meaning.
3. Verify switching normal auth to normal auth backfills the previous live `auth.json`.
4. Verify switching API profile to auth profile does not backfill API profile content and does not empty the stored API key.
5. Verify API profile switching writes API-key-shaped `auth.json` and manages only the top-level managed `openai_base_url` line.
6. Verify switching back to normal auth comments out the managed `openai_base_url` line.
7. Verify legacy environment cleanup on macOS and Windows best-effort paths.
8. Verify closing the main window keeps tray resident and Quit exits.
9. Verify tray/menu quick switch updates renderer state without reopening the window.
10. Verify macOS DMG builds and is reported with path, size, and SHA256.
11. Verify Windows bundle path is correct in documentation and CI config, even if local Windows build is not run on macOS.
12. Verify README.md and README.zh stay synchronized.
13. Verify no code path adds network update checks.

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

## Developer Context


## References

- Design: `.rpiv/artifacts/designs/2026-05-28_00-12-39_refactor-to-tauri-v2.md`

## Plan Review (Step 4)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 5._

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| code | Phase 1 §1 (package.json) | tsconfig.json:24 | blocker | actionability | Phase 1 removes Electron, electron-vite, and better-sqlite3 dependencies while HEAD `tsconfig.json` still includes `electron.vite.config.ts` and `src/**/*.ts`, so `pnpm typecheck` will compile old Electron main/preload files against missing packages. | Defer Electron dependency removal to Phase 6 or add a Phase 1 `tsconfig.json` update that excludes `electron.vite.config.ts`, `src/main/**`, and `src/preload/**`. | applied: Phase 1 now retains existing Electron dependencies while swapping scripts; Phase 6 remains responsible for Electron dependency removal. |
| code | Phase 1 §3 (tauri.conf.json) | <n/a> | blocker | actionability | `bundle.icon` references `icons/32x32.png`, `icons/128x128.png`, `icons/128x128@2x.png`, `icons/icon.icns`, and `icons/icon.ico`, but `src-tauri/icons/**` is not scaffolded until Phase 5. | Move Tauri icon generation/scaffolding into Phase 1 before `tauri.conf.json` references those files. | applied: Phase 1 now includes `src-tauri/icons/**` generation before capabilities and Rust scaffold steps. |
| code | Phase 1 §7 (lib.rs) | <n/a> | blocker | actionability | `app.get_webview_window("main")` requires the `tauri::Manager` trait, but Phase 1 `lib.rs` imports no trait. | Add `use tauri::Manager;` to Phase 1 `src-tauri/src/lib.rs`. | applied: Phase 1 `lib.rs` code fence now imports `tauri::Manager`. |
| code | Phase 2 §1 (models.rs) | <n/a> | blocker | actionability | Phase 2 and Phase 3 call `SwitchResult::error`, `SwitchResult::already_current`, `SwitchResult::success`, and `ImportResult::cancelled`, but `models.rs` defines only data structs with no impl constructors. | Add explicit impl constructors to `models.rs` in Phase 2 before `accounts_service.rs` and `commands.rs` use them. | applied: Phase 2 `models.rs` now includes constructor impls for `SwitchResult` and `ImportResult`. |
| code | Phase 2 §7 (accounts_service.rs) | <n/a> | blocker | actionability | `accounts_service.rs` imports `crate::codex::{config, env, paths, writer}` and calls `crate::codex::auth_file::read_live_auth_file()`, but the plan never creates `src-tauri/src/codex/mod.rs` or `src-tauri/src/codex/auth_file.rs`. | Add a Phase 2 subsection for `src-tauri/src/codex/mod.rs` and `src-tauri/src/codex/auth_file.rs` exporting the referenced modules/functions. | applied: Phase 2 now includes Codex module exports plus `auth_file.rs` and parser helper coverage before the service uses them. |
| code | Phase 3 §1 (commands.rs) | <n/a> | blocker | actionability | `app.emit("accounts-changed", ())` requires the Tauri `Emitter` trait, but `commands.rs` imports only `AppHandle` and `State`. | Change the import to `use tauri::{AppHandle, Emitter, State};`. | applied: Phase 3 `commands.rs` now imports `tauri::Emitter`. |
| code | Phase 3 §3 (tray.rs) | <n/a> | blocker | actionability | `app.default_window_icon().cloned().unwrap_or_default()` requires a default `tauri::image::Image`, which Tauri does not provide. | Require an icon with `expect(...).clone()` or load the planned tray image resource explicitly. | applied: Phase 3 tray code now requires the configured bundle icon with `expect(...).clone()`. |
| code | Phase 2 §2 (db.rs) | src/main/db/accounts.ts:57-60 | concern | codebase-fit | Rust `get_current_account` drops the existing `ORDER BY last_used_at DESC` tie-breaker, so legacy DBs with multiple current rows can return a different account than the Electron layer. | Add `ORDER BY last_used_at DESC` to the Rust current-account query. | applied: Phase 2 current-account query now preserves `ORDER BY last_used_at DESC`. |
| code | Phase 2 §7 (accounts_service.rs) | src/main/services/accountsService.ts:156-160 | concern | code-quality | The Rust `Mutex<bool>` guard is held for the full switch, so a concurrent switch blocks until the first finishes and then proceeds instead of returning "Another switch is already in progress." like HEAD. | Use an `AtomicBool` compare/exchange or drop the mutex guard immediately after setting the flag and reset it with a scope guard. | applied: Phase 2 service code now uses `AtomicBool::compare_exchange` for non-blocking switch-in-progress parity. |
| code | Phase 5 §2 (.github/workflows) | .github/workflows/build-release.yml:35 | concern | codebase-fit | Phase 5 updates only `ci.yml` and `manual-release.yml`, leaving live `build-release.yml` with Electron builder commands at lines 35 and 78. | Add `.github/workflows/build-release.yml` to Phase 5 and migrate or delete the Electron unsigned-artifact workflow. | applied: Phase 5 now includes `build-release.yml` and requires migrating or deleting its Electron builder flow. |
| code | Phase 5 §2 (manual-release.yml) | .github/workflows/manual-release.yml:333 | concern | codebase-fit | The plan does not remove the existing manual-release "Update metadata" section that still says "`latest-mac.yml` and `latest.yml` are consumed by electron-updater." | Remove the appcast/electron-updater release metadata branch or rewrite it for the no-updater Tauri release flow in Phase 5. | applied: Phase 5 workflow guidance now explicitly removes or rewrites electron-updater appcast/latest-yml metadata handling. |
| code | Phase 5 §2 (manual-release.yml) | .github/workflows/manual-release.yml:476-483 | concern | actionability | The existing Homebrew tap step requires `auth-switch-${VERSION_NUMBER}-arm64.dmg` and `auth-switch-${VERSION_NUMBER}-x64.dmg`, but Phase 5 does not specify a Tauri artifact copy/rename step preserving those names. | Add a Phase 5 release artifact naming step or update the Homebrew tap logic to consume actual Tauri bundle paths. | applied: Phase 5 now requires Tauri DMG copy/rename compatibility or a matching Homebrew workflow update. |
| code | Phase 5 §3 (.gitignore) | .gitignore:7 | suggestion | codebase-fit | `.gitignore` has build outputs but no `src-tauri/target/`, so local Rust/Tauri build artifacts can be accidentally staged. | Add `src-tauri/target/` under build outputs when adding the Tauri scaffold. | applied: Phase 5 now requires adding `src-tauri/target/` to `.gitignore`. |

_Coverage reviewer found no uncovered verification-intent rows._
