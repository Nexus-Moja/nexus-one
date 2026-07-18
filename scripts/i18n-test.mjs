import fs from 'node:fs';
const js=fs.readFileSync(new URL('../public/i18n.js', import.meta.url),'utf8');
for(const locale of ['en-US','en-GB','fr','es']) if(!js.includes(`'${locale}'`)&&!js.includes(` ${locale}:`)) throw new Error(`Missing ${locale}`);
for(const phrase of ['Book a Ride','Réserver un trajet','Reservar un viaje','English (UK)']) if(!js.includes(phrase)) throw new Error(`Missing translation: ${phrase}`);
const pages=['index.html','public/patient.html','public/facility.html','public/dispatch.html','public/fleet.html','public/driver.html','public/executive.html','public/qa.html','public/billing.html','public/admin.html','public/livecare.html'];
for(const page of pages){const html=fs.readFileSync(new URL('../'+page,import.meta.url),'utf8');if(!html.includes('i18n.js'))throw new Error(`i18n not loaded: ${page}`)}
console.log('Multilingual integration checks passed for 4 locales and core modules.');
