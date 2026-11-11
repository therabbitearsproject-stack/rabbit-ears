/* Pass secrets through stdin, never command-line arguments or logs. */
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
process.loadEnvFile(new URL('.dev.vars',import.meta.url));
const keys=['DISCORD_CLIENT_SECRET','DISCORD_BOT_TOKEN'];
const missing=keys.filter(k=>!process.env[k]?.trim());
if(missing.length)throw Error('Fill the private .dev.vars file first: '+missing.join(', '));
const secrets=Object.fromEntries(keys.map(k=>[k,process.env[k].trim()]));
if(process.env.MODERATOR_IDS?.trim())secrets.MODERATOR_IDS=process.env.MODERATOR_IDS.trim();
const child=spawn(process.execPath,[fileURLToPath(new URL('node_modules/wrangler/bin/wrangler.js',import.meta.url)),'secret','bulk'],{cwd:fileURLToPath(new URL('.',import.meta.url)),stdio:['pipe','inherit','inherit']});
child.stdin.end(JSON.stringify(secrets));
child.on('exit',code=>process.exit(code||0));
