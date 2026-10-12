import {tableFromIPC} from 'apache-arrow';
import initWasm,{readParquet} from 'parquet-wasm/esm';
import wasmUrl from 'parquet-wasm/esm/parquet_wasm_bg.wasm?url';
import {validateTable,selectTable,verifySummary} from '../benchmark/analytics.js';
import {describeId,scanNearby} from './record-details.js';
import {queryColumns} from './map-query.js';
import {tableBufferBytes} from './buffers.js';
let wasm;
const datasets=new Map(),controllers=new Map(),cancelled=new Set();
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
self.onmessage=async ({data})=>{
  if(data.cancel!=null){cancelled.add(data.cancel);controllers.get(data.cancel)?.abort();return;}
  const {id,task}=data;
  try {
    if(task.type==='drop'){
      datasets.delete(task.key);cancelled.delete(task.runId);self.postMessage({id,result:{dropped:true}});return;
    }
    if(task.type==='details'){
      const sources=datasets.get(task.key),items=task.handles.map(handle=>{
        const source=sources?.get(handle.land);if(!source)throw new Error('Данные выбранного ДТП уже освобождены');
        return describeId(source.columns,source.table.numRows,handle.id);
      });self.postMessage({id,result:items});return;
    }
    if(task.type==='nearby'){
      const sources=datasets.get(task.key),parts=task.lands.map(land=>{
        const source=sources?.get(land);if(!source)throw new Error('Данные окрестности уже освобождены');
        return scanNearby(source.columns,source.table.numRows,task);
      });self.postMessage({id,result:parts});return;
    }
    if(task.type==='query'){
      const sources=datasets.get(task.key),parts=task.lands.map(land=>{
        const source=sources?.get(land);if(!source)throw new Error('Данные года уже освобождены');
        return {land,...queryColumns(source.columns,source.table.numRows,task.filters)};
      });
      self.postMessage({id,result:parts},parts.map(p=>p.mask.buffer));return;
    }
    if(task.type!=='load')throw new Error('Неизвестная задача загрузчика');
    const controller=new AbortController();controllers.set(task.runId,controller);
    const timer=setTimeout(()=>controller.abort(),60000),start=performance.now();
    try {
      if(cancelled.has(task.runId))throw new DOMException('Отменено','AbortError');
      const response=await fetch(task.url,{cache:'force-cache',signal:controller.signal});
      if(!response.ok)throw new Error('HTTP '+response.status+': земля '+task.land);
      if(task.format==='arrow'&&response.headers.get('content-encoding')!=='br')throw new Error('Arrow Brotli требует Content-Encoding: br');
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(await hash(bytes)!==task.decodedSha256)throw new Error('Не совпала контрольная сумма: земля '+task.land);
      let ipc=bytes;
      if(task.format==='parquet'){
        await (wasm ||= initWasm(wasmUrl));
        ipc=readParquet(bytes,{batchSize:16384}).intoIPCStream();
      }
      const table=tableFromIPC(ipc),columns=validateTable(table,task);
      const result=selectTable(columns,table.numRows,{});verifySummary(result.stats,task.summary);
      const sourceBytes=tableBufferBytes(table),snapshotBytes=result.ids.byteLength+result.positions.byteLength;
      if(cancelled.has(task.runId)||controller.signal.aborted)throw new DOMException('Отменено','AbortError');
      if(!datasets.has(task.key))datasets.set(task.key,new Map());
      datasets.get(task.key).set(task.land,{table,columns});
      self.postMessage({id,result:{...result,land:task.land,sourceBytes,snapshotBytes,loadMs:performance.now()-start}},
        [result.ids.buffer,result.positions.buffer]);
    }finally{clearTimeout(timer);controllers.delete(task.runId);}
  }catch(error){self.postMessage({id,error:error.message});}
};
