import channels from './channels.json' with { type: 'json' };

import {REACTIONS} from '../assets/pixel-reactions.mjs';
export const EMOJI = REACTIONS.map(r=>r.emoji);
const CHANNELS = new Set(channels.map(c => c.no));
const enc = new TextEncoder();
const random = () => crypto.randomUUID();
export const digest = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map(n => n.toString(16).padStart(2, '0')).join('');
const now = () => Math.floor(Date.now() / 1000);
const cookie = (name, value, age = 604800) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
function cookies(request) { return Object.fromEntries((request.headers.get('Cookie') || '').split(';').map(s => s.trim().split('=')).filter(a => a.length === 2)); }
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const requireValue = (ok, message, status = 400) => { if (!ok) throw new HttpError(status, message); };
export function validateEvent(body) {
  requireValue(body && CHANNELS.has(body.channel), 'Unknown broadcast channel.');
  for (const [key, max] of [['mediaId',300],['file',1000],['title',300]]) requireValue(typeof body[key] === 'string' && body[key].length > 0 && body[key].length <= max, `Invalid ${key}.`);
  requireValue(typeof body.position === 'number' && Number.isFinite(body.position) && body.position >= 0 && body.position <= 43200, 'Invalid playback position.');
  requireValue(['comment','emoji'].includes(body.kind), 'Invalid event type.');
  requireValue(typeof body.body === 'string' && body.body.trim().length > 0 && body.body.length <= 500, 'Comments must be 1–500 characters.');
  requireValue(body.kind !== 'emoji' || EMOJI.includes(body.body), 'Choose a supported reaction.');
  requireValue(typeof body.requestId === 'string' && /^[a-f0-9-]{36}$/i.test(body.requestId), 'Invalid submission ID.');
  return { ...body, body: body.body.trim() };
}
const mediaKey = b => digest(JSON.stringify([b.mediaId,b.file]));
function headers(request, env) {
  const h = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Vary':'Origin' };
  if (request.headers.get('Origin') === env.SITE_ORIGIN) Object.assign(h, { 'Access-Control-Allow-Origin':env.SITE_ORIGIN, 'Access-Control-Allow-Credentials':'true' });
  return h;
}
const json = (request, env, value, status = 200) => new Response(JSON.stringify(value), { status, headers:headers(request,env) });
async function session(request, env) {
  const token = cookies(request).__Host_re_session;
  if (!token) return null;
  return env.DB.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?').bind(await digest(token),now()).first();
}
async function writeSession(request, env) {
  requireValue(request.headers.get('Origin') === env.SITE_ORIGIN, 'Unrecognized site origin.', 403);
  const user = await session(request, env);
  requireValue(user, 'Sign in with Discord to post.', 401);
  requireValue(request.headers.get('X-CSRF-Token') === user.csrf, 'Your session changed. Reload and try again.', 403);
  return user;
}
async function discord(path, env, init = {}) {
  return fetch('https://discord.com/api/v10' + path, { ...init, headers:{ Authorization:`Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type':'application/json', ...init.headers } });
}
export function discordPayload(event) {
  const p = Math.floor(event.position), stamp = `${Math.floor(p/60)}:${String(p%60).padStart(2,'0')}`;
  const plain = text => String(text).replace(/\s+/g,' ').trim().replace(/([\\*_~`|>\[\]])/g,'\\$1');
  const name = plain(event.display_name), body = event.kind === 'comment' ? plain(event.body) : event.body;
  return {
    content: `**${name}** · [${stamp}](<https://rabbit-ears.stream/#ch${event.channel}>) ${event.kind === 'comment' ? '— ' : ''}${body}`,
    embeds:[],
    // Keep mirrored activity quiet: no link cards, push notifications or mention pings.
    flags:(1 << 2) | (1 << 12),
    allowed_mentions:{ parse:[] },
    nonce:event.id.replaceAll('-','').slice(0,25), enforce_nonce:true,
  };
}

