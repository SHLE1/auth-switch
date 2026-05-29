use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CredentialStatus {
    Valid,
    Expired,
    NotFound,
    ParseError,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QuotaTier {
    pub name: String,
    pub utilization: f64,
    pub remaining: f64,
    pub resets_at: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AccountUsageQuota {
    pub account_id: String,
    pub credential_status: CredentialStatus,
    pub credential_message: Option<String>,
    pub success: bool,
    pub tiers: Vec<QuotaTier>,
    pub amount: Option<f64>,
    pub unit: Option<String>,
    pub used: Option<f64>,
    pub limit: Option<f64>,
    pub unlimited: bool,
    pub source: Option<String>,
    pub error: Option<String>,
    pub queried_at: Option<i64>,
}

impl AccountUsageQuota {
    pub fn not_found(account_id: &str, message: Option<String>) -> Self {
        Self {
            account_id: account_id.to_string(),
            credential_status: CredentialStatus::NotFound,
            credential_message: message,
            success: false,
            tiers: Vec::new(),
            amount: None,
            unit: None,
            used: None,
            limit: None,
            unlimited: false,
            source: None,
            error: None,
            queried_at: None,
        }
    }

    pub fn error(account_id: &str, status: CredentialStatus, message: String) -> Self {
        Self {
            account_id: account_id.to_string(),
            credential_status: status,
            credential_message: Some(message.clone()),
            success: false,
            tiers: Vec::new(),
            amount: None,
            unit: None,
            used: None,
            limit: None,
            unlimited: false,
            source: None,
            error: Some(message),
            queried_at: Some(now_millis()),
        }
    }
}

#[derive(Deserialize)]
struct CodexAuthJson {
    auth_mode: Option<String>,
    tokens: Option<CodexTokens>,
    last_refresh: Option<String>,
}

#[derive(Deserialize)]
struct CodexTokens {
    access_token: Option<String>,
    account_id: Option<String>,
}

struct CodexCredentials {
    access_token: Option<String>,
    account_id: Option<String>,
    status: CredentialStatus,
    message: Option<String>,
}

#[derive(Deserialize)]
struct CodexRateLimitWindow {
    used_percent: Option<f64>,
    limit_window_seconds: Option<i64>,
    reset_at: Option<i64>,
}

#[derive(Deserialize)]
struct CodexRateLimit {
    primary_window: Option<CodexRateLimitWindow>,
    secondary_window: Option<CodexRateLimitWindow>,
}

#[derive(Deserialize)]
struct CodexUsageResponse {
    rate_limit: Option<CodexRateLimit>,
}

#[derive(Deserialize)]
struct ApiProfileAuthJson {
    #[serde(rename = "OPENAI_API_KEY")]
    openai_api_key: Option<String>,
}
#[derive(Deserialize)]
struct ClaudeProfileSettingsJson {
    env: Option<ClaudeProfileEnv>,
}

#[derive(Deserialize)]
struct ClaudeProfileEnv {
    #[serde(rename = "ANTHROPIC_AUTH_TOKEN")]
    anthropic_auth_token: Option<String>,
}

#[derive(Deserialize)]
struct NewApiSubscriptionResponse {
    soft_limit_usd: Option<f64>,
    hard_limit_usd: Option<f64>,
    system_hard_limit_usd: Option<f64>,
}

#[derive(Deserialize)]
struct NewApiUsageResponse {
    total_usage: Option<f64>,
}

#[derive(Deserialize)]
struct Sub2ApiUsageResponse {
    mode: Option<String>,
    remaining: Option<f64>,
    balance: Option<f64>,
    unit: Option<String>,
    quota: Option<Sub2ApiQuota>,
    rate_limits: Option<Vec<Sub2ApiRateLimit>>,
}

#[derive(Deserialize)]
struct Sub2ApiQuota {
    limit: Option<f64>,
    used: Option<f64>,
    remaining: Option<f64>,
    unit: Option<String>,
}

#[derive(Deserialize)]
struct Sub2ApiRateLimit {
    window: Option<String>,
    limit: Option<f64>,
    remaining: Option<f64>,
    reset_at: Option<String>,
}

pub async fn get_balance_for_claude_profile(account_id: &str, settings_json: &str, base_url: Option<&str>) -> AccountUsageQuota {
    let Some(base_url) = base_url.filter(|value| !value.is_empty()) else {
        return AccountUsageQuota::not_found(account_id, Some("Claude API profile has no base URL".to_string()));
    };
    let parsed: ClaudeProfileSettingsJson = match serde_json::from_str(settings_json) {
        Ok(parsed) => parsed,
        Err(error) => {
            return AccountUsageQuota::error(
                account_id,
                CredentialStatus::ParseError,
                format!("Failed to parse Claude profile settings: {error}"),
            );
        }
    };
    let Some(api_key) = parsed.env.and_then(|env| env.anthropic_auth_token).filter(|value| !value.is_empty()) else {
        return AccountUsageQuota::error(
            account_id,
            CredentialStatus::ParseError,
            "ANTHROPIC_AUTH_TOKEN is empty or missing".to_string(),
        );
    };

    let client = reqwest::Client::new();
    query_sub2api_usage(&client, account_id, base_url, &api_key).await
}

pub async fn get_usage_quota_for_api_profile(account_id: &str, auth_json: &str, base_url: Option<&str>) -> AccountUsageQuota {
    let Some(base_url) = base_url.filter(|value| !value.is_empty()) else {
        return AccountUsageQuota::not_found(account_id, Some("API profile has no base URL".to_string()));
    };
    let parsed: ApiProfileAuthJson = match serde_json::from_str(auth_json) {
        Ok(parsed) => parsed,
        Err(error) => {
            return AccountUsageQuota::error(
                account_id,
                CredentialStatus::ParseError,
                format!("Failed to parse API profile auth.json: {error}"),
            );
        }
    };
    let Some(api_key) = parsed.openai_api_key.filter(|value| !value.is_empty()) else {
        return AccountUsageQuota::error(
            account_id,
            CredentialStatus::ParseError,
            "OPENAI_API_KEY is empty or missing".to_string(),
        );
    };

    let client = reqwest::Client::new();
    let sub2api = query_sub2api_usage(&client, account_id, base_url, &api_key).await;
    if sub2api.success || sub2api.credential_status == CredentialStatus::Expired || looks_like_sub2api_base_url(base_url) {
        return sub2api;
    }

    query_new_api_usage(&client, account_id, base_url, &api_key).await
}


pub async fn get_usage_quota_for_auth_json(account_id: &str, auth_json: &str) -> AccountUsageQuota {
    let creds = parse_codex_credentials(auth_json);
    match creds.status {
        CredentialStatus::NotFound => AccountUsageQuota::not_found(account_id, creds.message),
        CredentialStatus::ParseError => AccountUsageQuota::error(
            account_id,
            CredentialStatus::ParseError,
            creds.message.unwrap_or_else(|| "Failed to parse Codex auth.json".to_string()),
        ),
        CredentialStatus::Expired => {
            if let Some(token) = creds.access_token.as_deref() {
                let result = query_codex_quota(account_id, token, creds.account_id.as_deref()).await;
                if result.success {
                    return result;
                }
            }
            AccountUsageQuota::error(
                account_id,
                CredentialStatus::Expired,
                creds.message.unwrap_or_else(|| "Codex token may be stale".to_string()),
            )
        }
        CredentialStatus::Valid => {
            let Some(token) = creds.access_token.as_deref() else {
                return AccountUsageQuota::error(
                    account_id,
                    CredentialStatus::ParseError,
                    "access_token is empty or missing".to_string(),
                );
            };
            query_codex_quota(account_id, token, creds.account_id.as_deref()).await
        }
    }
}

fn parse_codex_credentials(content: &str) -> CodexCredentials {
    let auth: CodexAuthJson = match serde_json::from_str(content) {
        Ok(auth) => auth,
        Err(error) => {
            return CodexCredentials {
                access_token: None,
                account_id: None,
                status: CredentialStatus::ParseError,
                message: Some(format!("Failed to parse Codex auth.json: {error}")),
            };
        }
    };

    if auth.auth_mode.as_deref() != Some("chatgpt") {
        return CodexCredentials {
            access_token: None,
            account_id: None,
            status: CredentialStatus::NotFound,
            message: Some("Codex account is not a ChatGPT subscription auth profile".to_string()),
        };
    }

    let Some(tokens) = auth.tokens else {
        return CodexCredentials {
            access_token: None,
            account_id: None,
            status: CredentialStatus::ParseError,
            message: Some("No tokens in Codex auth.json".to_string()),
        };
    };

    let Some(access_token) = tokens.access_token.filter(|value| !value.is_empty()) else {
        return CodexCredentials {
            access_token: None,
            account_id: tokens.account_id,
            status: CredentialStatus::ParseError,
            message: Some("access_token is empty or missing".to_string()),
        };
    };

    if auth
        .last_refresh
        .as_deref()
        .is_some_and(is_codex_token_stale)
    {
        return CodexCredentials {
            access_token: Some(access_token),
            account_id: tokens.account_id,
            status: CredentialStatus::Expired,
            message: Some("Codex token may be stale (>8 days since last refresh)".to_string()),
        };
    }

    CodexCredentials {
        access_token: Some(access_token),
        account_id: tokens.account_id,
        status: CredentialStatus::Valid,
        message: None,
    }
}

async fn query_codex_quota(account_id: &str, access_token: &str, chatgpt_account_id: Option<&str>) -> AccountUsageQuota {
    let client = reqwest::Client::new();
    let mut req = client
        .get("https://chatgpt.com/backend-api/wham/usage")
        .bearer_auth(access_token)
        .header("User-Agent", "codex-cli")
        .header("Accept", "application/json");

    if let Some(id) = chatgpt_account_id.filter(|id| !id.is_empty()) {
        req = req.header("ChatGPT-Account-Id", id);
    }

    let resp = match req.timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(resp) => resp,
        Err(error) => {
            return AccountUsageQuota::error(
                account_id,
                CredentialStatus::Valid,
                format!("Network error: {error}"),
            );
        }
    };

    let status = resp.status();
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return AccountUsageQuota::error(
            account_id,
            CredentialStatus::Expired,
            format!("Authentication failed. Please re-login with Codex CLI. (HTTP {status})"),
        );
    }

    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return AccountUsageQuota::error(
            account_id,
            CredentialStatus::Valid,
            format!("API error (HTTP {status}): {body}"),
        );
    }

    let body: CodexUsageResponse = match resp.json().await {
        Ok(body) => body,
        Err(error) => {
            return AccountUsageQuota::error(
                account_id,
                CredentialStatus::Valid,
                format!("Failed to parse API response: {error}"),
            );
        }
    };

    AccountUsageQuota {
        account_id: account_id.to_string(),
        credential_status: CredentialStatus::Valid,
        credential_message: None,
        success: true,
        tiers: parse_tiers(body.rate_limit),
        amount: None,
        unit: None,
        used: None,
        limit: None,
        unlimited: false,
        source: Some("codex_subscription".to_string()),
        error: None,
        queried_at: Some(now_millis()),
    }
}

