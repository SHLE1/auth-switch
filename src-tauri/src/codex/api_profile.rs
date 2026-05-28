use serde_json::json;
use url::Url;

pub struct CodexApiProfile {
    pub auth_json: String,
    pub auth_hash_material: String,
    pub base_url: String,
}

pub fn build_codex_api_profile(api_key: &str, base_url: &str) -> Result<CodexApiProfile, String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("API key cannot be empty".into());
    }
    let base_url = normalize_http_url(base_url, "Base URL")?;
    let auth_json = format!(
        "{}\n",
        serde_json::to_string_pretty(&json!({
            "auth_mode": "apikey",
            "OPENAI_API_KEY": api_key
        }))
        .map_err(|error| error.to_string())?
    );
    Ok(CodexApiProfile {
        auth_json,
        auth_hash_material: format!("{}\n{}", api_key, base_url),
        base_url,
    })
}

fn normalize_http_url(value: &str, label: &str) -> Result<String, String> {
    let trimmed = value.trim().split_whitespace().collect::<String>();
    if trimmed.is_empty() {
        return Err(format!("{} cannot be empty", label));
    }
    let parsed = Url::parse(&trimmed).map_err(|_| format!("{} must be a valid URL", label))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(format!("{} must start with http:// or https://", label));
    }
    Ok(trimmed.trim_end_matches('/').to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_api_keys() {
        assert!(build_codex_api_profile("   ", "https://example.com/v1").is_err());
    }

    #[test]
    fn normalizes_trailing_slashes_from_base_urls() {
        let profile = build_codex_api_profile("sk-test", " https://example.com/v1/// ").unwrap();
        assert_eq!(profile.base_url, "https://example.com/v1");
        assert!(profile.auth_json.contains("OPENAI_API_KEY"));
    }
}
