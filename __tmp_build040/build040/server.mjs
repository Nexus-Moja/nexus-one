import http from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, resolve, normalize } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { securityHeaders } from './src/server/security.mjs';
import { installAuthSchema, ensureBootstrapAdmin, ensurePreviewAccounts, authenticate, resolveSession, requireRoles, revokeSession, ROLES } from './src/server/auth.mjs';
import { allowRequest } from './src/server/rate-limit.mjs';
import { config, validateEnvironment } from './src/server/config/environment.mjs';

validateEnvironment();
const PORT = config.app.port;
const HOST = config.app.host;
const ADMIN_KEY = config.auth.adminKey;
const APP_ORIGIN = config.app.origin;
const DIST = resolve('dist');
const DATA_DIR = config.database.dataDirectory;
await mkdir(DATA_DIR, { recursive: true });
const db = new DatabaseSync(config.database.path);
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
  facility_id TEXT,
  driver_scope_id TEXT,
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
`);
installAuthSchema(db);
for (const sql of [
  'ALTER TABLE users ADD COLUMN username TEXT',
  'ALTER TABLE users ADD COLUMN account_number TEXT',
  'ALTER TABLE users ADD COLUMN scope_id TEXT',
  'ALTER TABLE bookings ADD COLUMN facility_id TEXT',
  'ALTER TABLE bookings ADD COLUMN driver_scope_id TEXT'
]) { try { db.exec(sql); } catch {} }
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL'); } catch {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account ON users(account_number) WHERE account_number IS NOT NULL'); } catch {}
ensureBootstrapAdmin(db);
ensurePreviewAccounts(db);
seedPreviewPortalData();

function seedPreviewPortalData() {
  const previewEnabled = config.auth.enablePreviewAccounts && !config.isProduction;
  if (!previewEnabled) return;
  const existing = db.prepare("SELECT 1 FROM bookings WHERE reference LIKE 'NMT-PREVIEW-%' LIMIT 1").get();
  if (existing) return;
  const now = new Date().toISOString();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0,10);
  const rows = [
    ['NMT-PREVIEW-1001','Jordan Miles','3015550142','jordan@example.com','Wheelchair Transportation','100 Main Street, Rockville, MD','Shady Grove Medical Center',tomorrow,'09:30','Main entrance','CONFIRMED','Avery K.','Unit 204','FAC-DEMO-001','DRV-DEMO-001'],
    ['NMT-PREVIEW-1002','Taylor Reed','3015550198','taylor@example.com','Ambulatory Transportation','Preview Care Center','Dialysis Center',tomorrow,'13:00','Return trip requested','DRIVER_ASSIGNED','Avery K.','Unit 204','FAC-DEMO-001','DRV-DEMO-001']
  ];
  const insert = db.prepare(`INSERT INTO bookings(reference,name,phone,email,service,pickup,destination,trip_date,trip_time,notes,status,driver_name,vehicle_unit,facility_id,driver_scope_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const row of rows) { insert.run(...row, now, now); }
}

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
async function bodyJson(req) {
  let raw='';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 150_000) throw new Error('Request body too large.');
  }
  try { return JSON.parse(raw || '{}'); } catch { throw new Error('Invalid JSON.'); }
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
    updatedAt: row.updated_at
  };
}
function isAdmin(req) { return req.headers['x-admin-key'] === ADMIN_KEY; }

