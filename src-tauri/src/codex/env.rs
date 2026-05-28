use std::fs;
use std::io;
use std::path::PathBuf;
use std::process::Command;

const BLOCK_START: &str = "# >>> auth-switch codex api env >>>";
const BLOCK_END: &str = "# <<< auth-switch codex api env <<<";
const DISABLED_PREFIX: &str = "# auth-switch disabled: ";
const ENV_NAMES: [&str; 3] = ["OPENAI_API_KEY", "CODEX_API_KEY", "OPENAI_BASE_URL"];

/// Clean up environment-based profile state used by older auth-switch builds.
/// Current API profiles use auth.json + the managed openai_base_url line in config.toml.
pub fn disable_codex_api_environment() -> io::Result<()> {
    for name in ENV_NAMES {
        std::env::remove_var(name);
    }

    #[cfg(target_os = "macos")]
    for name in ENV_NAMES {
        unset_mac_launch_environment(name);
    }

    #[cfg(windows)]
    {
        for name in ENV_NAMES {
            delete_windows_user_environment(name);
        }
        return Ok(());
    }

    #[cfg(unix)]
    {
        let disabled_block = build_disabled_unix_block();
        for shell_path in get_unix_shell_profile_paths() {
            if shell_path.exists() {
                upsert_managed_block(&shell_path, &disabled_block)?;
            }
        }
    }

    Ok(())
}

#[cfg(unix)]
fn get_unix_shell_profile_paths() -> Vec<PathBuf> {
    let Some(home) = dirs::home_dir() else {
        return Vec::new();
    };
    let current_shell = std::env::var("SHELL")
        .ok()
        .and_then(|shell| PathBuf::from(shell).file_name().map(|name| name.to_string_lossy().to_string()))
        .unwrap_or_default();
    let candidates = if current_shell == "bash" {
        [".bashrc", ".zshrc"]
    } else {
        [".zshrc", ".bashrc"]
    };
    candidates.iter().map(|file| home.join(file)).collect()
}

#[cfg(unix)]
fn build_disabled_unix_block() -> String {
    [
        BLOCK_START.to_string(),
        "# Managed by auth-switch. Environment-based API switching is disabled; config.toml openai_base_url is used instead.".to_string(),
        format!("{}export OPENAI_API_KEY=", DISABLED_PREFIX),
        format!("{}export CODEX_API_KEY=", DISABLED_PREFIX),
        format!("{}export OPENAI_BASE_URL=", DISABLED_PREFIX),
        format!("{}codex shell function removed", DISABLED_PREFIX),
        BLOCK_END.to_string(),
        String::new(),
    ]
    .join("\n")
}

#[cfg(unix)]
fn upsert_managed_block(file_path: &PathBuf, block: &str) -> io::Result<()> {
    let original = fs::read_to_string(file_path).unwrap_or_default();
    let next = replace_managed_block(&original, block);
    fs::write(file_path, next)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(file_path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

#[cfg(unix)]
fn replace_managed_block(content: &str, block: &str) -> String {
    let Some(start) = content.find(BLOCK_START) else {
        return content.to_string();
    };
    let Some(relative_end) = content[start..].find(BLOCK_END) else {
        return content.to_string();
    };
    let end = start + relative_end + BLOCK_END.len();
    let mut replace_end = end;
    if content[replace_end..].starts_with('\n') {
        replace_end += 1;
    }
    format!("{}{}{}", &content[..start], block, &content[replace_end..])
}

#[cfg(windows)]
fn delete_windows_user_environment(name: &str) {
    let _ = Command::new("reg")
        .args(["delete", "HKCU\\Environment", "/F", "/V", name])
        .creation_flags(0x08000000)
        .output();
}

#[cfg(target_os = "macos")]
fn unset_mac_launch_environment(name: &str) {
    let _ = Command::new("launchctl").args(["unsetenv", name]).output();
}

#[cfg(all(windows, not(target_os = "macos")))]
use std::os::windows::process::CommandExt;
