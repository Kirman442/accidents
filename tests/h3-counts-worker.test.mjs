import test from 'node:test';
import assert from 'node:assert/strict';
test('H3 renderer data preserves counts, caches resolution and ignores obsolete jobs',async()=>{
  const replies=[];globalThis.self={postMessage:r=>replies.push(r)};
  try{await import('../prototypes/h3-counts.worker.js');const send=data=>self.onmessage({data});
    await send({type:'init',positions:new Float64Array([13.405,52.52,13.405,52.52,11.57,48.14])});
    await send({id:1,resolution:8});assert.equal(replies[0].count,3);assert.equal(replies[0].cells.reduce((s,c)=>s+c.count,0),3);assert.ok(replies[0].cells.some(c=>c.count===2));assert.ok(replies[0].cells.every(c=>!c.polygon));
    await send({id:2,resolution:8});assert.equal(replies[1].cached,true);
    await Promise.all([send({id:3,resolution:4}),send({id:4,resolution:5})]);assert.ok(!replies.some(r=>r.id===3));assert.equal(replies.at(-1).id,4);
    await send({type:'init',positions:new Float64Array()});await send({id:5,resolution:8});assert.equal(replies.at(-1).count,0);assert.equal(replies.at(-1).cached,false);
  }finally{delete globalThis.self;}
});
