import {useEffect,useMemo,useRef,useState} from 'react';
import DeckGL from '@deck.gl/react';
import {ScatterplotLayer} from '@deck.gl/layers';
import {Map as MapView} from '@vis.gl/react-maplibre';
import RuntimeWorker from './runtime.worker.js?worker';
import {RuntimePool} from './pool.js';
import {FileLoader} from './loader.js';
import {validateCatalog,catalogYears} from './catalog.js';
import {combineStats} from '../benchmark/analytics.js';
import Overview from './Overview.jsx';
import FilterMap from './FilterMap.jsx';
import 'maplibre-gl/dist/maplibre-gl.css';
import './files.css';
const names=['Все земли','Schleswig-Holstein','Hamburg','Niedersachsen','Bremen','Nordrhein-Westfalen','Hessen','Rheinland-Pfalz','Baden-Württemberg','Bayern','Saarland','Berlin','Brandenburg','Mecklenburg-Vorpommern','Sachsen','Sachsen-Anhalt','Thüringen'];
const base=(import.meta.env.VITE_FILE_DATA_BASE_URL || import.meta.env.BASE_URL+'__binary/').replace(/\/?$/,'/');
const nf=new Intl.NumberFormat('ru-RU'),mib=n=>(n/1048576).toFixed(2);
const query=new URLSearchParams(window.location.search);
const mapOnly=query.get('mapOnly')==='1';
const initialYear=mapOnly&&[2020,2021,2022,2023,2024,2025].includes(Number(query.get('year')))?Number(query.get('year')):2025;
const initialLand=mapOnly&&/^([0-9]|1[0-6])$/.test(query.get('land')||'')?Number(query.get('land')):0;
export default function FilesApp(){
  const loader=useRef(null),selection=useRef({year:initialYear,format:'arrow',budget:window.matchMedia('(max-width:700px)').matches?32:100});
  const [options,setOptions]=useState(selection.current),[land,setLand]=useState(initialLand),[error,setError]=useState('');
  const [generation,setGeneration]=useState(null),[years,setYears]=useState([]);
  const [view,setView]=useState({state:'catalog',parts:[],loaded:0,cache:{entries:[],bytes:0,limitBytes:options.budget*1048576}});
  useEffect(()=>{
    const controller=new AbortController();
    Promise.all(['manifest.json','analytics/accident_summaries.json'].map(path=>fetch(base+path,{cache:'no-store',signal:controller.signal}).then(r=>{
      if(!r.ok)throw new Error('Каталог данных недоступен: HTTP '+r.status);return r.json();
    }))).then(([manifest,summaries])=>{
      if(controller.signal.aborted)return;
      const available=catalogYears(validateCatalog(manifest));setYears(available);
      const supplied=Number(query.get('year'));
      selection.current={...selection.current,year:mapOnly&&available.includes(supplied)?supplied:available.at(-1)};
      setOptions(selection.current);setGeneration(manifest.generation);
      loader.current=new FileLoader({manifest:validateCatalog(manifest),summaries,base,pool:new RuntimePool(RuntimeWorker),
        onUpdate:setView,limitBytes:selection.current.budget*1048576});
      const {year,format,budget}=selection.current;
      loader.current.select(year,format,budget*1048576).catch(()=>{});
    }).catch(e=>{if(!controller.signal.aborted){setError(e.message);setView(v=>({...v,state:'error'}));}});
    return()=>{controller.abort();loader.current?.close();};
  },[]);
  function request(next){
    selection.current=next;setOptions(next);setError('');
    if(!loader.current)return;
    // Clear the previous year's visual snapshot before queued switching begins.
    setView(v=>({...v,state:'switching',parts:[],loaded:0}));
    loader.current.select(next.year,next.format,next.budget*1048576).catch(e=>{
      if(e.name!=='AbortError'&&selection.current===next)setError(e.message);
    });
  }
  const parts=useMemo(()=>view.parts.filter(p=>!land||p.land===land),[view.parts,land]);
  const stats=useMemo(()=>combineStats(parts.map(p=>p.stats)),[parts]);
  const layers=useMemo(()=>parts.map(p=>new ScatterplotLayer({id:'land-'+p.land,data:{length:p.ids.length,
    attributes:{getPosition:{value:p.positions,size:2}}},radiusUnits:'pixels',getRadius:1.4,getFillColor:[22,115,164,190],pickable:false})),[parts]);
  const busy=['loading','switching','catalog'].includes(view.state);
  const status=view.state==='ready'?(view.fromCache?'Год восстановлен из памяти, без скачивания':'Год загружен и проверен'):
    view.state==='loading'?`Загружаем ${view.year}: ${view.loaded}/16 земель`:
      view.state==='catalog'?'Читаем каталог данных…':view.state==='switching'?'Переключаем год…':view.state==='error'?'Ошибка загрузки':'Загрузка остановлена или кеш очищен';
  if(mapOnly)return <FilterMap loader={loader} view={view} options={options} land={land} names={names} years={years} request={request} setLand={setLand}/>;
  return <main className="files-app">
    <header><h1>Unfallatlas · файловая версия</h1><p>ДТП, динамика по годам и автопарк Германии. Земли на карте появляются по мере готовности.</p></header>
    <section className="file-controls">
      <label>Год<select value={options.year} onChange={e=>request({...options,year:Number(e.target.value)})}>{years.map(y=><option key={y}>{y}</option>)}</select></label>
      <label>Источник<select value={options.format} onChange={e=>request({...options,format:e.target.value})}><option value="arrow">Arrow + Brotli</option><option value="parquet">Parquet ZSTD 10</option></select></label>
      <label>Память данных<select value={options.budget} onChange={e=>request({...options,budget:Number(e.target.value)})}><option value="100">Обычный · 100 МиБ</option><option value="32">Облегчённый · 32 МиБ</option></select></label>
      <label>Земля<select value={land} onChange={e=>setLand(Number(e.target.value))}>{names.map((name,i)=><option value={i} key={i}>{name}</option>)}</select></label>
      <button disabled={!loader.current} onClick={()=>request({...options})}>Загрузить / повторить</button>
      <button disabled={!busy||!loader.current} onClick={()=>loader.current.stop()}>Остановить</button>
      <button disabled={!loader.current} onClick={()=>loader.current.clear().catch(e=>setError(e.message))}>Очистить кеш</button>
    </section>
    <Overview year={options.year} land={land} names={names} generation={generation}/>
    <h2>Карта выбранного года · {options.year}</h2>
    <p role="status">{status}</p>{(error||view.error)&&<p role="alert">{error||view.error}</p>}
    <section className="file-workspace">
      <div className="file-map"><DeckGL initialViewState={{longitude:10.4,latitude:51.1,zoom:5}} controller layers={layers}>
        <MapView mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" attributionControl /></DeckGL></div>
      <aside><h2>{nf.format(stats.count)} ДТП на карте</h2><p>Показаны записи загруженных земель выбранного года.</p><p>Pkw: {nf.format(stats.participation.pkw)}<br/>Rad: {nf.format(stats.participation.rad)}</p>
        <h3>Кеш в памяти</h3><p>{mib(view.cache.bytes)} / {options.budget} МиБ</p>
        {view.cache.entries.length?<ul>{view.cache.entries.map(e=><li key={e.key}>{e.year} · {e.format==='arrow'?'Arrow':'Parquet'} · {mib(e.bytes)} МиБ</li>)}</ul>:<p>Завершённых наборов пока нет.</p>}
        {view.state==='loading'&&<p>Резерв для загружаемого года: {mib(view.reservedBytes)} МиБ</p>}
        <small>Учитываются буферы Arrow в workers и буферы карты в JavaScript. Временная распаковка, WASM, GPU и остальная память браузера сверх этого бюджета. При заполнении кеша освобождается давно неиспользуемый год.</small>
        <p>Другие годы загружаются только при выборе. Четыре workers обслуживают все годы и форматы.</p>
      </aside>
    </section>
  </main>;
}
