use crate::codex::{parser, paths};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct AuthFileSnapshot {
    pub content: String,
    pub hash: String,
    pub email: Option<String>,
    #[allow(dead_code)]
    pub parsed: Value,
}

pub fn hash_auth_json(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn read_and_validate_auth_file(path: impl AsRef<Path>) -> Result<AuthFileSnapshot, String> {
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let parsed = parser::parse_auth_json(&content)?;
    Ok(AuthFileSnapshot {
        hash: hash_auth_json(&content),
        email: parser::parse_email(&parsed),
        parsed,
        content,
    })
}

pub fn read_live_auth_file() -> Result<Option<AuthFileSnapshot>, String> {
    let auth_path = paths::codex_auth_path();
    if !auth_path.exists() {
        return Ok(None);
    }
    read_and_validate_auth_file(auth_path).map(Some)
}
