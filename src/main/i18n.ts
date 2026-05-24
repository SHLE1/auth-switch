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
    "notify.switchedTo": "Switched to {name}",
    "updater.checkForUpdates": "Check for Updates…",
    "updater.restartNow": "Restart Now",
    "updater.later": "Later",
    "updater.readyTitle": "Update ready",
    "updater.readyDetail": "auth-switch {version} has been downloaded and will be installed after restart.",
    "updater.devModeTitle": "Updates unavailable in development",
    "updater.devModeDetail": "Update checks only run from packaged release builds.",
    "updater.noUpdateTitle": "auth-switch is up to date",
    "updater.noUpdateDetail": "You are already running the latest available version.",
    "updater.inProgressTitle": "Update check in progress",
    "updater.inProgressDetail": "auth-switch is already checking for updates. Please try again in a moment.",
    "updater.errorTitle": "Update check failed"
  },
  zh: {
    "tray.noAccounts": "未导入账户",
    "tray.addAuth": "添加 auth.json\u2026",
    "tray.importDialogTitle": "导入 Codex auth.json",
    "tray.openWindow": "打开主窗口",
    "tray.quit": "退出 auth-switch",
    "tray.tooltip": "auth-switch — 点击切换账户",
    "notify.switchedTo": "已切换到 {name}",
    "updater.checkForUpdates": "检查更新…",
    "updater.restartNow": "立即重启",
    "updater.later": "稍后",
    "updater.readyTitle": "更新已就绪",
    "updater.readyDetail": "auth-switch {version} 已下载，将在重启后安装。",
    "updater.devModeTitle": "开发模式无法检查更新",
    "updater.devModeDetail": "更新检查只会在打包后的发布版本中运行。",
    "updater.noUpdateTitle": "auth-switch 已是最新版本",
    "updater.noUpdateDetail": "你正在运行当前可用的最新版本。",
    "updater.inProgressTitle": "正在检查更新",
    "updater.inProgressDetail": "auth-switch 已经在检查更新，请稍后再试。",
    "updater.errorTitle": "检查更新失败"
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
