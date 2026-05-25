import { getDatabase } from "./database";

export function getSetting(key: string): string | null {
  const row = getDatabase()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string | null } | undefined;

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

export interface WindowBoundsSetting {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

const DEFAULT_WINDOW_BOUNDS: WindowBoundsSetting = {
  width: 520,
  height: 640
};

export function getWindowBoundsSetting(): WindowBoundsSetting {
  const raw = getSetting("window_bounds");
  if (!raw) return DEFAULT_WINDOW_BOUNDS;

  try {
    const parsed = JSON.parse(raw) as Partial<WindowBoundsSetting>;
    const width = Number(parsed.width);
    const height = Number(parsed.height);

    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return DEFAULT_WINDOW_BOUNDS;
    }

    return {
      x: typeof parsed.x === "number" && Number.isFinite(parsed.x) ? parsed.x : undefined,
      y: typeof parsed.y === "number" && Number.isFinite(parsed.y) ? parsed.y : undefined,
      width: Math.max(480, Math.round(width)),
      height: Math.max(520, Math.round(height))
    };
  } catch {
    return DEFAULT_WINDOW_BOUNDS;
  }
}

export function setWindowBoundsSetting(bounds: WindowBoundsSetting): void {
  setSetting("window_bounds", JSON.stringify(bounds));
}
