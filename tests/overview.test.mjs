import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {validateOverview,overviewRow,overviewYears} from '../src/files/overview-data.js';
import {fleetRate} from '../src/benchmark/analytics.js';
import {parseCsv,prepareOverview} from '../scripts/prepare-overview.mjs';
const data=JSON.parse(readFileSync(new URL('../public/analytics/overview.json',import.meta.url),'utf8'));
test('complete real overview reconciles national/land severity and participant totals',()=>{
  assert.equal(validateOverview(data),data);
  assert.deepEqual(overviewYears.map(y=>data.years[y].national.count),[237994,238826,256492,269048,268519,273007]);
  assert.equal(data.fleet.length,119);
  assert.ok(Object.values(data.years[2025].national.participation).reduce((a,b)=>a+b,0)>data.years[2025].national.count);
});
test('all 102 rates use their own region and both snapshots, matching audited benchmark',()=>{
  for(const year of overviewYears)for(let land=0;land<=16;land++){
    const actual=overviewRow(data,year,land),oracle=fleetRate(actual,data.fleet,year,land||null);
    assert.equal(actual.begin,oracle.begin);assert.equal(actual.end,oracle.end);
    assert.equal(actual.mean,oracle.mean);assert.equal(actual.rate,oracle.rate);
    assert.equal(actual.rate,actual.participation.pkw/((actual.begin+actual.end)/2)*10000);
  }
});
test('missing fleet endpoint is unavailable, never silently zero',()=>{
  const partial=structuredClone(data);partial.fleet=partial.fleet.filter(r=>!(r.snapshot_date==='2026-01-01'&&r.region_code==='05'));
  assert.equal(overviewRow(partial,2025,5).rate,null);
  assert.equal(overviewRow(partial,2025,5).end,null);
  assert.throws(()=>validateOverview(partial));
});
test('invalid generation, missing lands, duplicate fleet, corrupt totals are rejected',()=>{
  assert.throws(()=>validateOverview(data,'another-generation'),/разным/);
  for(const mutate of [d=>delete d.years[2021].lands[3],d=>d.fleet[1]=d.fleet[0],d=>d.years[2025].national.count++,d=>d.years[2025].lands[5].participation.pkw++,d=>d.fleet[0].pkw=0]){
    const invalid=structuredClone(data);mutate(invalid);assert.throws(()=>validateOverview(invalid));
  }
});
test('KBA CSV parser preserves quoted commas, quotes, BOM, CRLF and final row',()=>{
  assert.deepEqual(parseCsv('\uFEFFname,pkw\r\n"A,B",10\r\n"A""B",20'),[{name:'A,B',pkw:'10'},{name:'A"B',pkw:'20'}]);
  assert.throws(()=>parseCsv('a,b\n1'));assert.throws(()=>parseCsv('a,b\n"1,2'));
});
test('preparer validates input hashes, excludes districts and produces reproducible overview',()=>{
  const folder=mkdtempSync(join(tmpdir(),'uad-overview-test-'));
  try{
    // Temporary fixture contains real audited national/land values; do not depend on external data paths.
    const summaries={years:Object.fromEntries(overviewYears.map(y=>[y,{national:expand(data.years[y].national),lands:Object.fromEntries(Object.entries(data.years[y].lands).map(([k,s])=>[k,expand(s)]))}]))};
    const files={'analytics/accident_summaries.json':JSON.stringify(summaries),'analytics/fleet_snapshots.csv':'snapshot_date,geography_level,region_code,pkw\n'+data.fleet.map(r=>[r.snapshot_date,r.geography_level,r.region_code,r.pkw].join(',')).join('\n')+'\n2020-01-01,district,08111,123\n'};
    // mkdir through built-in recursive directory creation, fixture only.
    return import('node:fs').then(({mkdirSync})=>{
      mkdirSync(join(folder,'analytics'));
      for(const [path,text] of Object.entries(files))writeFileSync(join(folder,path),text);
      const manifest={status:'complete',generation:data.generation,files:Object.entries(files).map(([path,text])=>({path,sha256:createHash('sha256').update(text).digest('hex')}))};
      writeFileSync(join(folder,'manifest.json'),JSON.stringify(manifest));
      const first=prepareOverview(folder);assert.deepEqual(first.years,data.years);assert.deepEqual(first.fleet,data.fleet);assert.deepEqual(prepareOverview(folder),first);
      writeFileSync(join(folder,'analytics/fleet_snapshots.csv'),'tampered');assert.throws(()=>prepareOverview(folder),/checksum/);
    }).finally(()=>rmSync(folder,{recursive:true,force:true}));
  }catch(e){rmSync(folder,{recursive:true,force:true});throw e;}
});
function expand(s){return {count:s.count,distributions:{category:Object.fromEntries(s.category.map((n,i)=>[i+1,n]))},participation:s.participation};}
