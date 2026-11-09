import {test} from "node:test";
import assert from "node:assert/strict";
import {porchlightRows,buildPorchlightPool} from "./porchlight-programming.mjs";
const source={id:"approved-collection",series:"The O.C.",pattern:"oc",derivativesOnly:true};
const file={name:"Season 1/The.o.c.s01e01.pilot.mp4",source:"derivative",format:"h.264",length:2700,width:854,height:480,sha1:"approved-hash"};

test("Porchlight admits only full episodes of explicitly approved series, not clips or similarly named material",()=>{
  const files=[file,{...file,name:"The O.C. cast interview.mp4"},{...file,name:"The.o.c.s01e02.promo.mp4",length:30},{...file,name:"The.o.c.s01e03.mixed-tape.mp4",length:9000},{...file,name:"The.o.c.s01e04.private.mp4",private:true}];
  const rows=porchlightRows({files},source,{});
  assert.equal(rows.length,1);assert.equal(rows[0][3],"The O.C. · S01E01");assert.equal(rows[0][6],source.id);assert.equal(rows[0][9],"browser-audio-v1");
  assert.equal(porchlightRows({files:[{...file,source:"original",format:"MPEG4"}]},source,{}).length,0);
});

test("original episode files need a matching audited H.264/AAC signature",()=>{
  const source={id:"everwood",series:"Everwood",pattern:"everwood"};
  const f={...file,name:"Everwood Season 1/everwood-_season_01_-_episode_01__ Pilot.mp4",source:"original",format:"MPEG4",width:648,height:360};
  const codecs={[source.id+"|"+f.name]:{sha1:f.sha1,video:"avc1",audio:"mp4a"}};
  assert.equal(porchlightRows({files:[f]},source,codecs).length,1);
  assert.equal(porchlightRows({files:[f]},source,{}).length,0);
  assert.equal(porchlightRows({files:[{...f,sha1:"replacement-file"}]},source,codecs).length,0);
  codecs[source.id+"|"+f.name].audio="ac-3";
  assert.equal(porchlightRows({files:[f]},source,codecs).length,0);
});

test("refresh failures cannot restore the old Gilmore clips or a whole mixed tape",async()=>{
  const library={sources:[source],episodes:[]};
  const offline=async()=>{throw Error("offline")};
  const approved=porchlightRows({files:[file]},source,{});
  const junk=["old-promo","interview.mp4",30,"Interview",2000,"",source.id];
  assert.deepEqual(await buildPorchlightPool(library,{},offline,()=>"",[...approved,junk]),approved);
  await assert.rejects(buildPorchlightPool(library,{},offline,()=>"",[junk]),/No approved Porchlight/);
});
