import { Menu, Tray, app, dialog, nativeImage, type MenuItemConstructorOptions } from "electron";
import fs from "node:fs";
import path from "node:path";
import { importAuthFileFromPath, listAccounts, switchAccount } from "./services/accountsService";
import { broadcastAccountsChanged, getMainWindow, setQuitting, showMainWindow } from "./window";
import { notify } from "./notifications";
import { tMain } from "./i18n";

let tray: Tray | null = null;

export function createTray(): Tray | null {
  if (tray) return tray;

  const icon = loadTrayIcon();
  if (icon.isEmpty()) {
    console.warn("Tray icon is empty; tray will not be created.");
    return null;
  }

  tray = new Tray(icon);
  tray.setToolTip(tMain("tray.tooltip"));

  if (process.platform === "win32") {
    tray.on("click", () => showMainWindow());
    tray.on("double-click", () => showMainWindow());
  } else {
    tray.on("double-click", () => showMainWindow());
  }

  rebuildTrayMenu();
  return tray;
}

export function rebuildTrayMenu(): void {
  if (!tray) return;

  // Update tooltip in case language changed
  tray.setToolTip(tMain("tray.tooltip"));

  const accounts = listAccounts();
  const accountItems: MenuItemConstructorOptions[] = accounts.length
    ? accounts.map((account) => ({
        label: account.name,
        type: "checkbox" as const,
        checked: account.is_current,
        sublabel: account.kind === "api_key" ? account.base_url ?? undefined : account.email ?? undefined,
        click: () => {
          const result = switchAccount(account.id);
          if (result.success) {
            rebuildTrayMenu();
            broadcastAccountsChanged();
            if (!result.alreadyCurrent && result.account) {
              notify("auth-switch", tMain("notify.switchedTo", { name: result.account.name }));
            }
          } else if (result.error) {
            notify("auth-switch", result.error);
          }
        }
      }))
    : [{ label: tMain("tray.noAccounts"), enabled: false }];

  const template: MenuItemConstructorOptions[] = [
    { label: "auth-switch", enabled: false },
    { type: "separator" },
    ...accountItems,
    { type: "separator" },
    {
      label: tMain("tray.addAuth"),
      click: async () => {
        // On macOS the app must be frontmost before showing a file dialog from
        // the menu bar, otherwise the picker is hidden behind other windows.
        if (process.platform === "darwin") {
          app.show();
          app.focus({ steal: true });
        }

        const window = getMainWindow();
        const options = {
          title: tMain("tray.importDialogTitle"),
          properties: ["openFile"] as ["openFile"],
          filters: [
            { name: "JSON", extensions: ["json"] },
            { name: "All files", extensions: ["*"] }
          ]
        };
        const result = window
          ? await dialog.showOpenDialog(window, options)
          : await dialog.showOpenDialog(options);

        if (!result.canceled && result.filePaths[0]) {
          const importResult = importAuthFileFromPath(result.filePaths[0]);
          if (importResult.success) {
            rebuildTrayMenu();
            broadcastAccountsChanged();
          } else if (!importResult.cancelled && importResult.error) {
            notify("auth-switch", importResult.error);
          }
        }
      }
    },
    { type: "separator" },
    { label: tMain("tray.openWindow"), accelerator: process.platform === "darwin" ? "Command+," : undefined, click: () => showMainWindow() },
    { type: "separator" },
    {
      label: tMain("tray.quit"),
      accelerator: process.platform === "darwin" ? "Command+Q" : process.platform === "win32" ? "Ctrl+Q" : undefined,
      click: () => {
        setQuitting(true);
        app.quit();
      }
    }
  ];

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function loadTrayIcon(): Electron.NativeImage {
  const iconFile = "tray-icon.png";
  const candidates = [
    path.join(process.cwd(), "assets", iconFile),
    path.join(process.resourcesPath, "assets", iconFile),
    path.join(__dirname, "../../assets", iconFile)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const image = nativeImage.createFromPath(candidate);
      if (process.platform === "darwin") image.setTemplateImage(true);
      return image;
    }
  }

  return nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAFElEQVR42mP8z8Dwn4GKgImaho0aAQB6uwIoMsPZ7AAAAABJRU5ErkJggg=="
  );
}
