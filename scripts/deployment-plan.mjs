import {createHash} from 'node:crypto';
import {validateCatalog,catalogYears,datasetSpec} from '../src/files/catalog.js';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function publishPlan(input){
  validateCatalog(input);
  if(!/^[a-f0-9]{32}$/.test(input.generation))throw new Error('Unsafe dataset generation');
  const selected=input.files.filter(f=>
    (f.scope==='runtime'||f.scope==='fleet_snapshots')&&
    ((f.format==='parquet'&&f.compression==='zstd10')||
      (f.format==='arrow-file'&&['identity','br'].includes(f.compression))||
      (f.scope==='runtime'&&f.format==='arrow-stream'&&f.compression==='identity'))||
    f.path==='analytics/accident_summaries.json');
  const files=selected.map(f=>({...f,published:!['arrow-file','arrow-stream'].includes(f.format)||f.compression!=='identity'}));
  const paths=new Set();
  for(const f of files){
    if(!/^(?:parquet\/zstd10|arrow\/(?:file|stream)|analytics)\/[A-Za-z0-9_./-]+$/.test(f.path)||f.path.includes('..')||paths.has(f.path)||
      !Number.isSafeInteger(f.bytes)||f.bytes<=0||!/^[a-f0-9]{64}$/.test(f.sha256))throw new Error('Unsafe or duplicate publication entry');
    paths.add(f.path);
  }
  const manifest={...input,files,file_count:files.length,source_manifest_sha256:input.source_manifest_sha256||null,
    deployment:{version:1,publishedFiles:files.filter(f=>f.published).map(f=>f.path),
      note:'Only Arrow+Brotli, Parquet ZSTD10, fleet and summaries are published. Identity IPC entries are metadata for checksum and memory reservation; full source archives and duplicate profiles stay local.'}};
  const base='/accidents/__binary/'+input.generation+'/';
  for(const year of catalogYears(manifest))for(const format of ['arrow','parquet']){
    const spec=datasetSpec(manifest,base,year,format);
    for(const task of spec.tasks)if(!manifest.deployment.publishedFiles.includes(task.url.slice(base.length).split('?')[0]))throw new Error('Task refers to unpublished file');
  }
  if(!files.some(f=>f.scope==='fleet_snapshots'&&f.format==='arrow-file'&&f.compression==='br')||
    !files.some(f=>f.scope==='fleet_snapshots'&&f.format==='parquet'&&f.compression==='zstd10')||
    !files.some(f=>f.path==='analytics/accident_summaries.json'))throw new Error('Missing fleet or summaries');
  return {base,manifest,payloads:files.filter(f=>f.published)};
}
export function checkPayload(entry,bytes){if(bytes.length!==entry.bytes||sha256(bytes)!==entry.sha256)throw new Error('Changed data asset: '+entry.path);}
