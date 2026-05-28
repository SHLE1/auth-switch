use crate::models::{Account, AccountKind};
use rusqlite::{params, Connection, OptionalExtension, Row};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("home directory unavailable")]
    NoHomeDir,
    #[error("database lock poisoned")]
    LockPoisoned,
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

#[derive(Debug, Clone)]
pub struct AccountRow {
    pub id: String,
    pub app: String,
    pub name: String,
    pub email: Option<String>,
    pub auth_json: String,
    #[allow(dead_code)]
    pub auth_hash: String,
    pub kind: AccountKind,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub is_current: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_used_at: Option<i64>,
}

impl AccountRow {
    pub fn into_account(self) -> Account {
        Account {
            id: self.id,
            app: self.app,
            name: self.name,
            email: self.email,
            kind: self.kind,
            base_url: self.base_url,
            model: self.model,
            is_current: self.is_current,
            created_at: self.created_at,
            updated_at: self.updated_at,
            last_used_at: self.last_used_at,
        }
    }
}

pub struct NewAccountRow {
    pub id: String,
    pub app: String,
    pub name: String,
    pub email: Option<String>,
    pub auth_json: String,
    pub auth_hash: String,
    pub kind: AccountKind,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub is_current: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_used_at: Option<i64>,
}

pub struct Database {
    conn: Mutex<Connection>,
}

const ACCOUNT_COLUMNS: &str = "id, app, name, email, auth_json, auth_hash, kind, base_url, model, is_current, created_at, updated_at, last_used_at";

impl Database {
    pub fn open() -> Result<Self, DbError> {
        Self::open_at(app_data_dir()?.join("auth-switch.db"))
    }

