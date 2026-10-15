import test from 'node:test';
import assert from 'node:assert/strict';
import {loadStateBoundaries,loadPopulation,populationFor,validatePopulation,validateStateBoundaries} from '../src/files/geography-data.js';
const states=Array.from({length:16},(_,i)=>({state_code:String(i+1).padStart(2,'0'),population:25+(i===0?83466717:0)}));
const districts=states.flatMap(s=>Array.from({length:25},(_,i)=>({state_code:s.state_code,district_code:s.state_code+String(i+1).padStart(3,'0'),population:1+(s.state_code==='01'&&i===0?83466717:0)})));
const population={schema_version:1,population_date:'2025-12-31',national_population:83467117,states,districts};
const boundaries={type:'FeatureCollection',features:states.map(s=>({type:'Feature',properties:{state_code:s.state_code},geometry:{type:'Polygon',coordinates:[[[8,50],[9,50],[9,51],[8,50]]]}}))};
test('population validates district totals and refuses unsupported years',()=>{
  assert.equal(validatePopulation(population),population);
  assert.equal(populationFor(population,{year:2025}),83467117);
  assert.equal(populationFor(population,{year:2024,region:1}),null);
  assert.equal(populationFor(population,{year:2025,region:2}),25);
  const invalid=structuredClone(population);invalid.districts[0].state_code='02';
  assert.throws(()=>validatePopulation(invalid),/округов/);
  const duplicate=structuredClone(boundaries);duplicate.features[1].properties.state_code='01';
  assert.throws(()=>validateStateBoundaries(duplicate),/граница/);
});
test('boundaries load independently; failed request retries and concurrent consumers share cache',async()=>{
  const original=globalThis.fetch,calls=[];let fail=true;
  globalThis.fetch=async(url,options)=>{
    calls.push(url);assert.equal(options.priority,'low');
    if(url.endsWith('manifest.json'))return {ok:true,json:async()=>({schema_version:1,files:{states:{path:'states-0000000000000000.json'},population:{path:'population-0000000000000000.json'}}})};
    if(url.includes('states-')&&fail){fail=false;return {ok:false,status:503};}
    return {ok:true,json:async()=>url.includes('states-')?boundaries:population};
  };
  try{
    assert.equal(calls.length,0);
    await assert.rejects(loadStateBoundaries(),/503/);
    const [a,b]=await Promise.all([loadStateBoundaries(),loadStateBoundaries()]);
    assert.equal(a,b);assert.equal(calls.filter(url=>url.includes('states-')).length,2);
    assert.equal(calls.some(url=>url.includes('population-')),false);
    await loadStateBoundaries();assert.equal(calls.length,3);
    assert.equal(await loadPopulation(),population);
    assert.equal(calls.length,4);
  }finally{globalThis.fetch=original;}
});
