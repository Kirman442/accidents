import test from 'node:test';
import assert from 'node:assert/strict';
import {tableFromArrays,tableFromIPC,tableToIPC} from 'apache-arrow';
import {BudgetCache} from '../src/files/cache.js';
import {tableBufferBytes} from '../src/files/buffers.js';
import {FileLoader} from '../src/files/loader.js';
import {blankStats,combineStats} from '../src/benchmark/analytics.js';
function environment(){
  const manifest={generation:'fixture',files:[],shards:[]},summaries={years:{}};
  for(let year=2020;year<=2025;year++){
    const lands={};
    for(let land=1;land<=16;land++){
      manifest.shards.push({year,land});
      for(const [format,compression,bytes]of [['arrow-file','identity',64],['arrow-stream','identity',64],['arrow-file','br',32],['parquet','zstd10',32]])
        manifest.files.push({scope:'runtime',year,land,format,compression,rows:1,bytes,sha256:'a'.repeat(64),path:(format==='parquet'?'parquet/':'arrow/')+format+'/'+compression+'/'+year+'/'+land});
      const stats=blankStats();stats.count=1;stats.lands[land]=1;
      for(const key of Object.keys(stats.distributions))stats.distributions[key][0]=1;
      lands[land]=stats;
    }
    summaries.years[year]={lands,national:combineStats(Object.values(lands))};
  }
  const pool={slots:[{},{},{},{}],calls:[],cancelled:new Set(),active:0,peak:0,failLand:null,hold:null,
    cancel(id){this.cancelled.add(id);},close(){},
    async run(slot,task){
      this.calls.push(task);if(task.type==='drop')return {dropped:true};
      if(task.type==='query'){await (this.hold||Promise.resolve());return task.lands.map(land=>({land,mask:new Uint8Array([1]),count:1,facets:{}}));}
      this.active++;this.peak=Math.max(this.active,this.peak);
      try{
        await (this.hold || Promise.resolve());
        if(this.cancelled.has(task.runId))throw new DOMException('Cancelled','AbortError');
        if(task.land===this.failLand)throw new Error('Failed land');
        return {land:task.land,stats:summaries.years[task.year].lands[task.land],ids:new Uint32Array([task.year*1000000+task.land]),
          positions:new Float64Array([task.land,50]),sourceBytes:64,snapshotBytes:20};
      }finally{this.active--;}
    }};
  const updates=[];
  return {pool,updates,loader:new FileLoader({manifest,summaries,base:'/',pool,onUpdate:u=>updates.push(u)})};
}
test('LRU reserves before admission, touches recent data, rejects oversize without erasing existing cache',()=>{
  const cache=new BudgetCache(100);cache.put({key:'2020',bytes:40});cache.put({key:'2021',bytes:40});
  cache.get('2020');assert.deepEqual(cache.reserve(40).map(e=>e.key),['2021']);
  cache.put({key:'2022',bytes:40});assert.equal(cache.bytes,80);
  assert.throws(()=>cache.reserve(101));assert.equal(cache.bytes,80);
  assert.deepEqual(cache.reserve(0,50).map(e=>e.key),['2020']);assert.equal(cache.bytes,40);
});
test('Arrow buffer accounting deduplicates several zero-copy column views',()=>{
  const ipc=tableToIPC(tableFromArrays({a:new Float64Array([1,2]),b:new Uint32Array([3,4]),label:['aa','bb']}),'file');
  const decoded=tableFromIPC(ipc);
  assert.equal(decoded.getChild('a').data[0].values.buffer,ipc.buffer);
  assert.equal(decoded.getChild('b').data[0].values.buffer,ipc.buffer);
  assert.equal(tableBufferBytes(decoded),ipc.buffer.byteLength);
});
test('Only selected year loads, four concurrent slots, completed year reused without worker loads; formats separated',async()=>{
  const {loader,pool,updates}=environment();
  await loader.select(2025,'arrow');assert.equal(pool.peak,4);assert.equal(pool.calls.filter(t=>t.type==='load').length,16);
  assert.equal(updates.filter(u=>u.state==='loading').at(-1).loaded,16);
  await loader.select(2025,'arrow');assert.equal(pool.calls.filter(t=>t.type==='load').length,16);
  assert.equal(updates.at(-1).fromCache,true);
  await loader.select(2024,'arrow');await loader.select(2025,'parquet');
  assert.equal(loader.cache.entries.size,3);assert.equal(pool.calls.filter(t=>t.type==='load').length,48);
  loader.close();
});
test('Eviction drops worker sources and later selecting the evicted year loads it again',async()=>{
  const {loader,pool}=environment();
  await loader.select(2025,'arrow',1050400);await loader.select(2024,'arrow',1050400);
  assert.equal(loader.cache.entries.size,1);assert.equal(pool.calls.filter(t=>t.type==='drop').length,4);
  await loader.select(2025,'arrow',1050400);assert.equal(pool.calls.filter(t=>t.type==='load').length,48);
  loader.close();
});
test('Switching during load aborts previous heads, skips queued lands, drops partial sources and publishes only the latest year',async()=>{
  const {loader,pool,updates}=environment();let release;
  pool.hold=new Promise(resolve=>{release=resolve;});
  const first=loader.select(2025,'arrow');const firstCheck=assert.rejects(first,{name:'AbortError'});
  await new Promise(resolve=>setImmediate(resolve));
  const second=loader.select(2024,'arrow');release();pool.hold=null;
  await firstCheck;await second;
  assert.equal(pool.calls.filter(t=>t.type==='load'&&t.year===2025).length,4);
  assert.deepEqual(updates.filter(u=>u.state==='ready').map(u=>u.year),[2024]);
  assert.equal(loader.cache.entries.size,1);loader.close();
});
test('Load error never caches a partial year; retry and explicit clearing release completed data',async()=>{
  const {loader,pool,updates}=environment();pool.failLand=5;
  await assert.rejects(loader.select(2025,'arrow'),/Failed land/);assert.equal(loader.cache.bytes,0);
  assert.equal(updates.at(-1).state,'error');assert.equal(updates.at(-1).parts.length,0);
  pool.failLand=null;await loader.select(2025,'arrow');assert.equal(loader.cache.entries.size,1);
  await loader.clear();assert.equal(loader.cache.bytes,0);assert.equal(updates.at(-1).parts.length,0);loader.close();
});

test('A closed worker pool invalidates cached sources and recreates before retry',async()=>{
  const {loader,pool,updates}=environment();
  await loader.select(2025,'arrow');pool.closed=true;
  pool.recreate=()=>{pool.closed=false;return pool;};
  await loader.select(2025,'arrow');
  assert.equal(pool.calls.filter(t=>t.type==='load').length,32);
  assert.equal(updates.at(-1).fromCache,false);loader.close();
});

test('Land queries reuse loaded sources, route to owning workers and never start loads',async()=>{
 const {loader,pool}=environment();await loader.select(2025,'arrow');
 for(const lands of [[1],[1,5,9,13],[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],[1]]){
  const q=await loader.query(2025,'arrow',lands,{});assert.deepEqual(q.map(p=>p.land).sort((a,b)=>a-b),lands);
 }
 assert.equal(pool.calls.filter(t=>t.type==='load').length,16);loader.close();
});
test('Query result for previous year is rejected after selection changes',async()=>{
 const {loader,pool}=environment();await loader.select(2025,'arrow');let release;
 pool.hold=new Promise(r=>release=r);const rejected=assert.rejects(loader.query(2025,'arrow',[1],{}),{name:'AbortError'});
 const next=loader.select(2024,'arrow');release();pool.hold=null;await rejected;await next;loader.close();
});
