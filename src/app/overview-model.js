import {overviewRow,overviewYears} from '../files/overview-data.js';
export const overviewMetrics={count:'Количество ДТП',severity:'Доля тяжёлых последствий, %',rate:'ДТП с Pkw на 10 000 Pkw'};
export function overviewStats(data,year,region){
  const row=overviewRow(data,year,region);
  return {...row,severity:row.count?(row.category[0]+row.category[1])/row.count*100:null};
}
export function overviewComparison(data,year,metric){
  return Array.from({length:16},(_,i)=>overviewStats(data,year,i+1)).sort((a,b)=>(b[metric]??-1)-(a[metric]??-1)||a.land-b.land);
}
export function overviewTrend(data,region,metric,mode){
  const index=region!==0&&metric==='count'&&mode==='line';
  const series=land=>{
    const rows=overviewYears.map(year=>overviewStats(data,year,land));
    return rows.map(row=>({year:row.year,value:index?(rows[0].count?row.count/rows[0].count*100:null):row[metric]}));
  };
  return {index,selected:series(region),national:region!==0&&mode==='line'?series(0):null};
}
export function overviewChange(current,previous,points=false){
  if(current==null||previous==null||(!points&&previous===0))return null;
  return points?current-previous:(current/previous-1)*100;
}
