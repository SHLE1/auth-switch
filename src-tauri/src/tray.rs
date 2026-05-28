use crate::accounts_service::AccountsService;
use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

pub fn create_tray(app: &AppHandle, service: &AccountsService) {
    let menu = build_menu(app, service);
    let Ok(icon) = tauri::image::Image::from_bytes(include_bytes!("../../assets/tray-icon.png")) else {
        eprintln!("auth-switch tray icon is required");
        return;
    };
    let _ = TrayIconBuilder::with_id("main-tray")
        .tooltip("auth-switch")
        .icon(icon)
        .icon_as_template(true)
        .menu(&menu)
        .on_tray_icon_event(|tray, event| {
            let _ = &tray;
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
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

pub fn handle_menu_event(app: &AppHandle, id: &str) {
    match id {
        "open-window" => show_main_window(app),
        "add-auth" => add_auth_from_tray(app.clone()),
        "quit" => app.exit(0),
        other if other.starts_with("switch:") => {
            let account_id = other.trim_start_matches("switch:").to_string();
            let service = app.state::<AccountsService>();
            let result = service.switch_account(&account_id);
            if result.success {
                rebuild_tray_menu(app, &service);
                let _ = app.emit("accounts-changed", ());
                if result.already_current != Some(true) {
                    if let Some(account) = result.account.as_ref() {
                        crate::notifications::notify(app, "auth-switch", &format!("Switched to {}.", account.name));
                    }
                }
            } else if let Some(error) = result.error.as_ref() {
                crate::notifications::notify(app, "auth-switch", error);
            }
        }
        _ => {}
    }
}

fn add_auth_from_tray(app: AppHandle) {
    show_main_window(&app);
    tauri::async_runtime::spawn(async move {
        let Some(path) = crate::dialog::pick_auth_json(&app).await else {
            return;
        };
        let service = app.state::<AccountsService>();
        let result = service.import_auth_file_from_path(path.to_string_lossy().as_ref(), None, false);
        if result.success {
            rebuild_tray_menu(&app, &service);
            let _ = app.emit("accounts-changed", ());
        } else if !result.cancelled.unwrap_or(false) {
            if let Some(error) = result.error.as_ref() {
                crate::notifications::notify(&app, "auth-switch", error);
            }
        }
    });
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn open_window_accelerator() -> &'static str {
    if cfg!(target_os = "macos") {
        "Command+,"
    } else {
        "Ctrl+W"
    }
}

fn quit_accelerator() -> &'static str {
    if cfg!(target_os = "macos") {
        "Command+Q"
    } else {
        "Ctrl+Q"
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
    builder = builder.item(
        &MenuItemBuilder::with_id("open-window", "Open Window")
            .accelerator(open_window_accelerator())
            .build(app)
            .unwrap(),
    );
    builder = builder.item(&PredefinedMenuItem::separator(app).unwrap());
    builder = builder.item(
        &MenuItemBuilder::with_id("quit", "Quit")
            .accelerator(quit_accelerator())
            .build(app)
            .unwrap(),
    );
    builder.build().unwrap()
}
