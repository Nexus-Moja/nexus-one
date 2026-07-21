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
    
    // Create manage form with header
    const manageForm=document.createElement('div');
    manageForm.className='nexusManagedTrip';
    manageForm.style.cssText='display:none;padding:0;margin-bottom:16px;background:#fff;border-radius:8px;border:1px solid #dce6ee;overflow:hidden';
    
    // Create header with back button and title
    const header=document.createElement('div');
    header.style.cssText='display:flex;align-items:center;gap:12px;padding:16px;background:#f3f8fb;border-bottom:1px solid #dce6ee';
    header.innerHTML=`
      <button type="button" data-nexus-back style="background:none;border:none;cursor:pointer;font-size:20px;color:#0369a1;padding:4px;display:flex;align-items:center;justify-content:center;width:32px;height:32px;transition:all 0.2s" title="Back to Book a Ride">←</button>
      <h3 style="margin:0;font-size:16px;font-weight:700;color:#082f49;flex:1">Manage Existing Trip</h3>`;
    manageForm.appendChild(header);
    
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
      // Hide original form inputs
      Array.from(formContainer.querySelectorAll('input:not([data-nexus]),select:not([data-nexus]),textarea,button[type="submit"]')).forEach(el=>{
        if(!el.closest('.nexusManagedTrip')){el.style.display='none';}
      });
    });
    
    // Back button in header
    header.querySelector('[data-nexus-back]').addEventListener('click',()=>{
      manageForm.style.display='none';
      manageButton.style.display='block';
      // Show original form inputs
      Array.from(formContainer.querySelectorAll('input:not([data-nexus]),select:not([data-nexus]),textarea,button[type="submit"]')).forEach(el=>{
        if(!el.closest('.nexusManagedTrip')){el.style.display='';}
      });
      // Clear lookup fields
      content.querySelector('input[type="text"]').value='';
      content.querySelector('input[type="tel"]').value='';
    });
    
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
      actions.innerHTML=`
        <div style="background:#f3f8fb;padding:16px;border-radius:8px;border:1px solid #dce6ee;margin-bottom:16px">
          <p style="margin:0 0 12px 0;font-size:13px;font-weight:600;color:#082f49">Trip Details (Edit as needed)</p>
          <label style="display:block;margin-bottom:10px"><span style="font-size:12px;font-weight:600;color:#62758a">Name</span><br>
            <input type="text" data-field="name" value="${booking.name}" style="width:100%;padding:8px 12px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:4px;font-size:13px"></label>
          <label style="display:block;margin-bottom:10px"><span style="font-size:12px;font-weight:600;color:#62758a">Service Type</span><br>
            <input type="text" data-field="service" value="${booking.service}" style="width:100%;padding:8px 12px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:4px;font-size:13px"></label>
          <label style="display:block;margin-bottom:10px"><span style="font-size:12px;font-weight:600;color:#62758a">Pickup Location</span><br>
            <input type="text" data-field="pickup" data-nexus-autocomplete="true" value="${booking.pickup}" placeholder="Pickup address" style="width:100%;padding:8px 12px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:4px;font-size:13px"></label>
          <label style="display:block;margin-bottom:10px"><span style="font-size:12px;font-weight:600;color:#62758a">Destination</span><br>
            <input type="text" data-field="destination" data-nexus-autocomplete="true" value="${booking.destination}" placeholder="Destination address" style="width:100%;padding:8px 12px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:4px;font-size:13px"></label>
          <label style="display:block;margin-bottom:10px"><span style="font-size:12px;font-weight:600;color:#62758a">Email</span><br>
            <input type="email" data-field="email" value="${booking.email||''}" placeholder="name@example.com" style="width:100%;padding:8px 12px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:4px;font-size:13px"></label>
          <label style="display:block;margin-bottom:10px"><span style="font-size:12px;font-weight:600;color:#62758a">Alternate Phone (optional)</span><br>
            <input type="tel" data-field="alternatePhone" value="${booking.alternatePhone||''}" placeholder="(555) 123-4567" style="width:100%;padding:8px 12px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:4px;font-size:13px"></label>
          <label style="display:block;margin-bottom:12px"><span style="font-size:12px;font-weight:600;color:#62758a">Alternate Email (optional)</span><br>
            <input type="email" data-field="alternateEmail" value="${booking.alternateEmail||''}" placeholder="alternate@example.com" style="width:100%;padding:8px 12px;border:1px solid #dce6ee;border-radius:6px;box-sizing:border-box;margin-top:4px;font-size:13px"></label>
        </div>
        <div style="background:#fff;padding:16px;border-radius:8px;border:1px solid #dce6ee;margin-bottom:16px">
          <p style="margin:0 0 12px 0;font-size:13px;font-weight:600;color:#082f49">Trip Summary</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div><span style="font-size:11px;color:#62758a">Passenger</span><br><span style="font-size:13px;font-weight:600;color:#082f49" data-summary="name">${booking.name}</span></div>
            <div><span style="font-size:11px;color:#62758a">Phone</span><br><span style="font-size:13px;font-weight:600;color:#082f49">${phone}</span></div>
            <div><span style="font-size:11px;color:#62758a">Service</span><br><span style="font-size:13px;font-weight:600;color:#082f49" data-summary="service">${booking.service}</span></div>
            <div><span style="font-size:11px;color:#62758a">Email</span><br><span style="font-size:13px;font-weight:600;color:#082f49" data-summary="email">${booking.email||'N/A'}</span></div>
          </div>
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb">
            <div style="margin-bottom:8px"><span style="font-size:11px;color:#62758a">Pickup</span><br><span style="font-size:13px;font-weight:600;color:#082f49" data-summary="pickup">${booking.pickup}</span></div>
            <div style="margin-bottom:8px"><span style="font-size:11px;color:#62758a">Destination</span><br><span style="font-size:13px;font-weight:600;color:#082f49" data-summary="destination">${booking.destination}</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div><span style="font-size:11px;color:#62758a">Distance</span><br><span style="font-size:13px;font-weight:600;color:#082f49" data-summary="distance">${booking.distanceMiles?booking.distanceMiles.toFixed(1)+' mi':'Calculating...'}</span></div>
              <div><span style="font-size:11px;color:#62758a">Estimated Fare</span><br><span style="font-size:13px;font-weight:600;color:#0369a1" data-summary="fare">${booking.estimatedFare?'$'+booking.estimatedFare.toFixed(2):'Calculating...'}</span></div>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button type="button" data-nexus-action="update" style="flex:1;padding:10px;background:#0369a1;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px">Update Details</button>
          <button type="button" data-nexus-action="reschedule" style="flex:1;padding:10px;background:#0369a1;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px">Reschedule</button>
          <button type="button" data-nexus-action="cancel" style="flex:1;padding:10px;background:#e11d48;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px">Cancel</button>
        </div>
        <div class="nexusManageResult" style="display:none;margin-top:12px;padding:10px;border-radius:8px;font-size:13px;font-weight:600"></div>`;
      actions.style.display='block';
      
      // Setup autocomplete for pickup and destination
      const pickupInput=actions.querySelector('[data-field="pickup"]');
      const destInput=actions.querySelector('[data-field="destination"]');
      await facilitySuggestions(pickupInput);
      await facilitySuggestions(destInput);
      
      // Setup Google Maps autocomplete if available
      const cfg=await config();
      if(cfg.googleMapsEnabled&&cfg.googleMapsBrowserKey){
        try{
          await loadMaps(cfg.googleMapsBrowserKey);
          const acPickup=new google.maps.places.Autocomplete(pickupInput,{fields:['formatted_address','geometry','place_id','name'],componentRestrictions:{country:'us'},types:['geocode','establishment']});
          const acDest=new google.maps.places.Autocomplete(destInput,{fields:['formatted_address','geometry','place_id','name'],componentRestrictions:{country:'us'},types:['geocode','establishment']});
          acPickup.addListener('place_changed',()=>{const p=acPickup.getPlace();if(p?.geometry){pickupInput.value=p.formatted_address||p.name||pickupInput.value;pickupInput.dataset.lat=p.geometry.location.lat();pickupInput.dataset.lng=p.geometry.location.lng();calculateRoute();}});
          acDest.addListener('place_changed',()=>{const p=acDest.getPlace();if(p?.geometry){destInput.value=p.formatted_address||p.name||destInput.value;destInput.dataset.lat=p.geometry.location.lat();destInput.dataset.lng=p.geometry.location.lng();calculateRoute();}});
        }catch(e){console.warn('[Nexus] Google autocomplete unavailable for manage trip',e);}
      }
      
      // Live update of summary and calculate route
      const updateSummary=()=>{
        actions.querySelector('[data-summary="name"]').textContent=actions.querySelector('[data-field="name"]').value||booking.name;
        actions.querySelector('[data-summary="service"]').textContent=actions.querySelector('[data-field="service"]').value||booking.service;
        actions.querySelector('[data-summary="email"]').textContent=actions.querySelector('[data-field="email"]').value||booking.email||'N/A';
        actions.querySelector('[data-summary="pickup"]').textContent=pickupInput.value||booking.pickup;
        actions.querySelector('[data-summary="destination"]').textContent=destInput.value||booking.destination;
        calculateRoute();
      };
      
      pickupInput.addEventListener('change',updateSummary);
      destInput.addEventListener('change',updateSummary);
      actions.querySelector('[data-field="name"]').addEventListener('input',updateSummary);
      actions.querySelector('[data-field="service"]').addEventListener('input',updateSummary);
      actions.querySelector('[data-field="email"]').addEventListener('input',updateSummary);
      
      async function calculateRoute(){
        const pickup=pickupInput.value.trim();
        const dest=destInput.value.trim();
        if(!pickup||!dest)return;
        
        const distanceSummary=actions.querySelector('[data-summary="distance"]');
        const fareSummary=actions.querySelector('[data-summary="fare"]');
        distanceSummary.textContent='Calculating...';
        fareSummary.textContent='Calculating...';
        
        try{
          const cfg=await config();
          if(!cfg.googleMapsEnabled)return;
          await loadMaps(cfg.googleMapsBrowserKey);
          const service=new google.maps.DistanceMatrixService();
          const result=await service.getDistanceMatrix({origins:[pickup],destinations:[dest],travelMode:'DRIVING',unitSystem:google.maps.UnitSystem.IMPERIAL});
          if(result.rows[0]?.elements[0]?.status==='OK'){
            const distance=result.rows[0].elements[0].distance.value/1609.34;
            const distanceText=distance.toFixed(1);
            distanceSummary.textContent=distanceText+' mi';
            const baseFare=5.00;
            const perMileFare=2.50;
            const estimatedFare=baseFare+(distance*perMileFare);
            fareSummary.textContent='$'+estimatedFare.toFixed(2);
          }
        }catch(e){
          console.warn('[Nexus] Route calculation failed',e);
          distanceSummary.textContent='N/A';
          fareSummary.textContent='N/A';
        }
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
