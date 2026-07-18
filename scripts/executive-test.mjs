import fs from 'node:fs';
const html=fs.readFileSync(new URL('../public/executive.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../public/nexus-executive.js',import.meta.url),'utf8');
const checks=[['command center',html.includes('Executive Command Center')],['KPI IDs',html.includes('kpiRevenue')&&html.includes('kpiOnTime')],['CRM',html.includes('crmForm')&&js.includes('nexusCRMAccounts')],['reports',html.includes('data-report')&&js.includes('text/csv')],['shared trips',js.includes('nexusTrips')]];
const failed=checks.filter(([,ok])=>!ok);checks.forEach(([n,ok])=>console.log(`${ok?'PASS':'FAIL'} ${n}`));if(failed.length)process.exit(1);
