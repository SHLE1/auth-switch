use crate::claude::paths;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::fs;

#[derive(Debug, Clone)]
pub struct ClaudeSettingsSnapshot {
    pub content: String,
    pub hash: String,
}

pub fn build_claude_settings_json(
    api_key: &str,
    _api_key_field: &str,
    base_url: Option<&str>,
    haiku_model: Option<&str>,
    sonnet_model: Option<&str>,
    opus_model: Option<&str>,
) -> Result<String, String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("API key cannot be empty".to_string());
    }

    let mut env = Map::new();
    env.insert("ANTHROPIC_AUTH_TOKEN".to_string(), Value::String(api_key.to_string()));

    if let Some(base_url) = clean_optional(base_url) {
        env.insert("ANTHROPIC_BASE_URL".to_string(), Value::String(base_url));
    }
    if let Some(model) = clean_optional(haiku_model) {
        env.insert("ANTHROPIC_DEFAULT_HAIKU_MODEL".to_string(), Value::String(model));
    }
    if let Some(model) = clean_optional(sonnet_model) {
        env.insert("ANTHROPIC_DEFAULT_SONNET_MODEL".to_string(), Value::String(model));
    }
    if let Some(model) = clean_optional(opus_model) {
        env.insert("ANTHROPIC_DEFAULT_OPUS_MODEL".to_string(), Value::String(model));
    }

    let content = serde_json::to_string_pretty(&json!({ "env": env })).map_err(|error| error.to_string())?;
    Ok(format!("{content}\n"))
}

pub fn hash_settings(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn read_live_settings() -> Result<Option<ClaudeSettingsSnapshot>, String> {
    let path = paths::claude_settings_path();
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let _: Value = serde_json::from_str(&content).map_err(|error| error.to_string())?;
    Ok(Some(ClaudeSettingsSnapshot {
        hash: hash_settings(&content),
        content,
    }))
}

fn clean_optional(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_auth_token_claude_settings() {
        let settings = build_claude_settings_json(" sk-test ", "", None, None, Some("mimo-v2.5-pro"), Some("mimo-v2.5-pro")).unwrap();
        assert!(settings.contains("ANTHROPIC_AUTH_TOKEN"));
        assert!(settings.contains("sk-test"));
        assert!(settings.contains("ANTHROPIC_DEFAULT_SONNET_MODEL"));
        assert!(settings.contains("ANTHROPIC_DEFAULT_OPUS_MODEL"));
        assert!(!settings.contains("ANTHROPIC_API_KEY"));
        assert!(!settings.contains("ANTHROPIC_MODEL"));
    }
}
