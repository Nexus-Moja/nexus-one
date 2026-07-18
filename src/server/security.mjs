import crypto from 'node:crypto';

export function securityHeaders(origin = '') {
  const connect = ["'self'", 'https://maps.googleapis.com', 'https://maps.gstatic.com', 'https://cdn.ywxi.net', 'https://www.trustedsite.com', 'https://api.trustedsite.com'];
  if (origin) connect.push(origin);
  return {
    'Content-Security-Policy': `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' https://maps.googleapis.com https://cdn.ywxi.net; connect-src ${connect.join(' ')}; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(self)',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, encoded) {
  const [salt, expected] = String(encoded || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha512');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function tokenDigest(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
