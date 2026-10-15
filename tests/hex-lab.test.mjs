import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateHex,resolutionForZoom} from '../prototypes/hex-lab-model.js';
test('H3 counts preserve coincident incidents and all records across resolutions',()=>{
  const positions=new Float64Array([13.405,52.52,13.405,52.52,11.57,48.14,6.96,50.94,10.0,53.55]);
  for(const resolution of [5,6,7,8]){const result=aggregateHex(positions,resolution);assert.equal(result.count,5);assert.equal(result.cells.reduce((s,c)=>s+c.count,0),5);assert.ok(result.cells.some(c=>c.count===2));assert.ok(result.cells.every(c=>c.count>0&&c.area>0&&c.polygon.length>=6));}
});
test('empty selection creates no hexagons; zoom selects progressively finer resolutions',()=>{
  assert.deepEqual(aggregateHex(new Float64Array(),5).cells,[]);
  assert.deepEqual([5,6,7.5,9].map(resolutionForZoom),[5,6,7,8]);
});
