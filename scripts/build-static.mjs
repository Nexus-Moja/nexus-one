import {cp,mkdir,rm,readdir} from 'node:fs/promises';import path from 'node:path';
const root=process.cwd(),dist=path.join(root,'dist');await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
const publicDirectories=new Set(['assets']);
const publicExtensions=new Set(['.css','.html','.ico','.jpeg','.jpg','.js','.png','.svg','.webp','.woff','.woff2']);
for(const item of await readdir(root,{withFileTypes:true})){
  const source=path.join(root,item.name),destination=path.join(dist,item.name);
  if(item.isDirectory()&&publicDirectories.has(item.name)){await cp(source,destination,{recursive:true});continue}
  if(item.isFile()&&!item.name.startsWith('.')&&publicExtensions.has(path.extname(item.name).toLowerCase()))await cp(source,destination);
}
console.log('Static application copied to dist.');
