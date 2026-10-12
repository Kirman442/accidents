import {lazy,Suspense,useCallback,useEffect,useRef,useState} from 'react';
import RuntimeWorker from '../files/runtime.worker.js?worker';
import {RuntimePool} from '../files/pool.js';
import {FileLoader} from '../files/loader.js';
import {catalogYears,validateCatalog} from '../files/catalog.js';
import AnalyticFrame from './AnalyticFrame.jsx';
import {screens,groups,screenKey,contextFor,changeContext,initialShell,contextEqual,routeQuery,mapTransfer,firstVisitContext} from './shell-state.js';
import './shell.css';
const NativeMap=lazy(()=>import('./NativeMap.jsx'));
const names=['Германия','Schleswig-Holstein','Hamburg','Niedersachsen','Bremen','Nordrhein-Westfalen','Hessen','Rheinland-Pfalz','Baden-Württemberg','Bayern','Saarland','Berlin','Brandenburg','Mecklenburg-Vorpommern','Sachsen','Sachsen-Anhalt','Thüringen'];
const base=(import.meta.env.VITE_FILE_DATA_BASE_URL||import.meta.env.BASE_URL+'__binary/').replace(/\/?$/,'/');
const storage='uad-shell-v1';
const mapStyles={dark:'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',light:'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'};
export default function AppShell(){
  const [mapTheme,setMapTheme]=useState(()=>{try{return localStorage.getItem('uad-map-theme')==='light'?'light':'dark';}catch{return 'dark';}});
  useEffect(()=>{try{localStorage.setItem('uad-map-theme',mapTheme);}catch{/* Theme remains usable without browser storage. */}},[mapTheme]);
  const loader=useRef(null),models=useRef(null),job=useRef(''),live=useRef(true),refs=useRef(null),nonce=useRef(0),remembered=useRef(new Set()),scrolls=useRef({});
  const [screen,setScreen]=useState(screenKey(new URLSearchParams(location.search).get('screen'))),[contexts,setContexts]=useState(null),[years,setYears]=useState([]);
  const [options,setOptions]=useState({year:2025,format:'arrow',budget:window.matchMedia('(max-width:700px)').matches?32:100}),[land,setLand]=useState(0);
  const [visited,setVisited]=useState({}),[error,setError]=useState(''),[intent,setIntent]=useState(null),[notice,setNotice]=useState('');
  const [view,setView]=useState({state:'idle',parts:[],loaded:0,cache:{entries:[],bytes:0,limitBytes:options.budget*1048576}});
  refs.current={screen,contexts,years,options,land,visited};
  useEffect(()=>{
    live.current=true;const abort=new AbortController();
    Promise.all(['manifest.json','analytics/accident_summaries.json'].map(path=>fetch(base+path,{signal:abort.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Каталог недоступен: HTTP '+r.status);return r.json();})))
      .then(([manifest,summaries])=>{
        if(abort.signal.aborted)return;validateCatalog(manifest);const available=catalogYears(manifest);let saved={};
        try{saved=JSON.parse(sessionStorage.getItem(storage)||'{}');}catch{/* Optional preferences. */}
        const initial=initialShell(location.search,available,saved);
        remembered.current=new Set([...initial.seen,initial.screen]);models.current={manifest,summaries};setYears(available);setContexts(initial.contexts);setScreen(initial.screen);
        setOptions(o=>({...o,year:initial.contexts.map.year,format:initial.format,budget:initial.budget||o.budget}));setLand(initial.contexts.map.region);
        setVisited({[initial.screen]:true});
      }).catch(e=>{if(!abort.signal.aborted)setError(e.message);});
    return()=>{live.current=false;abort.abort();loader.current?.close();};
  },[]);
  const request=useCallback(next=>{
    if(!models.current)return;
    const key=next.year+':'+next.format+':'+next.budget;job.current=key;
    setOptions(next);setError('');
    if(!loader.current)loader.current=new FileLoader({...models.current,base,pool:new RuntimePool(RuntimeWorker),limitBytes:next.budget*1048576,onUpdate:v=>{if(live.current)setView(v);}});
    setView(v=>({...v,state:'switching',parts:[],loaded:0}));
    loader.current.select(next.year,next.format,next.budget*1048576).catch(e=>{if(e.name!=='AbortError'&&job.current===key&&live.current)setError(e.message);});
  },[]);
  useEffect(()=>{
    if(contexts&&screen==='map'&&job.current!==options.year+':'+options.format+':'+options.budget)request({...options});
  },[contexts,screen,options,request]);
  useEffect(()=>{
    if(!contexts)return;
    const next={...contexts,map:{region:land,year:options.year}};
    if(!contextEqual(next.map,contexts.map))setContexts(next);
  },[land,options.year,contexts]);
  useEffect(()=>{
    if(!contexts)return;
    try{sessionStorage.setItem(storage,JSON.stringify({contexts,seen:[...remembered.current],format:options.format,budget:options.budget}));}catch{/* Browser preference storage is optional. */}
    history.replaceState(null,'',routeQuery(screen,screen==='map'?{region:land,year:options.year}:contexts[screen]));
  },[contexts,screen,options,land]);
  const navigate=useCallback((target,incoming=null)=>{
    target=screenKey(target);const state=refs.current;if(!state.contexts)return;scrolls.current[state.screen]=window.scrollY;
    let nextContext=state.contexts[target];
    if(incoming){
      nextContext=contextFor(target,incoming,state.years);
      if(target==='map'){
        const transfer=mapTransfer(incoming,state.years);nextContext={region:transfer.region,year:transfer.year};
        setLand(transfer.region);setOptions(o=>({...o,year:transfer.year}));
        if(transfer.group!=null)setIntent({nonce:++nonce.current,group:transfer.group});
        setNotice('На карту переданы территория и конечный год'+(transfer.group!=null?', а также группа участников':'')+'. Остальные фильтры карты сохранены.');
      }
      setContexts(c=>({...c,[target]:nextContext}));
    }else if(!state.visited[target]&&!remembered.current.has(target)){
      const source=state.screen==='map'?{region:state.land,year:state.options.year}:state.contexts[state.screen];
      nextContext=firstVisitContext(target,source,state.years);setContexts(c=>({...c,[target]:nextContext}));if(target==='map'){setLand(nextContext.region);setOptions(o=>({...o,year:nextContext.year}));}
    }
    if(target!==state.screen)history.pushState(null,'',routeQuery(target,nextContext));
    remembered.current.add(target);setVisited(v=>({...v,[target]:true}));setScreen(target);
  },[]);
  useEffect(()=>{
    const back=()=>{const state=refs.current;if(!state.contexts)return;scrolls.current[state.screen]=window.scrollY;const params=new URLSearchParams(location.search),target=screenKey(params.get('screen')),context=contextFor(target,Object.fromEntries(params),state.years);
      setContexts(c=>({...c,[target]:context}));if(target==='map'){setLand(context.region);setOptions(o=>({...o,year:context.year}));}
      remembered.current.add(target);setVisited(v=>({...v,[target]:true}));setScreen(target);};
    window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);
  },[]);
  useEffect(()=>{const id=requestAnimationFrame(()=>window.scrollTo(0,scrolls.current[screen]||0));return()=>cancelAnimationFrame(id);},[screen]);
  const prototypeMessage=useCallback((source,message)=>{
    const state=refs.current;if(!state.contexts||!['overview','time','severity'].includes(source))return;
    if(message.type==='uad-prototype-navigate'){navigate(message.target,message.context);return;}
    const context=contextFor(source,message.context,state.years);
    setContexts(c=>contextEqual(c[source],context)?c:{...c,[source]:context});
  },[navigate]);
  function change(field,value){
    if(screen==='map'){if(field==='region')setLand(Number(value));else request({...options,year:Number(value)});}
    else setContexts(c=>({...c,[screen]:changeContext(screen,c[screen],field,value,years)}));
  }
  const context=contexts?.[screen],period=context?.from===context?.to?context?.year:context?.from+'–'+context?.to;
  return <div className="app-shell"><aside className="shell-nav"><div className="shell-brand">Unfallatlas</div><nav aria-label="Разделы приложения">{Object.entries(screens).map(([key,label])=><button key={key} aria-current={screen===key?'page':undefined} onClick={()=>navigate(key)}>{label}</button>)}</nav><p>Рабочая файловая версия<br/>UI/UX — отдельные шаги</p></aside><div className="shell-body">
    <header className="shell-header"><div><h1>{screens[screen]}</h1><p>{context?names[screen==='map'?land:context.region]+' · '+(screen==='map'?options.year:screen==='overview'?context.year:period):'Читаем каталог…'}</p></div>
      {context&&<div className="shell-controls"><label>Территория<select aria-label="Территория" value={screen==='map'?land:context.region} onChange={e=>change('region',e.target.value)}>{names.map((n,i)=><option key={i} value={i}>{n}</option>)}</select></label>
        {screen==='map'||screen==='overview'?<label>Год<select aria-label="Год" value={screen==='map'?options.year:context.year} onChange={e=>change('year',e.target.value)}>{years.map(y=><option key={y}>{y}</option>)}</select></label>:<>
          {['from','to'].map((key,i)=><label key={key}>{i?'По год':'С года'}<select aria-label={i?'Конечный год':'Начальный год'} value={context[key]} onChange={e=>change(key,e.target.value)}>{years.map(y=><option key={y}>{y}</option>)}</select></label>)}
          <label>Участники<select aria-label="Участники" value={context.group} onChange={e=>change('group',e.target.value)}>{Object.entries(groups).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        </>}
        {screen!=='map'&&<button className="shell-map-link" onClick={()=>navigate('map',context)}>Показать на карте →</button>}
        <label>Тема карты<select aria-label="Тема карты" value={mapTheme} onChange={e=>setMapTheme(e.target.value)}><option value="dark">Тёмная</option><option value="light">Светлая</option></select></label>
      </div>}
    </header>
    <p className="shell-cache" role="status">{loader.current?(view.state==='loading'?`Карта загружается: ${view.loaded}/16 земель · `:'')+'В памяти: '+(view.cache.entries.map(e=>e.year).join(', ')||'готовых годов пока нет')+' · '+(view.cache.bytes/1048576).toFixed(2)+' / '+options.budget+' МиБ':'Полные данные карты ещё не загружались.'}</p>
    {error&&<p role="alert">{error}{!contexts&&<button onClick={()=>location.reload()}>Повторить</button>}</p>}
    {contexts&&<>
      {screen!=='map'&&<p className="shell-note">Пока это сохранённый макет аналитики. Отбор здесь: территория{screen==='overview'?' и год':', период и одна группа участников'}. Остальные фильтры карты остаются только на карте.</p>}
      {screen==='map'&&notice&&<p className="shell-note">{notice}</p>}
      {visited.map&&<section hidden={screen!=='map'} aria-label="Экран карты"><Suspense fallback={<p>Готовим карту…</p>}><NativeMap loader={loader} view={view} options={options} land={land} names={names} years={years} request={request} setLand={setLand} active={screen==='map'} selectionControls={false} filterIntent={intent} mapStyle={mapStyles[mapTheme]}/></Suspense></section>}
      {['overview','time','severity'].filter(key=>visited[key]).map(key=><AnalyticFrame key={key} screen={key} title={screens[key]} context={contexts[key]} active={screen===key} onMessage={prototypeMessage}/>)}
    </>}
  </div></div>;
}
