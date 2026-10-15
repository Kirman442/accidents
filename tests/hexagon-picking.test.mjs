import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WebMercatorViewport} from '@deck.gl/core';
import {hexagonCenter} from '../prototypes/hexagon-picking.js';
test('picked hex center includes grid origin and stays independent of zoom',()=>{
  for(const zoom of [4.6,9,13]){
    const viewport=new WebMercatorViewport({width:800,height:500,longitude:13.4,latitude:52.5,zoom});
    const origin=viewport.projectFlat([13.4,52.5]),radius=.02;
    for(const [col,row] of [[0,0],[4,3],[-4,-3]]){
      const center=hexagonCenter({col,row,position:[-180,-85]},{radiusCommon:radius,hexOriginCommon:origin},viewport);
      const common=viewport.projectFlat(center);
      assert.ok(Math.abs(common[0]-(origin[0]+(col+(row&1)/2)*radius*Math.sqrt(3)))<1e-9);
      assert.ok(Math.abs(common[1]-(origin[1]+row*radius*1.5))<1e-9);
      assert.ok(center[0]>13&&center[0]<14&&center[1]>52&&center[1]<53);
    }
  }
});
test('missing or invalid layer state does not provide a navigation target',()=>{
  const viewport=new WebMercatorViewport();
  assert.equal(hexagonCenter({col:0,row:0},null,viewport),null);
  assert.equal(hexagonCenter({col:0,row:0},{radiusCommon:NaN,hexOriginCommon:[0,0]},viewport),null);
});
