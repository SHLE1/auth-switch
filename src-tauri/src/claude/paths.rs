use std::path::PathBuf;

pub fn claude_settings_path() -> PathBuf {
    dirs::home_dir()
        .expect("home directory unavailable")
        .join(".claude")
        .join("settings.json")
}

