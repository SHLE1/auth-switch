use crate::claude::{paths as claude_paths, settings as claude_settings};
use crate::codex::{api_profile, auth_file, config, env, paths, writer};
use crate::db::{now_ms, Database, NewAccountRow};
use crate::models::{Account, AccountKind, ClaudeProfileInput, CodexApiProfileInput, ImportResult, LiveAuthStatus, LiveClaudeStatus, ProfileEditData, SwitchResult};
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use uuid::Uuid;

const APP_CODEX: &str = "codex";
const APP_CLAUDE: &str = "claude";
const CLAUDE_AUTH_TOKEN_FIELD: &str = "ANTHROPIC_AUTH_TOKEN";

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

        let new_row = NewAccountRow {
            id: id.clone(),
            app: APP_CODEX.to_string(),
            name: display_name,
            email: snapshot.email,
            auth_json: snapshot.content,
            auth_hash: snapshot.hash,
            kind: AccountKind::AuthJson,
            base_url: None,
            model: None,
            is_current: set_current,
            created_at: now,
            updated_at: now,
            last_used_at: None,
        };

        if set_current {
            self.db.insert_account_set_current(&new_row).map_err(|error| error.to_string())?;
        } else {
            self.db.insert_account(&new_row).map_err(|error| error.to_string())?;
        }
        let account = self.db.get_account_by_id(&id).map_err(|error| error.to_string())?.map(|row| row.into_account());
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
                app: APP_CODEX.to_string(),
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

    pub fn create_claude_profile(&self, input: ClaudeProfileInput) -> ImportResult {
        match self.create_claude_profile_inner(input) {
            Ok(result) => result,
            Err(error) => ImportResult::error(error),
        }
    }

    fn create_claude_profile_inner(&self, input: ClaudeProfileInput) -> Result<ImportResult, String> {
        let display_name = clean_name(Some(&input.name)).unwrap_or_else(|| "Claude API profile".to_string());
        let settings_json = claude_settings::build_claude_settings_json(
            &input.api_key,
            CLAUDE_AUTH_TOKEN_FIELD,
            input.base_url.as_deref(),
            input.haiku_model.as_deref(),
            input.sonnet_model.as_deref(),
            input.opus_model.as_deref(),
        )?;
        let settings_hash = claude_settings::hash_settings(&settings_json);

        if self
            .db
            .auth_hash_exists_for_app(APP_CLAUDE, &settings_hash)
            .map_err(|error| error.to_string())?
        {
            return Ok(ImportResult::duplicate("This Claude profile is already in auth-switch."));
        }

        let now = now_ms();
        let id = Uuid::new_v4().to_string();
        self.db
            .insert_account(&NewAccountRow {
                id: id.clone(),
                app: APP_CLAUDE.to_string(),
                name: display_name,
                email: None,
                auth_json: settings_json,
                auth_hash: settings_hash,
                kind: AccountKind::ApiKey,
                base_url: input.base_url.and_then(|base_url| clean_name(Some(&base_url))),
                model: input.sonnet_model.as_ref().or(input.opus_model.as_ref()).or(input.haiku_model.as_ref()).and_then(|model| clean_name(Some(model))),
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

    /// Returns the field values needed to pre-fill the edit dialog for an api_key profile.
    pub fn get_profile_edit_data(&self, id: &str) -> Result<ProfileEditData, String> {
        let row = self
            .db
            .get_account_by_id(id)
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "Account not found".to_string())?;

        if row.kind != AccountKind::ApiKey {
            return Err("Only api_key profiles can be edited this way".to_string());
        }

        let parsed: serde_json::Value = serde_json::from_str(&row.auth_json)
            .map_err(|error| error.to_string())?;

        let (api_key, base_url, haiku, sonnet, opus) = if row.app == APP_CODEX {
            let key = parsed
                .get("OPENAI_API_KEY")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let url = row.base_url.clone().unwrap_or_default();
            (key, url, String::new(), String::new(), String::new())
        } else {
            // Claude: {"env": {"ANTHROPIC_AUTH_TOKEN": "...", ...}}
            let env = parsed.get("env").cloned().unwrap_or_default();
            let key = env
                .get("ANTHROPIC_AUTH_TOKEN")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let url = env
                .get("ANTHROPIC_BASE_URL")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let haiku = env
                .get("ANTHROPIC_DEFAULT_HAIKU_MODEL")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let sonnet = env
                .get("ANTHROPIC_DEFAULT_SONNET_MODEL")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let opus = env
                .get("ANTHROPIC_DEFAULT_OPUS_MODEL")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            (key, url, haiku, sonnet, opus)
        };

        Ok(ProfileEditData {
            name: row.name,
            api_key,
            base_url,
            haiku_model: haiku,
            sonnet_model: sonnet,
            opus_model: opus,
        })
    }

    pub fn update_api_profile(&self, id: &str, input: CodexApiProfileInput) -> ImportResult {
        match self.update_api_profile_inner(id, input) {
            Ok(result) => result,
            Err(error) => ImportResult::error(error),
        }
    }

    fn update_api_profile_inner(&self, id: &str, input: CodexApiProfileInput) -> Result<ImportResult, String> {
        let row = self
            .db
            .get_account_by_id(id)
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "Account not found".to_string())?;

        if row.kind != AccountKind::ApiKey || row.app != APP_CODEX {
            return Err("Not a Codex API profile".to_string());
        }

        let display_name = clean_name(Some(&input.name))
            .unwrap_or_else(|| "Custom API profile".to_string());
        let profile = api_profile::build_codex_api_profile(&input.api_key, &input.base_url)?;
        let auth_hash = auth_file::hash_auth_json(&profile.auth_hash_material);
        // Bind intermediate Option<String> to a local so as_deref() does not dangle.
        let model = input.model.and_then(|m| clean_name(Some(&m)));

        self.db
            .update_account_profile(
                id,
                &display_name,
                &profile.auth_json,
                &auth_hash,
                Some(&profile.base_url),
                model.as_deref(),
            )
            .map_err(|error| error.to_string())?;

        // If this profile is currently active, refresh the live files immediately.
        if row.is_current {
            let auth_path = paths::codex_auth_path();
            writer::atomic_write(&auth_path, &profile.auth_json)
                .and_then(|_| config::enable_codex_base_url(&profile.base_url))
                .map_err(|error| error.to_string())?;
        }

        let account = self
            .db
            .get_account_by_id(id)
            .map_err(|error| error.to_string())?
            .map(|r| r.into_account());
        Ok(ImportResult::success(account, None))
    }

    pub fn update_claude_profile(&self, id: &str, input: ClaudeProfileInput) -> ImportResult {
        match self.update_claude_profile_inner(id, input) {
            Ok(result) => result,
            Err(error) => ImportResult::error(error),
        }
    }

    fn update_claude_profile_inner(&self, id: &str, input: ClaudeProfileInput) -> Result<ImportResult, String> {
        let row = self
            .db
            .get_account_by_id(id)
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "Account not found".to_string())?;

        if row.kind != AccountKind::ApiKey || row.app != APP_CLAUDE {
            return Err("Not a Claude API profile".to_string());
        }

        let display_name = clean_name(Some(&input.name))
            .unwrap_or_else(|| "Claude API profile".to_string());
        let settings_json = claude_settings::build_claude_settings_json(
            &input.api_key,
            CLAUDE_AUTH_TOKEN_FIELD,
            input.base_url.as_deref(),
            input.haiku_model.as_deref(),
            input.sonnet_model.as_deref(),
            input.opus_model.as_deref(),
        )?;
        let settings_hash = claude_settings::hash_settings(&settings_json);

        // Derive the representative model for the model column (sonnet > opus > haiku).
        let model = input
            .sonnet_model
            .as_ref()
            .or(input.opus_model.as_ref())
            .or(input.haiku_model.as_ref())
            .and_then(|m| clean_name(Some(m)));
        // Bind intermediate Option<String> to locals so as_deref() does not dangle.
        let base = input.base_url.and_then(|u| clean_name(Some(&u)));

        self.db
            .update_account_profile(
                id,
                &display_name,
                &settings_json,
                &settings_hash,
                base.as_deref(),
                model.as_deref(),
            )
            .map_err(|error| error.to_string())?;

        // If currently active, refresh the live settings file immediately.
        if row.is_current {
            let settings_path = claude_paths::claude_settings_path();
            writer::atomic_write(&settings_path, &settings_json)
                .map_err(|error| error.to_string())?;
        }

        let account = self
            .db
            .get_account_by_id(id)
            .map_err(|error| error.to_string())?
            .map(|r| r.into_account());
        Ok(ImportResult::success(account, None))
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

    pub fn get_live_claude_status(&self) -> LiveClaudeStatus {
        let path = claude_paths::claude_settings_path();
        LiveClaudeStatus {
            exists: path.exists(),
            path: path.to_string_lossy().to_string(),
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

        match target.app.as_str() {
            APP_CODEX => self.switch_codex_inner(target),
            APP_CLAUDE => self.switch_claude_inner(target),
            _ => SwitchResult::error("Unknown app type."),
        }
    }

    fn switch_codex_inner(&self, target: crate::db::AccountRow) -> SwitchResult {
        let prev_auth_json: Option<String> = self
            .db
            .get_current_account_row_for_app(APP_CODEX)
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
                } else if current.kind == AccountKind::ApiKey {
                    None
                } else {
                    Some(current.auth_json)
                }
            });

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
            if let Some(prev) = prev_auth_json {
                let _ = writer::atomic_write(&auth_path, &prev);
            }
            return SwitchResult::error(error.to_string());
        }

        self.finish_switch(target, prev_auth_json.as_deref(), &auth_path)
    }

    fn switch_claude_inner(&self, target: crate::db::AccountRow) -> SwitchResult {
        if !is_valid_claude_settings(&target.auth_json) {
            return SwitchResult::error("Claude settings are invalid. Please recreate this Claude profile.");
        }

        let prev_settings: Option<String> = self
            .db
            .get_current_account_row_for_app(APP_CLAUDE)
            .ok()
            .flatten()
            .and_then(|current| {
                if current.id != target.id {
                    if let Ok(Some(live)) = claude_settings::read_live_settings() {
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
                    Some(current.auth_json)
                }
            });

        let settings_path = claude_paths::claude_settings_path();
        if let Err(error) = writer::atomic_write(&settings_path, &target.auth_json) {
            if let Some(prev) = prev_settings {
                let _ = writer::atomic_write(&settings_path, &prev);
            }
            return SwitchResult::error(error.to_string());
        }

        self.finish_switch(target, prev_settings.as_deref(), &settings_path)
    }

    fn finish_switch(&self, target: crate::db::AccountRow, previous_content: Option<&str>, live_path: &std::path::Path) -> SwitchResult {
        match self
            .db
            .set_current_account(&target.id)
            .and_then(|_| self.db.get_account_by_id(&target.id))
        {
            Ok(Some(updated)) => SwitchResult::success(updated.into_account()),
            Ok(None) => SwitchResult::success(target.into_account()),
            Err(error) => {
                if let Some(prev) = previous_content {
                    let _ = writer::atomic_write(live_path, prev);
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

fn is_valid_claude_settings(content: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(content)
        .ok()
        .and_then(|value| value.get("env").and_then(|env| env.as_object()).cloned())
        .map(|env| {
            env.get("ANTHROPIC_AUTH_TOKEN")
                .and_then(|value| value.as_str())
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false)
        })
        .unwrap_or(false)
}

fn clean_name(name: Option<&str>) -> Option<String> {
    let trimmed = name?.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}
