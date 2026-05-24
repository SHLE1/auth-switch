import { Menu, app, type MenuItemConstructorOptions } from "electron";
import { tMain } from "./i18n";
import { checkForUpdates } from "./updater";
import { hideMainWindow, setQuitting, showMainWindow } from "./window";

export function buildAppMenu(): void {
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
    return;
  }

  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: tMain("updater.checkForUpdates"),
          click: () => {
            void checkForUpdates({ showNoUpdateDialog: true });
          }
        },
        { type: "separator" },
        {
          label: "Preferences…",
          accelerator: "Command+,",
          click: () => showMainWindow()
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        {
          label: "Quit auth-switch",
          accelerator: "Command+Q",
          click: () => {
            setQuitting(true);
            app.quit();
          }
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        {
          label: "Close Window",
          accelerator: "Command+W",
          click: () => hideMainWindow()
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
