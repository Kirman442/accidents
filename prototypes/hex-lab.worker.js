import {latLngToCell,cellToBoundary,cellToLatLng,cellArea} from 'h3-js';
let positions=new Float64Array(),latest=0;
const cache=new Map();
self.onmessage=async({data})=>{
  if(data.type==='init'){positions=data.positions;cache.clear();latest++;return;}
  const token=++latest,{id,resolution,bounds}=data;
  try{
    let indexed=cache.get(resolution);const cached=!!indexed;
    if(!indexed){
      const start=performance.now(),bins=new Map();
      for(let i=0;i<positions.length;i+=2){const cell=latLngToCell(positions[i+1],positions[i],resolution);bins.set(cell,(bins.get(cell)||0)+1);
        if(i%8192===0){await new Promise(resolve=>setTimeout(resolve,0));if(token!==latest)return;}}
      const count=[...bins.values()].reduce((s,n)=>s+n,0);if(count!==positions.length/2)throw new Error('Число ДТП в ячейках не совпало с отбором');
      indexed={bins,count,indexMs:performance.now()-start};cache.set(resolution,indexed);while(cache.size>2)cache.delete(cache.keys().next().value);
    }else{cache.delete(resolution);cache.set(resolution,indexed);}
    const start=performance.now(),cells=[],margin=[.3,.12,.05,.02][resolution-5];
    for(const [cell,count] of indexed.bins){const center=cellToLatLng(cell).reverse();
      if(center[0]<bounds[0]-margin||center[0]>bounds[2]+margin||center[1]<bounds[1]-margin||center[1]>bounds[3]+margin)continue;
      cells.push({id:cell,count,center,polygon:cellToBoundary(cell,true),area:cellArea(cell,'km2')});}
    if(token===latest)self.postMessage({id,cells,count:indexed.count,totalCells:indexed.bins.size,resolution,cached,indexMs:indexed.indexMs,geometryMs:performance.now()-start});
  }catch(e){if(token===latest)self.postMessage({id,error:e.message});}
};
