import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export const DEFAULT_DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, '../../../data/barangay_data.sqlite');

let currentDb: Database.Database | null = null;
let currentDbPath: string = DEFAULT_DB_PATH;

/**
 * Creates a standalone better-sqlite3 database connection and applies
 * WAL mode, normal synchronization, and foreign key enforcement pragmas.
 */
export function createDbConnection(
  dbPath: string = DEFAULT_DB_PATH,
  options?: Database.Options
): Database.Database {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const instance = new Database(dbPath, options);

  // Apply required SQLite Pragmas
  instance.pragma('journal_mode = WAL');
  instance.pragma('synchronous = NORMAL');
  instance.pragma('foreign_keys = ON');

  return instance;
}

/**
 * Initializes or re-initializes the global singleton database instance.
 */
export function initDb(
  dbPath: string = DEFAULT_DB_PATH,
  options?: Database.Options
): Database.Database {
  if (currentDb && currentDb.open) {
    try {
      currentDb.close();
    } catch {
      // Ignore if already closed
    }
  }

  currentDb = createDbConnection(dbPath, options);
  currentDbPath = dbPath;
  return currentDb;
}

/**
 * Retrieves the active singleton database instance, creating it if not already open.
 */
export function getDb(
  dbPath?: string,
  options?: Database.Options
): Database.Database {
  if (!currentDb || !currentDb.open || (dbPath !== undefined && dbPath !== currentDbPath)) {
    return initDb(dbPath ?? currentDbPath, options);
  }
  return currentDb;
}

/**
 * Closes the active singleton database connection.
 */
export function closeDb(): void {
  if (currentDb && currentDb.open) {
    currentDb.close();
    currentDb = null;
  }
}

/**
 * Singleton database instance proxy. Delegates dynamically to getDb(),
 * allowing hot-reconfiguration in tests while preserving a direct singleton export.
 */
export const db: Database.Database = new Proxy(
  Object.create(Database.prototype) as Database.Database,
  {
    getPrototypeOf(_target) {
      return Database.prototype;
    },
    get(_target, prop) {
      const activeDb = getDb();
      const value = (activeDb as any)[prop];
      if (typeof value === 'function') {
        return value.bind(activeDb);
      }
      return value;
    },
    set(_target, prop, value) {
      const activeDb = getDb();
      (activeDb as any)[prop] = value;
      return true;
    }
  }
);

export default db;
