from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib.pagesizes import A4,landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader
import json,hashlib,html,zipfile,shutil,textwrap
W=Path(__file__).parent
REPO=Path(r'C:/Users/deato/.codex/.chatgpt-projects/g-p-6aaddcb538908191a977bf670679d469/work/rabbit-ears')
OUT=Path(r'C:/Users/deato/Documents/Codex/2026-11-09/loo/outputs')
ART=OUT/'rabbit-ears-pixel-channel-logos'
for d in [ART/'png',ART/'svg',W/'proofs'] :d.mkdir(parents=True,exist_ok=True)
channels=json.loads((REPO/'community/channels.json').read_text(encoding='utf8'))
old=json.loads((REPO/'assets/channel-logos/manifest.json').read_text(encoding='utf8'))
specs=[]
for name in ['tv-kids.json','film-anime.json','sport-music-culture.json','space.json']:specs+=json.loads((W/name).read_text(encoding='utf-8-sig'))
specs.sort(key=lambda a:a['no'])
assert len(specs)==76 and [(s['no'],s['name'])for s in specs]==[(c['no'],c['name'])for c in channels]
FONT={
'A':['01110','10001','10001','11111','10001','10001','10001'],'B':['11110','10001','10001','11110','10001','10001','11110'],
'C':['01111','10000','10000','10000','10000','10000','01111'],'D':['11110','10001','10001','10001','10001','10001','11110'],
'E':['11111','10000','10000','11110','10000','10000','11111'],'F':['11111','10000','10000','11110','10000','10000','10000'],
'G':['01111','10000','10000','10111','10001','10001','01110'],'H':['10001','10001','10001','11111','10001','10001','10001'],
'I':['11111','00100','00100','00100','00100','00100','11111'],'J':['00111','00010','00010','00010','10010','10010','01100'],
'K':['10001','10010','10100','11000','10100','10010','10001'],'L':['10000','10000','10000','10000','10000','10000','11111'],
'M':['10001','11011','10101','10101','10001','10001','10001'],'N':['10001','11001','10101','10011','10001','10001','10001'],
'O':['01110','10001','10001','10001','10001','10001','01110'],'P':['11110','10001','10001','11110','10000','10000','10000'],
'Q':['01110','10001','10001','10001','10101','10010','01101'],'R':['11110','10001','10001','11110','10100','10010','10001'],
'S':['01111','10000','10000','01110','00001','00001','11110'],'T':['11111','00100','00100','00100','00100','00100','00100'],
'U':['10001','10001','10001','10001','10001','10001','01110'],'V':['10001','10001','10001','10001','10001','01010','00100'],
'W':['10001','10001','10001','10101','10101','11011','10001'],'X':['10001','10001','01010','00100','01010','10001','10001'],
'Y':['10001','10001','01010','00100','00100','00100','00100'],'Z':['11111','00001','00010','00100','01000','10000','11111'],
'0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],
'2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],
'4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],
'6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],
'8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
'&':['01100','10010','10100','01000','10101','10010','01101'],"'":['00100','00100','01000','00000','00000','00000','00000'],
'-':['00000','00000','00000','11111','00000','00000','00000'],'.':['00000','00000','00000','00000','00000','00110','00110']}
K='#18212D';C='#FFF1D1'
def textwidth(t,s):return (sum(4 if c==' ' else 6 for c in t)-1)*s

