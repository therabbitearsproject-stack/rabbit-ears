/* Automatic language uses device preferences, then a coarse country fallback. No GPS. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports){module.exports=api;return;}
 let regional='en';const read=key=>{try{return JSON.parse(root.localStorage.getItem(key));}catch{return undefined;}};
 const device=api.device(root.navigator.languages?.length?root.navigator.languages:[root.navigator.language]);
 root.RabbitLocale={resolve(){const stored=read('re_caption_language'),mode=read('re_language_mode');return api.supported.includes(stored)&&(mode==='manual'||mode===undefined)?stored:device||regional;}};
 if(!device)root.fetch('https://community.rabbit-ears.stream/api/locale',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(5000)}).then(response=>response.ok?response.json():null).then(value=>{
  if(!api.supported.includes(value?.language))return;regional=value.language;
  if(read('re_language_mode')!=='manual')root.dispatchEvent(new CustomEvent('re:auto-language',{detail:root.RabbitLocale.resolve()}));
 }).catch(()=>{});
})(typeof window==='object'?window:globalThis,function(){
 const supported=['en','zh','hi','es','ar','fr','bn','pt','id','ur'];
 return {supported,device(values){for(const value of values||[]){const code=String(value||'').toLowerCase().split(/[-_]/)[0];if(supported.includes(code))return code;}return null;}};
});