async fn query_sub2api_usage(client: &reqwest::Client, account_id: &str, base_url: &str, api_key: &str) -> AccountUsageQuota {
    let url = sub2api_usage_url(base_url);
    let resp = match client
        .get(url)
        .bearer_auth(api_key)
        .header("Accept", "application/json")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(resp) => resp,
        Err(error) => {
            return AccountUsageQuota::error(account_id, CredentialStatus::NotFound, format!("sub2api usage unavailable: {error}"));
        }
    };

    let status = resp.status();
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return AccountUsageQuota::error(account_id, CredentialStatus::Expired, format!("API key rejected by sub2api usage endpoint (HTTP {status})"));
    }
    if !status.is_success() {
        return AccountUsageQuota::not_found(account_id, Some(format!("sub2api usage endpoint returned HTTP {status}")));
    }

    let body: Sub2ApiUsageResponse = match resp.json().await {
        Ok(body) => body,
        Err(error) => {
            return AccountUsageQuota::not_found(account_id, Some(format!("Failed to parse sub2api usage response: {error}")));
        }
    };

    let mut tiers = Vec::new();
    if let Some(rate_limits) = body.rate_limits {
        for item in rate_limits {
            if let (Some(window), Some(limit), Some(remaining)) = (item.window, item.limit, item.remaining) {
                if limit > 0.0 {
                    tiers.push(QuotaTier {
                        name: window,
                        utilization: clamp_percent(((limit - remaining).max(0.0) / limit) * 100.0),
                        remaining: clamp_percent((remaining.max(0.0) / limit) * 100.0),
                        resets_at: item.reset_at,
                    });
                }
            }
        }
    }

    let (amount, used, limit, unit) = if let Some(quota) = body.quota {
        (quota.remaining, quota.used, quota.limit, quota.unit.or(body.unit))
    } else {
        (body.remaining.or(body.balance), None, None, body.unit)
    };

    AccountUsageQuota {
        account_id: account_id.to_string(),
        credential_status: CredentialStatus::Valid,
        credential_message: body.mode,
        success: amount.is_some() || !tiers.is_empty(),
        tiers,
        amount,
        unit,
        used,
        limit,
        unlimited: limit.is_none(),
        source: Some("sub2api".to_string()),
        error: None,
        queried_at: Some(now_millis()),
    }
}

