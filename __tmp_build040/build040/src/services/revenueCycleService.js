const CLAIMS_KEY = 'nexusClaims';
const PAYMENTS_KEY = 'nexusPayments';

const read = key => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

export function payerCategory(value = 'Self-pay') {
  const payer = String(value).toLowerCase();
  if (payer.includes('medicaid')) return 'Medicaid';
  if (payer.includes('medicare')) return 'Medicare';
  if (payer.includes('worker')) return 'Workers Compensation';
  if (payer.includes('facility')) return 'Facility Account';
  if (payer.includes('insurance')) return 'Commercial Insurance';
  return 'Self-pay';
}

export function synchronizeClaims(trips = []) {
  const claims = read(CLAIMS_KEY);
  const tripIds = new Set(claims.map(claim => claim.tripId));
  for (const trip of trips) {
    const tripId = trip.reference || trip.id;
    if (!tripId || tripIds.has(tripId)) continue;
    const payer = payerCategory(trip.payer);
    const amount = Number(trip.quote?.total) || 0;
    claims.unshift({
      id: `CLM-${String(tripId).replace(/[^A-Za-z0-9]/g, '').slice(-10)}`,
      tripId,
      patient: trip.patientName || trip.name || 'Patient',
      payer,
      type: payer === 'Self-pay' ? 'Invoice' : payer === 'Facility Account' ? 'Facility Invoice' : 'CMS-1500 Draft',
      amount, paid: 0, balance: amount,
      status: payer === 'Self-pay' ? 'Ready to invoice' : 'Draft',
      serviceDate: trip.date || trip.pickupDate || '',
      service: trip.service || 'Transportation',
      createdAt: new Date().toISOString()
    });
  }
  write(CLAIMS_KEY, claims);
  return claims;
}

export const getClaims = () => read(CLAIMS_KEY);
export const getPayments = () => read(PAYMENTS_KEY);
