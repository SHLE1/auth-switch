use base64::Engine;
use serde_json::Value;

pub fn parse_auth_json(content: &str) -> Result<Value, String> {
    let parsed: Value = serde_json::from_str(content).map_err(|error| error.to_string())?;
    if !parsed.is_object() {
        return Err("auth.json must contain a JSON object".to_string());
    }
    Ok(parsed)
}

pub fn parse_email(raw: &Value) -> Option<String> {
    let obj = raw.as_object()?;
    let candidates = [
        string_value(obj.get("email")),
        string_value(obj.get("account").and_then(|value| value.get("email"))),
        string_value(obj.get("user").and_then(|value| value.get("email"))),
        string_value(obj.get("profile").and_then(|value| value.get("email"))),
        decode_jwt_email(obj.get("tokens")),
    ];

    candidates.into_iter().flatten().next()
}

fn string_value(value: Option<&Value>) -> Option<String> {
    let trimmed = value?.as_str()?.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn decode_jwt_email(tokens: Option<&Value>) -> Option<String> {
    let id_token = tokens?.get("id_token").and_then(Value::as_str)?.trim();
    if id_token.is_empty() {
        return None;
    }
    let payload = id_token.split('.').nth(1)?;
    let decoded = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(payload).ok()?;
    let parsed: Value = serde_json::from_slice(&decoded).ok()?;
    parsed.get("email").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty()).map(ToOwned::to_owned)
}
