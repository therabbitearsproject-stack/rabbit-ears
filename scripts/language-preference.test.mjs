import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),locale=require('../assets/language-preference.js'),create=require('../assets/ui-language.js');
test('automatic language follows supported device preferences and allows a regional fallback',()=>{
 assert.equal(locale.device(['es-MX','en-US']),'es');assert.equal(locale.device(['pt_BR']),'pt');assert.equal(locale.device(['ar-EG']),'ar');assert.equal(locale.device(['ja-JP','fr-CA']),'fr');assert.equal(locale.device(['ja-JP']),null);assert.equal(locale.supported.length,10);
});
test('interface translation preserves whitespace, variables and an English fallback',()=>{
 const ui=create({dictionaries:{es:{Play:'Reproducir',Pause:'Pausar','Up next':'A continuación'}}});
 assert.equal(ui.text(' Play ','es'),' Reproducir ');assert.equal(ui.text('Up next 9:45 PM','es'),'A continuación 9:45 PM');assert.equal(ui.text('Pause','en'),'Pause');assert.equal(ui.text('Unknown text','es'),'Unknown text');assert.equal(ui.text('constructor','es'),'constructor');
});
