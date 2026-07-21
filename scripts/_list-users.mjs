import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.NETLIFY_DB_URL,
  ssl: { rejectUnauthorized: false }
});

const r = await pool.query(`SELECT id, email, role, active FROM users ORDER BY id`);
console.log('All users in database:');
console.table(r.rows);
await pool.end();
