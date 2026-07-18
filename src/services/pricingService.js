export const DEFAULT_PRICING = {
  wheelchair: { label: 'Wheelchair Transportation', base: 95, includedMiles: 10, perMile: 4.25, waitPer15: 25 },
  ambulatory: { label: 'Ambulatory Transportation', base: 65, includedMiles: 5, perMile: 3.25, waitPer15: 20 },
  broda: { label: 'Broda Chair Transportation', base: 145, includedMiles: 10, perMile: 5.25, waitPer15: 25 },
  stretcher: { label: 'Stretcher Transportation', base: 260, includedMiles: 10, perMile: 7.50, waitPer15: 35 },
  bariatric: { label: 'Bariatric Transportation', base: 385, includedMiles: 10, perMile: 9.50, waitPer15: 45 },
  bls: { label: 'BLS Ambulance', base: 725, includedMiles: 0, perMile: 17.50, waitPer15: 55 },
  als1: { label: 'ALS I Ambulance', base: 925, includedMiles: 0, perMile: 20, waitPer15: 65 },
  als2: { label: 'ALS II Ambulance', base: 1350, includedMiles: 0, perMile: 23, waitPer15: 75 }
};

export const SERVICE_ALIASES = {
  'Wheelchair Transportation':'wheelchair','Ambulatory Transportation':'ambulatory',
  'Broda Chair Transportation':'broda','Stretcher & Bariatric':'stretcher',
  'Stretcher Transportation':'stretcher','Bariatric Transportation':'bariatric',
  'Ambulance Services':'bls','BLS Ambulance':'bls','ALS I Ambulance':'als1','ALS II Ambulance':'als2',
  'Dialysis & Recurring Trips':'ambulatory','Hospital Discharge':'wheelchair','Medical Shuttle':'ambulatory'
};

export function loadPricing(){
  try { return {...DEFAULT_PRICING, ...JSON.parse(localStorage.getItem('nexusPricing')||'{}')}; }
  catch { return DEFAULT_PRICING; }
}
export function serviceKey(value=''){ return SERVICE_ALIASES[value] || value || 'wheelchair'; }
export function calculateQuote({service='wheelchair',miles=0,waitMinutes=0,roundTrip=false,afterHours=false,weekend=false,pricing=loadPricing()}){
  const key=serviceKey(service), rate=pricing[key]||pricing.wheelchair;
  const safeMiles=Math.max(0,Number(miles)||0), safeWait=Math.max(0,Number(waitMinutes)||0);
  const multiplier=roundTrip?2:1;
  const base=rate.base*multiplier;
  const billableMiles=Math.max(0,safeMiles-rate.includedMiles)*multiplier;
  const mileage=billableMiles*rate.perMile;
  const waitBlocks=Math.max(0,Math.ceil((safeWait-15)/15));
  const wait=waitBlocks*rate.waitPer15;
  const subtotal=base+mileage+wait;
  const afterHoursFee=afterHours?subtotal*.15:0;
  const weekendFee=weekend?subtotal*.10:0;
  const total=subtotal+afterHoursFee+weekendFee;
  return {service:key,label:rate.label,total:+total.toFixed(2),breakdown:{base:+base.toFixed(2),mileage:+mileage.toFixed(2),wait:+wait.toFixed(2),afterHours:+afterHoursFee.toFixed(2),weekend:+weekendFee.toFixed(2)},assumptions:{miles:safeMiles,waitMinutes:safeWait,roundTrip}};
}
