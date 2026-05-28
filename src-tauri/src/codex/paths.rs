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
    codex_auth_path()
        .parent()
        .expect("auth path has parent")
        .to_path_buf()
}

pub fn codex_config_path() -> PathBuf {
    codex_dir().join("config.toml")
}
