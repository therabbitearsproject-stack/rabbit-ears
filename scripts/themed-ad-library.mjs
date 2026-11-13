const TOPICS={
 toys:/nintendo|sega|atari|sonic|disney|hercules|fantasia|turtles|tmnt|transformers|he.man|barbie|lego|\btoys?\b|kellogg|cereal|mr.?bubble/i,
 games:/nintendo|sega|atari|sonic|commodore|playstation|game.?boy|video games?|star.trek.*games/i,
 computers:/commodore|amiga|ibm|apple|macintosh|windows|microsoft|computer|pc world|intel|tandy/i,
 cars:/toyota|hyundai|nissan|\bford\b|chevrolet|honda|volkswagen|pontiac|dodge|goodyear|motor|\bcars?\b/i,
 kitchen:/pasta|sauce|green giant|hidden valley|birds.?eye|kitchen|cooker|blender|food|dunkin|burger|mcdonald|rally|cereal/i,
 music:/music|album|records?|guitar|cassette|stereo|ipod|sony|alicia keys/i,
 sports:/nike|adidas|gatorade|reebok|sport|basketball|football|baseball|hockey/i,
 holiday:/christmas|xmas|santa|holiday/i,
 home:/target|gap advert|montgomery|currys|comet|ward|furniture|house|home|sears|store/i,
 space:/star.trek|inside space|planet of the apes|sci.?fi/i,
 outdoors:/camera|kodak|polaroid|travel|twa|safari|outdoor|camping/i,
};
export const topicsFor=media=>Object.entries(TOPICS).filter(([key,re])=>re.test(media.title+' '+media.id)&&!(key==='kitchen'&&/cat food|dog food|pet food|whiskas|9 lives/i.test(media.title))).map(([key])=>key);
export function adThemes(ch){
 const n=ch.name;
 if(n==='Midnight Mirage')return []; // Dedicated, dated movie-TV-spots library only.
 if(/Ad Break|AMV Hour|Slow TV|Silent Screen|Home Movies|Ephemera|Duck & Cover|Order Now/.test(n))return [];
 if(/Computer Chronicles/.test(n))return ['computers','games'];
 if(/Arcade/.test(n))return ['games','computers'];
 if(/Gridiron|Rink Side|Hoops|Ballpark|Ringside|Sweatin'/.test(n))return ['sports'];
 if(/Pit Lane/.test(n))return ['cars'];
 if(/TV Dinner/.test(n))return ['kitchen'];
 if(/Christmas/.test(n))return ['holiday'];
 if(/Jazz Club|Headbangers|Video Jukebox|Soul Train|Encore|Showstoppers/.test(n))return ['music'];
 if(/Wild Kingdom|Skate & Surf/.test(n))return ['outdoors','sports'];
 if(/Mission Control|Starbase|Hyperdrive|Deep Space|Atomic Age|World of Tomorrow/.test(n))return ['space','computers'];
 if(/Toon|Anime|Scooby|Kids|School|Puppet|Caped|Kaiju|Mecha|Magical|Power Level|OVA/.test(n))return ['toys','games'];
 if(/PBS|Paint Along/.test(n))return ['home','kitchen'];
 return ['home'];
}
export function channelAdPools(channels,media){
 const result={};
 for(const ch of channels){const themes=adThemes(ch);result[ch.no]=media.filter(m=>themes.some(t=>(m.topics||topicsFor(m)).includes(t)));}
 return result;
}
export function mergeAds(catalog,extra=[]){
 const all=[...(catalog.commercials||[]).map(r=>({id:r[0],file:r[1],dur:r[2],title:r[3],year:Number(r[4]),archiveId:r[6]||r[0],role:'archival-commercial'})),...Object.values(catalog.breakLibraries||{}).flatMap(l=>(l.commercials||[]).filter(m=>m.role?.includes('commercial')||m.role==='recorded-advertiser-spot')),...extra];
 const seen=new Set();return all.filter(m=>{const k=(m.archiveId||m.id)+'|'+m.file;if(seen.has(k)||!m.year||m.dur<8||m.dur>90)return false;seen.add(k);return true;}).map(m=>({...m,topics:topicsFor(m)}));
}
