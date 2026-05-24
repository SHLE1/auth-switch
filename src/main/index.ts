import { app, globalShortcut, nativeTheme } from "electron";
import { createMainWindow, getMainWindow, hideMainWindow, setQuitting, showMainWindow } from "./window";
import { registerIpc } from "./ipc";
import { initDatabase } from "./db/database";
import { getBooleanSetting } from "./db/settings";
import { listAccounts } from "./services/accountsService";
import { buildAppMenu } from "./menu";
import { createTray } from "./tray";
import { configureAutoUpdates, scheduleAutomaticUpdateCheck } from "./updater";

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (app.isReady()) {
      showMainWindow();
    } else {
      app.whenReady().then(() => showMainWindow()).catch(console.error);
    }
  });

  app.whenReady().then(() => {
    nativeTheme.themeSource = "dark";
    initDatabase();
    registerIpc();
    buildAppMenu();
    createTray();
    configureAutoUpdates();
    scheduleAutomaticUpdateCheck();

    // Windows: app menu is null so no accelerators work. Register global shortcuts
    // to give users keyboard access to primary tray actions.
    if (process.platform === "win32") {
      globalShortcut.register("Ctrl+Q", () => {
        setQuitting(true);
        app.quit();
      });
      globalShortcut.register("Ctrl+W", () => {
        hideMainWindow();
      });
    }

    const firstRunDone = getBooleanSetting("first_run_done");
    const hasAccounts = listAccounts().length > 0;

    if (!firstRunDone || !hasAccounts) {
      createMainWindow();
    } else if (process.platform === "darwin") {
      app.dock?.hide();
    }

    app.on("activate", () => {
      if (!getMainWindow()) {
        createMainWindow();
      }
      showMainWindow();
    });
  });
}

app.on("before-quit", () => {
  setQuitting(true);
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  // Keep auth-switch resident in the tray/menu bar until the explicit Quit action.
});
