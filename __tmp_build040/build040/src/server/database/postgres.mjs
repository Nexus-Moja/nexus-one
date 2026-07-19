import pg from 'pg';
const { Pool } = pg;
export function createPostgresPool(databaseUrl, options = {}) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  return new Pool({ connectionString: databaseUrl, max: Number(options.max || process.env.DB_POOL_MAX || 10), idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000), connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000), ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } });
}
export async function checkPostgres(pool) {
  const started = Date.now();
  const result = await pool.query('SELECT current_database() AS database, current_user AS user, now() AS server_time');
  return { ...result.rows[0], latencyMs: Date.now() - started };
}
