export const severityYears=[2020,2021,2022,2023,2024,2025];
export const severityGroups=['all','pkw','rad','fuss','krad','gkfz','other_participant'];
export const lights=['Дневной свет','Сумерки','Темнота'];
export const roads=['Сухо','Мокро / влажно / скользко','Зимняя скользкость'];
export const categories=['С погибшими','С тяжелоранеными','С легкоранеными'];
export const total=values=>values.reduce((a,b)=>a+b,0);
export const share=(value,count)=>count?value/count*100:null;
export const severityPair=(summary,light,road)=>summary.conditions.slice((light*3+road)*3,(light*3+road)*3+3);
export function validateSeverity(data,generation){
  if(data?.schema_version!==1||data.generation!==generation||!data.source||Object.keys(data.years||{}).join(',')!==severityYears.join(','))throw new Error('Несовместимые сводки тяжести или поколение данных');
  const count=n=>{if(!Number.isSafeInteger(n)||n<0)throw new Error('Некорректное число ДТП в сводке тяжести');};
  for(const year of severityYears){
    if(!/^[a-f0-9]{64}$/.test(data.checksums?.[year]||'')||Object.keys(data.years[year]).length!==17)throw new Error('Неполные сводки тяжести');
    for(let region=0;region<=16;region++)for(const group of severityGroups){
      const row=data.years[year][region]?.[group];
      if(!Array.isArray(row?.category)||row.category.length!==3||!Array.isArray(row?.conditions)||row.conditions.length!==27)throw new Error('Неполные категории и сочетания условий');
      row.category.forEach(count);row.conditions.forEach(count);
      for(let k=0;k<3;k++)if(total(row.conditions.filter((_,i)=>i%3===k))!==row.category[k])throw new Error('Сочетания условий не совпали с категориями последствий');
      if(group!=='all'&&(row.category.some((n,i)=>n>data.years[year][region].all.category[i])||row.conditions.some((n,i)=>n>data.years[year][region].all.conditions[i])))throw new Error('Участники превышают все ДТП соответствующей категории');
    }
    for(const group of severityGroups)for(const key of ['category','conditions']){const national=data.years[year][0][group][key];if(national.some((n,i)=>total(Array.from({length:16},(_,land)=>data.years[year][land+1][group][key][i]))!==n))throw new Error('Сводки земель не совпали с Германией');}
  }
  return data;
}
export function severitySummary(data,years,region,group){
  const result={category:Array(3).fill(0),conditions:Array(27).fill(0)};
  for(const year of years){const row=data.years[year]?.[region]?.[group];if(!row)throw new Error('Нет сводки тяжести выбранного контекста');for(const key of ['category','conditions'])row[key].forEach((n,i)=>result[key][i]+=n);}
  return result;
}
export function severityConditions(summary,axis){return [0,1,2].map(i=>{const result=[0,0,0];for(let j=0;j<3;j++)severityPair(summary,axis==='light'?i:j,axis==='light'?j:i).forEach((n,k)=>result[k]+=n);return result;});}
export function severityPairs(summary){return lights.flatMap((light,i)=>roads.map((road,j)=>{const category=severityPair(summary,i,j),count=total(category);return {light,road,i,j,category,count,heavy:category[0]+category[1],value:share(category[0]+category[1],count)};}));}
export const pairAxisMax=pairs=>Math.max(20,Math.ceil(Math.max(0,...pairs.map(p=>p.value??0))/5)*5);
