pub fn tray_label(locale: &str, key: &str) -> &'static str {
    let zh = locale.starts_with("zh");
    match (zh, key) {
        (_, "app") => "auth-switch",
        (_, "codex") => "CODEX",
        (true, "codex_auth") => "订阅 AUTH.JSON",
        (false, "codex_auth") => "SUBSCRIPTION AUTH.JSON",
        (true, "codex_api") => "API 密钥配置文件",
        (false, "codex_api") => "API-KEY PROFILES",
        (_, "claude") => "CLAUDE CODE",
        (true, "no_accounts") => "无账户",
        (false, "no_accounts") => "No accounts",
        (true, "open_window") => "打开窗口",
        (false, "open_window") => "Open Window",
        (true, "quit") => "退出",
        (false, "quit") => "Quit",
        _ => "",
    }
}
