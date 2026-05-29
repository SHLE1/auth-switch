use crate::accounts_service::AccountsService;
use crate::models::AccountUsageQuota;
use crate::models::{Account, ClaudeProfileInput, CodexApiProfileInput, ImportResult, LiveAuthStatus, LiveClaudeStatus, ProfileEditData, SwitchResult};
use tauri::{AppHandle, Emitter, Manager, State};

#[tauri::command]
pub fn get_accounts(service: State<'_, AccountsService>) -> Result<Vec<Account>, String> {
    service.list_accounts()
}

#[tauri::command]
pub fn get_current_account(service: State<'_, AccountsService>) -> Result<Option<Account>, String> {
    service.current_account()
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
pub async fn import_auth_file(app: AppHandle) -> Result<ImportResult, String> {
    let Some(path) = crate::dialog::pick_auth_json(&app).await else {
        return Ok(ImportResult::cancelled());
    };
    let service = app.state::<AccountsService>();
    let result = service.import_auth_file_from_path(path.to_string_lossy().as_ref(), None, false);
    if result.success {
        crate::tray::rebuild_tray_menu(&app, &service);
        let _ = app.emit("accounts-changed", ());
    }
    Ok(result)
}

#[tauri::command]
pub fn import_auth_json_content(app: AppHandle, service: State<'_, AccountsService>, content: String) -> ImportResult {
    let result = service.import_auth_json_content(content, None, false);
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
pub fn create_claude_profile(app: AppHandle, service: State<'_, AccountsService>, input: ClaudeProfileInput) -> ImportResult {
    let result = service.create_claude_profile(input);
    if result.success {
        crate::tray::rebuild_tray_menu(&app, &service);
        let _ = app.emit("accounts-changed", ());
    }
    result
}

#[tauri::command]
pub fn import_live_auth_file(
    app: AppHandle,
    service: State<'_, AccountsService>,
    name: Option<String>,
    set_current: Option<bool>,
) -> ImportResult {
    let result = service.import_live_auth_file(name, set_current.unwrap_or(true));
    if result.success {
        crate::tray::rebuild_tray_menu(&app, &service);
        let _ = app.emit("accounts-changed", ());
    }
    result
}

#[tauri::command]
pub fn rename_account(app: AppHandle, service: State<'_, AccountsService>, id: String, name: String) -> Result<(), String> {
    service.rename_account(&id, &name)?;
    crate::tray::rebuild_tray_menu(&app, &service);
    let _ = app.emit("accounts-changed", ());
    Ok(())
}

#[tauri::command]
pub fn delete_account(app: AppHandle, service: State<'_, AccountsService>, id: String) -> Result<(), String> {
    service.remove_account(&id)?;
    crate::tray::rebuild_tray_menu(&app, &service);
    let _ = app.emit("accounts-changed", ());
    Ok(())
}

#[tauri::command]
pub async fn native_confirm(
    app: AppHandle,
    title: String,
    message: String,
    confirm_label: String,
    cancel_label: String,
) -> Result<bool, String> {
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
pub fn get_live_claude_status(service: State<'_, AccountsService>) -> LiveClaudeStatus {
    service.get_live_claude_status()
}

#[tauri::command]
pub fn dismiss_first_run(service: State<'_, AccountsService>) -> Result<(), String> {
    service.set_bool_setting("first_run_done", true)
}

#[tauri::command]
pub fn should_show_first_run(service: State<'_, AccountsService>) -> Result<bool, String> {
    service.get_bool_setting("first_run_done").map(|done| !done)
}

#[tauri::command]
pub fn set_language(app: AppHandle, service: State<'_, AccountsService>, locale: String) -> Result<(), String> {
    service.set_locale(&locale)?;
    crate::tray::rebuild_tray_menu(&app, &service);
    Ok(())
}

#[tauri::command]
pub fn get_profile_edit_data(service: State<'_, AccountsService>, id: String) -> Result<ProfileEditData, String> {
    service.get_profile_edit_data(&id)
}

#[tauri::command]
pub fn update_api_profile(app: AppHandle, service: State<'_, AccountsService>, id: String, input: CodexApiProfileInput) -> ImportResult {
    let result = service.update_api_profile(&id, input);
    if result.success {
        let _ = app.emit("accounts-changed", ());
    }
    result
}

#[tauri::command]
pub fn update_claude_profile(app: AppHandle, service: State<'_, AccountsService>, id: String, input: ClaudeProfileInput) -> ImportResult {
    let result = service.update_claude_profile(&id, input);
    if result.success {
        let _ = app.emit("accounts-changed", ());
    }
    result
}

#[tauri::command]
pub async fn get_account_usage_quota(service: State<'_, AccountsService>, id: String) -> Result<AccountUsageQuota, String> {
    service.get_account_usage_quota(&id).await
}
