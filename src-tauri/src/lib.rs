mod accounts_service;
mod claude;
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
            tray::show_main_window(app);
        }))
        .manage(AccountsService::new().expect("failed to initialize auth-switch service"))
        .invoke_handler(tauri::generate_handler![
            commands::get_accounts,
            commands::get_current_account,
            commands::switch_account,
            commands::import_auth_file,
            commands::import_auth_json_content,
            commands::create_api_profile,
            commands::create_claude_profile,
            commands::import_live_auth_file,
            commands::rename_account,
            commands::delete_account,
            commands::native_confirm,
            commands::native_message,
            commands::get_live_auth_status,
            commands::get_live_claude_status,
            commands::dismiss_first_run,
            commands::should_show_first_run,
            commands::get_profile_edit_data,
            commands::update_api_profile,
            commands::update_claude_profile,
            commands::set_language
        ])
        .setup(|app| {
            let service = app.state::<AccountsService>();
            tray::create_tray(app.handle(), &service);
            tray::show_main_window(app.handle());
            Ok(())
        })
        .on_menu_event(|app, event| {
            tray::handle_menu_event(app, event.id().as_ref());
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                    #[cfg(target_os = "macos")]
                    let _ = window
                        .app_handle()
                        .set_activation_policy(tauri::ActivationPolicy::Accessory);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running auth-switch");
}
