import test from 'node:test';
import assert from 'node:assert/strict';
import {tableFromArrays,vectorFromArray,FixedSizeList,Field,Float64} from 'apache-arrow';
import {validateTable,selectTable,combineStats,fleetRate,verifySummary} from '../src/benchmark/analytics.js';
import {DataPool} from '../src/benchmark/pool.js';
function fixture() {
  const bytes=values=>new Uint8Array(values);
  const table=tableFromArrays({record_id:new Uint32Array([2025000001,2025000002,2025000003]),
    source_uid:['00123456789012345678','00123456789012345678','16210716      528690'],year:new Uint16Array([2025,2025,2025]),
    uland:bytes([1,1,1]),month:bytes([1,1,2]),hour:bytes([0,12,23]),weekday:bytes([2,2,3]),category:bytes([3,3,1]),
    accident_type:bytes([0,1,2]),accident_pattern:bytes([1,2,3]),light:bytes([0,1,2]),road_condition:bytes([0,1,2]),
    rad:bytes([0,1,0]),pkw:bytes([1,1,0]),fuss:bytes([0,0,1]),krad:bytes([0,0,0]),gkfz:bytes([0,0,1]),other_participant:bytes([0,0,0]),
    geometry:vectorFromArray([[6.86027,49.24297],[7,50],[8,51]],new FixedSizeList(2,new Field('element',new Float64())))});
  table.schema.metadata.set('uad.generation','test');table.schema.metadata.set('uad.coordinate_decimals','5');
  return table;
}
const spec={year:2025,land:1,rows:3,generation:'test'};
test('Actual Arrow columns: duplicate textual UID retained, midnight, AND/Without and empty selection',()=>{
  const table=fixture(),columns=validateTable(table,spec);
  const all=selectTable(columns,3);
  assert.deepEqual([...all.ids],[2025000001,2025000002,2025000003]);
  assert.equal(all.stats.participation.pkw,2);assert.equal(all.stats.distributions.hour[0],1);
  assert.deepEqual([...selectTable(columns,3,{rad:0,pkw:1,category:3}).ids],[2025000001]);
  assert.equal(selectTable(columns,3,{rad:1,pkw:0}).stats.count,0);
  assert.equal(selectTable(columns,3,{rad:null}).stats.count,3);
  assert.throws(()=>selectTable(columns,3,{hour:24}),/фильтр/);
  const summary={count:3,distributions:Object.fromEntries(Object.entries(all.stats.distributions).map(([k,v])=>[k,Object.fromEntries(v.map((n,i)=>[i,n]))])),participation:all.stats.participation};
  verifySummary(all.stats,summary);
  assert.throws(()=>verifySummary({...all.stats,count:4},summary),/Число/);
  assert.equal(combineStats([all.stats,all.stats]).count,6);
});
test('Generation and partition mismatches reject data; fleet uses published endpoints and preserves denominator under filtering',()=>{
  assert.throws(()=>validateTable(fixture(),{...spec,generation:'old'}),/генерация/);
  assert.throws(()=>validateTable(fixture(),{...spec,land:5}),/земля/);
  const records=[{snapshot_date:'2025-01-01',geography_level:'national',region_code:'DE',pkw:500},
    {snapshot_date:'2026-01-01',geography_level:'national',region_code:'DE',pkw:700}];
  const columns=validateTable(fixture(),spec);
  const rate=fleetRate(selectTable(columns,3).stats,records,2025);
  assert.equal(rate.mean,600);assert.equal(rate.rate,2/600*10000);
  const filtered=fleetRate(selectTable(columns,3,{rad:1,pkw:0}).stats,records,2025);
  assert.equal(filtered.mean,600);assert.equal(filtered.rate,0);
  assert.throws(()=>fleetRate(selectTable(columns,3).stats,records,2024),/обоих/);
});
test('Worker tasks on a slot are sequential; cancellation rejects active and queued tasks',async()=>{
  let concurrent=0,max=0;
  class Worker {
    postMessage({id,task}) {concurrent++;max=Math.max(max,concurrent);this.timer=setTimeout(()=>{concurrent--;this.onmessage({data:{id,result:task.value}});},10);}
    terminate(){clearTimeout(this.timer);}
  }
  const pool=new DataPool(Worker,1);
  assert.deepEqual(await Promise.all([pool.run(0,{value:1}),pool.run(0,{value:2})]),[1,2]);
  assert.equal(max,1);pool.close();
  const second=new DataPool(Worker,1);
  const pending=Promise.allSettled([second.run(0,{value:3}),second.run(0,{value:4})]);
  await Promise.resolve();second.close();
  assert.ok((await pending).every(r=>r.status==='rejected'));
});