async fn query_new_api_usage(client: &reqwest::Client, account_id: &str, base_url: &str, api_key: &str) -> AccountUsageQuota {
    let subscription_url = balance_url(base_url, "/dashboard/billing/subscription");
    let usage_url = balance_url(base_url, "/dashboard/billing/usage");

    let subscription_resp = match client
        .get(subscription_url)
        .bearer_auth(api_key)
        .header("Accept", "application/json")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(resp) => resp,
        Err(error) => return AccountUsageQuota::error(account_id, CredentialStatus::NotFound, format!("Balance endpoint unavailable: {error}")),
    };

    let status = subscription_resp.status();
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return AccountUsageQuota::error(account_id, CredentialStatus::Expired, format!("API key rejected by new-api balance endpoint (HTTP {status})"));
    }
    if !status.is_success() {
        return AccountUsageQuota::error(account_id, CredentialStatus::NotFound, format!("No supported balance endpoint found (HTTP {status})"));
    }

    let subscription: NewApiSubscriptionResponse = match subscription_resp.json().await {
        Ok(body) => body,
        Err(error) => return AccountUsageQuota::error(account_id, CredentialStatus::ParseError, format!("Failed to parse new-api subscription response: {error}")),
    };

    let used = match client
        .get(usage_url)
        .bearer_auth(api_key)
        .header("Accept", "application/json")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => resp.json::<NewApiUsageResponse>().await.ok().and_then(|body| body.total_usage).map(|value| value / 100.0),
        _ => None,
    };

    let limit = subscription
        .system_hard_limit_usd
        .filter(|value| *value > 0.0)
        .or(subscription.hard_limit_usd.filter(|value| *value > 0.0))
        .or(subscription.soft_limit_usd.filter(|value| *value > 0.0));
    let amount = match (limit, used) {
        (Some(limit), Some(used)) => Some((limit - used).max(0.0)),
        (Some(limit), None) => Some(limit),
        _ => None,
    };

    AccountUsageQuota {
        account_id: account_id.to_string(),
        credential_status: CredentialStatus::Valid,
        credential_message: None,
        success: amount.is_some(),
        tiers: Vec::new(),
        amount,
        unit: Some("USD".to_string()),
        used,
        limit,
        unlimited: limit.is_none(),
        source: Some("new-api".to_string()),
        error: None,
        queried_at: Some(now_millis()),
    }
}