    pub fn open_at(path: PathBuf) -> Result<Self, DbError> {
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(dir, fs::Permissions::from_mode(0o700))?;
            }
        }
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        run_migrations(&conn)?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn list_accounts(&self) -> Result<Vec<Account>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        let mut stmt = conn.prepare(&format!("SELECT {ACCOUNT_COLUMNS} FROM accounts ORDER BY app ASC, created_at ASC"))?;
        let rows = stmt.query_map([], row_to_account_row)?;
        let mut accounts = Vec::new();
        for row in rows {
            accounts.push(row?.into_account());
        }
        Ok(accounts)
    }


    pub fn get_account_by_id(&self, id: &str) -> Result<Option<AccountRow>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        conn.query_row(
            &format!("SELECT {ACCOUNT_COLUMNS} FROM accounts WHERE id = ?1"),
            params![id],
            row_to_account_row,
        )
        .optional()
        .map_err(DbError::from)
    }

    pub fn get_current_account(&self) -> Result<Option<Account>, DbError> {
        Ok(self.get_current_account_row()?.map(AccountRow::into_account))
    }

    pub fn get_current_account_row(&self) -> Result<Option<AccountRow>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        conn.query_row(
            &format!("SELECT {ACCOUNT_COLUMNS} FROM accounts WHERE is_current = 1 ORDER BY last_used_at DESC LIMIT 1"),
            [],
            row_to_account_row,
        )
        .optional()
        .map_err(DbError::from)
    }

    pub fn get_current_account_row_for_app(&self, app: &str) -> Result<Option<AccountRow>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        conn.query_row(
            &format!("SELECT {ACCOUNT_COLUMNS} FROM accounts WHERE app = ?1 AND is_current = 1 ORDER BY last_used_at DESC LIMIT 1"),
            params![app],
            row_to_account_row,
        )
        .optional()
        .map_err(DbError::from)
    }

    pub fn insert_account_set_current(&self, row: &NewAccountRow) -> Result<(), DbError> {
        let mut conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        let tx = conn.transaction()?;
        let now = now_ms();
        insert_account_tx(&tx, row, false)?;
        tx.execute("UPDATE accounts SET is_current = 0 WHERE app = ?1", params![row.app])?;
        tx.execute(
            "UPDATE accounts SET is_current = 1, last_used_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now, row.id],
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn insert_account(&self, row: &NewAccountRow) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        conn.execute(
            "INSERT INTO accounts (
                id, app, name, email, auth_json, auth_hash, kind, base_url, model, is_current, created_at, updated_at, last_used_at
              ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                row.id,
                row.app,
                row.name,
                row.email,
                row.auth_json,
                row.auth_hash,
                row.kind.as_db_value(),
                row.base_url,
                row.model,
                if row.is_current { 1 } else { 0 },
                row.created_at,
                row.updated_at,
                row.last_used_at
            ],
        )?;
        Ok(())
    }

    pub fn update_account_meta(&self, id: &str, name: Option<&str>, email: Option<Option<&str>>) -> Result<(), DbError> {
        let existing = self.get_account_by_id(id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)?;
        let next_name = name.unwrap_or(&existing.name).to_string();
        let next_email = email
            .map(|value| value.map(ToOwned::to_owned))
            .unwrap_or(existing.email);
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        conn.execute(
            "UPDATE accounts SET name = ?1, email = ?2, updated_at = ?3 WHERE id = ?4",
            params![next_name, next_email, now_ms(), id],
        )?;
        Ok(())
    }

    /// Replaces auth content and metadata for an existing api_key profile.
    pub fn update_account_profile(
        &self,
        id: &str,
        name: &str,
        auth_json: &str,
        auth_hash: &str,
        base_url: Option<&str>,
        model: Option<&str>,
    ) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        let rows = conn.execute(
            "UPDATE accounts SET name = ?1, auth_json = ?2, auth_hash = ?3, base_url = ?4, model = ?5, updated_at = ?6 WHERE id = ?7",
            params![name, auth_json, auth_hash, base_url, model, now_ms(), id],
        )?;
        if rows == 0 {
            return Err(DbError::Sqlite(rusqlite::Error::QueryReturnedNoRows));
        }
        Ok(())
    }

    pub fn update_account_live_snapshot(&self, id: &str, auth_json: &str, auth_hash: &str, updated_at: i64) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        conn.execute(
            "UPDATE accounts SET auth_json = ?1, auth_hash = ?2, updated_at = ?3 WHERE id = ?4",
            params![auth_json, auth_hash, updated_at, id],
        )?;
        Ok(())
    }

    pub fn set_current_account(&self, id: &str) -> Result<(), DbError> {
        let mut conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        let tx = conn.transaction()?;
        let app: String = tx.query_row("SELECT app FROM accounts WHERE id = ?1", params![id], |row| row.get(0))?;
        let now = now_ms();
        tx.execute("UPDATE accounts SET is_current = 0 WHERE app = ?1", params![app])?;
        tx.execute(
            "UPDATE accounts SET is_current = 1, last_used_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn delete_account(&self, id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        conn.execute("DELETE FROM accounts WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn auth_hash_exists(&self, hash: &str) -> Result<bool, DbError> {
        self.auth_hash_exists_for_app("codex", hash)
    }

    pub fn auth_hash_exists_for_app(&self, app: &str, hash: &str) -> Result<bool, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        let exists: Option<i64> = conn
            .query_row(
                "SELECT 1 FROM accounts WHERE app = ?1 AND auth_hash = ?2 LIMIT 1",
                params![app, hash],
                |row| row.get(0),
            )
            .optional()?;
        Ok(exists.is_some())
    }

    pub fn api_profile_exists(&self, hash: &str, base_url: &str) -> Result<bool, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        let exists: Option<i64> = conn
            .query_row(
                "SELECT 1 FROM accounts WHERE app = 'codex' AND auth_hash = ?1 AND base_url = ?2 LIMIT 1",
                params![hash, base_url],
                |row| row.get(0),
            )
            .optional()?;
        Ok(exists.is_some())
    }

    pub fn find_by_email(&self, email: &str) -> Result<Option<AccountRow>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        conn.query_row(
            &format!("SELECT {ACCOUNT_COLUMNS} FROM accounts WHERE app = 'codex' AND email = ?1 LIMIT 1"),
            params![email],
            row_to_account_row,
        )
        .optional()
        .map_err(DbError::from)
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        conn.query_row("SELECT value FROM settings WHERE key = ?1", params![key], |row| row.get(0))
            .optional()
            .map_err(DbError::from)
    }

    pub fn set_setting(&self, key: &str, value: Option<&str>) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockPoisoned)?;
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_bool_setting(&self, key: &str) -> Result<bool, DbError> {
        Ok(self.get_setting(key)?.as_deref() == Some("1"))
    }

    pub fn set_bool_setting(&self, key: &str, value: bool) -> Result<(), DbError> {
        self.set_setting(key, Some(if value { "1" } else { "0" }))
    }
}

pub fn app_data_dir() -> Result<PathBuf, DbError> {
    let home = dirs::home_dir().ok_or(DbError::NoHomeDir)?;
    Ok(home.join(".auth-switch"))
}

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn insert_account_tx(tx: &rusqlite::Transaction<'_>, row: &NewAccountRow, is_current: bool) -> Result<(), DbError> {
    tx.execute(
        "INSERT INTO accounts (
            id, app, name, email, auth_json, auth_hash, kind, base_url, model, is_current, created_at, updated_at, last_used_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            row.id,
            row.app,
            row.name,
            row.email,
            row.auth_json,
            row.auth_hash,
            row.kind.as_db_value(),
            row.base_url,
            row.model,
            if is_current { 1 } else { 0 },
            row.created_at,
            row.updated_at,
            row.last_used_at
        ],
    )?;
    Ok(())
}

