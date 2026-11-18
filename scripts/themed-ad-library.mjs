const TOPICS={
 toys:/nintendo|sega|atari|sonic|disney|hercules|fantasia|turtles|tmnt|transformers|he.man|barbie|lego|\btoys?\b|kellogg|cereal|mr.?bubble/i,
 games:/nintendo|sega|atari|sonic|commodore|playstation|game.?boy|video games?|star.trek.*games/i,
 computers:/commodore|amiga|ibm|apple|macintosh|windows|microsoft|computer|pc world|intel|tandy/i,
 cars:/toyota|hyundai|nissan|\bford\b|chevrolet|honda|volkswagen|pontiac|dodge|goodyear|motor|\bcars?\b/i,
 kitchen:/pasta|sauce|green giant|hidden valley|birds.?eye|kitchen|cooker|blender|food|dunkin|burger|mcdonald|rally|cereal/i,
 music:/music|album|records?|guitar|cassette|stereo|ipod|walkman|discman|headphones|sony.store|alicia keys/i,
 sports:/nike|adidas|gatorade|reebok|sport|basketball|football|baseball|hockey/i,
 holiday:/christmas|xmas|santa|holiday/i,
 home:/target|gap advert|montgomery|currys|comet|ward|furniture|house|home|sears|store/i,
 space:/star.trek|star.wars|inside space|planet of the apes|sci.?fi|alien.nation|space.invaders|space.food|star.voyager|shuttle/i,
 outdoors:/camera|kodak|polaroid|travel|twa|safari|outdoor|camping/i,
 movies:/movie|cinema|film|\bvhs\b|star.trek|star.wars|alien.nation/i,
 books:/\bbooks?\b|reading|encyclopedia|library/i,
};
const audioGear=/headphones|stereo|walkman|discman|cassette|hi.?fi|audio|sony.store|records?.club|records?.coupon/i;
const console=/playstation|nintendo|game.?boy|video.game|\bsega\b|\batari\b/i;
export const topicsFor=media=>Object.entries(TOPICS).filter(([key,re])=>re.test(media.title+' '+media.id)&&!(key==='kitchen'&&/cat food|dog food|pet food|whiskas|9 lives/i.test(media.title))&&!(key==='music'&&console.test(media.title)&&!audioGear.test(media.title))).map(([key])=>key);
export function musicGenresFor(media){
 const title=media.title+' '+media.id;
 const genres=new Set(Array.isArray(media.musicGenres)?media.musicGenres:[]);
 if(audioGear.test(title))genres.add('equipment');
 if(/records?.club|records?.coupon|budget.tapes|columbia.records|sony.store/i.test(title))genres.add('catalog');
 if(/jazz|porgy.and.bess|sinatra|coltrane|duke.ellington|miles.davis/i.test(title))genres.add('jazz');
 if(/soul|motown|sade|michael.jackson|alicia.keys/i.test(title))genres.add('soul');
 if(/disco|abba|jive.bunny/i.test(title))genres.add('disco');
 if(/rock|pink.floyd|rammstein|linkin.park|alanis|coldplay|starship|mike.oldfield/i.test(title))genres.add('rock');
 if(/metal|rammstein|iron.maiden|black.sabbath/i.test(title))genres.add('metal');
 if(/classical|opera|broadway|musical|soundtrack|porgy.and.bess/i.test(title))genres.add('theatre');
 return [...genres];
}
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
 if(/Adult Swim/.test(n))return ['games','music','home'];
 if(/Toon|Anime|Scooby|Kids|School|Puppet|Caped|Kaiju|Mecha|Magical|Power Level|OVA|Y2K WB/i.test(n))return ['toys','games'];
 if(/PBS|Paint Along/.test(n))return ['home','kitchen','books'];
 if(/Creature Feature|Chiller|Spooky|Strange Tales|Strange Signals|Riff Raff/.test(n))return ['movies','space','home'];
 if(/Drive-In|After Dark|Kung Fu|Frontier|Private Eye|Cliffhangers|Laugh Track/.test(n))return ['movies','home','cars'];
 if(/Late Night|Variety Hour/.test(n))return ['home','kitchen','music'];
 if(/Big Prize/.test(n))return ['home','kitchen','cars'];
 return ['home','kitchen'];
}
export function adFitsChannel(ch,media){
 const topics=media.topics||topicsFor(media),themes=adThemes(ch);
 if(!themes.some(t=>topics.includes(t)))return false;
 if(/tobacco|cigarette|budweiser|heineken|\b(?:beer|liquor|vodka|whiskey|whisky|coors|marlboro|vape|political)\b/i.test(media.title+' '+media.id))return false;
 const required=ch.name==='Jazz Club'?['jazz','equipment','catalog']:
  ch.name==='Headbangers'?['metal','rock','equipment','catalog']:
  ch.name==='Soul Train'?['soul','disco','equipment','catalog']:
  ch.name==='Showstoppers'?['theatre','equipment','catalog']:null;
 return !required||musicGenresFor(media).some(g=>required.includes(g));
}
export function channelAdPools(channels,media){
 const result={};
 for(const ch of channels)result[ch.no]=media.filter(m=>adFitsChannel(ch,m));
 return result;
}
export function mergeAds(catalog,extra=[]){
 const all=[...(catalog.commercials||[]).map(r=>({id:r[0],file:r[1],dur:r[2],title:r[3],year:Number(r[4]),archiveId:r[6]||r[0],role:'archival-commercial'})),...Object.values(catalog.breakLibraries||{}).flatMap(l=>(l.commercials||[]).filter(m=>m.role?.includes('commercial')||m.role==='recorded-advertiser-spot')),...extra];
 const seen=new Set();return all.filter(m=>{const k=(m.archiveId||m.id)+'|'+m.file;if(seen.has(k)||!Number.isInteger(Number(m.year))||Number(m.year)<1940||Number(m.year)>2008||m.dur<8||m.dur>90)return false;seen.add(k);return true;}).map(m=>{
  const topics=[...new Set([...(Array.isArray(m.topics)?m.topics:[]).filter(t=>t in TOPICS),...topicsFor(m)])]
   .filter(t=>!(t==='music'&&console.test(m.title)&&!audioGear.test(m.title)));
  return {...m,topics};
 });
}
