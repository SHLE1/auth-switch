import { app, dialog } from "electron";
import updaterPkg from "electron-updater";
import { tMain } from "./i18n";

const { autoUpdater } = updaterPkg;

let configured = false;
let checking = false;
let showResultForCurrentCheck = false;

export function configureAutoUpdates(): void {
  if (configured) return;
  configured = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => {
    checking = true;
  });

  autoUpdater.on("update-available", (info) => {
    console.info(`[updater] update available: ${info.version}`);
  });

  autoUpdater.on("update-not-available", async (info) => {
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

  autoUpdater.on("download-progress", (progress) => {
    console.info(`[updater] downloading ${progress.percent.toFixed(1)}%`);
  });

  autoUpdater.on("update-downloaded", async (info) => {
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
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on("error", async (error) => {
    checking = false;
    console.error("[updater] update error", error);

    if (showResultForCurrentCheck) {
      showResultForCurrentCheck = false;
      await dialog.showMessageBox({
        type: "error",
        message: tMain("updater.errorTitle"),
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

export function scheduleAutomaticUpdateCheck(): void {
  if (!app.isPackaged) return;

  setTimeout(() => {
    void checkForUpdates({ showNoUpdateDialog: false });
  }, 10_000);
}

export async function checkForUpdates(options: { showNoUpdateDialog?: boolean } = {}): Promise<void> {
  configureAutoUpdates();

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
    await autoUpdater.checkForUpdates();
  } catch (error) {
    checking = false;
    showResultForCurrentCheck = false;
    if (options.showNoUpdateDialog) {
      await dialog.showMessageBox({
        type: "error",
        message: tMain("updater.errorTitle"),
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

