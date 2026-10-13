export const timeYears=[2020,2021,2022,2023,2024,2025];
export const timeGroups=['all','pkw','rad','fuss','krad','gkfz','other_participant'];
export const monthNames=['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
export const fullMonths=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
export const dayNames=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
export const shortDays=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
export const timePeriods=['Ночь 00–05','Утро 06–11','День 12–17','Вечер 18–23'];
const sum=values=>values.reduce((a,b)=>a+b,0);
export function validateTime(data,generation){
  if(data?.schema_version!==1||data.generation!==generation||!data.source||!data.checksums||data.groups?.join(',')!==timeGroups.join(',')||Object.keys(data.years||{}).join(',')!==timeYears.join(','))throw new Error('Несовместимые сводки времени или поколение данных');
  const count=n=>{if(!Number.isSafeInteger(n)||n<0)throw new Error('Некорректное число ДТП');return n;};
  for(const year of timeYears){
    if(!/^[a-f0-9]{64}$/.test(data.checksums[year]||'')||Object.keys(data.years[year]).length!==17)throw new Error('Неполные сводки времени');
    for(let region=0;region<=16;region++)for(const group of timeGroups){
      const row=data.years[year][region]?.[group];count(row?.count);
      if(row?.month?.length!==12||row?.weekhour?.length!==168||sum(row.month.map(count))!==row.count||sum(row.weekhour.map(count))!==row.count)throw new Error('Сводки времени не совпали с числом ДТП');
      if(row.count>data.years[year][region].all.count)throw new Error('Участники превышают все ДТП');
    }
    for(const group of timeGroups){const national=data.years[year][0][group],lands=Array.from({length:16},(_,i)=>data.years[year][i+1][group]);
      if(sum(lands.map(r=>r.count))!==national.count||national.month.some((n,i)=>sum(lands.map(r=>r.month[i]))!==n)||national.weekhour.some((n,i)=>sum(lands.map(r=>r.weekhour[i]))!==n))throw new Error('Временные сводки земель не совпали с Германией');}
  }
  return data;
}
export function timeCalendar(years){
  const month=Array(12).fill(0),weekday=Array(7).fill(0);
  for(const y of years){if(!timeYears.includes(y))throw new Error('Нет календаря выбранного года');for(let m=0;m<12;m++){const days=new Date(Date.UTC(y,m+1,0)).getUTCDate();month[m]+=days;for(let d=1;d<=days;d++)weekday[(new Date(Date.UTC(y,m,d)).getUTCDay()+6)%7]++;}}
  return {month,weekday,total:sum(month)};
}
export function timeSummary(data,years,region,group){
  const result={count:0,month:Array(12).fill(0),weekhour:Array(168).fill(0)};
  for(const year of years){const row=data.years[year]?.[region]?.[group];if(!row)throw new Error('Нет сводки времени выбранного контекста');result.count+=row.count;row.month.forEach((v,i)=>result.month[i]+=v);row.weekhour.forEach((v,i)=>result.weekhour[i]+=v);}
  return result;
}
export function timeValue(raw,denominator,total,unit){return unit==='daily'?(denominator?raw/denominator:0):unit==='share'?(total?raw/total*100:0):raw;}
export function timeDayCells(summary,calendar,unit,{mode='days',day='all',period='all'}={}){
  const selectedDays=Array.from({length:7},(_,i)=>i).filter(d=>day==='all'||day==='work'&&d<5||day==='weekend'&&d>=5||String(d)===day);
  const hours=Array.from({length:24},(_,i)=>i).filter(h=>period==='all'||Math.floor(h/6)===Number(period));
  const columns=mode==='hours'?hours.map(h=>({label:String(h).padStart(2,'0')+':00',hours:[h]})):mode==='days'?[{label:'Показанные часы',hours}]:Array.from({length:4},(_,i)=>({label:timePeriods[i],hours:hours.filter(h=>Math.floor(h/6)===i)})).filter(c=>c.hours.length);
  const cells=selectedDays.flatMap(d=>columns.map((col,column)=>{const raw=sum(col.hours.map(h=>summary.weekhour[d*24+h]));return {day:d,column,label:col.label,raw,denominator:calendar.weekday[d],value:timeValue(raw,calendar.weekday[d],summary.count,unit)};}));
  return {days:selectedDays,columns,cells};
}
export const timeSeasons={all:[0,1,2,3,4,5,6,7,8,9,10,11],winter:[0,1,11],spring:[2,3,4],summer:[5,6,7],autumn:[8,9,10]};
