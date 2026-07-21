import {cp,mkdir,rm,readdir} from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';
const root=process.cwd(),dist=path.join(root,'dist');await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
const excluded=new Set(['dist','node_modules','netlify','database','scripts','docs','.git']);
for(const item of await readdir(root,{withFileTypes:true})){if(excluded.has(item.name)||item.name==='package.json'||item.name==='package-lock.json')continue;await cp(path.join(root,item.name),path.join(dist,item.name),{recursive:true})}
console.log('Static application copied to dist.');
// Patch Google Maps API key configuration
try{await new Promise((resolve,reject)=>{const proc=spawn('node',['scripts/patch-google-maps.mjs'],{cwd:root,stdio:'inherit'});proc.on('exit',code=>code===0?resolve():reject(new Error(`Patch script exited with code ${code}`)))});}catch(e){console.warn('Note: Google Maps patching incomplete -',e.message);}
