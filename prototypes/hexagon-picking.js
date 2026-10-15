// deck.gl 9.1.8 getPickingInfo omits hexOriginCommon, while the cell shader
// adds it when drawing. Reconstruct the rendered centroid from bin IDs.
export function hexagonCenter(cell,state,viewport){
  const radius=state?.radiusCommon,origin=state?.hexOriginCommon;
  if(!Number.isInteger(cell?.col)||!Number.isInteger(cell?.row)||!Number.isFinite(radius)||radius<=0||!origin?.slice(0,2).every(Number.isFinite)||origin.length<2||!viewport?.unprojectFlat)return null;
  const common=[origin[0]+(cell.col+(cell.row&1)/2)*radius*Math.sqrt(3),origin[1]+cell.row*radius*1.5];
  const center=viewport.unprojectFlat(common).slice(0,2);
  return center.every(Number.isFinite)&&Math.abs(center[0])<=180&&Math.abs(center[1])<=85.051129?center:null;
}
