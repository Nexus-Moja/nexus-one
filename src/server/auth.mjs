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

export function authenticate(db, email, password, meta = {}) {
  const normalized = String(email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(normalized);
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
  return db.prepare(`SELECT u.id,u.email,u.display_name,u.role,s.expires_at,s.id AS session_id
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
  return { id: user.id, email: user.email, displayName: user.display_name, role: user.role };
}
