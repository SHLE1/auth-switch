import fs from "node:fs";
import path from "node:path";
import { getCodexConfigPath } from "./paths";

const KEY = "openai_base_url";
const MANAGED_MARKER = "# auth-switch managed";
const PREVIOUS_PREFIX = "# auth-switch previous: ";

export function enableCodexBaseUrl(baseUrl: string): void {
  const trimmed = baseUrl.trim();
  if (!trimmed) throw new Error("Base URL cannot be empty");

  const configPath = getCodexConfigPath();
  const original = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf-8") : "";
  const next = setManagedOpenAiBaseUrl(original, trimmed);
  writeConfig(configPath, next);
}

export function disableCodexBaseUrl(): void {
  const configPath = getCodexConfigPath();
  if (!fs.existsSync(configPath)) return;

  const original = fs.readFileSync(configPath, "utf-8");
  const next = commentManagedOpenAiBaseUrl(original);
  if (next !== original) writeConfig(configPath, next);
}

export function setManagedOpenAiBaseUrl(content: string, baseUrl: string): string {
  const lines = splitLines(content);
  const managedIndex = lines.findIndex((line) => isOpenAiBaseUrlLine(line) && line.includes(MANAGED_MARKER));
  const replacement = `${KEY} = "${escapeTomlString(baseUrl)}" ${MANAGED_MARKER}`;

  if (managedIndex >= 0) {
    lines[managedIndex] = replacement;
    return joinLines(lines, content);
  }

  const activeIndex = lines.findIndex((line) => isActiveOpenAiBaseUrlLine(line));
  if (activeIndex >= 0) {
    lines[activeIndex] = `${PREVIOUS_PREFIX}${lines[activeIndex]}`;
    lines.splice(activeIndex + 1, 0, replacement);
    return joinLines(lines, content);
  }

  const insertionIndex = firstNonCommentTopLevelIndex(lines);
  if (insertionIndex >= 0) {
    lines.splice(insertionIndex, 0, replacement);
  } else {
    if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
    lines.push(replacement);
  }

  return joinLines(lines, content);
}

export function commentManagedOpenAiBaseUrl(content: string): string {
  const lines = splitLines(content);
  const managedIndex = lines.findIndex((line) => isOpenAiBaseUrlLine(line) && line.includes(MANAGED_MARKER));
  if (managedIndex < 0) return content;

  const line = lines[managedIndex];
  if (/^\s*#/.test(line)) return content;

  lines[managedIndex] = `# ${line}`;
  return joinLines(lines, content);
}

function writeConfig(configPath: string, content: string): void {
  fs.mkdirSync(path.dirname(configPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(configPath, content, { encoding: "utf-8", mode: 0o600 });
}

function splitLines(content: string): string[] {
  if (!content) return [];
  return content.replace(/\r\n/g, "\n").split("\n");
}

function joinLines(lines: string[], original: string): string {
  const result = lines.join("\n");
  if (!result) return "";
  return original.endsWith("\n") || result.endsWith("\n") ? result : `${result}\n`;
}

function isOpenAiBaseUrlLine(line: string): boolean {
  return /^\s*#?\s*openai_base_url\s*=/.test(line);
}

function isActiveOpenAiBaseUrlLine(line: string): boolean {
  return /^\s*openai_base_url\s*=/.test(line);
}

function firstNonCommentTopLevelIndex(lines: string[]): number {
  return lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("#") && !trimmed.startsWith("[");
  });
}

function escapeTomlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
