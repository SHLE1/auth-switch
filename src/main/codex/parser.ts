export function parseAuthJson(content: string): Record<string, unknown> {
  const parsed = JSON.parse(content) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("auth.json must contain a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export function parseEmail(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const candidates: Array<() => string | null> = [
    () => str(obj.email),
    () => str((obj.account as Record<string, unknown> | undefined)?.email),
    () => str((obj.user as Record<string, unknown> | undefined)?.email),
    () => str((obj.profile as Record<string, unknown> | undefined)?.email),
    () => decodeJwtEmail(obj.tokens)
  ];

  for (const fn of candidates) {
    const value = fn();
    if (value) return value;
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function decodeJwtEmail(tokens: unknown): string | null {
  if (typeof tokens !== "object" || tokens === null || Array.isArray(tokens)) return null;
  const tokenMap = tokens as Record<string, unknown>;
  const idToken = str(tokenMap.id_token);
  if (!idToken) return null;

  try {
    const parts = idToken.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as unknown;
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
    return str((payload as Record<string, unknown>).email);
  } catch {
    return null;
  }
}
