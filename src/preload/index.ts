import { contextBridge, ipcRenderer } from "electron";
import type { AuthSwitchApi } from "../shared/types";

const api: AuthSwitchApi = {
  getAccounts: () => ipcRenderer.invoke("get-accounts"),
  getCurrentAccount: () => ipcRenderer.invoke("get-current-account"),
  switchAccount: (id) => ipcRenderer.invoke("switch-account", id),
  importAuthFile: () => ipcRenderer.invoke("import-auth-file"),
  importLiveAuthFile: (name, setCurrent) => ipcRenderer.invoke("import-live-auth-file", name, setCurrent),
  renameAccount: (id, name) => ipcRenderer.invoke("rename-account", id, name),
  deleteAccount: (id) => ipcRenderer.invoke("delete-account", id),
  getLiveAuthStatus: () => ipcRenderer.invoke("get-live-auth-status"),
  dismissFirstRun: () => ipcRenderer.invoke("dismiss-first-run"),
  shouldShowFirstRun: () => ipcRenderer.invoke("should-show-first-run"),
  onAccountsChanged: (callback) => {
    const listener = (): void => callback();
    ipcRenderer.on("accounts-changed", listener);
    return () => ipcRenderer.removeListener("accounts-changed", listener);
  }
};

contextBridge.exposeInMainWorld("authSwitch", api);
