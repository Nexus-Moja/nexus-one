import http from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, resolve, normalize } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import Stripe from 'stripe';
import { securityHeaders } from './src/server/security.mjs';
import { installAuthSchema, ensureBootstrapAdmin, authenticate, resolveSession, requireRoles, revokeSession, ROLES } from './src/server/auth.mjs';
import { allowRequest } from './src/server/rate-limit.mjs';

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const APP_ORIGIN = (process.env.APP_ORIGIN || '').replace(/\/$/, '');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
}
const DIST = resolve('dist');
const DATA_DIR = resolve('data');
await mkdir(DATA_DIR, { recursive: true });
const db = new DatabaseSync(process.env.DB_PATH || join(DATA_DIR, 'nexus-one.sqlite'));
db.exec(`
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  service TEXT NOT NULL,
  pickup TEXT NOT NULL,
  destination TEXT NOT NULL,
  trip_date TEXT NOT NULL,
  trip_time TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  driver_name TEXT,
  vehicle_unit TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS partnerships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE NOT NULL,
  organization TEXT NOT NULL,
  type TEXT NOT NULL,
  contact TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  needs TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_reference TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS trip_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_reference TEXT NOT NULL,
  status TEXT NOT NULL,
  status_label TEXT NOT NULL,
  note TEXT,
  actor TEXT NOT NULL DEFAULT 'Nexus Operations',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trip_status_reference ON trip_status_history(booking_reference, created_at);
CREATE TABLE IF NOT EXISTS trip_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_reference TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trip_messages_reference ON trip_messages(booking_reference, created_at);
CREATE TABLE IF NOT EXISTS tracking_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  booking_reference TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_reference TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_session_id TEXT UNIQUE,
  provider_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'PENDING',
  customer_email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_booking_reference ON payments(booking_reference, created_at);
`);
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn('bookings', 'distance_miles', 'REAL');
ensureColumn('bookings', 'estimated_duration', 'TEXT');
ensureColumn('bookings', 'estimated_fare_cents', 'INTEGER');
ensureColumn('bookings', 'checkout_token', 'TEXT');
ensureColumn('bookings', 'payment_status', "TEXT NOT NULL DEFAULT 'UNPAID'");
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_checkout_token ON bookings(checkout_token)');

installAuthSchema(db);
ensureBootstrapAdmin(db);

