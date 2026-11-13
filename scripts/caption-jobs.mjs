// Pure Rabbit Ears -> Skippy contract. Transport, transcription and deployment
// deliberately live outside this module; no credentials or network calls here.
import {createHash} from 'node:crypto';
export const CAPTION_PROJECT='rabbit-ears';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
const languageAliases={eng:'en',english:'en',spa:'es',spanish:'es',fra:'fr',fre:'fr',french:'fr',ger:'de',deu:'de',german:'de',jpn:'ja',japanese:'ja',cze:'cs',ces:'cs',czech:'cs',pol:'pl',polish:'pl',rus:'ru',russian:'ru',ita:'it',italian:'it',por:'pt',portuguese:'pt',zho:'zh',chi:'zh',chinese:'zh',kor:'ko',korean:'ko',ara:'ar',arabic:'ar',arm:'hy',hye:'hy',armenian:'hy'};
export function captionLanguage(value){
 const values=[].concat(value||[]).map(v=>String(v).trim().toLowerCase()).filter(v=>v&&!['und','unknown','none','null','auto'].includes(v));
 const normalized=[...new Set(values.map(v=>languageAliases[v]||(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(v)?v:null)).filter(Boolean))];
 return normalized.length===1?normalized[0]:'auto';
}
export function archiveCaptionSource(archiveId,video){
 if(typeof archiveId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(archiveId))throw Error('Invalid Archive item identity');
 if(typeof video!=='string'||!video||/[\\\u0000-\u001f\u007f]/.test(video)||video.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Invalid Archive video path');
 return 'https://archive.org/download/'+encodeURIComponent(archiveId)+'/'+video.split('/').map(encodeURIComponent).join('/');
}
export function captionJobIdentity({archiveId,video,duration,language}){
 archiveCaptionSource(archiveId,video);
 if(!Number.isFinite(duration)||duration<=0||duration>7*86400)throw Error('Invalid caption duration');
 if(language!=='auto'&&!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(language||''))throw Error('Invalid requested language');
 return sha256(JSON.stringify([CAPTION_PROJECT,archiveId,video,duration,language]));
}
const fileIdentity=(archiveId,video)=>JSON.stringify([archiveId,video]);
const exactIdentity=({archiveId,video,duration})=>JSON.stringify([archiveId,video,duration]);
const rowIdentity=row=>({archiveId:row[6]||row[0],video:row[1],duration:row[2]});

// Review files have two historical schemas. Only affirmative pixel observations
// count: 'unknown' and 'no text observed' must never become burned-caption claims.
export function captionReviewRecords(documents=[]){
 const records=[];
 function walk(value){
  if(!value||typeof value!=='object')return;
  if(!Array.isArray(value)&&typeof(value.archiveId||value.id)==='string'&&typeof(value.video||value.file)==='string')records.push(value);
  for(const child of Object.values(value))if(child&&typeof child==='object')walk(child);
 }
 documents.forEach(walk);return records;
}
export function burnedCaptionSources(documents=[]){
 return new Set(captionReviewRecords(documents).filter(r=>r.burnedEnglish===true||r.burnedEnglish==='yes'||r.burnedIn===true||
  /^English burned subtitles directly observed\b/.test(r.burnedEnglishStatus||'')||r.frames?.some(f=>f.englishBurnedTextObserved===true))
  .map(r=>fileIdentity(r.archiveId||r.id,r.video||r.file)));
}
function reviewedIdentities(manifest){
 return new Set(Object.values(manifest?.episodes||{}).filter(e=>e.status==='passed'&&e.archiveId&&e.video&&Number.isFinite(e.duration)).map(exactIdentity));
}
function catalogGroups(catalog,channels=[]){
 const channelByQuery=new Map(channels.map(c=>[c.q,c]));
 const groups=new Map();
 for(const [q,rows]of Object.entries(catalog.pools||{}))for(const row of rows){
  const identity=rowIdentity(row);let key;
  try{archiveCaptionSource(identity.archiveId,identity.video);if(!Number.isFinite(identity.duration)||identity.duration<=0||identity.duration>7*86400)continue;key=exactIdentity(identity);}catch{continue;}
  const item=groups.get(key)||{...identity,title:String(row[3]||row[0]),aliases:[],channels:[],linked:false};
  item.aliases.push({q,id:row[0]});item.linked ||= !!row[5];
  const ch=channelByQuery.get(q);if(ch&&!item.channels.some(c=>c.no===ch.no))item.channels.push({no:ch.no,name:ch.name});
  groups.set(key,item);
 }
 return groups;
}
export function generateCaptionJobs({catalog,channels=[],reviewedManifest,sourceRecords=[],reviewDocuments=[],activeChannels=[]}){
 const groups=catalogGroups(catalog,channels),burned=burnedCaptionSources(reviewDocuments),reviewed=reviewedIdentities(reviewedManifest);
 const languages=new Map();
 for(const r of [...captionReviewRecords(sourceRecords),...captionReviewRecords(reviewDocuments)]){
  const value=r.language??r.audioLanguageMetadata??r.sourceLanguage;if(value==null)continue;
  const key=fileIdentity(r.archiveId||r.id,r.video||r.file),all=languages.get(key)||[];all.push(...[].concat(value));languages.set(key,all);
 }
 const jobs=[],summary={distinctVideos:groups.size,linked:0,burned:0,reviewed:0,queued:0,autoDetect:0};
 for(const item of groups.values()){
  const exact=exactIdentity(item),file=fileIdentity(item.archiveId,item.video);
  if(item.linked){summary.linked++;continue;}if(burned.has(file)){summary.burned++;continue;}if(reviewed.has(exact)){summary.reviewed++;continue;}
  const language=captionLanguage(languages.get(file)),jobId=captionJobIdentity({...item,language});
  const priority=item.channels.some(c=>c.no===42)?0:item.channels.some(c=>activeChannels.includes(c.no))?10:50;
  const {linked,...metadata}=item;
  jobs.push({schemaVersion:1,project:CAPTION_PROJECT,...metadata,language,jobId,identitySha256:jobId,sourceUrl:archiveCaptionSource(item.archiveId,item.video),priority});
  if(language==='auto')summary.autoDetect++;
 }
 jobs.sort((a,b)=>a.priority-b.priority||a.jobId.localeCompare(b.jobId));summary.queued=jobs.length;
 return {schemaVersion:1,project:CAPTION_PROJECT,summary,jobs};
}

function timestamp(value){
 const match=/^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/.exec(value);
 if(!match)throw Error('Invalid WebVTT cue timestamp');
 return Number(match[1]||0)*3600+Number(match[2])*60+Number(match[3])+Number(match[4])/1000;
}
export function validateGeneratedVtt(text,duration){
 if(typeof text!=='string'||Buffer.byteLength(text)>16*1024*1024||!/^WEBVTT\r?\n/.test(text)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))throw Error('Invalid generated WebVTT');
 const blocks=text.replace(/\r\n/g,'\n').split(/\n[ \t]*\n/);if(blocks.shift()!=='WEBVTT')throw Error('Invalid WebVTT header');
 let count=0,lastStart=-1,lastEnd=0;
 for(const block of blocks){
  if(!block.trim())continue;if(/^NOTE(?:\s|$)/.test(block))continue;
  const lines=block.trim().split('\n');if(!lines[0].includes('-->'))lines.shift();
  const times=/^(\S+) --> (\S+)$/.exec(lines.shift()||'');if(!times)throw Error('Invalid generated cue');
  const start=timestamp(times[1]),end=timestamp(times[2]);
  if(start<lastStart||start<lastEnd-.001||end<=start||end>duration+.001||end-start>60)throw Error('Generated cue outside source timeline');
  const body=lines.join('\n').trim();if(!body||body.length>4000||/[<>]/.test(body))throw Error('Generated cue must contain plain text');
  lastStart=start;lastEnd=end;if(++count>200000)throw Error('Too many generated cues');
 }
 if(!count)throw Error('Generated WebVTT has no cues');return {cues:count,lastCueEnd:lastEnd};
}