fn balance_url(base_url: &str, path: &str) -> String {
    let root = provider_root_url(base_url);
    format!("{}{}", root, path)
}

fn sub2api_usage_url(base_url: &str) -> String {
    let trimmed = base_url.trim_end_matches('/');
    if trimmed.ends_with("/v1") {
        format!("{}/usage", trimmed)
    } else {
        format!("{}/v1/usage", trimmed)
    }
}

fn provider_root_url(base_url: &str) -> &str {
    let trimmed = base_url.trim_end_matches('/');
    trimmed.strip_suffix("/v1").unwrap_or(trimmed)
}

fn looks_like_sub2api_base_url(base_url: &str) -> bool {
    let lower = base_url.to_ascii_lowercase();
    lower.contains("sub2api")
}
fn parse_tiers(rate_limit: Option<CodexRateLimit>) -> Vec<QuotaTier> {
    let Some(rate_limit) = rate_limit else {
        return Vec::new();
    };

    [rate_limit.primary_window, rate_limit.secondary_window]
        .into_iter()
        .flatten()
        .filter_map(|window| {
            let utilization = clamp_percent(window.used_percent?);
            Some(QuotaTier {
                name: window
                    .limit_window_seconds
                    .map(window_seconds_to_tier_name)
                    .unwrap_or_else(|| "unknown".to_string()),
                utilization,
                remaining: 100.0 - utilization,
                resets_at: window.reset_at.and_then(unix_ts_to_iso),
            })
        })
        .collect()
}

