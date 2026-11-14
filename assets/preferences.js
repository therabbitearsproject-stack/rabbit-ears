/* Optional Discord account settings. Playback and anonymous preferences remain local. */
window.RabbitPreferences=(()=>{
  const defaults={re_skin:'pixel',re_radio_look:'vinyl',re_caption_style:'none',re_captions:false,re_caption_backing:false,re_tv_volume:.8,re_tv_muted:true,re_vol:.8};
  const enums={re_skin:['retro','theatre','stadium','modern','cozy','metal','ivory','pixel','gutter'],re_radio_look:['vinyl','car'],re_caption_style:['none','yellow','white']};
  function clean(value){
    const out={};if(!value||typeof value!=='object'||Array.isArray(value))return out;
    for(const [key,v]of Object.entries(value)){
      if(!Object.hasOwn(defaults,key))continue;
      const valid=enums[key]?enums[key].includes(v):typeof defaults[key]==='boolean'?typeof v==='boolean':typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
      if(valid)out[key]=v;
    }
    return out;
  }
  function coherent(value){const out={...value};if(Object.hasOwn(out,'re_caption_style'))out.re_captions=out.re_caption_style!=='none';return out;}
  function create({store,apply=values=>window.REUI?.applyPreferences?.(values),api=window.RABBIT_COMMUNITY?.api,fetcher=window.fetch.bind(window),debounceMs=650,pollMs=30000}={}){
    if(!store||!api)return null;
    api=api.replace(/\/$/,'');
    const original=store.set.bind(store),cached=store.get('re_account_preferences',null);
    let guest=clean(store.get('re_guest_preferences',null));
    if(!Object.keys(guest).length&&!cached?.userId)for(const key of Object.keys(defaults)){const v=store.get(key,undefined);Object.assign(guest,clean({[key]:v}));}
    if(Object.hasOwn(guest,'re_captions')&&!Object.hasOwn(guest,'re_caption_style'))guest.re_caption_style=guest.re_captions?'white':'none';
    let user=null,epoch=0,version=0,ready=false,applying=false,dirty={},history={},ticks=0,timer=null,saving=false,server={},stopped=false,checking=false;
    const status=state=>window.dispatchEvent(new CustomEvent('re:preferences-status',{detail:{state,signedIn:!!user}}));
    const persistGuest=()=>original('re_guest_preferences',guest);
    const remember=()=>{if(user){const pending=Object.fromEntries(Object.entries(dirty).map(([k,v])=>[k,v.value]));original('re_account_preferences',{schemaVersion:1,userId:user.id,version,values:merged(),pending});}};
    function applyValues(values){
      applying=true;
      try{for(const [k,v]of Object.entries(values))original(k,v);apply({...values});}
      finally{applying=false;}
    }
    const merged=()=>coherent({...defaults,...server,...Object.fromEntries(Object.entries(dirty).map(([k,v])=>[k,v.value]))});
    function schedule(delay=debounceMs){clearTimeout(timer);if(user&&ready&&!stopped)timer=setTimeout(flush,delay);timer?.unref?.();}
    store.set=function(key,value){
      original(key,value);
      if(applying||!Object.hasOwn(clean({[key]:value}),key))return;
      const tick=++ticks;history[key]={value,tick};
      if(user){dirty[key]={value,tick};remember();status('saving');schedule();}
      else{guest[key]=value;persistGuest();}
    };
    async function request(path,options={}){
      const response=await fetcher(api+path,{credentials:'include',cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json','X-CSRF-Token':user?.csrf||''}:{}),...options.headers},signal:typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(10000):undefined});
      const body=await response.json();return {response,body};
    }
    function accept(body){return body?.schemaVersion===1&&body.userId===user?.id&&Number.isSafeInteger(body.version)&&body.version>=version&&body.preferences&&typeof body.preferences==='object'&&!Array.isArray(body.preferences);}
    async function load(startTick=ticks){
      const generation=epoch;if(!user)return;
      try{
        const {response,body}=await request('/api/preferences');if(generation!==epoch||stopped)return;
        if(response.status===401){setSession(null);return;}
        if(!response.ok||!accept(body))throw Error('Settings unavailable');
        version=body.version;server=clean(body.preferences);
        for(const [key,intent]of Object.entries(history))if(intent.tick>startTick)dirty[key]=intent;
        // Only explicit saved guest choices seed a genuinely new account; defaults are never uploaded.
        if(version===0)for(const [key,value]of Object.entries(guest))if(!dirty[key])dirty[key]={value,tick:++ticks};
        ready=true;applyValues(merged());remember();status('synced');if(Object.keys(dirty).length)schedule();
      }catch{if(generation===epoch)status('offline');}
    }
    async function flush(){
      if(!user||!ready||saving||!Object.keys(dirty).length||stopped)return;
      const generation=epoch,sent={...dirty},changes=coherent(Object.fromEntries(Object.entries(sent).map(([k,v])=>[k,v.value])));
      saving=true;let retryDelay=1500;
      try{
        const {response,body}=await request('/api/preferences',{method:'PUT',body:JSON.stringify({version,changes})});
        if(generation!==epoch||stopped)return;
        if(response.status===401){setSession(null);return;}
        if(response.status===403){ready=false;status('offline');checkSession();return;}
        if(!accept(body)||!response.ok&&response.status!==409)throw Error('Settings not saved');
        version=body.version;server=clean(body.preferences);
        if(response.ok)for(const [key,intent]of Object.entries(sent))if(dirty[key]?.tick===intent.tick)delete dirty[key];
        applyValues(merged());remember();status(response.ok?'synced':'merging');
      }catch{retryDelay=30000;if(generation===epoch)status('offline');}
      finally{saving=false;if(Object.keys(dirty).length)schedule(retryDelay);}
    }
    function setSession(next,startTick=ticks){
      const id=next?.id;
      if(!id||typeof id!=='string'||!next.csrf){
        if(!user&&!cached?.userId)return;
        ++epoch;user=null;ready=false;dirty={};server={};version=0;clearTimeout(timer);
        applyValues(coherent({...defaults,...guest}));original('re_account_preferences',null);status('local');return;
      }
      if(user?.id===id){user=next;if(!ready||!Object.keys(dirty).length)load();return;}
      ++epoch;user=next;ready=false;dirty={};server={};version=0;clearTimeout(timer);
      const local=store.get('re_account_preferences',null),ownCache=local?.userId===id&&Number.isSafeInteger(local.version)&&local.version>=0&&[undefined,1].includes(local.schemaVersion),fallback=ownCache?clean(local.values):{};
      if(ownCache){server={...fallback};version=local.version;}
      if(ownCache)for(const [key,value]of Object.entries(clean(local.pending)))dirty[key]={value,tick:++ticks};
      const intentional=Object.fromEntries(Object.entries(history).filter(([,v])=>v.tick>startTick).map(([k,v])=>[k,v.value]));
      applyValues(coherent({...defaults,...fallback,...intentional}));
      load(startTick);
    }
    async function checkSession(){
      if(checking||stopped)return;checking=true;const generation=epoch,start=ticks;
      try{const {response,body}=await request('/api/session');if(response.ok&&generation===epoch)setSession(body.user,start);}catch{status('offline');}
      finally{checking=false;}
    }
    const sessionEvent=e=>setSession(e.detail),visible=()=>{if(!document.hidden)checkSession();};
    window.addEventListener('re:session',sessionEvent);document.addEventListener('visibilitychange',visible);
    const poll=pollMs?setInterval(checkSession,pollMs):null;poll?.unref?.();
    persistGuest();checkSession();
    return {setSession,refresh:checkSession,flush,stop(){stopped=true;++epoch;clearTimeout(timer);clearInterval(poll);window.removeEventListener('re:session',sessionEvent);document.removeEventListener('visibilitychange',visible);store.set=original;},getState:()=>({userId:user?.id||null,version,ready,dirty:Object.keys(dirty)})};
  }
  return {create};
})();
