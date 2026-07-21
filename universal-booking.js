(function(){
  'use strict';
  const SELECTOR='input[name="pickup"],input[name="destination"],input[placeholder*="pickup"],input[placeholder*="Pickup"],input[placeholder*="destination"],input[placeholder*="Destination"],input[placeholder*="address"],input[placeholder*="Address"]';
  const PHONE_PATTERN=/^\d{3}-\d{3}-\d{4}$/;
  const EMAIL_PATTERN=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const NOMINATIM='https://nominatim.openstreetmap.org/search';
  let configPromise, mapsPromise;
  const state={enhanced:new WeakSet(), facilities:[], timers:{}, phoneFields:new WeakSet(), emailFields:new WeakSet()};

  function api(path, options){return fetch('/api'+path, options).then(async r=>{const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Request failed');return data;});}
  function config(){return configPromise||(configPromise=api('/integrations/config').catch(()=>({googleMapsEnabled:false})));}
  
  // Nominatim typeahead for fallback address search
  async function nominatimSearch(query){
    try{
      const url=NOMINATIM+'?format=json&addressdetails=0&limit=6&countrycodes=us&q='+encodeURIComponent(query);
      const r=await fetch(url,{headers:{'Accept-Language':'en'}});
      const data=await r.json();
      return data.map(d=>({label:d.display_name,lat:parseFloat(d.lat),lng:parseFloat(d.lon)}));
    }catch{return []}
  }
  
  // Build datalist for address suggestions
  function buildDatalist(input){
    let listId='nexus-addr-'+input.name+'-'+Math.random().toString(36).slice(2);
    let list=document.getElementById(listId);
    if(!list){list=document.createElement('datalist');list.id=listId;document.body.appendChild(list);input.setAttribute('list',listId);}
    return {list, listId};
  }
  
  function loadMaps(key){
    if(window.google?.maps?.places)return Promise.resolve(window.google);
    if(mapsPromise)return mapsPromise;
    mapsPromise=new Promise((resolve,reject)=>{
      const cb='nexusMapsReady_'+Math.random().toString(36).slice(2);
      window[cb]=()=>{delete window[cb];resolve(window.google)};
      const s=document.createElement('script');
      s.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&libraries=places&callback='+cb;
      s.async=true;s.defer=true;s.onerror=()=>reject(new Error('Google Maps failed to load'));
      document.head.appendChild(s);
    });
    return mapsPromise;
  }
  function setAddress(input, value, meta){
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
    if(meta){input.dataset.placeId=meta.placeId||'';input.dataset.lat=meta.lat??'';input.dataset.lng=meta.lng??'';}
  }
  async function facilitySuggestions(input){
    let listId='nexus-locations-'+input.name;
    let list=document.getElementById(listId);
    if(!list){list=document.createElement('datalist');list.id=listId;document.body.appendChild(list);input.setAttribute('list',listId);}
    const update=async()=>{
      const q=input.value.trim();if(q.length<2)return;
      try{const data=await api('/locations/search?q='+encodeURIComponent(q));list.innerHTML='';(data.locations||[]).slice(0,10).forEach(x=>{const o=document.createElement('option');o.value=x.address||x.name;o.label=x.name+(x.address?' — '+x.address:'');list.appendChild(o)});}catch{}
    };
    input.addEventListener('input',()=>{clearTimeout(input._nexusSearchTimer);input._nexusSearchTimer=setTimeout(update,180)});
  }
  async function enhance(input){
    if(state.enhanced.has(input))return;state.enhanced.add(input);
    // Set proper name attributes if missing for form submission
    if(!input.name){
      if(input.placeholder.toLowerCase().includes('pickup'))input.name='pickup';
      else if(input.placeholder.toLowerCase().includes('destination'))input.name='destination';
    }
    input.setAttribute('autocomplete','street-address');input.setAttribute('spellcheck','false');input.classList.add('nexusAddressInput');input.removeAttribute('pattern');input.removeAttribute('title');
    input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');
    // Hide validation error indicators
    input.style.backgroundImage='none';
    input.addEventListener('invalid',e=>{e.preventDefault();e.target.style.boxShadow='none'},true);
    // Remove error sibling elements
    setTimeout(()=>{
      let el=input.nextElementSibling;
      while(el){
        if(el.getAttribute('role')==='status'||el.textContent?.includes('!')||el.classList?.contains('error')||el.classList?.contains('invalid')){
          el.style.display='none';
        }
        el=el.nextElementSibling;
      }
    },100);
    await facilitySuggestions(input);
    const cfg=await config();
    if(cfg.googleMapsEnabled&&cfg.googleMapsBrowserKey){
      try{
        await loadMaps(cfg.googleMapsBrowserKey);
        const ac=new google.maps.places.Autocomplete(input,{fields:['formatted_address','geometry','place_id','name'],componentRestrictions:{country:'us'},types:['geocode','establishment']});
        ac.addListener('place_changed',()=>{const p=ac.getPlace();if(!p?.geometry)return;setAddress(input,p.formatted_address||p.name||input.value,{placeId:p.place_id,lat:p.geometry.location.lat(),lng:p.geometry.location.lng()});input.dispatchEvent(new CustomEvent('nexus:address-selected',{bubbles:true,detail:{field:input.name,address:input.value}}));});
      }catch(e){console.warn('[Nexus Booking] Google autocomplete unavailable; facility and browser suggestions remain active.',e);}
    }
    
    // Add Nominatim fallback with datalist for better mobile support
    const dl=buildDatalist(input);
    const inputId=input.name||'addr';
    input.addEventListener('input',async e=>{
      clearTimeout(state.timers[inputId]);
      const q=e.target.value.trim();
      if(q.length<3){dl.list.innerHTML='';return;}
      state.timers[inputId]=setTimeout(async()=>{
        const results=await nominatimSearch(q);
        dl.list.innerHTML='';
        results.slice(0,8).forEach(r=>{
          const opt=document.createElement('option');
          opt.value=r.label;
          opt.textContent=r.label;
          opt.dataset.lat=r.lat;
          opt.dataset.lng=r.lng;
          dl.list.appendChild(opt);
        });
      },280);
    });
  }
  function normalizeBookLinks(){document.querySelectorAll('a[href*="book=1"],button[data-book-ride]').forEach(el=>el.dataset.nexusUnifiedBooking='true');}
  
  function enhancePhoneField(input){
    if(state.phoneFields.has(input))return;
    state.phoneFields.add(input);
    input.setAttribute('inputmode','numeric');
    input.setAttribute('placeholder','(555) 123-4567');
    input.addEventListener('input',e=>{
      let val=e.target.value.replace(/\D/g,'');
      if(val.length>10)val=val.slice(0,10);
      if(val.length===0){e.target.value=''}
      else if(val.length<=3){e.target.value=val}
      else if(val.length<=6){e.target.value=val.slice(0,3)+'-'+val.slice(3)}
      else{e.target.value=val.slice(0,3)+'-'+val.slice(3,6)+'-'+val.slice(6,10)}
    });
    input.addEventListener('blur',e=>{
      const val=e.target.value.replace(/\D/g,'');
      if(val.length===10){
        e.target.value=val.slice(0,3)+'-'+val.slice(3,6)+'-'+val.slice(6);
      }
    });
  }
  
  function enhanceEmailField(input){
    if(state.emailFields.has(input))return;
    state.emailFields.add(input);
    input.setAttribute('type','email');
    input.setAttribute('inputmode','email');
    input.setAttribute('placeholder','name@example.com');
    input.addEventListener('blur',e=>{
      const val=e.target.value.trim();
      if(val.length>0&&!EMAIL_PATTERN.test(val)){
        input.style.borderColor='var(--red, #db2839)';
        input.setCustomValidity('Please enter a valid email address');
      }else{
        input.style.borderColor='';
        input.setCustomValidity('');
      }
    });
  }
  
  function scan(){normalizeBookLinks();document.querySelectorAll(SELECTOR).forEach(enhance);document.querySelectorAll('input[name="phone"],input[type="tel"],input[placeholder*="phone" i]').forEach(enhancePhoneField);document.querySelectorAll('input[name="email"],input[type="email"],input[placeholder*="email" i]').forEach(enhanceEmailField);injectManageTrip();}
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',scan);
  setTimeout(scan,500);setTimeout(scan,1500);setTimeout(scan,3000);
  scan();

  // ── Cancel / Reschedule ──────────────────────────────────────────────────
  function injectManageTrip(){
    // Look for booking form container - if tabs already exist, skip
    if(document.querySelector('.nexusManagedTrip'))return;
    // Find the first phone field - try multiple selectors
    let phoneField=document.querySelector('input[type="tel"]');
    if(!phoneField)phoneField=document.querySelector('input[name="phone"]');
    if(!phoneField)phoneField=document.querySelector('input[placeholder*="phone" i]');
    if(!phoneField){return;}
    
    console.log('[Nexus] Found phone field, searching for parent form...');
    // Find the closest form or form-like container
    let formContainer=phoneField.closest('form')||phoneField.closest('fieldset')||phoneField.closest('[role="dialog"]')||phoneField.closest('[class*="Form"]');
    if(!formContainer){
      // Go up to find a reasonable container
      let el=phoneField;
      for(let i=0;i<8;i++){
        el=el.parentElement;
        if(!el)break;
        if(el.querySelector('input[type="submit"]')||el.querySelector('button[type="submit"]')||el.querySelector('button:not([data-nexus])')){
          formContainer=el;
          break;
        }
      }
    }
    if(!formContainer){console.log('[Nexus] No form container found');return;}
    
    console.log('[Nexus] Found form container, creating manage trip interface...');
    
    // Find form heading - search in formContainer and up the tree
    let formHeading=formContainer.querySelector('h1,h2,h3,h4,h5,h6');
    if(!formHeading&&formContainer.previousElementSibling){
      formHeading=formContainer.previousElementSibling.querySelector('h1,h2,h3,h4,h5,h6');
    }
    if(!formHeading){
      let parent=formContainer.parentElement;
      for(let i=0;i<4&&!formHeading&&parent;i++){
        formHeading=parent.querySelector('h1,h2,h3,h4,h5,h6');
        parent=parent.parentElement;
      }
    }
    const originalHeadingText=formHeading?.textContent?.trim();
    console.log('[Nexus] Found heading:',formHeading?.tagName,originalHeadingText);
    
    // Create manage form with header
    const manageForm=document.createElement('div');
    manageForm.className='nexusManagedTrip';
    manageForm.style.cssText='display:none;padding:0;margin-bottom:16px;background:#fff;border-radius:8px;border:1px solid #dce6ee;overflow:hidden';
    

    // Create content container
    const content=document.createElement('div');
    content.style.cssText='padding:16px;background:#fff';
    content.innerHTML=`
      <p style="font-size:13px;color:#62758a;margin:0 0 12px 0">Enter your trip reference number or name and phone to reschedule or cancel.</p>
      <label style="display:block;margin-bottom:8px"><span style="font-size:13px;font-weight:600;color:#082f49">Trip Reference or Name</span><br>
        <input type="text" placeholder="e.g., NMT-20260721-1234 or John Smith" maxlength="50" style="width:100%;padding:8px 12px;border:1px solid #dce6ee;border-radius:8px;box-sizing:border-box;margin-top:4px;font-size:14px"></label>
      <label style="display:block;margin-bottom:12px"><span style="font-size:13px;font-weight:600;color:#082f49">Phone Number</span><br>
        <input type="tel" placeholder="(555) 123-4567" maxlength="20" style="width:100%;padding:8px 12px;border:1px solid #dce6ee;border-radius:8px;box-sizing:border-box;margin-top:4px;font-size:14px"></label>
      <button type="button" data-nexus-lookup style="width:100%;padding:10px;background:#0369a1;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px">Look Up Trip</button>
      <div class="nexusLookupMsg" style="display:none;margin-top:12px;padding:10px;border-radius:8px;font-size:13px;font-weight:600"></div>
      <div class="nexusManageActions" style="display:none;margin-top:12px"></div>`;
    manageForm.appendChild(content);
    
    // Create "Manage Trip" button to show the manage form (replaces manage tab)
    const manageButton=document.createElement('button');
    manageButton.type='button';
    manageButton.textContent='Manage Existing Trip';
    manageButton.className='nexus-manage-btn';
    manageButton.style.cssText='width:100%;padding:12px;background:none;border:none;cursor:pointer;font-size:14px;font-weight:600;color:#0369a1;text-decoration:underline;margin-bottom:16px;transition:all 0.2s';
    
    // Insert manage form and button at the very top of the form container
    formContainer.insertBefore(manageButton, formContainer.firstChild);
    formContainer.insertBefore(manageForm, formContainer.firstChild);
    
    console.log('[Nexus] Manage trip interface injected successfully');
    
    // Show manage form when button is clicked
    manageButton.addEventListener('click',()=>{
      manageForm.style.display='block';
      manageButton.style.display='none';
      console.log('[Nexus] Manage button clicked - formHeading:',formHeading?.tagName,formHeading?.textContent);
      // Swap form heading inside the dialog
      if(formHeading){
        console.log('[Nexus] Swapping heading text to: ← Manage Existing Trip');
        formHeading.textContent='← Manage Existing Trip';
      }else{
        console.log('[Nexus] WARNING: formHeading is null or undefined');
      }
      // Hide original form inputs
      Array.from(formContainer.querySelectorAll('input:not([data-nexus]),select:not([data-nexus]),textarea,button[type="submit"]')).forEach(el=>{
        if(!el.closest('.nexusManagedTrip')){el.style.display='none';}
      });
    });
    
    // Back to booking form: add click handler to restore heading when manage form closes
    function restoreBookingForm(){
      manageForm.style.display='none';
      manageButton.style.display='block';
      console.log('[Nexus] Back clicked - restoring heading to:',originalHeadingText);
      if(formHeading&&originalHeadingText){
        formHeading.textContent=originalHeadingText;
      }else{
        console.log('[Nexus] WARNING: Cannot restore - formHeading:',!!formHeading,'originalHeadingText:',originalHeadingText);
      }
      // Show original form inputs
      Array.from(formContainer.querySelectorAll('input:not([data-nexus]),select:not([data-nexus]),textarea,button[type="submit"]')).forEach(el=>{
        if(!el.closest('.nexusManagedTrip')){el.style.display='';}
      });
      // Clear lookup fields
      content.querySelector('input[type="text"]').value='';
      content.querySelector('input[type="tel"]').value='';
      manageForm.querySelector('.nexusLookupMsg').style.display='none';
      manageForm.querySelector('.nexusManageActions').style.display='none';
    }
    
    // Restore booking form when heading is clicked (back arrow interaction)
    if(formHeading){
      formHeading.style.cursor='pointer';
      formHeading.addEventListener('click',restoreBookingForm);
    }
    
    // Lookup trip
    manageForm.querySelector('[data-nexus-lookup]').addEventListener('click',async()=>{
      const tripRef=manageForm.querySelector('input[type="text"]').value.trim();
      const phone=manageForm.querySelector('input[type="tel"]').value.trim();
      if(!tripRef||!phone){showManageMsg('Please enter both trip reference and phone number.',false);return;}
      const btn=manageForm.querySelector('[data-nexus-lookup]');
      btn.disabled=true;btn.textContent='Looking up...';
      try{
        const r=await fetch(`/api/bookings/${encodeURIComponent(tripRef)}?phone=${encodeURIComponent(phone)}`);
        const data=await r.json();
        if(!r.ok)throw new Error(data.error||'Trip not found');
        await showManageActions(data.booking,tripRef,phone);
      }catch(e){showManageMsg(e.message,false);btn.disabled=false;btn.textContent='Look Up Trip';}
    });
    
    function showManageMsg(msg,ok){
      const el=manageForm.querySelector('.nexusLookupMsg');
      el.textContent=msg;el.style.display='block';
      el.style.background=ok?'#d1fae5':'#fff1f2';
      el.style.color=ok?'#047857':'#e11d48';
      el.style.borderLeft=`4px solid ${ok?'#10b981':'#e11d48'}`;
    }
    
    async function showManageActions(booking,ref,phone){
      const actions=manageForm.querySelector('.nexusManageActions');
      const statusColor=booking.status==='cancelled'?'#e11d48':booking.status==='completed'?'#059669':'#0369a1';
      const statusBg=booking.status==='cancelled'?'#fff1f2':booking.status==='completed'?'#d1fae5':'#dbeafe';
      const statusLabel=(booking.status||'confirmed').replace(/^\w/,c=>c.toUpperCase());
      const tripDate=booking.date?new Date(booking.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}):'';
      const initDist=booking.distanceMiles?booking.distanceMiles.toFixed(1)+' mi':'—';
      const initFare=booking.estimatedFare?'$'+Number(booking.estimatedFare).toFixed(2):'—';
      actions.innerHTML=`
        <div style="background:#f8fafc;border:1px solid #dce6ee;border-radius:10px;overflow:hidden;margin-bottom:2px">
          <!-- Trip header strip -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#fff;border-bottom:1px solid #f0f4f8">
            <span style="font-size:11px;font-weight:700;color:#082f49;letter-spacing:.5px">${ref}</span>
            <div style="display:flex;align-items:center;gap:8px">
              ${tripDate?`<span style="font-size:11px;color:#62758a">${tripDate}${booking.time?' · '+booking.time:''}</span>`:''}
              <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;background:${statusBg};color:${statusColor}">${statusLabel}</span>
            </div>
          </div>
          <!-- Route card -->
          <div style="padding:12px 14px;background:#fff;border-bottom:1px solid #f0f4f8">
            <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
              <div style="display:flex;flex-direction:column;align-items:center;padding-top:3px;gap:2px;flex-shrink:0">
                <span style="width:10px;height:10px;border-radius:50%;background:#0369a1;display:block"></span>
                <span style="width:2px;height:18px;background:#dce6ee;display:block"></span>
                <span style="width:10px;height:10px;border-radius:50%;background:#e11d48;display:block"></span>
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:600;color:#082f49;margin-bottom:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" data-summary="pickup">${booking.pickup}</div>
                <div style="font-size:12px;font-weight:600;color:#082f49;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" data-summary="destination">${booking.destination}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;background:#f0f6ff;border-radius:8px;overflow:hidden;border:1px solid #dbeafe">
              <div style="padding:8px 10px;text-align:center;border-right:1px solid #dbeafe">
                <div style="font-size:10px;color:#62758a;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Distance</div>
                <div style="font-size:13px;font-weight:700;color:#082f49;margin-top:2px" data-summary="distance">${initDist}</div>
              </div>
              <div style="padding:8px 10px;text-align:center;border-right:1px solid #dbeafe">
                <div style="font-size:10px;color:#62758a;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Est. Fare</div>
                <div style="font-size:13px;font-weight:700;color:#0369a1;margin-top:2px" data-summary="fare">${initFare}</div>
              </div>
              <div style="padding:8px 10px;text-align:center">
                <div style="font-size:10px;color:#62758a;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Service</div>
                <div style="font-size:12px;font-weight:700;color:#082f49;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" data-summary="service">${booking.service||'—'}</div>
              </div>
            </div>
          </div>
          <!-- Edit fields -->
          <div style="padding:14px;background:#f8fafc">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#62758a;text-transform:uppercase;letter-spacing:.5px">Edit Details</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
              <label><span style="font-size:11px;font-weight:600;color:#62758a">Name</span><br>
                <input type="text" data-field="name" value="${booking.name}" style="width:100%;padding:7px 10px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:3px;font-size:12px;background:#fff"></label>
              <label><span style="font-size:11px;font-weight:600;color:#62758a">Service</span><br>
                <input type="text" data-field="service" value="${booking.service}" style="width:100%;padding:7px 10px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:3px;font-size:12px;background:#fff"></label>
            </div>
            <label style="display:block;margin-bottom:8px"><span style="font-size:11px;font-weight:600;color:#62758a">Pickup</span><br>
              <input type="text" data-field="pickup" data-nexus-autocomplete="true" value="${booking.pickup}" placeholder="Pickup address" style="width:100%;padding:7px 10px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:3px;font-size:12px;background:#fff"></label>
            <label style="display:block;margin-bottom:8px"><span style="font-size:11px;font-weight:600;color:#62758a">Destination</span><br>
              <input type="text" data-field="destination" data-nexus-autocomplete="true" value="${booking.destination}" placeholder="Destination address" style="width:100%;padding:7px 10px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:3px;font-size:12px;background:#fff"></label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
              <label><span style="font-size:11px;font-weight:600;color:#62758a">Email</span><br>
                <input type="email" data-field="email" value="${booking.email||''}" placeholder="name@example.com" style="width:100%;padding:7px 10px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:3px;font-size:12px;background:#fff"></label>
              <label><span style="font-size:11px;font-weight:600;color:#62758a">Alt Phone</span><br>
                <input type="tel" data-field="alternatePhone" value="${booking.alternatePhone||''}" placeholder="(555) 123-4567" style="width:100%;padding:7px 10px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:3px;font-size:12px;background:#fff"></label>
            </div>
            <label style="display:block;margin-bottom:4px"><span style="font-size:11px;font-weight:600;color:#62758a">Alt Email</span><br>
              <input type="email" data-field="alternateEmail" value="${booking.alternateEmail||''}" placeholder="alternate@example.com" style="width:100%;padding:7px 10px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:3px;font-size:12px;background:#fff"></label>
          </div>
          <!-- Action buttons -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-top:1px solid #f0f4f8">
            <button type="button" data-nexus-action="update" style="padding:11px 6px;background:#0369a1;color:#fff;border:none;border-right:1px solid rgba(255,255,255,.2);font-weight:600;cursor:pointer;font-size:12px;transition:background .15s">Save</button>
            <button type="button" data-nexus-action="reschedule" style="padding:11px 6px;background:#0369a1;color:#fff;border:none;border-right:1px solid rgba(255,255,255,.2);font-weight:600;cursor:pointer;font-size:12px;transition:background .15s">Reschedule</button>
            <button type="button" data-nexus-action="cancel" style="padding:11px 6px;background:#e11d48;color:#fff;border:none;font-weight:600;cursor:pointer;font-size:12px;transition:background .15s">Cancel Trip</button>
          </div>
        </div>
        <div class="nexusManageResult" style="display:none;margin-top:8px;padding:10px;border-radius:8px;font-size:13px;font-weight:600"></div>`;
      actions.style.display='block';
      
      const pickupInput=actions.querySelector('[data-field="pickup"]');
      const destInput=actions.querySelector('[data-field="destination"]');
      await facilitySuggestions(pickupInput);
      await facilitySuggestions(destInput);
      
      const cfg=await config();
      if(cfg.googleMapsEnabled&&cfg.googleMapsBrowserKey){
        try{
          await loadMaps(cfg.googleMapsBrowserKey);
          const acPickup=new google.maps.places.Autocomplete(pickupInput,{fields:['formatted_address','geometry','place_id','name'],componentRestrictions:{country:'us'},types:['geocode','establishment']});
          const acDest=new google.maps.places.Autocomplete(destInput,{fields:['formatted_address','geometry','place_id','name'],componentRestrictions:{country:'us'},types:['geocode','establishment']});
          acPickup.addListener('place_changed',()=>{const p=acPickup.getPlace();if(p?.geometry){pickupInput.value=p.formatted_address||p.name||pickupInput.value;pickupInput.dataset.lat=p.geometry.location.lat();pickupInput.dataset.lng=p.geometry.location.lng();calculateRoute();}});
          acDest.addListener('place_changed',()=>{const p=acDest.getPlace();if(p?.geometry){destInput.value=p.formatted_address||p.name||destInput.value;destInput.dataset.lat=p.geometry.location.lat();destInput.dataset.lng=p.geometry.location.lng();calculateRoute();}});
        }catch(e){console.warn('[Nexus] Google autocomplete unavailable',e);}
      }
      
      const updateRouteCard=()=>{
        actions.querySelector('[data-summary="pickup"]').textContent=pickupInput.value||booking.pickup;
        actions.querySelector('[data-summary="destination"]').textContent=destInput.value||booking.destination;
        actions.querySelector('[data-summary="service"]').textContent=actions.querySelector('[data-field="service"]').value||booking.service||'—';
        calculateRoute();
      };
      pickupInput.addEventListener('change',updateRouteCard);
      destInput.addEventListener('change',updateRouteCard);
      actions.querySelector('[data-field="service"]').addEventListener('input',updateRouteCard);
      
      async function calculateRoute(){
        const pickup=pickupInput.value.trim();
        const dest=destInput.value.trim();
        if(!pickup||!dest)return;
        const distEl=actions.querySelector('[data-summary="distance"]');
        const fareEl=actions.querySelector('[data-summary="fare"]');
        distEl.textContent='…';fareEl.textContent='…';
        try{
          const c=await config();
          if(!c.googleMapsEnabled)return;
          await loadMaps(c.googleMapsBrowserKey);
          const svc=new google.maps.DistanceMatrixService();
          const result=await svc.getDistanceMatrix({origins:[pickup],destinations:[dest],travelMode:'DRIVING',unitSystem:google.maps.UnitSystem.IMPERIAL});
          if(result.rows[0]?.elements[0]?.status==='OK'){
            const miles=result.rows[0].elements[0].distance.value/1609.34;
            distEl.textContent=miles.toFixed(1)+' mi';
            fareEl.textContent='$'+(5+(miles*2.5)).toFixed(2);
          }
        }catch(e){distEl.textContent='N/A';fareEl.textContent='N/A';}
      }
      calculateRoute();
      
      actions.querySelector('[data-nexus-action="cancel"]').addEventListener('click',()=>doCancel(ref,phone,actions));
      actions.querySelector('[data-nexus-action="reschedule"]').addEventListener('click',()=>doReschedule(ref,phone,actions));
      actions.querySelector('[data-nexus-action="update"]').addEventListener('click',()=>doUpdate(ref,phone,actions));
    }
    
    function doUpdate(ref,phone,actions){
      const result=actions.querySelector('.nexusManageResult');
      const name=actions.querySelector('[data-field="name"]').value.trim();
      const service=actions.querySelector('[data-field="service"]').value.trim();
      const pickup=actions.querySelector('[data-field="pickup"]').value.trim();
      const destination=actions.querySelector('[data-field="destination"]').value.trim();
      const email=actions.querySelector('[data-field="email"]').value.trim();
      const alternatePhone=actions.querySelector('[data-field="alternatePhone"]').value.trim();
      const alternateEmail=actions.querySelector('[data-field="alternateEmail"]').value.trim();
      
      if(!name||!service||!pickup||!destination){showManageMsg('Please fill in all required fields.',false);return;}
      
      const updateBtn=actions.querySelector('[data-nexus-action="update"]');
      updateBtn.disabled=true;updateBtn.textContent='Updating...';
      
      fetch(`/api/bookings/${encodeURIComponent(ref)}/update`,{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({phone,name,service,pickup,destination,email,alternatePhone,alternateEmail})
      }).then(r=>r.json()).then(data=>{
        if(!data.booking)throw new Error(data.error||'Update failed');
        showManageMsg('✓ Trip details updated successfully. Confirmation sent via text and email.',true);
        updateBtn.textContent='Update Details';
        updateBtn.disabled=false;
      }).catch(e=>{
        showManageMsg(e.message,false);
        updateBtn.textContent='Update Details';
        updateBtn.disabled=false;
      });
    }
    
    function doCancel(ref,phone,actions){
      const result=actions.querySelector('.nexusManageResult');
      result.innerHTML=`<label style="display:block;margin-bottom:8px"><span style="font-size:12px;font-weight:600;color:#082f49">Cancellation Reason (optional)</span><br>
        <textarea placeholder="e.g., Found alternative transport" maxlength="200" style="width:100%;height:60px;padding:8px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:4px;font-size:13px;resize:none"></textarea></label>
        <button type="button" data-nexus-do-cancel style="width:100%;padding:8px;background:#e11d48;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">Confirm Cancellation</button>`;
      result.style.display='block';
      result.querySelector('[data-nexus-do-cancel]').addEventListener('click',async()=>{
        const reason=result.querySelector('textarea').value.trim();
        const btn=result.querySelector('[data-nexus-do-cancel]');
        btn.disabled=true;btn.textContent='Cancelling...';
        try{
          const r=await fetch(`/api/bookings/${encodeURIComponent(ref)}/cancel`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone,reason})});
          const data=await r.json();
          if(!r.ok)throw new Error(data.error||'Cancellation failed');
          showManageMsg('✓ Trip cancelled. Confirmation sent via text and email.',true);
          actions.style.display='none';
        }catch(e){const msg=result.querySelector('.nexusMsg')||document.createElement('div');msg.textContent=e.message;msg.style.cssText='padding:8px;background:#fff1f2;color:#e11d48;border-radius:6px;margin-bottom:8px;font-size:12px;font-weight:600';result.insertBefore(msg,result.firstChild);btn.disabled=false;btn.textContent='Confirm Cancellation';}
      });
    }
    
    function doReschedule(ref,phone,actions){
      const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
      const minDate=tomorrow.toISOString().slice(0,10);
      const result=actions.querySelector('.nexusManageResult');
      result.innerHTML=`<label style="display:block;margin-bottom:8px"><span style="font-size:12px;font-weight:600;color:#082f49">New Date</span><br>
        <input type="date" name="date" min="${minDate}" style="width:100%;padding:8px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:4px;font-size:13px"></label>
        <label style="display:block;margin-bottom:8px"><span style="font-size:12px;font-weight:600;color:#082f49">New Time</span><br>
        <input type="time" name="time" style="width:100%;padding:8px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:4px;font-size:13px"></label>
        <button type="button" data-nexus-do-reschedule style="width:100%;padding:8px;background:#0369a1;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">Confirm Reschedule</button>`;
      result.style.display='block';
      result.querySelector('[data-nexus-do-reschedule]').addEventListener('click',async()=>{
        const date=result.querySelector('[name="date"]').value;
        const time=result.querySelector('[name="time"]').value;
        if(!date||!time){const msg=document.createElement('div');msg.textContent='Please fill in date and time.';msg.style.cssText='padding:8px;background:#fff1f2;color:#e11d48;border-radius:6px;margin-bottom:8px;font-size:12px;font-weight:600';result.insertBefore(msg,result.firstChild);return;}
        const btn=result.querySelector('[data-nexus-do-reschedule]');
        btn.disabled=true;btn.textContent='Rescheduling...';
        try{
          const r=await fetch(`/api/bookings/${encodeURIComponent(ref)}/reschedule`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone,date,time})});
          const data=await r.json();
          if(!r.ok)throw new Error(data.error||'Reschedule failed');
          showManageMsg(`✓ Trip rescheduled to ${date} at ${time}. Confirmation sent via text and email.`,true);
          actions.style.display='none';
        }catch(e){const msg=result.querySelector('.nexusMsg')||document.createElement('div');msg.textContent=e.message;msg.style.cssText='padding:8px;background:#fff1f2;color:#e11d48;border-radius:6px;margin-bottom:8px;font-size:12px;font-weight:600';result.insertBefore(msg,result.firstChild);btn.disabled=false;btn.textContent='Confirm Reschedule';}
      });
    }
  }

  function injectManageButtons(successEl){
    if(successEl._nexusManaged)return;
    successEl._nexusManaged=true;
    // Extract reference and phone from the success screen
    const refText=successEl.querySelector('b')?.textContent?.trim()||'';
    const ref=refText.match(/NMT-[\w-]+/)?.[0]||'';
    if(!ref)return;
    // Build the manage section
    const section=document.createElement('div');
    section.className='nexusManageTrip';
    section.style.cssText='margin-top:20px;padding-top:18px;border-top:1px solid #dce6ee;display:flex;flex-direction:column;gap:10px';
    section.innerHTML=`
      <p style="font-size:13px;color:#62758a;margin:0">Need to make a change?</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button type="button" data-nexus-action="reschedule" style="flex:1;min-width:120px;padding:10px 16px;border-radius:10px;border:1px solid #dce6ee;background:#f3f8fb;color:#082f49;font-weight:600;font-size:14px;cursor:pointer">Reschedule</button>
        <button type="button" data-nexus-action="cancel" style="flex:1;min-width:120px;padding:10px 16px;border-radius:10px;border:1px solid #fecdd3;background:#fff1f2;color:#e11d48;font-weight:600;font-size:14px;cursor:pointer">Cancel Trip</button>
      </div>
      <div class="nexusManageForm" style="display:none"></div>
      <div class="nexusManageMsg" style="display:none;padding:10px 14px;border-radius:8px;font-size:14px;font-weight:600"></div>`;
    successEl.appendChild(section);

    function showMsg(msg,ok){
      const el=section.querySelector('.nexusManageMsg');
      el.textContent=msg;el.style.display='block';
      el.style.background=ok?'#d1fae5':'#fff1f2';el.style.color=ok?'#047857':'#e11d48';
      el.style.border=`1px solid ${ok?'#6ee7b7':'#fecdd3'}`;
    }
    function phoneVerifyField(){
      const w=document.createElement('div');
      w.style.cssText='display:flex;flex-direction:column;gap:8px';
      w.innerHTML=`<label style="font-size:13px;font-weight:600;color:#62758a">Verify your phone number</label>
        <input type="tel" placeholder="202-555-0123" maxlength="20" style="padding:9px 12px;border:1px solid #dce6ee;border-radius:8px;font-size:14px;width:100%;box-sizing:border-box">`;
      return w;
    }
    section.querySelector('[data-nexus-action="cancel"]').addEventListener('click',()=>{
      const form=section.querySelector('.nexusManageForm');
      form.style.display='block';
      form.innerHTML='';
      const pf=phoneVerifyField();
      const btn=document.createElement('button');
      btn.type='button';btn.textContent='Confirm Cancellation';
      btn.style.cssText='padding:10px 16px;background:#e11d48;color:#fff;border:none;border-radius:8px;font-weight:600;font-size:14px;cursor:pointer;margin-top:4px';
      btn.onclick=async()=>{
        const phone=pf.querySelector('input').value.trim();
        if(!phone){showMsg('Please enter your phone number to confirm.', false);return;}
        btn.disabled=true;btn.textContent='Cancelling…';
        try{
          const r=await fetch(`/api/bookings/${encodeURIComponent(ref)}/cancel`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone})});
          const data=await r.json();
          if(!r.ok)throw new Error(data.error||'Cancellation failed');
          form.style.display='none';
          showMsg('✓ Trip cancelled. A confirmation text/email has been sent.',true);
          section.querySelectorAll('[data-nexus-action]').forEach(b=>b.style.display='none');
        }catch(e){showMsg(e.message,false);btn.disabled=false;btn.textContent='Confirm Cancellation';}
      };
      form.appendChild(pf);form.appendChild(btn);
    });

    section.querySelector('[data-nexus-action="reschedule"]').addEventListener('click',()=>{
      const form=section.querySelector('.nexusManageForm');
      form.style.display='block';
      form.innerHTML='';
      const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
      const minDate=tomorrow.toISOString().slice(0,10);
      form.innerHTML=`
        <div style="display:flex;flex-direction:column;gap:8px">
          <label style="font-size:13px;font-weight:600;color:#62758a">Verify your phone number</label>
          <input type="tel" name="phone" placeholder="202-555-0123" maxlength="20" style="padding:9px 12px;border:1px solid #dce6ee;border-radius:8px;font-size:14px;width:100%;box-sizing:border-box">
          <label style="font-size:13px;font-weight:600;color:#62758a;margin-top:4px">New date</label>
          <input type="date" name="date" min="${minDate}" style="padding:9px 12px;border:1px solid #dce6ee;border-radius:8px;font-size:14px;width:100%;box-sizing:border-box">
          <label style="font-size:13px;font-weight:600;color:#62758a">New time</label>
          <input type="time" name="time" style="padding:9px 12px;border:1px solid #dce6ee;border-radius:8px;font-size:14px;width:100%;box-sizing:border-box">
          <button type="button" data-nexus-submit style="padding:10px 16px;background:#0369a1;color:#fff;border:none;border-radius:8px;font-weight:600;font-size:14px;cursor:pointer;margin-top:4px">Confirm Reschedule</button>
        </div>`;
      form.querySelector('[data-nexus-submit]').addEventListener('click',async()=>{
        const phone=form.querySelector('[name="phone"]').value.trim();
        const date=form.querySelector('[name="date"]').value;
        const time=form.querySelector('[name="time"]').value;
        if(!phone||!date||!time){showMsg('Please fill in all fields.',false);return;}
        const btn2=form.querySelector('[data-nexus-submit]');
        btn2.disabled=true;btn2.textContent='Rescheduling…';
        try{
          const r=await fetch(`/api/bookings/${encodeURIComponent(ref)}/reschedule`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone,date,time})});
          const data=await r.json();
          if(!r.ok)throw new Error(data.error||'Reschedule failed');
          form.style.display='none';
          showMsg(`✓ Trip rescheduled to ${date} at ${time}. A confirmation text/email has been sent.`,true);
          section.querySelectorAll('[data-nexus-action]').forEach(b=>b.style.display='none');
        }catch(e){showMsg(e.message,false);btn2.disabled=false;btn2.textContent='Confirm Reschedule';}
      });
    });
  }

  // Watch for React forms and success screens
  new MutationObserver(()=>{
    document.querySelectorAll('.success[role="status"]').forEach(injectManageButtons);
    injectManageTrip();
  }).observe(document.documentElement,{childList:true,subtree:true});

  // Intercept "Book a Ride" nav links on non-home pages and open an overlay instead of navigating
  function openBookingOverlay(e){
    e.preventDefault();
    if(document.getElementById('nexus-booking-overlay'))return;
    const overlay=document.createElement('div');
    overlay.id='nexus-booking-overlay';
    Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'9999',background:'#e8eef5',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'none'});
    const frame=document.createElement('iframe');
    frame.src='/?book=1';
    frame.title='Book a Ride';
    // sandbox: allow scripts, forms, popups (for payment), same-origin for postMessage
    frame.setAttribute('sandbox','allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    Object.assign(frame.style,{width:'min(780px,100%)',height:'min(92vh,780px)',border:'none',borderRadius:'18px',background:'#fff',boxShadow:'0 32px 80px rgba(8,47,73,0.35)'});
    const close=document.createElement('button');
    close.setAttribute('aria-label','Close booking form');
    Object.assign(close.style,{position:'absolute',top:'16px',right:'20px',background:'none',border:'none',color:'#fff',fontSize:'28px',cursor:'pointer',lineHeight:'1',padding:'4px 8px'});
    close.textContent='\u00d7';
    const closeOverlay=()=>{if(overlay.parentNode)overlay.parentNode.removeChild(overlay);};
    close.onclick=closeOverlay;
    overlay.appendChild(close);
    overlay.appendChild(frame);
    overlay.addEventListener('click',ev=>{if(ev.target===overlay)closeOverlay();});
    document.addEventListener('keydown',function esc(ev){if(ev.key==='Escape'){closeOverlay();document.removeEventListener('keydown',esc);}});
    document.body.appendChild(overlay);
    // Auto-close when booking succeeds: watch iframe DOM for .success element
    frame.addEventListener('load',()=>{
      try{
        frame.contentWindow.postMessage({type:'nexus:openBooking'},'*');
        // Watch for booking success div appearing inside the iframe
        const iDoc=frame.contentDocument||frame.contentWindow.document;
        const successObserver=new MutationObserver(()=>{
          if(iDoc.querySelector('.success[role="status"]')){
            successObserver.disconnect();
            // Brief delay so user sees the confirmation, then close
            setTimeout(closeOverlay, 4000);
          }
        });
        successObserver.observe(iDoc.body||iDoc.documentElement,{childList:true,subtree:true});
      }catch{}
    });
  }

  function attachBookingInterceptors(){
    // Only intercept on non-home pages (home page uses the React nav button directly)
    const isHome=location.pathname==='/'||location.pathname==='/index.html';
    if(isHome)return;
    document.querySelectorAll('a[href="/?book=1"],a[href*="book=1"]').forEach(a=>{
      if(!a._nexusIntercepted){a._nexusIntercepted=true;a.addEventListener('click',openBookingOverlay);}
    });
  }

  document.addEventListener('DOMContentLoaded',attachBookingInterceptors);
  new MutationObserver(attachBookingInterceptors).observe(document.documentElement,{childList:true,subtree:true});
  window.NexusBooking={scan,refresh:scan,openBookingOverlay,version:'0.42.0'};
})();
