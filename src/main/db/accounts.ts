import { getDatabase } from "./database";
import type { Account } from "../../shared/types";

export interface AccountRow {
  id: string;
  name: string;
  email: string | null;
  auth_json: string;
  auth_hash: string;
  kind: "auth_json" | "api_key";
  base_url: string | null;
  model: string | null;
  is_current: 0 | 1;
  created_at: number;
  updated_at: number;
  last_used_at: number | null;
}

export interface NewAccountRow {
  id: string;
  name: string;
  email: string | null;
  auth_json: string;
  auth_hash: string;
  kind: "auth_json" | "api_key";
  base_url: string | null;
  model: string | null;
  is_current: 0 | 1;
  created_at: number;
  updated_at: number;
  last_used_at: number | null;
}

export function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    kind: row.kind,
    base_url: row.base_url,
    model: row.model,
    is_current: row.is_current === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_used_at: row.last_used_at
  };
}

export function getAllAccounts(): AccountRow[] {
  return getDatabase()
    .prepare("SELECT * FROM accounts ORDER BY created_at ASC")
    .all() as AccountRow[];
}

export function getAccountById(id: string): AccountRow | null {
  return (getDatabase().prepare("SELECT * FROM accounts WHERE id = ?").get(id) as AccountRow | undefined) ?? null;
}

export function getCurrentAccount(): AccountRow | null {
  return (
    getDatabase().prepare("SELECT * FROM accounts WHERE is_current = 1 ORDER BY last_used_at DESC LIMIT 1").get() as
      | AccountRow
      | undefined
  ) ?? null;
}

export function insertAccount(row: NewAccountRow): void {
  getDatabase()
    .prepare(
      `INSERT INTO accounts (
        id, name, email, auth_json, auth_hash, kind, base_url, model, is_current, created_at, updated_at, last_used_at
      ) VALUES (
        @id, @name, @email, @auth_json, @auth_hash, @kind, @base_url, @model, @is_current, @created_at, @updated_at, @last_used_at
      )`
    )
    .run(row);
}

export function updateAccountMeta(id: string, values: { name?: string; email?: string | null }): void {
  const existing = getAccountById(id);
  if (!existing) throw new Error("Account not found");

  getDatabase()
    .prepare("UPDATE accounts SET name = ?, email = ?, updated_at = ? WHERE id = ?")
    .run(values.name ?? existing.name, values.email ?? existing.email, Date.now(), id);
}

export function updateAccountAuthJson(id: string, authJson: string, authHash: string, updatedAt = Date.now()): void {
  getDatabase()
    .prepare("UPDATE accounts SET auth_json = ?, auth_hash = ?, updated_at = ? WHERE id = ?")
    .run(authJson, authHash, updatedAt, id);
}

export function updateAccountLiveSnapshot(id: string, authJson: string, authHash: string, updatedAt = Date.now()): void {
  getDatabase()
    .prepare("UPDATE accounts SET auth_json = ?, auth_hash = ?, updated_at = ? WHERE id = ?")
    .run(authJson, authHash, updatedAt, id);
}

export function setCurrentAccount(id: string): void {
  const database = getDatabase();
  const setCurrent = database.transaction((targetId: string, now: number) => {
    database.prepare("UPDATE accounts SET is_current = 0").run();
    database.prepare("UPDATE accounts SET is_current = 1, last_used_at = ?, updated_at = ? WHERE id = ?").run(now, now, targetId);
  });
  setCurrent(id, Date.now());
}

export function deleteAccount(id: string): void {
  getDatabase().prepare("DELETE FROM accounts WHERE id = ?").run(id);
}

export function authHashExists(hash: string): boolean {
  const row = getDatabase().prepare("SELECT 1 FROM accounts WHERE auth_hash = ? LIMIT 1").get(hash);
  return Boolean(row);
}

export function apiProfileExists(authHash: string, baseUrl: string): boolean {
  const row = getDatabase()
    .prepare("SELECT 1 FROM accounts WHERE auth_hash = ? AND base_url = ? LIMIT 1")
    .get(authHash, baseUrl);
  return Boolean(row);
}

export function findByEmail(email: string): AccountRow | null {
  return (getDatabase().prepare("SELECT * FROM accounts WHERE email = ? LIMIT 1").get(email) as AccountRow | undefined) ?? null;
}
