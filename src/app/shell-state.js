export const screens={overview:'Обзор',time:'Время и сезонность',severity:'Тяжесть и условия',map:'Карта ДТП'};
export const groups={all:'Все ДТП',pkw:'С участием Pkw',rad:'С велосипедистами',fuss:'С пешеходами',krad:'С мототранспортом',gkfz:'С грузовыми ТС',other_participant:'С другими участниками'};
const integer=v=>v!==null&&v!==''&&Number.isInteger(Number(v))?Number(v):null;
export function screenKey(value){return Object.hasOwn(screens,value)?value:'overview';}
export function contextFor(screen,input={},years){
  const latest=years.at(-1),validYear=v=>years.includes(integer(v))?integer(v):latest;
  const region=integer(input.region),context={region:region!=null&&region>=0&&region<=16?region:0,year:validYear(input.year??input.to)};
  if(screen==='time'||screen==='severity'){
    const a=validYear(input.from??context.year),b=validYear(input.to??context.year);
    Object.assign(context,{from:Math.min(a,b),to:Math.max(a,b),group:Object.hasOwn(groups,input.group)?input.group:'all'});context.year=context.to;
  }
  return context;
}
export function changeContext(screen,context,field,value,years){
  const next={...context,[field]:value};
  if(field==='from'&&Number(value)>context.to)next.to=Number(value);
  if(field==='to'&&Number(value)<context.from)next.from=Number(value);
  return contextFor(screen,next,years);
}
export function initialShell(search,years,saved={}){
  const params=new URLSearchParams(search),screen=screenKey(params.get('screen'));
  const contexts=Object.fromEntries(Object.keys(screens).map(k=>[k,contextFor(k,saved?.contexts?.[k]||{},years)]));
  const incoming=Object.fromEntries(params);if(params.has('region')||params.has('year')||params.has('from')||params.has('to'))contexts[screen]=contextFor(screen,incoming,years);
  return {screen,contexts,seen:Array.isArray(saved?.seen)?saved.seen.filter(k=>Object.hasOwn(screens,k)):[],format:['arrow','parquet'].includes(saved?.format)?saved.format:'arrow',budget:[32,100].includes(saved?.budget)?saved.budget:null};
}
export function contextEqual(a,b){return JSON.stringify(a)===JSON.stringify(b);}
export function routeQuery(screen,context){return '?'+new URLSearchParams({screen,...context});}
export function mapTransfer(input,years){
  return {...contextFor('map',{region:input.region,year:input.to??input.year},years),group:Object.hasOwn(groups,input.group)?input.group:null};
}

export function firstVisitContext(target,source,years){return contextFor(target,{region:source.region,year:source.to??source.year},years);}

export function acceptPrototypeRevision(incoming,current){return Number.isInteger(incoming)&&incoming===current;}
