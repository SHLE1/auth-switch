import { getDatabase } from "./database";

export function getSetting(key: string): string | null {
  const row = getDatabase().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string | null } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string | null): void {
  getDatabase()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export function getBooleanSetting(key: string): boolean {
  return getSetting(key) === "1";
}

export function setBooleanSetting(key: string, value: boolean): void {
  setSetting(key, value ? "1" : "0");
}
