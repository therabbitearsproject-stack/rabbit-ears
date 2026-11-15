/* Interface text only. Media, caption dialogue, programme titles and user posts stay intact. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory;
 else{
  const start=()=>{if(root.RabbitI18n)return;let language=root.RabbitLocale?.resolve()||'en';try{if(!root.RabbitLocale)language=JSON.parse(localStorage.getItem('re_caption_language'))||'en';}catch{}
   root.RabbitI18n=factory({window:root,document:root.document,dictionaries:root.RabbitTranslations||{},language});
  };if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 }
})(typeof window==='object'?window:globalThis,function createInterfaceLanguage({window,document,dictionaries={},language='en'}={}){
 const languages=['en','zh','hi','es','ar','fr','bn','pt','id','ur'];
 if(!languages.includes(language))language='en';
 const textRecords=new WeakMap(),attributeRecords=new WeakMap(),indexes=new Map();
 const excluded='script,style,code,pre,textarea,input,[contenteditable],#captionLanguage option:not([value=auto]),.caption-layer,#rabbit-ears-desktop-caption-overlay,.community-text,.community-name,.community-author,.community-entry-text,.community-comment p,.comment-meta strong,.community-marker,.floating-comment,[data-content-title],[data-user-content],.binding-chip,.reaction-burst,.landing-title,.fullscreen-title,.schedule-title,#title,.programme-title,.guide b,.station-name,#rName,.game-title,.game-name';
 const attributes=['title','aria-label','placeholder'];
 let observer=null,queued=false,active=true;const pending=new Set();
 function text(source,target=language){
  if(typeof source!=='string'||target==='en')return source;
  const dictionary=dictionaries[target];if(!dictionary)return source;
  const key=source.replace(/\s+/g,' ').trim();if(!key)return source;
  if(/^(?:https?:\/\/|[\w.+-]+@)|^rabbit-ears\.stream(?: desktop)?$/i.test(key))return source;
  let index=indexes.get(target);
  if(!index){const lower=new Map(Object.entries(dictionary).map(([k,v])=>[k.toLowerCase(),v]));
   const keys=Object.keys(dictionary).filter(k=>k.length>=3&&!/^\d+$/.test(k)).sort((a,b)=>b.length-a.length);
   const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   index={lower,pattern:keys.length?new RegExp('(?<![A-Za-z])(?:'+keys.map(escape).join('|')+')(?![A-Za-z])','gi'):null};indexes.set(target,index);
  }
  const translated=(Object.hasOwn(dictionary,key)?dictionary[key]:undefined)||index.lower.get(key.toLowerCase())||(index.pattern?key.replace(index.pattern,match=>index.lower.get(match.toLowerCase())||match):key);
  return source.match(/^\s*/)[0]+translated+source.match(/\s*$/)[0];
 }
 function eligible(element){return element&&!element.closest(excluded)&&!element.closest('img,svg,canvas,video,audio');}
 function translateNode(node){
  const parent=node.parentElement;if(!eligible(parent))return;
  const value=node.nodeValue;if(!value?.trim())return;
  let record=textRecords.get(node);if(!record||value!==record.translated){record={source:value,translated:value};textRecords.set(node,record);}
  const next=text(record.source);record.translated=next;if(node.nodeValue!==next)node.nodeValue=next;
 }
 function translateAttributes(element){
  if((!eligible(element)&&!element.matches('input,textarea'))||element.tagName==='OPTION'&&element.closest('#captionLanguage'))return;
  let records=attributeRecords.get(element);if(!records){records=new Map();attributeRecords.set(element,records);}
  for(const attribute of attributes){const value=element.getAttribute(attribute);if(!value)continue;
   let record=records.get(attribute);if(!record||value!==record.translated){record={source:value,translated:value};records.set(attribute,record);element.setAttribute('data-i18n-source-'+attribute,value);}
   const next=text(record.source);record.translated=next;if(value!==next)element.setAttribute(attribute,next);
  }
 }
 function transport(){
  const labels={down:'CH −',up:'CH +',surf:'SURF',back:'REPLAY',pause:'PAUSE',fwd:'SKIP',mute:'VOLUME',cc:'CAPTIONS',full:'SCREEN',popoutTv:'POP OUT',communityComment:'COMMENT',communityReact:'REACT'};
  for(const button of document.querySelectorAll('#tvView .tv-transport button')){
   let label=labels[button.id];if(button.id==='pause'&&button.dataset.icon==='play')label='Play';
   if(button.getAttribute('popovertarget')==='comment-popover')label='COMMENT';
   if(button.getAttribute('popovertarget')==='emoji-popover')label='REACT';
   if(button.id==='popoutTv'&&document.body.classList.contains('desktop-compact'))label='Return';
   if(!label&&button.querySelector('[data-icon="heart"]'))label='React';
   if(label){const value=text(label);if(button.dataset.uiLabel!==value)button.dataset.uiLabel=value;}
  }
 }
 function scan(root){
  if(root.nodeType===3){translateNode(root);return;}
  if(root.nodeType!==1)return;
  const walker=document.createTreeWalker(root,4);let node;while((node=walker.nextNode()))translateNode(node);
  translateAttributes(root);root.querySelectorAll('[title],[aria-label],[placeholder]').forEach(translateAttributes);
 }
 function observe(){
  observer?.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:[...attributes,'data-icon']});
 }
 function apply(){
  if(!document?.body||!active)return;observer?.disconnect();pending.clear();
  document.documentElement.lang=language;document.documentElement.dir=['ar','ur'].includes(language)?'rtl':'ltr';document.body.dataset.uiLanguage=language;
  scan(document.body);transport();observe();
 }
 function schedule(records){
  for(const record of records){const element=record.target.nodeType===3?record.target.parentElement:record.target;if(!eligible(element))continue;if(record.type==='childList')record.addedNodes.forEach(node=>pending.add(node));else pending.add(record.target);}
  if(!queued&&pending.size){queued=true;window.queueMicrotask(()=>{queued=false;if(!active)return;observer.disconnect();for(const node of pending)scan(node);pending.clear();transport();observe();});}
 }
 function setLanguage(value){if(!languages.includes(value))return;const changed=language!==value;language=value;apply();if(changed)window?.dispatchEvent(new window.CustomEvent('re:language-changed',{detail:value}));}
 if(document&&window){
  const style=document.createElement('style');style.textContent='body[data-ui-language] #tvView .tv-transport [data-ui-label]::after{content:attr(data-ui-label)!important;white-space:normal;max-width:100%;overflow-wrap:anywhere}html[dir=rtl] :is(.cabinet,.tv-transport,#bands,.equalizer,.site-wordmark){direction:ltr}html[dir=rtl] .settings-section{text-align:right}';document.head.append(style);
  observer=new window.MutationObserver(schedule);window.addEventListener('re:caption-language',event=>setLanguage(event.detail));apply();
 }
 return {text,setLanguage,apply,get language(){return language;},stop(){active=false;observer?.disconnect();}};
});
