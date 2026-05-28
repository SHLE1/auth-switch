use crate::codex::paths;
use std::fs;
use std::io;
use std::path::Path;

const KEY: &str = "openai_base_url";
const MANAGED_MARKER: &str = "# auth-switch managed";
const PREVIOUS_PREFIX: &str = "# auth-switch previous: ";

pub fn enable_codex_base_url(base_url: &str) -> io::Result<()> {
    let trimmed = base_url.trim();
    if trimmed.is_empty() {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "Base URL cannot be empty"));
    }

    let config_path = paths::codex_config_path();
    let original = fs::read_to_string(&config_path).unwrap_or_default();
    let next = set_managed_openai_base_url(&original, trimmed);
    write_config(&config_path, &next)
}

pub fn disable_codex_base_url() -> io::Result<()> {
    let config_path = paths::codex_config_path();
    if !config_path.exists() {
        return Ok(());
    }

    let original = fs::read_to_string(&config_path)?;
    let next = comment_managed_openai_base_url(&original);
    if next != original {
        write_config(&config_path, &next)?;
    }
    Ok(())
}

pub fn set_managed_openai_base_url(content: &str, base_url: &str) -> String {
    let mut lines = split_lines(content);
    let managed_index = lines
        .iter()
        .position(|line| is_openai_base_url_line(line) && line.contains(MANAGED_MARKER));
    let replacement = format!("{} = \"{}\" {}", KEY, escape_toml_string(base_url), MANAGED_MARKER);

    if let Some(index) = managed_index {
        lines[index] = replacement;
        return join_lines(&lines, content);
    }

    if let Some(active_index) = lines.iter().position(|line| is_active_openai_base_url_line(line)) {
        lines[active_index] = format!("{}{}", PREVIOUS_PREFIX, lines[active_index]);
        lines.insert(active_index + 1, replacement);
        return join_lines(&lines, content);
    }

    if let Some(insertion_index) = first_non_comment_top_level_index(&lines) {
        lines.insert(insertion_index, replacement);
    } else {
        if !lines.is_empty() && lines.last().is_some_and(|line| !line.is_empty()) {
            lines.push(String::new());
        }
        lines.push(replacement);
    }

    join_lines(&lines, content)
}

pub fn comment_managed_openai_base_url(content: &str) -> String {
    let mut lines = split_lines(content);
    let Some(managed_index) = lines
        .iter()
        .position(|line| is_openai_base_url_line(line) && line.contains(MANAGED_MARKER))
    else {
        return content.to_string();
    };

    if lines[managed_index].trim_start().starts_with('#') {
        return content.to_string();
    }

    lines[managed_index] = format!("# {}", lines[managed_index]);
    join_lines(&lines, content)
}

fn write_config(config_path: &Path, content: &str) -> io::Result<()> {
    if let Some(dir) = config_path.parent() {
        fs::create_dir_all(dir)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(dir, fs::Permissions::from_mode(0o700))?;
        }
    }
    fs::write(config_path, content)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(config_path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

fn split_lines(content: &str) -> Vec<String> {
    if content.is_empty() {
        Vec::new()
    } else {
        content.replace("\r\n", "\n").split('\n').map(ToOwned::to_owned).collect()
    }
}

fn join_lines(lines: &[String], original: &str) -> String {
    let result = lines.join("\n");
    if result.is_empty() {
        String::new()
    } else if original.ends_with('\n') || result.ends_with('\n') {
        result
    } else {
        format!("{}\n", result)
    }
}

fn is_openai_base_url_line(line: &str) -> bool {
    let trimmed = line.trim_start();
    let without_comment = trimmed.strip_prefix('#').map(str::trim_start).unwrap_or(trimmed);
    without_comment.starts_with(KEY) && without_comment[KEY.len()..].trim_start().starts_with('=')
}

fn is_active_openai_base_url_line(line: &str) -> bool {
    let trimmed = line.trim_start();
    trimmed.starts_with(KEY) && trimmed[KEY.len()..].trim_start().starts_with('=')
}

fn first_non_comment_top_level_index(lines: &[String]) -> Option<usize> {
    lines.iter().position(|line| {
        let trimmed = line.trim();
        !trimmed.is_empty() && !trimmed.starts_with('#') && !trimmed.starts_with('[')
    })
}

fn escape_toml_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_managed_openai_base_url_preserves_previous_active_line() {
        let original = "model = \"gpt\"\nopenai_base_url = \"https://old.example/v1\"\n[profiles.foo]\nmodel = \"bar\"\n";
        let next = set_managed_openai_base_url(original, "https://new.example/v1");
        assert!(next.contains("# auth-switch previous: openai_base_url = \"https://old.example/v1\""));
        assert!(next.contains("openai_base_url = \"https://new.example/v1\" # auth-switch managed"));
        assert!(next.contains("[profiles.foo]"));
    }

    #[test]
    fn comment_managed_openai_base_url_comments_only_managed_line() {
        let original = "# note\nopenai_base_url = \"https://managed.example/v1\" # auth-switch managed\n# auth-switch previous: openai_base_url = \"https://old.example/v1\"\nother = true\n";
        let next = comment_managed_openai_base_url(original);
        assert!(next.contains("# openai_base_url = \"https://managed.example/v1\" # auth-switch managed"));
        assert!(next.contains("# auth-switch previous: openai_base_url = \"https://old.example/v1\""));
        assert!(next.contains("other = true"));
    }
}
