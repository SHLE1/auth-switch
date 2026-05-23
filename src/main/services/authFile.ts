import crypto from "node:crypto";
import fs from "node:fs";
import { getCodexAuthPath } from "../codex/paths";
import { parseAuthJson, parseEmail } from "../codex/parser";

export interface AuthFileSnapshot {
  content: string;
  hash: string;
  email: string | null;
  parsed: Record<string, unknown>;
}

export function hashAuthJson(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

export function readAndValidateAuthFile(filePath: string): AuthFileSnapshot {
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = parseAuthJson(content);
  return {
    content,
    parsed,
    hash: hashAuthJson(content),
    email: parseEmail(parsed)
  };
}

export function readLiveAuthFile(): AuthFileSnapshot | null {
  const authPath = getCodexAuthPath();
  if (!fs.existsSync(authPath)) return null;
  return readAndValidateAuthFile(authPath);
}
