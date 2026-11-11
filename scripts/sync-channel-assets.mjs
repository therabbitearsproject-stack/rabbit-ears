// Reconcile catalog media metadata after offline bumper authoring (no Archive requests).
import {readFile,writeFile} from 'node:fs/promises';import {channelAdPools,mergeAds} from './themed-ad-library.mjs';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const catalog=await read('catalog.json'),manifest=await read('assets/channel-bumpers/manifest.json'),ads=await read('scripts/themed-ads.json'),channels=await read('community/channels.json');
catalog.channelBumpers=manifest.channels;catalog.bumpers=manifest.channels['97'];
catalog.breakLibraries['sci-fi-channel'].bumpers=[...catalog.breakLibraries['sci-fi-channel'].bumpers.filter(m=>m.role!=='custom-bumper'),...manifest.channels['97']];
catalog.channelAds=channelAdPools(channels,mergeAds(catalog,ads.commercials));
await writeFile(new URL('catalog.json',root),JSON.stringify(catalog));
console.log(`Catalog synchronized: ${channels.length} channels; ${Object.values(manifest.channels).flat().length} bumpers.`);
