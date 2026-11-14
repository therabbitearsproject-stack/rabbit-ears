/* Optional, local TV audio. Captured streams keep native playback recoverable.
   The DSP model/graph/worklet are adapted from the MIT-licensed desktop app. */
window.RabbitAudioSettings = (() => {
  const workletURL=new URL('audio-worklet.js',document.currentScript.src).href;
  function create({container, store, video, radio}) {
    const model=window.RabbitAudioModel;
    let settings=model.settings(store.get('re_audio',model.defaults()));
    let desiredMuted=video.muted, graph=null, context=null, stream=null, output=null;
    let generation=0, pending=false, ownReload=false, ownCors=false, nativeOnly=false;
    let failedSource='', workletReady=false, internalMute=false, lastStatus='';
    let reloadErrorHandler=null;
    const originalCors=video.getAttribute('crossorigin'), controls=[], cleanups=[];
    const make=(tag,cls,text)=>Object.assign(document.createElement(tag),{className:cls||'',textContent:text||''});
    const heading=make('h3','','Sound');
    const intro=make('p','settings-note','TV effects run on this device. Radio keeps its original sound. Start with a preset, then adjust to taste.');
    const status=make('p','audio-status','Original sound');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    container.append(heading,intro);
    function report(text){if(text!==lastStatus){lastStatus=text;status.textContent=text;}container.dataset.audioState=graph?'processing':'native';}
    function listen(target,name,fn){target.addEventListener(name,fn);cleanups.push(()=>target.removeEventListener(name,fn));}
    function nativeMute(value){if(video.muted===value)return;internalMute=true;video.muted=value;queueMicrotask(()=>{internalMute=false;});}
    function setMuted(value){desiredMuted=value===true;nativeMute(graph?true:desiredMuted);syncOutput();syncVolumeUI();}
    function isMuted(){return desiredMuted;}
    function syncOutput(){if(output&&context)output.gain.setTargetAtTime(desiredMuted?0:video.volume,context.currentTime,.015);}
    function resetCors(){if(!ownCors)return;originalCors===null?video.removeAttribute('crossorigin'):video.setAttribute('crossorigin',originalCors);ownCors=false;}
    function stop(text){
      if(graph){graph.destroy();graph=null;}
      stream?.getTracks().forEach(track=>track.stop());stream=null;output=null;
      nativeMute(desiredMuted);
      if(text)report(text);
    }
    function prepareSource(){
      if(reloadErrorHandler&&video.onerror===reloadErrorHandler.wrapper)video.onerror=reloadErrorHandler.previous;
      reloadErrorHandler=null;
      generation++;pending=false;ownReload=false;failedSource='';
      stop(model.active(settings)?'Preparing this channel’s audio…':'Original sound');resetCors();
    }
    function source(){return video.currentSrc||video.src||'';}
    function still(token,url){return token===generation&&url===source()&&model.active(settings)&&!nativeOnly;}
    function metadata(){return new Promise((resolve,reject)=>{
      let timer;
      function done(error){clearTimeout(timer);video.removeEventListener('loadedmetadata',ready);video.removeEventListener('error',errorEvent);error?reject(error):resolve();}
      const ready=()=>done(),errorEvent=()=>done(Error('The channel did not reconnect.'));
      video.addEventListener('loadedmetadata',ready,{once:true});video.addEventListener('error',errorEvent,{once:true});
      timer=setTimeout(()=>done(Error('The channel took too long to reconnect.')),15000);video.load();
    });}
    async function reloadAt(url,time,paused,cors,token){
      ownReload=true;
      const suppressed={previous:video.onerror,wrapper:()=>{}};
      reloadErrorHandler=suppressed;video.onerror=suppressed.wrapper;
      if(cors){video.crossOrigin='anonymous';ownCors=originalCors!=='anonymous';}else resetCors();
      try{await metadata();if(token!==generation||url!==source())return false;
        if(Number.isFinite(time))video.currentTime=Math.min(time,Number.isFinite(video.duration)?Math.max(0,video.duration-.01):time);
        if(!paused)await video.play().catch(()=>{});
        return true;
      }finally{
        if(video.onerror===suppressed.wrapper)video.onerror=suppressed.previous;
        if(reloadErrorHandler===suppressed)reloadErrorHandler=null;
        if(token===generation)ownReload=false;
      }
    }
    function ensureContext(){
      if(!context){const Constructor=window.AudioContext||window.webkitAudioContext;if(!Constructor)throw Error('This browser does not support TV audio effects.');context=new Constructor({latencyHint:'interactive'});}
      // Called directly by a user gesture where possible, before any network await.
      if(context.state==='suspended')context.resume().catch(()=>{});
      return context;
    }
    async function attach(){
      if(!model.active(settings)){stop('Original sound');return;}
      if(nativeOnly){stop('Original sound in the native player. Effects resume when you return.');return;}
      if(graph){graph.apply(settings);syncOutput();return;}
      const url=source();if(!url||video.readyState<1||video.paused){report('Effects will start when the TV plays.');return;}
      if(pending||failedSource===url)return;
      const capture=video.captureStream||video.mozCaptureStream;
      if(!capture||!window.AudioWorkletNode){report('Original sound — this browser does not support these TV effects.');return;}
      pending=true;const token=generation;let time=video.currentTime,paused=video.paused;
      let reloaded=false;
      try{
        const ctx=ensureContext();
        if(!ctx.audioWorklet)throw Error('This browser does not support the audio worklet.');
        const response=await fetch(url,{method:'HEAD',mode:'cors',credentials:'omit',signal:AbortSignal.timeout(10000)});
        if(!response.ok||response.type==='opaque')throw Error('This channel does not allow audio effects.');
        if(!still(token,url))return;
        if(video.paused){report('Effects will start when the TV plays.');return;}
        if(video.crossOrigin!=='anonymous'){
          // HEAD can take several seconds. Respect playback/seek/pause changes
          // made during that check instead of restoring its stale starting state.
          time=video.currentTime;paused=video.paused;
          report('Reconnecting the channel for optional audio effects…');
          reloaded=true;
          if(!await reloadAt(url,time,paused,true,token)||!still(token,url))return;
        }
        if(!workletReady){await ctx.audioWorklet.addModule(workletURL);workletReady=true;}
        if(!still(token,url))return;
        if(ctx.state!=='running'){report('Original sound — tap a sound control to start effects.');return;}
        const captured=capture.call(video),tracks=captured.getAudioTracks();
        if(!tracks.length){captured.getTracks().forEach(t=>t.stop());throw Error('No audio track is available for effects.');}
        if(tracks.some(t=>t.muted||t.readyState!=='live')){captured.getTracks().forEach(t=>t.stop());throw Error('This channel’s audio cannot be processed.');}
        const denoiser=new AudioWorkletNode(ctx,'rabbit-tape-denoiser',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit'});
        const guard=ctx.createGain();guard.gain.value=0;
        // A MediaStreamSource never permanently takes ownership of the live video.
        const input=ctx.createMediaStreamSource(new MediaStream(tracks));
        const next=window.RabbitAudioGraph(ctx,input,model,denoiser,guard);
        if(!still(token,url)){next.destroy();captured.getTracks().forEach(t=>t.stop());return;}
        stream=captured;output=guard;graph=next;graph.apply(settings,true);
        nativeMute(true);syncOutput();
        for(const track of tracks){
          track.addEventListener('ended',()=>{if(stream===captured){stop('Original sound — the audio source changed.');failedSource=url;}},{once:true});
          track.addEventListener('mute',()=>{if(stream===captured&&!video.paused&&video.readyState>=3){stop('Original sound — this stream stopped allowing effects.');failedSource=url;}});
        }
        report('TV audio effects are on. Radio remains original.');
      }catch(error){
        if(token!==generation)return;
        stop('Original sound — '+(error.message||'Audio effects are unavailable.'));failedSource=url;
        // A successful HEAD is not a guarantee for the real GET/Range response.
        // Undo our CORS transport and reload native playback before giving up.
        if(reloaded&&ownCors){try{await reloadAt(url,time,paused,false,token);}catch{report('Original sound restored. Use the player to retry this channel.');}}
      }finally{if(token===generation)pending=false;}
    }
    function update(){
      settings=model.settings(settings);render();
      if(graph&&model.active(settings)){graph.apply(settings);report('TV audio effects are on. Radio remains original.');}
      else if(!model.active(settings))stop('Original sound');
      else{failedSource='';attach();}
    }
    function save(changes){settings=model.settings({...settings,...changes});store.set('re_audio',settings);update();}
    function row(label,input,format,group=container){
      const element=make('label','audio-setting'),name=make('span','',label),out=make('output');
      element.append(name,input);if(format)element.append(out);group.append(element);return out;
    }
    function slider(label,key,min,max,step,format,group=container){
      const input=make('input');input.type='range';Object.assign(input,{min,max,step});input.setAttribute('aria-label',label);
      const out=row(label,input,format,group);input.addEventListener('input',()=>save({[key]:Number(input.value)}));controls.push(()=>{input.value=settings[key];out.value=format(settings[key]);});return input;
    }
    function toggle(label,key,group=container){const input=make('input');input.type='checkbox';row(label,input,null,group);input.addEventListener('change',()=>save({[key]:input.checked}));controls.push(()=>{input.checked=settings[key];});return input;}
    function group(name){const field=make('fieldset','audio-group');field.append(make('legend','',name));container.append(field);return field;}
    const levels=group('Listening level');
    const tvVolume=make('input');Object.assign(tvVolume,{type:'range',min:0,max:1,step:.01});tvVolume.setAttribute('aria-label','TV volume');const tvOut=row('TV volume',tvVolume,n=>n,levels);
    tvVolume.addEventListener('input',()=>{if(typeof window.setTvVolume==='function')window.setTvVolume(Number(tvVolume.value));else{video.volume=Number(tvVolume.value);store.set('re_tv_volume',video.volume);setMuted(video.volume===0);}syncVolumeUI();});
    const tvMute=make('input');tvMute.type='checkbox';row('Mute TV',tvMute,null,levels);tvMute.addEventListener('change',()=>{if(typeof window.setMuted==='function')window.setMuted(tvMute.checked);else{setMuted(tvMute.checked);store.set('re_tv_muted',tvMute.checked);}});
    const radioVolume=make('input');Object.assign(radioVolume,{type:'range',min:0,max:1,step:.01});radioVolume.setAttribute('aria-label','Radio volume');const radioOut=row('Radio volume',radioVolume,n=>n,levels);
    radioVolume.addEventListener('input',()=>{radio.volume=Number(radioVolume.value);store.set('re_vol',radio.volume);const existing=document.getElementById('rVol');if(existing)existing.value=radio.volume;syncVolumeUI();});
    function syncVolumeUI(){tvVolume.value=video.volume;tvOut.value=Math.round(video.volume*100)+'%';tvMute.checked=desiredMuted;radioVolume.value=radio.volume;radioOut.value=Math.round(radio.volume*100)+'%';}
    const presets=group('TV sound');
    toggle('Enable TV audio effects','enabled',presets);
    const select=make('select','audio-presets');select.setAttribute('aria-label','TV sound preset');
    for(const preset of model.PRESETS){const option=make('option','',preset.name);option.value=preset.id;select.append(option);}
    const custom=make('option','','Custom settings');custom.value='custom';select.append(custom);
    row('Sound preset',select,null,presets);const description=make('p','settings-note');presets.append(description);
    select.addEventListener('change',()=>{const preset=model.PRESETS.find(p=>p.id===select.value);if(preset){settings=model.settings(preset.settings);store.set('re_audio',settings);update();}});
    container.append(status);
    const cleanup=group('Tape cleanup');
    slider('Reduce steady tape hiss','denoise',0,100,1,n=>Math.round(n)+'%',cleanup);
    cleanup.append(make('p','settings-note','A gentle spectral denoiser for steady hiss. Higher amounts can soften detail.'));
    toggle('Smooth changing loudness','normalize',cleanup);
    cleanup.append(make('p','settings-note','RMS leveling steadies shows and commercials. Quiet pauses do not raise the noise floor.'));
    const dynamics=group('Compression');
    toggle('Narrow loud and quiet differences','compression',dynamics);
    slider('Compression amount','amount',0,100,1,n=>Math.round(n)+'%',dynamics);
    toggle('Link makeup gain to amount','linked',dynamics);
    const makeup=slider('Makeup gain','makeup',-12,18,.1,n=>(n>0?'+':'')+n.toFixed(1)+' dB',dynamics);
    const position=make('select');position.setAttribute('aria-label','Compression position');for(const[value,label]of[['pre','Before equalizer'],['post','After equalizer']]){const o=make('option','',label);o.value=value;position.append(o);}row('Compression position',position,null,dynamics);position.addEventListener('change',()=>save({position:position.value}));controls.push(()=>{position.value=settings.position;makeup.disabled=settings.linked;});
    const equalizer=group('10-band equalizer');toggle('Enable equalizer','eq',equalizer);
    const bands=make('div','audio-bands');equalizer.append(bands);
    model.BANDS.forEach((frequency,index)=>{const label=make('label','audio-band'),name=make('span','',frequency<1000?frequency+' Hz':frequency/1000+' kHz'),input=make('input'),out=make('output');Object.assign(input,{type:'range',min:-12,max:12,step:.5});input.setAttribute('aria-label',name.textContent+' equalizer gain');input.addEventListener('input',()=>{const next=settings.bands.slice();next[index]=Number(input.value);save({bands:next});});label.append(name,input,out);bands.append(label);controls.push(()=>{input.value=settings.bands[index];out.value=(settings.bands[index]>0?'+':'')+settings.bands[index]+' dB';input.disabled=!settings.eq;});});
    equalizer.append(make('p','settings-note','Each band adjusts −12 to +12 dB. Output limiting and EQ headroom help prevent overload.'));
    function render(){for(const fn of controls)fn();const preset=model.PRESETS.find(p=>JSON.stringify(p.settings)===JSON.stringify(settings));select.value=preset?.id||'custom';description.textContent=preset?.description||'Your own combination of TV sound adjustments.';syncVolumeUI();}
    function applyPreferences(prefs){if(prefs?.re_audio)settings=model.settings(prefs.re_audio);if(typeof prefs?.re_tv_muted==='boolean')setMuted(prefs.re_tv_muted);update();}
    listen(video,'volumechange',()=>{if(!internalMute&&graph&&video.muted===false){desiredMuted=false;nativeMute(true);}else if(!graph)desiredMuted=video.muted;syncOutput();syncVolumeUI();});
    listen(radio,'volumechange',syncVolumeUI);
    listen(video,'playing',()=>{if(!ownReload)attach();});
    listen(video,'loadedmetadata',()=>{if(!ownReload)attach();});
    listen(video,'loadstart',()=>{if(!ownReload){generation++;pending=false;failedSource='';stop(model.active(settings)?'Preparing this channel’s audio…':'Original sound');}});
    listen(video,'enterpictureinpicture',()=>{nativeOnly=true;stop('Original sound in picture-in-picture.');});
    listen(video,'leavepictureinpicture',()=>{nativeOnly=false;attach();});
    listen(video,'webkitbeginfullscreen',()=>{nativeOnly=true;stop('Original sound in the native player.');});
    listen(video,'webkitendfullscreen',()=>{nativeOnly=false;attach();});
    const gesture=()=>{if(model.active(settings)){try{ensureContext();}catch{}if(!pending){failedSource='';attach();}}};
    listen(document,'pointerdown',gesture);listen(document,'keydown',gesture);
    const meter=setInterval(()=>{if(graph){graph.meter(1,.05);syncOutput();}},50);
    function destroy(){generation++;stop();clearInterval(meter);cleanups.forEach(fn=>fn());context?.close().catch(()=>{});}
    listen(window,'pagehide',destroy);
    render();report('Original sound');if(model.active(settings))attach();
    return{applyPreferences,prepareSource,setMuted,isMuted,destroy};
  }
  return{create};
})();
