import assert from 'node:assert/strict';
import {test} from 'node:test';
import {summarizeFrames,cameraRange} from '../prototypes/use-layer-benchmark.js';
test('frame report captures tail latency rather than only average',()=>{
  const report=summarizeFrames([16,17,16,100]);
  assert.equal(report.meanMs,37.25);assert.equal(report.p95Ms,100);assert.equal(report.maxMs,100);assert.equal(report.over50,1);
  assert.equal(summarizeFrames([]).meanMs,0);
});
test('actual camera audit detects stationary and moving cameras',()=>{
  assert.equal(cameraRange([{longitude:10,zoom:5},{longitude:10,zoom:5}]).longitudeSpan,0);
  const moved=cameraRange([{longitude:9.2,zoom:4.25},{longitude:10.8,zoom:5.75}]);
  assert.ok(moved.longitudeSpan>1.5);assert.equal(moved.zoomSpan,1.5);
  assert.equal(cameraRange([]).samples,0);
});
