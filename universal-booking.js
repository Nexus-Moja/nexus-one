(function(){
  'use strict';
  const SELECTOR='input[name="pickup"],input[name="destination"],input[placeholder*="pickup"],input[placeholder*="Pickup"],input[placeholder*="destination"],input[placeholder*="Destination"],input[placeholder*="address"],input[placeholder*="Address"]';
  const NOMINATIM='https://nominatim.openstreetmap.org/search';
  let configPromise, mapsPromise;
  const state={enhanced:new WeakSet(), facilities:[], timers:{}};

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
  function scan(){normalizeBookLinks();document.querySelectorAll(SELECTOR).forEach(enhance);}
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',scan);scan();
  window.NexusBooking={scan,refresh:scan,version:'0.42.0'};
})();
