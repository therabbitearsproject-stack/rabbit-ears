// Preserve the published lineup for at least two hours, then begin the new cycle.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {siteCode,scheduleCode} from './tv-feed.mjs';

export const fingerprint = ({html,catalog,commercialTiming,mediaCompatibility}) => createHash('sha256').update(JSON.stringify({code:scheduleCode(html),commercialTiming,mediaCompatibility,pools:catalog.pools,commercials:catalog.commercials,bumpers:catalog.bumpers,breakLibraries:catalog.breakLibraries,channelBumpers:catalog.channelBumpers,channelAds:catalog.channelAds})).digest('hex');

// Captions may change without disturbing a protected program's playback identity.
const mediaKey = m => m && Number.isFinite(m.dur) && m.dur > 0
  ? JSON.stringify([m.id,m.file,m.archiveId||m.id,m.dur]) : null;
function captionIndex(rows,target){
  const entries=new Map();
  for(const row of rows||[]){
    const media=target.rowMedia(row),key=mediaKey(media);if(!key)continue;
    // Conflicting duplicate rows do not establish an unambiguous caption choice.
    const caption={sub:media.sub||'',metadata:media.captionMetadata||null};
    if(entries.has(key)&&JSON.stringify(entries.get(key))!==JSON.stringify(caption))entries.set(key,null);
    else if(!entries.has(key))entries.set(key,caption);
  }
  return entries;
}
function refreshCaptions(slot,index){
  const copy=structuredClone(slot);
  const refresh=media=>{const caption=index.get(mediaKey(media));if(caption&&typeof caption.sub==='string'){media.sub=caption.sub;if(caption.metadata)media.captionMetadata=structuredClone(caption.metadata);else if(media.captionMetadata!==undefined)delete media.captionMetadata;}};
  if(copy.m)refresh(copy.m);
  for(const segment of copy.timeline?.segments||[])if(segment.kind==='program'&&segment.media)refresh(segment.media);
  return copy;
}

export async function stageProgramming({previous,next,now=Date.now()/1000,leadSeconds=2*3600+15*60}) {
  const signature=fingerprint(next);
  const target=siteCode(next);
  if(previous.catalog.programming?.fingerprint===signature){
    // Older deployments may already have this fingerprint but stale frozen CC metadata.
    const programming=structuredClone(previous.catalog.programming);let changed=false;
    for(const ch of target.BUILT_IN){
      const stage=programming.channels[ch.no];if(!stage)continue;
      const index=captionIndex(next.catalog.pools[ch.q],target);
      stage.items=stage.items.map(slot=>{const copy=refreshCaptions(slot,index);if(JSON.stringify(copy)!==JSON.stringify(slot))changed=true;return copy;});
    }
    return changed?programming:previous.catalog.programming;
  }
  const old=siteCode(previous),channels={};
  const notBefore=now+leadSeconds;
  for(const ch of target.BUILT_IN){
    const source=old.BUILT_IN.find(c=>c.no===ch.no);
    // New stations can begin immediately; existing stations must never silently lose protection.
    if(!source)continue;
    const captions=captionIndex(next.catalog.pools[ch.q],target);
    const items=[];let cursor=now,blockedSlot=false;
    while(cursor<notBefore&&!blockedSlot){
      const batch=await old.lineup(source,cursor,128);
      let progressed=false;
      for(const p of batch){
        if(p.end<=cursor||items.length&&p.start<items.at(-1).end-.01)continue;
        // An explicit removal overrides schedule protection rather than retaining a bad upload.
        if(target.blocked(p.m.id,ch)||target.blocked(p.m.archiveId||p.m.id,ch)){
          cursor=Math.max(now,p.start);blockedSlot=true;progressed=true;break;
        }
        items.push(refreshCaptions(p,captions));cursor=p.end;progressed=true;
        if(cursor>=notBefore)break;
      }
      if(!progressed||items.length>10000)throw Error('Cannot preserve published schedule: '+ch.name);
    }
    // Introduce one program from each newly added source before the regular cycle,
    // so a new series is visible promptly rather than buried weeks into the pool.
    const oldSources=new Set((previous.catalog.pools[source.q]||[]).map(r=>r[6]||r[0])),seen=new Set(),leadIds=[];
    for(const row of next.catalog.pools[ch.q]||[]){const id=row[6]||row[0];if(!oldSources.has(id)&&!seen.has(id)){seen.add(id);leadIds.push(row[0]);}}
    channels[ch.no]={until:items.at(-1)?.end||cursor,items,leadIds,...(blockedSlot?{earlyRemoval:true}:{})};
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
