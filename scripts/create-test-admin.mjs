import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL;
if (!connectionString) {
  console.error('Missing DATABASE_URL or NETLIFY_DB_URL.');
  process.exit(1);
}

const email = String(process.env.NEXUS_ADMIN_EMAIL || 'admin@nexusmt.com').trim().toLowerCase();
const password = String(process.env.NEXUS_ADMIN_PASSWORD || 'NexusAdmin042!');
const displayName = String(process.env.NEXUS_ADMIN_NAME || 'Nexus Test Administrator').trim();

if (password.length < 12) {
  console.error('NEXUS_ADMIN_PASSWORD must contain at least 12 characters.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false }
});

const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const table = await client.query("SELECT to_regclass('public.users') AS name");
  if (!table.rows[0]?.name) throw new Error('The users table does not exist. Run the earlier database migrations first.');

  const columnResult = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users'
  `);
  const columns = new Set(columnResult.rows.map(row => row.column_name));
  for (const required of ['email', 'display_name', 'password_hash', 'role', 'active']) {
    if (!columns.has(required)) throw new Error(`The users table is missing required column: ${required}`);
  }

  const existing = await client.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1', [email]);
  if (existing.rows[0]) {
    await client.query(
      `UPDATE users SET display_name=$2,password_hash=$3,role='ADMIN',active=true${columns.has('scope_id') ? ',scope_id=NULL' : ''} WHERE id=$1`,
      [existing.rows[0].id, displayName, passwordHash]
    );
  } else {
    const names = ['email', 'display_name', 'password_hash', 'role', 'active'];
    const values = [email, displayName, passwordHash, 'ADMIN', true];
    if (columns.has('scope_id')) { names.push('scope_id'); values.push(null); }
    const placeholders = values.map((_, index) => `$${index + 1}`).join(',');
    await client.query(`INSERT INTO users(${names.join(',')}) VALUES(${placeholders})`, values);
  }

  await client.query('COMMIT');
  console.log('Admin test account is ready.');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log('Sign in through Livecare using Dispatch sign in, then open /admin.html.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
