// Preserve the published lineup for at least two hours, then begin the new cycle.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {siteCode,scheduleCode} from './tv-feed.mjs';

export const fingerprint = ({html,catalog,commercialTiming,mediaCompatibility}) => createHash('sha256').update(JSON.stringify({code:scheduleCode(html),commercialTiming,mediaCompatibility,pools:catalog.pools,commercials:catalog.commercials,bumpers:catalog.bumpers,breakLibraries:catalog.breakLibraries,channelBumpers:catalog.channelBumpers,channelAds:catalog.channelAds})).digest('hex');

export async function stageProgramming({previous,next,now=Date.now()/1000,leadSeconds=2*3600+15*60}) {
  const signature=fingerprint(next);
  if(previous.catalog.programming?.fingerprint===signature) return previous.catalog.programming;
  const old=siteCode(previous),target=siteCode(next),channels={};
  const notBefore=now+leadSeconds;
  for(const ch of target.BUILT_IN){
    const source=old.BUILT_IN.find(c=>c.no===ch.no);
    // New stations can begin immediately; existing stations must never silently lose protection.
    if(!source)continue;
    const items=[];let cursor=now;
    while(cursor<notBefore){
      const batch=await old.lineup(source,cursor,128);
      let progressed=false;
      for(const p of batch){
        if(p.end<=cursor||items.length&&p.start<items.at(-1).end-.01)continue;
        items.push(p);cursor=p.end;progressed=true;
        if(cursor>=notBefore)break;
      }
      if(!progressed||items.length>10000)throw Error('Cannot preserve published schedule: '+ch.name);
    }
    channels[ch.no]={until:items.at(-1).end,items};
  }
  return {version:1,fingerprint:signature,created:now,notBefore,channels};
}

async function main(){
  const local=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
  const get=async p=>{const r=await fetch('https://rabbit-ears.stream/'+p+'?schedule='+Date.now(),{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Published schedule unavailable: '+p+' '+r.status);return r.text();};
  const [html,catalogText,commercialTiming,mediaCompatibility]=await Promise.all(['index.html','catalog.json','commercial-timing.js','media-compatibility.js'].map(local));
  const [oldHtml,oldCatalog,oldTiming,oldCompatibility]=await Promise.all(['','catalog.json','commercial-timing.js','media-compatibility.js'].map(get));
  const next={html,catalog:JSON.parse(catalogText),commercialTiming,mediaCompatibility};
  next.catalog.programming=await stageProgramming({previous:{html:oldHtml,catalog:JSON.parse(oldCatalog),commercialTiming:oldTiming,mediaCompatibility:oldCompatibility},next});
  await writeFile(new URL('../catalog.json',import.meta.url),JSON.stringify(next.catalog));
  console.log('Protected published programs until at least '+new Date(next.catalog.programming.notBefore*1000).toISOString()+', then new cycles start at each channel’s next program boundary.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
