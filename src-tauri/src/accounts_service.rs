use crate::codex::{api_profile, auth_file, config, env, paths, writer};
use crate::db::{now_ms, Database, NewAccountRow};
use crate::models::{Account, AccountKind, CodexApiProfileInput, ImportResult, LiveAuthStatus, SwitchResult};
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use uuid::Uuid;

/// RAII guard that resets the switch_in_progress flag on drop,
/// even if the guarded scope panics — mirrors TypeScript's `try/finally`.
struct SwitchGuard<'a>(&'a AtomicBool);
impl Drop for SwitchGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

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

    pub fn list_accounts(&self) -> Result<Vec<Account>, String> {
        self.db.list_accounts().map_err(|error| error.to_string())
    }

    pub fn current_account(&self) -> Result<Option<Account>, String> {
        self.db.get_current_account().map_err(|error| error.to_string())
    }

    pub fn import_auth_file_from_path(&self, file_path: &str, name: Option<&str>, set_current: bool) -> ImportResult {
        match auth_file::read_and_validate_auth_file(file_path)
            .and_then(|snapshot| self.import_auth_snapshot_inner(snapshot, name, set_current))
        {
            Ok(result) => result,
            Err(error) => ImportResult::error(error),
        }
    }

    pub fn import_auth_json_content(&self, content: String, name: Option<&str>, set_current: bool) -> ImportResult {
        match auth_file::validate_auth_json_content(content)
            .and_then(|snapshot| self.import_auth_snapshot_inner(snapshot, name, set_current))
        {
            Ok(result) => result,
            Err(error) => ImportResult::error(error),
        }
    }

    fn import_auth_snapshot_inner(&self, snapshot: auth_file::AuthFileSnapshot, name: Option<&str>, set_current: bool) -> Result<ImportResult, String> {
        if self.db.auth_hash_exists(&snapshot.hash).map_err(|error| error.to_string())? {
            return Ok(ImportResult::duplicate("This auth.json is already in auth-switch."));
        }

        let same_email_exists = if let Some(email) = snapshot.email.as_ref() {
            self.db.find_by_email(email).map_err(|error| error.to_string())?.is_some()
        } else {
            false
        };
        let now = now_ms();
        let id = Uuid::new_v4().to_string();
        let display_name = clean_name(name).or(snapshot.email.clone()).unwrap_or_else(|| "Unnamed account".to_string());

        let account = if set_current {
            // Use a single transaction: insert + mark current atomically.
            // If either step fails, neither is committed — no stranded rows.
            self.db
                .insert_account_set_current(&NewAccountRow {
                    id: id.clone(),
                    name: display_name,
                    email: snapshot.email,
                    auth_json: snapshot.content,
                    auth_hash: snapshot.hash,
                    kind: AccountKind::AuthJson,
                    base_url: None,
                    model: None,
                    is_current: true,
                    created_at: now,
                    updated_at: now,
                    last_used_at: None,
                })
                .map_err(|error| error.to_string())?;
            self.db.get_account_by_id(&id).map_err(|error| error.to_string())?.map(|row| row.into_account())
        } else {
            self.db
                .insert_account(&NewAccountRow {
                    id: id.clone(),
                    name: display_name,
                    email: snapshot.email,
                    auth_json: snapshot.content,
                    auth_hash: snapshot.hash,
                    kind: AccountKind::AuthJson,
                    base_url: None,
                    model: None,
                    is_current: false,
                    created_at: now,
                    updated_at: now,
                    last_used_at: None,
                })
                .map_err(|error| error.to_string())?;
            self.db.get_account_by_id(&id).map_err(|error| error.to_string())?.map(|row| row.into_account())
        };
        Ok(ImportResult::success(account, Some(same_email_exists)))
    }

    pub fn create_api_profile(&self, input: CodexApiProfileInput) -> ImportResult {
        match self.create_api_profile_inner(input) {
            Ok(result) => result,
            Err(error) => ImportResult::error(error),
        }
    }

    fn create_api_profile_inner(&self, input: CodexApiProfileInput) -> Result<ImportResult, String> {
        let display_name = clean_name(Some(&input.name)).unwrap_or_else(|| "Custom API profile".to_string());
        let profile = api_profile::build_codex_api_profile(&input.api_key, &input.base_url)?;
        let auth_hash = auth_file::hash_auth_json(&profile.auth_hash_material);

        if self
            .db
            .api_profile_exists(&auth_hash, &profile.base_url)
            .map_err(|error| error.to_string())?
        {
            return Ok(ImportResult::duplicate("This API key profile is already in auth-switch."));
        }

        let now = now_ms();
        let id = Uuid::new_v4().to_string();
        self.db
            .insert_account(&NewAccountRow {
                id: id.clone(),
                name: display_name,
                email: None,
                auth_json: profile.auth_json,
                auth_hash,
                kind: AccountKind::ApiKey,
                base_url: Some(profile.base_url),
                model: input.model.and_then(|model| clean_name(Some(&model))),
                is_current: false,
                created_at: now,
                updated_at: now,
                last_used_at: None,
            })
            .map_err(|error| error.to_string())?;

        let account = self
            .db
            .get_account_by_id(&id)
            .map_err(|error| error.to_string())?
            .map(|row| row.into_account());
        Ok(ImportResult::success(account, None))
    }

    pub fn import_live_auth_file(&self, name: Option<String>, set_current: bool) -> ImportResult {
        let path = paths::codex_auth_path();
        self.import_auth_file_from_path(path.to_string_lossy().as_ref(), name.as_deref(), set_current)
    }

    pub fn rename_account(&self, id: &str, name: &str) -> Result<(), String> {
        let trimmed = clean_name(Some(name)).ok_or_else(|| "Account name cannot be empty".to_string())?;
        self.db.update_account_meta(id, Some(&trimmed), None).map_err(|error| error.to_string())
    }

    pub fn remove_account(&self, id: &str) -> Result<(), String> {
        let row = self
            .db
            .get_account_by_id(id)
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "Account not found".to_string())?;
        if row.is_current {
            return Err("Switch to another account before deleting this one.".to_string());
        }
        self.db.delete_account(id).map_err(|error| error.to_string())
    }

    pub fn get_live_auth_status(&self) -> LiveAuthStatus {
        let path = paths::codex_auth_path();
        if !path.exists() {
            return LiveAuthStatus {
                exists: false,
                hash: None,
                email: None,
                path: path.to_string_lossy().to_string(),
            };
        }

        match auth_file::read_and_validate_auth_file(&path) {
            Ok(snapshot) => LiveAuthStatus {
                exists: true,
                hash: Some(snapshot.hash),
                email: snapshot.email,
                path: path.to_string_lossy().to_string(),
            },
            Err(_) => match fs::read_to_string(&path) {
                Ok(raw) => LiveAuthStatus {
                    exists: true,
                    hash: Some(auth_file::hash_auth_json(&raw)),
                    email: None,
                    path: path.to_string_lossy().to_string(),
                },
                Err(_) => LiveAuthStatus {
                    exists: true,
                    hash: None,
                    email: None,
                    path: path.to_string_lossy().to_string(),
                },
            },
        }
    }

    pub fn switch_account(&self, id: &str) -> SwitchResult {
        if self
            .switch_in_progress
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return SwitchResult::error("Another switch is already in progress.");
        }
        // _guard resets the flag on drop — even if switch_account_inner panics.
        let _guard = SwitchGuard(&self.switch_in_progress);
        self.switch_account_inner(id)
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

        // Snapshot the current account's auth content so we can roll back auth.json
        // if the write chain partially fails (auth.json written, then config/DB fails).
        let prev_auth_json: Option<String> = self
            .db
            .get_current_account_row()
            .ok()
            .flatten()
            .and_then(|current| {
                if current.id != target.id && current.kind == AccountKind::AuthJson {
                    if let Ok(Some(live)) = auth_file::read_live_auth_file() {
                        let _ = self.db.update_account_live_snapshot(
                            &current.id,
                            &live.content,
                            &live.hash,
                            now_ms(),
                        );
                        return Some(live.content);
                    }
                    Some(current.auth_json)
                } else {
                    // ApiKey accounts: don't backfill, but remember content for rollback.
                    if current.kind == AccountKind::ApiKey {
                        None // No rollback needed — auth.json was already API-key shaped.
                    } else {
                        Some(current.auth_json)
                    }
                }
            });

        let auth_path = paths::codex_auth_path();

        // Attempt to write the new auth.json. If the subsequent config/env steps fail,
        // we try to restore the previous auth.json so the filesystem stays consistent.
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
            // auth.json may already have been replaced; try to restore the previous content.
            if let Some(prev) = prev_auth_json {
                let _ = writer::atomic_write(&auth_path, &prev);
            }
            return SwitchResult::error(error.to_string());
        }

        match self
            .db
            .set_current_account(&target.id)
            .and_then(|_| self.db.get_account_by_id(&target.id))
        {
            Ok(Some(updated)) => SwitchResult::success(updated.into_account()),
            Ok(None) => SwitchResult::success(target.into_account()),
            Err(error) => {
                // auth.json is already written; best-effort restore on DB failure.
                if let Some(prev) = prev_auth_json {
                    let _ = writer::atomic_write(&auth_path, &prev);
                }
                SwitchResult::error(error.to_string())
            }
        }
    }

    pub fn get_bool_setting(&self, key: &str) -> Result<bool, String> {
        self.db.get_bool_setting(key).map_err(|error| error.to_string())
    }

    pub fn set_bool_setting(&self, key: &str, value: bool) -> Result<(), String> {
        self.db.set_bool_setting(key, value).map_err(|error| error.to_string())
    }

    pub fn set_locale(&self, locale: &str) -> Result<(), String> {
        let normalized = if locale.starts_with("zh") { "zh" } else { "en" };
        let mut guard = self.locale.lock().map_err(|_| "locale lock poisoned".to_string())?;
        *guard = normalized.to_string();
        Ok(())
    }

    #[allow(dead_code)]
    pub fn locale(&self) -> String {
        self.locale.lock().map(|value| value.clone()).unwrap_or_else(|_| "en".to_string())
    }
}

fn clean_name(name: Option<&str>) -> Option<String> {
    let trimmed = name?.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}
