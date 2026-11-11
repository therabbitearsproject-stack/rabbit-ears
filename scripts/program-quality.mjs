import {createHash} from 'node:crypto';
import policies from './channel-policies.json' with {type:'json'};

const seconds=v=>String(v||0).split(':').reduce((a,p)=>a*60+Number(p),0);
const promotional=/\b(trailer|trailers|teaser|teasers|preview|previews|sample|samples|partial|incomplete|excerpts?|fragments?|unboxing|walkthrough|retrospective|reaction video|fan edit|fan trailer|movie review|episode review)\b/i;
const unsafe=/\b(hentai|porn|porno|pornography|nsfw|xxx|ecchi|harem|uncensored|sexploitation|striptease|nude|nudity|erotic|erotica|fetish|lolicon|shotacon|yarichin|kaifuku|kaede\s+to\s+suzu|redo\s+of\s+healer|yosuga\s+no\s+sora|sin\s+censura)\b/i;
export function policyFor(channel){return policies[channel.name]||{minSeconds:1,style:'ambient'};}
export function keepProgram(channel,row){
  const p=policyFor(channel),title=String(row[3]||'');
  if(!Number.isFinite(Number(row[2]))||row[2]<p.minSeconds||unsafe.test(title))return false;
  if(!p.clips&&promotional.test(title))return false;
  if(p.exclude&&new RegExp(p.exclude,'i').test(title))return false;
  if(p.require&&!new RegExp(p.require,'i').test(title))return false;
  return true;
}
export function strengthenPool(channel,rows,extra=[]){
  const seen=new Set();
  return [...rows,...extra].filter(r=>{
    const key=(r[6]||r[0])+'|'+r[1];
    if(seen.has(key)||!keepProgram(channel,r))return false;
    seen.add(key);return true;
  });
}
// Expand explicitly selected collection uploads into separate full-program rows.
// Metadata cannot prove editorial completeness: duration/title checks are admission gates,
// not a claim that every frame has been watched or that rights have been cleared.
export function collectionPrograms(channel,data,sourceId,compatibility,pickSub=()=> ''){
  const title=String([].concat(data.metadata?.title||sourceId)[0]);
  const files=(data.files||[]).filter(f=>/\.mp4$/i.test(f.name)&&!f.private&&seconds(f.length)>=policyFor(channel).minSeconds);
  const unique=new Map();
  for(const f of files){
    if(promotional.test(f.name)||unsafe.test(f.name))continue;
    const chosen=compatibility.choose(data.files,f);if(!chosen)continue;
    const canonical=chosen.name.replace(/(?:\.ia|_512kb)?\.mp4$/i,'').toLowerCase();
    const old=unique.get(canonical);
    if(!old||Number(chosen.width)*Number(chosen.height)>Number(old.width)*Number(old.height))unique.set(canonical,chosen);
  }
  const label=f=>f.replace(/^.*\//,'').replace(/(?:\.ia|_512kb)?\.mp4$/i,'').replace(/[._]/g,' ').replace(/\b(1080p|720p|480p|x264|h264|aac)\b/gi,'').replace(/\s+/g,' ').trim();
  return [...unique.values()].slice(0,150).map(f=>{
    const id=sourceId+'--'+createHash('sha256').update(f.name.replace(/(?:\.ia|_512kb)?\.mp4$/i,'').toLowerCase()).digest('hex').slice(0,16);
    const fileTitle=label(f.name),policy=policyFor(channel);
    // A sport-named collection may contain unrelated shows. For multi-file items,
    // require each file to identify the sport, teams or an actual game/race event.
    if(unique.size>1&&policy.require&&!new RegExp(policy.require,'i').test(fileTitle)&&! /\b(game|match|race|grand prix|gp|vs|versus|finals?|bowl)\b/i.test(fileTitle))return null;
    const display=unique.size>1?`${title} · ${fileTitle}`:title;
    return [id,f.name,Math.round(seconds(f.length)*10)/10,display.slice(0,300),String([].concat(data.metadata?.year||data.metadata?.date||'')[0]).slice(0,4),pickSub(data.files,f.name),sourceId,Number(f.width)||0,Number(f.height)||0,compatibility.knownCompatible(f)?compatibility.version:''];
  }).filter(r=>r&&keepProgram(channel,r));
}
