// Original deterministic miniature scores. No recordings, samples, or borrowed melodies.
export const STYLES={
 ambient:{bpm:52,scale:[0,2,7,9,14],voice:'pad',drums:'none',density:2},
 space:{bpm:66,scale:[0,3,7,10,14],voice:'bell',drums:'none',density:4},
 theremin:{bpm:57,scale:[0,1,7,8,12],voice:'theremin',drums:'none',density:2},
 piano:{bpm:74,scale:[0,4,7,9,12],voice:'piano',drums:'none',density:4},
 western:{bpm:91,scale:[0,2,4,7,9],voice:'pluck',drums:'train',density:4},
 jazz:{bpm:101,scale:[0,3,5,6,7,10],voice:'keys',drums:'brush',swing:.16,density:4},
 lounge:{bpm:88,scale:[0,4,7,9,11],voice:'keys',drums:'brush',swing:.08,density:4},
 cartoon:{bpm:126,scale:[0,2,4,7,9,12],voice:'pizz',drums:'wood',density:4},
 cinema:{bpm:72,scale:[0,3,7,8,12],voice:'strings',drums:'timpani',density:2},
 adventure:{bpm:108,scale:[0,2,5,7,10],voice:'brass',drums:'march',density:4},
 spooky:{bpm:63,scale:[0,1,3,6,7,10],voice:'bell',drums:'sparse',density:2},
 organ:{bpm:119,scale:[0,4,5,7,9,12],voice:'organ',drums:'march',density:4},
 rock:{bpm:130,scale:[0,3,5,7,10],voice:'guitar',drums:'rock',density:4},
 metal:{bpm:144,scale:[0,1,3,5,7,10],voice:'distorted',drums:'metal',density:8},
 surf:{bpm:138,scale:[0,2,4,7,9],voice:'guitar',drums:'surf',density:8},
 disco:{bpm:116,scale:[0,3,7,10,12],voice:'keys',drums:'disco',density:8},
 funk:{bpm:103,scale:[0,3,5,7,10],voice:'pluck',drums:'funk',density:8},
 synthpop:{bpm:112,scale:[0,3,7,10,14],voice:'synth',drums:'electro',density:8},
 chiptune:{bpm:136,scale:[0,4,7,9,12],voice:'chip',drums:'chip',density:8},
};
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
export function scoreFor(style,seed){const p=STYLES[style]||STYLES.ambient,h=hash(seed);return {...p,style,seed:h,bpm:p.bpm+(h%11)-5,key:45+(h%12),melody:Array.from({length:16},(_,i)=>p.scale[(hash(seed+':note:'+i)%p.scale.length)]),kickMask:hash(seed+':kick')|0x101,snareMask:hash(seed+':snare')|0x1010};}
const TAU=Math.PI*2;
function tone(kind,f,t,age){
  const w=TAU*f*t,a=TAU*f*age;
  switch(kind){
    case 'pad':return (Math.sin(w)+.4*Math.sin(w*1.003)+.18*Math.sin(w*2))*Math.min(1,age*3)*Math.exp(-age*.7);
    case 'strings':return (Math.sin(w)+.35*Math.sin(w*2)+.17*Math.sin(w*3))*Math.min(1,age*8)*Math.exp(-age*1.6);
    case 'bell':return (Math.sin(a)+.35*Math.sin(a*2.76)*Math.exp(-age*8))*Math.exp(-age*3.2);
    case 'theremin':return Math.sin(w+.12*Math.sin(TAU*5*t))*Math.min(1,age*5)*Math.exp(-age*1.2);
    case 'piano':return (Math.sin(a)+.3*Math.sin(a*2)*Math.exp(-age*4)+.12*Math.sin(a*3))*Math.exp(-age*4);
    case 'keys':return (Math.sin(a+.5*Math.sin(a*2)*Math.exp(-age*6))+.18*Math.sin(a*3))*Math.exp(-age*6);
    case 'pizz':return (Math.sin(a)+.25*Math.sin(a*2)+.12*Math.sin(a*3))*Math.exp(-age*13);
    case 'pluck':return (Math.sin(a)+.4*Math.sin(a*2)+.2*Math.sin(a*3))*Math.exp(-age*9);
    case 'brass':return (Math.sin(w)+.3*Math.sin(w*2)+.15*Math.sin(w*3))*Math.min(1,age*22)*Math.exp(-age*4);
    case 'organ':return (Math.sin(a)+.45*Math.sin(a*2)+.3*Math.sin(a*4))*Math.exp(-age*5);
    case 'guitar':return (Math.sin(a)+.4*Math.sin(a*2)+.2*Math.sin(a*3)+.1*Math.sin(a*5))*Math.exp(-age*7);
    case 'distorted':return Math.tanh(2.8*(Math.sin(a)+.4*Math.sin(a*1.5)))*Math.exp(-age*11)*.6;
    case 'chip':return (Math.sin(a)>0?1:-1)*.42*Math.exp(-age*10);
    default:return (Math.sin(a)+.3*Math.sin(a*2+.5*Math.sin(t)))*Math.exp(-age*7);
  }
}
export function renderMusic(style,seed,duration,rate=44100){
  const p=scoreFor(style,seed),n=Math.round(rate*duration),pcm=Buffer.alloc(n*4);let rng=p.seed;
  const beat=60/p.bpm,step=beat*4/p.density;
  for(let i=0;i<n;i++){
    const t=i/rate,k=Math.floor(t/step),delay=k%2?(p.swing||0)*step:0,age=Math.max(0,t-k*step-delay);
    const note=p.key+12+p.melody[k%16],f=440*2**((note-69)/12);
    rng=(Math.imul(rng,1664525)+1013904223)>>>0;const noise=rng/2147483648-1;
    const active=t-k*step>=delay;
    let lead=active?tone(p.voice,f,t,age)*.17:0;
    const chordIndex=Math.floor(t/(beat*4))%4,root=p.key+[0,5,3,7][chordIndex];
    const bassF=440*2**((root-12-69)/12),ba=t%beat;
    let bass=Math.sin(TAU*bassF*t)*Math.exp(-ba*(p.drums==='none'?1.5:7))*.1;
    let pad=0;
    if(['ambient','space','cinema','spooky'].includes(style))pad=[0,7,12].reduce((s,v)=>s+Math.sin(TAU*440*2**((root+v-69)/12)*t),0)*.035;
    const sixteenth=beat/4,j=Math.floor(t/sixteenth),u=t-j*sixteenth,b=j%16;
    let drums=0;
    if(p.drums!=='none'){
      const kick=['disco','electro'].includes(p.drums)?b%4===0:['brush','wood','train'].includes(p.drums)?b===0||b===8:((p.kickMask>>b)&1)&&b%2===0;
      const snare=['brush','wood'].includes(p.drums)?b===4||b===12:['march','metal'].includes(p.drums)?b%4===2:b===4||b===12||(((p.snareMask>>b)&1)&&b%4===3);
      if(kick)drums+=Math.sin(TAU*(48*u+5*(1-Math.exp(-u*28))))*Math.exp(-u*25)*(['brush','wood'].includes(p.drums)?.08:.19);
      if(snare)drums+=noise*Math.exp(-u*(p.drums==='brush'?24:42))*(p.drums==='brush'?.025:.07);
      if(!['sparse','timpani'].includes(p.drums)&&j%(p.drums==='metal'?1:2)===0)drums+=noise*Math.exp(-u*190)*.018;
      if(p.drums==='wood'&&b%4===2)drums+=Math.sin(TAU*850*u)*Math.exp(-u*100)*.035;
      if(p.drums==='timpani')drums*=.5;
    }
    const fade=Math.min(1,t/.08,(duration-t)/.45),pan=Math.sin(t*.65+p.seed)*.16;
    const mix=Math.tanh(lead+bass+pad+drums)*fade*.8;
    pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,mix*(1-pan)))*32767),i*4);
    pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,mix*(1+pan)))*32767),i*4+2);
  }
  const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*4,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  return {wav:Buffer.concat([header,pcm]),score:p};
}
