use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct Account {
    pub id: String,
    pub app: String,
    pub name: String,
    pub email: Option<String>,
    pub kind: AccountKind,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub is_current: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_used_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AccountKind {
    AuthJson,
    ApiKey,
}

impl AccountKind {
    pub fn as_db_value(&self) -> &'static str {
        match self {
            Self::AuthJson => "auth_json",
            Self::ApiKey => "api_key",
        }
    }

    pub fn from_db_value(value: &str) -> Self {
        if value == "api_key" {
            Self::ApiKey
        } else {
            Self::AuthJson
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexApiProfileInput {
    pub name: String,
    pub api_key: String,
    pub base_url: String,
    pub model: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeProfileInput {
    pub name: String,
    pub api_key: String,
    #[allow(dead_code)]
    pub api_key_field: Option<String>,
    pub base_url: Option<String>,
    pub haiku_model: Option<String>,
    pub sonnet_model: Option<String>,
    pub opus_model: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub already_current: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account: Option<Account>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cancelled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duplicate: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub same_email_exists: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account: Option<Account>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl SwitchResult {
    pub fn success(account: Account) -> Self {
        Self {
            success: true,
            already_current: None,
            error: None,
            account: Some(account),
        }
    }

    pub fn already_current(account: Account) -> Self {
        Self {
            success: true,
            already_current: Some(true),
            error: None,
            account: Some(account),
        }
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self {
            success: false,
            already_current: None,
            error: Some(message.into()),
            account: None,
        }
    }
}

impl ImportResult {
    pub fn success(account: Option<Account>, same_email_exists: Option<bool>) -> Self {
        Self {
            success: true,
            cancelled: None,
            duplicate: None,
            same_email_exists,
            account,
            error: None,
        }
    }

    pub fn cancelled() -> Self {
        Self {
            success: false,
            cancelled: Some(true),
            duplicate: None,
            same_email_exists: None,
            account: None,
            error: None,
        }
    }

    pub fn duplicate(message: impl Into<String>) -> Self {
        Self {
            success: false,
            cancelled: None,
            duplicate: Some(true),
            same_email_exists: None,
            account: None,
            error: Some(message.into()),
        }
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self {
            success: false,
            cancelled: None,
            duplicate: None,
            same_email_exists: None,
            account: None,
            error: Some(message.into()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveAuthStatus {
    pub exists: bool,
    pub hash: Option<String>,
    pub email: Option<String>,
    pub path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveClaudeStatus {
    pub exists: bool,
    pub path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileEditData {
    pub name: String,
    pub api_key: String,
    pub base_url: String,
    /// Haiku model alias (Claude profiles only; empty string if absent)
    pub haiku_model: String,
    /// Sonnet model alias (Claude profiles only; empty string if absent)
    pub sonnet_model: String,
    /// Opus model alias (Claude profiles only; empty string if absent)
    pub opus_model: String,
}
