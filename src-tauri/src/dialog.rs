use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

pub async fn pick_auth_json(app: &AppHandle) -> Option<PathBuf> {
    let (tx, mut rx) = tauri::async_runtime::channel(1);
    app.dialog()
        .file()
        .set_title("Import Codex auth.json")
        .add_filter("JSON", &["json"])
        .add_filter("All files", &["*"])
        .pick_file(move |path| {
            let path = path.and_then(|path| path.into_path().ok());
            let _ = tx.try_send(path);
        });
    rx.recv().await.flatten()
}

pub async fn confirm(
    app: &AppHandle,
    title: &str,
    message: &str,
    confirm_label: &str,
    cancel_label: &str,
) -> Result<bool, String> {
    let (tx, mut rx) = tauri::async_runtime::channel(1);
    app.dialog()
        .message(message)
        .title(title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(
            confirm_label.to_string(),
            cancel_label.to_string(),
        ))
        .show(move |confirmed| {
            let _ = tx.try_send(confirmed);
        });
    Ok(rx.recv().await.unwrap_or(false))
}

pub async fn message(app: &AppHandle, title: &str, message: &str, button_label: &str) -> Result<(), String> {
    let (tx, mut rx) = tauri::async_runtime::channel(1);
    app.dialog()
        .message(message)
        .title(title)
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::OkCustom(button_label.to_string()))
        .show(move |_| {
            let _ = tx.try_send(());
        });
    let _ = rx.recv().await;
    Ok(())
}