const statusLabels = {
  SUBMITTED: 'Submitted — awaiting review',
  REVIEWING: 'Under coordination review',
  CONFIRMED: 'Confirmed',
  DRIVER_ASSIGNED: 'Driver assigned',
  EN_ROUTE: 'Vehicle en route',
  ARRIVED: 'Vehicle arrived',
  PATIENT_ON_BOARD: 'Patient on board',
  COMPLETED: 'Trip completed',
  CANCELLED: 'Cancelled',
  RECEIVED: 'Received',
  CONTACTED: 'Nexus follow-up in progress',
  PARTNERED: 'Facility partnership active'
};

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...securityHeaders(APP_ORIGIN)
  });
  res.end(body);
}
function clean(value, max = 500) {
  return String(value ?? '').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
}
function phoneDigits(value) { return clean(value, 30).replace(/\D/g, ''); }
function validEmail(value) { return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function createReference(prefix) {
  const d = new Date();
  const ymd = d.toISOString().slice(0,10).replaceAll('-','');
  const random = crypto.randomInt(1000, 9999);
  return `${prefix}-${ymd}-${random}`;
}
function uniqueReference(prefix, table) {
  for (let i=0;i<20;i++) {
    const ref = createReference(prefix);
    if (!db.prepare(`SELECT 1 FROM ${table} WHERE reference=?`).get(ref)) return ref;
  }
  return `${prefix}-${Date.now()}`;
}
function audit(type, reference, action, detail='') {
  db.prepare('INSERT INTO audit_log(entity_type,entity_reference,action,detail,created_at) VALUES(?,?,?,?,?)')
    .run(type, reference, action, detail, new Date().toISOString());
}
function addStatusHistory(reference, status, note='', actor='Nexus Operations') {
  const label = statusLabels[status] || status;
  db.prepare('INSERT INTO trip_status_history(booking_reference,status,status_label,note,actor,created_at) VALUES(?,?,?,?,?,?)')
    .run(reference, status, label, clean(note, 1000), clean(actor, 120) || 'Nexus Operations', new Date().toISOString());
}
function getHistory(reference) {
  return db.prepare('SELECT status,status_label AS statusLabel,note,actor,created_at AS createdAt FROM trip_status_history WHERE booking_reference=? ORDER BY created_at ASC').all(reference);
}
function getMessages(reference) {
  return db.prepare('SELECT id,sender_role AS senderRole,sender_name AS senderName,message,created_at AS createdAt FROM trip_messages WHERE booking_reference=? ORDER BY created_at ASC').all(reference);
}
function bookingAuthorized(reference, phone) {
  const row = db.prepare('SELECT * FROM bookings WHERE reference=?').get(reference);
  if (!row || phone.length < 7 || !phoneDigits(row.phone).endsWith(phone.slice(-7))) return null;
  return row;
}
function newTrackingToken() { return crypto.randomBytes(24).toString('base64url'); }
async function bodyBuffer(req, maxBytes = 150_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Request body too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function bodyJson(req) {
  const raw = (await bodyBuffer(req)).toString('utf8');
  try { return JSON.parse(raw || '{}'); } catch { throw new Error('Invalid JSON.'); }
}
function checkoutAmountForBooking(row) {
  const cents = Number(row?.estimated_fare_cents || 0);
  if (!Number.isInteger(cents) || cents < 100 || cents > 500_000) return null;
  return cents;
}
function paymentOrigin(req) {
  if (APP_ORIGIN) return APP_ORIGIN;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host || `localhost:${PORT}`}`;
}
function markPayment(session, status) {
  const reference = clean(session?.metadata?.booking_reference, 40).toUpperCase();
  if (!reference) return;
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO payments(booking_reference,provider,provider_session_id,provider_payment_intent_id,amount_cents,currency,status,customer_email,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(provider_session_id) DO UPDATE SET provider_payment_intent_id=excluded.provider_payment_intent_id,status=excluded.status,customer_email=excluded.customer_email,updated_at=excluded.updated_at`)
    .run(reference,'stripe',session.id,String(session.payment_intent || ''),Number(session.amount_total || 0),String(session.currency || 'usd'),status,clean(session.customer_details?.email || session.customer_email,180),now,now);
  if (status === 'PAID') {
    db.prepare("UPDATE bookings SET payment_status='PAID',updated_at=? WHERE reference=?").run(now, reference);
    audit('booking', reference, 'PAYMENT_PAID', `Stripe session ${session.id}`);
  } else if (status === 'FAILED') {
    db.prepare("UPDATE bookings SET payment_status='PAYMENT_FAILED',updated_at=? WHERE reference=?").run(now, reference);
    audit('booking', reference, 'PAYMENT_FAILED', `Stripe session ${session.id}`);
  }
}

function publicBooking(row) {
  return {
    reference: row.reference,
    service: row.service,
    pickup: row.pickup,
    destination: row.destination,
    date: row.trip_date,
    time: row.trip_time,
    status: row.status,
    statusLabel: statusLabels[row.status] || row.status,
    driverName: row.driver_name || '',
    vehicleUnit: row.vehicle_unit || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paymentStatus: row.payment_status || 'UNPAID'
  };
}
function isAdmin(req) { return req.headers['x-admin-key'] === ADMIN_KEY; }

