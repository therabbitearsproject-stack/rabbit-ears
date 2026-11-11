/* Run once with the project bot installed; reruns reuse tagged channels. */
import { writeFile } from 'node:fs/promises';
import channels from './channels.json' with {type:'json'};
if (process.loadEnvFile) { try { process.loadEnvFile(new URL('.dev.vars',import.meta.url)); } catch {} }
const token=process.env.DISCORD_BOT_TOKEN, guild=process.env.DISCORD_GUILD_ID || '1569894832615198771';
if(!token)throw Error('Set DISCORD_BOT_TOKEN in community/.dev.vars or the environment.');
const apply=process.argv.includes('--apply');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(path,method='GET',body){
  for(let attempt=0;attempt<8;attempt++){
    const r=await fetch('https://discord.com/api/v10'+path,{method,headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    if(r.status===429){const rate=await r.json();await delay((Number(rate.retry_after)||3)*1000+250);continue;}
    if(!r.ok)throw Error(`Discord HTTP ${r.status}; check bot access and permissions.`);
    return r.json();
  }
  throw Error('Discord is busy; rerun provisioning later.');
}
const existing=await api(`/guilds/${guild}/channels`);
const map=[];let category=null;
for(let start=0;start<channels.length;start+=40){
  const group=channels.slice(start,start+40);
  const categoryName=`Rabbit Ears · Channels ${String(group[0].no).padStart(2,'0')}–${group.at(-1).no}`;
  category=existing.find(c=>c.type===4&&c.name===categoryName);
  if(!category&&apply){category=await api(`/guilds/${guild}/channels`,'POST',{name:categoryName,type:4});existing.push(category);}
  for(const ch of group){
    const tag=`rabbit-ears:channel:${ch.no}`;
    let found=existing.find(c=>c.type===0&&c.topic?.split('\n').includes(tag));
    const name=`${ch.emoji || '📺'}・ch-${String(ch.no).padStart(2,'0')}-${ch.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`.slice(0,100);
    if(!found&&apply){
      found=await api(`/guilds/${guild}/channels`,'POST',{name,type:0,parent_id:category.id,topic:`${tag}\n${ch.name} · https://rabbit-ears.stream/#ch${ch.no}\nOriginal comments and reactions from the site appear here. Episode replays stay on the site.`,rate_limit_per_user:5});
      existing.push(found);await delay(400);
    }
    if(found&&apply&&found.name!==name){await api(`/channels/${found.id}`,'PATCH',{name});found.name=name;await delay(400);}
    map.push({number:ch.no,name:ch.name,discordId:found?.id||null});
    console.log(`${found?'Ready':apply?'Created':'Would create'}: ${name}`);
  }
}
if(!apply){console.log('Preview only. Run npm run provision -- --apply to create the missing categories/channels.');process.exit(0);}
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const sql=map.map(c=>`INSERT INTO channels(number,name,discord_id) VALUES(${c.number},${quote(c.name)},${quote(c.discordId)}) ON CONFLICT(number) DO UPDATE SET name=excluded.name,discord_id=excluded.discord_id;`).join('\n')+'\n';
await writeFile(new URL('channel-map.json',import.meta.url),JSON.stringify(map,null,2)+'\n');
await writeFile(new URL('channel-map.sql',import.meta.url),sql);
console.log('Saved channel-map.json and channel-map.sql. Apply SQL to D1 before enabling posting.');