fn clamp_percent(value: f64) -> f64 {
    if value.is_nan() {
        0.0
    } else {
        value.clamp(0.0, 100.0)
    }
}

fn window_seconds_to_tier_name(secs: i64) -> String {
    match secs {
        18_000 => "five_hour".to_string(),
        604_800 => "seven_day".to_string(),
        secs => {
            let hours = secs / 3_600;
            if hours >= 24 {
                format!("{}_day", hours / 24)
            } else {
                format!("{}_hour", hours)
            }
        }
    }
}

fn unix_ts_to_iso(ts: i64) -> Option<String> {
    chrono::DateTime::from_timestamp(ts, 0).map(|dt| dt.to_rfc3339())
}

fn is_codex_token_stale(last_refresh: &str) -> bool {
    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    chrono::DateTime::parse_from_rfc3339(last_refresh)
        .ok()
        .map(|dt| now_secs.saturating_sub(dt.timestamp() as u64) > 8 * 24 * 3_600)
        .unwrap_or(false)
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_chatgpt_credentials() {
        let creds = parse_codex_credentials(
            r#"{
                "auth_mode": "chatgpt",
                "tokens": { "access_token": "token", "account_id": "acct" },
                "last_refresh": "2999-01-01T00:00:00Z"
            }"#,
        );

        assert_eq!(creds.status, CredentialStatus::Valid);
        assert_eq!(creds.access_token.as_deref(), Some("token"));
        assert_eq!(creds.account_id.as_deref(), Some("acct"));
    }

    #[test]
    fn rejects_api_key_profiles_without_querying() {
        let creds = parse_codex_credentials(r#"{"auth_mode":"apikey","OPENAI_API_KEY":"sk"}"#);

        assert_eq!(creds.status, CredentialStatus::NotFound);
        assert!(creds.access_token.is_none());
    }

    #[test]
    fn maps_windows_and_remaining_percentages() {
        let tiers = parse_tiers(Some(CodexRateLimit {
            primary_window: Some(CodexRateLimitWindow {
                used_percent: Some(25.5),
                limit_window_seconds: Some(18_000),
                reset_at: Some(1_700_000_000),
            }),
            secondary_window: Some(CodexRateLimitWindow {
                used_percent: Some(110.0),
                limit_window_seconds: Some(604_800),
                reset_at: None,
            }),
        }));

        assert_eq!(tiers.len(), 2);
        assert_eq!(tiers[0].name, "five_hour");
        assert_eq!(tiers[0].utilization, 25.5);
        assert_eq!(tiers[0].remaining, 74.5);
        assert_eq!(tiers[1].name, "seven_day");
        assert_eq!(tiers[1].utilization, 100.0);
        assert_eq!(tiers[1].remaining, 0.0);
    }

    #[test]
    fn builds_provider_balance_urls() {
        assert_eq!(sub2api_usage_url("https://api.example.com"), "https://api.example.com/v1/usage");
        assert_eq!(sub2api_usage_url("https://api.example.com/v1"), "https://api.example.com/v1/usage");
        assert_eq!(balance_url("https://api.example.com/v1", "/dashboard/billing/subscription"), "https://api.example.com/dashboard/billing/subscription");
    }
}
