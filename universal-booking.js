(function(){
  'use strict';
  const SELECTOR='input[name="pickup"],input[name="destination"]';
  let configPromise, mapsPromise;
  const state={enhanced:new WeakSet(), facilities:[]};

  function api(path, options){return fetch('/api'+path, options).then(async r=>{const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Request failed');return data;});}
  function config(){return configPromise||(configPromise=api('/integrations/config').catch(()=>({googleMapsEnabled:false})));}
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
    input.setAttribute('autocomplete','street-address');input.setAttribute('spellcheck','false');input.classList.add('nexusAddressInput');
    await facilitySuggestions(input);
    const cfg=await config();
    if(cfg.googleMapsEnabled&&cfg.googleMapsBrowserKey){
      try{
        await loadMaps(cfg.googleMapsBrowserKey);
        const ac=new google.maps.places.Autocomplete(input,{fields:['formatted_address','geometry','place_id','name'],componentRestrictions:{country:'us'},types:['geocode','establishment']});
        ac.addListener('place_changed',()=>{const p=ac.getPlace();if(!p?.geometry)return;setAddress(input,p.formatted_address||p.name||input.value,{placeId:p.place_id,lat:p.geometry.location.lat(),lng:p.geometry.location.lng()});input.dispatchEvent(new CustomEvent('nexus:address-selected',{bubbles:true,detail:{field:input.name,address:input.value}}));});
      }catch(e){console.warn('[Nexus Booking] Google autocomplete unavailable; facility and browser suggestions remain active.',e);}
    }
  }
  function normalizeBookLinks(){document.querySelectorAll('a[href*="book=1"],button[data-book-ride]').forEach(el=>el.dataset.nexusUnifiedBooking='true');}
  function scan(){normalizeBookLinks();document.querySelectorAll(SELECTOR).forEach(enhance);}
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',scan);scan();
  window.NexusBooking={scan,refresh:scan,version:'0.42.0'};
})();