export function importCaptionCompletion({completion,queue,catalog,channels=[],reviewedManifest,generatedManifest={version:1,project:CAPTION_PROJECT,jobs:{}},reviewDocuments=[]}){
 if(generatedManifest.project&&generatedManifest.project!==CAPTION_PROJECT)throw Error('Wrong generated-caption manifest project');
 if(completion?.schemaVersion!==1||completion.project!==CAPTION_PROJECT||queue?.schemaVersion!==1||queue.project!==CAPTION_PROJECT)throw Error('Wrong caption project or contract version');
 const job=queue.jobs?.find(j=>j.jobId===completion.jobId);if(!job)throw Error('Completion does not belong to the submitted queue');
 const jobId=captionJobIdentity(job);
 if(jobId!==job.jobId||job.identitySha256!==jobId||completion.jobId!==jobId||captionJobIdentity(completion)!==jobId)throw Error('Caption job identity mismatch');
 const sourceUrl=archiveCaptionSource(job.archiveId,job.video);
 if(job.sourceUrl!==sourceUrl||completion.sourceUrl!==sourceUrl)throw Error('Caption source URL mismatch');
 if(typeof completion.detectedLanguage!=='string'||captionLanguage(completion.detectedLanguage)==='auto'||completion.detectedLanguage!==captionLanguage(completion.detectedLanguage))throw Error('Missing or invalid detected caption language');
 const validation=validateGeneratedVtt(completion.vtt,job.duration);
 if(!/^[a-f0-9]{64}$/.test(completion.vttSha256||'')||sha256(completion.vtt)!==completion.vttSha256)throw Error('Generated VTT checksum mismatch');
 const groups=catalogGroups(catalog,channels),item=groups.get(exactIdentity(job));
 if(!item)throw Error('Caption source no longer matches the current catalog');
 if(burnedCaptionSources(reviewDocuments).has(fileIdentity(job.archiveId,job.video))||reviewedIdentities(reviewedManifest).has(exactIdentity(job)))throw Error('Existing reviewed or burned captions are protected');
 const name='auto-'+jobId+'.vtt',sub='local:'+name;
 if(item.aliases.some(({q,id})=>catalog.pools[q].some(r=>r[0]===id&&r[5]&&r[5]!==sub)))throw Error('An existing linked caption is protected');
 const prior=generatedManifest.jobs?.[jobId];
 if(prior&&(prior.sha256!==completion.vttSha256||prior.detectedLanguage!==completion.detectedLanguage))throw Error('Existing generated caption cannot be overwritten');
 const entry={jobId,identitySha256:jobId,archiveId:job.archiveId,video:job.video,duration:job.duration,language:job.language,detectedLanguage:completion.detectedLanguage,
  sourceUrl,status:'auto-generated',file:name,sha256:completion.vttSha256,cues:validation.cues,engine:String(completion.engine||'whisper'),model:String(completion.model||'unknown'),generatedAt:completion.generatedAt||null};
 const manifest={...generatedManifest,version:1,project:CAPTION_PROJECT,jobs:{...generatedManifest.jobs,[jobId]:prior||entry}};
 return {duplicate:!!prior,asset:{name,text:completion.vtt,sha256:entry.sha256},manifest,links:item.aliases.map(alias=>({...alias,sub,captionMetadata:{kind:'auto-generated',language:entry.detectedLanguage,jobId}}))};
}

