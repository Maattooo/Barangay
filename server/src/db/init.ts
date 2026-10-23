import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { db } from './connection';

/**
 * Reads the raw SQL content from schema.sql.
 */
export function getSqlSchema(): string {
  const candidates = [
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../../src/db/schema.sql'),
    path.resolve(__dirname, '../src/db/schema.sql'),
    path.resolve(process.cwd(), 'src/db/schema.sql'),
    path.resolve(process.cwd(), 'server/src/db/schema.sql')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf8');
    }
  }

  throw new Error(`schema.sql not found in any searched locations: ${candidates.join(', ')}`);
}

/**
 * Executes the DDL schema against the specified database instance (defaults to singleton).
 * Also performs idempotent column migrations on existing certificate_templates tables.
 */
export function initSchema(targetDb: Database.Database = db): void {
  const schemaSql = getSqlSchema();
  targetDb.exec(schemaSql);

  // Ensure existing certificate_templates table has the new template & docx columns
  try {
    const cols = targetDb.prepare("PRAGMA table_info(certificate_templates)").all() as { name: string }[];
    const colNames = new Set(cols.map((c) => c.name));

    const migrations: [string, string][] = [
      ['template_category', "TEXT NOT NULL DEFAULT 'certificate'"],
      ['paper_size', "TEXT NOT NULL DEFAULT 'a4'"],
      ['header_html', "TEXT NOT NULL DEFAULT ''"],
      ['header_config_json', "TEXT NOT NULL DEFAULT '{}'"],
      ['footer_html', "TEXT NOT NULL DEFAULT ''"],
      ['docx_filename', "TEXT NOT NULL DEFAULT ''"]
    ];

    for (const [col, def] of migrations) {
      if (!colNames.has(col)) {
        targetDb.exec(`ALTER TABLE certificate_templates ADD COLUMN ${col} ${def};`);
      }
    }
  } catch {
    // Ignore migration check errors on uninitialized tables
  }
}

// Execute when invoked directly via CLI (tsx src/db/init.ts or node dist/db/init.js)
const isDirectRun =
  require.main === module ||
  (process.argv[1] !== undefined &&
    (process.argv[1].endsWith('init.ts') || process.argv[1].endsWith('init.js')));

if (isDirectRun) {
  try {
    console.log('[Database] Initializing database schema...');
    initSchema();
    console.log('[Database] Database schema initialized successfully.');
  } catch (error) {
    console.error('[Database] Schema initialization failed:', error);
    process.exit(1);
  }
}
