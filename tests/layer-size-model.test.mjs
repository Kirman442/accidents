import test from 'node:test';
import assert from 'node:assert/strict';
import {WebMercatorViewport} from '@deck.gl/core';
import {chooseH3,chooseRadius,compareBin,metersPerPixel} from '../prototypes/layer-size-model.js';
test('pixel scale matches the renderer 512-unit projection',()=>{
  const viewport=new WebMercatorViewport({width:800,height:600,longitude:10,latitude:51,zoom:8});
  const a=viewport.unproject([400,300]),b=viewport.unproject([401,300]);
  const distance=(b[0]-a[0])*Math.PI/180*6378137*Math.cos(51*Math.PI/180);
  assert.ok(Math.abs(distance/metersPerPixel(8,51)-1)<.001);
});
test('screen-sized cells become geographically smaller as zoom increases',()=>{
  for(const pixels of [24,36,48]){
    const h3=[4.6,6,8,10,12].map(z=>chooseH3(z,51,pixels)),radius=[4.6,6,8,10,12].map(z=>chooseRadius(z,51,pixels));
    assert.ok(h3.every((r,i)=>!i||r>=h3[i-1]));assert.ok(radius.every((r,i)=>!i||r<radius[i-1]));
    assert.ok(radius.every((r,i)=>{const px=2*r/metersPerPixel([4.6,6,8,10,12][i],51);return px>pixels/2&&px<pixels*2;}));
  }
});
test('small movement within a size band keeps the same bins, palette matches quantize',()=>{
  assert.equal(chooseH3(7,51,24),chooseH3(7.03,51,24));assert.equal(chooseRadius(7,51,24),chooseRadius(7.03,51,24));
  assert.deepEqual([1,1667,3334,5000,6667,8334,10000,20000].map(n=>compareBin(n,10000)),[0,1,2,3,4,5,5,5]);
});
