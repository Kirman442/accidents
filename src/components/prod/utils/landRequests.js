
export const landTables = Array.from({length:16},(_,i)=>'unfallatlas_uland_'+String(i+1).padStart(2,'0'));
const abort = signal => { if (signal?.aborted) throw new DOMException('Loading cancelled','AbortError'); };
export function landNumber(table) {
  if (!landTables.includes(table)) throw new Error('Unknown land table');
  return Number(table.slice(-2));
}
// No exact count. A short page can reflect the server Max Rows limit: continue until empty.
export async function fetchLand(client, table, columns, {signal,pageSize=20000}={}) {
  const land = landNumber(table);
  const rows = [];
  let offset = 0, lastId = null;
  while (true) {
    abort(signal);
    const response = await client.from(table).select(columns)
      .order('oid',{ascending:true}).range(offset,offset+pageSize-1).abortSignal(signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000));
    abort(signal);
    if (response.error) throw new Error(table+': '+response.error.message, {cause:response.error});
    if (!Array.isArray(response.data)) throw new Error(table+': invalid response');
    if (!response.data.length) break;
    for (const row of response.data) {
      if (row.oid == null || !/^\d+$/.test(String(row.oid)) ||
          (typeof row.oid === 'number' && !Number.isSafeInteger(row.oid))) throw new Error(table+': invalid oid');
      const id = BigInt(row.oid);
      if (lastId !== null && id <= lastId) throw new Error(table+': duplicate or unordered oid');
      if (row.uland != null && Number(row.uland) !== land) throw new Error(table+': wrong land');
      lastId = id;
      rows.push({...row,uland:land});
    }
    offset += response.data.length;
  }
  return rows;
}
export function toFeatures(rows) {
  return rows.map(row => {
    const longitude = Number(row.xgcswgs84), latitude = Number(row.ygcswgs84);
    if (row.xgcswgs84 == null || row.ygcswgs84 == null || row.xgcswgs84 === '' || row.ygcswgs84 === '' ||
      !Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude)>180 || Math.abs(latitude)>90)
      throw new Error('Invalid coordinates for land '+row.uland+', oid '+row.oid);
    return {type:'Feature',properties:{oid:row.oid,uland:row.uland},
      geometry:{type:'Point',coordinates:[longitude,latitude]},latitude,longitude};
  });
}
export function mergeAttributes(features, attributes) {
  const identity = p => p.uland+':'+p.oid;
  const map = new Map();
  for (const row of attributes) {
    const key = identity(row);
    if (map.has(key)) throw new Error('Duplicate attributes: '+key);
    map.set(key,row);
  }
  const merged = features.map(feature => {
    const key = identity(feature.properties), row = map.get(key);
    if (!row) throw new Error('Missing attributes: '+key);
    map.delete(key);
    return {...feature,properties:{...feature.properties,...row}};
  });
  if (map.size) throw new Error('Attributes without coordinates');
  return merged;
}
export async function loadPhase(tables, task, signal, concurrency=4, onComplete) {
  const results = new Array(tables.length);
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(concurrency,tables.length)},async()=>{
    while (cursor<tables.length) {
      abort(signal);
      const index=cursor++;
      results[index]=await task(tables[index]);
      abort(signal);
      onComplete?.(results[index], tables[index]);
    }
  }));
  return results.flat();
}
