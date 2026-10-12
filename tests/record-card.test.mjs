import test from 'node:test';
import assert from 'node:assert/strict';
import {tableFromArrays,vectorFromArray,FixedSizeList,Field,Float64} from 'apache-arrow';
import {describeId,rowById,scanNearby,mergeNearby,distanceMeters} from '../src/files/record-details.js';
import {emptyFilters} from '../src/files/map-query.js';
function fixture(points,land=1){
 const n=points.length,bytes=v=>new Uint8Array(v),same=v=>Array(n).fill(v);
 const table=tableFromArrays({record_id:new Uint32Array(points.map((_,i)=>2025000001+i)),year:new Uint16Array(same(2025)),uland:bytes(same(land)),
  month:bytes(same(5)),weekday:bytes(same(6)),hour:bytes(same(15)),category:bytes(same(3)),accident_type:bytes(same(5)),accident_pattern:bytes(same(3)),light:bytes(same(0)),road_condition:bytes(same(0)),
  pkw:bytes(same(1)),rad:bytes(points.map((_,i)=>i%2)),fuss:bytes(same(0)),krad:bytes(same(0)),gkfz:bytes(same(0)),other_participant:bytes(same(0)),
  source_uid:same('duplicate uid'),source_oid:same('private source'),plst:bytes(same(1)),
  geometry:vectorFromArray(points,new FixedSizeList(2,new Field('element',new Float64())))});
 return Object.fromEntries(table.schema.fields.map(f=>[f.name,table.getChild(f.name)]));
}
test('Card allowlist returns one record, preserves hour precision and hides service columns',()=>{
 const c=fixture([[10,53],[10.0001,53]]),result=describeId(c,2,2025000002);
 assert.equal(result.handle.index,1);assert.equal(result.record.hour,15);assert.equal(result.record.weekday,6);
 assert.deepEqual(result.record.participants,['rad','pkw']);
 assert.deepEqual(Object.keys(result.record).sort(),['accidentPattern','accidentType','category','hour','land','latitude','light','longitude','month','participants','road','weekday','year'].sort());
 assert.ok(!JSON.stringify(result.record).includes('duplicate uid'));assert.throws(()=>rowById(c,2,2025000003));
});
test('Nearby scan includes exact boundary and colocated distinct incidents, excludes selected ID and outside points',()=>{
 const lat=d=>d/6371008.8*180/Math.PI,c=fixture([[0,0],[0,0],[0,lat(49)],[0,lat(50)],[0,lat(51)],[1,1]]);
 const origin={id:2025000001,longitude:0,latitude:0},all=scanNearby(c,6,{origin,filters:emptyFilters()});
 assert.equal(all.count,3);assert.deepEqual(all.items.map(i=>i.handle.id),[2025000002,2025000003,2025000004]);
 const selected=scanNearby(c,6,{origin,filters:{...emptyFilters(),rad:1}});assert.equal(selected.count,2);
 assert.ok(Math.abs(distanceMeters(origin,{longitude:0,latitude:lat(50)})-50)<1e-7);
 assert.throws(()=>scanNearby(c,6,{origin,filters:emptyFilters(),radius:51}));
});
test('Bounding rectangle matches independent full-distance oracle, including dateline and high latitude',()=>{
 for(const center of [{longitude:10,latitude:53},{longitude:179.9999,latitude:60},{longitude:30,latitude:89.9999}]){
  const points=Array.from({length:160},(_,i)=>[((center.longitude+(i%16-8)*.0001+540)%360)-180,Math.min(90,center.latitude+(Math.floor(i/16)-5)*.0001)]);
  const c=fixture(points),origin={...center,id:2025999999};const q=scanNearby(c,points.length,{origin,filters:emptyFilters(),take:100});
  const expected=points.map(([longitude,latitude],i)=>({id:2025000001+i,d:distanceMeters(center,{longitude,latitude})})).filter(p=>p.d<=50+1e-6).sort((a,b)=>a.d-b.d||a.id-b.id);
  assert.equal(q.count,expected.length);assert.deepEqual(q.items.map(i=>i.handle.id),expected.slice(0,100).map(i=>i.id));
 }
});
test('Near responses stay bounded, retain exact total and merge/paginate across worker shards deterministically',()=>{
 const c=fixture(Array.from({length:140},()=>[10,53])),origin={id:2025999999,longitude:10,latitude:53};
 const q=scanNearby(c,140,{origin,filters:emptyFilters(),take:40});assert.equal(q.count,140);assert.equal(q.items.length,40);
 assert.deepEqual(mergeNearby([q],20).items.map(i=>i.handle.id),Array.from({length:20},(_,i)=>2025000021+i));
 assert.equal(mergeNearby([q],0,40).items.length,40);assert.throws(()=>mergeNearby([q],100));
 assert.equal(scanNearby(c,140,{origin,filters:{...emptyFilters(),pkw:0}}).count,0);
});
