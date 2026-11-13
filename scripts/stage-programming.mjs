// Preserve the published lineup for at least two hours, then begin the new cycle.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {siteCode,scheduleCode} from './tv-feed.mjs';

// One-time recovery of the incident reported on Nov 13. A deploy finishing late
// must not protect a corrupt replay that started AFTER the user's repair request.
const REPEAT_INCIDENT_BASELINE=Date.parse('2026-11-13T18:03:44Z')/1000;

const mediaClock=m=>Array.isArray(m)?{id:m[0],file:m[1],dur:m[2],title:m[3],year:m[4],archiveId:m[6]||m[0],cuts:m[10]??undefined}:
 Object.fromEntries(['id','file','dur','title','year','archiveId','cuts','role','series','local'].filter(k=>m?.[k]!=null).map(k=>[k,m[k]]));
const clockLibrary=library=>library&&{yearRange:library.yearRange,commercials:(library.commercials||[]).map(mediaClock),bumpers:(library.bumpers||[]).map(mediaClock)};
const poolClock=rows=>(rows||[]).map(mediaClock).sort((a,b)=>(a.id+'|'+a.file).localeCompare(b.id+'|'+b.file));
export const fingerprint = ({html,catalog,commercialTiming,mediaCompatibility}) => createHash('sha256').update(JSON.stringify({code:scheduleCode(html).replace(/\r\n/g,'\n'),commercialTiming:commercialTiming.replace(/\r\n/g,'\n'),mediaCompatibility:mediaCompatibility.replace(/\r\n/g,'\n'),
 pools:Object.fromEntries(Object.entries(catalog.pools||{}).map(([q,rows])=>[q,poolClock(rows)])),commercials:(catalog.commercials||[]).map(mediaClock),bumpers:(catalog.bumpers||[]).map(mediaClock),
 breakLibraries:Object.fromEntries(Object.entries(catalog.breakLibraries||{}).map(([id,lib])=>[id,clockLibrary(lib)])),channelBumpers:Object.fromEntries(Object.entries(catalog.channelBumpers||{}).map(([id,rows])=>[id,rows.map(mediaClock)])),channelAds:Object.fromEntries(Object.entries(catalog.channelAds||{}).map(([id,rows])=>[id,rows.map(mediaClock)]))})).digest('hex');
function channelSignature(snapshot,ch,site){
 const catalog=snapshot.catalog,rows=(catalog.pools[ch.q]||[]).filter(r=>!site.blocked(r[0],ch)&&!site.blocked(r[6]||r[0],ch));
 return createHash('sha256').update(JSON.stringify({plannerVersion:2,channel:{no:ch.no,q:ch.q,library:ch.library,breaks:ch.breaks},pool:poolClock(rows),
  breaks:ch.breaks?clockLibrary(ch.breaks.library?catalog.breakLibraries?.[ch.breaks.library]:catalog):null,
  bumpers:(catalog.channelBumpers?.[ch.no]||[]).map(mediaClock),ads:ch.breaks?[]:(catalog.channelAds?.[ch.no]||[]).map(mediaClock)})).digest('hex');
}