fn row_to_account_row(row: &Row<'_>) -> rusqlite::Result<AccountRow> {
    let kind: String = row.get(6)?;
    let is_current: i64 = row.get(9)?;
    Ok(AccountRow {
        id: row.get(0)?,
        app: row.get(1)?,
        name: row.get(2)?,
        email: row.get(3)?,
        auth_json: row.get(4)?,
        auth_hash: row.get(5)?,
        kind: AccountKind::from_db_value(&kind),
        base_url: row.get(7)?,
        model: row.get(8)?,
        is_current: is_current == 1,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        last_used_at: row.get(12)?,
    })
}

fn run_migrations(conn: &Connection) -> Result<(), DbError> {
    let version: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version < 1 {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT,
                auth_json TEXT NOT NULL,
                auth_hash TEXT NOT NULL,
                is_current INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                last_used_at INTEGER
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_auth_hash ON accounts(auth_hash);
            CREATE INDEX IF NOT EXISTS idx_accounts_is_current ON accounts(is_current);
            CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
            PRAGMA user_version = 1;",
        )?;
    }
    let version: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version < 2 {
        conn.execute_batch(
            "ALTER TABLE accounts ADD COLUMN kind TEXT NOT NULL DEFAULT 'auth_json';
            ALTER TABLE accounts ADD COLUMN base_url TEXT;
            ALTER TABLE accounts ADD COLUMN model TEXT;
            PRAGMA user_version = 2;",
        )?;
    }
    let version: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version < 3 {
        conn.execute_batch(
            "DROP INDEX IF EXISTS idx_accounts_auth_hash;
            CREATE INDEX IF NOT EXISTS idx_accounts_auth_hash ON accounts(auth_hash);
            PRAGMA user_version = 3;",
        )?;
    }
    let version: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version < 4 {
        conn.execute_batch(
            "ALTER TABLE accounts ADD COLUMN app TEXT NOT NULL DEFAULT 'codex';
            CREATE INDEX IF NOT EXISTS idx_accounts_app ON accounts(app);
            PRAGMA user_version = 4;",
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_schema_version_three_fixture() {
        let dir = std::env::temp_dir().join(format!("auth-switch-db-test-{}", now_ms()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("auth-switch.db");
        {
            let conn = Connection::open(&path).unwrap();
            conn.execute_batch(
                "CREATE TABLE accounts (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT,
                    auth_json TEXT NOT NULL,
                    auth_hash TEXT NOT NULL,
                    is_current INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    last_used_at INTEGER,
                    kind TEXT NOT NULL DEFAULT 'auth_json',
                    base_url TEXT,
                    model TEXT
                );
                CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
                PRAGMA user_version = 3;",
            )
            .unwrap();
        }
        let db = Database::open_at(path).unwrap();
        assert!(db.list_accounts().unwrap().is_empty());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn current_account_is_scoped_by_app() {
        let dir = std::env::temp_dir().join(format!("auth-switch-db-app-test-{}", now_ms()));
        let db = Database::open_at(dir.join("auth-switch.db")).unwrap();
        let now = now_ms();
        db.insert_account_set_current(&NewAccountRow {
            id: "codex-1".into(),
            app: "codex".into(),
            name: "Codex".into(),
            email: None,
            auth_json: "{}".into(),
            auth_hash: "codex".into(),
            kind: AccountKind::AuthJson,
            base_url: None,
            model: None,
            is_current: true,
            created_at: now,
            updated_at: now,
            last_used_at: None,
        })
        .unwrap();
        db.insert_account_set_current(&NewAccountRow {
            id: "claude-1".into(),
            app: "claude".into(),
            name: "Claude".into(),
            email: None,
            auth_json: "{}".into(),
            auth_hash: "claude".into(),
            kind: AccountKind::ApiKey,
            base_url: None,
            model: None,
            is_current: true,
            created_at: now,
            updated_at: now,
            last_used_at: None,
        })
        .unwrap();
        assert_eq!(db.get_current_account_row_for_app("codex").unwrap().unwrap().id, "codex-1");
        assert_eq!(db.get_current_account_row_for_app("claude").unwrap().unwrap().id, "claude-1");
        let _ = fs::remove_dir_all(dir);
    }
}
