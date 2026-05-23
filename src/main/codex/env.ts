import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const BLOCK_START = "# >>> auth-switch codex api env >>>";
const BLOCK_END = "# <<< auth-switch codex api env <<<";
const DISABLED_PREFIX = "# auth-switch disabled: ";

/**
 * Clean up environment-based profile state used by older auth-switch builds.
 * Current API profiles use auth.json + the managed openai_base_url line in config.toml.
 */
export function disableCodexApiEnvironment(): void {
  delete process.env.OPENAI_API_KEY;
  delete process.env.CODEX_API_KEY;
  delete process.env.OPENAI_BASE_URL;

  if (process.platform === "darwin") {
    unsetMacLaunchEnvironment("OPENAI_API_KEY");
    unsetMacLaunchEnvironment("CODEX_API_KEY");
    unsetMacLaunchEnvironment("OPENAI_BASE_URL");
  }

  if (process.platform === "win32") {
    deleteWindowsUserEnvironment("OPENAI_API_KEY");
    deleteWindowsUserEnvironment("CODEX_API_KEY");
    deleteWindowsUserEnvironment("OPENAI_BASE_URL");
    return;
  }

  const disabledBlock = buildDisabledUnixBlock();
  for (const shellPath of getUnixShellProfilePaths()) {
    if (fs.existsSync(shellPath)) {
      upsertManagedBlock(shellPath, disabledBlock);
    }
  }
}

function getUnixShellProfilePaths(): string[] {
  const home = os.homedir();
  const currentShell = path.basename(process.env.SHELL ?? "");
  const candidates = currentShell === "bash" ? [".bashrc", ".zshrc"] : [".zshrc", ".bashrc"];
  return candidates.map((file) => path.join(home, file));
}

function buildDisabledUnixBlock(): string {
  return [
    BLOCK_START,
    "# Managed by auth-switch. Environment-based API switching is disabled; config.toml openai_base_url is used instead.",
    `${DISABLED_PREFIX}export OPENAI_API_KEY=`,
    `${DISABLED_PREFIX}export CODEX_API_KEY=`,
    `${DISABLED_PREFIX}export OPENAI_BASE_URL=`,
    `${DISABLED_PREFIX}codex shell function removed`,
    BLOCK_END,
    ""
  ].join("\n");
}

function upsertManagedBlock(filePath: string, block: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const original = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
  const next = replaceManagedBlock(original, block);
  fs.writeFileSync(filePath, next, { encoding: "utf-8", mode: 0o600 });
}

function replaceManagedBlock(content: string, block: string): string {
  const pattern = new RegExp(`${escapeRegExp(BLOCK_START)}[\\s\\S]*?${escapeRegExp(BLOCK_END)}\\n?`, "m");
  if (pattern.test(content)) {
    return content.replace(pattern, block);
  }

  return content;
}

function deleteWindowsUserEnvironment(name: string): void {
  spawnSync("reg", ["delete", "HKCU\\Environment", "/F", "/V", name], { windowsHide: true, encoding: "utf-8" });
}

function unsetMacLaunchEnvironment(name: string): void {
  const result = spawnSync("launchctl", ["unsetenv", name], { encoding: "utf-8" });
  if (result.status !== 0) {
    console.warn(`Failed to unset macOS launch environment ${name}:`, result.stderr || result.stdout);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
