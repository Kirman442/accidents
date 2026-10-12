import {useEffect,useMemo,useRef,useState} from 'react';
import DeckGL from '@deck.gl/react';
import {ScatterplotLayer} from '@deck.gl/layers';
import {DataFilterExtension} from '@deck.gl/extensions';
import {Map as MapView} from '@vis.gl/react-maplibre';
import {emptyFilters,fields,participantNames,periods,seasons,mergeQueryParts,validateMapFilters} from './map-query.js';
const nf=new Intl.NumberFormat('ru-RU'),extension=new DataFilterExtension({filterSize:1});
const origin='http://127.0.0.1:5188';
export default function FilterMap({loader,view,options,land,names,years,request,setLand}){
  const [filters,setFilters]=useState(()=>{
    let f=emptyFilters();const group=new URLSearchParams(location.search).get('group');
    try{const saved=JSON.parse(sessionStorage.getItem('uad-map-filters')||'null');if(saved){validateMapFilters(saved);f={...f,...saved};}}catch{/* Ignore incompatible saved filters. */}
    if(group&&group!=='all')f=emptyFilters();
    if(group in participantNames)f[group]=1;return f;
  });
  const [result,setResult]=useState(()=>({...mergeQueryParts([]),source:[],updating:true,error:'',ms:0}));
  const [open,setOpen]=useState(null),menu=useRef(null),scheduler=useRef({version:0,running:false,latest:null,alive:true});
  useEffect(()=>{const s=scheduler.current;s.alive=true;return()=>{s.alive=false;s.version++;};},[]);
  useEffect(()=>{
    const close=e=>{if(e.type==='keydown'&&e.key==='Escape'||e.type==='pointerdown'&&menu.current&&!menu.current.contains(e.target))setOpen(null);};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',close);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close);};
  },[]);
  useEffect(()=>{
    const receive=e=>{if(e.origin!==origin||e.source!==window.parent||e.data?.type!=='uad-selection')return;
      if(names[e.data.land])setLand(e.data.land);
      if(years.includes(e.data.year)&&e.data.year!==options.year)request({...options,year:e.data.year});};
    window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
  },[names,years,options,request,setLand]);
  useEffect(()=>{window.parent.postMessage({type:'uad-map-state',year:options.year,land,years,filters,count:result.count},origin);
    try{sessionStorage.setItem('uad-map-selection',JSON.stringify({year:options.year,land}));sessionStorage.setItem('uad-map-filters',JSON.stringify(filters));}catch{/* Optional browser storage. */}
  },[options.year,land,years,filters,result.count]);
  useEffect(()=>{
    const s=scheduler.current,version=++s.version,source=view.parts.filter(p=>!land||p.land===land);
    s.latest={version,source,filters,year:options.year,format:options.format};
    setResult(r=>({...r,updating:true,error:''}));
    async function pump(){
      if(s.running||!s.alive)return;s.running=true;
      try{
        while(s.alive){
          const job=s.latest,start=performance.now();
          try{
            const queried=job.source.length?await loader.current.query(job.year,job.format,job.source.map(p=>p.land),job.filters):[];
            if(job.version===s.version&&s.alive)setResult({...mergeQueryParts(queried),source:job.source,updating:false,error:'',ms:performance.now()-start});
          }catch(e){if(job.version===s.version&&s.alive)setResult({...mergeQueryParts([]),source:[],updating:false,error:e.message,ms:0});}
          if(job.version===s.version)break;
        }
      }finally{s.running=false;}
    }
    pump();
  },[view.parts,land,filters,options.year,options.format,loader]);
  const masks=useMemo(()=>new Map(result.parts.map(p=>[p.land,p.mask])),[result.parts]);
  const layers=useMemo(()=>result.source.map(p=>new ScatterplotLayer({id:'filtered-land-'+p.land,
    data:{length:p.ids.length,attributes:{getPosition:{value:p.positions,size:2},getFilterValue:{value:masks.get(p.land),size:1}}},
    extensions:[extension],filterRange:[1,1],radiusUnits:'pixels',getRadius:1.2,getFillColor:[22,115,164,190],pickable:false})),[result.source,masks]);
  const complete=view.state==='ready'&&!result.updating&&!result.error;
  const countOption=(key,option)=>option.hours?option.hours.reduce((n,h)=>n+(result.facets[key]?.[h]||0),0):result.facets[key]?.[option.value]||0;
  const selected=(key,o)=>o.hours?o.hours.every(h=>filters[key].includes(h)):filters[key].includes(o.value);
  const toggle=(key,o)=>setFilters(f=>{const values=o.hours||[o.value],on=selected(key,o);return {...f,[key]:on?f[key].filter(v=>!values.includes(v)):[...new Set([...f[key],...values])]};});
  const summary=key=>key==='participants'?Object.entries(participantNames).filter(([k])=>filters[k]!=null).map(([k,n])=>(filters[k]===1?'С: ':'Без: ')+n).join('; ')||'Все':fields[key].options.filter(o=>selected(key,o)).map(o=>o.label).join(', ')||'Все';
  const loading=['catalog','switching','loading'].includes(view.state);
  return <main className="filtered-app">
    {window.parent===window&&<section className="map-filterbar" aria-label="Выбор карты"><label>Год <select aria-label="Год карты" value={options.year} onChange={e=>request({...options,year:Number(e.target.value)})}>{years.map(y=><option key={y}>{y}</option>)}</select></label><label>Территория <select aria-label="Территория" value={land} onChange={e=>setLand(Number(e.target.value))}>{names.map((name,i)=><option value={i} key={name}>{name}</option>)}</select></label></section>}
    <section className="map-filterbar" ref={menu} aria-label="Фильтры карты">
    {['participants',...Object.keys(fields)].map(key=><div className="filter-control" key={key}>
      <button className={open===key?'filter-toggle active':'filter-toggle'} aria-expanded={open===key} onClick={()=>setOpen(open===key?null:key)}>{key==='participants'?'Участники':fields[key].label}: {summary(key)}</button>
      {open===key&&<section className="filter-menu" aria-label={key==='participants'?'Выбор участников':fields[key].label}>
        <button onClick={()=>setFilters(f=>({...f,...(key==='participants'?Object.fromEntries(Object.keys(participantNames).map(k=>[k,null])):{[key]:[]})}))}>Все / сбросить</button>
        {!complete&&<p className="filter-note">Счётчики {loading?'по загруженным землям':'обновляются'}; нулевые варианты пока доступны.</p>}
        {key==='participants'?Object.entries(participantNames).map(([k,name])=><label key={k}>{name}<select aria-label={name} value={filters[k]==null?'all':filters[k]} onChange={e=>setFilters(f=>({...f,[k]:e.target.value==='all'?null:Number(e.target.value)}))}>
          <option value="all">Все · {nf.format((result.facets[k]?.[0]||0)+(result.facets[k]?.[1]||0))}</option>
          {[1,0].map(v=><option key={v} value={v} disabled={complete&&!result.facets[k]?.[v]&&filters[k]!==v}>{v?'С участием':'Без участия'} · {nf.format(result.facets[k]?.[v]||0)}</option>)}</select></label>):<>
          {key==='month'&&<div className="filter-presets">{seasons.map(s=><button key={s.label} onClick={()=>setFilters(f=>({...f,month:s.values}))}>{s.label}</button>)}</div>}
          {key==='weekday'&&<div className="filter-presets">{[{label:'Будни',values:[2,3,4,5,6]},{label:'Выходные',values:[7,1]}].map(s=><button key={s.label} onClick={()=>setFilters(f=>({...f,weekday:s.values}))}>{s.label}</button>)}</div>}
          {fields[key].options.map(o=><label className="filter-option" key={o.value}><input type="checkbox" checked={selected(key,o)} disabled={complete&&!countOption(key,o)&&!selected(key,o)} onChange={()=>toggle(key,o)}/><span>{o.label}</span><b>{nf.format(countOption(key,o))}</b></label>)}
        </>}
        <p className="filter-note">Числа учитывают остальные фильтры, без ограничения этого фильтра. {key==='participants'?'Между группами — И.':'Внутри списка — ИЛИ; между фильтрами — И.'}</p>
        {key==='month'&&<p className="filter-note">Зима: январь, февраль и декабрь выбранного года.</p>}
        {key==='hour'&&<p className="filter-note">Границы включают полный последний час. {periods.length} периода покрывают все сутки.</p>}
      </section>}
    </div>)}
    <button onClick={()=>{setFilters(emptyFilters());setOpen(null);}}>Сбросить все фильтры</button>
    <label>Кеш данных <select aria-label="Кеш данных" value={options.budget} onChange={e=>request({...options,budget:Number(e.target.value)})}><option value="100">100 МиБ</option><option value="32">32 МиБ</option></select></label>
  </section>
  <div className="filtered-status" role="status"><strong>{nf.format(result.count)} ДТП</strong> · {names[land]} · {options.year}
    {result.updating?' · Обновляем отбор; на карте прежний результат…':loading?` · Загружено ${view.loaded}/16 земель`:' · Отбор готов'}
    <small>Кеш: {(view.cache.bytes/1048576).toFixed(2)} / {options.budget} МиБ{view.fromCache?' · Год из памяти':''} · Пересчёт: {result.ms.toFixed(0)} мс</small>
  </div>
  {(result.error||view.error)&&<p role="alert">{result.error||view.error}<button onClick={()=>request({...options})}>Повторить загрузку</button></p>}
  <div className="filtered-canvas"><DeckGL initialViewState={{longitude:10.4,latitude:51.1,zoom:5}} controller layers={layers}>
    <MapView mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" attributionControl /></DeckGL></div>
  {!result.updating&&!loading&&!result.count&&!result.error&&<p className="filter-empty">Нет ДТП по выбранным условиям. Измените условия или сбросьте фильтры.</p>}
  <p className="filter-note">Одна точка — одно ДТП. Карточка ДТП пока не подключена. Выбранный год загружается по всем землям, отбор земли использует уже загруженные данные.</p>
  </main>;
}
