export interface CodexApiProfile {
  authJson: string;
  authHashMaterial: string;
  baseUrl: string;
}

export function buildCodexApiProfile(input: { apiKey: string; baseUrl: string }): CodexApiProfile {
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new Error("API key cannot be empty");

  const baseUrl = normalizeHttpUrl(input.baseUrl, "Base URL");
  const authJson = `${JSON.stringify({ auth_mode: "apikey", OPENAI_API_KEY: apiKey }, null, 2)}\n`;

  return {
    authJson,
    authHashMaterial: `${apiKey}\n${baseUrl}`,
    baseUrl
  };
}

function normalizeHttpUrl(value: string, label: string): string {
  const trimmed = value.trim().replace(/\s+/g, "");
  if (!trimmed) throw new Error(`${label} cannot be empty`);

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must start with http:// or https://`);
  }

  return trimmed.replace(/\/+$/, "");
}
