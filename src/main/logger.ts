import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function getLogPath(): string {
  return path.join(os.homedir(), ".auth-switch", "auth-switch.log");
}

export function getMainLogPath(): string {
  return getLogPath();
}

export function logMain(message: string, error?: unknown): void {
  const line = `[${new Date().toISOString()}] ${message}${error ? ` ${formatError(error)}` : ""}\n`;

  try {
    const logPath = getLogPath();
    fs.mkdirSync(path.dirname(logPath), { recursive: true, mode: 0o700 });
    fs.appendFileSync(logPath, line);
  } catch {
    // Logging must never affect app startup.
  }

  if (error) {
    console.error(message, error);
  } else {
    console.info(message);
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  }
  return String(error);
}
