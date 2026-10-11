export const domains = {uland:[1,16],month:[1,12],hour:[0,23],weekday:[1,7],category:[1,3],
  accident_type:[0,9],accident_pattern:[1,7],light:[0,2],road_condition:[0,2],
  rad:[0,1],pkw:[0,1],fuss:[0,1],krad:[0,1],gkfz:[0,1],other_participant:[0,1]};
export const participants = ['rad','pkw','fuss','krad','gkfz','other_participant'];
export const dimensions = ['month','hour','weekday','category','accident_type','accident_pattern','light','road_condition'];
export function blankStats() {
  return {count:0,lands:Array(17).fill(0),distributions:Object.fromEntries(dimensions.map(k=>[k,Array(domains[k][1]+1).fill(0)])),
    participation:Object.fromEntries(participants.map(k=>[k,0]))};
}
export function validateFilters(filters) {
  for (const [key,value] of Object.entries(filters)) {
    if (!(key in domains) || (value!=null && (!Number.isInteger(value) || value<domains[key][0] || value>domains[key][1])))
      throw new Error('Некорректный фильтр: '+key);
  }
}
export function validateTable(table, {year,land,rows,generation}) {
  if (table.numRows!==rows || table.schema.metadata.get('uad.generation')!==generation ||
      table.schema.metadata.get('uad.coordinate_decimals')!=='5') throw new Error('Несовместимая генерация/число строк/точность');
  const columns=Object.fromEntries([...Object.keys(domains),'record_id','source_uid','year','geometry'].map(k=>{
    const column=table.getChild(k);
    if (!column || column.nullCount) throw new Error('Отсутствует колонка или есть null: '+k);
    return [k,column];
  }));
  let last=0;
  for(let i=0;i<rows;i++) {
    const id=columns.record_id.get(i), xy=columns.geometry.get(i);
    if (!Number.isSafeInteger(id) || id<=last || Math.floor(id/1e6)!==year || columns.year.get(i)!==year || columns.uland.get(i)!==land)
      throw new Error('Некорректный ID, год или земля');
    last=id;
    if (typeof columns.source_uid.get(i)!=='string' || !columns.source_uid.get(i).trim()) throw new Error('Некорректный исходный UID');
    if (!xy || xy.length!==2 || !Number.isFinite(xy.get(0)) || !Number.isFinite(xy.get(1)) ||
        Math.abs(xy.get(0))>180 || Math.abs(xy.get(1))>90) throw new Error('Некорректная геометрия');
    for (const [key,[min,max]] of Object.entries(domains)) {
      const value=columns[key].get(i);
      if (!Number.isInteger(value) || value<min || value>max) throw new Error('Некорректный атрибут: '+key);
    }
  }
  return columns;
}
// Source Arrow columns remain in the worker. Display buffers are new transferable snapshots.
export function selectTable(columns, rows, filters={}) {
  validateFilters(filters);
  const predicates=Object.entries(filters).filter(([,v])=>v!=null);
  const indices=[];
  const stats=blankStats();
  for(let i=0;i<rows;i++) {
    if (!predicates.every(([key,value])=>columns[key].get(i)===value)) continue;
    indices.push(i); stats.count++; stats.lands[columns.uland.get(i)]++;
    for (const key of dimensions) stats.distributions[key][columns[key].get(i)]++;
    for (const key of participants) stats.participation[key]+=columns[key].get(i);
  }
  const ids=new Uint32Array(indices.length), positions=new Float64Array(indices.length*2);
  indices.forEach((row,i)=>{
    ids[i]=columns.record_id.get(row);
    const point=columns.geometry.get(row); positions[i*2]=point.get(0); positions[i*2+1]=point.get(1);
  });
  return {stats,ids,positions};
}
export function combineStats(items) {
  const total=blankStats();
  for (const item of items) {
    total.count+=item.count;
    item.lands.forEach((n,i)=>total.lands[i]+=n);
    for (const key of dimensions) item.distributions[key].forEach((n,i)=>total.distributions[key][i]+=n);
    for (const key of participants) total.participation[key]+=item.participation[key];
  }
  return total;
}
export function fleetRate(stats, fleet, year, land=null) {
  const level=land==null?'national':'land', code=land==null?'DE':String(land).padStart(2,'0');
  const find=y=>fleet.find(r=>r.snapshot_date===y+'-01-01' && r.geography_level===level && r.region_code===code);
  const begin=find(year),end=find(year+1);
  if (!begin || !end) throw new Error('Нет автопарка для обоих концов года');
  const mean=(begin.pkw+end.pkw)/2;
  return {begin:begin.pkw,end:end.pkw,mean,rate:mean>0?stats.participation.pkw/mean*10000:null};
}
export function verifySummary(stats, summary) {
  if (stats.count!==summary.count) throw new Error('Число ДТП не совпадает с проверенным источником');
  for(const key of dimensions) {
    const expected=summary.distributions[key];
    stats.distributions[key].forEach((n,i)=>{
      if(n!==Number(expected[i] || 0)) throw new Error('Не совпала сводка '+key+':'+i);
    });
  }
  for(const key of participants) if(stats.participation[key]!==Number(summary.participation[key] || 0)) throw new Error('Не совпали участники '+key);
}
