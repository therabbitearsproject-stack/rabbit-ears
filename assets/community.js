/* Episode-time comments: reading/replaying never writes to Discord. */
import {contentPosition,editionFile} from './community-timing.mjs';
import {REACTIONS,LEGACY_REACTIONS} from './pixel-reactions.mjs?v=2';
const config = window.RABBIT_COMMUNITY || {};
const api = config.api?.replace(/\/$/, '');
const video = document.getElementById('vid');
const screen = document.getElementById('screen');
const reactionMap=new Map([...REACTIONS,...LEGACY_REACTIONS].map(r=>[r.emoji,r]));
const el = (tag, cls, text) => Object.assign(document.createElement(tag), {className:cls || '',textContent:text || ''});
function reactionIcon(emoji){const r=reactionMap.get(emoji);if(!r)return document.createTextNode(emoji);const im=el('img','reaction-icon');im.src=new URL('./reactions/'+r.id+'.svg',import.meta.url).href;im.alt=r.label;im.width=24;im.height=24;return im;}
const button = (text, fn, cls='btn') => {const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
const stamp = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const hash = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
let user=null, ready=false, room=null, pendingRoom='', generation=0, events=[], markers=[], cursor=null, seen=new Set(), posting=false, pollAt=0, markerAt=0, inflight=false;
let replays=true; try {replays=localStorage.getItem('re_replays')!=='false';} catch {}
const panel=el('div','watch-popover comment-popover');panel.id='comment-popover';panel.setAttribute('popover','auto');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Quick comment');
const heading=el('div','popover-heading');heading.append(el('h3','','Leave a comment'),button('×',()=>closePopover(panel),'popover-close'));heading.lastChild.setAttribute('aria-label','Close comment');
const auth=el('div','community-auth');
const notice=el('p','community-status','Connecting to the watch party…');notice.setAttribute('role','status');
const channelLink=el('a','community-discord','Open Rabbit Ears Discord ↗');channelLink.href=config.invite || 'https://discord.gg/Me827VV6';channelLink.target='_blank';channelLink.rel='noopener';
const settings=el('div','community-settings');const replayLabel=el('label');const replayToggle=el('input');replayToggle.type='checkbox';replayToggle.checked=replays;replayLabel.append(replayToggle,document.createTextNode(' Replay comments & reactions'));settings.append(replayLabel,channelLink);
const reactionPopover=el('div','watch-popover emoji-popover');reactionPopover.id='emoji-popover';reactionPopover.setAttribute('popover','auto');reactionPopover.setAttribute('role','dialog');reactionPopover.setAttribute('aria-label','Quick reactions');
const reactionHeading=el('div','popover-heading');reactionHeading.append(el('h3','','React'),button('×',()=>closePopover(reactionPopover),'popover-close'));reactionHeading.lastChild.setAttribute('aria-label','Close reactions');
const reactionAuth=el('div','community-auth');
const reactions=el('div','reaction-buttons');reactions.setAttribute('role','group');reactions.setAttribute('aria-label','React to this moment');
for(const r of REACTIONS){const b=button('',()=>send('emoji',r.emoji),'reaction-button');b.dataset.emoji=r.emoji;b.setAttribute('aria-label',r.label);const im=reactionIcon(r.emoji);im.alt='';b.append(im);reactions.append(b);}
const reactionNotice=el('p','community-status');reactionNotice.setAttribute('role','status');reactionPopover.append(reactionHeading,reactionAuth,reactions,reactionNotice);
const form=el('form','community-composer');const input=el('textarea');input.rows=2;input.maxLength=500;input.placeholder='What’s on your mind at this moment?';input.setAttribute('aria-label','Comment on this moment');
const submit=button('Post',()=>{});submit.type='submit';const disclosure=el('p','community-disclosure','Public here and in this channel’s Discord room. Saved with the episode for later replays.');
form.append(input,submit);form.addEventListener('submit',e=>{e.preventDefault();send('comment',input.value);});
const list=el('ol','community-comments');list.setAttribute('aria-label','Comments and reactions near this moment');
const empty=el('p','community-empty','No moments here yet.');
const recent=el('details','recent-moments');recent.append(el('summary','','Recent moments'),list,empty);
panel.append(heading,auth,form,notice,disclosure,settings,recent);
screen.append(panel,reactionPopover);
let popoverOpener=null;
const triggers=[];
const dockIcon=type=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${type==='comment'?'<path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>':'<path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/>'}</svg>`;
function closePopover(p){if(p.matches(':popover-open'))p.hidePopover();popoverOpener?.focus({preventScroll:true});}
function openPopover(p,b){
  if(p.matches(':popover-open')){closePopover(p);return;}
  popoverOpener=b;p.showPopover();
  const anchor=b.getBoundingClientRect(),box=p.getBoundingClientRect(),gap=8;
  p.style.left=Math.max(12,Math.min(innerWidth-box.width-12,anchor.right-box.width))+'px';
  p.style.top=Math.max(12,anchor.bottom+box.height+gap<innerHeight-12?anchor.bottom+gap:anchor.top-box.height-gap)+'px';
  if(p===panel){if(user&&!input.disabled)input.focus();else auth.querySelector('a,button')?.focus();}
}
function makeDock(cls){
  const d=el('div',cls);d.setAttribute('role','group');d.setAttribute('aria-label','Comments and reactions');
  for(const [kind,label,p] of [['comment','Leave a comment',panel],['heart','React',reactionPopover]]){
    const b=button('',e=>{e.preventDefault();openPopover(p,b);},'watch-dock-button');b.innerHTML=dockIcon(kind);b.title=label;b.setAttribute('popovertarget',p.id);b.setAttribute('aria-label',label);b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls',p.id);b.setAttribute('aria-expanded','false');triggers.push({button:b,popover:p});d.append(b);
  }
  return d;
}
for(const p of [panel,reactionPopover])p.addEventListener('toggle',()=>{for(const t of triggers)if(t.popover===p)t.button.setAttribute('aria-expanded',String(p.matches(':popover-open')));});
const pack=document.querySelector('.player-pack'),dock=makeDock('watch-dock');dock.hidden=true;pack.querySelector('.remote').append(dock);
const layer=el('div','reaction-layer');layer.setAttribute('aria-hidden','true');screen.append(layer);
const quick=makeDock('fullscreen-community watch-dock');quick.hidden=true;
screen.querySelector('.fullscreen-remote')?.append(quick);
const timeline=el('div','community-timeline');timeline.setAttribute('aria-label','Comments and reactions on this episode');document.getElementById('pos').after(timeline);
function context(){const c=window.rePlaybackContext?.();if(!c)return null;c.position=contentPosition(c.position,c.cuts);if(c.position===null)return null;c.file=editionFile(c.file,c.cuts);return c;}
function message(text){notice.textContent=text;reactionNotice.textContent=text;}
async function call(path,options={}){
  if(!api)throw Error('The watch party is being connected. Please try again later.');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch(api+path,{credentials:'include',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(user?{'X-CSRF-Token':user.csrf}:{}),...options.headers},signal:controller.signal});
    let data;try{data=await response.json();}catch{throw Error('The watch party is temporarily unavailable.');}
    if(!response.ok){if(response.status===401){user=null;renderAuth();controls();}throw Error(data.error||'Please try again in a moment.');}return data;
  }finally{clearTimeout(timeout);}
}
function controls(){
  const c=context(), enabled=!!user&&ready&&!!c&&!posting&&!!room;
  reactions.querySelectorAll('button').forEach(b=>{b.disabled=!enabled;b.title=!user?'Sign in with Discord to react':!c?'Reactions return when the programme resumes':'React at '+stamp(c.position);});
  input.disabled=!enabled;submit.disabled=!enabled;
  input.placeholder=!user?'Sign in with Discord to leave a comment':!c?'Comments return when the programme resumes':'What’s on your mind at '+stamp(c.position)+'?';
}
function renderAuth(){
  for(const target of [auth,reactionAuth]){
    target.replaceChildren();
    if(user){if(target===auth)target.append(el('span','community-name',user.name),button('Sign out',async()=>{try{await call('/api/logout',{method:'POST'});user=null;renderAuth();controls();}catch(e){message(e.message);}},'community-signout'));}
    else {const login=el('a','btn discord-signin','Sign in & join Discord');login.href=api+'/auth/discord?channel='+(context()?.channel||97);login.addEventListener('click',()=>{login.href=api+'/auth/discord?channel='+(context()?.channel||97);});target.append(login,el('small','community-disclosure','Signing in also joins the Rabbit Ears Discord server.'));}
  }
}
function replayed(e,c){return e.createdAt<c.airingStart;}
function show(e,c){return replays||!replayed(e,c);}
function paintList(){
  const c=context();if(!c||!room){list.replaceChildren();empty.hidden=false;return;}
  list.replaceChildren();
  for(const e of events.filter(e=>e.position<=c.position+.5&&e.position>=c.position-90&&show(e,c)).slice(-30)){
    const item=el('li','community-comment');item.dataset.event=e.id;
    const meta=el('div','comment-meta');meta.append(el('strong','',e.name),el('span','',stamp(e.position)+(replayed(e,c)?' · replay':'')));
    const text=el('p','',e.kind==='emoji'?'Reacted ':e.body);if(e.kind==='emoji')text.append(reactionIcon(e.body));item.append(meta,text);
    if(e.canDelete)item.append(button('Remove',async()=>{try{await call('/api/events/'+e.id,{method:'DELETE'});events=events.filter(x=>x.id!==e.id);paintList();markerAt=0;}catch(err){message(err.message);}},'comment-remove'));
    list.append(item);
  }
  empty.hidden=!!list.children.length;
}
function burst(event,c){
  if(!show(event,c)||document.hidden)return;
  const node=el('span',event.kind==='emoji'?'floating-emoji':'floating-comment',event.kind==='emoji'?'':event.name+': '+event.body);if(event.kind==='emoji')node.append(reactionIcon(event.body));
  node.style.setProperty('--reaction-x',`${12+Math.random()*70}%`);layer.append(node);setTimeout(()=>node.remove(),event.kind==='emoji'?2600:4500);
}
function paintMarkers(c){
  timeline.replaceChildren();timeline.hidden=!c||!markers.length;
  for(const m of markers){
    const dot=el('span','community-marker');dot.tabIndex=0;dot.style.left=Math.min(99.5,m.position/c.duration*100)+'%';
    const emoji=(m.emoji||'').split(',').filter(e=>reactionMap.has(e)),reactionCount=m.count-m.comments;
    dot.title=`${stamp(m.position)}${m.comments?' · '+m.comments+(m.comments===1?' comment':' comments'):''}${reactionCount?' · '+reactionCount+(reactionCount===1?' reaction':' reactions')+(emoji.length?' '+emoji.map(e=>reactionMap.get(e).label).join(', '):''):''}${m.sample?' — '+m.sample.slice(0,120):''}`;
    dot.setAttribute('aria-label',dot.title);
    if(emoji.length){const glyph=el('span','marker-reaction');glyph.append(reactionIcon(emoji[0]));glyph.setAttribute('aria-hidden','true');dot.append(glyph);}
    const tooltip=el('span','marker-tooltip',dot.title);dot.append(tooltip);timeline.append(dot);
  }
}
async function changeRoom(c,key){
  const version=++generation;pendingRoom=key;room=null;events=[];markers=[];seen.clear();cursor=null;pollAt=0;markerAt=0;layer.replaceChildren();paintList();paintMarkers(null);controls();
  const media=await hash(JSON.stringify([c.mediaId,c.file]));if(version!==generation)return;
  room={key,media,channel:c.channel};pendingRoom='';
  message(user?'You’re watching as '+user.name+'.':'Watching is open to everyone. Sign in to join in.');controls();
}
async function poll(){
  if(inflight||!room||!ready)return;const c=context();if(!c)return;
  const version=generation, captured=room;inflight=true;
  try{
    const query=new URLSearchParams({channel:captured.channel,media:captured.media,from:Math.max(0,c.position-90),to:c.position+60});
    const data=await call('/api/events?'+query);if(version!==generation)return;
    events=data.events;paintList();
    if(data.discordChannel&&/^\d+$/.test(data.discordChannel)){channelLink.href=`https://discord.com/channels/${data.guild}/${data.discordChannel}`;channelLink.textContent='Open this channel in Discord ↗';}
    // Polling can discover a live entry a few seconds after its content timestamp.
    const current=context();
    if(current&&!current.paused)for(const e of events)if(!seen.has(e.id)&&e.createdAt>Date.now()/1000-12&&e.position<=current.position+.2&&e.position>=current.position-8){seen.add(e.id);burst(e,current);}
    if(Date.now()-markerAt>30000){const data=await call('/api/timeline?'+new URLSearchParams({channel:captured.channel,media:captured.media}));if(version!==generation)return;markers=data.markers;markerAt=Date.now();paintMarkers(context());}
  }catch{if(version===generation)message('The watch party connection paused. Your programme keeps playing; we’ll reconnect.');}
  finally{inflight=false;}
}
async function send(kind,body){
  const c=context();if(!c||!user||posting||!room||!body.trim())return;
  const version=generation;posting=true;controls();
  try{
    const result=await call('/api/events',{method:'POST',body:JSON.stringify({channel:c.channel,mediaId:c.mediaId,file:c.file,title:c.title,position:c.position,kind,body,requestId:crypto.randomUUID()})});
    if(version!==generation)return;
    events.push(result.event);seen.add(result.event.id);burst(result.event,c);if(kind==='comment')input.value='';paintList();markerAt=0;
    message('Saved at '+stamp(c.position)+'.');closePopover(kind==='emoji'?reactionPopover:panel);return true;
  }catch(e){message(e.message);return false;}
  finally{posting=false;controls();}
}
replayToggle.addEventListener('change',()=>{replays=replayToggle.checked;try{localStorage.setItem('re_replays',String(replays));}catch{}layer.replaceChildren();paintList();});
video.addEventListener('seeking',()=>{cursor=null;layer.replaceChildren();pollAt=0;});
video.addEventListener('timeupdate',()=>{
  const c=context();if(!c||!room||c.paused)return;
  if(cursor===null||c.position<cursor||c.position-cursor>4){cursor=c.position-.25;seen=new Set(events.filter(e=>e.position<cursor).map(e=>e.id));}
  for(const e of events)if(!seen.has(e.id)&&e.position>cursor-.2&&e.position<=c.position+.2){seen.add(e.id);burst(e,c);}
  cursor=c.position;paintList();
});
async function connect(){
  try{const health=await call('/health');if(!health.configured)throw Error('Not connected yet');const data=await call('/api/session');user=data.user;ready=true;renderAuth();message(user?'You’re watching as '+user.name+'.':'Watching is open to everyone. Sign in to join in.');controls();}
  catch{ready=false;message('The Discord watch party is being connected. TV, radio and games work as usual.');renderAuth();controls();}
}
setInterval(()=>{
  const c=context();dock.hidden=!ready||document.body.dataset.mode!=='tv';quick.hidden=!ready;
  if(!c){if(room||pendingRoom){++generation;room=null;pendingRoom='';events=[];markers=[];layer.replaceChildren();paintMarkers(null);paintList();}controls();return;}
  const key=JSON.stringify([c.channel,c.mediaId,c.file]);
  if(key!==(room?.key||pendingRoom))changeRoom(c,key);
  if(!document.hidden&&Date.now()-pollAt>5000){pollAt=Date.now();poll();}controls();
},500);
setInterval(()=>{if(!ready)connect();},30000);
renderAuth();controls();connect();