async function api(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/livecare/overview') {
    const rows = db.prepare(`SELECT reference,service,status,trip_time,updated_at FROM bookings WHERE status NOT IN ('CANCELLED') ORDER BY CASE WHEN status IN ('EN_ROUTE','ARRIVED','PATIENT_ON_BOARD') THEN 0 ELSE 1 END, updated_at DESC LIMIT 40`).all();
    const completedToday = db.prepare(`SELECT COUNT(*) AS count FROM bookings WHERE status='COMPLETED' AND date(updated_at)=date('now')`).get().count;
    const trips = rows.map(row => ({
      reference: `NMT-••••-${String(row.reference || '').slice(-4)}`,
      service: row.service,
      status: row.status,
      statusLabel: statusLabels[row.status] || row.status,
      time: row.trip_time || '',
      updatedAt: row.updated_at
    }));
    return json(res, 200, { scope: 'PUBLIC_ANONYMIZED', completedToday, trips });
  }
  if (req.method === 'GET' && url.pathname === '/api/fleet/live') {
    const session = resolveSession(db, req);
    let rows = [];
    let scope = 'PUBLIC_ANONYMIZED';
    if (session) {
      scope = session.role;
      if ([ROLES.ADMIN, ROLES.DISPATCHER, ROLES.EXECUTIVE, ROLES.QA].includes(session.role)) {
        rows = db.prepare(`SELECT * FROM bookings WHERE status NOT IN ('COMPLETED','CANCELLED') ORDER BY updated_at DESC LIMIT 40`).all();
      } else if (session.role === ROLES.FACILITY && session.scope_id) {
        rows = db.prepare(`SELECT * FROM bookings WHERE facility_id=? AND status NOT IN ('COMPLETED','CANCELLED') ORDER BY updated_at DESC LIMIT 30`).all(session.scope_id);
      } else if (session.role === ROLES.DRIVER && session.scope_id) {
        rows = db.prepare(`SELECT * FROM bookings WHERE driver_scope_id=? AND status NOT IN ('COMPLETED','CANCELLED') ORDER BY updated_at DESC LIMIT 20`).all(session.scope_id);
      }
    } else {
      rows = db.prepare(`SELECT * FROM bookings WHERE status NOT IN ('COMPLETED','CANCELLED') ORDER BY updated_at DESC LIMIT 30`).all();
    }
    const hash = value => [...String(value || '')].reduce((n,c)=>((n*31)+c.charCodeAt(0))>>>0, 2166136261);
    const progressFor = status => ({SUBMITTED:5,REVIEWING:12,CONFIRMED:20,DRIVER_ASSIGNED:30,EN_ROUTE:55,ARRIVED:68,PATIENT_ON_BOARD:82}[status] || 15);
    const active = rows.map((row,index)=>{
      const h=hash(row.reference || index);
      const status=row.status || 'DRIVER_ASSIGNED';
      const unit=row.vehicle_unit || `UNIT-${String((h%18)+1).padStart(2,'0')}`;
      const exactAllowed=!!session && [ROLES.ADMIN,ROLES.DISPATCHER,ROLES.FACILITY,ROLES.DRIVER].includes(session.role);
      return {
        unit: session ? unit : `NEX-${String((h%24)+1).padStart(2,'0')}`,
        status,
        statusLabel: statusLabels[status] || status,
        service: row.service || 'Medical transport',
        progress: Math.min(96, progressFor(status) + (h%13)),
        x: 10 + (h%76),
        y: 13 + ((Math.floor(h/97))%70),
        eta: ['EN_ROUTE','ARRIVED','PATIENT_ON_BOARD'].includes(status) ? `${5+(h%24)} min operational ETA` : status==='DRIVER_ASSIGNED' ? 'Preparing to move' : 'Awaiting dispatch',
        routeLabel: exactAllowed ? `${row.pickup || 'Pickup'} → ${row.destination || 'Destination'}` : status==='PATIENT_ON_BOARD' ? 'Transport corridor' : status==='EN_ROUTE' ? 'Approaching pickup zone' : 'Assigned service zone',
        attention: status==='REVIEWING' || (status==='EN_ROUTE' && h%5===0),
        reference: exactAllowed ? row.reference : undefined
      };
    });
    const availableCount = session && [ROLES.DRIVER,ROLES.FACILITY].includes(session.role) ? 0 : 3;
    const available = Array.from({length:availableCount},(_,i)=>({
      unit: session ? `UNIT-${String(21+i).padStart(2,'0')}` : `NEX-${String(21+i).padStart(2,'0')}`,
      status:'AVAILABLE',statusLabel:'Available',service:'Ready vehicle',progress:0,
      x:18+(i*31),y:78-(i*9),eta:'Ready for assignment',routeLabel:'Available response zone',attention:false
    }));
    return json(res,200,{scope,generatedAt:new Date().toISOString(),vehicles:[...active,...available]});
  }
  if (req.method === 'GET' && url.pathname === '/api/auth/preview-access') {
    const enabled = process.env.ENABLE_PREVIEW_ACCOUNTS !== 'false' && process.env.NODE_ENV !== 'production';
    return json(res, 200, enabled ? { enabled: true, password: process.env.PREVIEW_ACCOUNT_PASSWORD || 'NexusDemo!2026', accounts: { facility: 'FAC-1001', dispatch: 'dispatch.demo', driver: 'driver.demo' } } : { enabled: false });
  }
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
    return json(res, 200, { user: { id: session.id, email: session.email, username: session.username || '', accountNumber: session.account_number || '', scopeId: session.scope_id || '', displayName: session.display_name, role: session.role }, expiresAt: session.expires_at });
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const session = resolveSession(db, req);
    if (session) revokeSession(db, session.session_id);
    return json(res, 200, { success: true });
  }
  if (req.method === 'GET' && url.pathname === '/api/portal/trips') {
    const session = resolveSession(db, req);
    if (!session) return json(res, 401, { error: 'Authentication required.' });
    let rows = [];
    if ([ROLES.ADMIN, ROLES.DISPATCHER, ROLES.EXECUTIVE, ROLES.QA, ROLES.BILLING].includes(session.role)) {
      rows = db.prepare('SELECT * FROM bookings ORDER BY trip_date DESC,trip_time DESC LIMIT 500').all();
    } else if (session.role === ROLES.FACILITY) {
      if (!session.scope_id) return json(res, 403, { error: 'Facility account is not assigned to a facility.' });
      rows = db.prepare('SELECT * FROM bookings WHERE facility_id=? ORDER BY trip_date DESC,trip_time DESC LIMIT 500').all(session.scope_id);
    } else if (session.role === ROLES.DRIVER) {
      if (!session.scope_id) return json(res, 403, { error: 'Driver account is not assigned to a driver profile.' });
      rows = db.prepare('SELECT * FROM bookings WHERE driver_scope_id=? ORDER BY trip_date DESC,trip_time DESC LIMIT 200').all(session.scope_id);
    } else return json(res, 403, { error: 'This account cannot access staff trip data.' });
    const trips = rows.map(row => {
      const base = publicBooking(row);
      if (session.role === ROLES.DRIVER) return {...base, patientName: row.name, patientPhone: row.phone, notes: row.notes || ''};
      if (session.role === ROLES.FACILITY) return {...base, patientName: row.name, patientPhone: row.phone};
      return {...base, patientName: row.name, patientPhone: row.phone, patientEmail: row.email, notes: row.notes || '', facilityId: row.facility_id || '', driverScopeId: row.driver_scope_id || ''};
    });
    audit('user', session.email, 'PORTAL_TRIPS_VIEWED', `${session.role}:${trips.length}`);
    return json(res, 200, { role: session.role, trips });
  }
  if (req.method === 'GET' && url.pathname === '/api/portal/permissions') {
    const session = resolveSession(db, req);
    if (!session) return json(res, 401, { error: 'Authentication required.' });
    const permissions = {
      ADMIN:['all_pages','manage_users','audit','all_trip_data'],
      DISPATCHER:['all_operational_pages','all_trip_data','assign_driver','update_status','message'],
      EXECUTIVE:['dashboards','reports','deidentified_operational_data'],
      QA:['quality_pages','audit','incident_data'], BILLING:['billing_pages','financial_trip_data'],
      FACILITY:['own_facility_trips','own_facility_reports','create_facility_booking'],
      DRIVER:['assigned_trips','minimum_patient_contact','status_updates'], PATIENT:['verified_single_trip']
    };
    return json(res,200,{role:session.role,permissions:permissions[session.role]||[]});
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/audit') {
    const session = resolveSession(db, req);
    if (!requireRoles(session, [ROLES.ADMIN, ROLES.QA, ROLES.EXECUTIVE])) return json(res, 403, { error: 'Insufficient permissions.' });
    const rows = db.prepare('SELECT entity_type AS entityType,entity_reference AS entityReference,action,detail,created_at AS createdAt FROM audit_log ORDER BY id DESC LIMIT 250').all();
    return json(res, 200, { records: rows });
  }
  if (req.method === 'GET' && ['/api/health', '/health'].includes(url.pathname)) {
    const count = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;
    return json(res, 200, { status:'healthy', service:config.app.name, environment:config.environment, version:config.app.version, release:config.app.release, bookings:Number(count), timestamp:new Date().toISOString() });
  }
  if (req.method === 'GET' && url.pathname === '/ready') {
    try {
      db.prepare('SELECT 1 AS ready').get();
      return json(res, 200, { status:'ready', database:config.database.provider, timestamp:new Date().toISOString() });
    } catch {
      return json(res, 503, { status:'not_ready', timestamp:new Date().toISOString() });
    }
  }
  if (req.method === 'GET' && url.pathname === '/version') {
    return json(res, 200, { service:config.app.name, version:config.app.version, release:config.app.release, environment:config.environment });
  }
  if (req.method === 'POST' && url.pathname === '/api/bookings') {
    try {
      const input = await bodyJson(req);
      const data = {
        name: clean(input.name,120), phone: clean(input.phone,30), email: clean(input.email,180),
        service: clean(input.service,120), pickup: clean(input.pickup,300), destination: clean(input.destination,300),
        date: clean(input.date,10), time: clean(input.time,8), notes: clean(input.notes,2000)
      };
      if (!data.name || phoneDigits(data.phone).length < 7 || !data.service || !data.pickup || !data.destination || !data.date || !data.time)
        return json(res,400,{error:'Please complete all required fields with a valid phone number.'});
      if (!validEmail(data.email)) return json(res,400,{error:'Please enter a valid email address.'});
      const reference = uniqueReference('NMT','bookings');
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO bookings(reference,name,phone,email,service,pickup,destination,trip_date,trip_time,notes,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(reference,data.name,data.phone,data.email,data.service,data.pickup,data.destination,data.date,data.time,data.notes,'SUBMITTED',now,now);
      audit('booking',reference,'CREATED',`Service: ${data.service}`);
      addStatusHistory(reference, 'SUBMITTED', 'Transportation request received and queued for coordination.', 'Nexus LiveCare');
      const row = db.prepare('SELECT * FROM bookings WHERE reference=?').get(reference);
      return json(res,201,{success:true,booking:publicBooking(row)});
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
    const rate = allowRequest(`livecare:${req.socket.remoteAddress || 'unknown'}`, 20, 15 * 60_000);
    if (!rate.allowed) return json(res,429,{error:'Too many verification attempts. Try again later.',retryAfter:rate.retryAfter});
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
server.listen(PORT,HOST,()=>console.log(`${config.app.name} ${config.app.version} (${config.environment}) running at http://${HOST}:${PORT}`));
