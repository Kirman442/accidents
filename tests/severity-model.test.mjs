import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSeverity,severityYears,severityGroups,severitySummary,severityConditions,severityPairs,pairAxisMax,total,share} from '../src/app/severity-model.js';
const data=JSON.parse(readFileSync(new URL('../public/analytics/severity.json',import.meta.url),'utf8'));
const overview=JSON.parse(readFileSync(new URL('../public/analytics/overview.json',import.meta.url),'utf8'));
test('severity joint aggregates reconcile with independent overview for all 714 slices',()=>{
  assert.equal(validateSeverity(data,overview.generation),data);
  for(const year of severityYears)for(let region=0;region<=16;region++)for(const group of severityGroups){const expected=region?overview.years[year].lands[region]:overview.years[year].national,row=data.years[year][region][group];assert.equal(total(row.category),group==='all'?expected.count:expected.participation[group]);if(group==='all')assert.deepEqual(row.category,expected.category);}
});
test('conditions preserve per-combination denominators and all categories under aggregation',()=>{
  const s=severitySummary(data,[2025],0,'all'),pairs=severityPairs(s);assert.deepEqual(s.category,[2477,40430,230100]);assert.equal(pairs.length,9);assert.equal(total(pairs.map(p=>p.count)),273007);assert.deepEqual(pairs[6].category,[396,5115,25110]);assert.equal(pairs[6].count,30621);assert.equal(pairs[6].value,5511/30621*100);
  for(const axis of ['light','road']){const rows=severityConditions(s,axis);for(let k=0;k<3;k++)assert.equal(total(rows.map(row=>row[k])),s.category[k]);}
  const selected=severitySummary(data,[2025],2,'pkw');assert.equal(total(selected.category),4441);assert.ok(Math.abs(severityPairs(selected)[5].value-100/3)<1e-12);assert.equal(pairAxisMax(severityPairs(selected)),35);
  const period=severitySummary(data,severityYears,2,'pkw');assert.equal(total(period.category),total(severityYears.map(year=>overview.years[year].lands[2].participation.pkw)));
});
test('empty combinations remain undefined percentages, real zero and large rates retain their meaning',()=>{
  assert.equal(share(0,0),null);assert.equal(share(0,3),0);assert.equal(share(3,3),100);
  const empty=severityPairs({category:[0,0,0],conditions:Array(27).fill(0)});assert.ok(empty.every(p=>p.value===null));assert.equal(pairAxisMax(empty),20);assert.equal(pairAxisMax([{value:100}]),100);
});
test('severity validation rejects stale generations, redistributed categories and altered lands',()=>{
  assert.throws(()=>validateSeverity(data,'stale'));
  for(const mutate of [d=>delete d.years[2025][2].pkw,d=>d.years[2025][0].all.conditions[0]++,d=>{d.years[2025][0].all.category[0]++;d.years[2025][0].all.category[1]--;d.years[2025][0].all.conditions[0]++;d.years[2025][0].all.conditions[1]--;},d=>d.years[2020][2].all.conditions[2]=-1]){const bad=structuredClone(data);mutate(bad);assert.throws(()=>validateSeverity(bad,overview.generation));}
});
