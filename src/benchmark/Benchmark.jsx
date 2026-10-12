import {useEffect,useMemo,useRef,useState} from 'react';
import DeckGL from '@deck.gl/react';
import {ScatterplotLayer} from '@deck.gl/layers';
import {HexagonLayer,HeatmapLayer} from '@deck.gl/aggregation-layers';
import {Map as MapView} from '@vis.gl/react-maplibre';
import DataWorker from './data.worker.js?worker';
import {DataPool} from './pool.js';
import {blankStats,combineStats,fleetRate,verifySummary} from './analytics.js';
import 'maplibre-gl/dist/maplibre-gl.css';
import './benchmark.css';

const base=(import.meta.env.VITE_FILE_DATA_BASE_URL||import.meta.env.BASE_URL+'__binary/').replace(/\/?$/,'/');
const names=['','Schleswig-Holstein','Hamburg','Niedersachsen','Bremen','Nordrhein-Westfalen','Hessen','Rheinland-Pfalz','Baden-Württemberg','Bayern','Saarland','Berlin','Brandenburg','Mecklenburg-Vorpommern','Sachsen','Sachsen-Anhalt','Thüringen'];
const scenarios=[{label:'Германия',filters:{}},{label:'NRW',filters:{uland:5}},
  {label:'NRW + категория 3 + Pkw, без Rad/Fuß',filters:{uland:5,category:3,pkw:1,rad:0,fuss:0}},
  {label:'Понедельник + Rad',filters:{weekday:2,rad:1}}];
