import test from 'node:test';
import assert from 'node:assert/strict';
import {publishPlan,checkPayload,sha256} from '../scripts/deployment-plan.mjs';
import {datasetSpec} from '../src/files/catalog.js';
// Fixtures are created in memory; no dependency on private/local data folders.
const fixture=()=>{
  const m={status:'complete',generation:'a'.repeat(32),shards:[],files:[],years:[2025]};
  const add=(land,format,compression,path,scope='runtime')=>m.files.push({scope,year:2025,land,format,compression,path,rows:1,bytes:128,sha256:'b'.repeat(64)});
  for(let land=1;land<=16;land++){
    m.shards.push({year:2025,land});const name='2025/uland_'+String(land).padStart(2,'0');
    add(land,'arrow-file','identity','arrow/file/'+name+'.arrow');add(land,'arrow-stream','identity','arrow/stream/'+name+'.arrow');
    add(land,'arrow-file','br','arrow/file/'+name+'.arrow.br');add(land,'parquet','zstd10','parquet/zstd10/'+name+'.parquet');
    add(land,'parquet','snappy','parquet/snappy/'+name+'.parquet');
  }
  for(const [format,compression,prefix,ext] of [['arrow-file','identity','arrow/file','arrow'],['arrow-file','br','arrow/file','arrow.br'],['parquet','zstd10','parquet/zstd10','parquet']])add(null,format,compression,prefix+'/analytics/fleet_snapshots.'+ext,'fleet_snapshots');
  m.files.push({path:'analytics/accident_summaries.json',scope:'analytics-copy',format:'json',compression:'identity',bytes:10,sha256:'c'.repeat(64)});
  return m;
};
test('Publication keeps both formats/all lands while excluding raw payloads and duplicate profiles',()=>{
  const plan=publishPlan(fixture());assert.equal(plan.payloads.length,35);
  assert.ok(plan.manifest.files.some(f=>f.format==='arrow-file'&&f.compression==='identity'&&!f.published));
  assert.ok(!plan.payloads.some(f=>f.path.includes('snappy')||f.path.endsWith('.arrow')));
  for(const format of ['arrow','parquet'])assert.equal(datasetSpec(plan.manifest,plan.base,2025,format).tasks.length,16);
});
test('Publication fails for missing or unsafe shards rather than creating a partially usable dataset',()=>{
  const missing=fixture();missing.files=missing.files.filter(f=>!(f.land===5&&f.compression==='br'));assert.throws(()=>publishPlan(missing));
  const unsafe=fixture();unsafe.files[0].path='arrow/file/../../.env';assert.throws(()=>publishPlan(unsafe));
  const duplicate=fixture();duplicate.files.push({...duplicate.files[0]});assert.throws(()=>publishPlan(duplicate));
});
test('Published compressed bytes must match source hash and size exactly',()=>{
  const bytes=Buffer.from('verified');const entry={path:'fixture',bytes:bytes.length,sha256:sha256(bytes)};
  assert.doesNotThrow(()=>checkPayload(entry,bytes));assert.throws(()=>checkPayload(entry,Buffer.from('modified')));
});
