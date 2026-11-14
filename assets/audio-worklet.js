/* Adapted from Spelunkr Desktop.
MIT License

Copyright (c) 2026 Spelunkr Desktop contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

This license covers only this independent desktop wrapper and its original
icon. It grants no rights to Spelunkr's website, branding, programming, or
third-party videos. Those remain the property of their respective owners.

*/
/* Original streaming spectral denoiser. No audio leaves this process. */
'use strict';
class TapeDenoiser extends AudioWorkletProcessor {
  static get parameterDescriptors() {return [{name:'amount',defaultValue:0,minValue:0,maxValue:100,automationRate:'k-rate'}];}
  constructor() {
    super();this.size=1024;this.hop=256;this.count=0;this.cursor=0;this.channels=[];
    this.window=Float32Array.from({length:1024},(_,i)=>Math.sqrt(.5-.5*Math.cos(2*Math.PI*i/1024)));
    this.reverse=new Uint16Array(1024);
    for(let i=0;i<1024;i++){let x=i,r=0;for(let bit=0;bit<10;bit++){r=(r<<1)|(x&1);x>>=1;}this.reverse[i]=r;}
    this.cos=Float64Array.from({length:512},(_,i)=>Math.cos(2*Math.PI*i/1024));
    this.sin=Float64Array.from({length:512},(_,i)=>Math.sin(2*Math.PI*i/1024));
    this.noise=new Float64Array(513);this.smooth=new Float64Array(513);this.gain=new Float64Array(513).fill(1);
    this.minima=Array.from({length:4},()=>new Float64Array(513).fill(Infinity));this.frames=0;
    this.port.onmessage=event=>{if(event.data==='reset'){this.noise.fill(0);this.smooth.fill(0);this.gain.fill(1);this.minima.forEach(a=>a.fill(Infinity));this.frames=0;}};
  }
  fft(real,imag,inverse=false) {
    for(let i=0;i<1024;i++){const j=this.reverse[i];if(j>i){let t=real[i];real[i]=real[j];real[j]=t;t=imag[i];imag[i]=imag[j];imag[j]=t;}}
    for(let size=2;size<=1024;size*=2){const half=size/2,step=1024/size;
      for(let base=0;base<1024;base+=size)for(let j=0;j<half;j++){
        const c=this.cos[j*step],s=(inverse?1:-1)*this.sin[j*step],a=base+j,b=a+half;
        const r=c*real[b]-s*imag[b],im=s*real[b]+c*imag[b];real[b]=real[a]-r;imag[b]=imag[a]-im;real[a]+=r;imag[a]+=im;
      }
    }
    if(inverse)for(let i=0;i<1024;i++){real[i]/=1024;imag[i]/=1024;}
  }
  frame(amount,channelCount) {
    const bucket=Math.floor(this.frames/Math.max(1,Math.round(sampleRate/this.hop*.5)))%4;
    if(this.frames%Math.max(1,Math.round(sampleRate/this.hop*.5))===0)this.minima[bucket].fill(Infinity);
    for(let ch=0;ch<channelCount;ch++){
      const data=this.channels[ch];data.imag.fill(0);
      for(let i=0;i<1024;i++)data.real[i]=data.input[(this.cursor+i)%1024]*this.window[i];
      this.fft(data.real,data.imag);
    }
    // Link stereo gain decisions to preserve the stereo image.
    for(let k=0;k<=512;k++){
      let power=0;for(let ch=0;ch<channelCount;ch++){const d=this.channels[ch];power+=(d.real[k]**2+d.imag[k]**2)/channelCount;}
      this.smooth[k]=this.frames ? .8*this.smooth[k]+.2*power : power;
      this.minima[bucket][k]=Math.min(this.minima[bucket][k],this.smooth[k]);
      const minimum=Math.min(this.minima[0][k],this.minima[1][k],this.minima[2][k],this.minima[3][k]);
      // Minimum statistics follows stationary hiss, while changing speech rises
      // above it. The first ~0.2s ramps in to avoid an abrupt initial noise print.
      const estimate=minimum*1.35;
      this.noise[k]=this.frames ? .98*this.noise[k]+.02*estimate : estimate;
      const strength=amount/100, floor=Math.pow(10,-strength*24/20);
      const wanted=Math.max(floor,Math.sqrt(Math.max(0,1-(.6+strength*1.8)*this.noise[k]/Math.max(power,1e-12))));
      const target=1+(wanted-1)*Math.min(1,this.frames/32)*strength;
      this.gain[k]+=(target-this.gain[k])*(target<this.gain[k]?.35:.12);
      for(let ch=0;ch<channelCount;ch++){
        const d=this.channels[ch],g=this.gain[k];d.real[k]*=g;d.imag[k]*=g;
        if(k>0&&k<512){d.real[1024-k]*=g;d.imag[1024-k]*=g;}
      }
    }
    for(let ch=0;ch<channelCount;ch++){
      const d=this.channels[ch];this.fft(d.real,d.imag,true);
      for(let i=0;i<1024;i++)d.output[(this.count-1+i)%2048]+=d.real[i]*this.window[i]*.5;
    }
    this.frames++;
  }
  process(inputs,outputs,parameters) {
    const input=inputs[0],output=outputs[0];if(!input?.length)return true;
    const channels=Math.min(2,output.length);
    while(this.channels.length<channels)this.channels.push({input:new Float32Array(1024),output:new Float32Array(2048),real:new Float64Array(1024),imag:new Float64Array(1024)});
    for(let i=0;i<output[0].length;i++){
      for(let ch=0;ch<channels;ch++)this.channels[ch].input[this.cursor]=(input[ch]||input[0])[i];
      this.cursor=(this.cursor+1)%1024;this.count++;
      if(this.count>=1024&&this.count%256===0)this.frame(parameters.amount[0],channels);
      // Output is scheduled on an absolute ring clock; fixed delay is 1023 samples.
      const read=(this.count-1)%2048;
      for(let ch=0;ch<channels;ch++){output[ch][i]=this.channels[ch].output[read];this.channels[ch].output[read]=0;}
    }
    return true;
  }
}
registerProcessor('rabbit-tape-denoiser',TapeDenoiser);
