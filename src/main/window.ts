import { BrowserWindow, app, session } from "electron";
import { join } from "node:path";
import { is } from "@electron-toolkit/utils";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

export function setQuitting(value: boolean): void {
  isQuitting = value;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;

  // Set CSP at the session level so it doesn't block ES module loading from file://
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' file:; script-src 'self' file:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:*;"
        ]
      }
    });
  });

  mainWindow = new BrowserWindow({
    width: 520,
    height: 600,
    resizable: false,
    show: false,
    title: "auth-switch",
    backgroundColor: "#080b0f",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox: true removed — ESM preload (.mjs) + contextIsolation provides
      // the same renderer isolation without blocking file:// module loading
    }
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideMainWindow();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Open DevTools with Cmd+Option+I in dev
  if (is.dev) {
    mainWindow.webContents.on("before-input-event", (_event, input) => {
      if (input.meta && input.alt && input.key === "i") {
        mainWindow?.webContents.openDevTools();
      }
    });
  }

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return mainWindow;
}

export function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }

  if (process.platform === "darwin") app.dock?.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

export function hideMainWindow(): void {
  mainWindow?.hide();
  if (process.platform === "darwin") app.dock?.hide();
}

export function broadcastAccountsChanged(): void {
  mainWindow?.webContents.send("accounts-changed");
}
