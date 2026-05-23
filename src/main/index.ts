import { app } from "electron";
import { createMainWindow, getMainWindow, setQuitting, showMainWindow } from "./window";
import { registerIpc } from "./ipc";
import { initDatabase } from "./db/database";
import { createTray } from "./tray";

app.whenReady().then(() => {
  initDatabase();
  registerIpc();
  createMainWindow();
  createTray();

  app.on("activate", () => {
    if (!getMainWindow()) {
      createMainWindow();
    }
    showMainWindow();
  });
});

app.on("before-quit", () => {
  setQuitting(true);
});

app.on("window-all-closed", () => {
  // Keep auth-switch resident in the tray/menu bar until the explicit Quit action.
});
