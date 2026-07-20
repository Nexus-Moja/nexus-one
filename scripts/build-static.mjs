import {cp,mkdir,rm,readdir} from 'node:fs/promises';import path from 'node:path';
const root=process.cwd(),dist=path.join(root,'dist');await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
const excluded=new Set(['dist','node_modules','netlify','database','scripts','docs','.git']);
for(const item of await readdir(root,{withFileTypes:true})){if(excluded.has(item.name)||item.name==='package.json'||item.name==='package-lock.json')continue;await cp(path.join(root,item.name),path.join(dist,item.name),{recursive:true})}
console.log('Static application copied to dist.');
