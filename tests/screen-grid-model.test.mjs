import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WebMercatorViewport} from '@deck.gl/core';
import {countScreenGrid} from '../prototypes/screen-grid-model.js';
test('screen sum includes the partial edge bin and excludes off-grid points',()=>{
  const viewport=new WebMercatorViewport({width:105,height:105,longitude:10,latitude:51,zoom:8});
  const positions=new Float64Array([[50,50],[110,50],[122,50],[-2,50]].flatMap(p=>viewport.unproject(p).slice(0,2)));
  assert.equal(countScreenGrid(positions,viewport,24),2);
  assert.equal(countScreenGrid(positions,viewport,5),1);
});
