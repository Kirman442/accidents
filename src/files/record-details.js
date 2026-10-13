import {participants} from '../benchmark/analytics.js';
import {validateMapFilters} from './map-query.js';
export const NEAR_RADIUS=50,NEAR_PAGE=20,NEAR_LIMIT=100,PICK_LIMIT=8;
export function rowById(columns,rows,id){
  if(!Number.isSafeInteger(id)||id<=0)throw new Error('Некорректный ключ ДТП');
  let lo=0,hi=rows-1;
  while(lo<=hi){const mid=(lo+hi)>>1,value=columns.record_id.get(mid);if(value===id)return mid;if(value<id)lo=mid+1;else hi=mid-1;}
  throw new Error('Выбранное ДТП недоступно в загруженном наборе');
}
export function recordAt(columns,index){
  const xy=columns.geometry.get(index);
  return {year:columns.year.get(index),land:columns.uland.get(index),month:columns.month.get(index),
    weekday:columns.weekday.get(index),hour:columns.hour.get(index),category:columns.category.get(index),
    accidentType:columns.accident_type.get(index),accidentPattern:columns.accident_pattern.get(index),
    light:columns.light.get(index),road:columns.road_condition.get(index),
    participants:participants.filter(k=>columns[k].get(index)===1),longitude:xy.get(0),latitude:xy.get(1)};
}
export function describeId(columns,rows,id){const index=rowById(columns,rows,id);return {handle:{id,index,land:columns.uland.get(index),year:columns.year.get(index)},record:recordAt(columns,index)};}
const R=6371008.8,rad=Math.PI/180;
export function distanceMeters(a,b){
  const dy=(b.latitude-a.latitude)*rad,dx=(b.longitude-a.longitude)*rad;
  const h=Math.sin(dy/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dx/2)**2;
  return 2*R*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
export const nearOrder=(a,b)=>a.distance-b.distance||a.handle.id-b.handle.id;
export function scanNearby(columns,rows,{origin,filters,take=NEAR_PAGE,radius=NEAR_RADIUS}){
  validateMapFilters(filters);
  if(!origin||!Number.isSafeInteger(origin.id)||!Number.isFinite(origin.longitude)||!Number.isFinite(origin.latitude)||Math.abs(origin.longitude)>180||Math.abs(origin.latitude)>90||!Number.isInteger(take)||take<1||take>NEAR_LIMIT||radius!==NEAR_RADIUS)throw new Error('Некорректный запрос окрестности');
  const angular=radius/R,dy=angular/rad,cos=Math.cos(origin.latitude*rad);
  const dx=cos>Math.sin(angular)?Math.asin(Math.sin(angular)/cos)/rad:180;
  const predicates=Object.entries(filters).filter(([k,v])=>Array.isArray(v)?k==='hour'||v.length:v!=null);
  let count=0;const kept=[];
  for(let i=0;i<rows;i++){
    const id=columns.record_id.get(i);if(id===origin.id)continue;
    const xy=columns.geometry.get(i),longitude=xy.get(0),latitude=xy.get(1);
    if(Math.abs(latitude-origin.latitude)>dy+1e-10||Math.abs(((longitude-origin.longitude+540)%360)-180)>dx+1e-10)continue;
    if(!predicates.every(([k,v])=>Array.isArray(v)?v.includes(columns[k].get(i)):columns[k].get(i)===v))continue;
    const distance=distanceMeters(origin,{longitude,latitude});if(distance>radius+1e-6)continue;
    count++;
    const candidate={index:i,distance,handle:{id,index:i,land:columns.uland.get(i),year:columns.year.get(i)}};
    if(kept.length===take&&nearOrder(candidate,kept.at(-1))>=0)continue;
    kept.push(candidate);kept.sort(nearOrder);if(kept.length>take)kept.pop();
  }
  return {count,items:kept.map(({index,...item})=>({...item,record:recordAt(columns,index)}))};
}
export function mergeNearby(results,offset=0,limit=NEAR_PAGE){
  if(!Number.isInteger(offset)||offset<0||offset>=NEAR_LIMIT||offset%NEAR_PAGE||!Number.isInteger(limit)||limit<1||limit>NEAR_LIMIT||offset+limit>NEAR_LIMIT)throw new Error('Некорректная страница окрестности');
  return {count:results.reduce((n,r)=>n+r.count,0),items:results.flatMap(r=>r.items).sort(nearOrder).slice(offset,offset+limit)};
}
