import { dialog, ipcMain } from "electron";
import { getBooleanSetting, setBooleanSetting } from "./db/settings";
import { setMainLocale, tMain } from "./i18n";
import {
  currentAccount,
  getLiveAuthStatus,
  createApiProfile,
  importAuthFileFromPath,
  importLiveAuthFile,
  listAccounts,
  removeAccount,
  renameAccount,
  switchAccount
} from "./services/accountsService";
import { broadcastAccountsChanged, getMainWindow } from "./window";
import { rebuildTrayMenu } from "./tray";
import { notify } from "./notifications";

export function registerIpc(): void {
  ipcMain.handle("get-accounts", () => listAccounts());
  ipcMain.handle("get-current-account", () => currentAccount());

  ipcMain.handle("switch-account", (_event, id: string) => {
    const result = switchAccount(id);
    if (result.success) {
      afterAccountsMutation();
      if (!result.alreadyCurrent && result.account) {
        notify("auth-switch", tMain("notify.switchedTo", { name: result.account.name }));
      }
    }
    return result;
  });

  ipcMain.handle("import-auth-file", async () => {
    const window = getMainWindow();
    const options = {
      title: "Import Codex auth.json",
      properties: ["openFile"] as ["openFile"],
      filters: [
        { name: "JSON", extensions: ["json"] },
        { name: "All files", extensions: ["*"] }
      ]
    };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, cancelled: true };
    }

    const importResult = importAuthFileFromPath(result.filePaths[0]);
    if (importResult.success) afterAccountsMutation();
    return importResult;
  });

  ipcMain.handle("create-api-profile", (_event, input) => {
    const result = createApiProfile(input);
    if (result.success) afterAccountsMutation();
    return result;
  });

  ipcMain.handle("import-live-auth-file", (_event, name?: string, setCurrent?: boolean) => {
    const result = importLiveAuthFile(name, setCurrent ?? true);
    if (result.success) afterAccountsMutation();
    return result;
  });

  ipcMain.handle("rename-account", (_event, id: string, name: string) => {
    renameAccount(id, name);
    afterAccountsMutation();
  });

  ipcMain.handle("delete-account", (_event, id: string) => {
    removeAccount(id);
    afterAccountsMutation();
  });

  ipcMain.handle(
    "native-confirm",
    async (_event, title: string, message: string, confirmLabel: string, cancelLabel: string) => {
      const window = getMainWindow();
      const options = {
        type: "warning" as const,
        buttons: [cancelLabel, confirmLabel],
        defaultId: 0,
        cancelId: 0,
        title,
        message
      };
      const result = window ? await dialog.showMessageBox(window, options) : await dialog.showMessageBox(options);
      return result.response === 1;
    }
  );

  ipcMain.handle("native-message", async (_event, title: string, message: string, buttonLabel: string) => {
    const window = getMainWindow();
    const options = {
      type: "info" as const,
      buttons: [buttonLabel],
      defaultId: 0,
      cancelId: 0,
      title,
      message
    };
    if (window) {
      await dialog.showMessageBox(window, options);
    } else {
      await dialog.showMessageBox(options);
    }
  });

  ipcMain.handle("get-live-auth-status", () => getLiveAuthStatus());

  ipcMain.handle("dismiss-first-run", () => {
    setBooleanSetting("first_run_done", true);
  });

  ipcMain.handle("should-show-first-run", () => !getBooleanSetting("first_run_done"));

  ipcMain.handle("set-language", (_event, locale: string) => {
    setMainLocale(locale);
    rebuildTrayMenu();
  });
}

function afterAccountsMutation(): void {
  rebuildTrayMenu();
  broadcastAccountsChanged();
}
