// Find dated, individual archived commercials by subject. Never accepts long ad compilations.
import {readFile,writeFile} from 'node:fs/promises';import {topicsFor} from './themed-ad-library.mjs';
const themes={games:'nintendo OR sega OR atari OR playstation',computers:'commodore OR amiga OR ibm OR macintosh OR windows OR tandy',cars:'toyota OR ford OR chevrolet OR honda OR pontiac',kitchen:'kitchen OR blender OR cereal OR food OR cooker',music:'records OR album OR guitar OR stereo OR cassette',sports:'nike OR adidas OR gatorade OR reebok',toys:'lego OR barbie OR transformers OR toys',holiday:'christmas OR santa',outdoors:'kodak OR polaroid OR camera OR camping',home:'sears OR furniture OR target'};
const UA={'User-Agent':'RabbitEarsArchiveAds/1.0 (+https://rabbit-ears.stream)'};
async function json(url){const r=await fetch(url,{headers:UA,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
const ids=new Set();for(const [theme,terms]of Object.entries(themes))try{
 const q=`mediatype:movies AND title:(${terms}) AND title:(commercial OR advert) AND date:[1970-01-01 TO 2008-12-31] AND NOT title:(compilation OR collection OR tobacco OR cigarette OR beer OR liquor OR political)`;
 const u=new URL('https://archive.org/advancedsearch.php');u.search=new URLSearchParams({q,'fl[]':'identifier',rows:'16','sort[]':'downloads desc',output:'json'});
 const d=await json(u);for(const x of d.response.docs)ids.add(x.identifier);console.log(theme+': '+d.response.docs.length+' candidates');
}catch(e){console.log(theme+': unavailable ('+e.message+')');}
let previous=[];try{previous=JSON.parse(await readFile(new URL('./themed-ads.json',import.meta.url),'utf8')).commercials||[];}catch{}
const found=[];let next=0;const queue=[...ids];await Promise.all(Array.from({length:4},async()=>{while(next<queue.length){const id=queue[next++];try{
 const d=await json('https://archive.org/metadata/'+encodeURIComponent(id)),title=String([].concat(d.metadata?.title||id)[0]),year=Number(String([].concat(d.metadata?.date||d.metadata?.year||'')[0]).slice(0,4));
 if(year<1970||year>2008||/compilation|collection|tobacco|cigarette|beer|liquor|political/i.test(title))continue;
 const f=(d.files||[]).filter(f=>!f.private&&/\.mp4$/i.test(f.name)&&Number(f.length)>=8&&Number(f.length)<=90&&Number(f.width)>=320&&Number(f.height)>=240).sort((a,b)=>Number(b.width)*Number(b.height)-Number(a.width)*Number(a.height))[0];
 if(!f)continue;const m={id,file:f.name,dur:Number(f.length),title,year,archiveId:id,role:'archival-commercial',source:'https://archive.org/details/'+id};m.topics=topicsFor(m);if(!m.topics.length)continue;
 found.push(m);
 }catch{const old=previous.find(m=>m.id===id);if(old)found.push(old);}
}}));
found.sort((a,b)=>a.id.localeCompare(b.id));if(!found.length)throw Error('No dated individual ads found');
await writeFile(new URL('./themed-ads.json',import.meta.url),JSON.stringify({generated:new Date().toISOString(),note:'Dated individual Archive spots; historical artifacts, not current sponsorships. Topic labels are metadata-derived.',commercials:found},null,2)+'\n');
console.log(`${found.length} dated, topic-tagged individual commercials admitted from ${queue.length} candidates.`);