export async function stageProgramming({previous,next,now=Date.now()/1000,leadSeconds=2*3600+15*60}) {
  const signature=fingerprint(next);
  const target=siteCode(next),old=siteCode(previous),channels={};
  const notBefore=now+leadSeconds;
  for(const ch of target.BUILT_IN){
    const source=old.BUILT_IN.find(c=>c.no===ch.no);
    // New stations can begin immediately; existing stations must never silently lose protection.
    if(!source)continue;
    const perChannel=channelSignature(next,ch,target),oldChannel=previous.catalog.programming?.channels?.[ch.no];
    const validRows=(next.catalog.pools[ch.q]||[]).filter(r=>!target.blocked(r[0],ch)&&!target.blocked(r[6]||r[0],ch));
    const distinct=target.distinctPrograms(validRows.map(target.rowMedia));
    const same=target.sameProgram;
    const upcoming=await old.lineup(source,now,Math.max(12,oldChannel?.items?.length+2||12));
    const duplicate=distinct.length>1&&upcoming.some((p,i)=>i&&same(upcoming[i-1].m,p.m));
    // Captions and other stations' changes cannot restart an unchanged rotation.
    if(oldChannel&&(previous.catalog.programming.version>=2||previous.catalog.programming.fingerprint===signature)&&
       (oldChannel.signature?oldChannel.signature===perChannel:channelSignature(previous,source,old)===perChannel)&&!duplicate){
      channels[ch.no]=structuredClone(oldChannel);continue;
    }
    let preserveFrom=now,incidentRepair=false;
    if(previous.catalog.programming?.version<2&&now>=REPEAT_INCIDENT_BASELINE&&previous.catalog.programming.created<=REPEAT_INCIDENT_BASELINE&&distinct.length>1){
      const incident=await old.lineup(source,REPEAT_INCIDENT_BASELINE,Math.max(12,(oldChannel?.items?.length||0)+2));
      if(incident.some((p,i)=>i&&same(incident[i-1].m,p.m))){preserveFrom=REPEAT_INCIDENT_BASELINE;incidentRepair=true;}
    }
    const items=[];let cursor=preserveFrom,blockedSlot=false,repeatRepair=false;
    while(cursor<notBefore&&!blockedSlot){
      const batch=await old.lineup(source,cursor,128);
      let progressed=false;
      for(const p of batch){
        if(p.end<=cursor||items.length&&p.start<items.at(-1).end-.01)continue;
        // Repeated unwanted future slots are repaired at a completed-program
        // boundary. The currently playing program is always retained in full.
        if(items.length&&distinct.length>1&&same(items.at(-1).m,p.m)){repeatRepair=true;progressed=true;break;}
        // An explicit removal overrides schedule protection rather than retaining a bad upload.
        if(target.blocked(p.m.id,ch)||target.blocked(p.m.archiveId||p.m.id,ch)){
          cursor=Math.max(now,p.start);blockedSlot=true;progressed=true;break;
        }
        items.push(structuredClone(p));cursor=p.end;progressed=true;
        if(cursor>=notBefore)break;
      }
      if(repeatRepair)break;
      if(!progressed||items.length>10000)throw Error('Cannot preserve published schedule: '+ch.name);
    }
    // Introduce one program from each newly added source before the regular cycle,
    // so a new series is visible promptly rather than buried weeks into the pool.
    const oldSources=new Set((previous.catalog.pools[source.q]||[]).map(r=>r[6]||r[0])),seen=new Set(),leadIds=[];
    for(const row of next.catalog.pools[ch.q]||[]){const id=row[6]||row[0];if(!oldSources.has(id)&&!seen.has(id)){seen.add(id);leadIds.push(row[0]);}}
    const until=items.at(-1)?.end||cursor,last=items.at(-1)?.m;
    const fresh=leadIds.find(id=>{const media=distinct.find(m=>m.id===id);return media&&(!last||!same(last,media));});
    // Resume the old rotation's next different title, rather than slot zero.
    const continuation=await old.lineup(source,until,Math.min(256,Math.max(16,(oldChannel?.items?.length||0)+distinct.length+2)));
    const nextOld=continuation.find(p=>distinct.some(m=>m.id===p.m.id)&&(!last||!same(last,p.m)));
    const rotationStartId=fresh||nextOld?.m.id||distinct.find(m=>!last||!same(last,m))?.id||distinct[0]?.id;
    channels[ch.no]={until,items,leadIds:leadIds.length?leadIds:(oldChannel?.leadIds||[]),rotationStartId,signature:perChannel,...(blockedSlot?{earlyRemoval:true}:{}),...(repeatRepair?{repeatRepair:true}:{}),...(incidentRepair?{incidentBaseline:REPEAT_INCIDENT_BASELINE}:{})};
  }
  if(previous.catalog.programming?.version>=2&&Object.keys(channels).every(no=>JSON.stringify(channels[no])===JSON.stringify(previous.catalog.programming.channels[no]))){
    if(previous.catalog.programming.fingerprint===signature)return previous.catalog.programming;
    return {...previous.catalog.programming,fingerprint:signature};
  }
  return {version:2,fingerprint:signature,created:previous.catalog.programming?.fingerprint===signature?previous.catalog.programming.created:now,notBefore:previous.catalog.programming?.fingerprint===signature?previous.catalog.programming.notBefore:notBefore,channels};
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