// Call AFTER applyReviewedCaptions. Generated captions fill empty slots only.
export async function applyGeneratedCaptions(rows,manifest,load,{reviewDocuments=[]}={}){
 const burned=burnedCaptionSources(reviewDocuments),entries=new Map(),cache=new Map();
 if(manifest?.project===CAPTION_PROJECT&&manifest.version===1)for(const entry of Object.values(manifest.jobs||{}))if(entry.status==='auto-generated'&&!entries.has(exactIdentity(entry)))entries.set(exactIdentity(entry),entry);
 return Promise.all(rows.map(async row=>{
  const out=[...row];
  if(/^local:auto-[a-f0-9]{64}\.vtt$/.test(out[5]||'')){out[5]='';if(out[11]?.kind==='auto-generated')delete out[11];}
  else if(out[11]?.kind==='auto-generated')delete out[11]; // A reviewed replacement must lose its old automatic label.
  if(out[5]||burned.has(fileIdentity(out[6]||out[0],out[1])))return out;
  const identity=rowIdentity(out),entry=entries.get(exactIdentity(identity));
  if(!entry)return out;
  try{
   const jobId=captionJobIdentity(entry),name='auto-'+jobId+'.vtt';
   if(entry.jobId!==jobId||entry.identitySha256!==jobId||entry.file!==name||entry.sourceUrl!==archiveCaptionSource(entry.archiveId,entry.video)||captionLanguage(entry.detectedLanguage)==='auto'||entry.detectedLanguage!==captionLanguage(entry.detectedLanguage))return out;
   if(!cache.has(jobId))cache.set(jobId,Promise.resolve().then(()=>load(name)).then(text=>{if(sha256(text)!==entry.sha256)throw Error('Changed generated caption');validateGeneratedVtt(text,entry.duration);return true;}).catch(()=>false));
   if(!await cache.get(jobId))return out;
   out[5]='local:'+name;out[11]={kind:'auto-generated',language:entry.detectedLanguage,jobId};
  }catch{/* Missing or stale automatic assets never advertise working CC. */}
  return out;
 }));
}
