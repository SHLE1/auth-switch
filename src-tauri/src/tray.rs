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


pub fn show_main_window(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);

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
    let locale = service.locale();
    let mut builder = MenuBuilder::new(app);
    builder = builder.item(&MenuItemBuilder::with_id("title", crate::i18n::tray_label(&locale, "app")).enabled(false).build(app).unwrap());
    builder = builder.item(&PredefinedMenuItem::separator(app).unwrap());

    match service.list_accounts() {
        Ok(accounts) if !accounts.is_empty() => {
            let codex_accounts: Vec<_> = accounts.iter().filter(|account| account.app == "codex").collect();
            let has_codex_api = codex_accounts.iter().any(|account| account.kind == crate::models::AccountKind::ApiKey);
            let has_codex_auth = codex_accounts.iter().any(|account| account.kind != crate::models::AccountKind::ApiKey);
            let mut has_codex = false;
            let mut has_claude = false;

            if !codex_accounts.is_empty() {
                has_codex = true;
                builder = builder.item(&MenuItemBuilder::with_id("codex-title", crate::i18n::tray_label(&locale, "codex")).enabled(false).build(app).unwrap());
                if has_codex_api && has_codex_auth {
                    builder = builder.item(&MenuItemBuilder::with_id("codex-auth-title", crate::i18n::tray_label(&locale, "codex_auth")).enabled(false).build(app).unwrap());
                }
                for account in codex_accounts.iter().copied().filter(|account| account.kind != crate::models::AccountKind::ApiKey) {
                    let item = CheckMenuItemBuilder::with_id(format!("switch:{}", account.id), account.name.clone())
                        .checked(account.is_current)
                        .enabled(true)
                        .build(app)
                        .unwrap();
                    builder = builder.item(&item);
                }
                if has_codex_api {
                    if has_codex_auth {
                        builder = builder.item(&PredefinedMenuItem::separator(app).unwrap());
                    }
                    builder = builder.item(&MenuItemBuilder::with_id("codex-api-title", crate::i18n::tray_label(&locale, "codex_api")).enabled(false).build(app).unwrap());
                    for account in codex_accounts.iter().copied().filter(|account| account.kind == crate::models::AccountKind::ApiKey) {
                        let item = CheckMenuItemBuilder::with_id(format!("switch:{}", account.id), account.name.clone())
                            .checked(account.is_current)
                            .enabled(true)
                            .build(app)
                            .unwrap();
                        builder = builder.item(&item);
                    }
                }
            }

            for account in accounts.iter().filter(|account| account.app == "claude") {
                if !has_claude {
                    if has_codex {
                        builder = builder.item(&PredefinedMenuItem::separator(app).unwrap());
                    }
                    builder = builder.item(&MenuItemBuilder::with_id("claude-title", crate::i18n::tray_label(&locale, "claude")).enabled(false).build(app).unwrap());
                    has_claude = true;
                }
                let item = CheckMenuItemBuilder::with_id(format!("switch:{}", account.id), account.name.clone())
                    .checked(account.is_current)
                    .enabled(true)
                    .build(app)
                    .unwrap();
                builder = builder.item(&item);
            }
        }
        _ => {
            builder = builder.item(&MenuItemBuilder::with_id("empty", crate::i18n::tray_label(&locale, "no_accounts")).enabled(false).build(app).unwrap());
        }
    }

    builder = builder.item(&PredefinedMenuItem::separator(app).unwrap());
    builder = builder.item(
        &MenuItemBuilder::with_id("open-window", crate::i18n::tray_label(&locale, "open_window"))
            .accelerator(open_window_accelerator())
            .build(app)
            .unwrap(),
    );
    builder = builder.item(&PredefinedMenuItem::separator(app).unwrap());
    builder = builder.item(
        &MenuItemBuilder::with_id("quit", crate::i18n::tray_label(&locale, "quit"))
            .accelerator(quit_accelerator())
            .build(app)
            .unwrap(),
    );
    builder.build().unwrap()
}
