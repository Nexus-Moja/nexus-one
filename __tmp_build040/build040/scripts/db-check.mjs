import { readFile } from 'node:fs/promises';
const sql = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
const required = ['users','sessions','bookings','partnerships','audit_log','trip_status_history','trip_messages','tracking_links','schema_migrations'];
for (const table of required) {
  if (!new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}\\b`, 'i').test(sql)) throw new Error(`Missing table: ${table}`);
}
for (const unsafe of ['AUTOINCREMENT','PRAGMA journal_mode','date(\'now\')']) {
  if (sql.includes(unsafe)) throw new Error(`SQLite-specific SQL found: ${unsafe}`);
}
console.log(`PostgreSQL schema check passed (${required.length} tables).`);
