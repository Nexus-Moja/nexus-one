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
    input.setAttribute('placeholder','(202) 555-0123');
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
  
  function scan(){normalizeBookLinks();document.querySelectorAll(SELECTOR).forEach(enhance);document.querySelectorAll('input[name="phone"],input[type="tel"],input[placeholder*="phone" i]').forEach(enhancePhoneField);document.querySelectorAll('input[name="email"],input[type="email"],input[placeholder*="email" i]').forEach(enhanceEmailField);}
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',scan);scan();

  // Intercept "Book a Ride" nav links on non-home pages and open an overlay instead of navigating
  function openBookingOverlay(e){
    e.preventDefault();
    if(document.getElementById('nexus-booking-overlay'))return;
    const overlay=document.createElement('div');
    overlay.id='nexus-booking-overlay';
    Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'9999',background:'rgba(8,47,73,0.7)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'});
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
