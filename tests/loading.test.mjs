
import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchLand,toFeatures,mergeAttributes,loadPhase} from '../src/components/prod/utils/landRequests.js';
import {matchesFilters,filterCoordinates} from '../src/components/prod/utils/filterData.js';
function mock(rows, cap=1000, failure=null) {
 const requests=[];
 return {requests,from(table){const request={table};requests.push(request);return {
  select(columns){request.columns=columns;return this;},order(column){request.order=column;return this;},
  range(from,to){request.from=from;request.to=to;return this;},abortSignal(signal){request.signal=signal;return Promise.resolve(failure?{error:failure}:{data:rows.slice(request.from,Math.min(request.to+1,request.from+cap)),error:null});}
 };}};
}
test('server truncation: advance actual rows and continue beyond a short page',async()=>{
 const rows=Array.from({length:2501},(_,i)=>({oid:i+1})); const client=mock(rows);
 const result=await fetchLand(client,'unfallatlas_uland_05','oid');
 assert.equal(result.length,2501); assert.deepEqual(client.requests.map(r=>r.from),[0,1000,2000,2501]);
 assert.ok(client.requests.every(r=>r.table==='unfallatlas_uland_05'&&r.order==='oid'));
});
test('exact page multiple terminates on empty response',async()=>{
 const client=mock([{oid:1},{oid:2}],1); assert.equal((await fetchLand(client,'unfallatlas_uland_01','oid')).length,2);assert.equal(client.requests.length,3);
});
test('duplicates and unordered pages fail rather than silently completing',async()=>{
 await assert.rejects(fetchLand(mock([{oid:2},{oid:2}]),'unfallatlas_uland_05','oid'),/duplicate/);
 await assert.rejects(fetchLand(mock([{oid:2},{oid:1}]),'unfallatlas_uland_05','oid'),/unordered/);
});
test('invalid table and wrong land are rejected',async()=>{
 await assert.rejects(fetchLand(mock([]),'unfallatlas_partitioned','oid'),/Unknown/);
 await assert.rejects(fetchLand(mock([{oid:1,uland:9}]),'unfallatlas_uland_05','oid,uland'),/wrong land/);
});
test('database errors remain visible',async()=>{
 await assert.rejects(fetchLand(mock([],1,{code:'57014',message:'statement timeout'}),'unfallatlas_uland_05','oid'),/statement timeout/);
});
test('cancelled load starts no requests',async()=>{
 const controller=new AbortController();controller.abort(); const client=mock([]);
 await assert.rejects(fetchLand(client,'unfallatlas_uland_05','oid',{signal:controller.signal}),{name:'AbortError'});assert.equal(client.requests.length,0);
});
test('cancellation after in-flight response discards the page',async()=>{
 const controller=new AbortController(); const client=mock([{oid:1}]); const original=client.from;
 client.from=table=>{const query=original(table);query.abortSignal=()=>{controller.abort();return Promise.resolve({data:[{oid:1}],error:null});};return query;};
 await assert.rejects(fetchLand(client,'unfallatlas_uland_05','oid',{signal:controller.signal}),{name:'AbortError'});
});
test('unsafe numeric identifiers and missing IDs fail',async()=>{
 await assert.rejects(fetchLand(mock([{oid:Number.MAX_SAFE_INTEGER+1}]),'unfallatlas_uland_05','oid'),/invalid oid/);
 await assert.rejects(fetchLand(mock([{}]),'unfallatlas_uland_05','oid'),/invalid oid/);
});
test('invalid coordinates are never mapped to zero',()=>{
 for(const value of [null,'','bad','181']) assert.throws(()=>toFeatures([{oid:1,uland:5,xgcswgs84:value,ygcswgs84:'50'}]),/Invalid/);
 assert.equal(toFeatures([{oid:1,uland:5,xgcswgs84:'10.5',ygcswgs84:'50'}])[0].longitude,10.5);
});
test('merge uses land plus oid and accepts string/numeric IDs',()=>{
 const features=[{properties:{uland:1,oid:7}},{properties:{uland:2,oid:7}}];
 const result=mergeAttributes(features,[{uland:1,oid:'7',ist_rad:0},{uland:2,oid:7,ist_rad:1}]);
 assert.deepEqual(result.map(f=>f.properties.ist_rad),[0,1]);
 assert.throws(()=>mergeAttributes(features,[{uland:1,oid:7}]),/Missing/);
 assert.throws(()=>mergeAttributes([], [{uland:1,oid:7}]),/without coordinates/);
 assert.throws(()=>mergeAttributes([], [{uland:1,oid:7},{uland:1,oid:7}]),/Duplicate/);
});
test('bounded concurrency keeps input order',async()=>{
 let running=0,max=0;
 const result=await loadPhase([1,2,3,4,5],async n=>{running++;max=Math.max(max,running);await new Promise(resolve=>setTimeout(resolve,2));running--;return [n];},undefined,2);
 assert.deepEqual(result,[1,2,3,4,5]);assert.equal(max,2);
});
test('zero means Without, null means All; combined filters and reset',()=>{
 assert.equal(matchesFilters({ist_rad:0},{ist_rad:0}),true);
 assert.equal(matchesFilters({ist_rad:1},{ist_rad:0}),false);
 assert.equal(matchesFilters({ist_rad:null},{ist_rad:0}),false);
 assert.equal(matchesFilters({ist_rad:1},{ist_rad:null}),true);
 assert.equal(matchesFilters({uland:'5',ist_rad:0,ist_pkw:1},{uland:5,ist_rad:0,ist_pkw:1}),true);
 assert.equal(matchesFilters({uland:5,ist_rad:0,ist_pkw:0},{uland:5,ist_rad:0,ist_pkw:1}),false);
 assert.equal(filterCoordinates([{properties:{uland:5},latitude:50,longitude:10}],{}).length,1);
});

test('progressive completion publishes each ready land before the full phase finishes', async () => {
 const ready = [], gates = new Map();
 const phase = loadPhase([1,2,3,4,5], land => new Promise(resolve => gates.set(land, resolve)), undefined, 4, (rows, land) => ready.push({rows,land}));
 assert.equal(gates.size,4);
 gates.get(2)([20]);
 await new Promise(resolve => setImmediate(resolve));
 assert.deepEqual(ready,[{rows:[20],land:2}]);
 assert.equal(gates.size,5);
 for (const land of [1,3,4,5]) gates.get(land)([land*10]);
 assert.deepEqual(await phase,[10,20,30,40,50]);
 assert.deepEqual(ready.map(item=>item.land),[2,1,3,4,5]);
});
test('aborted phase never publishes a late land or starts queued work',async()=>{
 const controller=new AbortController(), ready=[], gates=new Map();
 const phase=loadPhase([1,2,3,4,5],land=>new Promise(resolve=>gates.set(land,resolve)),controller.signal,4,rows=>ready.push(rows));
 const rejected=assert.rejects(phase,{name:'AbortError'});
 controller.abort();
 for(const land of [1,2,3,4])gates.get(land)([land]);
 await rejected;
 assert.deepEqual(ready,[]);
 assert.equal(gates.has(5),false);
});
