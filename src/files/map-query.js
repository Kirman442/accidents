import {domains,participants} from '../benchmark/analytics.js';
export const periods=[{label:'Ночь · 22–05',hours:[22,23,0,1,2,3,4,5]},
  {label:'Утро · 06–09',hours:[6,7,8,9]},{label:'День · 10–15',hours:[10,11,12,13,14,15]},
  {label:'Вечер · 16–21',hours:[16,17,18,19,20,21]}];
export const seasons=[{label:'Зима',values:[12,1,2]},{label:'Весна',values:[3,4,5]},
  {label:'Лето',values:[6,7,8]},{label:'Осень',values:[9,10,11]}];
export const fields={
  month:{label:'Месяцы',options:['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'].map((label,i)=>({label,value:i+1}))},
  weekday:{label:'Дни недели',options:['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'].map((label,i)=>({label,value:i===6?1:i+2}))},
  hour:{label:'Время суток',options:periods.map((p,value)=>({...p,value}))},
  category:{label:'Последствия',options:['С погибшими','С тяжелоранеными','С легкоранеными'].map((label,i)=>({label,value:i+1}))},
  light:{label:'Освещение',options:['Дневной свет','Сумерки','Темнота'].map((label,value)=>({label,value}))},
  road_condition:{label:'Состояние дороги',options:['Сухо','Мокро / влажно / скользко','Зимняя скользкость'].map((label,value)=>({label,value}))}
};
export const participantNames={pkw:'Pkw',rad:'Велосипедисты',fuss:'Пешеходы',krad:'Мототранспорт',gkfz:'Грузовые ТС',other_participant:'Другие участники'};
export function emptyFilters(){return Object.fromEntries([...Object.keys(fields).map(k=>[k,[]]),...participants.map(k=>[k,null])]);}
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
  const keys=[...Object.keys(fields),...participants],sets=Object.fromEntries(Object.keys(fields).map(k=>[k,new Set(filters[k]||[])]));
  const facets=Object.fromEntries(keys.map(k=>[k,Array(domains[k][1]+1).fill(0)]));
  const mask=new Uint8Array(rows);let count=0;
  for(let i=0;i<rows;i++){
    const values=keys.map(k=>columns[k].get(i));let failed=-1,failures=0;
    for(let j=0;j<keys.length;j++){
      const k=keys[j],v=values[j],ok=participants.includes(k)?filters[k]==null||filters[k]===v:!sets[k].size||sets[k].has(v);
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
