import { BrowserWindow, app, screen, session } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { is } from "@electron-toolkit/utils";
import { getWindowBoundsSetting, setWindowBoundsSetting, type WindowBoundsSetting } from "./db/settings";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let cspRegistered = false;

export function setQuitting(value: boolean): void {
  isQuitting = value;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;

  registerContentSecurityPolicy();

  const savedBounds = getVisibleWindowBounds(getWindowBoundsSetting());

  mainWindow = new BrowserWindow({
    ...savedBounds,
    minWidth: 480,
    minHeight: 520,
    resizable: true,
    show: false,
    title: "auth-switch",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: process.platform === "darwin" ? { x: 12, y: 12 } : undefined,
    transparent: process.platform === "darwin",
    vibrancy: process.platform === "darwin" ? "under-window" : undefined,
    visualEffectState: process.platform === "darwin" ? "active" : undefined,
    backgroundColor: process.platform === "darwin" ? "#00000000" : "#080b0f",
    // Windows: dark title bar to match app theme (minimize/maximize/close icons stay white)
    titleBarOverlay: process.platform === "win32"
      ? { color: "#080b0f", symbolColor: "#e6edf3", height: 32 }
      : undefined,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  hardenWindowNavigation(mainWindow);

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    saveMainWindowBounds();
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
  if (process.platform === "darwin") app.dock?.show();

  if (!mainWindow || mainWindow.isDestroyed()) {
    const window = createMainWindow();
    window.once("ready-to-show", () => window.focus());
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

export function hideMainWindow(): void {
  saveMainWindowBounds();
  mainWindow?.hide();
  if (process.platform === "darwin") app.dock?.hide();
}

export function broadcastAccountsChanged(): void {
  mainWindow?.webContents.send("accounts-changed");
}

function registerContentSecurityPolicy(): void {
  if (cspRegistered) return;
  cspRegistered = true;

  const connectSrc = is.dev ? "'self' ws://localhost:*" : "'self'";

  // Set CSP at the session level so it doesn't block ES module loading from file://.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          `default-src 'self' file:; script-src 'self' file:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src ${connectSrc};`
        ]
      }
    });
  });
}

function hardenWindowNavigation(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  window.webContents.on("will-navigate", (event, targetUrl) => {
    if (!isAllowedNavigationUrl(targetUrl)) {
      event.preventDefault();
    }
  });
}

function isAllowedNavigationUrl(targetUrl: string): boolean {
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    try {
      return new URL(targetUrl).origin === new URL(process.env.ELECTRON_RENDERER_URL).origin;
    } catch {
      return false;
    }
  }

  const rendererDirectoryUrl = pathToFileURL(join(__dirname, "../renderer/")).toString();
  return targetUrl.startsWith(rendererDirectoryUrl);
}

function getVisibleWindowBounds(savedBounds: WindowBoundsSetting): WindowBoundsSetting {
  const width = Math.max(480, savedBounds.width);
  const height = Math.max(520, savedBounds.height);
  const x = typeof savedBounds.x === "number" ? savedBounds.x : undefined;
  const y = typeof savedBounds.y === "number" ? savedBounds.y : undefined;

  if (x === undefined || y === undefined) {
    return { width, height };
  }

  const isVisible = screen.getAllDisplays().some((display) => {
    const bounds = display.workArea;
    return x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height;
  });

  return isVisible ? { x, y, width, height } : { width, height };
}

function saveMainWindowBounds(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const bounds = mainWindow.getBounds();
  setWindowBoundsSetting({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  });
}
