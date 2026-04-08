const path = require("path");
const os = require("os");
const sqlite3 = require("sqlite3").verbose();
const { Pool } = require("pg");

const isVercel = Boolean(process.env.VERCEL);
const usePostgresConfigured = Boolean(process.env.DATABASE_URL);
let runtimeMode = usePostgresConfigured ? "postgres" : "sqlite";
const dbPath = isVercel
  ? path.join(os.tmpdir(), "lastminuteprep.db")
  : path.join(__dirname, "..", "..", "data", "lastminuteprep.db");

let sqliteDb = null;
let pgPool = null;

if (runtimeMode === "postgres") {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" || isVercel ? { rejectUnauthorized: false } : false,
  });
} else {
  sqliteDb = new sqlite3.Database(dbPath);
}

function convertSql(sql, params = []) {
  if (runtimeMode !== "postgres") {
    return { text: sql, values: params };
  }

  let index = 0;
  return {
    text: sql.replace(/\?/g, () => `$${++index}`),
    values: params,
  };
}

function runSqlite(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function getSqlite(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function allSqlite(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function run(sql, params = []) {
  if (runtimeMode === "postgres") {
    const query = convertSql(sql, params);
    await pgPool.query(query.text, query.values);
    return {};
  }

  return runSqlite(sql, params);
}

async function get(sql, params = []) {
  if (runtimeMode === "postgres") {
    const query = convertSql(sql, params);
    const result = await pgPool.query(query.text, query.values);
    return result.rows[0];
  }

  return getSqlite(sql, params);
}

async function all(sql, params = []) {
  if (runtimeMode === "postgres") {
    const query = convertSql(sql, params);
    const result = await pgPool.query(query.text, query.values);
    return result.rows;
  }

  return allSqlite(sql, params);
}

async function createTables() {
  if (runtimeMode === "postgres") {
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        college TEXT NOT NULL,
        branch TEXT NOT NULL,
        year TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        branch TEXT NOT NULL,
        year TEXT NOT NULL,
        exam_type TEXT NOT NULL,
        description TEXT,
        file_path TEXT NOT NULL,
        storage_path TEXT,
        likes_count INTEGER DEFAULT 0,
        views_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        note_id INTEGER NOT NULL REFERENCES notes(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, note_id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        note_id INTEGER NOT NULL REFERENCES notes(id),
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS guest_likes (
        id SERIAL PRIMARY KEY,
        note_id INTEGER NOT NULL REFERENCES notes(id),
        guest_token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guest_token, note_id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS guest_comments (
        id SERIAL PRIMARY KEY,
        note_id INTEGER NOT NULL REFERENCES notes(id),
        guest_name TEXT NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    return;
  }

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      college TEXT NOT NULL,
      branch TEXT NOT NULL,
      year TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      branch TEXT NOT NULL,
      year TEXT NOT NULL,
      exam_type TEXT NOT NULL,
      description TEXT,
      file_path TEXT NOT NULL,
      storage_path TEXT,
      likes_count INTEGER DEFAULT 0,
      views_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      note_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, note_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (note_id) REFERENCES notes(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      note_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (note_id) REFERENCES notes(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS guest_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      guest_token TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(guest_token, note_id),
      FOREIGN KEY (note_id) REFERENCES notes(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS guest_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      guest_name TEXT NOT NULL,
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES notes(id)
    )
  `);
}

async function ensureMigrations() {
  if (runtimeMode === "postgres") {
    await run("ALTER TABLE notes ADD COLUMN IF NOT EXISTS storage_path TEXT");
    return;
  }

  const columns = await all("PRAGMA table_info(notes)");
  const hasStoragePath = columns.some((column) => column.name === "storage_path");
  if (!hasStoragePath) {
    await run("ALTER TABLE notes ADD COLUMN storage_path TEXT");
  }
}

async function seedAdmin() {
  const adminHash = "$2b$10$MfVrB/0zzg7ADo6WkXgTpe1YCnhlN3SYNvLOHLrF.hfVXSQIowXH2";
  const adminValues = ["Admin", "admin@lastminuteprep.com", adminHash, "System", "CSE(AIML)", "4th", "admin"];

  const existing = await get("SELECT id FROM users WHERE email = ?", ["admin@lastminuteprep.com"]);
  if (existing) {
    await run("UPDATE users SET branch = ?, role = ? WHERE email = ?", ["CSE(AIML)", "admin", "admin@lastminuteprep.com"]);
    return;
  }

  await run(
    "INSERT INTO users (name, email, password, college, branch, year, role) VALUES (?, ?, ?, ?, ?, ?, ?)",
    adminValues
  );
}

async function initDb() {
  try {
    await createTables();
    await ensureMigrations();
    await seedAdmin();
  } catch (error) {
    if (runtimeMode === "postgres") {
      if (isVercel) {
        throw new Error(`Postgres initialization failed on Vercel: ${error.message}`);
      }

      console.warn("Postgres initialization failed, falling back to SQLite.", error.message);
      runtimeMode = "sqlite";
      if (!sqliteDb) {
        sqliteDb = new sqlite3.Database(dbPath);
      }
      await createTables();
      await ensureMigrations();
      await seedAdmin();
      return;
    }

    throw error;
  }
}

function getPool() {
  return pgPool;
}

module.exports = {
  db: sqliteDb || pgPool,
  getPool,
  usePostgres: () => runtimeMode === "postgres",
  run,
  get,
  all,
  initDb,
};
