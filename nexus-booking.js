/**
 * nexus-booking.js — Nexus Medical Transit unified booking intercept
 * Intercepts "Book a Ride" links/buttons on every portal page and opens
 * an Uber-style intelligent booking sheet without leaving the page.
 * Address fields use Nominatim (free) + Google Places (if configured).
 */
(function(){
'use strict';

/* ─── Address typeahead (Nominatim + optional Google Places) ─── */
const NOMINATIM='https://nominatim.openstreetmap.org/search';
let _googleReady=false, _googleLoading=false, _googleCallbacks=[], _cfgPromise=null;

function getConfig(){
  return _cfgPromise||(_cfgPromise=fetch('/api/integrations/config').then(r=>r.json()).catch(()=>({googleMapsEnabled:false})));
}

function loadGoogle(key){
  if(_googleReady)return Promise.resolve();
  if(_googleLoading)return new Promise(r=>_googleCallbacks.push(r));
  _googleLoading=true;
  return new Promise((resolve,reject)=>{
    _googleCallbacks.push(resolve);
    const cb='_nexusGoogleReady_'+Date.now();
    window[cb]=()=>{_googleReady=true;delete window[cb];_googleCallbacks.forEach(fn=>fn());_googleCallbacks=[]};
    const s=document.createElement('script');
    s.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&libraries=places&callback='+cb;
    s.async=true;s.defer=true;s.onerror=reject;
    document.head.appendChild(s);
  });
}

async function nominatimSearch(query){
  try{
    const url=NOMINATIM+'?format=json&addressdetails=0&limit=6&countrycodes=us&q='+encodeURIComponent(query);
    const r=await fetch(url,{headers:{'Accept-Language':'en'}});
    const data=await r.json();
    return data.map(d=>({label:d.display_name,lat:parseFloat(d.lat),lng:parseFloat(d.lon)}));
  }catch{return []}
}

/* ─── Suggestion dropdown ─── */
function buildDropdown(input){
  if(input._nexusDrop)return input._nexusDrop;
  const drop=document.createElement('ul');
  drop.className='nbkDrop';
  drop.setAttribute('role','listbox');
  input.parentElement.style.position='relative';
  input.parentElement.appendChild(drop);
  input._nexusDrop=drop;

  input.addEventListener('blur',()=>setTimeout(()=>{drop.hidden=true},200));
  input.setAttribute('autocomplete','off');
  input.setAttribute('spellcheck','false');

  return drop;
}

function showSuggestions(input,items){
  const drop=buildDropdown(input);
  drop.innerHTML='';
  if(!items.length){drop.hidden=true;return;}
  items.slice(0,6).forEach(item=>{
    const li=document.createElement('li');
    li.setAttribute('role','option');
    li.textContent=item.label;
    li.addEventListener('mousedown',e=>{
      e.preventDefault();
      input.value=item.label;
      input.dataset.lat=item.lat||'';
      input.dataset.lng=item.lng||'';
      drop.hidden=true;
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
    drop.appendChild(li);
  });
  drop.hidden=false;
}

async function attachAddressIntelligence(input){
  if(input._nbkEnhanced)return;
  input._nbkEnhanced=true;

  let timer=null;
  let acInstance=null;

  const cfg=await getConfig().catch(()=>({googleMapsEnabled:false}));
  if(cfg.googleMapsEnabled&&cfg.googleMapsBrowserKey){
    try{
      await loadGoogle(cfg.googleMapsBrowserKey);
      const ac=new google.maps.places.Autocomplete(input,{
        fields:['formatted_address','geometry'],
        componentRestrictions:{country:'us'},
        types:['geocode','establishment']
      });
      ac.addListener('place_changed',()=>{
        const p=ac.getPlace();
        if(!p?.geometry)return;
        input.dataset.lat=p.geometry.location.lat();
        input.dataset.lng=p.geometry.location.lng();
      });
      acInstance=ac;
      return;
    }catch(e){/*fall through to Nominatim*/}
  }

  buildDropdown(input);
  input.addEventListener('input',()=>{
    clearTimeout(timer);
    const q=input.value.trim();
    if(q.length<3){buildDropdown(input).hidden=true;return;}
    timer=setTimeout(async()=>{
      const results=await nominatimSearch(q);
      showSuggestions(input,results);
    },280);
  });
}

/* ─── Dialog HTML + logic (Uber-style design) ─── */
function createBookingDialog(){
  const d=document.createElement('dialog');
  d.id='nexusBookingSheet';
  d.innerHTML=`
<div class="nbkUberLayout">
  <div class="nbkMapContainer" id="nbkMapContainer">
    <div class="nbkMap" id="nbkMap">
      <svg class="nbkMapSvg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e0e8f0" stroke-width="0.5"/>
          </pattern>
        </defs>
        <rect width="400" height="300" fill="url(#grid)"/>
        <circle cx="200" cy="150" r="8" fill="#16a36a" opacity="0.8"/>
        <circle cx="200" cy="150" r="20" fill="#16a36a" opacity="0.2"/>
      </svg>
      <div class="nbkMapOverlay">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <p>Map will display your route</p>
      </div>
    </div>
  </div>

  <div class="nbkPanel">
    <div class="nbkPanelHandle" aria-label="Drag to resize"></div>

    <div class="nbkLocationCards">
      <div class="nbkLocCard nbkLocPickup">
        <span class="nbkLocDot" style="background:#16a36a"></span>
        <div class="nbkLocInfo">
          <div class="nbkLocLabel">Pickup</div>
          <div class="nbkLocValue" id="nbkPickupDisplay">Select location</div>
        </div>
      </div>
      <div class="nbkLocDivider"></div>
      <div class="nbkLocCard nbkLocDest">
        <span class="nbkLocDot" style="background:#b42335"></span>
        <div class="nbkLocInfo">
          <div class="nbkLocLabel">Destination</div>
          <div class="nbkLocValue" id="nbkDestDisplay">Select location</div>
        </div>
      </div>
    </div>

    <form id="nbkForm" class="nbkForm" novalidate>
      <div class="nbkFormSection">
        <label class="nbkField">
          <input name="pickup" type="text" placeholder="Pickup location…" required>
        </label>
        <label class="nbkField">
          <input name="destination" type="text" placeholder="Destination…" required>
        </label>
      </div>

      <div class="nbkFormSection">
        <div class="nbkLabel">Service type</div>
        <div class="nbkServiceGrid">
          <label class="nbkServiceCard">
            <input type="radio" name="service" value="ambulatory" required style="display:none">
            <div class="nbkServiceOption">
              <span class="nbkServiceIcon">🚗</span>
              <span class="nbkServiceName">Ambulatory</span>
            </div>
          </label>
          <label class="nbkServiceCard">
            <input type="radio" name="service" value="wheelchair" required style="display:none">
            <div class="nbkServiceOption">
              <span class="nbkServiceIcon">♿</span>
              <span class="nbkServiceName">Wheelchair</span>
            </div>
          </label>
          <label class="nbkServiceCard">
            <input type="radio" name="service" value="stretcher" required style="display:none">
            <div class="nbkServiceOption">
              <span class="nbkServiceIcon">🚑</span>
              <span class="nbkServiceName">Stretcher</span>
            </div>
          </label>
        </div>
      </div>

      <div class="nbkFormSection">
        <div class="nbkLabel">Trip details</div>
        <div class="nbkRow">
          <label class="nbkField">
            <input name="date" type="date" required id="nbkDate">
          </label>
          <label class="nbkField">
            <input name="time" type="time" required id="nbkTime">
          </label>
        </div>
      </div>

      <div class="nbkFormSection">
        <label class="nbkField">
          Full name
          <input name="name" type="text" placeholder="Your name" required>
        </label>
        <label class="nbkField">
          Phone number
          <input name="phone" type="tel" placeholder="(202) 555-0100" required>
        </label>
        <label class="nbkField">
          Email (optional)
          <input name="email" type="email" placeholder="you@example.com">
        </label>
      </div>

      <div class="nbkFormSection">
        <label class="nbkField">
          Special instructions (optional)
          <textarea name="notes" placeholder="Mobility aids, medical needs…"></textarea>
        </label>
      </div>

      <div class="nbkFormFooter">
        <p id="nbkError" class="nbkError" role="alert"></p>
        <button class="nbkCtaButton" type="submit" id="nbkSubmit">Request ride</button>
      </div>
    </form>

    <div id="nbkSuccess" class="nbkSuccess" hidden>
      <div class="nbkSuccessIcon">✓</div>
      <h3>Request confirmed!</h3>
      <p>Nexus is reviewing your request. You'll receive a confirmation shortly.</p>
      <p class="nbkRef">Reference: <strong id="nbkRefNum"></strong></p>
      <button class="nbkCtaButton" id="nbkDone" type="button">Done</button>
    </div>
  </div>
</div>`;

  document.body.appendChild(d);

  const today=new Date().toISOString().split('T')[0];
  d.querySelector('#nbkDate').min=today;
  d.querySelector('#nbkDate').value=today;

  setTimeout(()=>{
    d.querySelectorAll('input[name="pickup"],input[name="destination"]').forEach(attachAddressIntelligence);
  },0);

  d.querySelector('#nbkDone')?.addEventListener('click',()=>d.close());
  d.addEventListener('click',e=>{if(e.target===d)d.close();});

  d.addEventListener('close',()=>{
    d.querySelector('#nbkForm').hidden=false;
    d.querySelector('#nbkSuccess').hidden=true;
    d.querySelector('#nbkError').textContent='';
    d.querySelector('#nbkForm').reset();
  });

  d.querySelector('#nbkForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const form=d.querySelector('#nbkForm');
    const err=d.querySelector('#nbkError');
    const btn=d.querySelector('#nbkSubmit');
    err.textContent='';

    const required=['name','phone','pickup','destination','date','time','service'];
    const fd=new FormData(form);
    for(const k of required){
      if(!fd.get(k)?.trim()){
        const el=form.querySelector(`[name="${k}"]`);
        el?.focus();err.textContent='Please fill in all required fields.';return;
      }
    }

    btn.disabled=true;btn.textContent='Submitting…';
    try{
      const pickupInput=form.querySelector('[name="pickup"]');
      const destInput=form.querySelector('[name="destination"]');
      const body={
        name:fd.get('name').trim(),
        phone:fd.get('phone').trim(),
        email:fd.get('email')?.trim()||undefined,
        service:fd.get('service'),
        pickup:fd.get('pickup').trim(),
        destination:fd.get('destination').trim(),
        date:fd.get('date'),
        time:fd.get('time'),
        notes:fd.get('notes')?.trim()||undefined,
        pickupLat:pickupInput?.dataset.lat||undefined,
        pickupLng:pickupInput?.dataset.lng||undefined,
        destinationLat:destInput?.dataset.lat||undefined,
        destinationLng:destInput?.dataset.lng||undefined,
      };
      Object.keys(body).forEach(k=>body[k]===undefined&&delete body[k]);

      const res=await fetch('/api/bookings',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify(body)
      });
      const json=await res.json();
      if(!res.ok)throw new Error(json.error||'Request failed');

      d.querySelector('#nbkRefNum').textContent=json.booking?.reference||'—';
      d.querySelector('#nbkForm').hidden=true;
      d.querySelector('#nbkSuccess').hidden=false;
    }catch(ex){
      err.textContent=ex.message||'Error submitting request. Please try again.';
      btn.disabled=false;btn.textContent='Request ride';
    }
  });

  return d;
}

/* ─── Intercept all Book a Ride triggers ─── */
function intercept(el){
  if(el._nbkIntercepted)return;
  el._nbkIntercepted=true;
  el.addEventListener('click',e=>{
    e.preventDefault();
    let dlg=document.getElementById('nexusBookingSheet');
    if(!dlg)dlg=createBookingDialog();
    dlg.querySelectorAll('input[name="pickup"],input[name="destination"]').forEach(attachAddressIntelligence);
    if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','');
  });
}

function scan(){
  document.querySelectorAll('a[href="/?book=1"],a[href*="book=1"],button[data-book-ride],[data-nexus-unified-booking]').forEach(intercept);
}

new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',scan);
scan();

/* ─── Auto-open on ?book=1 (URL cleared by inline script in index.html) ─── */
if(window.__nexusAutoOpenBooking){
  delete window.__nexusAutoOpenBooking;
  setTimeout(()=>{
    let dlg=document.getElementById('nexusBookingSheet');
    if(!dlg)dlg=createBookingDialog();
    dlg.querySelectorAll('input[name="pickup"],input[name="destination"]').forEach(attachAddressIntelligence);
    if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','');
  },50);
}

/* ─── Hide any React booking form that tries to appear ─── */
const hideReactForm=setInterval(()=>{
  const reactFormSelectors=[
    'dialog[open]:not(#nexusBookingSheet)',
    '.bookingFormModal:not(#nexusBookingSheet)',
    '[role="dialog"]:not(#nexusBookingSheet)',
    '.modal[data-testid*="book"]:not(#nexusBookingSheet)'
  ];
  reactFormSelectors.forEach(sel=>{
    document.querySelectorAll(sel).forEach(el=>{
      if(el.id!=='nexusBookingSheet')el.style.display='none!important';
    });
  });
  if(document.getElementById('nexusBookingSheet'))clearInterval(hideReactForm);
},100);
setTimeout(()=>clearInterval(hideReactForm),2000);

})();
