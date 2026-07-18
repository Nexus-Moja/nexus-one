const TRIPS_KEY='nexusTrips';
export function getTrips(){try{return JSON.parse(localStorage.getItem(TRIPS_KEY)||'[]')}catch{return []}}
export function createTrip(input){
 const trips=getTrips();
 const trip={id:input.reference,reference:input.reference,status:'requested',statusLabel:'Requested',billingStatus:'quote-created',createdAt:new Date().toISOString(),...input};
 localStorage.setItem(TRIPS_KEY,JSON.stringify([trip,...trips]));
 window.dispatchEvent(new CustomEvent('nexus:trip-created',{detail:trip}));
 return trip;
}
