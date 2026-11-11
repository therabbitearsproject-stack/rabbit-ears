// Retrieve credited CC BY 4.0 masters for local bumper authoring; originals stay out of Git.
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
const dir=resolve(process.argv[2]||'.bumper-music-cache');await mkdir(dir,{recursive:true});
const data=JSON.parse(await readFile(new URL('../assets/channel-bumpers/music-sources.json',import.meta.url),'utf8'));
for(const track of data.tracks){const file=resolve(dir,track.isrc+'.mp3');let bytes;try{bytes=await readFile(file);}catch{}
 if(!bytes||createHash('sha256').update(bytes).digest('hex')!==track.sha256){const r=await fetch(track.source,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Music unavailable: '+track.title);bytes=Buffer.from(await r.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==track.sha256)throw Error('Music master changed: review '+track.title);await writeFile(file,bytes);}
 console.log('Verified '+track.title);
}
