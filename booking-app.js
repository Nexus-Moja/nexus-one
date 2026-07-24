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

  const FALLBACK_PRICING = {
    ambulatory:{base:65,includedMiles:5,perMile:3.25},
    wheelchair:{base:95,includedMiles:5,perMile:4.75},
    stretcher:{base:180,includedMiles:5,perMile:7.25},
    broda:{base:140,includedMiles:5,perMile:6.25},
    bariatric:{base:220,includedMiles:5,perMile:8.5},
    bls:{base:260,includedMiles:5,perMile:9.5},
    als1:{base:340,includedMiles:5,perMile:11},
    als2:{base:420,includedMiles:5,perMile:12.5}
  };

  let mapsReadyPromise = null;
  let mapsEnabled = false;
  let mapsBrowserKey = '';
  let estimateState = { miles: 0, durationText: '', fare: 0 };

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

  function normalizeService(value){
    return String(value || 'ambulatory').trim().toLowerCase();
  }

  function getPricing(service){
    const svc = normalizeService(service);
    const fromCore = window.NexusCore?.getPricing?.() || {};
    return fromCore[svc] || window.NexusCore?.DEFAULT?.[svc] || FALLBACK_PRICING[svc] || FALLBACK_PRICING.ambulatory;
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
  }

  function bindServiceChips(){
    serviceChips.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => selectService(chip.dataset.service));
    });
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
      estMiles.textContent = '-';
      estDuration.textContent = '-';
      estFare.textContent = '-';
      estimateState = { miles: 0, durationText: '', fare: 0 };
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

    bindServiceChips();
    selectService($('service').value);

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
        estimateState = { miles: 0, durationText: '', fare: 0 };
        estMiles.textContent = '-';
        estDuration.textContent = '-';
        estFare.textContent = '-';
      });
    });
  }

  init();
})();