import {latLngToCell,cellToBoundary,cellToLatLng,cellArea} from 'h3-js';
export const breaks=[1,10,50,100,500,1000];
export const palette=[[97,142,154,110],[84,167,165,135],[85,188,156,160],[171,193,116,180],[229,175,82,195],[231,119,70,210]];
export function resolutionForZoom(zoom){return zoom<6?5:zoom<7.5?6:zoom<9?7:8;}
export function binIndex(n){let index=0;for(let i=0;i<breaks.length;i++)if(n>=breaks[i])index=i;return index;}
export function aggregateHex(positions,resolution){
  const bins=new Map();
  for(let i=0;i<positions.length;i+=2){const id=latLngToCell(positions[i+1],positions[i],resolution);bins.set(id,(bins.get(id)||0)+1);}
  const cells=[...bins].map(([id,count])=>({id,count,polygon:cellToBoundary(id,true),center:cellToLatLng(id).reverse(),area:cellArea(id,'km2')}));
  const count=cells.reduce((sum,c)=>sum+c.count,0);
  if(count!==positions.length/2)throw new Error('Число ДТП в ячейках не совпало с отбором');
  return {cells,count,resolution};
}
