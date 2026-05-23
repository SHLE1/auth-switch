import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let db: Database.Database | null = null;

export function getAppDataDir(): string {
  return path.join(os.homedir(), ".auth-switch");
}

export function getDbPath(): string {
  return path.join(getAppDataDir(), "auth-switch.db");
}

export function initDatabase(): Database.Database {
  if (db) return db;

  fs.mkdirSync(getAppDataDir(), { recursive: true, mode: 0o700 });
  db = new Database(getDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

export function getDatabase(): Database.Database {
  return db ?? initDatabase();
}

function runMigrations(database: Database.Database): void {
  const version = database.pragma("user_version", { simple: true }) as number;

  if (version < 1) {
    const migrate = database.transaction(() => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
          id           TEXT    PRIMARY KEY,
          name         TEXT    NOT NULL,
          email        TEXT,
          auth_json    TEXT    NOT NULL,
          auth_hash    TEXT    NOT NULL,
          is_current   INTEGER NOT NULL DEFAULT 0,
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL,
          last_used_at INTEGER
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_auth_hash ON accounts(auth_hash);
        CREATE INDEX IF NOT EXISTS idx_accounts_is_current ON accounts(is_current);
        CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);

        CREATE TABLE IF NOT EXISTS settings (
          key   TEXT PRIMARY KEY,
          value TEXT
        );
      `);
      database.pragma("user_version = 1");
    });

    migrate();
  }

  if (version < 2) {
    const migrate = database.transaction(() => {
      database.exec(`
        ALTER TABLE accounts ADD COLUMN kind TEXT NOT NULL DEFAULT 'auth_json';
        ALTER TABLE accounts ADD COLUMN base_url TEXT;
        ALTER TABLE accounts ADD COLUMN model TEXT;
      `);
      database.pragma("user_version = 2");
    });

    migrate();
  }

  if (version < 3) {
    const migrate = database.transaction(() => {
      database.exec(`
        DROP INDEX IF EXISTS idx_accounts_auth_hash;
        CREATE INDEX IF NOT EXISTS idx_accounts_auth_hash ON accounts(auth_hash);
      `);
      database.pragma("user_version = 3");
    });

    migrate();
  }
}
