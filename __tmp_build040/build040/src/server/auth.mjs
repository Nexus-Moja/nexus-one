import { hashPassword, verifyPassword, randomToken, tokenDigest } from './security.mjs';

export const ROLES = Object.freeze({
  ADMIN: 'ADMIN', EXECUTIVE: 'EXECUTIVE', DISPATCHER: 'DISPATCHER',
  DRIVER: 'DRIVER', BILLING: 'BILLING', QA: 'QA', FACILITY: 'FACILITY', PATIENT: 'PATIENT'
});

export function installAuthSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE,
      account_number TEXT UNIQUE,
      scope_id TEXT,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      failed_logins INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_digest TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_digest ON sessions(token_digest);
  `);
}

export function ensureBootstrapAdmin(db) {
  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '');
  if (!email || password.length < 12) return false;
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return false;
  const now = new Date().toISOString();
  db.prepare('INSERT INTO users(email,display_name,password_hash,role,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .run(email, 'NEXUS Administrator', hashPassword(password), ROLES.ADMIN, now, now);
  return true;
}

export function ensurePreviewAccounts(db) {
  const enabled = process.env.ENABLE_PREVIEW_ACCOUNTS !== 'false' && process.env.NODE_ENV !== 'production';
  if (!enabled) return [];
  const password = String(process.env.PREVIEW_ACCOUNT_PASSWORD || 'NexusDemo!2026');
  const now = new Date().toISOString();
  const accounts = [
    { email: 'facility.preview@nexusmt.local', username: null, accountNumber: 'FAC-1001', scopeId: 'FAC-DEMO-001', displayName: 'Preview Facility Administrator', role: ROLES.FACILITY },
    { email: 'dispatch.preview@nexusmt.local', username: 'dispatch.demo', accountNumber: null, scopeId: null, displayName: 'Preview Dispatcher', role: ROLES.DISPATCHER },
    { email: 'driver.preview@nexusmt.local', username: 'driver.demo', accountNumber: null, scopeId: 'DRV-DEMO-001', displayName: 'Preview Driver', role: ROLES.DRIVER }
  ];
  const created = [];
  for (const account of accounts) {
    const existing = db.prepare('SELECT id FROM users WHERE lower(email)=lower(?)').get(account.email);
    if (!existing) {
      db.prepare(`INSERT INTO users(email,username,account_number,scope_id,display_name,password_hash,role,active,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).run(account.email, account.username, account.accountNumber, account.scopeId, account.displayName, hashPassword(password), account.role, 1, now, now);
      created.push(account.role);
    }
  }
  return created;
}

export function authenticate(db, email, password, meta = {}) {
  const normalized = String(email || '').trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE active=1 AND (lower(email)=? OR lower(COALESCE(username,''))=? OR lower(COALESCE(account_number,''))=?)").get(normalized, normalized, normalized);
  if (!user) return null;
  if (user.locked_until && new Date(user.locked_until) > new Date()) return null;
  if (!verifyPassword(String(password || ''), user.password_hash)) {
    const attempts = Number(user.failed_logins || 0) + 1;
    const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
    db.prepare('UPDATE users SET failed_logins=?,locked_until=?,updated_at=? WHERE id=?')
      .run(attempts, lockedUntil, new Date().toISOString(), user.id);
    return null;
  }
  db.prepare('UPDATE users SET failed_logins=0,locked_until=NULL,updated_at=? WHERE id=?').run(new Date().toISOString(), user.id);
  const token = randomToken();
  const ttlMinutes = Math.max(15, Number(process.env.SESSION_TTL_MINUTES || 480));
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  db.prepare('INSERT INTO sessions(token_digest,user_id,expires_at,ip_address,user_agent,created_at) VALUES(?,?,?,?,?,?)')
    .run(tokenDigest(token), user.id, expiresAt, meta.ip || '', meta.userAgent || '', new Date().toISOString());
  return { token, expiresAt, user: publicUser(user) };
}

export function resolveSession(db, req) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  return db.prepare(`SELECT u.id,u.email,u.username,u.account_number,u.scope_id,u.display_name,u.role,s.expires_at,s.id AS session_id
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_digest=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.active=1`)
    .get(tokenDigest(token), new Date().toISOString()) || null;
}

export function requireRoles(session, roles = []) {
  return Boolean(session && (!roles.length || roles.includes(session.role)));
}

export function revokeSession(db, sessionId) {
  db.prepare('UPDATE sessions SET revoked_at=? WHERE id=?').run(new Date().toISOString(), sessionId);
}

function publicUser(user) {
  return { id: user.id, email: user.email, username: user.username || '', accountNumber: user.account_number || '', scopeId: user.scope_id || '', displayName: user.display_name, role: user.role };
}
