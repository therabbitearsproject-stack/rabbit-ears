"""One-time, resumable interface catalog authoring; unrelated to programme queues."""
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path.home()/'.local/share/rabbit-ears-translations'))
from engine import Engine

root=Path.home()/'.local/share/rabbit-ears-ui'
keys=json.loads((root/'ui-source.json').read_text())['keys']
model=Engine(Path.home()/'.local/share/rabbit-ears-translations/model')
import ctranslate2
model.model=ctranslate2.Translator(str(Path.home()/'.local/share/rabbit-ears-translations/model'),device='cpu',compute_type='int8',inter_threads=1,intra_threads=4)
output=root/'catalog.json'
catalog=json.loads(output.read_text()) if output.exists() else {}
for language in ['es','fr','pt','zh','hi','ar','bn','id','ur']:
    dictionary=catalog.setdefault(language,{})
    missing=[key for key in keys if key not in dictionary]
    for offset in range(0,len(missing),32):
        batch=missing[offset:offset+32]
        tokens=[['__en__']+model.sp.encode(text,out_type=str)+['</s>'] for text in batch]
        result=model.model.translate_batch(tokens,target_prefix=[['__'+language+'__']]*len(batch),beam_size=4,
            max_input_length=1024,max_decoding_length=512,no_repeat_ngram_size=3)
        for key,value in zip(batch,result):
            text=model.sp.decode([token for token in value.hypotheses[0] if not token.startswith('__') and token not in ('</s>','<s>','<pad>')]).strip()
            dictionary[key]=text or key
        temporary=output.with_suffix('.tmp');temporary.write_text(json.dumps(catalog,ensure_ascii=False),encoding='utf-8');temporary.replace(output)
        (root/'progress.json').write_text(json.dumps({'language':language,'completed':len(dictionary),'total':len(keys),'languagesDone':[key for key,value in catalog.items() if len(value)==len(keys)]}),encoding='utf-8')
print('All interface catalogs written.',flush=True)