def render(s):
 pal={'K':K,'D':'#101725','C':C,'W':'#FFFFFF',**s['colors']}
 sprite=Image.new('RGBA',(48,40));d=ImageDraw.Draw(sprite)
 for op in s['ops']:
  typ=op[0]
  if typ in ['rect','ellipse']:
   _,x,y,w,h,col=op
   assert all(isinstance(v,int)for v in[x,y,w,h]) and w>0 and h>0 and x>=0 and y>=0 and x+w<=48 and y+h<=40,(s['name'],op)
   getattr(d,'rectangle'if typ=='rect'else'ellipse')((x,y,x+w-1,y+h-1),fill=pal[col])
  elif typ in ['poly','line']:
   pts,col=op[1:3];assert all(isinstance(v,int)and 0<=v<(48 if i==0 else 40)for p in pts for i,v in enumerate(p)),(s['name'],op)
   if typ=='poly':d.polygon([tuple(p)for p in pts],fill=pal[col])
   else:d.line([tuple(p)for p in pts],fill=pal[col],width=op[3])
  else:raise ValueError(op)
 spritehash=hashlib.sha256(sprite.tobytes()).hexdigest()
 im=Image.new('RGBA',(128,128));im.alpha_composite(sprite.resize((96,80),Image.Resampling.NEAREST),(16,4))
 mask=Image.new('L',(128,128));draw=ImageDraw.Draw(mask)
 lines=s['lines'];assert 1<=len(lines)<=2 and all(len(t)<=10 for t in lines)
 for i,line in enumerate(lines):
  scale=2 if len(lines)==2 else min(4,118//max(1,textwidth(line,1)))
  assert scale>=2 and textwidth(line,scale)<=118,(s['name'],line)
  y=(92+18*i)if len(lines)==2 else 123-7*scale
  x=(128-textwidth(line,scale))//2
  for ch in line:
   if ch==' ':x+=4*scale;continue
   assert ch in FONT,(s['name'],ch)
   for yy,row in enumerate(FONT[ch]):
    for xx,p in enumerate(row):
     if p=='1':draw.rectangle((x+xx*scale,y+yy*scale,x+(xx+1)*scale-1,y+(yy+1)*scale-1),fill=255)
   x+=6*scale
 border=Image.new('RGBA',im.size,K);border.putalpha(mask.filter(ImageFilter.MaxFilter(3)));im.alpha_composite(border)
 letters=Image.new('RGBA',im.size,C);letters.putalpha(mask);im.alpha_composite(letters)
 halo=Image.new('RGBA',im.size,C);halo.putalpha(im.getchannel('A').filter(ImageFilter.MaxFilter(3)));halo.alpha_composite(im);im=halo
 assert im.getbbox() and im.getbbox()[0]>=1 and im.getbbox()[1]>=1 and im.getbbox()[2]<=127 and im.getbbox()[3]<=127,(s['name'],im.getbbox())
 colors=im.getcolors(256);assert colors and len(colors)<=16,(s['name'],len(colors)if colors else'>256')
 slug=f"{s['no']:02d}-"+''.join(ch.lower()if ch.isalnum()else'-'for ch in s['name']).strip('-')
 while'--'in slug:slug=slug.replace('--','-')
 im.resize((1024,1024),Image.Resampling.NEAREST).save(ART/'png'/(slug+'.png'),optimize=True)
 # Each rectangle follows the native pixel grid; no font dependency or smoothing.
 rects=[];px=im.load()
 for y in range(128):
  x=0
  while x<128:
   color=px[x,y]
   if color[3]==0:x+=1;continue
   end=x+1
   while end<128 and px[end,y]==color:end+=1
   rects.append(f'<rect x="{x}" y="{y}" width="{end-x}" height="1" fill="#{color[0]:02x}{color[1]:02x}{color[2]:02x}"/>');x=end
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 128 128" shape-rendering="crispEdges"><title>{html.escape(s["name"])} - 16-bit pixel concept</title>'+''.join(rects)+'</svg>'
 (ART/'svg'/(slug+'.svg')).write_text(svg,encoding='utf8')
 return{**s,'slug':slug,'png':f'png/{slug}.png','svg':f'svg/{slug}.svg','nativeGrid':[128,128],'exportSize':[1024,1024],'transparent':True,'colorsUsed':len(colors),'spriteSha256':spritehash,'pngSha256':hashlib.sha256((ART/'png'/(slug+'.png')).read_bytes()).hexdigest(),'currentSource':old[s['name']]['src'],'currentSha256':hashlib.sha256((REPO/old[s['name']]['src']).read_bytes()).hexdigest()}
records=[render(s)for s in specs]
assert len({r['spriteSha256']for r in records})==76,'Duplicate icon artwork'
(ART/'manifest.json').write_text(json.dumps({'style':'16-bit pixel-channel concepts','status':'review-only; live channel logos unchanged','channels':records},indent=2),encoding='utf8')
# Contact sheet for art direction and export QA.
contact=Image.new('RGB',(1024,10*148),(242,236,224));cd=ImageDraw.Draw(contact)
for i,r in enumerate(records):
 x=i%8*128;y=i//8*148
 contact.paste(Image.open(ART/r['png']).resize((120,120),Image.Resampling.NEAREST),(x+4,y+2),Image.open(ART/r['png']).resize((120,120),Image.Resampling.NEAREST))
 cd.text((x+5,y+126),f"{r['no']:02d} {r['name'][:16]}",fill=K)
contact.save(OUT/'rabbit-ears-pixel-logo-preview.png')
# PDF: each old/new pair receives equal-sized transparent-artwork tiles.
for n,f in [('Body','arial.ttf'),('Bold','arialbd.ttf'),('Display','georgia.ttf'),('DisplayBold','georgiab.ttf'),('Mono','consola.ttf')]:pdfmetrics.registerFont(TTFont(n,str(Path('C:/Windows/Fonts')/f)))
PDF=OUT/'rabbit-ears-channel-logos-comparison.pdf';PW,PH=landscape(A4);c=canvas.Canvas(str(PDF),pagesize=(PW,PH),pageCompression=1)
c.setTitle('Rabbit Ears - Current and 16-bit Channel Logos');c.setAuthor('Rabbit Ears');c.setSubject('76 square pixel-logo concepts compared with current production artwork')
BG='#F3EEE3';INK='#252B31';MUTED='#6E716E';RUST='#A4482F';LINE='#CFC5B6'
def color(v):c.setFillColor(v)
def tx(x,y,t,font='Body',size=10,col=INK):color(col);c.setFont(font,size);c.drawString(x,y,t)
def center(x,y,t,font='Body',size=9,col=MUTED):color(col);c.setFont(font,size);c.drawCentredString(x,y,t)
def base(page):
 color(BG);c.rect(0,0,PW,PH,fill=1,stroke=0)
 tx(36,PH-30,'RABBIT EARS / CHANNEL LOGO REVIEW','Mono',9,RUST)
 c.setStrokeColor(LINE);c.setLineWidth(.6);c.line(36,PH-40,PW-36,PH-40)
 tx(36,22,'CURRENT ARTWORK + SQUARE PIXEL CONCEPTS','Mono',7,MUTED);c.setFont('Mono',8);c.drawRightString(PW-36,22,f'{page:02d} / 39')
def tile(im,x,y,size):
 color('#FBFAF6');c.rect(x,y,size,size,fill=1,stroke=0)
 color('#E9E6DF');step=8
 for row in range(int(size//step)+1):
  for col in range(int(size//step)+1):
   if(row+col)%2==0:c.rect(x+col*step,y+row*step,min(step,size-col*step),min(step,size-row*step),fill=1,stroke=0)
 iw,ih=im.size;fit=min((size-12)/iw,(size-12)/ih);c.drawImage(ImageReader(im),x+(size-iw*fit)/2,y+(size-ih*fit)/2,width=iw*fit,height=ih*fit,mask='auto')
 c.setStrokeColor(LINE);c.setLineWidth(.5);c.rect(x,y,size,size,fill=0,stroke=1)
base(1);c.bookmarkPage('cover');c.addOutlineEntry('Overview','cover',0)
tx(36,PH-112,'CHANNEL LOGOS','DisplayBold',42)
tx(38,PH-150,'Current artwork / 16-bit square concepts','Body',19)
tx(38,PH-189,'76 channels. One coordinated pixel-art family.','Bold',12)
tx(38,PH-214,'Every channel follows on the next pages, with its current logo alongside the new option.','Body',10,MUTED)
tx(38,PH-233,'Transparent square artwork, limited palettes and crisp pixel lettering.','Body',10,MUTED)
c.setStrokeColor(LINE);c.line(36,PH-258,PW-36,PH-258)
examples=[2,9,20,37,55,67,83,93]
for i,no in enumerate(examples):
 r=next(r for r in records if r['no']==no);x=36+i*96
 im=Image.open(ART/r['png']);c.drawImage(ImageReader(im),x,120,width=86,height=86,mask='auto');center(x+43,103,f'CH {no:02d}','Mono',8)
tx(38,63,'REVIEW EDITION / NOVEMBER 11, 2026','Mono',8,RUST);tx(38,46,'The live channel logos remain in place. Checkerboard tiles indicate transparency.','Body',8,MUTED);c.showPage()
for i in range(0,76,2):
 page=2+i//2;base(page)
 for k,r in enumerate(records[i:i+2]):
  top=PH-64-k*244
  key=r['slug'];c.bookmarkPage(key);c.addOutlineEntry(f"CH {r['no']:02d} - {r['name']}",key,0)
  tx(36,top-16,f"CH {r['no']:02d}",'Mono',11,RUST);tx(104,top-16,r['name'],'DisplayBold',19)
  left,right,size=139,535,166;y=top-207
  center(left+size/2,top-34,'CURRENT','Mono',8)
  center(right+size/2,top-34,'16-BIT CONCEPT','Mono',8,RUST)
  tile(Image.open(REPO/r['currentSource']).convert('RGBA'),left,y,size)
  tile(Image.open(ART/r['png']).convert('RGBA'),right,y,size)
  description=r['concept'];lines=textwrap.wrap(description,width=64)
  for n,line in enumerate(lines[:2]):center(right+size/2,top-222-n*9,line,'Body',7.5)
  if k==0:c.setStrokeColor(LINE);c.line(36,top-238,PW-36,top-238)
 c.showPage()
c.save()
reader=PdfReader(PDF);assert len(reader.pages)==39
for i in range(38):
 text=reader.pages[i+1].extract_text()
 for r in records[i*2:i*2+2]:assert r['name']in text,(r['name'],i+2)
# The PDF image streams remain un-interpolated so pixels stay deliberate when zoomed.
(ART/'README.txt').write_text('Rabbit Ears - 76 square 16-bit channel-logo concepts\n\nReview assets only; current production logos are unchanged.\nPNG exports:1024x1024, transparent, nearest-neighbor from128x128 native grid.\nSVG masters:integer pixel rectangles, crispEdges; scale without smoothing.\nAll76 channel names/numbers and current source hashes are in manifest.json.\nNew graphics are original code-native pixel artwork with a shared5x7 lettering system; no paid image-generation API was used.\n',encoding='utf8')
shutil.copy2(__file__,ART/'build_review.py')
for name in ['tv-kids.json','film-anime.json','sport-music-culture.json','space.json']:shutil.copy2(W/name,ART/name)
ZIP=OUT/'rabbit-ears-pixel-channel-logos.zip'
with zipfile.ZipFile(ZIP,'w',zipfile.ZIP_DEFLATED)as z:
 for f in ART.rglob('*'):
  if f.is_file():z.write(f,f.relative_to(ART))
summary={'channels':76,'pages':39,'pngSize':[1024,1024],'transparent':True,'allUniqueIcons':True,'pdfBytes':PDF.stat().st_size,'zipBytes':ZIP.stat().st_size,'liveAssetsUnchanged':True}
(OUT/'pixel-channel-logo-validation.json').write_text(json.dumps(summary,indent=2),encoding='utf8');print(json.dumps(summary))


