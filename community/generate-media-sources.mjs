// Rebuild only this transport allowlist; never modify catalog or programming.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import {canonicalMediaURL} from './media-bridge.mjs';
export function mediaSources(catalog){
  const records=new Map();
  function add(archiveId,file){if(typeof file!=='string'||/^(?:\.?\/)?assets\//.test(file))return;const record={archiveId,file},url=canonicalMediaURL(record);if(url)records.set(createHash('sha256').update(url).digest('hex'),record);}
  function walk(value){
    if(Array.isArray(value)){
      if(typeof value[0]==='string'&&typeof value[1]==='string'&&typeof value[2]==='number'&&value[2]>0)add(value[6]||value[0],value[1]);
      else for(const item of value)walk(item);
    }else if(value&&typeof value==='object'){
      if(!value.local&&typeof value.file==='string'&&typeof(value.archiveId||value.id)==='string')add(value.archiveId||value.id,value.file);
      for(const item of Object.values(value))if(item&&typeof item==='object')walk(item);
    }
  }
  walk(catalog);return Object.fromEntries([...records].sort(([a],[b])=>a.localeCompare(b)));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2);let catalogPath=new URL('../catalog.json',import.meta.url),outputDir;
  while(args.length){const key=args.shift(),value=args.shift();if(!value||!['--catalog','--output-dir'].includes(key))throw Error('Usage: generate-media-sources.mjs [--catalog path] [--output-dir path]');if(key==='--catalog')catalogPath=resolve(value);else outputDir=resolve(value);}
  const catalog=JSON.parse(await readFile(catalogPath,'utf8')),sources=mediaSources(catalog);
  if(outputDir){
    await mkdir(outputDir,{recursive:true});const shards=Array.from({length:256},()=>({}));for(const [key,record]of Object.entries(sources))shards[parseInt(key.slice(0,2),16)][key]=record;
    await Promise.all(shards.map((shard,i)=>writeFile(join(outputDir,i.toString(16).padStart(2,'0')+'.json'),JSON.stringify(shard)+'\n')));
    console.log(`Published 256 shards authorizing ${Object.keys(sources).length} exact public media files.`);
  }else{await writeFile(new URL('./media-sources.json',import.meta.url),JSON.stringify(sources)+'\n');console.log(`Allowlisted ${Object.keys(sources).length} exact public media files.`);}
}
