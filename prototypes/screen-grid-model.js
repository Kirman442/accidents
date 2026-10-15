// Reference count for the aggregation bin range, including partial edge cells.
// This is an explicit correctness check, never performed during camera movement.
export function screenGridReference(positions,viewport,cellSize){
  const width=Math.ceil(viewport.width/cellSize)*cellSize,height=Math.ceil(viewport.height/cellSize)*cellSize;
  let count=0;const nearEdge=[];
  for(let i=0;i<positions.length;i+=2){const p=viewport.project([positions[i],positions[i+1],0]),inside=p[0]>=0&&p[0]<width&&p[1]>=0&&p[1]<height;if(inside)count++;
    const distance=Math.min(Math.abs(p[0]),Math.abs(p[0]-width),Math.abs(p[1]),Math.abs(p[1]-height));
    if(distance<.1&&p[0]>-1&&p[0]<width+1&&p[1]>-1&&p[1]<height+1)nearEdge.push({index:i/2,inside,distance,xy:p.slice(0,2)});
  }
  return {count,nearEdge};
}
export const countScreenGrid=(positions,viewport,cellSize)=>screenGridReference(positions,viewport,cellSize).count;
