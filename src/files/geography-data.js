const base=import.meta.env?.BASE_URL||'/accidents/';
const cache=new Map();
function memo(key,load){
  if(!cache.has(key))cache.set(key,load().catch(error=>{cache.delete(key);throw error;}));
  return cache.get(key);
}
async function read(path){
  const response=await fetch(base+'geography/'+path,{priority:'low'});
  if(!response.ok)throw new Error('Географические данные недоступны: HTTP '+response.status);
  return response.json();
}
export function validatePopulation(data){
  if(data?.schema_version!==1||data.population_date!=='2025-12-31'||data.states?.length!==16||data.districts?.length!==400)throw new Error('Несовместимая таблица населения');
  for(const [rows,key,size] of [[data.states,'state_code',2],[data.districts,'district_code',5]]){
    const codes=new Set();let total=0;
    for(const row of rows){
      if(typeof row[key]!=='string'||!new RegExp('^\\d{'+size+'}$').test(row[key])||codes.has(row[key])||!Number.isSafeInteger(row.population)||row.population<=0)throw new Error('Некорректная строка населения');
      codes.add(row[key]);total+=row.population;
    }
    if(total!==data.national_population||total!==83467117)throw new Error('Сумма населения не совпала');
  }
  for(const state of data.states){
    if(data.districts.filter(d=>d.state_code===state.state_code&&d.district_code.startsWith(state.state_code)).reduce((n,d)=>n+d.population,0)!==state.population)throw new Error('Население округов и земли не совпало');
  }
  return data;
}
export function validateStateBoundaries(data){
  if(data?.type!=='FeatureCollection'||data.features?.length!==16)throw new Error('Несовместимые границы земель');
  const codes=new Set();
  for(const feature of data.features){
    const code=feature.properties?.state_code;
    if(feature.type!=='Feature'||!/^\d{2}$/.test(code)||Number(code)<1||Number(code)>16||codes.has(code)||!['Polygon','MultiPolygon'].includes(feature.geometry?.type))throw new Error('Некорректная граница земли');
    codes.add(code);
  }
  return data;
}
function loadAsset(key,validate){return memo(key,async()=>{
  const manifest=await memo('manifest',()=>read('manifest.json'));
  const entry=manifest.files?.[key];
  if(manifest.schema_version!==1||!entry||!new RegExp('^'+key+'-[a-f0-9]{16}\\.json$').test(entry.path))throw new Error('Несовместимый каталог географии');
  return validate(await read(entry.path));
});}
export const loadStateBoundaries=()=>loadAsset('states',validateStateBoundaries);
// Only call when a report needs population. No population fetch at app/map startup.
export const loadPopulation=()=>loadAsset('population',validatePopulation);
export function populationFor(data,{year,region=0}){
  if(year!==2025)return null;
  return region===0?data.national_population:data.states.find(s=>s.state_code===String(region).padStart(2,'0'))?.population??null;
}
