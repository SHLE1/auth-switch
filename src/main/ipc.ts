import { dialog, ipcMain } from "electron";
import { getBooleanSetting, setBooleanSetting } from "./db/settings";
import {
  currentAccount,
  getLiveAuthStatus,
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
        notify("auth-switch", `Switched to ${result.account.name}`);
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

  ipcMain.handle("get-live-auth-status", () => getLiveAuthStatus());

  ipcMain.handle("dismiss-first-run", () => {
    setBooleanSetting("first_run_done", true);
  });

  ipcMain.handle("should-show-first-run", () => !getBooleanSetting("first_run_done"));
}

function afterAccountsMutation(): void {
  rebuildTrayMenu();
  broadcastAccountsChanged();
}
