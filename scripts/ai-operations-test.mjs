import fs from 'node:fs';
const files=['public/nexus-ai.js','public/ai-operations.html','public/dispatch.html'];
for(const f of files){if(!fs.existsSync(new URL('../'+f,import.meta.url)))throw new Error('Missing '+f)}
const source=fs.readFileSync(new URL('../public/nexus-ai.js',import.meta.url),'utf8');
for(const token of ['riskScore','forecast','assignment','anomalies','recommendations'])if(!source.includes(token))throw new Error('Missing AI function '+token);
console.log('AI Operations smoke test passed');
