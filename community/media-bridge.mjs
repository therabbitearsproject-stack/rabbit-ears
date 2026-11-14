// Public, exact-file audio transport. This is not an arbitrary URL proxy.
export function canonicalMediaURL(record){
  const id=record?.archiveId,file=record?.file;
  if(typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,299}$/.test(id)||typeof file!=='string'||file.length>1500||/[\\\x00-\x1f\x7f]/.test(file)||!file.split('/').every(p=>p&&p!=='.'&&p!=='..')||! /\.(?:mp4|m4v|webm|ogv|ogg|mkv|mov|avi|mpeg|mpg|wmv|ts|m2ts)$/i.test(file))return null;
  return `https://archive.org/download/${encodeURIComponent(id)}/${file.split('/').map(encodeURIComponent).join('/')}`;
}
export function validMediaRange(range){
  if(range===null)return true;
  if(typeof range!=='string'||range.length>80)return false;
  const m=/^bytes=(\d{1,16})?-(\d{1,16})?$/.exec(range);if(!m||!m[1]&&!m[2])return false;
  if(!m[1])return BigInt(m[2])>0n;
  return !m[2]||BigInt(m[1])<=BigInt(m[2]);
}
function archiveRedirect(url){return url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')&&(url.hostname==='archive.org'||/^(?:[a-z0-9-]+\.)+archive\.org$/.test(url.hostname));}
function matchingContentRange(requested,returned,length){
  const match=/^bytes (\d{1,16})-(\d{1,16})\/(\d{1,16})$/.exec(returned||'');if(!match)return false;
  const [start,end,total]=match.slice(1).map(BigInt);if(start>end||end>=total)return false;
  if(length!==null&&(!/^\d{1,16}$/.test(length)||BigInt(length)!==end-start+1n))return false;
  const [,first,last]=/^bytes=(\d{1,16})?-(\d{1,16})?$/.exec(requested);
  const expectedStart=first?BigInt(first):total>BigInt(last)?total-BigInt(last):0n;
  const expectedEnd=first&&last&&BigInt(last)<total?BigInt(last):total-1n;
  return start===expectedStart&&end===expectedEnd;
}
function dispose(response){response.body?.cancel().catch(()=>{});}
const publishedShards=new Map(),MAX_SHARD_BYTES=1024*1024;
async function publishedRecord(id,env,fetcher,cache){
  let origin;try{origin=new URL(env.SITE_ORIGIN);if(origin.protocol!=='https:'||origin.origin!==env.SITE_ORIGIN)return null;}catch{return null;}
  const url=origin.origin+'/audio-media/'+id.slice(0,2)+'.json';
  let cached=cache.get(url);
  if(!cached||cached.until<Date.now()){
    const promise=(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
      try{
        const response=await fetcher(url,{method:'GET',credentials:'omit',redirect:'error',headers:{Accept:'application/json'},signal:controller.signal,cf:{cacheTtl:60,cacheEverything:true}});
        const declared=response.headers.get('Content-Length');
        if(response.status!==200||!/^application\/json(?:;|$)/i.test(response.headers.get('Content-Type')||'')||declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_SHARD_BYTES)){dispose(response);return null;}
        const reader=response.body?.getReader();if(!reader)return null;
        let size=0,text='';const decoder=new TextDecoder();
        try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_SHARD_BYTES){await reader.cancel();return null;}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}
        const value=JSON.parse(text);return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
      }catch{return null;}finally{clearTimeout(timer);}
    })();
    cached={until:Date.now()+60000,promise};cache.delete(url);cache.set(url,cached);if(cache.size>256)cache.delete(cache.keys().next().value);
  }
  const shard=await cached.promise;return shard&&Object.hasOwn(shard,id)?shard[id]:null;
}
export async function handleMediaBridge(request,env,sources,{fetcher=fetch,shardCache=publishedShards}={}){
  const cors={'Access-Control-Allow-Origin':env.SITE_ORIGIN,'Access-Control-Expose-Headers':'Accept-Ranges, Content-Range, Content-Length, Content-Type','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  const fail=(status,message)=>new Response(message,{status,headers:{...cors,'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
  const origin=request.headers.get('Origin');if(origin&&origin!==env.SITE_ORIGIN)return fail(403,'Unrecognized origin.');
  const url=new URL(request.url),match=/^\/media\/([a-f0-9]{64})$/.exec(url.pathname);
  if(!match||url.search)return fail(404,'Unknown media.');
  if(!['GET','HEAD','OPTIONS'].includes(request.method))return fail(405,'Use GET or HEAD.');
  const record=Object.hasOwn(sources,match[1])?sources[match[1]]:await publishedRecord(match[1],env,fetcher,shardCache);
  const upstream=canonicalMediaURL(record);if(!upstream)return fail(404,'Unknown media.');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(upstream)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==match[1])return fail(404,'Unknown media.');
  if(request.method==='OPTIONS'){
    const method=request.headers.get('Access-Control-Request-Method');
    const headers=(request.headers.get('Access-Control-Request-Headers')||'').split(',').map(h=>h.trim().toLowerCase()).filter(Boolean);
    if(method&&!['GET','HEAD'].includes(method)||headers.some(h=>h!=='range'))return fail(403,'Unrecognized media request.');
    return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','Access-Control-Allow-Headers':'Range','Access-Control-Max-Age':'86400'}});
  }
  const range=request.headers.get('Range');if(!validMediaRange(range))return fail(416,'Use one valid byte range.');
  const headers=new Headers({'Accept':'video/*, audio/*, application/octet-stream','Accept-Encoding':'identity'});if(range!==null)headers.set('Range',range);
  let target=upstream,response;
  try{
    for(let redirects=0;;redirects++){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
      try{response=await fetcher(target,{method:request.method,headers:new Headers(headers),redirect:'manual',credentials:'omit',signal:controller.signal});}finally{clearTimeout(timer);}
      if(![301,302,303,307,308].includes(response.status))break;
      const location=response.headers.get('Location');dispose(response);
      if(redirects>=5||!location)return fail(502,'Media redirect unavailable.');
      const next=new URL(location,target);if(!archiveRedirect(next))return fail(502,'Media redirect unavailable.');target=next.href;
    }
  }catch{return fail(502,'Media is temporarily unavailable.');}
  if(response.status===416){dispose(response);const out=fail(416,'Range not available.');const total=response.headers.get('Content-Range');if(/^bytes \*\/\d+$/.test(total||''))out.headers.set('Content-Range',total);return out;}
  const type=(response.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
  const contentRange=response.headers.get('Content-Range'),encoding=response.headers.get('Content-Encoding');
  if(![200,206].includes(response.status)||range!==null&&response.status!==206||response.status===206&&(!range||!matchingContentRange(range,contentRange,response.headers.get('Content-Length')))||!(/^(?:video|audio)\/[a-z0-9.+-]+$/.test(type)||['application/octet-stream','application/ogg','application/x-matroska'].includes(type))||encoding&&encoding.toLowerCase()!=='identity'){
    dispose(response);return fail(502,'Media response unavailable.');
  }
  const out=new Headers({...cors,'Cache-Control':'public, max-age=3600','Content-Type':response.headers.get('Content-Type'),'Accept-Ranges':'bytes'});
  for(const key of ['Content-Length','Content-Range','ETag','Last-Modified']){const value=response.headers.get(key);if(value!==null)out.set(key,value);}
  if(request.method==='HEAD')dispose(response);
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:out});
}
