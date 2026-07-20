const crypto=require('crypto');
const {query}=require('./_shared/db.cjs');
const {json,parseBody,bearer,routePath}=require('./_shared/http.cjs');
const {digest,safeUser,requireUser,audit}=require('./_shared/auth.cjs');
const STATUS_FLOW={SUBMITTED:'SCHEDULED',REQUESTED:'SCHEDULED',SCHEDULED:'ASSIGNED',ASSIGNED:'EN_ROUTE',EN_ROUTE:'ARRIVED',ARRIVED:'IN_TRANSIT',IN_TRANSIT:'COMPLETED'};
const statusLabel=s=>String(s||'SUBMITTED').toLowerCase().replaceAll('_','-');
const envEnabled=name=>Boolean(process.env[name]);
const clean=v=>String(v??'').trim();
const required=(body,fields)=>{for(const f of fields)if(!clean(body[f]))throw Object.assign(new Error(`${f} is required`),{statusCode:400})};
const reference=()=>`NMT-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomInt(1000,9999)}`;

async function sendSms(to,body){
 if(!envEnabled('TWILIO_ACCOUNT_SID')||!envEnabled('TWILIO_AUTH_TOKEN')||!envEnabled('TWILIO_PHONE_NUMBER')||!to)return {status:'skipped'};
 const form=new URLSearchParams({To:to,From:process.env.TWILIO_PHONE_NUMBER,Body:body});
 const auth=Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
 const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,{method:'POST',headers:{authorization:`Basic ${auth}`,'content-type':'application/x-www-form-urlencoded'},body:form});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.message||'Twilio request failed');return {status:'sent',id:data.sid};
}
async function sendEmail(to,subject,html){
 if(!envEnabled('SENDGRID_API_KEY')||!envEnabled('SENDGRID_FROM_EMAIL')||!to)return {status:'skipped'};
 const r=await fetch('https://api.sendgrid.com/v3/mail/send',{method:'POST',headers:{authorization:`Bearer ${process.env.SENDGRID_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({personalizations:[{to:[{email:to}]}],from:{email:process.env.SENDGRID_FROM_EMAIL,name:'Nexus Medical Transit'},subject,content:[{type:'text/html',value:html}]})});
 if(!r.ok)throw new Error(`SendGrid request failed (${r.status})`);return {status:'sent'};
}
async function notifyBooking(b){
 const text=`Nexus Medical Transit request ${b.reference} received for ${b.date} at ${b.time}. This request is pending confirmation.`;
 const results=await Promise.allSettled([sendSms(b.phone,text),sendEmail(b.email,`Nexus ride request ${b.reference}`,`<h1>Transportation request received</h1><p>Reference: <strong>${b.reference}</strong></p><p>${b.pickup} → ${b.destination}</p><p>${b.date} at ${b.time}</p><p>Nexus will contact you after availability is reviewed.</p>`)]);
 return {sms:results[0].status==='fulfilled'?results[0].value:{status:'failed',error:results[0].reason?.message},email:results[1].status==='fulfilled'?results[1].value:{status:'failed',error:results[1].reason?.message}};
}
async function createStripeIntent(amountCents,metadata){
 if(!envEnabled('STRIPE_SECRET_KEY'))throw Object.assign(new Error('Stripe is not configured'),{statusCode:503});
 const form=new URLSearchParams();form.set('amount',String(amountCents));form.set('currency','usd');form.set('automatic_payment_methods[enabled]','true');
 for(const [k,v] of Object.entries(metadata||{}))if(v!=null)form.set(`metadata[${k}]`,String(v).slice(0,500));
 const r=await fetch('https://api.stripe.com/v1/payment_intents',{method:'POST',headers:{authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'content-type':'application/x-www-form-urlencoded','idempotency-key':metadata?.bookingReference||crypto.randomUUID()},body:form});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(data.error?.message||'Stripe request failed'),{statusCode:502});return data;
}

async function handler(event){
 try{
  const p=routePath(event),method=event.httpMethod;
  if(p[0]==='health'){
   const r=await query('SELECT now() AS now, current_database() AS database');
   return json(200,{status:'ok',database:'connected',environment:process.env.CONTEXT||process.env.APP_ENV||'unknown',checkedAt:r.rows[0].now,build:'042'});
  }
  if(p.join('/')==='integrations/config'&&method==='GET')return json(200,{build:'042',googleMapsEnabled:envEnabled('GOOGLE_MAPS_BROWSER_KEY'),googleMapsBrowserKey:process.env.GOOGLE_MAPS_BROWSER_KEY||'',stripeEnabled:envEnabled('STRIPE_PUBLISHABLE_KEY'),stripePublishableKey:process.env.STRIPE_PUBLISHABLE_KEY||''});
  if(p.join('/')==='integrations/health'&&method==='GET')return json(200,{googleMaps:envEnabled('GOOGLE_MAPS_BROWSER_KEY')?'configured':'not-configured',twilio:envEnabled('TWILIO_ACCOUNT_SID')&&envEnabled('TWILIO_AUTH_TOKEN')&&envEnabled('TWILIO_PHONE_NUMBER')?'configured':'not-configured',sendGrid:envEnabled('SENDGRID_API_KEY')&&envEnabled('SENDGRID_FROM_EMAIL')?'configured':'not-configured',stripe:envEnabled('STRIPE_SECRET_KEY')&&envEnabled('STRIPE_PUBLISHABLE_KEY')?'configured':'not-configured',gps:'enabled',checkedAt:new Date().toISOString()});
  if(p.join('/')==='locations/search'&&method==='GET'){
   const q=clean(event.queryStringParameters?.q);if(q.length<2)return json(200,{locations:[]});
   const r=await query(`SELECT facility_code AS id,name,address,'facility' AS type FROM facilities WHERE active=true AND (name ILIKE $1 OR address ILIKE $1) ORDER BY CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END,name LIMIT 12`,[`%${q}%`,`${q}%`]);
   return json(200,{locations:r.rows});
  }
  if(p[0]==='bookings'&&method==='POST'&&p.length===1){
   const b=parseBody(event);required(b,['name','phone','service','pickup','destination','date','time']);
   const ref=reference();
   const r=await query(`INSERT INTO bookings(reference,name,phone,email,service,pickup,destination,trip_date,trip_time,status,notes,pickup_lat,pickup_lng,destination_lat,destination_lng,distance_miles,estimated_duration,estimated_fare,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'SUBMITTED',$10,$11,$12,$13,$14,$15,$16,$17,now(),now()) RETURNING *`,[ref,clean(b.name),clean(b.phone),clean(b.email)||null,clean(b.service),clean(b.pickup),clean(b.destination),b.date,b.time,clean(b.notes)||null,b.pickupLat||null,b.pickupLng||null,b.destinationLat||null,b.destinationLng||null,b.distanceMiles||null,clean(b.estimatedDuration)||null,b.estimatedFare||null]);
   await query('INSERT INTO trip_status_history(booking_reference,status,status_label,note,actor) VALUES($1,$2,$3,$4,$5)',[ref,'SUBMITTED','submitted','Online transportation request received','PUBLIC']);
   await audit('BOOKING',ref,'CREATED',{source:'UNIFIED_BOOKING',service:b.service});
   const booking=mapBooking(r.rows[0]);const notifications=await notifyBooking(booking);
   await query('UPDATE bookings SET notification_status=$2::jsonb WHERE reference=$1',[ref,JSON.stringify(notifications)]).catch(()=>{});
   return json(201,{booking:{...booking,notifications}});
  }
  if(p[0]==='bookings'&&p[1]&&method==='GET'){
   const phone=clean(event.queryStringParameters?.phone);if(!phone)return json(400,{error:'Phone number is required'});
   const r=await query('SELECT * FROM bookings WHERE reference=$1 AND regexp_replace(phone,\'\\D\',\'\',\'g\')=regexp_replace($2,\'\\D\',\'\',\'g\')',[decodeURIComponent(p[1]),phone]);if(!r.rows[0])return json(404,{error:'Request not found'});return json(200,{booking:mapBooking(r.rows[0])});
  }
  if(p.join('/')==='payments/create-intent'&&method==='POST'){
   const b=parseBody(event);required(b,['bookingReference']);const r=await query('SELECT reference,estimated_fare,payment_status FROM bookings WHERE reference=$1',[b.bookingReference]);if(!r.rows[0])return json(404,{error:'Booking not found'});
   const amount=Math.round(Number(b.amount||r.rows[0].estimated_fare||0)*100);if(amount<50)return json(400,{error:'A valid payment amount is required'});
   const pi=await createStripeIntent(amount,{bookingReference:r.rows[0].reference});await query('UPDATE bookings SET stripe_payment_intent_id=$2,payment_status=$3,updated_at=now() WHERE reference=$1',[r.rows[0].reference,pi.id,'PENDING']);
   return json(200,{clientSecret:pi.client_secret,paymentIntentId:pi.id,amount});
  }
  if(p.join('/')==='gps/positions'&&method==='POST'){
   const u=await requireUser(bearer(event),['DRIVER','ADMIN','DISPATCHER']);const b=parseBody(event);required(b,['vehicleUnit','latitude','longitude']);
   const lat=Number(b.latitude),lng=Number(b.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return json(400,{error:'Invalid coordinates'});
   await query(`INSERT INTO gps_positions(vehicle_unit,driver_scope_id,booking_reference,latitude,longitude,heading,speed_mph,accuracy_m,recorded_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,now()))`,[b.vehicleUnit,u.scope_id||null,b.bookingReference||null,lat,lng,b.heading||null,b.speedMph||null,b.accuracyM||null,b.recordedAt||null]);
   await query(`UPDATE vehicles SET latitude=$2,longitude=$3,heading=$4,speed_mph=$5,last_seen_at=now(),updated_at=now() WHERE unit_number=$1`,[b.vehicleUnit,lat,lng,b.heading||null,b.speedMph||null]);return json(202,{accepted:true});
  }
  if(p[0]==='auth'&&p[1]==='me'&&method==='GET'){const u=await requireUser(bearer(event));return json(200,{user:safeUser(u)})}
  if(p[0]==='auth'&&p[1]==='logout'&&method==='POST'){const token=bearer(event);if(token)await query('UPDATE sessions SET revoked_at=now() WHERE token_digest=$1',[digest(token)]);return json(200,{ok:true})}
  if(p[0]==='auth'&&p[1]==='login'&&method==='POST'){
   const b=parseBody(event),r=await query('SELECT * FROM users WHERE lower(email)=lower($1) AND active=true',[b.email||'']);const u=r.rows[0];if(!u)return json(401,{error:'Invalid credentials'});
   const supplied=crypto.createHash('sha256').update(String(b.password||'')).digest('hex');if(String(u.password_hash).length!==supplied.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(String(u.password_hash))))return json(401,{error:'Invalid credentials'});
   const token=crypto.randomBytes(32).toString('base64url');await query(`INSERT INTO sessions(token_digest,user_id,expires_at,ip_address,user_agent) VALUES($1,$2,now()+interval '8 hours',$3,$4)`,[digest(token),u.id,event.headers['x-forwarded-for']||null,event.headers['user-agent']||null]);await audit('USER',String(u.id),'LOGIN',{role:u.role});return json(200,{token,user:safeUser(u)});
  }
  if(p[0]==='portal'&&p[1]==='trips'&&method==='GET'){
   const u=await requireUser(bearer(event));let sql='SELECT * FROM bookings',params=[];if(u.role==='FACILITY'){sql+=' WHERE facility_id=$1';params=[u.scope_id]}else if(u.role==='DRIVER'){sql+=' WHERE driver_scope_id=$1';params=[u.scope_id]}else if(u.role==='PATIENT'){sql+=' WHERE lower(email)=lower($1)';params=[u.email]}else if(!['ADMIN','DISPATCHER','EXECUTIVE','BILLING','QA'].includes(u.role))return json(403,{error:'Insufficient permission'});sql+=' ORDER BY trip_date DESC, trip_time DESC LIMIT 250';const r=await query(sql,params);return json(200,{trips:r.rows.map(mapBooking)});
  }
  if(p[0]==='admin'&&p[1]==='bookings'&&method==='GET'){await requireUser(bearer(event),['ADMIN','DISPATCHER','EXECUTIVE','BILLING','QA']);const r=await query('SELECT * FROM bookings ORDER BY trip_date DESC,trip_time DESC LIMIT 500');return json(200,{bookings:r.rows.map(mapBooking)})}
  if(p[0]==='admin'&&p[1]==='bookings'&&p[2]&&method==='PATCH'){
   const u=await requireUser(bearer(event),['ADMIN','DISPATCHER']);const b=parseBody(event),ref=decodeURIComponent(p[2]);const r=await query(`UPDATE bookings SET status=COALESCE($2,status),driver_name=COALESCE($3,driver_name),vehicle_unit=COALESCE($4,vehicle_unit),updated_at=now() WHERE reference=$1 RETURNING *`,[ref,b.status?String(b.status).toUpperCase().replaceAll('-','_'):null,b.driverName||null,b.vehicleUnit||null]);if(!r.rows[0])return json(404,{error:'Booking not found'});await query('INSERT INTO trip_status_history(booking_reference,status,status_label,note,actor) VALUES($1,$2,$3,$4,$5)',[ref,r.rows[0].status,statusLabel(r.rows[0].status),b.note||null,u.display_name]);await audit('BOOKING',ref,'UPDATED',{status:r.rows[0].status});return json(200,{booking:mapBooking(r.rows[0])});
  }
  if(p[0]==='admin'&&p[1]==='bookings'&&p[2]&&p[3]==='advance'&&method==='POST'){
   const u=await requireUser(bearer(event),['ADMIN','DISPATCHER']);const ref=decodeURIComponent(p[2]);const current=await query('SELECT * FROM bookings WHERE reference=$1',[ref]);if(!current.rows[0])return json(404,{error:'Booking not found'});const next=STATUS_FLOW[current.rows[0].status]||current.rows[0].status;const r=await query('UPDATE bookings SET status=$2,updated_at=now() WHERE reference=$1 RETURNING *',[ref,next]);await query('INSERT INTO trip_status_history(booking_reference,status,status_label,actor) VALUES($1,$2,$3,$4)',[ref,next,statusLabel(next),u.display_name]);await audit('BOOKING',ref,'STATUS_ADVANCED',{from:current.rows[0].status,to:next});return json(200,{booking:mapBooking(r.rows[0])});
  }
  if(p[0]==='fleet'&&p[1]==='live'&&method==='GET'){
   let u=null;try{if(bearer(event))u=await requireUser(bearer(event))}catch{}const r=await query(`SELECT unit_number,vehicle_type,status,latitude,longitude,heading,speed_mph,last_seen_at FROM vehicles WHERE last_seen_at IS NULL OR last_seen_at>now()-interval '24 hours' ORDER BY unit_number`);return json(200,{generatedAt:new Date().toISOString(),role:u?.role||'PUBLIC',vehicles:r.rows.map(v=>({id:v.unit_number,unit:v.unit_number,type:v.vehicle_type,status:v.status,lat:Number(v.latitude),lng:Number(v.longitude),heading:Number(v.heading||0),speed:Number(v.speed_mph||0),lastSeen:v.last_seen_at}))});
  }
  if(p[0]==='facilities'&&method==='GET'){const u=await requireUser(bearer(event),['ADMIN','DISPATCHER','FACILITY']);const r=await query(u.role==='FACILITY'?'SELECT * FROM facilities WHERE facility_code=$1':'SELECT * FROM facilities ORDER BY name',[...(u.role==='FACILITY'?[u.scope_id]:[])]);return json(200,{facilities:r.rows})}
  if(p[0]==='patients'&&method==='GET'){const u=await requireUser(bearer(event),['ADMIN','DISPATCHER','FACILITY']);const r=await query(u.role==='FACILITY'?'SELECT * FROM patients WHERE facility_code=$1 AND active=true ORDER BY display_name':'SELECT * FROM patients WHERE active=true ORDER BY display_name',[...(u.role==='FACILITY'?[u.scope_id]:[])]);return json(200,{patients:r.rows})}
  if(p[0]==='ready'&&method==='GET'){const r=await query("SELECT version FROM schema_migrations WHERE version IN ('040.001','041.001','042.001') ORDER BY version");return json(r.rowCount===3?200:503,{ready:r.rowCount===3,migrations:r.rows.map(x=>x.version)})}
  return json(404,{error:'Route not found'});
 }catch(err){console.error(err);return json(err.statusCode||500,{error:err.statusCode?err.message:'Internal server error',requestId:crypto.randomUUID()})}
}
function mapBooking(b){return {id:b.reference,reference:b.reference,name:b.name,phone:b.phone,email:b.email,service:b.service,pickup:b.pickup,destination:b.destination,date:b.trip_date,time:String(b.trip_time||'').slice(0,5),status:statusLabel(b.status),statusLabel:statusLabel(b.status).replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase()),driver:b.driver_name,driverName:b.driver_name,vehicle:b.vehicle_unit,vehicleUnit:b.vehicle_unit,facilityId:b.facility_id,distanceMiles:b.distance_miles?Number(b.distance_miles):null,estimatedDuration:b.estimated_duration,estimatedFare:b.estimated_fare?Number(b.estimated_fare):null,paymentStatus:b.payment_status||'UNPAID'} }
exports.handler=handler;
