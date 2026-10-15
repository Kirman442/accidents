export const HEX_RADIUS=1000;
export const mapPalette=[[58,77,87],[62,102,112],[68,130,132],[86,153,141],[125,178,143],[192,201,150]];
export function autoMode(previous,zoom){return previous==='points'?(zoom<9.8?'hex':'points'):(zoom>=10.2?'points':'hex');}
export function displayMode(mode,automatic){return mode==='auto'||mode==='hex'?automatic:mode;}
export function filteredSnapshot(source,masks,year){
  const count=source.reduce((n,p)=>n+(masks.get(p.land)?.reduce((a,v)=>a+v,0)||0),0),positions=new Float64Array(count*3),handles=[];
  let j=0;for(const p of source){const mask=masks.get(p.land);for(let i=0;i<p.ids.length;i++)if(mask?.[i]){positions[j*3]=p.positions[i*2];positions[j*3+1]=p.positions[i*2+1];handles.push({land:p.land,id:p.ids[i],index:i,year});j++;}}
  return {positions,handles,binary:{length:count,attributes:{getPosition:{value:positions,size:3}}}};
}
export function boundaryBounds(data,land){
  const points=[];function collect(c){if(typeof c[0]==='number')points.push(c);else c.forEach(collect);}
  data.features.filter(f=>!land||Number(f.properties.state_code)===land).forEach(f=>collect(f.geometry.coordinates));
  if(!points.length)return null;
  return points.reduce((b,[x,y])=>[[Math.min(b[0][0],x),Math.min(b[0][1],y)],[Math.max(b[1][0],x),Math.max(b[1][1],y)]],[[180,90],[-180,-90]]);
}
