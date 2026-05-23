import { contextBridge, ipcRenderer } from "electron";
import type { AuthSwitchApi } from "../shared/types";

const api: AuthSwitchApi = {
  getAccounts: () => ipcRenderer.invoke("get-accounts"),
  getCurrentAccount: () => ipcRenderer.invoke("get-current-account"),
  switchAccount: (id) => ipcRenderer.invoke("switch-account", id),
  importAuthFile: () => ipcRenderer.invoke("import-auth-file"),
  createApiProfile: (input) => ipcRenderer.invoke("create-api-profile", input),
  importLiveAuthFile: (name, setCurrent) => ipcRenderer.invoke("import-live-auth-file", name, setCurrent),
  renameAccount: (id, name) => ipcRenderer.invoke("rename-account", id, name),
  deleteAccount: (id) => ipcRenderer.invoke("delete-account", id),
  nativeConfirm: (title, message, confirmLabel, cancelLabel) =>
    ipcRenderer.invoke("native-confirm", title, message, confirmLabel, cancelLabel),
  nativeMessage: (title, message, buttonLabel) => ipcRenderer.invoke("native-message", title, message, buttonLabel),
  setLanguage: (locale) => ipcRenderer.invoke("set-language", locale),
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
