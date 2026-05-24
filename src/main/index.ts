import { app, globalShortcut, nativeTheme } from "electron";
import { createMainWindow, getMainWindow, hideMainWindow, setQuitting, showMainWindow } from "./window";
import { registerIpc } from "./ipc";
import { initDatabase } from "./db/database";
import { buildAppMenu } from "./menu";
import { createTray } from "./tray";
import { configureAutoUpdates, scheduleAutomaticUpdateCheck } from "./updater";
import { getMainLogPath, logMain } from "./logger";

process.on("uncaughtException", (error) => {
  logMain("[main] uncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
  logMain("[main] unhandledRejection", reason);
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    logMain("[main] second-instance");
    if (app.isReady()) {
      showMainWindow();
    } else {
      app.whenReady().then(() => showMainWindow()).catch(console.error);
    }
  });

  app.whenReady().then(() => {
    logMain(`[main] ready version=${app.getVersion()} log=${getMainLogPath()}`);
    nativeTheme.themeSource = "dark";
    logMain("[main] init database");
    initDatabase();
    logMain("[main] register ipc/menu/tray");
    registerIpc();
    buildAppMenu();
    createTray();
    void configureAutoUpdates();
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

    createMainWindow();

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
