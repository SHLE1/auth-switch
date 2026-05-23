import { getSetting, setSetting } from "./db/settings";

export type MainLocale = "en" | "zh";

const TRANSLATIONS: Record<MainLocale, Record<string, string>> = {
  en: {
    "tray.noAccounts": "No accounts imported",
    "tray.addAuth": "Add auth.json\u2026",
    "tray.importDialogTitle": "Import Codex auth.json",
    "tray.openWindow": "Open main window",
    "tray.quit": "Quit auth-switch",
    "tray.tooltip": "auth-switch — click to switch accounts",
    "notify.switchedTo": "Switched to {name}"
  },
  zh: {
    "tray.noAccounts": "未导入账户",
    "tray.addAuth": "添加 auth.json\u2026",
    "tray.importDialogTitle": "导入 Codex auth.json",
    "tray.openWindow": "打开主窗口",
    "tray.quit": "退出 auth-switch",
    "tray.tooltip": "auth-switch — 点击切换账户",
    "notify.switchedTo": "已切换到 {name}"
  }
};

export function getMainLocale(): MainLocale {
  const raw = getSetting("language");
  return raw === "zh" ? "zh" : "en";
}

export function setMainLocale(locale: string): void {
  setSetting("language", locale === "zh" ? "zh" : "en");
}

/** Translate a key for the main/tray process. Supports {placeholder} interpolation. */
export function tMain(key: string, vars?: Record<string, string>): string {
  const locale = getMainLocale();
  let str = TRANSLATIONS[locale][key] ?? TRANSLATIONS.en[key] ?? key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, v);
    }
  }

  return str;
}
