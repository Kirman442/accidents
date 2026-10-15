import test from 'node:test';
import assert from 'node:assert/strict';
import {filteredSnapshot,autoMode,displayMode,boundaryBounds} from '../src/files/map-layer-model.js';
import {queryColumns,mergeQueryParts,emptyFilters} from '../src/files/map-query.js';
import {domains} from '../src/benchmark/analytics.js';
import {sharedContexts,contextFor} from '../src/app/shell-state.js';
test('selected categories count only matching incidents, unlike self-excluding facets',()=>{
  const columns=Object.fromEntries(Object.entries(domains).map(([k,[min]])=>[k,{get:()=>min}]));
  columns.category={get:i=>i+1};
  const q=queryColumns(columns,3,{...emptyFilters(),category:[2]});
  assert.equal(q.count,1);assert.deepEqual(q.category,[0,1,0]);assert.deepEqual(q.facets.category,[0,1,1,1]);
  assert.deepEqual(mergeQueryParts([q,q]).category,[0,2,0]);
  assert.deepEqual(queryColumns(columns,3,{...emptyFilters(),hour:[]}).category,[0,0,0]);
});
test('binary aggregation snapshot preserves every matching incident and original pick handles',()=>{
  const parts=[{land:2,ids:[10,11,12],positions:[10,53,10,53,11,54]}];
  const snapshot=filteredSnapshot(parts,new Map([[2,new Uint8Array([1,1,0])]]),2025);
  assert.deepEqual([...snapshot.positions],[10,53,0,10,53,0]);assert.equal(snapshot.binary.length,2);
  assert.equal(snapshot.binary.attributes.getPosition.value,snapshot.positions);assert.equal(snapshot.handles[1].index,1);
  assert.equal(filteredSnapshot(parts,new Map([[2,new Uint8Array(3)]]),2025).binary.length,0);
});
test('automatic layer hysteresis avoids repeated switches at zoom 10',()=>{
  assert.equal(autoMode('hex',10.1),'hex');assert.equal(autoMode('hex',10.2),'points');
  assert.equal(autoMode('points',10),'points');assert.equal(autoMode('points',9.7),'hex');
});
test('cells mode follows the same zoom policy as auto; forced points and heat remain independent',()=>{
  for(const policy of ['auto','hex']){assert.equal(displayMode(policy,autoMode('hex',9)),'hex');assert.equal(displayMode(policy,autoMode('hex',11)),'points');assert.equal(displayMode(policy,autoMode('points',9.7)),'hex');}
  assert.equal(displayMode('heat','points'),'heat');assert.equal(displayMode('points','hex'),'points');
});
test('shared single year and region do not clamp the independent analysis period',()=>{
  const years=[2020,2021,2022,2023,2024,2025],c=Object.fromEntries(['overview','map','time','severity'].map(k=>[k,contextFor(k,{year:2024,from:2020,to:2022},years)]));
  const changed=sharedContexts({...c,map:{region:9,year:2023}},'map');
  assert.equal(changed.overview.year,2023);assert.equal(changed.time.to,2022);assert.equal(changed.severity.region,9);
  const analysis=sharedContexts({...changed,severity:{region:9,from:2021,to:2025,year:2025,group:'rad'}},'severity');
  assert.equal(analysis.map.year,2023);assert.equal(analysis.time.group,'rad');assert.equal(analysis.time.to,2025);
});
test('land fit bounds include polygons and multipolygons without changing selection',()=>{
  const data={features:[{properties:{state_code:'09'},geometry:{coordinates:[[[10,48],[13,50],[10,48]]] }},{properties:{state_code:'11'},geometry:{coordinates:[[[[13,52],[14,53],[13,52]]]]}}]};
  assert.deepEqual(boundaryBounds(data,9),[[10,48],[13,50]]);assert.deepEqual(boundaryBounds(data,0),[[10,48],[14,53]]);
});
