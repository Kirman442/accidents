import {domains,participants} from '../benchmark/analytics.js';
import {accidentTypes,accidentPatterns} from './scenario-labels.js';
export const allHours=Array.from({length:24},(_,i)=>i);
export const periods=['Ночь','Утро','День','Вечер'].map((label,i)=>({label:label+' · '+String(i*6).padStart(2,'0')+'–'+String(i*6+5).padStart(2,'0'),hours:allHours.slice(i*6,i*6+6)}));
export const seasons=[{label:'Зима',values:[12,1,2]},{label:'Весна',values:[3,4,5]},
  {label:'Лето',values:[6,7,8]},{label:'Осень',values:[9,10,11]}];
export const fields={
  month:{label:'Месяцы',options:['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'].map((label,i)=>({label,value:i+1}))},
  weekday:{label:'Дни недели',options:['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'].map((label,i)=>({label,value:i===6?1:i+2}))},
  hour:{label:'Время суток',options:periods.map((p,value)=>({...p,value}))},
  category:{label:'Последствия',options:['С погибшими','С тяжелоранеными','С легкоранеными'].map((label,i)=>({label,value:i+1}))},
  light:{label:'Освещение',options:['Дневной свет','Сумерки','Темнота'].map((label,value)=>({label,value}))},
  road_condition:{label:'Состояние дороги',options:['Сухо','Мокро / влажно / скользко','Зимняя скользкость'].map((label,value)=>({label,value}))}
  ,accident_pattern:{label:'Ситуация ДТП',options:accidentPatterns.slice(1).map((label,i)=>({label,value:i+1}))}
  ,accident_type:{label:'Характер столкновения',options:accidentTypes.map((label,value)=>({label,value}))}
};
export const participantNames={pkw:'Pkw',rad:'Велосипедисты',fuss:'Пешеходы',krad:'Мототранспорт',gkfz:'Грузовые ТС',other_participant:'Другие участники'};
export function emptyFilters(){return Object.fromEntries([...Object.keys(fields).map(k=>[k,k==='hour'?[...allHours]:[]]),...participants.map(k=>[k,null])]);}
export function validateMapFilters(filters){
  if(!filters||typeof filters!=='object'||Array.isArray(filters))throw new Error('Некорректные фильтры карты');
  for(const [key,value] of Object.entries(filters)){
    if(participants.includes(key)){if(value!==null&&value!==0&&value!==1)throw new Error('Некорректный участник '+key);}
    else if(key in fields){if(!Array.isArray(value)||new Set(value).size!==value.length||value.some(v=>!Number.isInteger(v)||v<domains[key][0]||v>domains[key][1]))throw new Error('Некорректный фильтр '+key);}
    else throw new Error('Неизвестный фильтр '+key);
  }
}
export function queryColumns(columns,rows,filters){
  validateMapFilters(filters);
  const keys=[...Object.keys(fields),...participants],sets=Object.fromEntries(Object.keys(fields).map(k=>[k,new Set(filters[k]??(k==='hour'?allHours:[]))]));
  const facets=Object.fromEntries(keys.map(k=>[k,Array(domains[k][1]+1).fill(0)]));
  const mask=new Uint8Array(rows);let count=0;
  for(let i=0;i<rows;i++){
    const values=keys.map(k=>columns[k].get(i));let failed=-1,failures=0;
    for(let j=0;j<keys.length;j++){
      const k=keys[j],v=values[j],ok=participants.includes(k)?filters[k]==null||filters[k]===v:k==='hour'?sets[k].has(v):!sets[k].size||sets[k].has(v);
      if(!ok){failed=j;if(++failures>1)break;}
    }
    if(!failures){mask[i]=1;count++;for(let j=0;j<keys.length;j++)facets[keys[j]][values[j]]++;}
    else if(failures===1)facets[keys[failed]][values[failed]]++;
  }
  return {mask,count,facets};
}
export function mergeQueryParts(parts){
  const facets=Object.fromEntries([...Object.keys(fields),...participants].map(k=>[k,Array(domains[k][1]+1).fill(0)]));
  let count=0;for(const part of parts){count+=part.count;for(const k of Object.keys(facets))part.facets[k].forEach((n,i)=>facets[k][i]+=n);}
  return {parts,count,facets};
}

export function applyParticipantIntent(filters,group){
  if(group!=='all'&&!Object.hasOwn(participantNames,group))throw new Error('Неизвестная группа участников');
  const next={...filters,...Object.fromEntries(participants.map(k=>[k,null]))};
  if(group!=='all')next[group]=1;return next;
}
