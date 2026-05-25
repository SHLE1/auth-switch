import { app, dialog } from "electron";
import { getErrorMessage } from "../shared/errors";
import { tMain } from "./i18n";
import { logMain } from "./logger";
import { setQuitting } from "./window";

type AutoUpdater = typeof import("electron-updater").autoUpdater;

let autoUpdater: AutoUpdater | null = null;
let configurePromise: Promise<AutoUpdater | null> | null = null;
let configured = false;
let checking = false;
let showResultForCurrentCheck = false;

async function loadAutoUpdater(): Promise<AutoUpdater> {
  const updaterPkg = await import("electron-updater");
  const updater = updaterPkg.autoUpdater ?? updaterPkg.default?.autoUpdater;

  if (!updater) {
    throw new Error("electron-updater did not expose autoUpdater");
  }

  return updater;
}

async function ensureAutoUpdatesConfigured(): Promise<AutoUpdater | null> {
  if (configured) return autoUpdater;
  if (configurePromise) return configurePromise;

  configurePromise = (async () => {
    const updater = await loadAutoUpdater();
    autoUpdater = updater;

    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.autoRunAppAfterInstall = true;
    updater.allowPrerelease = false;

    updater.on("checking-for-update", () => {
      checking = true;
    });

    updater.on("update-available", (info) => {
      console.info(`[updater] update available: ${info.version}`);
    });

    updater.on("update-not-available", async (info) => {
      checking = false;
      console.info(`[updater] no update available: ${info.version}`);

      if (showResultForCurrentCheck) {
        showResultForCurrentCheck = false;
        await dialog.showMessageBox({
          type: "info",
          message: tMain("updater.noUpdateTitle"),
          detail: tMain("updater.noUpdateDetail")
        });
      }
    });

    updater.on("download-progress", (progress) => {
      console.info(`[updater] downloading ${progress.percent.toFixed(1)}%`);
    });

    updater.on("update-downloaded", async (info) => {
      checking = false;
      showResultForCurrentCheck = false;

      const result = await dialog.showMessageBox({
        type: "info",
        buttons: [tMain("updater.restartNow"), tMain("updater.later")],
        defaultId: 0,
        cancelId: 1,
        message: tMain("updater.readyTitle"),
        detail: tMain("updater.readyDetail", { version: info.version })
      });

      if (result.response === 0) {
        installDownloadedUpdate(updater);
      }
    });

    updater.on("error", async (error) => {
      checking = false;
      console.error("[updater] update error", error);

      if (showResultForCurrentCheck) {
        showResultForCurrentCheck = false;
        await dialog.showMessageBox({
          type: "error",
          message: tMain("updater.errorTitle"),
          detail: getErrorMessage(error)
        });
      }
    });

    configured = true;
    return updater;
  })().catch((error) => {
    configurePromise = null;
    autoUpdater = null;
    configured = false;
    throw error;
  });

  return configurePromise;
}

function installDownloadedUpdate(updater: AutoUpdater): void {
  logMain("[updater] installing downloaded update");
  setQuitting(true);
  updater.quitAndInstall(false, true);
}

export async function configureAutoUpdates(): Promise<boolean> {
  try {
    await ensureAutoUpdatesConfigured();
    return true;
  } catch (error) {
    logMain("[updater] auto updater unavailable; continuing without update checks", error);
    return false;
  }
}

export function scheduleAutomaticUpdateCheck(): void {
  if (!app.isPackaged) return;

  setTimeout(() => {
    void checkForUpdates({ showNoUpdateDialog: false });
  }, 10_000);
}

export async function checkForUpdates(options: { showNoUpdateDialog?: boolean } = {}): Promise<void> {
  if (!app.isPackaged) {
    if (options.showNoUpdateDialog) {
      await dialog.showMessageBox({
        type: "info",
        message: tMain("updater.devModeTitle"),
        detail: tMain("updater.devModeDetail")
      });
    }
    return;
  }

  const updater = await ensureAutoUpdatesConfigured().catch(async (error) => {
    checking = false;
    showResultForCurrentCheck = false;
    logMain("[updater] auto updater unavailable", error);

    if (options.showNoUpdateDialog) {
      await dialog.showMessageBox({
        type: "error",
        message: tMain("updater.errorTitle"),
        detail: getErrorMessage(error)
      });
    }

    return null;
  });

  if (!updater) return;

  if (checking) {
    if (options.showNoUpdateDialog) {
      await dialog.showMessageBox({
        type: "info",
        message: tMain("updater.inProgressTitle"),
        detail: tMain("updater.inProgressDetail")
      });
    }
    return;
  }

  try {
    checking = true;
    showResultForCurrentCheck = options.showNoUpdateDialog === true;
    await updater.checkForUpdates();
  } catch (error) {
    checking = false;
    showResultForCurrentCheck = false;
    if (options.showNoUpdateDialog) {
      await dialog.showMessageBox({
        type: "error",
        message: tMain("updater.errorTitle"),
        detail: getErrorMessage(error)
      });
    }
  }
}
