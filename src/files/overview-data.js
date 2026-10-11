export const overviewYears=[2020,2021,2022,2023,2024,2025];
export const participantNames={pkw:'Pkw · легковые автомобили',rad:'Rad · велосипеды',fuss:'Пешеходы',krad:'Мотоциклы',gkfz:'Грузовой транспорт',other_participant:'Другие участники'};
const keys=Object.keys(participantNames);
const sum=values=>values.reduce((a,b)=>a+b,0);
function count(n){if(!Number.isSafeInteger(n)||n<0)throw new Error('Некорректное число в обзоре');return n;}
export function validateOverview(data, generation=null){
  if(data?.schema_version!==1||!data.generation||!data.sources||!Array.isArray(data.fleet))throw new Error('Несовместимый обзор');
  if(generation&&data.generation!==generation)throw new Error('Обзор и карта относятся к разным наборам данных. Обновите обзор.');
  if(Object.keys(data.years||{}).join(',')!==overviewYears.join(','))throw new Error('Неполный список лет');
  for(const year of overviewYears){
    const item=data.years[year];
    if(Object.keys(item.lands||{}).length!==16)throw new Error('Неполный список земель');
    const lands=Array.from({length:16},(_,i)=>item.lands[i+1]);
    for(const stats of [item.national,...lands]){
      count(stats?.count);
      if(!Array.isArray(stats.category)||stats.category.length!==3||sum(stats.category.map(count))!==stats.count)throw new Error('Категории не совпали с числом ДТП');
      for(const key of keys)if(count(stats.participation?.[key])>stats.count)throw new Error('Участники превышают число ДТП');
    }
    if(sum(lands.map(s=>s.count))!==item.national.count||[0,1,2].some(i=>sum(lands.map(s=>s.category[i]))!==item.national.category[i])||keys.some(k=>sum(lands.map(s=>s.participation[k]))!==item.national.participation[k]))throw new Error('Сводки земель не совпали с Германией');
  }
  const seen=new Set();
  for(const row of data.fleet){
    const key=row.snapshot_date+':'+row.geography_level+':'+row.region_code;
    if(seen.has(key)||count(row.pkw)===0)throw new Error('Повтор или пустой автопарк');
    seen.add(key);
  }
  if(seen.size!==119)throw new Error('Неполный автопарк');
  for(let year=2020;year<=2026;year++)for(let land=0;land<=16;land++)if(!seen.has(`${year}-01-01:${land?'land':'national'}:${land?String(land).padStart(2,'0'):'DE'}`))throw new Error('Нет снимка автопарка');
  return data;
}
export function overviewRow(data,year,land=0){
  const stats=land?data.years[year]?.lands[land]:data.years[year]?.national;
  if(!stats)throw new Error('Нет сводки выбранного года/земли');
  const level=land?'land':'national',code=land?String(land).padStart(2,'0'):'DE';
  const find=y=>data.fleet.find(r=>r.snapshot_date===`${y}-01-01`&&r.geography_level===level&&r.region_code===code)?.pkw;
  const begin=find(year),end=find(year+1);
  const mean=begin>0&&end>0?(begin+end)/2:null;
  return {...stats,year,land,begin:begin??null,end:end??null,mean,rate:mean==null?null:stats.participation.pkw/mean*10000};
}
