import fs from "node:fs";
import { randomUUID } from "node:crypto";
import type { Account, CodexApiProfileInput, ImportResult, LiveAuthStatus, SwitchResult } from "../../shared/types";
import { getErrorMessage } from "../../shared/errors";
import {
  authHashExists,
  apiProfileExists,
  deleteAccount,
  findByEmail,
  getAccountById,
  getAllAccounts,
  getCurrentAccount,
  insertAccount,
  setCurrentAccount,
  toAccount,
  updateAccountLiveSnapshot,
  updateAccountMeta
} from "../db/accounts";
import { getCodexAuthPath } from "../codex/paths";
import { atomicWrite } from "../codex/writer";
import { buildCodexApiProfile } from "../codex/apiProfile";
import { disableCodexApiEnvironment } from "../codex/env";
import { disableCodexBaseUrl, enableCodexBaseUrl } from "../codex/config";
import { hashAuthJson, readAndValidateAuthFile, readLiveAuthFile } from "./authFile";

let switchInProgress = false;

export function listAccounts(): Account[] {
  return getAllAccounts().map(toAccount);
}

export function currentAccount(): Account | null {
  const current = getCurrentAccount();
  return current ? toAccount(current) : null;
}

export function importAuthFileFromPath(filePath: string, name?: string, setCurrent = false): ImportResult {
  try {
    const snapshot = readAndValidateAuthFile(filePath);

    if (authHashExists(snapshot.hash)) {
      return { success: false, duplicate: true, error: "This auth.json is already in auth-switch." };
    }

    const sameEmailExists = Boolean(snapshot.email && findByEmail(snapshot.email));
    const now = Date.now();
    const id = randomUUID();
    const displayName = cleanName(name) ?? snapshot.email ?? "Unnamed account";

    insertAccount({
      id,
      name: displayName,
      email: snapshot.email,
      auth_json: snapshot.content,
      auth_hash: snapshot.hash,
      kind: "auth_json",
      base_url: null,
      model: null,
      is_current: 0,
      created_at: now,
      updated_at: now,
      last_used_at: null
    });

    if (setCurrent) {
      setCurrentAccount(id);
    }

    const account = getAccountById(id);
    return {
      success: true,
      sameEmailExists,
      account: account ? toAccount(account) : undefined
    };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export function createApiProfile(input: CodexApiProfileInput): ImportResult {
  try {
    const displayName = cleanName(input.name) ?? "Custom API profile";
    const profile = buildCodexApiProfile({
      apiKey: input.apiKey,
      baseUrl: input.baseUrl
    });
    const authHash = hashAuthJson(profile.authHashMaterial);

    if (apiProfileExists(authHash, profile.baseUrl)) {
      return { success: false, duplicate: true, error: "This API key profile is already in auth-switch." };
    }

    const now = Date.now();
    const id = randomUUID();
    insertAccount({
      id,
      name: displayName,
      email: null,
      auth_json: profile.authJson,
      auth_hash: authHash,
      kind: "api_key",
      base_url: profile.baseUrl,
      model: input.model?.trim() || null,
      is_current: 0,
      created_at: now,
      updated_at: now,
      last_used_at: null
    });

    const account = getAccountById(id);
    return { success: true, account: account ? toAccount(account) : undefined };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export function importLiveAuthFile(name?: string, setCurrent = true): ImportResult {
  return importAuthFileFromPath(getCodexAuthPath(), name, setCurrent);
}

export function renameAccount(id: string, name: string): void {
  const trimmed = cleanName(name);
  if (!trimmed) throw new Error("Account name cannot be empty");
  updateAccountMeta(id, { name: trimmed });
}

export function removeAccount(id: string): void {
  const row = getAccountById(id);
  if (!row) throw new Error("Account not found");
  if (row.is_current === 1) {
    throw new Error("Switch to another account before deleting this one.");
  }
  deleteAccount(id);
}

export function getLiveAuthStatus(): LiveAuthStatus {
  const path = getCodexAuthPath();
  if (!fs.existsSync(path)) {
    return { exists: false, hash: null, email: null, path };
  }

  try {
    const snapshot = readAndValidateAuthFile(path);
    return { exists: true, hash: snapshot.hash, email: snapshot.email, path };
  } catch {
    try {
      const raw = fs.readFileSync(path, "utf-8");
      return { exists: true, hash: hashAuthJson(raw), email: null, path };
    } catch {
      return { exists: true, hash: null, email: null, path };
    }
  }
}

export function switchAccount(id: string): SwitchResult {
  if (switchInProgress) {
    return { success: false, error: "Another switch is already in progress." };
  }

  switchInProgress = true;
  try {
    const target = getAccountById(id);
    if (!target) return { success: false, error: "Account not found." };

    if (target.is_current === 1) {
      return { success: true, alreadyCurrent: true, account: toAccount(target) };
    }

    const current = getCurrentAccount();
    if (current && current.id !== target.id && current.kind === "auth_json") {
      try {
        const live = readLiveAuthFile();
        if (live) {
          updateAccountLiveSnapshot(current.id, live.content, live.hash, Date.now());
        }
      } catch (error) {
        console.warn("Skipping current-account backfill:", getErrorMessage(error));
      }
    }

    if (target.kind === "api_key") {
      const parsed = JSON.parse(target.auth_json) as { OPENAI_API_KEY?: unknown };
      const apiKey = typeof parsed.OPENAI_API_KEY === "string" ? parsed.OPENAI_API_KEY : "";
      atomicWrite(getCodexAuthPath(), target.auth_json);
      disableCodexApiEnvironment();
      if (!apiKey) throw new Error("API key cannot be empty. Please recreate this API profile.");
      enableCodexBaseUrl(target.base_url ?? "");
    } else {
      atomicWrite(getCodexAuthPath(), target.auth_json);
      disableCodexApiEnvironment();
      disableCodexBaseUrl();
    }
    setCurrentAccount(target.id);

    const updatedTarget = getAccountById(target.id);
    return { success: true, account: updatedTarget ? toAccount(updatedTarget) : toAccount(target) };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  } finally {
    switchInProgress = false;
  }
}

function cleanName(name: string | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
}