async function api(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const rate = allowRequest(`login:${req.socket.remoteAddress || 'unknown'}`, 10, 15 * 60_000);
    if (!rate.allowed) return json(res, 429, { error: 'Too many login attempts. Try again later.', retryAfter: rate.retryAfter });
    try {
      const input = await bodyJson(req);
      const result = authenticate(db, input.email, input.password, { ip: req.socket.remoteAddress, userAgent: req.headers['user-agent'] });
      if (!result) return json(res, 401, { error: 'Invalid credentials or temporarily locked account.' });
      audit('user', result.user.email, 'LOGIN', result.user.role);
      return json(res, 200, result);
    } catch (e) { return json(res, 400, { error: e.message || 'Unable to authenticate.' }); }
  }
  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    const session = resolveSession(db, req);
    if (!session) return json(res, 401, { error: 'Authentication required.' });
    return json(res, 200, { user: { id: session.id, email: session.email, displayName: session.display_name, role: session.role }, expiresAt: session.expires_at });
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const session = resolveSession(db, req);
    if (session) revokeSession(db, session.session_id);
    return json(res, 200, { success: true });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/audit') {
    const session = resolveSession(db, req);
    if (!requireRoles(session, [ROLES.ADMIN, ROLES.QA, ROLES.EXECUTIVE])) return json(res, 403, { error: 'Insufficient permissions.' });
    const rows = db.prepare('SELECT entity_type AS entityType,entity_reference AS entityReference,action,detail,created_at AS createdAt FROM audit_log ORDER BY id DESC LIMIT 250').all();
    return json(res, 200, { records: rows });
  }
  if (req.method === 'POST' && url.pathname === '/api/payments/stripe/checkout') {
    const rate = allowRequest(`stripe-checkout:${req.socket.remoteAddress || 'unknown'}`, 20, 15 * 60_000);
    if (!rate.allowed) return json(res, 429, { error: 'Too many checkout attempts. Try again later.', retryAfter: rate.retryAfter });
    if (!stripe) return json(res, 503, { error: 'Stripe Checkout is not configured on the server.' });
    try {
      const input = await bodyJson(req);
      const reference = clean(input.reference, 40).toUpperCase();
      const checkoutToken = clean(input.checkoutToken, 120);
      const booking = db.prepare('SELECT * FROM bookings WHERE reference=? AND checkout_token=?').get(reference, checkoutToken);
      if (!booking) return json(res, 404, { error: 'Unable to verify this booking for payment.' });
      const amountCents = checkoutAmountForBooking(booking);
      if (!amountCents) return json(res, 409, { error: 'A verified fare is required before checkout can begin.' });
      const existing = db.prepare("SELECT provider_session_id FROM payments WHERE booking_reference=? AND status='PENDING' ORDER BY id DESC LIMIT 1").get(reference);
      if (existing?.provider_session_id) {
        try {
          const prior = await stripe.checkout.sessions.retrieve(existing.provider_session_id);
          if (prior?.status === 'open' && prior.url) return json(res, 200, { url: prior.url, sessionId: prior.id, reused: true });
        } catch {}
      }
      const origin = paymentOrigin(req);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: booking.email || undefined,
        client_reference_id: reference,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: `Nexus Medical Transit — ${booking.service}`,
              description: `Transportation request ${reference}`
            }
          }
        }],
        metadata: { booking_reference: reference, service: booking.service },
        payment_intent_data: { metadata: { booking_reference: reference } },
        success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?payment=cancelled&reference=${encodeURIComponent(reference)}`,
        billing_address_collection: 'auto',
        phone_number_collection: { enabled: true }
      }, { idempotencyKey: `checkout-${reference}-${amountCents}` });
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO payments(booking_reference,provider,provider_session_id,amount_cents,currency,status,customer_email,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(provider_session_id) DO NOTHING`)
        .run(reference,'stripe',session.id,amountCents,'usd','PENDING',booking.email || '',now,now);
      audit('booking', reference, 'STRIPE_CHECKOUT_CREATED', session.id);
      return json(res, 201, { url: session.url, sessionId: session.id });
    } catch (e) {
      console.error('Stripe checkout error:', e);
      return json(res, 400, { error: e?.message || 'Unable to start Stripe Checkout.' });
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/payments/stripe/webhook') {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) return json(res, 503, { error: 'Stripe webhook is not configured.' });
    try {
      const raw = await bodyBuffer(req, 1_000_000);
      const signature = req.headers['stripe-signature'];
      const event = stripe.webhooks.constructEvent(raw, signature, STRIPE_WEBHOOK_SECRET);
      const session = event.data.object;
      if (event.type === 'checkout.session.completed' && session.payment_status === 'paid') markPayment(session, 'PAID');
      if (event.type === 'checkout.session.async_payment_succeeded') markPayment(session, 'PAID');
      if (event.type === 'checkout.session.async_payment_failed') markPayment(session, 'FAILED');
      return json(res, 200, { received: true });
    } catch (e) {
      console.error('Stripe webhook error:', e.message);
      return json(res, 400, { error: 'Invalid Stripe webhook.' });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/payments/stripe/session') {
    if (!stripe) return json(res, 503, { error: 'Stripe Checkout is not configured on the server.' });
    try {
      const sessionId = clean(url.searchParams.get('session_id'), 160);
      if (!sessionId.startsWith('cs_')) return json(res, 400, { error: 'Invalid checkout session.' });
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      return json(res, 200, {
        reference: session.metadata?.booking_reference || session.client_reference_id || '',
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email || session.customer_email || '',
        amountTotal: session.amount_total,
        currency: session.currency
      });
    } catch (e) { return json(res, 404, { error: 'Checkout session not found.' }); }
  }
  if (req.method === 'GET' && url.pathname === '/api/health') {
    const count = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;
    return json(res, 200, { status:'healthy', service:'NEXUS ONE', bookings:Number(count), timestamp:new Date().toISOString() });
  }
  if (req.method === 'POST' && url.pathname === '/api/bookings') {
    try {
      const input = await bodyJson(req);
      const data = {
        name: clean(input.name,120), phone: clean(input.phone,30), email: clean(input.email,180),
        service: clean(input.service,120), pickup: clean(input.pickup,300), destination: clean(input.destination,300),
        date: clean(input.date,10), time: clean(input.time,8), notes: clean(input.notes,2000),
        distanceMiles: Number(input.distanceMiles || 0), estimatedDuration: clean(input.estimatedDuration,80), estimatedFare: Number(input.estimatedFare || 0)
      };
      if (!data.name || phoneDigits(data.phone).length < 7 || !data.service || !data.pickup || !data.destination || !data.date || !data.time)
        return json(res,400,{error:'Please complete all required fields with a valid phone number.'});
      if (!validEmail(data.email)) return json(res,400,{error:'Please enter a valid email address.'});
      const reference = uniqueReference('NMT','bookings');
      const now = new Date().toISOString();
      const checkoutToken = crypto.randomBytes(24).toString('base64url');
      const distanceMiles = Number.isFinite(data.distanceMiles) && data.distanceMiles > 0 && data.distanceMiles < 1000 ? data.distanceMiles : null;
      const estimatedFareCents = Number.isFinite(data.estimatedFare) && data.estimatedFare >= 1 && data.estimatedFare <= 5000 ? Math.round(data.estimatedFare * 100) : null;
      db.prepare(`INSERT INTO bookings(reference,name,phone,email,service,pickup,destination,trip_date,trip_time,notes,status,distance_miles,estimated_duration,estimated_fare_cents,checkout_token,payment_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(reference,data.name,data.phone,data.email,data.service,data.pickup,data.destination,data.date,data.time,data.notes,'SUBMITTED',distanceMiles,data.estimatedDuration,estimatedFareCents,checkoutToken,'UNPAID',now,now);
      audit('booking',reference,'CREATED',`Service: ${data.service}`);
      addStatusHistory(reference, 'SUBMITTED', 'Transportation request received and queued for coordination.', 'Nexus LiveCare');
      const row = db.prepare('SELECT * FROM bookings WHERE reference=?').get(reference);
      return json(res,201,{success:true,booking:{...publicBooking(row),checkoutToken}});
    } catch (e) { return json(res,400,{error:e.message || 'Unable to create booking.'}); }
  }
  const bookingMatch = url.pathname.match(/^\/api\/bookings\/([^/]+)$/);
  if (req.method === 'GET' && bookingMatch) {
    const reference = clean(decodeURIComponent(bookingMatch[1]),40).toUpperCase();
    const phone = phoneDigits(url.searchParams.get('phone'));
    const row = db.prepare('SELECT * FROM bookings WHERE reference=?').get(reference);
    if (!row || phone.length < 7 || !phoneDigits(row.phone).endsWith(phone.slice(-7))) return json(res,404,{error:'No request matched that reference and phone number.'});
    return json(res,200,{booking:publicBooking(row),history:getHistory(reference),messages:getMessages(reference)});
  }
  const livecareMatch = url.pathname.match(/^\/api\/livecare\/([^/]+)$/);
  if (req.method === 'GET' && livecareMatch) {
    const reference = clean(decodeURIComponent(livecareMatch[1]),40).toUpperCase();
    const phone = phoneDigits(url.searchParams.get('phone'));
    const row = bookingAuthorized(reference, phone);
    if (!row) return json(res,404,{error:'No trip matched that confirmation reference and phone number.'});
    return json(res,200,{booking:publicBooking(row),history:getHistory(reference),messages:getMessages(reference),serverTime:new Date().toISOString()});
  }
  if (req.method === 'POST' && livecareMatch && url.searchParams.get('action') === 'message') {
    try {
      const reference = clean(decodeURIComponent(livecareMatch[1]),40).toUpperCase();
      const input = await bodyJson(req); const phone = phoneDigits(input.phone); const row = bookingAuthorized(reference, phone);
      if (!row) return json(res,404,{error:'Unable to verify this trip.'});
      const message = clean(input.message,1000); if(message.length < 2) return json(res,400,{error:'Please enter a message.'});
      const senderName = clean(input.senderName,120) || 'Patient / Caregiver';
      db.prepare('INSERT INTO trip_messages(booking_reference,sender_role,sender_name,message,created_at) VALUES(?,?,?,?,?)').run(reference,'CLIENT',senderName,message,new Date().toISOString());
      audit('booking',reference,'CLIENT_MESSAGE',message);
      return json(res,201,{success:true,messages:getMessages(reference)});
    } catch(e) { return json(res,400,{error:e.message || 'Unable to send message.'}); }
  }
  if (req.method === 'POST' && livecareMatch && url.searchParams.get('action') === 'share') {
    try {
      const reference = clean(decodeURIComponent(livecareMatch[1]),40).toUpperCase();
      const input = await bodyJson(req); const phone = phoneDigits(input.phone); const row = bookingAuthorized(reference, phone);
      if (!row) return json(res,404,{error:'Unable to verify this trip.'});
      const hours = Math.min(72, Math.max(1, Number(input.hours || 24))); const token = newTrackingToken();
      const expires = new Date(Date.now()+hours*3600000).toISOString();
      db.prepare('INSERT INTO tracking_links(token,booking_reference,expires_at,created_at) VALUES(?,?,?,?)').run(token,reference,expires,new Date().toISOString());
      audit('booking',reference,'TRACKING_LINK_CREATED',`Expires ${expires}`);
      return json(res,201,{success:true,url:`/livecare.html?share=${encodeURIComponent(token)}`,expiresAt:expires});
    } catch(e) { return json(res,400,{error:e.message || 'Unable to create tracking link.'}); }
  }
  const sharedMatch = url.pathname.match(/^\/api\/shared-trip\/([^/]+)$/);
  if (req.method === 'GET' && sharedMatch) {
    const token=clean(decodeURIComponent(sharedMatch[1]),100); const link=db.prepare('SELECT * FROM tracking_links WHERE token=? AND revoked=0').get(token);
    if(!link || new Date(link.expires_at).getTime() < Date.now()) return json(res,404,{error:'This tracking link is invalid or expired.'});
    const row=db.prepare('SELECT * FROM bookings WHERE reference=?').get(link.booking_reference);
    if(!row) return json(res,404,{error:'Trip not found.'});
    return json(res,200,{booking:publicBooking(row),history:getHistory(row.reference),expiresAt:link.expires_at,shared:true});
  }
  if (req.method === 'POST' && url.pathname === '/api/partnerships') {
    try {
      const input=await bodyJson(req);
      const data={organization:clean(input.organization,180),type:clean(input.type,100),contact:clean(input.contact,120),email:clean(input.email,180),phone:clean(input.phone,30),needs:clean(input.needs,3000)};
      if(!data.organization||!data.type||!data.contact||!data.email||!data.phone||!data.needs) return json(res,400,{error:'Please complete all required partnership fields.'});
      if(!validEmail(data.email)||phoneDigits(data.phone).length<7) return json(res,400,{error:'Please provide a valid work email and phone number.'});
      const reference=uniqueReference('NXP','partnerships'); const now=new Date().toISOString();
      db.prepare(`INSERT INTO partnerships(reference,organization,type,contact,email,phone,needs,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
        .run(reference,data.organization,data.type,data.contact,data.email,data.phone,data.needs,'RECEIVED',now,now);
      audit('partnership',reference,'CREATED',data.organization);
      return json(res,201,{success:true,partnership:{reference,organization:data.organization,status:'RECEIVED',statusLabel:statusLabels.RECEIVED}});
    } catch(e){ return json(res,400,{error:e.message||'Unable to submit partnership request.'}); }
  }
  if (url.pathname.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return json(res,401,{error:'Unauthorized.'});
    if (req.method==='GET' && url.pathname==='/api/admin/bookings') {
      const rows=db.prepare('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 500').all();
      return json(res,200,{bookings:rows.map(r=>({...publicBooking(r),name:r.name,phone:r.phone,email:r.email,notes:r.notes}))});
    }
    if (req.method==='GET' && url.pathname==='/api/admin/partnerships') {
      const rows=db.prepare('SELECT * FROM partnerships ORDER BY created_at DESC LIMIT 500').all();
      return json(res,200,{partnerships:rows.map(r=>({...r,statusLabel:statusLabels[r.status]||r.status}))});
    }
    const update=url.pathname.match(/^\/api\/admin\/bookings\/([^/]+)$/);
    if(req.method==='PATCH'&&update){
      try{const input=await bodyJson(req);const reference=clean(decodeURIComponent(update[1]),40).toUpperCase();const allowed=['SUBMITTED','REVIEWING','CONFIRMED','DRIVER_ASSIGNED','EN_ROUTE','ARRIVED','PATIENT_ON_BOARD','COMPLETED','CANCELLED'];const status=clean(input.status,40).toUpperCase();if(!allowed.includes(status))return json(res,400,{error:'Invalid status.'});const existing=db.prepare('SELECT * FROM bookings WHERE reference=?').get(reference);if(!existing)return json(res,404,{error:'Booking not found.'});const now=new Date().toISOString();db.prepare('UPDATE bookings SET status=?,driver_name=?,vehicle_unit=?,updated_at=? WHERE reference=?').run(status,clean(input.driverName,120),clean(input.vehicleUnit,80),now,reference);if(existing.status!==status)addStatusHistory(reference,status,clean(input.note,1000),clean(input.actor,120)||'Nexus Dispatch');audit('booking',reference,'STATUS_UPDATED',status);const row=db.prepare('SELECT * FROM bookings WHERE reference=?').get(reference);return json(res,200,{booking:publicBooking(row),history:getHistory(reference)});}catch(e){return json(res,400,{error:e.message});}
    }
    const detail=url.pathname.match(/^\/api\/admin\/livecare\/([^/]+)$/);
    if(req.method==='GET'&&detail){const reference=clean(decodeURIComponent(detail[1]),40).toUpperCase();const row=db.prepare('SELECT * FROM bookings WHERE reference=?').get(reference);if(!row)return json(res,404,{error:'Booking not found.'});return json(res,200,{booking:{...publicBooking(row),name:row.name,phone:row.phone,email:row.email,notes:row.notes},history:getHistory(reference),messages:getMessages(reference)});}
    if(req.method==='POST'&&detail){try{const reference=clean(decodeURIComponent(detail[1]),40).toUpperCase();const row=db.prepare('SELECT * FROM bookings WHERE reference=?').get(reference);if(!row)return json(res,404,{error:'Booking not found.'});const input=await bodyJson(req);const message=clean(input.message,1000);if(message.length<2)return json(res,400,{error:'Please enter a message.'});db.prepare('INSERT INTO trip_messages(booking_reference,sender_role,sender_name,message,created_at) VALUES(?,?,?,?,?)').run(reference,'DISPATCH',clean(input.senderName,120)||'Nexus Dispatch',message,new Date().toISOString());audit('booking',reference,'DISPATCH_MESSAGE',message);return json(res,201,{success:true,messages:getMessages(reference)});}catch(e){return json(res,400,{error:e.message||'Unable to send message.'});}}
  }
  return false;
}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json; charset=utf-8'};
async function serveStatic(req,res,url){
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==='/operations') pathname='/operations.html';
  let filePath=resolve(DIST, '.'+normalize(pathname));
  if(!filePath.startsWith(DIST)) return json(res,403,{error:'Forbidden.'});
  try{let info=await stat(filePath);if(info.isDirectory())filePath=join(filePath,'index.html');}catch{filePath=join(DIST,'index.html');}
  try{const info=await stat(filePath);res.writeHead(200,{'Content-Type':mime[extname(filePath)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':extname(filePath)==='.html'?'no-cache':'public, max-age=86400','X-Content-Type-Options':'nosniff'});createReadStream(filePath).pipe(res);}catch{return json(res,404,{error:'Not found.'});}
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(url.pathname.startsWith('/api/')){const handled=await api(req,res,url);if(handled===false)return json(res,404,{error:'API route not found.'});return;}
    return serveStatic(req,res,url);
  }catch(e){console.error(e);return json(res,500,{error:'Internal server error.'});}
});
server.listen(PORT,HOST,()=>console.log(`NEXUS ONE running at http://${HOST}:${PORT}`));
