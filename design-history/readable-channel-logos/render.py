from pathlib import Path
from PIL import Image,ImageDraw
import json,html
R=Path(__file__).resolve().parents[2];A=R/'assets/channel-logos/pixel'
src=(R/'design-history/pixel-channel-logos-16bit/build_review.py').read_text(encoding='utf8');exec(src[src.index('FONT={'):src.index('def render')])
manifest=json.loads((R/'assets/channel-logos/manifest.json').read_text(encoding='utf8'));specs=json.loads((R/'design-history/pixel-channel-logos-16bit/manifest.json').read_text(encoding='utf8'))['channels'];specs.append(json.loads((A/'42-midnight-mirage-source.json').read_text(encoding='utf8')))
def save(im,p,title):
 im.resize((1024,1024),Image.Resampling.NEAREST).save(p.with_suffix('.png'),optimize=True)
 px=im.load();rects=[]
 for y in range(128):
  x=0
  while x<128:
   c=px[x,y]
   if not c[3]:x+=1;continue
   end=x+1
   while end<128 and px[end,y]==c:end+=1
   rects.append(f'<rect x="{x}" y="{y}" width="{end-x}" height="1" fill="#{c[0]:02x}{c[1]:02x}{c[2]:02x}"/>');x=end
 p.with_suffix('.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 128 128" shape-rendering="crispEdges"><title>{html.escape(title)}</title>'+''.join(rects)+'</svg>',encoding='utf8')
records=[]
for s in specs:
 f=A/Path(manifest[s['name']].get('srcLight',manifest[s['name']]['src']).split('?')[0]).name;im=Image.open(f.with_suffix('.png')).convert('RGBA').resize((128,128),Image.Resampling.NEAREST);art=im.copy();ImageDraw.Draw(art).rectangle((0,88,127,127),fill=(0,0,0,0))
 for variant,color in [('light','#18212D'),('dark','#FFF1D1')]:
  out=art.copy();d=ImageDraw.Draw(out)
  for i,line in enumerate(s['lines']):
   scale=2 if len(s['lines'])==2 else min(4,118//max(1,textwidth(line,1)));y=92+18*i if len(s['lines'])==2 else 123-7*scale;x=(128-textwidth(line,scale))//2
   for ch in line:
    if ch==' ':x+=4*scale;continue
    for yy,row in enumerate(FONT[ch]):
     for xx,v in enumerate(row):
      if v=='1':d.rectangle((x+xx*scale,y+yy*scale,x+(xx+1)*scale-1,y+(yy+1)*scale-1),fill=color)
    x+=6*scale
  assert out.crop((0,0,128,88)).tobytes()==im.crop((0,0,128,88)).tobytes()
  save(out,f if variant=='light' else f.with_stem(f.stem+'-dark'),s['name'])
 manifest[s['name']]['srcLight']=str(f.relative_to(R)).replace('\\','/')+'?v=solid-1'
 manifest[s['name']]['srcDark']=str(f.with_stem(f.stem+'-dark').relative_to(R)).replace('\\','/')+'?v=solid-1'
 manifest[s['name']]['src']=manifest[s['name']]['srcDark']
 records.append({'no':s['no'],'name':s['name'],'canvasUnchanged':[1024,1024],'iconPixelsUnchanged':True,'label':'Solid pixel lettering; ink on light skins, cream on dark skins; no text outlines or background plate.'})
(R/'assets/channel-logos/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
(R/'docs/channel-logo-readability.json').write_text(json.dumps({'channels':len(records),'nativeGrid':[128,128],'logos':records},indent=2)+'\n',encoding='utf8')
print('Updated77 same-size logos, with dark and light solid-letter variants; icon pixels unchanged.')
