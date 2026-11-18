// Refresh only verified ad libraries and topic pools. Programme discovery,
// subtitles and the published programming anchor are deliberately not writers.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {loadChannelBreakLibrary} from './channel-break-library.mjs';
import {channelAdPools,mergeAds} from './themed-ad-library.mjs';
import {siteCode} from './tv-feed.mjs';

export function adAdmission(reports,blocked=()=>false){
 const tallies=new Map();
 for(const report of Object.values(reports||{})){
  if(!report?.id||!report.reason)continue;
  const t=tallies.get(report.id)||{broken:0,inappropriate:0,wrong:{}};
  if(report.reason==='wrong')t.wrong[report.ch]=(t.wrong[report.ch]||0)+1;
  else if(report.reason in t)t[report.reason]++;
  tallies.set(report.id,t);
 }
 return (media,channel)=>[media.id,media.archiveId,media.source?.archiveId].filter(Boolean).every(id=>{
  const t=tallies.get(id);
  return !blocked(id,channel)&&(!t||t.broken<3&&t.inappropriate<2&&(t.wrong[channel.name]||0)<2);
 });
}

export function refreshAdCatalog(catalog,{libraries,channels,themedAds,allowed=()=>true}){
 const next=structuredClone(catalog),original=JSON.stringify({pools:catalog.pools,programming:catalog.programming});
 next.breakLibraries||={};
 for(const [id,library] of Object.entries(libraries)){
  const replacement=structuredClone(library);
  if(id==='sci-fi-channel')replacement.bumpers.push(...(catalog.breakLibraries?.[id]?.bumpers||[]).filter(m=>m.role==='custom-bumper'));
  if(id==='porchlight'){
   const seen=new Set(replacement.commercials.map(m=>m.id));
   replacement.commercials.push(...(catalog.breakLibraries?.[id]?.commercials||[]).filter(m=>!seen.has(m.id)));
  }
  const channel=channels.find(ch=>id==='sci-fi-channel'?ch.no===97:id==='porchlight'?ch.no===9:ch.no===42);
  replacement.commercials=replacement.commercials.filter(m=>allowed(m,channel));
  next.breakLibraries[id]=replacement;
 }
 next.channelAds=channelAdPools(channels,mergeAds(next,themedAds));
 for(const channel of channels)next.channelAds[channel.no]=next.channelAds[channel.no].filter(m=>allowed(m,channel));
 if(JSON.stringify({pools:next.pools,programming:next.programming})!==original)throw Error('An ad-only refresh cannot change programmes or the published clock');
 return next;
}

async function main(){
 const root=new URL('../',import.meta.url),read=async p=>readFile(new URL(p,root),'utf8');
 const [html,commercialTiming,mediaCompatibility,catalogText,channelsText,themedText]=await Promise.all(
  ['index.html','commercial-timing.js','media-compatibility.js','catalog.json','community/channels.json','scripts/themed-ads.json'].map(read));
 const catalog=JSON.parse(catalogText),channels=JSON.parse(channelsText),site=siteCode({html,commercialTiming,mediaCompatibility,catalog});
 const response=await fetch('https://project-rabbitears-default-rtdb.firebaseio.com/reports.json',{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Viewer reports unavailable; ad publication must retain existing removals');
 const reports=await response.json(),libraries={};
 for(const id of ['sci-fi-channel','porchlight','midnight-mirage'])libraries[id]=await loadChannelBreakLibrary(id,root);
 const next=refreshAdCatalog(catalog,{libraries,channels,themedAds:JSON.parse(themedText).commercials,allowed:adAdmission(reports,site.blocked)});
 await writeFile(new URL('catalog.json',root),JSON.stringify(next));
 console.log('Ad pools refreshed for '+channels.length+' channels; programme rows, captions and programming anchor unchanged.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
