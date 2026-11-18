// A narrow publication lane: changed adverts do not require crawling programme
// searches again. Every source/admission input outside this list stays full-build.
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const allowed=/^(?:index\.html|commercial-timing\.js|catalog\.json|DEVLOG\.md|docs\/[^\n]+\.(?:md|json)|assets\/captions\.js|assets\/(?:scifi|porchlight|midnight-mirage)-breaks\/[^/]+\.(?:json|mp4)|scripts\/(?:themed-ad-library|themed-ads|refresh-themed-ads|curated-ad-retention|refresh-ad-catalog|ad-only-publish|stage-programming)\.(?:mjs|json)|scripts\/[a-z0-9-]+\.test\.mjs|\.github\/workflows\/catalog\.yml)$/;
function programmeInputs(html){
 html=html.replace(/\r\n/g,'\n');
 const safe=html.match(/^const SAFE = `[^`]*`;$/m)?.[0],from=html.indexOf('const BUILT_IN = ['),to=html.indexOf('\n];',from);
 const blocked=html.match(/^const BLOCKED = new Set\(\[[\s\S]*?^\]\);/m)?.[0];
 if(!safe||from<0||to<from||!blocked)throw Error('Cannot compare programme discovery inputs');
 const channels=new Function(safe+'\n'+html.slice(from,to+3)+'\nreturn BUILT_IN;')();
 return JSON.stringify({safe,blocked,channels:channels.map(({name,q,library})=>({name,q,library}))}).replace(/\r\n/g,'\n');
}
export function adOnlyChanges(paths,previousHtml,nextHtml){
 if(!paths.length||paths.some(path=>!allowed.test(path)))return false;
 try{return programmeInputs(previousHtml)===programmeInputs(nextHtml);}catch{return false;}
}
function main(){
 const [before,after]=process.argv.slice(2);
 if(!/^[a-f0-9]{7,40}$/.test(before||'')||!/^[a-f0-9]{7,40}$/.test(after||''))process.exit(1);
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:2_000_000});
 const paths=git('diff','--name-only',before,after).trim().split('\n').filter(Boolean);
 process.exit(adOnlyChanges(paths,git('show',before+':index.html'),git('show',after+':index.html'))?0:1);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main();
