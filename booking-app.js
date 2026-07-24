(function(){
  const $ = (id) => document.getElementById(id);
  const form = $('bookingForm');
  const estimateBtn = $('estimateBtn');
  const submitBtn = $('submitBtn');
  const serviceChips = $('serviceChips');
  const statusMsg = $('statusMsg');
  const estMiles = $('estMiles');
  const estDuration = $('estDuration');
  const estFare = $('estFare');
  const rateSourceLabel = $('rateSourceLabel');
  const rateBase = $('rateBase');
  const rateIncluded = $('rateIncluded');
  const ratePerMile = $('ratePerMile');
  const rateWait = $('rateWait');
  const saveRateBtn = $('saveRateBtn');
  const resetRateBtn = $('resetRateBtn');
  const telemetryMapEl = $('telemetryMap');
  const telemetryStatus = $('telemetryStatus');
  const telemetryList = $('telemetryList');

  const FALLBACK_PRICING = {
    wheelchair:{label:'Wheelchair Transportation',base:95,includedMiles:10,perMile:4.25,waitPer15:25},
    ambulatory:{label:'Ambulatory Transportation',base:65,includedMiles:5,perMile:3.25,waitPer15:20},
    broda:{label:'Broda Chair Transportation',base:145,includedMiles:10,perMile:5.25,waitPer15:25},
    stretcher:{label:'Stretcher Transportation',base:260,includedMiles:10,perMile:7.5,waitPer15:35},
    bariatric:{label:'Bariatric Transportation',base:385,includedMiles:10,perMile:9.5,waitPer15:45},
    bls:{label:'BLS Ambulance',base:725,includedMiles:0,perMile:17.5,waitPer15:55},
    als1:{label:'ALS I Ambulance',base:925,includedMiles:0,perMile:20,waitPer15:65},
    als2:{label:'ALS II Ambulance',base:1350,includedMiles:0,perMile:23,waitPer15:75}
  };

  let mapsReadyPromise = null;
  let mapsEnabled = false;
  let mapsBrowserKey = '';
  let estimateState = { miles: 0, durationText: '', fare: 0 };
  let pickupAutocomplete = null;
  let destinationAutocomplete = null;
  let telemetryMap = null;
  let telemetryMarkers = new Map();
  let telemetryTimer = null;

  function setStatus(message, type){
    statusMsg.textContent = message;
    statusMsg.className = `msg ${type}`;
  }

  function clearStatus(){
    statusMsg.textContent = '';
    statusMsg.className = 'msg';
  }

  function setBusy(button, isBusy, busyText, idleText){
    button.disabled = isBusy;
    button.textContent = isBusy ? busyText : idleText;
  }

  function debounce(fn, waitMs){
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), waitMs);
    };
  }

  function normalizeService(value){
    return String(value || 'ambulatory').trim().toLowerCase();
  }

  function getPricing(service){
    const svc = normalizeService(service);
    const fromCore = window.NexusCore?.getPricing?.() || FALLBACK_PRICING;
    return fromCore[svc] || FALLBACK_PRICING[svc] || FALLBACK_PRICING.ambulatory;
  }

  function getAllPricing(){
    return window.NexusCore?.getPricing?.() || FALLBACK_PRICING;
  }

  function saveAllPricing(pricing){
    if(window.NexusCore?.savePricing){
      window.NexusCore.savePricing(pricing);
      return;
    }
    localStorage.setItem('nexusPricing', JSON.stringify(pricing));
  }

  function calculateFare(service, miles, dateStr){
    const rate = getPricing(service);
    const distance = Math.max(0, Number(miles) || 0);
    const billable = Math.max(0, distance - Number(rate.includedMiles || 0));
    const subtotal = Number(rate.base || 0) + billable * Number(rate.perMile || 0);

    const tripDate = new Date(dateStr || new Date());
    const day = tripDate.getDay();
    const isWeekend = day === 0 || day === 6;
    const md = tripDate.toISOString().slice(5,10);
    const isHoliday = ['01-01','07-04','11-28','12-25'].includes(md);
    const discountPct = isHoliday ? 10 : (!isWeekend ? 5 : 0);
    const discount = subtotal * (discountPct / 100);

    return Math.max(0, subtotal - discount);
  }

  async function loadIntegrationConfig(){
    try{
      const r = await fetch('/api/integrations/config', { cache: 'no-store' });
      if(!r.ok) return;
      const cfg = await r.json();
      mapsEnabled = !!cfg.googleMapsEnabled;
      mapsBrowserKey = String(cfg.googleMapsBrowserKey || '').trim();
    }catch{
      mapsEnabled = false;
    }
  }

  function loadMaps(){
    if(mapsReadyPromise) return mapsReadyPromise;
    mapsReadyPromise = new Promise((resolve, reject) => {
      if(window.google?.maps?.DirectionsService){ resolve(); return; }
      if(!mapsEnabled || !mapsBrowserKey){ reject(new Error('Google Maps is not configured.')); return; }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsBrowserKey)}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load Google Maps.'));
      document.head.appendChild(script);
    });
    return mapsReadyPromise;
  }

  function resetEstimateUi(){
    estimateState = { miles: 0, durationText: '', fare: 0 };
    estMiles.textContent = '-';
    estDuration.textContent = '-';
    estFare.textContent = '-';
  }

  function renderRateEditor(service){
    const svc = normalizeService(service);
    const r = getPricing(svc);
    rateBase.value = Number(r.base || 0);
    rateIncluded.value = Number(r.includedMiles || 0);
    ratePerMile.value = Number(r.perMile || 0);
    rateWait.value = Number(r.waitPer15 || 0);
    const label = r.label || svc.toUpperCase();
    rateSourceLabel.textContent = `Using ${label}: base $${Number(r.base||0).toFixed(2)}, ${Number(r.includedMiles||0)} included miles, $${Number(r.perMile||0).toFixed(2)}/mile.`;
  }

  function saveCurrentServiceRate(){
    const svc = normalizeService($('service').value);
    const pricing = getAllPricing();
    const current = pricing[svc] || FALLBACK_PRICING[svc] || FALLBACK_PRICING.ambulatory;
    pricing[svc] = {
      ...current,
      base: Math.max(0, Number(rateBase.value || 0)),
      includedMiles: Math.max(0, Number(rateIncluded.value || 0)),
      perMile: Math.max(0, Number(ratePerMile.value || 0)),
      waitPer15: Math.max(0, Number(rateWait.value || 0))
    };
    saveAllPricing(pricing);
    renderRateEditor(svc);
    if(estimateState.miles > 0){
      const fare = calculateFare(svc, estimateState.miles, $('tripDate').value);
      estimateState.fare = fare;
      estFare.textContent = `$${fare.toFixed(2)}`;
    }
    setStatus('Rate updated for selected service.', 'ok');
  }

  function resetCurrentServiceRate(){
    const svc = normalizeService($('service').value);
    const stored = JSON.parse(localStorage.getItem('nexusPricing') || '{}');
    if(stored && Object.prototype.hasOwnProperty.call(stored, svc)){
      delete stored[svc];
      localStorage.setItem('nexusPricing', JSON.stringify(stored));
    }
    renderRateEditor(svc);
    if(estimateState.miles > 0){
      const fare = calculateFare(svc, estimateState.miles, $('tripDate').value);
      estimateState.fare = fare;
      estFare.textContent = `$${fare.toFixed(2)}`;
    }
    setStatus('Rate reset to default for selected service.', 'ok');
  }

  function wireGoogleAutocomplete(){
    try{
      if(!window.google?.maps?.places?.Autocomplete) return false;
      if(!pickupAutocomplete){
        pickupAutocomplete = new google.maps.places.Autocomplete($('pickup'), { types:['geocode'] });
        pickupAutocomplete.addListener('place_changed', () => {
          const place = pickupAutocomplete.getPlace();
          if(place?.formatted_address) $('pickup').value = place.formatted_address;
          resetEstimateUi();
        });
      }
      if(!destinationAutocomplete){
        destinationAutocomplete = new google.maps.places.Autocomplete($('destination'), { types:['geocode'] });
        destinationAutocomplete.addListener('place_changed', () => {
          const place = destinationAutocomplete.getPlace();
          if(place?.formatted_address) $('destination').value = place.formatted_address;
          resetEstimateUi();
        });
      }
      return true;
    }catch{
      return false;
    }
  }

  async function fetchLocationSuggestions(query){
    const q = String(query || '').trim();
    if(q.length < 2) return [];
    try{
      const r = await fetch(`/api/locations/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      if(!r.ok) return [];
      const data = await r.json();
      return (data.locations || []).map((loc) => {
        const name = String(loc.name || '').trim();
        const address = String(loc.address || '').trim();
        return address ? `${name} - ${address}` : name;
      }).filter(Boolean).slice(0, 8);
    }catch{
      return [];
    }
  }

  function bindDatalistAutocomplete(inputId, listId){
    const input = $(inputId);
    const list = $(listId);
    const update = debounce(async () => {
      const suggestions = await fetchLocationSuggestions(input.value);
      list.innerHTML = suggestions.map((value) => `<option value="${value.replace(/"/g, '&quot;')}"></option>`).join('');
    }, 220);
    input.addEventListener('input', update);
  }

  async function initAddressAutocomplete(){
    bindDatalistAutocomplete('pickup', 'pickupSuggestions');
    bindDatalistAutocomplete('destination', 'destinationSuggestions');
    if(mapsEnabled && mapsBrowserKey){
      try{
        await loadMaps();
        wireGoogleAutocomplete();
      }catch{}
    }
  }

  async function estimateRouteAndFare(){
    clearStatus();

    const pickup = $('pickup').value.trim();
    const destination = $('destination').value.trim();
    const service = normalizeService($('service').value);
    const tripDate = $('tripDate').value;

    if(!pickup || !destination){
      const fare = calculateFare(service, 0, tripDate);
      estimateState = { miles: 0, durationText: '', fare };
      estMiles.textContent = '0.0 mi';
      estDuration.textContent = '-';
      estFare.textContent = `$${fare.toFixed(2)}`;
      setStatus('Enter pickup and destination to estimate route miles.', 'err');
      return estimateState;
    }

    let miles = 0;
    let durationText = '';

    try{
      await loadMaps();
      const dirSvc = new google.maps.DirectionsService();
      const result = await new Promise((resolve, reject) => {
        dirSvc.route({
          origin: pickup,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
          unitSystem: google.maps.UnitSystem.IMPERIAL
        }, (res, status) => status === 'OK' ? resolve(res) : reject(new Error(status)));
      });
      const leg = result.routes?.[0]?.legs?.[0];
      miles = Number(leg?.distance?.value || 0) / 1609.34;
      durationText = String(leg?.duration?.text || '');
    }catch(err){
      const fallbackFare = calculateFare(service, 0, tripDate);
      estimateState = { miles: 0, durationText: '', fare: fallbackFare };
      estMiles.textContent = '0.0 mi';
      estDuration.textContent = '-';
      estFare.textContent = `$${fallbackFare.toFixed(2)}`;
      setStatus(`Route estimate unavailable (${err.message}). You can still submit booking.`, 'err');
      return estimateState;
    }

    const fare = calculateFare(service, miles, tripDate);
    estimateState = { miles, durationText, fare };

    estMiles.textContent = `${miles.toFixed(1)} mi`;
    estDuration.textContent = durationText || '-';
    estFare.textContent = `$${fare.toFixed(2)}`;
    setStatus('Route and fare estimate updated.', 'ok');
    return estimateState;
  }

  function formatPhone(raw){
    const digits = String(raw || '').replace(/\D/g, '');
    if(digits.length !== 10) return raw;
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }

  function selectService(service){
    const clean = normalizeService(service);
    $('service').value = clean;
    serviceChips.querySelectorAll('.chip').forEach((chip) => {
      const active = chip.dataset.service === clean;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
    if(estimateState.miles > 0){
      const fare = calculateFare(clean, estimateState.miles, $('tripDate').value);
      estimateState.fare = fare;
      estFare.textContent = `$${fare.toFixed(2)}`;
    }
    renderRateEditor(clean);
  }

  function bindServiceChips(){
    serviceChips.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => selectService(chip.dataset.service));
    });
  }

  function telemetryIcon(){
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#0a6b99',
      fillOpacity: 0.9,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 7
    };
  }

  async function loadTelemetry(){
    try{
      const r = await fetch('/api/fleet/live', { cache: 'no-store' });
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const vehicles = (data.vehicles || []).filter(v => Number.isFinite(v.lat) && Number.isFinite(v.lng));

      telemetryStatus.textContent = `Live: ${vehicles.length} vehicles • updated ${new Date(data.generatedAt || Date.now()).toLocaleTimeString()}`;
      telemetryList.innerHTML = vehicles.slice(0, 20).map(v => (
        `<div class="telemetryItem"><div><b>${v.unit || v.id}</b><div>${String(v.status || '').replaceAll('_',' ')}</div></div><div>${Number(v.speed||0).toFixed(0)} mph</div></div>`
      )).join('') || '<div class="telemetryItem"><div>No active vehicle telemetry</div></div>';

      if(!telemetryMap) return;
      const activeIds = new Set();
      vehicles.forEach(v => {
        const id = String(v.id || v.unit);
        activeIds.add(id);
        let marker = telemetryMarkers.get(id);
        const position = { lat: Number(v.lat), lng: Number(v.lng) };
        if(!marker){
          marker = new google.maps.Marker({
            map: telemetryMap,
            position,
            title: `${v.unit || v.id} (${v.status || 'ACTIVE'})`,
            icon: telemetryIcon()
          });
          telemetryMarkers.set(id, marker);
        }else{
          marker.setPosition(position);
          marker.setTitle(`${v.unit || v.id} (${v.status || 'ACTIVE'})`);
        }
      });

      telemetryMarkers.forEach((marker, id) => {
        if(!activeIds.has(id)){
          marker.setMap(null);
          telemetryMarkers.delete(id);
        }
      });

      if(vehicles.length){
        const bounds = new google.maps.LatLngBounds();
        vehicles.slice(0, 25).forEach(v => bounds.extend({ lat:Number(v.lat), lng:Number(v.lng) }));
        telemetryMap.fitBounds(bounds, 48);
      }
    }catch(err){
      telemetryStatus.textContent = `Telemetry unavailable: ${err.message}`;
    }
  }

  async function initTelemetry(){
    if(!(mapsEnabled && mapsBrowserKey)){
      telemetryStatus.textContent = 'Live map requires Google Maps configuration.';
      return;
    }
    try{
      await loadMaps();
      telemetryMap = new google.maps.Map(telemetryMapEl, {
        center: { lat: 39.0458, lng: -76.6413 },
        zoom: 9,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
      await loadTelemetry();
      telemetryTimer = setInterval(loadTelemetry, 20000);
    }catch(err){
      telemetryStatus.textContent = `Live map failed to load: ${err.message}`;
    }
  }

  async function submitBooking(event){
    event.preventDefault();
    clearStatus();

    const payload = {
      name: $('name').value.trim(),
      phone: formatPhone($('phone').value.trim()),
      email: $('email').value.trim(),
      service: normalizeService($('service').value),
      pickup: $('pickup').value.trim(),
      destination: $('destination').value.trim(),
      date: $('tripDate').value,
      time: $('tripTime').value,
      notes: $('notes').value.trim(),
      distanceMiles: Number(estimateState.miles || 0),
      estimatedDuration: estimateState.durationText || null,
      estimatedFare: Number(estimateState.fare || 0)
    };

    if(!payload.name || !payload.phone || !payload.service || !payload.pickup || !payload.destination || !payload.date || !payload.time){
      setStatus('Please complete all required fields.', 'err');
      return;
    }

    setBusy(submitBtn, true, 'Booking...', 'Book Ride');

    try{
      if(!estimateState.miles){
        await estimateRouteAndFare();
        payload.distanceMiles = Number(estimateState.miles || 0);
        payload.estimatedDuration = estimateState.durationText || null;
        payload.estimatedFare = Number(estimateState.fare || 0);
      }

      const r = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      if(!r.ok) throw new Error(data.error || 'Booking request failed');

      const ref = data.booking?.reference || data.booking?.id || 'N/A';
      setStatus(`Booking created. Reference: ${ref}`, 'ok');
      form.reset();
      resetEstimateUi();
      selectService('ambulatory');
    }catch(err){
      setStatus(err.message, 'err');
    }finally{
      setBusy(submitBtn, false, 'Booking...', 'Book Ride');
    }
  }

  async function init(){
    const now = new Date();
    const hh = String(Math.max(8, now.getHours())).padStart(2, '0');
    const mm = now.getMinutes() < 30 ? '30' : '45';
    $('tripDate').value = now.toISOString().slice(0,10);
    $('tripTime').value = `${hh}:${mm}`;

    await loadIntegrationConfig();
    await initAddressAutocomplete();

    bindServiceChips();
    selectService($('service').value);
    renderRateEditor($('service').value);
    saveRateBtn.addEventListener('click', saveCurrentServiceRate);
    resetRateBtn.addEventListener('click', resetCurrentServiceRate);
    initTelemetry();

    estimateBtn.addEventListener('click', async() => {
      setBusy(estimateBtn, true, 'Estimating...', 'Estimate Fare');
      try{ await estimateRouteAndFare(); }
      finally{ setBusy(estimateBtn, false, 'Estimating...', 'Estimate Fare'); }
    });
    form.addEventListener('submit', submitBooking);

    ['tripDate','pickup','destination'].forEach((id) => {
      $(id).addEventListener('change', () => {
        if(id === 'tripDate' && estimateState.miles > 0){
          const fare = calculateFare(normalizeService($('service').value), estimateState.miles, $('tripDate').value);
          estimateState.fare = fare;
          estFare.textContent = `$${fare.toFixed(2)}`;
          return;
        }
        resetEstimateUi();
      });
    });

    window.addEventListener('beforeunload', () => {
      if(telemetryTimer) clearInterval(telemetryTimer);
    });
  }

  init();
})();