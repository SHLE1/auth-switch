import os from "node:os";
import path from "node:path";

export function getCodexAuthPath(): string {
  const base = process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
  return path.join(base, "auth.json");
}

export function getCodexConfigPath(): string {
  return path.join(getCodexDir(), "config.toml");
}

export function getCodexDir(): string {
  return path.dirname(getCodexAuthPath());
}
