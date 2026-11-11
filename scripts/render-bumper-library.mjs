// Local authoring through build-channel-bumpers.mjs; optional [channel] [--kind=station-id|fact].
import {createRequire} from 'node:module';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve} from 'node:path';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
import branding from './channel-branding.json' with {type:'json'};
const require=createRequire(resolve(process.argv[2])),{Resvg}=require('@resvg/resvg-js'),ffmpeg=resolve(process.argv[3]),scratch=resolve(process.argv[4]),musicFolder=resolve(process.argv[5]);
const only=Number(process.argv[6]||0),kind=process.argv.find(a=>a.startsWith('--kind='))?.split('=')[1];
const out=new URL('../assets/channel-bumpers/',import.meta.url);await mkdir(out,{recursive:true});await mkdir(scratch,{recursive:true});
const logo=await readFile(new URL('../assets/brand/polished/full-dark.svg',import.meta.url),'utf8'),accents=JSON.parse(await readFile(new URL('../assets/channel-logos/manifest.json',import.meta.url),'utf8')),licensed=JSON.parse(await readFile(new URL('music-sources.json',out),'utf8'));
let previous={channels:{}};try{previous=JSON.parse(await readFile(new URL('manifest.json',out),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
let trek;try{trek=JSON.parse(await readFile(new URL('./trek-bumper-stories.json',import.meta.url),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;trek=JSON.parse(await readFile(new URL('../assets/trek-bumpers/facts.json',import.meta.url),'utf8'));}
const hash=v=>createHash('sha256').update(v).digest('hex');
const run=args=>new Promise((ok,fail)=>{const p=spawn(ffmpeg,args,{windowsHide:true});let err='';p.stderr.on('data',d=>err+=d);p.on('error',fail);p.on('close',code=>code?fail(Error(err)):ok());});
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const wrap=(s,max)=>{const a=[''];for(const w of s.split(/\s+/)){if((a.at(-1)+' '+w).trim().length>max)a.push(w);else a[a.length-1]+=(a.at(-1)?' ':'')+w;}return a;};
const text=(s,x,y,size,max,fill)=>wrap(s,max).map((l,i)=>`<text x="${x}" y="${y+i*size*1.28}" font-size="${size}" fill="${fill}" font-family="Arial" font-weight="${size>45?700:400}">${xml(l)}</text>`).join('');
const jobs=[];
for(const ch of branding.channels){const prefix='ch'+String(ch.no).padStart(2,'0');
 for(const [i,tag]of(ch.tags||[ch.tag]).entries())jobs.push({ch,tag,variant:i*2,id:prefix+'-ident'+(i?'-'+String(i+1).padStart(2,'0'):''),kind:'station-id',dur:8});
 for(const [i,fact]of(ch.facts||[ch.fact]).entries())jobs.push({ch,fact,variant:i*2+1,id:prefix+(i?'-story-'+String(i+1).padStart(2,'0'):'-moment'),kind:'fact',dur:12});}
const trekChannel=branding.channels.find(c=>c.no===97);
for(const[i,f]of trek.entries())jobs.push({ch:trekChannel,fact:{...f,credit:f.credit||(f.source.includes('nasa.gov')?'NASA':'StarTrek.com')},variant:12+i,id:i<6?'ch97-fact-'+f.id:'ch97-extra-'+String(i+1).padStart(2,'0'),kind:'fact',dur:12});
const selected=jobs.filter(j=>(!only||j.ch.no===only)&&(!kind||j.kind===kind)),manifest={version:3,generated:new Date().toISOString(),channels:{},music:'Licensed Kevin MacLeod recordings, CC BY 4.0. Varied compatible music palettes, distinct excerpts, fades and matched loudness. Credits: https://rabbit-ears.stream/music-credits/'};
for(const job of selected)job.renderKey=hash(JSON.stringify(['card-layout-v3',logo,accents[job.ch.name]?.accent,job.ch.name,job.kind,job.variant,job.tag,job.fact,job.ch.style]));
const oldById=new Map(Object.values(previous.channels).flat().map(m=>[m.id,m])),cached=new Map(),used=new Set();
if(only||kind){const ids=new Set(selected.map(j=>j.id));for(const[no,entries]of Object.entries(previous.channels))manifest.channels[no]=entries.filter(m=>!ids.has(m.id));}
for(const m of Object.values(manifest.channels).flat())used.add(m.music.isrc+'|'+m.music.offset+'|'+m.dur);
// Reuse verified published videos; expanding the library must not re-encode every existing asset.
for(const job of selected){const old=oldById.get(job.id);if(old&&(!old.renderKey||old.renderKey===job.renderKey)&&(!old.hook||old.hook===job.fact?.hook)&&old.title===(job.fact?.fact||job.tag)&&old.source===(job.fact?.source||null)&&old.dur===job.dur&&old.music.style===job.ch.style){try{if(hash(await readFile(new URL(old.file,new URL('../',import.meta.url))))===old.sha256){cached.set(job.id,{...old,hook:job.fact?.hook||null,renderKey:job.renderKey});used.add(old.music.isrc+'|'+old.music.offset+'|'+old.dur);}}catch{}}}
const neighbors={lounge:['jazz','piano'],jazz:['lounge','piano'],cartoon:['lounge','chiptune'],synthpop:['chiptune','space'],cinema:['adventure','piano'],adventure:['cinema','western'],western:['cinema','adventure'],organ:['rock','funk'],metal:['rock'],rock:['metal','funk'],surf:['rock','funk'],disco:['funk'],funk:['disco'],space:['ambient','theremin'],theremin:['space','spooky'],spooky:['theremin','ambient'],piano:['lounge'],ambient:[],chiptune:['synthpop','cartoon']};
function chooseMusic({ch,variant,dur,id}){
 const styles=ch.no===34?['piano']:ch.no===67?['organ','jazz']:[ch.style,...(neighbors[ch.style]||[])];
 const titles=[...new Set([...(ch.no===34?['Fig Leaf Rag']:ch.no===67?['Take Me Out to the Ballgame']:[]),...styles.flatMap(s=>licensed.styles[s]||[])])],rank=parseInt(hash(id).slice(0,8),16);
 for(let k=0;k<titles.length;k++){const track=licensed.tracks.find(t=>t.title===titles[(ch.no+variant+k)%titles.length]);if(!track)continue;
  const available=Math.floor(Math.max(0,track.duration-dur-.5)*10),start=available?rank%(available+1):0;
  for(let step=0;step<=available;step++){const offset=((start+step)%(available+1))/10,key=track.isrc+'|'+offset+'|'+dur;if(!used.has(key)){used.add(key);return{track,offset};}}}
 throw Error('No unique licensed music excerpt available for '+id);
}
let cursor=0,rendered=0,reused=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<selected.length){const job=selected[cursor++],{ch,fact,tag,id,dur,variant}=job;let media=cached.get(id);
 if(media)reused++;
 else{const {track,offset}=chooseMusic(job),accent=accents[ch.name]?.accent||'#a56b4b',light=!fact&&variant%4===2,bg=light?'#f5f0e7':'#101114',fg=light?'#000':'#fff',dim=light?'#504c47':'#b9bec4';
  const mark=logo.replace('<svg ',`<svg x="60" y="44" width="390" height="93" `).replace('color="#ffffff"',`color="${fg}"`),heading=fact?fact.hook:ch.name,body=fact?fact.fact:tag,bodyLines=wrap(body,fact?48:43).length,bodySize=fact?Math.min(29,Math.floor(140/(Math.max(1,bodyLines-1)*1.28))):32;
  const label=fact?ch.name.toUpperCase()+' / LITTLE SIGNAL':['YOU ARE WATCHING','THIS IS','STAY TUNED','BACK IN A MOMENT','ON YOUR DIAL','KEEP THE CHANNEL OPEN'][variant/2%6];
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720"><rect width="960" height="720" fill="${bg}"/><rect x="0" y="0" width="12" height="720" fill="${accent}"/>${mark}<circle cx="863" cy="94" r="35" fill="${accent}"/><text x="863" y="104" text-anchor="middle" font-family="Arial" font-size="28" font-weight="700" fill="#fff">${ch.no}</text><path d="M60 188H900" stroke="${dim}" stroke-opacity=".35"/>${text(label,60,230,18,70,dim)}${text(heading,60,318,fact?43:58,fact?36:26,fg)}${text(body,60,fact?440:464,bodySize,fact?48:43,fg)}${text(fact?'Source: '+fact.credit:'rabbit-ears.stream / stay a little longer.',60,605,15,90,dim)}${text('Music: '+track.title+' / Kevin MacLeod',60,638,14,100,dim)}${text('incompetech.com / CC BY 4.0 / excerpt, fades and level adjusted',60,659,13,100,dim)}${text('Full credits: rabbit-ears.stream/music-credits/',60,680,12,100,dim)}</svg>`;
  const png=resolve(scratch,id+'.png'),wav=resolve(scratch,id+'.wav'),file=new URL(id+'.mp4',out);await writeFile(png,new Resvg(svg,{font:{loadSystemFonts:true}}).render().asPng());
  await run(['-hide_banner','-loglevel','error','-y','-ss',String(offset),'-i',resolve(musicFolder,track.isrc+'.mp3'),'-t',String(dur),'-af',`afade=t=in:st=0:d=0.08,afade=t=out:st=${dur-.45}:d=0.45`,'-ar','44100','-ac','2','-c:a','pcm_s16le',wav]);
  const audio=await readFile(wav);
  await run(['-hide_banner','-loglevel','error','-y','-loop','1','-framerate','15','-i',png,'-i',wav,'-t',String(dur),'-vf',`fade=t=in:st=0:d=0.2,fade=t=out:st=${dur-.3}:d=0.3`,'-af','loudnorm=I=-22:TP=-3:LRA=7','-c:v','libx264','-threads','2','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-ar','44100','-movflags','+faststart',file.pathname.replace(/^\/(\w:)/,'$1')]);
  media={id,title:body,file:'assets/channel-bumpers/'+id+'.mp4',dur,local:true,role:'custom-bumper',channel:ch.no,kind:job.kind,source:fact?.source||null,sha256:hash(await readFile(file)),audioSha256:hash(audio),music:{style:ch.style,title:track.title,isrc:track.isrc,creator:track.creator,source:track.source,license:track.license,licenseUrl:track.licenseUrl,offset,duration:dur,changes:'Trimmed excerpt, fades and loudness normalization'}};rendered++;if(rendered%20===0)console.log(`${rendered} new videos rendered; ${reused} reused`);}
 media.hook=fact?.hook||null;media.renderKey=job.renderKey;(manifest.channels[ch.no]??=[]).push(media);
}}));
for(const entries of Object.values(manifest.channels))entries.sort((a,b)=>a.id.localeCompare(b.id));await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');console.log(`Complete: ${rendered} new, ${reused} reused; ${Object.values(manifest.channels).flat().length} total videos.`);
