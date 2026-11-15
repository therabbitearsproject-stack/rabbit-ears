/* Extend the existing SVG pixel artwork; localized lettering is baked into pixel rectangles. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.RABBIT_EARS_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'../..');
const manifestFile=path.join(root,'assets/channel-logos/manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'catalog.final.json'),'utf8'));
const languages=['es','fr','pt','zh','hi','ar','bn','id','ur'];
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 const page=await browser.newPage(),proof=[];
 for(const language of languages){
  const folder=path.join(root,'assets/channel-logos/localized',language);fs.mkdirSync(folder,{recursive:true});
  const names=Object.keys(manifest),labels=names.map(name=>catalog[language]?.[name]||name);
  const rendered=await page.evaluate(({labels,language})=>{
   const rtl=['ar','ur'].includes(language),font=language==='zh'?'"Microsoft YaHei",sans-serif':['hi','bn'].includes(language)?'"Nirmala UI",sans-serif':rtl?'Tahoma,Arial,sans-serif':'"Lucida Console",monospace';
   return labels.map(label=>{
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.direction=rtl?'rtl':'ltr';ctx.textAlign='center';ctx.textBaseline='alphabetic';
    const value=['es','fr','pt','id'].includes(language)?label.toLocaleUpperCase(language):label;
    let lines=[],size=24,asc=0,desc=0,lineHeight=0;
    for(;size>=10;size--){ctx.font='bold '+size+'px '+font;const parts=value.includes(' ')?value.split(/\s+/):[...new Intl.Segmenter(language,{granularity:'grapheme'}).segment(value)].map(p=>p.segment);const separator=value.includes(' ')?' ':'';lines=[];let line='';
     for(const part of parts){const next=line?line+separator+part:part;if(line&&ctx.measureText(next).width>120){lines.push(line);line=part;}else line=next;}if(line)lines.push(line);
     asc=Math.ceil(Math.max(...lines.map(t=>ctx.measureText(t).actualBoundingBoxAscent)));desc=Math.ceil(Math.max(...lines.map(t=>ctx.measureText(t).actualBoundingBoxDescent)));lineHeight=asc+desc+2;
     if(lines.length<=3&&lines.length*lineHeight<=38&&lines.every(t=>ctx.measureText(t).width<=120))break;
    }
    const top=89+(38-lines.length*lineHeight)/2;
    lines.forEach((line,i)=>ctx.fillText(line,64,Math.round(top+asc+i*lineHeight)));
    const data=ctx.getImageData(0,0,128,128).data,rects=[];let pixels=0;
    for(let y=88;y<128;y++){let x=0;while(x<128){if(data[(y*128+x)*4+3]<70){x++;continue;}const start=x;while(x<128&&data[(y*128+x)*4+3]>=70){x++;pixels++;}rects.push([start,y,x-start]);}}
    return {rects,fontSize:size,lines,pixels};
   });
  },{labels,language});
  names.forEach((name,i)=>{
   const info=manifest[name],source=info.srcLight||info.src,original=fs.readFileSync(path.join(root,source.split('?')[0]),'utf8');
   const art=[...original.matchAll(/<rect\b[^>]*\/>/g)].map(m=>m[0]).filter(rect=>Number(rect.match(/\by="([\d.]+)"/)[1])<88).join('');
   assert.ok(art&&rendered[i].pixels>10);const stem=String(info.channel).padStart(2,'0');
   const localized={name:labels[i]};
   for(const [variant,color]of [['light','#18212d'],['dark','#fff1d1']]){
    const filename=stem+'-'+variant+'.svg',rects=rendered[i].rects.map(([x,y,width])=>`<rect x="${x}" y="${y}" width="${width}" height="1" fill="${color}"/>`).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 128 128" shape-rendering="crispEdges"><title>${escape(labels[i])}</title>${art}${rects}</svg>`;
    assert.equal([...svg.matchAll(/<rect\b[^>]*\/>/g)].map(m=>m[0]).filter(r=>Number(r.match(/\by="([\d.]+)"/)[1])<88).join(''),art);
    fs.writeFileSync(path.join(folder,filename),svg);localized[variant==='light'?'srcLight':'srcDark']='assets/channel-logos/localized/'+language+'/'+filename+'?v=1';
   }
   info.localized??={};info.localized[language]=localized;proof.push({channel:info.channel,language,name:labels[i],fontSize:rendered[i].fontSize,lines:rendered[i].lines,artUnchanged:true});
  });console.log('Built '+names.length+' square logos in '+language+' with light/dark lettering.');
 }
 fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(__dirname,'logo-proof.json'),JSON.stringify(proof,null,2));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
