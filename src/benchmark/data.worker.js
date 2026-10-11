import {tableFromIPC} from 'apache-arrow';
import initWasm, {readParquet} from 'parquet-wasm/esm';
import wasmUrl from 'parquet-wasm/esm/parquet_wasm_bg.wasm?url';
import {validateTable,selectTable} from './analytics.js';
let wasm;
const tables=new Map();
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function decode(task) {
  const timings={};
  const start=performance.now();
  const initStart=performance.now();
  const wasmPromise=task.format==='parquet'?(wasm ||= initWasm(wasmUrl)):Promise.resolve();
  const response=await fetch(task.url,{cache:task.cache,signal:AbortSignal.timeout(60000)});
  if(!response.ok) throw new Error('HTTP '+response.status+': '+task.url);
  const encoding=response.headers.get('content-encoding') || 'identity';
  if(task.format==='arrow' && encoding!=='br') throw new Error('Для Arrow Brotli ожидался Content-Encoding: br');
  const bytes=new Uint8Array(await response.arrayBuffer());
  timings.fetchMs=performance.now()-start;
  const hashStart=performance.now();
  if(await hash(bytes)!==task.decodedSha256) throw new Error('SHA-256 файла не совпал');
  timings.checksumMs=performance.now()-hashStart;
  await wasmPromise;
  timings.wasmInitElapsedMs=task.format==='parquet'?performance.now()-initStart:0;
  const decodeStart=performance.now();
  const table=tableFromIPC(task.format==='parquet'?readParquet(bytes,{batchSize:16384}).intoIPCStream():bytes);
  timings.decodeMs=performance.now()-decodeStart;
  timings.decodedBytes=bytes.byteLength;
  timings.logicalArrowBytes=task.logicalArrowBytes;
  const resource=performance.getEntriesByName(new URL(task.url,self.location.href).href).at(-1);
  timings.transferSize=resource?.transferSize ?? null;
  timings.encodedBodySize=resource?.encodedBodySize ?? null;
  return {table,timings};
}
self.onmessage=async ({data:{id,task}})=>{
  try {
    if(task.type==='load') {
      const {table,timings}=await decode(task);
      const validateStart=performance.now();
      const columns=validateTable(table,task);
      timings.validationMs=performance.now()-validateStart;
      tables.set(task.land,{table,columns});
      const selectedStart=performance.now();
      const result=selectTable(columns,table.numRows,{});
      timings.analyticsAndBuffersMs=performance.now()-selectedStart;
      const signatureStart=performance.now();
      result.signature={ids:await hash(result.ids),positions:await hash(result.positions)};
      timings.selectionChecksumMs=performance.now()-signatureStart;
      self.postMessage({id,result:{...result,land:task.land,timings}},[result.ids.buffer,result.positions.buffer]);
    } else if(task.type==='fleet') {
      const {table,timings}=await decode(task);
      if(table.schema.metadata.get('uad.generation')!==task.generation) throw new Error('Автопарк другой генерации');
      const records=[];
      const names=table.schema.fields.map(f=>f.name);
      for(let i=0;i<table.numRows;i++) {
        const level=table.getChild('geography_level').get(i);
        if(level!=='national' && level!=='land') continue;
        records.push(Object.fromEntries(names.map(name=>[name,table.getChild(name).get(i)])));
      }
      self.postMessage({id,result:{records,timings}});
    } else if(task.type==='filter') {
      const started=performance.now(),parts=[];
      for(const [land,{table,columns}] of tables) {
        const part=selectTable(columns,table.numRows,task.filters);
        parts.push({...part,land});
      }
      const processingMs=performance.now()-started;
      const signatureStart=performance.now();
      for(const part of parts) part.signature={ids:await hash(part.ids),positions:await hash(part.positions)};
      self.postMessage({id,result:{parts,processingMs,signatureMs:performance.now()-signatureStart}},
        parts.flatMap(p=>[p.ids.buffer,p.positions.buffer]));
    } else throw new Error('Неизвестная задача');
  } catch(error) { self.postMessage({id,error:error.message}); }
};
