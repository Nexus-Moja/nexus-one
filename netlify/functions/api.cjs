const crypto=require('crypto');
const {query}=require('./_shared/db.cjs');
const {json,parseBody,bearer,routePath}=require('./_shared/http.cjs');
const {digest,safeUser,requireUser,audit}=require('./_shared/auth.cjs');
const STATUS_FLOW={SUBMITTED:'SCHEDULED',REQUESTED:'SCHEDULED',SCHEDULED:'ASSIGNED',ASSIGNED:'EN_ROUTE',EN_ROUTE:'ARRIVED',ARRIVED:'IN_TRANSIT',IN_TRANSIT:'COMPLETED'};
const statusLabel=s=>String(s||'SUBMITTED').toLowerCase().replaceAll('_','-');
async function handler(event){
 try{
  const p=routePath(event),method=event.httpMethod;
  if(p[0]==='health'){
   const r=await query('SELECT now() AS now, current_database() AS database');
   return json(200,{status:'ok',database:'connected',environment:process.env.CONTEXT||process.env.APP_ENV||'unknown',checkedAt:r.rows[0].now});
  }
  if(p[0]==='auth'&&p[1]==='me'&&method==='GET'){const u=await requireUser(bearer(event));return json(200,{user:safeUser(u)})}
  if(p[0]==='auth'&&p[1]==='logout'&&method==='POST'){const token=bearer(event);if(token)await query('UPDATE sessions SET revoked_at=now() WHERE token_digest=$1',[digest(token)]);return json(200,{ok:true})}
  if(p[0]==='auth'&&p[1]==='login'&&method==='POST'){
   const b=parseBody(event),r=await query('SELECT * FROM users WHERE lower(email)=lower($1) AND active=true',[b.email||'']);
   const u=r.rows[0]; if(!u) return json(401,{error:'Invalid credentials'});
   // Build 041 supports pre-provisioned password hashes only; no preview accounts are created.
   const supplied=crypto.createHash('sha256').update(String(b.password||'')).digest('hex');
   if(!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(String(u.password_hash)))) return json(401,{error:'Invalid credentials'});
   const token=crypto.randomBytes(32).toString('base64url');
   await query(`INSERT INTO sessions(token_digest,user_id,expires_at,ip_address,user_agent) VALUES($1,$2,now()+interval '8 hours',$3,$4)`,[digest(token),u.id,event.headers['x-forwarded-for']||null,event.headers['user-agent']||null]);
   await audit('USER',String(u.id),'LOGIN',{role:u.role}); return json(200,{token,user:safeUser(u)});
  }
  if(p[0]==='portal'&&p[1]==='trips'&&method==='GET'){
   const u=await requireUser(bearer(event)); let sql='SELECT * FROM bookings',params=[];
   if(u.role==='FACILITY'){sql+=' WHERE facility_id=$1';params=[u.scope_id]}
   else if(u.role==='DRIVER'){sql+=' WHERE driver_scope_id=$1';params=[u.scope_id]}
   else if(u.role==='PATIENT'){sql+=' WHERE lower(email)=lower($1)';params=[u.email]}
   else if(!['ADMIN','DISPATCHER','EXECUTIVE','BILLING','QA'].includes(u.role)) return json(403,{error:'Insufficient permission'});
   sql+=' ORDER BY trip_date DESC, trip_time DESC LIMIT 250'; const r=await query(sql,params);
   return json(200,{trips:r.rows.map(mapBooking)});
  }
  if(p[0]==='admin'&&p[1]==='bookings'&&method==='GET'){
   await requireUser(bearer(event),['ADMIN','DISPATCHER','EXECUTIVE','BILLING','QA']);const r=await query('SELECT * FROM bookings ORDER BY trip_date DESC,trip_time DESC LIMIT 500');return json(200,{bookings:r.rows.map(mapBooking)});
  }
  if(p[0]==='admin'&&p[1]==='bookings'&&p[2]&&method==='PATCH'){
   const u=await requireUser(bearer(event),['ADMIN','DISPATCHER']);const b=parseBody(event),ref=decodeURIComponent(p[2]);
   const r=await query(`UPDATE bookings SET status=COALESCE($2,status),driver_name=COALESCE($3,driver_name),vehicle_unit=COALESCE($4,vehicle_unit),updated_at=now() WHERE reference=$1 RETURNING *`,[ref,b.status?String(b.status).toUpperCase().replaceAll('-','_'):null,b.driverName||null,b.vehicleUnit||null]);
   if(!r.rows[0])return json(404,{error:'Booking not found'});await query('INSERT INTO trip_status_history(booking_reference,status,status_label,note,actor) VALUES($1,$2,$3,$4,$5)',[ref,r.rows[0].status,statusLabel(r.rows[0].status),b.note||null,u.display_name]);await audit('BOOKING',ref,'UPDATED',{status:r.rows[0].status});return json(200,{booking:mapBooking(r.rows[0])});
  }
  if(p[0]==='admin'&&p[1]==='bookings'&&p[2]&&p[3]==='advance'&&method==='POST'){
   const u=await requireUser(bearer(event),['ADMIN','DISPATCHER']);const ref=decodeURIComponent(p[2]);const current=await query('SELECT * FROM bookings WHERE reference=$1',[ref]);if(!current.rows[0])return json(404,{error:'Booking not found'});const next=STATUS_FLOW[current.rows[0].status]||current.rows[0].status;const r=await query('UPDATE bookings SET status=$2,updated_at=now() WHERE reference=$1 RETURNING *',[ref,next]);await query('INSERT INTO trip_status_history(booking_reference,status,status_label,actor) VALUES($1,$2,$3,$4)',[ref,next,statusLabel(next),u.display_name]);await audit('BOOKING',ref,'STATUS_ADVANCED',{from:current.rows[0].status,to:next});return json(200,{booking:mapBooking(r.rows[0])});
  }
  if(p[0]==='fleet'&&p[1]==='live'&&method==='GET'){
   let u=null;try{if(bearer(event))u=await requireUser(bearer(event))}catch{} const r=await query(`SELECT unit_number,vehicle_type,status,latitude,longitude,heading,speed_mph,last_seen_at FROM vehicles WHERE last_seen_at IS NULL OR last_seen_at>now()-interval '24 hours' ORDER BY unit_number`);return json(200,{generatedAt:new Date().toISOString(),role:u?.role||'PUBLIC',vehicles:r.rows.map(v=>({id:v.unit_number,unit:v.unit_number,type:v.vehicle_type,status:v.status,lat:Number(v.latitude),lng:Number(v.longitude),heading:Number(v.heading||0),speed:Number(v.speed_mph||0),lastSeen:v.last_seen_at}))});
  }
  if(p[0]==='facilities'&&method==='GET'){const u=await requireUser(bearer(event),['ADMIN','DISPATCHER','FACILITY']);const r=await query(u.role==='FACILITY'?'SELECT * FROM facilities WHERE facility_code=$1':'SELECT * FROM facilities ORDER BY name',[...(u.role==='FACILITY'?[u.scope_id]:[])]);return json(200,{facilities:r.rows})}
  if(p[0]==='patients'&&method==='GET'){const u=await requireUser(bearer(event),['ADMIN','DISPATCHER','FACILITY']);const r=await query(u.role==='FACILITY'?'SELECT * FROM patients WHERE facility_code=$1 AND active=true ORDER BY display_name':'SELECT * FROM patients WHERE active=true ORDER BY display_name',[...(u.role==='FACILITY'?[u.scope_id]:[])]);return json(200,{patients:r.rows})}
  if(p[0]==='ready'&&method==='GET'){const r=await query("SELECT version FROM schema_migrations WHERE version IN ('040.001','041.001') ORDER BY version");return json(r.rowCount===2?200:503,{ready:r.rowCount===2,migrations:r.rows.map(x=>x.version)})}
  return json(404,{error:'Route not found'});
 }catch(err){console.error(err);return json(err.statusCode||500,{error:err.statusCode?err.message:'Internal server error',requestId:crypto.randomUUID()})}
}
function mapBooking(b){return {id:b.reference,reference:b.reference,name:b.name,phone:b.phone,email:b.email,service:b.service,pickup:b.pickup,destination:b.destination,date:b.trip_date,time:String(b.trip_time||'').slice(0,5),status:statusLabel(b.status),statusLabel:statusLabel(b.status).replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase()),driver:b.driver_name,vehicle:b.vehicle_unit,facilityId:b.facility_id}}
exports.handler=handler;
