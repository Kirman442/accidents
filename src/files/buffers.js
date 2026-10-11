// Count unique backing buffers retained by Arrow, including dictionaries/children.
export function tableBufferBytes(table) {
  const buffers=new Set(),visited=new Set();
  function visit(data) {
    if(!data||visited.has(data))return;visited.add(data);
    for(const buffer of data.buffers || [])if(ArrayBuffer.isView(buffer))buffers.add(buffer.buffer);
    for(const child of data.children || [])visit(child);
    for(const child of data.dictionary?.data || [])visit(child);
  }
  for(const batch of table.batches)visit(batch.data);
  return [...buffers].reduce((n,b)=>n+b.byteLength,0);
}
