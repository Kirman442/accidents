import test from 'node:test';
import assert from 'node:assert/strict';
test('hex worker caches counts, limits drawing to window and discards superseded work',async()=>{
  const replies=[];globalThis.self={postMessage:r=>replies.push(r)};
  try{
    await import('../prototypes/hex-lab.worker.js');
    const send=data=>self.onmessage({data});
    await send({type:'init',positions:new Float64Array([13.405,52.52,13.405,52.52,11.57,48.14])});
    await send({id:1,resolution:8,bounds:[13.3,52.4,13.5,52.6]});
    assert.equal(replies[0].count,3);assert.ok(replies[0].cells.length<replies[0].totalCells);assert.equal(replies[0].cached,false);
    await send({id:2,resolution:8,bounds:[5,47,16,56]});
    assert.equal(replies[1].cached,true);assert.equal(replies[1].cells.reduce((s,c)=>s+c.count,0),3);
    const older=send({id:3,resolution:5,bounds:[5,47,16,56]});const newer=send({id:4,resolution:6,bounds:[5,47,16,56]});
    await Promise.all([older,newer]);assert.ok(!replies.some(r=>r.id===3));assert.equal(replies.at(-1).id,4);
    await send({type:'init',positions:new Float64Array()});await send({id:5,resolution:8,bounds:[5,47,16,56]});
    assert.equal(replies.at(-1).count,0);assert.equal(replies.at(-1).cached,false);
  }finally{delete globalThis.self;}
});
