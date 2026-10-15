import {latLngToCell} from 'h3-js';
let positions=new Float64Array(),latest=0;
const cache=new Map();
self.onmessage=async({data})=>{
  if(data.type==='init'){positions=data.positions;latest++;cache.clear();return;}
  const token=++latest,{id,resolution}=data;
  try{
    let result=cache.get(resolution);const cached=!!result;
    if(!result){const start=performance.now(),bins=new Map();
      for(let i=0;i<positions.length;i+=2){const cell=latLngToCell(positions[i+1],positions[i],resolution);bins.set(cell,(bins.get(cell)||0)+1);if(i%16384===0){await new Promise(r=>setTimeout(r,0));if(token!==latest)return;}}
      const cells=[...bins].map(([id,count])=>({id,count})),count=cells.reduce((n,c)=>n+c.count,0);if(count!==positions.length/2)throw new Error('Сумма H3 не совпала с отбором');
      result={cells,count,totalCells:cells.length,resolution,indexMs:performance.now()-start};cache.set(resolution,result);while(cache.size>2)cache.delete(cache.keys().next().value);
    }else{cache.delete(resolution);cache.set(resolution,result);}
    if(token===latest)self.postMessage({...result,id,cached});
  }catch(e){if(token===latest)self.postMessage({id,error:e.message});}
};
