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
  const rateSettingsSection = $('rateSettingsSection');
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
    facility_transfer:{label:'Facility-to-Facility Transfer',base:180,includedMiles:8,perMile:5.5,waitPer15:35},
    broda:{label:'Broda Chair Transportation',base:145,includedMiles:10,perMile:5.25,waitPer15:25},
    stretcher:{label:'Stretcher Transportation',base:260,includedMiles:10,perMile:7.5,waitPer15:35},
    bariatric:{label:'Bariatric Transportation',base:385,includedMiles:10,perMile:9.5,waitPer15:45},
    bls:{label:'BLS Ambulance',base:725,includedMiles:0,perMile:17.5,waitPer15:55},
    als1:{label:'ALS I Ambulance',base:925,includedMiles:0,perMile:20,waitPer15:65},
    als2:{label:'ALS II Ambulance',base:1350,includedMiles:0,perMile:23,waitPer15:75}
  };

  const DEFAULT_FARE_RULES = {
    minimumFare: 0,
    fuelSurchargePerMile: 0,
    fuelPricingMode: 'MANUAL',
    fuelIndexPricePerGallon: 0,
    fuelBaselinePricePerGallon: 3.25,
    fuelEfficiencyMpg: 10,
    fuelOperationalBufferPct: 20,
    fuelLastUpdatedAt: null,
    afterHoursSurchargePct: 0,
    weekendSurchargePct: 0,
    holidaySurchargePct: 10,
    cancellationFee: 30,
    cancellationWindowHours: 24,
    cancellationLeadHours: 72,
    noShowFee: 50,
    freeWaitMinutes: 15,
    mileageRoundingRule: 'TENTH_MILE',
    telemetryRefreshSeconds: 20,
    maxBookingDistanceMiles: 125,
    returnMilesThreshold: 10,
    returnMilesInclusionPct: 100,
    trafficOverageFeePerHour: 0,
    trafficOverageGraceMinutes: 0,
    servicePolicies: {
      wheelchair:{cancellationFee:40,noShowFee:60,trafficOverageFeePerHour:25,returnMilesInclusionPct:100,afterHoursSurchargePct:0,weekendSurchargePct:0,holidaySurchargePct:10},
      ambulatory:{cancellationFee:35,noShowFee:50,trafficOverageFeePerHour:20,returnMilesInclusionPct:100,afterHoursSurchargePct:0,weekendSurchargePct:0,holidaySurchargePct:10},
      facility_transfer:{cancellationFee:90,noShowFee:120,trafficOverageFeePerHour:45,returnMilesInclusionPct:100,afterHoursSurchargePct:5,weekendSurchargePct:3,holidaySurchargePct:12},
      broda:{cancellationFee:75,noShowFee:95,trafficOverageFeePerHour:35,returnMilesInclusionPct:100,afterHoursSurchargePct:0,weekendSurchargePct:0,holidaySurchargePct:10},
      stretcher:{cancellationFee:120,noShowFee:150,trafficOverageFeePerHour:50,returnMilesInclusionPct:100,afterHoursSurchargePct:0,weekendSurchargePct:0,holidaySurchargePct:10},
      bariatric:{cancellationFee:160,noShowFee:200,trafficOverageFeePerHour:65,returnMilesInclusionPct:100,afterHoursSurchargePct:0,weekendSurchargePct:0,holidaySurchargePct:10},
      bls:{cancellationFee:200,noShowFee:260,trafficOverageFeePerHour:85,returnMilesInclusionPct:100,afterHoursSurchargePct:0,weekendSurchargePct:0,holidaySurchargePct:10},
      als1:{cancellationFee:250,noShowFee:325,trafficOverageFeePerHour:95,returnMilesInclusionPct:100,afterHoursSurchargePct:0,weekendSurchargePct:0,holidaySurchargePct:10},
      als2:{cancellationFee:300,noShowFee:390,trafficOverageFeePerHour:110,returnMilesInclusionPct:100,afterHoursSurchargePct:0,weekendSurchargePct:0,holidaySurchargePct:10}
    }
  };

  let mapsReadyPromise = null;
  let mapsEnabled = false;
  let mapsBrowserKey = '';
  let estimateState = { miles: 0, durationText: '', durationMinutes: 0, trafficDurationMinutes: 0, fare: 0 };
  let pickupAutocomplete = null;
  let destinationAutocomplete = null;
  let telemetryMap = null;
  let telemetryMarkers = new Map();
  let telemetryTimer = null;
  let isAdminUser = false;
  let platformPricing = null;
  let fareRules = { ...DEFAULT_FARE_RULES };

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
    const raw = String(value || 'ambulatory').trim().toLowerCase();
    if(raw === 'ift' || raw === 'interfacility') return 'facility_transfer';
    if(raw.includes('facility') && raw.includes('transfer')) return 'facility_transfer';
    return raw;
  }

  function getPricing(service){
    const svc = normalizeService(service);
    const fromCore = platformPricing || window.NexusCore?.getPricing?.() || FALLBACK_PRICING;
    return fromCore[svc] || FALLBACK_PRICING[svc] || FALLBACK_PRICING.ambulatory;
  }

  function getAllPricing(){
    return platformPricing || window.NexusCore?.getPricing?.() || FALLBACK_PRICING;
  }

  function getServicePolicy(service){
    const key = normalizeService(service);
    const policies = fareRules?.servicePolicies || {};
    return policies[key] || {};
  }

  function getNthWeekdayOfMonth(year, monthIndex, weekday, nth){
    const first = new Date(year, monthIndex, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return new Date(year, monthIndex, 1 + offset + ((nth - 1) * 7));
  }

  function getLastWeekdayOfMonth(year, monthIndex, weekday){
    const last = new Date(year, monthIndex + 1, 0);
    const offset = (last.getDay() - weekday + 7) % 7;
    return new Date(year, monthIndex, last.getDate() - offset);
  }

  function sameCalendarDate(a, b){
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function isFederalHoliday(dateInput){
    const d = new Date(dateInput || new Date());
    d.setHours(12, 0, 0, 0);
    const y = d.getFullYear();
    const holidays = [
      new Date(y, 0, 1),
      getNthWeekdayOfMonth(y, 0, 1, 3),
      getNthWeekdayOfMonth(y, 1, 1, 3),
      getLastWeekdayOfMonth(y, 4, 1),
      new Date(y, 5, 19),
      new Date(y, 6, 4),
      getNthWeekdayOfMonth(y, 8, 1, 1),
      getNthWeekdayOfMonth(y, 9, 1, 2),
      new Date(y, 10, 11),
      getNthWeekdayOfMonth(y, 10, 4, 4),
      new Date(y, 11, 25)
    ];
    return holidays.some((h) => sameCalendarDate(h, d));
  }

  function isAfterHoursTime(timeStr){
    const parts = String(timeStr || '00:00').split(':');
    const hour = Number(parts[0]);
    const minute = Number(parts[1] || 0);
    if(!Number.isFinite(hour) || !Number.isFinite(minute)) return true;
    const totalMinutes = (hour * 60) + minute;
    return totalMinutes < (7 * 60) || totalMinutes > (19 * 60);
  }

  function calculateFare(service, miles, dateStr, timeStr, routeMetrics = {}){
    const rate = getPricing(service);
    const policy = getServicePolicy(service);
    const distance = Math.max(0, Number(miles) || 0);
    const includedMiles = Number(rate.includedMiles || 0);
    const outboundBillable = Math.max(0, distance - includedMiles);
    const returnThreshold = Math.max(0, Number(fareRules.returnMilesThreshold || 0));
    const returnPct = Math.max(0, Number((policy.returnMilesInclusionPct ?? fareRules.returnMilesInclusionPct) ?? 0)) / 100;
    const returnMiles = distance > returnThreshold ? (distance * returnPct) : 0;
    const totalChargedMiles = distance + returnMiles;
    const billable = outboundBillable + returnMiles;

    let subtotal = Number(rate.base || 0) + billable * Number(rate.perMile || 0);
    subtotal += totalChargedMiles * Number(fareRules.fuelSurchargePerMile || 0);

    const scheduledMinutes = Math.max(0, Number(routeMetrics.durationMinutes || 0));
    const trafficMinutes = Math.max(0, Number(routeMetrics.trafficDurationMinutes || 0));
    const graceMinutes = Math.max(0, Number(fareRules.trafficOverageGraceMinutes || 0));
    const overageMinutes = Math.max(0, trafficMinutes - scheduledMinutes - graceMinutes);
    if(overageMinutes > 0){
      const trafficRate = Math.max(0, Number((policy.trafficOverageFeePerHour ?? fareRules.trafficOverageFeePerHour) ?? 0));
      subtotal += (overageMinutes / 60) * trafficRate;
    }

    const tripDate = new Date(dateStr || new Date());
    const day = tripDate.getDay();
    const isWeekend = day === 0 || day === 6;
    const isHoliday = isFederalHoliday(tripDate);
    const isAfterHours = isAfterHoursTime(timeStr);

    if(isHoliday) subtotal += subtotal * (Number((policy.holidaySurchargePct ?? fareRules.holidaySurchargePct) ?? 0) / 100);
    if(isWeekend) subtotal += subtotal * (Number((policy.weekendSurchargePct ?? fareRules.weekendSurchargePct) ?? 0) / 100);
    if(isAfterHours) subtotal += subtotal * (Number((policy.afterHoursSurchargePct ?? fareRules.afterHoursSurchargePct) ?? 0) / 100);

    return Math.max(Number(fareRules.minimumFare || 0), subtotal);
  }

  async function loadPlatformSettings(){
    try{
      const r = await fetch('/api/settings/public', { cache: 'no-store' });
      if(!r.ok) return;
      const data = await r.json();
      if(data?.pricing && typeof data.pricing === 'object'){
        platformPricing = data.pricing;
      }
      if(data?.fareRules && typeof data.fareRules === 'object'){
        fareRules = { ...DEFAULT_FARE_RULES, ...data.fareRules };
      }
    }catch{}
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
    estimateState = { miles: 0, durationText: '', durationMinutes: 0, trafficDurationMinutes: 0, fare: 0 };
    estMiles.textContent = '-';
    estDuration.textContent = '-';
    estFare.textContent = '-';
  }

  function renderRateEditor(service){
    if(!isAdminUser){
      rateBase.value = '';
      rateIncluded.value = '';
      ratePerMile.value = '';
      rateWait.value = '';
      rateSourceLabel.textContent = 'Fare estimate is calculated automatically.';
      return;
    }
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
    if(!isAdminUser){
      setStatus('Only Admin users can update service rates.', 'err');
      return;
    }
    const svc = normalizeService($('service').value);
    const pricing = { ...getAllPricing() };
    const current = pricing[svc] || FALLBACK_PRICING[svc] || FALLBACK_PRICING.ambulatory;
    pricing[svc] = {
      ...current,
      base: Math.max(0, Number(rateBase.value || 0)),
      includedMiles: Math.max(0, Number(rateIncluded.value || 0)),
      perMile: Math.max(0, Number(ratePerMile.value || 0)),
      waitPer15: Math.max(0, Number(rateWait.value || 0))
    };
    const token = sessionStorage.getItem('nexusAccessToken');
    fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token || ''}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ pricing })
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if(!r.ok) throw new Error(data.error || 'Failed to save pricing');
      platformPricing = data.settings?.pricing || pricing;
      renderRateEditor(svc);
      if(estimateState.miles > 0){
        const fare = calculateFare(svc, estimateState.miles, $('tripDate').value, $('tripTime').value);
        estimateState.fare = fare;
        estFare.textContent = `$${fare.toFixed(2)}`;
      }
      setStatus('Rate updated for selected service.', 'ok');
    }).catch((err) => {
      setStatus(err.message, 'err');
    });
  }

  function resetCurrentServiceRate(){
    if(!isAdminUser){
      setStatus('Only Admin users can reset service rates.', 'err');
      return;
    }
    const svc = normalizeService($('service').value);
    const pricing = { ...getAllPricing(), [svc]: { ...FALLBACK_PRICING[svc] } };
    const token = sessionStorage.getItem('nexusAccessToken');
    fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token || ''}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ pricing })
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if(!r.ok) throw new Error(data.error || 'Failed to reset pricing');
      platformPricing = data.settings?.pricing || pricing;
      renderRateEditor(svc);
      if(estimateState.miles > 0){
        const fare = calculateFare(svc, estimateState.miles, $('tripDate').value, $('tripTime').value);
        estimateState.fare = fare;
        estFare.textContent = `$${fare.toFixed(2)}`;
      }
      setStatus('Rate reset to default for selected service.', 'ok');
    }).catch((err) => {
      setStatus(err.message, 'err');
    });
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
      const fare = calculateFare(service, 0, tripDate, $('tripTime').value, { durationMinutes: 0, trafficDurationMinutes: 0 });
      estimateState = { miles: 0, durationText: '', durationMinutes: 0, trafficDurationMinutes: 0, fare };
      estMiles.textContent = '0.0 mi';
      estDuration.textContent = '-';
      estFare.textContent = `$${fare.toFixed(2)}`;
      setStatus('Enter pickup and destination to estimate route miles.', 'err');
      return estimateState;
    }

    let miles = 0;
    let durationText = '';
    let durationMinutes = 0;
    let trafficDurationMinutes = 0;

    try{
      await loadMaps();
      const dirSvc = new google.maps.DirectionsService();
      const result = await new Promise((resolve, reject) => {
        dirSvc.route({
          origin: pickup,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: google.maps.TrafficModel.BEST_GUESS
          },
          unitSystem: google.maps.UnitSystem.IMPERIAL
        }, (res, status) => status === 'OK' ? resolve(res) : reject(new Error(status)));
      });
      const leg = result.routes?.[0]?.legs?.[0];
      miles = Number(leg?.distance?.value || 0) / 1609.34;
      durationText = String(leg?.duration?.text || '');
      durationMinutes = Number(leg?.duration?.value || 0) / 60;
      trafficDurationMinutes = Number(leg?.duration_in_traffic?.value || leg?.duration?.value || 0) / 60;
      if(trafficDurationMinutes > durationMinutes){
        const trafficText = String(leg?.duration_in_traffic?.text || '');
        if(trafficText) durationText = `${durationText} (traffic ${trafficText})`;
      }
    }catch(err){
      const fallbackFare = calculateFare(service, 0, tripDate, $('tripTime').value, { durationMinutes: 0, trafficDurationMinutes: 0 });
      estimateState = { miles: 0, durationText: '', durationMinutes: 0, trafficDurationMinutes: 0, fare: fallbackFare };
      estMiles.textContent = '0.0 mi';
      estDuration.textContent = '-';
      estFare.textContent = `$${fallbackFare.toFixed(2)}`;
      setStatus(`Route estimate unavailable (${err.message}). You can still submit booking.`, 'err');
      return estimateState;
    }

    const fare = calculateFare(service, miles, tripDate, $('tripTime').value, { durationMinutes, trafficDurationMinutes });
    estimateState = { miles, durationText, durationMinutes, trafficDurationMinutes, fare };

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
      const fare = calculateFare(clean, estimateState.miles, $('tripDate').value, $('tripTime').value, { durationMinutes: estimateState.durationMinutes, trafficDurationMinutes: estimateState.trafficDurationMinutes });
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
      telemetryTimer = setInterval(loadTelemetry, Math.max(5000, Number(fareRules.telemetryRefreshSeconds || 20) * 1000));
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

  async function resolveAdminAccess(){
    const token = sessionStorage.getItem('nexusAccessToken');
    if(!token){
      isAdminUser = false;
      return;
    }
    try{
      const r = await fetch('/api/auth/me', {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if(!r.ok){
        isAdminUser = false;
        return;
      }
      const data = await r.json();
      isAdminUser = String(data?.user?.role || '').toUpperCase() === 'ADMIN';
    }catch{
      isAdminUser = false;
    }
  }

  function applyRateVisibility(){
    if(rateSettingsSection){
      rateSettingsSection.hidden = !isAdminUser;
    }
    if(!isAdminUser){
      rateSourceLabel.textContent = 'Fare estimate is calculated automatically.';
    }
  }

  async function init(){
    const now = new Date();
    const hh = String(Math.max(8, now.getHours())).padStart(2, '0');
    const mm = now.getMinutes() < 30 ? '30' : '45';
    $('tripDate').value = now.toISOString().slice(0,10);
    $('tripTime').value = `${hh}:${mm}`;

    await loadIntegrationConfig();
    await loadPlatformSettings();
    await initAddressAutocomplete();
    await resolveAdminAccess();
    applyRateVisibility();

    bindServiceChips();
    selectService($('service').value);
    if(isAdminUser){
      renderRateEditor($('service').value);
      saveRateBtn.addEventListener('click', saveCurrentServiceRate);
      resetRateBtn.addEventListener('click', resetCurrentServiceRate);
    }
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
          const fare = calculateFare(normalizeService($('service').value), estimateState.miles, $('tripDate').value, $('tripTime').value, { durationMinutes: estimateState.durationMinutes, trafficDurationMinutes: estimateState.trafficDurationMinutes });
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