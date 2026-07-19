import { createPostgresPool, checkPostgres } from '../src/server/database/postgres.mjs';
const pool = createPostgresPool(process.env.DATABASE_URL);
try { console.log(JSON.stringify(await checkPostgres(pool), null, 2)); }
finally { await pool.end(); }
