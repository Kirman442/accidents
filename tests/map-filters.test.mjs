import test from 'node:test';
import assert from 'node:assert/strict';
import {tableFromArrays} from 'apache-arrow';
import {queryColumns,mergeQueryParts,emptyFilters,fields,periods,seasons,validateMapFilters} from '../src/files/map-query.js';
import {catalogYears,validateCatalog} from '../src/files/catalog.js';
import {participants} from '../src/benchmark/analytics.js';
const rows=Array.from({length:400},(_,i)=>({month:i%12+1,hour:i%24,weekday:i%7+1,category:i%3+1,
 light:Math.floor(i/3)%3,road_condition:Math.floor(i/7)%3,accident_pattern:i%7+1,accident_type:i%10,
 ...Object.fromEntries(participants.map((k,j)=>[k,(i>>j)%2]))}));
const table=tableFromArrays(Object.fromEntries(Object.keys(rows[0]).map(k=>[k,new Uint8Array(rows.map(r=>r[k]))])));
const columns=Object.fromEntries(Object.keys(rows[0]).map(k=>[k,table.getChild(k)]));
function match(r,f,except){return Object.entries(f).every(([k,v])=>k===except||(Array.isArray(v)?k==='hour'?v.includes(r[k]):!v.length||v.includes(r[k]):v==null||v===r[k]));}
test('Worker mask and self-excluding facets reconcile with independent brute-force queries',()=>{
 for(let i=0;i<60;i++){
  const f={...emptyFilters(),month:i%2?[1,2,12]:[],weekday:i%3?[1,7]:[],hour:i%4?periods[i%4].hours:[],category:i%5?[1,3]:[],accident_pattern:i%2?[1,2]:[],accident_type:i%3?[0,3,6]:[],pkw:i%3===0?null:i%2,rad:i%4===0?1:null};
  const q=queryColumns(columns,rows.length,f),expected=rows.map(r=>Number(match(r,f)));
  assert.deepEqual([...q.mask],expected);assert.equal(q.count,expected.reduce((n,v)=>n+v,0));
  for(const k of Object.keys(q.facets))for(let v=0;v<q.facets[k].length;v++)
   assert.equal(q.facets[k][v],rows.filter(r=>r[k]===v&&match(r,f,k)).length,`${i}:${k}:${v}`);
 }
});
test('Participants AND/Without, OR selections, reset, empty result, and merged lands',()=>{
 const f={...emptyFilters(),pkw:1,rad:0,category:[1,3]};const q=queryColumns(columns,rows.length,f);
 assert.ok(q.count>0);q.mask.forEach((v,i)=>{if(v){assert.equal(rows[i].pkw,1);assert.equal(rows[i].rad,0);assert.ok([1,3].includes(rows[i].category));}});
 assert.equal(queryColumns(columns,rows.length,emptyFilters()).count,rows.length);
 assert.equal(queryColumns(columns,rows.length,{...emptyFilters(),month:[1],hour:[23]}).count,0);
 const merged=mergeQueryParts([q,q]);assert.equal(merged.count,q.count*2);assert.deepEqual(merged.facets.rad,q.facets.rad.map(n=>n*2));
 assert.throws(()=>validateMapFilters({category:[4]}));assert.throws(()=>validateMapFilters({hour:[0,0]}));assert.throws(()=>validateMapFilters({rad:2}));
});
test('Period boundaries cover all hours once; source weekday codes and seasons are correct',()=>{
 assert.deepEqual(periods.flatMap(p=>p.hours).sort((a,b)=>a-b),Array.from({length:24},(_,i)=>i));
 assert.equal(fields.weekday.options.find(o=>o.label==='Воскресенье').value,1);
 assert.equal(fields.weekday.options.find(o=>o.label==='Понедельник').value,2);
 assert.equal(fields.weekday.options.find(o=>o.label==='Суббота').value,7);
 assert.deepEqual(seasons.flatMap(s=>s.values).sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+1));
});
test('Latest available year follows catalog, and incomplete/duplicate years reject',()=>{
 const manifest={status:'complete',generation:'test',files:[],shards:[2025,2026].flatMap(year=>Array.from({length:16},(_,i)=>({year,land:i+1})))};
 assert.equal(catalogYears(validateCatalog(manifest)).at(-1),2026);
 assert.throws(()=>validateCatalog({...manifest,shards:manifest.shards.slice(1)}));
 assert.throws(()=>validateCatalog({...manifest,shards:[...manifest.shards,manifest.shards[0]]}));
});