const nf=new Intl.NumberFormat('ru-RU');
const time=value=>Number.isFinite(value)?value.toFixed(0)+' мс':'—';
const title=format=>format==='parquet'?'Parquet ZSTD 10':'Arrow + Brotli';
const COLORS=[[237,248,177],[199,233,180],[127,205,187],[65,182,196],[44,127,184],[37,52,148]];
function digest(parts) {
  return JSON.stringify([...parts].sort((a,b)=>a.land-b.land).map(p=>[p.land,p.stats,p.signature]));
}
function packForMap(parts) {
  const length=parts.reduce((n,p)=>n+p.ids.length,0),positions=new Float64Array(length*2);
  let offset=0;
  for(const part of parts){positions.set(part.positions,offset);offset+=part.positions.length;}
  return {positions,length};
}
export default function Benchmark() {
  const [catalog,setCatalog]=useState(null),[year,setYear]=useState(2025),[format,setFormat]=useState('parquet');
  const [cache,setCache]=useState('cold'),[layer,setLayer]=useState('points'),[busy,setBusy]=useState(false);
  const [progress,setProgress]=useState('Готовим каталог…'),[error,setError]=useState('');
  const [display,setDisplay]=useState({parts:[],token:0}),[stats,setStats]=useState(blankStats());
  const [rate,setRate]=useState(null),[results,setResults]=useState([]),[filters,setFilters]=useState({});
  const active=useRef(null),pool=useRef(null),generation=useRef(0),token=useRef(0),frames=useRef(new Map());
  const baselines=useRef(new Map()),fleet=useRef([]),complete=useRef(false),heapPeak=useRef(0);
  useEffect(()=>{
    const controller=new AbortController();
    const pendingFrames=frames.current;
    Promise.all(['manifest.json','analytics/accident_summaries.json'].map(name=>fetch(base+name,{cache:'no-store',signal:controller.signal}).then(r=>{
      if(!r.ok)throw new Error('Каталог недоступен: '+r.status);return r.json();
    }))).then(([manifest,summaries])=>{
      if(controller.signal.aborted)return;
      setCatalog({manifest,summaries});setProgress('Готово к сравнению');
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return()=>{controller.abort();pool.current?.close();for(const pending of pendingFrames.values()){clearTimeout(pending.timer);pending.reject(new Error('Страница закрыта'));}};
  },[]);
  function stop() {
    generation.current++;pool.current?.close();pool.current=null;active.current=null;complete.current=false;
    for(const pending of frames.current.values()){clearTimeout(pending.timer);pending.reject(new DOMException('Отменено','AbortError'));}
    frames.current.clear();setBusy(false);setProgress('Остановлено');
  }
  function publish(parts) {
    const current=++token.current;
    setDisplay({parts,token:current});
    return current;
  }
  function rendered(current) {
    const run=active.current;
    if(run && display.parts.some(p=>p.ids.length) && run.firstPointsFrameMs==null)run.firstPointsFrameMs=performance.now()-run.start;
    const pending=frames.current.get(current);
    if(pending){clearTimeout(pending.timer);frames.current.delete(current);pending.resolve(performance.now());}
    if(performance.memory)heapPeak.current=Math.max(heapPeak.current,performance.memory.usedJSHeapSize);
  }
  function waitFrame(current) {
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{frames.current.delete(current);reject(new Error('Не получен кадр карты за 15 с'));},15000);
      frames.current.set(current,{resolve,reject,timer});
    });
  }
  function taskFor(entry,requestedFormat) {
    const decoded=catalog.manifest.files.find(e=>e.scope===entry.scope && e.year===entry.year && e.land===entry.land &&
      e.format==='arrow-file' && e.compression==='identity');
    return {format:requestedFormat,url:base+entry.path,cache:cache==='cold'?'no-store':'force-cache',
      generation:catalog.manifest.generation,decodedSha256:requestedFormat==='arrow'?decoded.sha256:entry.sha256,
      logicalArrowBytes:entry.logical_arrow_bytes};
  }
  function fileFor(scope,requestedFormat,land) {
    const entry=catalog.manifest.files.find(e=>e.scope===scope &&
      (scope!=='runtime' || (e.year===year && e.land===land)) &&
      e.format===(requestedFormat==='parquet'?'parquet':'arrow-file') && e.compression===(requestedFormat==='parquet'?'zstd10':'br'));
    if(!entry)throw new Error('Нет нужного варианта файла');return entry;
  }
  function checkSelection(label,parts,rateResult,requestedFormat) {
    const key=year+':'+label, signature=digest(parts)+JSON.stringify(rateResult);
    const previous=baselines.current.get(key);
    if(previous && previous.signature!==signature)throw new Error('Результаты форматов/повторов различаются: '+label);
    baselines.current.set(key,{signature,format:requestedFormat});
    return previous?'совпало с предыдущим прогоном':'эталон сохранён';
  }
  async function filterNow(selection,label,requestedFormat,runGeneration) {
    const started=performance.now();
    const responses=await Promise.all(pool.current.slots.map((_,i)=>pool.current.run(i,{type:'filter',filters:selection})));
    if(generation.current!==runGeneration)throw new DOMException('Отменено','AbortError');
    const parts=responses.flatMap(r=>r.parts).sort((a,b)=>a.land-b.land);
    const total=combineStats(parts.map(p=>p.stats)),normalized=fleetRate(total,fleet.current,year,selection.uland ?? null);
    const dataReadyMs=performance.now()-started;
    setStats(total);setRate(normalized);
    const current=publish(parts);
    const drawn=await waitFrame(current);
    return {label,filters:selection,count:total.count,workerProcessingSumMs:responses.reduce((n,r)=>n+r.processingMs,0),
      dataReadyMs,frameMs:drawn-started,validation:checkSelection(label,parts,normalized,requestedFormat)};
  }
  async function runOnce(requestedFormat,runGeneration) {
    pool.current?.close();complete.current=false;setFilters({});setError('');
    setStats(blankStats());setRate(null);setDisplay({parts:[],token:++token.current});
    const dataPool=new DataPool(DataWorker,4);pool.current=dataPool;
    const run={start:performance.now(),firstPointsFrameMs:null};active.current=run;
    heapPeak.current=performance.memory?.usedJSHeapSize || 0;
    const parts=[],loads=[],entries=[];
    const fleetEntry=fileFor('fleet_snapshots',requestedFormat);
    entries.push(fleetEntry);
    const fleetLoad=dataPool.run(0,{type:'fleet',...taskFor(fleetEntry,requestedFormat)}).then(result=>{
      fleet.current=result.records;loads.push(result.timings);
    });
    await Promise.all([fleetLoad,...Array.from({length:16},(_,index)=>{
      const land=index+1,entry=fileFor('runtime',requestedFormat,land);
      entries.push(entry);
      return dataPool.run(index%4,{type:'load',...taskFor(entry,requestedFormat),year,land,rows:entry.rows}).then(result=>{
        if(generation.current!==runGeneration)throw new DOMException('Отменено','AbortError');
        verifySummary(result.stats,catalog.summaries.years[year].lands[land]);
        parts.push(result);loads.push(result.timings);publish([...parts]);
        setStats(combineStats(parts.map(p=>p.stats)));
        setProgress(title(requestedFormat)+': '+parts.length+'/16 земель');
      });
    })]);
    if(generation.current!==runGeneration)throw new DOMException('Отменено','AbortError');
    const all=combineStats(parts.map(p=>p.stats));
    verifySummary(all,catalog.summaries.years[year].national);
    const normalized=fleetRate(all,fleet.current,year);
    const initialValidation=checkSelection('Германия',parts,normalized,requestedFormat);
    setStats(all);setRate(normalized);
    const dataReadyMs=performance.now()-run.start;
    const current=publish([...parts].sort((a,b)=>a.land-b.land));
    const readyFrame=await waitFrame(current);
    const filterRuns=[];
    for(const scenario of scenarios) {
      setProgress(title(requestedFormat)+': фильтр «'+scenario.label+'»');
      filterRuns.push(await filterNow(scenario.filters,scenario.label,requestedFormat,runGeneration));
    }
    const report={format:requestedFormat,year,cache,layer,workers:4,rows:all.count,
      firstPointsFrameMs:run.firstPointsFrameMs,dataReadyMs,initialReadyFrameMs:readyFrame-run.start,
      selectedFileBytes:entries.reduce((n,e)=>n+e.bytes,0),
      observedTransferBytes:loads.every(t=>t.transferSize!=null)?loads.reduce((n,t)=>n+t.transferSize,0):null,
      logicalArrowBytes:entries.reduce((n,e)=>n+e.logical_arrow_bytes,0),
      mainHeapPeakBytes:heapPeak.current || null,initialValidation,loads,filters:filterRuns,
      generation:catalog.manifest.generation,
      note:'Localhost. Frame = deck.gl onAfterRender, not GPU/presentation fence. Main heap excludes workers, WASM and GPU. Four fresh workers per trial; browser compiled WASM/code cache may persist. Stage sums overlap and are not elapsed startup time. Warm mode requests force-cache; transfer bytes indicate actual cache use.'};
    active.current=null;complete.current=true;
    setFilters(scenarios.at(-1).filters);
    setResults(previous=>[...previous,report]);
    setProgress(title(requestedFormat)+': проверки прошли');
    return report;
  }
  async function start(series=false) {
    if(!catalog)return;
    const runGeneration=++generation.current;setBusy(true);
    try {
      const sequence=series?['parquet','arrow','arrow','parquet','parquet','arrow']:[format];
      for(const selected of sequence) {
        if(runGeneration!==generation.current)break;
        setFormat(selected);await runOnce(selected,runGeneration);
      }
    } catch(e) {if(runGeneration===generation.current){setError(e.message);pool.current?.close();complete.current=false;}}
    finally{if(runGeneration===generation.current){setBusy(false);active.current=null;}}
  }
  async function changeFilters(next) {
    setFilters(next);if(!complete.current || !pool.current)return;
    setBusy(true);
    try {await filterNow(next,'Ручной '+JSON.stringify(next),format,generation.current);setProgress('Фильтр из памяти, без скачивания');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const spatial=useMemo(()=>packForMap(display.parts),[display]);
  const layers=useMemo(()=>{
    if(layer==='points')return display.parts.filter(p=>p.ids.length).map(part=>new ScatterplotLayer({
      id:'land-'+part.land,data:{length:part.ids.length,attributes:{getPosition:{value:part.positions,size:2}}},
      radiusUnits:'pixels',getRadius:1.4,getFillColor:[22,115,164,190],pickable:false}));
    const common={data:{length:spatial.length},getPosition:(_,{index,target})=>{
      target[0]=spatial.positions[index*2];target[1]=spatial.positions[index*2+1];target[2]=0;return target;
    },colorRange:COLORS};
    return layer==='hexagon'?[new HexagonLayer({id:'hex',...common,radius:1000,gpuAggregation:true,extruded:false,pickable:false})]:
      [new HeatmapLayer({id:'heat',...common,getWeight:1,radiusPixels:25,intensity:1,threshold:.05})];
  },[display.parts,layer,spatial]);
  const selectionReady=complete.current && !busy;
  return <main>
    <header><h1>Unfallatlas · сравнение загрузчиков</h1><p>Реальные ДТП, фильтры и статистика в четырёх workers. Локальная проверка Parquet и Arrow.</p></header>
    <section className="controls">
      <label>Год<select value={year} disabled={busy} onChange={e=>{stop();setYear(Number(e.target.value));setDisplay({parts:[],token:++token.current});setStats(blankStats());setRate(null);}}>{[2020,2021,2022,2023,2024,2025].map(y=><option key={y}>{y}</option>)}</select></label>
      <label>Формат<select value={format} disabled={busy} onChange={e=>setFormat(e.target.value)}><option value="parquet">Parquet ZSTD 10</option><option value="arrow">Arrow + Brotli</option></select></label>
      <label>Кеш<select value={cache} disabled={busy} onChange={e=>setCache(e.target.value)}><option value="cold">Без HTTP-кеша</option><option value="warm">С HTTP-кешем</option></select></label>
      <label>Карта<select value={layer} disabled={busy} onChange={e=>setLayer(e.target.value)}><option value="points">Точки</option><option value="hexagon">Гексагоны</option><option value="heatmap">Тепловая карта</option></select></label>
      <button disabled={!catalog || busy} onClick={()=>start()}>Один прогон</button>
      <button disabled={!catalog || busy} onClick={()=>start(true)}>Сравнить · 6 прогонов</button>
      <button disabled={!busy} onClick={stop}>Остановить</button>
    </section>
    <p role="status">{progress}</p>{error && <p role="alert" className="error">{error}</p>}
    <section className="workspace">
      <div className="map"><DeckGL initialViewState={{longitude:10.4,latitude:51.1,zoom:5,pitch:0}} controller layers={layers} onAfterRender={()=>rendered(display.token)}>
        <MapView mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" attributionControl /></DeckGL></div>
      <aside><h2>{nf.format(stats.count)} ДТП</h2><p>Pkw: {nf.format(stats.participation.pkw)} · Rad: {nf.format(stats.participation.rad)}</p>
        {rate && <p>Средний автопарк Pkw: {nf.format(rate.mean)}<br/>ДТП с Pkw на 10 000 машин: {rate.rate?.toFixed(2)}<small>Среднее двух снимков на начало/конец года. Национальный автопарк включает KBA Sonstige; знаменатель не меняется от фильтров участников.</small></p>}
        {[['uland','Земля',names.map((n,i)=>[i,n]).slice(1)],['category','Категория',[[1,'С погибшими'],[2,'С тяжелоранеными'],[3,'С легкоранеными']]],
          ['weekday','День недели',[[1,'Воскресенье'],[2,'Понедельник'],[3,'Вторник'],[4,'Среда'],[5,'Четверг'],[6,'Пятница'],[7,'Суббота']]],
          ['rad','Велосипед',[[0,'Без'],[1,'С участием']]],['pkw','Pkw',[[0,'Без'],[1,'С участием']]],['fuss','Пешеход',[[0,'Без'],[1,'С участием']]]].map(([key,label,options])=>
            <label key={key}>{label}<select disabled={!selectionReady} value={filters[key]??''} onChange={e=>changeFilters({...filters,[key]:e.target.value===''?null:Number(e.target.value)})}>
              <option value="">Все</option>{options.map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>)}
        <h3>ДТП по месяцам</h3><div className="bars">{stats.distributions.month.slice(1).map((n,i)=><div key={i} title={(i+1)+': '+nf.format(n)}><i style={{height:Math.max(1,n/Math.max(1,...stats.distributions.month)*70)+'px'}}/><span>{i+1}</span></div>)}</div>
        <p>Категории: {stats.distributions.category.slice(1).map(n=>nf.format(n)).join(' / ')}</p>
      </aside>
    </section>
    <section className="results"><h2>Измерения</h2><p>Первые точки и кадры измеряются отдельно от готовности всех данных. Размер Arrow в памяти не равен пиковому расходу памяти.</p>
      <div className="table-scroll"><table><thead><tr>{['Формат / год','Кеш / карта','Первые точки','Все данные','Кадр полной выборки','Файлы, МиБ','Передано, МиБ','Проверка'].map(v=><th key={v}>{v}</th>)}</tr></thead>
        <tbody>{results.map((r,i)=><tr key={i}><td>{title(r.format)} / {r.year}</td><td>{r.cache} / {r.layer}</td><td>{time(r.firstPointsFrameMs)}</td><td>{time(r.dataReadyMs)}</td><td>{time(r.initialReadyFrameMs)}</td><td>{(r.selectedFileBytes/1048576).toFixed(2)}</td><td>{r.observedTransferBytes==null?'—':(r.observedTransferBytes/1048576).toFixed(2)}</td><td>{r.initialValidation}</td></tr>)}</tbody></table></div>
      {results.length>0 && <><h3>Последние фильтры из памяти</h3>{results.at(-1).filters.map(f=><p key={f.label}>{f.label}: {nf.format(f.count)} ДТП · данные {time(f.dataReadyMs)} · кадр {time(f.frameMs)} · {f.validation}</p>)}
        <button onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(results,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='uad-benchmark.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Скачать отчёт JSON</button>
        <details><summary>Полный отчёт и пределы измерения</summary><pre>{JSON.stringify(results,null,2)}</pre></details></>}
      <small>Локальный хостинг не воспроизводит мобильную сеть. HTTP-кеш отключается отдельно от кеша кода/WASM браузера. Первый режим с кешем может ещё скачивать файлы: смотрите фактически переданные байты. Память main heap (в JSON, если доступна) исключает workers/WASM/GPU. Кадр deck.gl не подтверждает завершение GPU или показ на экране. Изначальные сводки сверяются с источником, повторные выборки — по ID, координатам, статистике и показателю автопарка.</small>
    </section>
  </main>;
}
