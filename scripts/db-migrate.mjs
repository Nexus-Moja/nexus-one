import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPostgresPool } from '../src/server/database/postgres.mjs';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required for db:migrate.');
const pool = createPostgresPool(url);
try {
  const directory = resolve('database/migrations');
  const files = (await readdir(directory)).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(resolve(directory, file), 'utf8');
    await pool.query(sql);
    console.log(`Applied ${file}`);
  }
} finally { await pool.end(); }