async function deliver(env) {
  if (!env.DISCORD_BOT_TOKEN) return;
  const time = now();
  const { results } = await env.DB.prepare('SELECT o.event_id FROM outbox o WHERE done=0 AND attempts<12 AND next_attempt<=? AND lease_until<=? LIMIT 10').bind(time,time).all();
  for (const row of results) {
    const lease = await env.DB.prepare('UPDATE outbox SET lease_until=?,attempts=attempts+1 WHERE event_id=? AND done=0 AND lease_until<=? RETURNING attempts').bind(time+90,row.event_id,time).first();
    if (!lease) continue;
    const e = await env.DB.prepare('SELECT e.*,c.discord_id FROM events e JOIN channels c ON c.number=e.channel WHERE e.id=?').bind(row.event_id).first();
    try {
      if (!e || (e.deleted_at && !e.discord_message_id)) {
        await env.DB.prepare('UPDATE outbox SET done=1 WHERE event_id=?').bind(row.event_id).run(); continue;
      }
      const response = await discord(`/channels/${e.discord_id}/messages${e.deleted_at ? '/'+e.discord_message_id : ''}`,env,{ method:e.deleted_at?'DELETE':'POST', ...(e.deleted_at?{}:{body:JSON.stringify(discordPayload(e))}) });
      if (!response.ok && !(e.deleted_at && response.status === 404)) {
        const retry = response.status === 429 ? Math.ceil(Number(response.headers.get('Retry-After')) || 30) : Math.min(3600,2 ** lease.attempts * 5);
        await env.DB.prepare('UPDATE outbox SET lease_until=0,next_attempt=?,last_error=? WHERE event_id=?').bind(now()+retry,`Discord HTTP ${response.status}`,e.id).run();
        if (response.status === 429) break;
        continue;
      }
      if (!e.deleted_at) {
        const message = await response.json();
        await env.DB.prepare('UPDATE events SET discord_message_id=? WHERE id=?').bind(message.id,e.id).run();
        // Deletion may race with delivery: enqueue its deletion instead of losing it.
        const current = await env.DB.prepare('SELECT deleted_at FROM events WHERE id=?').bind(e.id).first();
        await env.DB.prepare('UPDATE outbox SET done=?,lease_until=0,next_attempt=0,last_error=NULL WHERE event_id=?').bind(current.deleted_at?0:1,e.id).run();
      } else await env.DB.prepare('UPDATE outbox SET done=1,lease_until=0,last_error=NULL WHERE event_id=?').bind(e.id).run();
    } catch {
      await env.DB.prepare('UPDATE outbox SET lease_until=0,next_attempt=?,last_error=? WHERE event_id=?').bind(now()+60,'Delivery interrupted; retry scheduled',row.event_id).run();
    }
  }
}
function publicEvent(e, user) {
  return { id:e.id, position:e.position, kind:e.kind, body:e.body, name:e.display_name,
    createdAt:e.created_at, mine:user?.user_id === e.user_id,
    canDelete:!!user && (user.user_id === e.user_id || user.moderator), discordPosted:!!e.discord_message_id };
}
function moderator(user, env) { return !!user && (env.MODERATOR_IDS || '').split(',').map(s=>s.trim()).includes(user.user_id); }
async function handle(request, env, ctx) {
  const url = new URL(request.url), path = url.pathname;
  if (request.method === 'OPTIONS') {
    requireValue(request.headers.get('Origin') === env.SITE_ORIGIN,'Unrecognized origin.',403);
    return new Response(null,{ status:204, headers:{ ...headers(request,env), 'Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, X-CSRF-Token' } });
  }
  if (path === '/health') {
    const count=env.DB?await env.DB.prepare('SELECT COUNT(*) AS count FROM channels').first():{count:0};
    return json(request,env,{ok:true,channels:count.count,configured:!!(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.DISCORD_BOT_TOKEN && env.DB && count.count===channels.length)});
  }
  if (path === '/auth/discord' && request.method === 'GET') {
    requireValue(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.DISCORD_BOT_TOKEN && /^\d+$/.test(env.DISCORD_GUILD_ID || ''),'Discord sign-in is not available yet.',503);
    const state = random();
    const auth = new URL('https://discord.com/oauth2/authorize');
    auth.search = new URLSearchParams({ client_id:env.DISCORD_CLIENT_ID, redirect_uri:env.API_ORIGIN+'/auth/callback', response_type:'code', scope:'identify guilds.join', state });
    const channel = Number(url.searchParams.get('channel'));
    const returnChannel = CHANNELS.has(channel) ? String(channel) : '';
    const h = new Headers({Location:auth.href,'Cache-Control':'no-store'});
    h.append('Set-Cookie',cookie('__Host_re_oauth',state,600)); h.append('Set-Cookie',cookie('__Host_re_return',returnChannel,600));
    return new Response(null,{status:302,headers:h});
  }
  if (path === '/auth/callback' && request.method === 'GET') {
    const c = cookies(request), state = url.searchParams.get('state');
    requireValue(state && state === c.__Host_re_oauth,'Discord sign-in expired. Please start again.',403);
    requireValue(url.searchParams.get('code'),'Discord sign-in was cancelled.');
    const response = await fetch('https://discord.com/api/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.DISCORD_CLIENT_ID,client_secret:env.DISCORD_CLIENT_SECRET,grant_type:'authorization_code',code:url.searchParams.get('code'),redirect_uri:env.API_ORIGIN+'/auth/callback'})});
    requireValue(response.ok,'Discord sign-in could not be completed. Please try again.',502);
    const token = await response.json();
    let profile;
    try {
      requireValue(token.access_token && (token.scope || '').split(/\s+/).includes('guilds.join'),'Please sign in again and allow joining Rabbit Ears.',403);
      const profileResponse = await fetch('https://discord.com/api/v10/users/@me',{headers:{Authorization:`Bearer ${token.access_token}`}});
      requireValue(profileResponse.ok,'Discord profile unavailable.',502);
      profile = await profileResponse.json();
      requireValue(/^\d+$/.test(profile.id) && /^\d+$/.test(env.DISCORD_GUILD_ID || ''),'Discord membership is not configured.',503);
      // Join only Rabbit Ears, only during the viewer-approved sign-in flow.
      // No roles/nickname overrides; Discord screening and bans remain in force.
      const joined = await discord(`/guilds/${env.DISCORD_GUILD_ID}/members/${profile.id}`,env,{method:'PUT',body:JSON.stringify({access_token:token.access_token})});
      requireValue(joined.status === 201 || joined.status === 204,'Could not join Rabbit Ears on Discord. Please try signing in again; contact support if this continues.',502);
    } finally {
      // Revoke on success or failure; never retain access/refresh tokens.
      if(token.access_token)ctx.waitUntil(fetch('https://discord.com/api/oauth2/token/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.DISCORD_CLIENT_ID,client_secret:env.DISCORD_CLIENT_SECRET,token:token.access_token})}).catch(()=>{}));
    }
    const sid = random()+random(), csrf = random();
    await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,display_name,avatar,csrf,expires_at) VALUES(?,?,?,?,?,?)').bind(await digest(sid),profile.id,(profile.global_name || profile.username).slice(0,80),null,csrf,now()+604800).run();
    const old = c.__Host_re_session;
    if (old) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(old)).run();
    const channel = CHANNELS.has(Number(c.__Host_re_return)) ? '#ch'+c.__Host_re_return : '#tv';
    const h = new Headers({Location:env.SITE_ORIGIN+'/'+channel,'Cache-Control':'no-store'});
    h.append('Set-Cookie',cookie('__Host_re_session',sid)); h.append('Set-Cookie',cookie('__Host_re_oauth','',0)); h.append('Set-Cookie',cookie('__Host_re_return','',0));
    return new Response(null,{status:302,headers:h});
  }
  if (path === '/api/session' && request.method === 'GET') {
    const user = await session(request,env);
    return json(request,env,{ user:user?{name:user.display_name,csrf:user.csrf,moderator:moderator(user,env)}:null });
  }
  if (path === '/api/logout' && request.method === 'POST') {
    const user = await writeSession(request,env);
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.token_hash).run();
    const response = json(request,env,{ok:true}); response.headers.append('Set-Cookie',cookie('__Host_re_session','',0)); return response;
  }
  if (path === '/api/events' && request.method === 'GET' || path === '/api/timeline' && request.method === 'GET') {
    const channel = Number(url.searchParams.get('channel')), key = url.searchParams.get('media');
    requireValue(CHANNELS.has(channel) && /^[a-f0-9]{64}$/.test(key || ''),'Invalid episode.');
    const user = await session(request,env); if (user) user.moderator = moderator(user,env);
    if (path === '/api/timeline') {
      const {results} = await env.DB.prepare('SELECT CAST(position/10 AS INTEGER)*10 AS position,COUNT(*) AS count,SUM(kind=\'comment\') AS comments,MIN(CASE WHEN kind=\'comment\' THEN body END) AS sample,GROUP_CONCAT(DISTINCT CASE WHEN kind=\'emoji\' THEN body END) AS emoji FROM events WHERE channel=? AND media_key=? AND deleted_at IS NULL GROUP BY 1 ORDER BY 1 LIMIT 4321').bind(channel,key).all();
      return json(request,env,{markers:results});
    }
    const from = Math.max(0,Number(url.searchParams.get('from')) || 0), to = Math.min(43200,Number(url.searchParams.get('to')) || from+90);
    requireValue(to >= from && to-from <= 180,'Invalid playback window.');
    const {results} = await env.DB.prepare('SELECT * FROM events WHERE channel=? AND media_key=? AND position BETWEEN ? AND ? AND deleted_at IS NULL ORDER BY position,created_at,id LIMIT 200').bind(channel,key,from,to).all();
    const mapping=await env.DB.prepare('SELECT discord_id FROM channels WHERE number=?').bind(channel).first();
    return json(request,env,{events:results.map(e=>publicEvent(e,user)),discordChannel:mapping?.discord_id || null,guild:env.DISCORD_GUILD_ID});
  }
  if (path === '/api/events' && request.method === 'POST') {
    const user = await writeSession(request,env);
    requireValue(request.headers.get('Content-Type')?.includes('application/json'),'JSON required.',415);
    const raw = await request.text(); requireValue(raw.length <= 6000,'Submission too large.',413);
    let parsed; try { parsed=JSON.parse(raw); } catch { throw new HttpError(400,'Invalid JSON.'); }
    const body = validateEvent(parsed), key = await mediaKey(body), id=random();
    requireValue(await env.DB.prepare('SELECT number FROM channels WHERE number=?').bind(body.channel).first(),'This channel is being connected to Discord. Try again soon.',503);
    const time=now();
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO events(id,request_id,channel,media_key,media_id,media_file,title,position,kind,body,user_id,display_name,avatar,created_at)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM events WHERE user_id=? AND created_at>?)<12`).bind(id,body.requestId,body.channel,key,body.mediaId,body.file,body.title,body.position,body.kind,body.body,user.user_id,user.display_name,null,time,user.user_id,time-60),
      env.DB.prepare('INSERT OR IGNORE INTO outbox(event_id) SELECT id FROM events WHERE user_id=? AND request_id=?').bind(user.user_id,body.requestId),
    ]);
    const event=await env.DB.prepare('SELECT * FROM events WHERE user_id=? AND request_id=?').bind(user.user_id,body.requestId).first();
    requireValue(event,'A little too fast. Please wait a minute before posting again.',429);
    ctx.waitUntil(deliver(env));
    return json(request,env,{event:publicEvent(event,user)},201);
  }
  const deletion=path.match(/^\/api\/events\/([a-f0-9-]{36})$/i);
  if (deletion && request.method === 'DELETE') {
    const user=await writeSession(request,env), event=await env.DB.prepare('SELECT * FROM events WHERE id=?').bind(deletion[1]).first();
    requireValue(event,'Entry not found.',404);
    requireValue(event.user_id===user.user_id || moderator(user,env),'You can only remove your own entries.',403);
    await env.DB.batch([
      env.DB.prepare('UPDATE events SET deleted_at=? WHERE id=?').bind(now(),event.id),
      env.DB.prepare('UPDATE outbox SET done=0,attempts=0,next_attempt=0 WHERE event_id=?').bind(event.id),
    ]);
    ctx.waitUntil(deliver(env)); return json(request,env,{ok:true});
  }
  throw new HttpError(404,'Not found.');
}
export default {
  async fetch(request,env,ctx) {
    try { return await handle(request,env,ctx); }
    catch(error) { return json(request,env,{error:error.status?error.message:'The community service is temporarily unavailable.'},error.status || 503); }
  },
  async scheduled(_controller,env,ctx) {
    ctx.waitUntil(Promise.all([deliver(env),env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now()).run()]));
  },
};
