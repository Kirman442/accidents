import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import DeckGL from '@deck.gl/react';
import {ScatterplotLayer,GeoJsonLayer} from '@deck.gl/layers';
import {loadStateBoundaries} from './geography-data.js';
import {DataFilterExtension} from '@deck.gl/extensions';
import {Map as MapView} from '@vis.gl/react-maplibre';
import RecordCard from './RecordCard.jsx';
import MapPanel from './MapPanel.jsx';
import {HexagonLayer,HeatmapLayer} from '@deck.gl/aggregation-layers';
import {WebMercatorViewport} from '@deck.gl/core';
import {hexagonCenter} from './hexagon-picking.js';
import {autoMode,displayMode,filteredSnapshot,boundaryBounds,HEX_RADIUS,mapPalette} from './map-layer-model.js';
import {decodeMapFilters,migrateMapFilters,mapSelectionLink} from './map-link.js';
import {PICK_LIMIT} from './record-details.js';
import {emptyFilters,participantNames,mergeQueryParts,applyParticipantIntent} from './map-query.js';
const nf=new Intl.NumberFormat('ru-RU'),extension=new DataFilterExtension({filterSize:1});
const origin='http://127.0.0.1:5188';
export default function FilterMap({loader,view,options,land,names,years,request,setLand,active=true,selectionControls=true,filterIntent=null,routeFilters=null,onReturn=null,onRestore=null,theme='dark',mapStyle='https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'}){
  const [filters,setFilters]=useState(()=>{
    let f=emptyFilters();const group=new URLSearchParams(location.search).get('group');
    try{const shared=decodeMapFilters(routeFilters?.value||new URLSearchParams(location.search).get('mf'));if(shared)return shared;const current=sessionStorage.getItem('uad-map-filters-v2'),saved=JSON.parse(current||sessionStorage.getItem('uad-map-filters')||'null');if(saved)f=migrateMapFilters(saved,!current);}catch{/* Ignore incompatible saved filters. */}
    if(group&&group!=='all')f=emptyFilters();
    if(group in participantNames)f[group]=1;return f;
  });
  const [result,setResult]=useState(()=>({...mergeQueryParts([]),source:[],updating:true,error:'',ms:0}));
  const [boundaries,setBoundaries]=useState(null),[boundaryError,setBoundaryError]=useState(''),[boundaryAttempt,setBoundaryAttempt]=useState(0),[showBoundaries,setShowBoundaries]=useState(true);
  useEffect(()=>{
    if(!active||boundaries||view.state!=='ready')return;
    let alive=true;
    loadStateBoundaries().then(data=>{if(alive){setBoundaries(data);setBoundaryError('');}}).catch(e=>{if(alive)setBoundaryError(e.message);});
    return()=>{alive=false;};
  },[active,boundaries,view.state,boundaryAttempt]);
  const deck=useRef(null),[selection,setSelection]=useState(null),[selectionNotice,setSelectionNotice]=useState('');
  const [,setOriginSelection]=useState(null),[shareNotice,setShareNotice]=useState(''),[shareFallback,setShareFallback]=useState('');
  useEffect(()=>{if(!routeFilters?.value)return;try{setFilters(decodeMapFilters(routeFilters.value));}catch(e){setShareNotice(e.message);}},[routeFilters]);
  const [panel,setPanel]=useState('summary'),[cell,setCell]=useState(null),[mode,setMode]=useState('hex'),[auto,setAuto]=useState('hex');
  const camera=useRef({longitude:10.4,latitude:51.1,zoom:5}),mapBox=useRef(null),fittedLand=useRef(null),[cameraReady,setCameraReady]=useState(false);
  const [message,setMessage]=useState(null),[settledZoom,setSettledZoom]=useState(5),settleTimer=useRef(null);
  useEffect(()=>()=>clearTimeout(settleTimer.current),[]);
  useEffect(()=>{deck.current?.deck?.setProps({initialViewState:{...camera.current}});setCameraReady(true);},[]);
  const notify=useCallback((text,kind='success')=>{setMessage(previous=>previous?.kind==='error'&&kind!=='error'?previous:{text,kind});},[]);
  useEffect(()=>{if(!message||message.kind==='error')return;const timer=setTimeout(()=>setMessage(null),3000);return()=>clearTimeout(timer);},[message]);
  const manualFilters=useRef(null),[temporary,setTemporary]=useState(false);
  const scheduler=useRef({version:0,running:false,latest:null,alive:true});
  useEffect(()=>{scheduler.current.version++;setResult({...mergeQueryParts([]),source:[],updating:true,error:'',ms:0});},[options.year,land]);
  useEffect(()=>{if(!active)return;const escape=e=>{if(e.key==='Escape'&&panel==='record'){setSelection(null);setCell(null);setPanel('summary');}};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[active,panel]);
  useEffect(()=>{const s=scheduler.current;s.alive=true;return()=>{s.alive=false;s.version++;};},[]);
  useEffect(()=>{
    const receive=e=>{if(e.origin!==origin||e.source!==window.parent||e.data?.type!=='uad-selection')return;
      if(names[e.data.land])setLand(e.data.land);
      if(years.includes(e.data.year)&&e.data.year!==options.year)request({...options,year:e.data.year});};
    window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
  },[names,years,options,request,setLand]);
  useEffect(()=>{if(window.parent!==window)window.parent.postMessage({type:'uad-map-state',year:options.year,land,years,filters,count:result.count},origin);
    try{sessionStorage.setItem('uad-map-selection',JSON.stringify({year:options.year,land}));sessionStorage.setItem('uad-map-filters-v2',JSON.stringify(filters));}catch{/* Optional browser storage. */}
  },[options.year,land,years,filters,result.count]);
  useEffect(()=>{
    if(!active||view.year!==options.year||view.format!==options.format)return;
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
  },[view.parts,view.year,view.format,active,land,filters,options.year,options.format,loader]);
  useEffect(()=>{
    if(filterIntent&&(filterIntent.group==='all'||Object.hasOwn(participantNames,filterIntent.group))){setFilters(f=>{if(!manualFilters.current)manualFilters.current=f;return applyParticipantIntent(emptyFilters(),filterIntent.group);});setTemporary(true);setSelectionNotice('');}
  },[filterIntent]);
  const masks=useMemo(()=>new Map(result.parts.map(p=>[p.land,p.mask])),[result.parts]);
  useEffect(()=>{
    if(!selection)return;const h=selection.handle;
    if(h.year!==options.year||land&&h.land!==land){setSelection(null);setOriginSelection(null);setSelectionNotice('Выбор ДТП снят: изменён год или территория.');return;}
    if(result.updating||view.state!=='ready')return;
    const part=result.source.find(p=>p.land===h.land);
    if(!part||part.ids[h.index]!==h.id||!selection.unfiltered&&!masks.get(h.land)?.[h.index]){setSelection(null);setOriginSelection(null);setSelectionNotice('Выбранное ДТП скрыто текущими фильтрами.');}
  },[selection,options.year,land,result.updating,result.source,masks,view.state]);

  function choose(handle,choices=[handle],truncated=false,neighbor=false,unfiltered=false){
    const part=result.source.find(p=>p.land===handle.land);
    if(!part||part.ids[handle.index]!==handle.id||!unfiltered&&!masks.get(handle.land)?.[handle.index])return;
    if(neighbor)setOriginSelection(previous=>previous||selection);else setOriginSelection(null);
    setCell(null);setSelection({handle:{...handle,year:options.year},choices,truncated,unfiltered});setSelectionNotice(unfiltered?'Просмотр соседнего ДТП вне текущего отбора; фильтры карты сохранены.':'');setPanel('record');
  }
  function pick(info,event){
    if(info.layer?.id.startsWith('map-hex')&&info.object&&!result.updating){const layer=deck.current?.deck?.props.layers.find(l=>l.id==='map-hex'),center=hexagonCenter(info.object,layer?.state,layer?.context.viewport);setCell({count:info.object.count,center});setSelection(null);setPanel('record');return;}
    if(activeMode!=='points')return;
    if(!active||result.updating||!result.source.length||!Number.isFinite(info.x)||!Number.isFinite(info.y))return;
    const radius=event?.pointerType==='touch'||event?.srcEvent?.pointerType==='touch'||window.matchMedia('(pointer: coarse)').matches?10:6;
    const hits=deck.current.pickMultipleObjects({x:info.x,y:info.y,radius,depth:PICK_LIMIT+1});
    const handles=hits.map(hit=>{
      const part=result.source.find(p=>'filtered-land-'+p.land===hit.layer?.id);
      return part&&hit.index>=0?{land:part.land,id:part.ids[hit.index],index:hit.index,year:options.year}:null;
    }).filter(h=>h&&masks.get(h.land)?.[h.index]);
    const distinct=[...new Map(handles.map(h=>[h.id,h])).values()];
    if(!distinct.length){setSelection(null);setSelectionNotice('');return;}
    const choices=distinct.slice(0,PICK_LIMIT);choose(choices[0],choices,distinct.length>PICK_LIMIT);
  }

  const snapshot=useMemo(()=>filteredSnapshot(result.source,masks,options.year),[result.source,masks,options.year]);
  const pointData=useMemo(()=>new Map(result.source.map(p=>[p.land,{length:p.ids.length,attributes:{getPosition:{value:p.positions,size:2},getFilterValue:{value:masks.get(p.land),size:1}}}])),[result.source,masks]);
  const activeMode=displayMode(mode,auto);
  const [visited,setVisited]=useState({hex:true,points:false,heat:false});
  useEffect(()=>{setVisited(v=>v[activeMode]?v:{...v,[activeMode]:true});},[activeMode]);
  useEffect(()=>{setCell(null);},[snapshot]);
  useEffect(()=>{if(selectionNotice)notify(selectionNotice,'warning');},[selectionNotice,notify]);
  useEffect(()=>{if(shareNotice)notify(shareNotice);},[shareNotice,notify]);
  useEffect(()=>{if(result.error||view.error)notify(result.error||view.error,'error');else setMessage(m=>m?.kind==='error'?null:m);},[result.error,view.error,notify]);
  useEffect(()=>{if(!active||!cameraReady||!boundaries||fittedLand.current===land)return;const bounds=boundaryBounds(boundaries,land),rect=mapBox.current?.getBoundingClientRect();if(!bounds||!rect?.width)return;const next=new WebMercatorViewport({width:rect.width,height:rect.height}).fitBounds(bounds,{padding:35,maxZoom:11});camera.current={longitude:next.longitude,latitude:next.latitude,zoom:next.zoom};deck.current?.deck?.setProps({initialViewState:{...camera.current}});setAuto(previous=>autoMode(previous,next.zoom));setSettledZoom(next.zoom);fittedLand.current=land;},[land,boundaries,active,cameraReady]);
  function zoomTo(center,zoom){if(!center)return;camera.current={...camera.current,longitude:center[0],latitude:center[1],zoom};deck.current?.deck?.setProps({initialViewState:{...camera.current}});setAuto(previous=>autoMode(previous,zoom));setSettledZoom(zoom);}
  const layers=useMemo(()=>{
    const points=result.source.map(p=>new ScatterplotLayer({id:'filtered-land-'+p.land,visible:activeMode==='points',
      data:pointData.get(p.land),extensions:[extension],filterRange:[1,1],radiusUnits:'pixels',getRadius:2,getFillColor:theme==='dark'?[121,180,218,210]:[22,115,164,200],pickable:active&&!result.updating}));
    const list=[];
    if(visited.hex)list.push(new HexagonLayer({id:'map-hex',visible:activeMode==='hex',data:snapshot.binary,radius:HEX_RADIUS,gpuAggregation:true,colorAggregation:'SUM',getColorWeight:1,elevationAggregation:'SUM',getElevationWeight:1,extruded:false,coverage:.9,opacity:.65,colorRange:mapPalette,colorScaleType:'quantize',colorDomain:[0,100],pickable:active&&!result.updating}));
    if(visited.heat)list.push(new HeatmapLayer({id:'map-heat',visible:activeMode==='heat',data:snapshot.binary,getWeight:1,radiusPixels:30,intensity:1,threshold:.05,weightsTextureSize:1024,debounceTimeout:250,aggregation:'SUM'}));
    if(visited.points)list.push(...points);
    const h=selection?.handle,p=h&&result.source.find(p=>p.land===h.land);
    if(p&&h.year===options.year&&masks.get(h.land)?.[h.index])list.push(new ScatterplotLayer({id:'selected-ring',data:[[p.positions[h.index*2],p.positions[h.index*2+1]]],getPosition:d=>d,radiusUnits:'pixels',getRadius:8,filled:false,stroked:true,getLineColor:[242,160,64,255],getLineWidth:2,lineWidthUnits:'pixels',pickable:false}));
    if(boundaries&&showBoundaries)list.push(new GeoJsonLayer({id:'state-boundaries',data:boundaries,filled:false,stroked:true,pickable:false,getLineColor:f=>Number(f.properties.state_code)===land?[242,160,64,230]:theme==='dark'?[190,208,215,160]:[55,85,95,170],getLineWidth:f=>Number(f.properties.state_code)===land?2:1,lineWidthUnits:'pixels',lineWidthMinPixels:1,updateTriggers:{getLineColor:[land,theme],getLineWidth:[land]}}));
    return list;
  },[result.source,result.updating,masks,selection,options.year,active,boundaries,showBoundaries,land,theme,activeMode,snapshot,visited,pointData]);
  const complete=view.state==='ready'&&!result.updating&&!result.error;
  async function copySelection(){const url=mapSelectionLink(location.href,options.year,land,filters);try{await navigator.clipboard.writeText(url);notify('Ссылка на полный отбор скопирована.');setShareFallback('');}catch{setShareFallback(url);notify('Скопируйте ссылку из поля в диагностике.','warning');}}
  function closeRecord(){setSelection(null);setCell(null);setOriginSelection(null);setSelectionNotice('');setPanel('summary');}
  const record=selection&&<RecordCard key={selection.handle.year+':'+selection.handle.id} loader={loader} handle={selection.handle} choices={selection.choices} truncated={selection.truncated} names={names} format={options.format} onSelect={choose} onScenario={(key,value)=>{setFilters(f=>({...f,[key]:[value]}));notify('Фильтр применён. Остальные условия сохранены.');}} onZoom={r=>zoomTo([r.longitude,r.latitude],Math.max(camera.current.zoom,16))} onNotify={notify} onClose={closeRecord}/>;
  return <main className="filtered-app">
    {selectionControls&&<div className="map-layer-controls"><label>Год<select value={options.year} onChange={e=>request({...options,year:Number(e.target.value)})}>{years.map(y=><option key={y}>{y}</option>)}</select></label><label>Территория<select value={land} onChange={e=>setLand(Number(e.target.value))}>{names.map((name,i)=><option key={i} value={i}>{name}</option>)}</select></label></div>}
    <div className="map-layer-controls" role="group" aria-label="Слои карты">{[['hex','Ячейки'],['heat','Тепловая карта']].map(([key,label])=><button key={key} aria-pressed={mode===key} title={key==='hex'?'При приближении — отдельные ДТП':undefined} onClick={()=>{setMode(key);setCell(null);}}>{label}</button>)}</div>
    <div className="map-status" role="status">{result.updating?'Обновляем отбор…':view.state!=='ready'?'Загружено '+view.loaded+'/16 земель':!result.count?'Нет ДТП по выбранным условиям. Измените условия или сбросьте фильтры.':nf.format(result.count)+' ДТП · '+names[land]+' · '+options.year}</div>
    <div className="map-legend">{activeMode==='hex'?<>Число ДТП в ячейке · радиус 1 км · 0<span className="map-palette">{mapPalette.map((c,i)=><i key={i} style={{background:'rgb('+c.join(',')+')'}}/>)}</span>100 и выше</>:activeMode==='heat'?'Сглаженная концентрация ДТП; цвет не означает точное число или риск поездки.':'Одна точка — одно геокодированное ДТП с пострадавшими.'}</div>
    <div className="record-workspace"><div ref={mapBox} className="filtered-canvas" aria-label="Карта ДТП"><DeckGL ref={deck} useDevicePixels={1} initialViewState={undefined} onLoad={()=>{deck.current?.deck?.setProps({initialViewState:{...camera.current}});setCameraReady(true);}} onViewStateChange={({viewState})=>{camera.current=viewState;setAuto(previous=>autoMode(previous,viewState.zoom));clearTimeout(settleTimer.current);settleTimer.current=setTimeout(()=>setSettledZoom(camera.current.zoom),250);}} controller layers={layers} onClick={pick} getTooltip={info=>info.layer?.id.startsWith('map-hex')&&info.object?nf.format(info.object.count)+' ДТП':null}><MapView mapStyle={mapStyle} attributionControl/></DeckGL></div>
    <MapPanel region={land} name={names[land]} data={{count:result.count,category:result.category,year:options.year,pending:!complete}} panel={panel} setPanel={setPanel} filters={filters} setFilters={setFilters} boundaries={showBoundaries} setBoundaries={setShowBoundaries} record={record} cell={cell} onCellZoom={()=>zoomTo(cell.center,Math.min(16,camera.current.zoom+2))} onShare={copySelection} onAnalyze={()=>notify('Аналитика места запланирована для следующей версии.','warning')} message={message} transferActions={temporary&&<div className="panel-actions">{onReturn&&<button onClick={onReturn}>Вернуться к графику</button>}<button onClick={()=>{setFilters(manualFilters.current||emptyFilters());manualFilters.current=null;setTemporary(false);onRestore?.();notify('Ваши фильтры карты восстановлены.');}}>Восстановить мой отбор карты</button></div>} diagnostics={<>{(result.error||view.error)&&<p role="alert">{result.error||view.error}</p>}<p>Слой: {activeMode} · Масштаб: {settledZoom.toFixed(2)} · Радиус ячеек: {HEX_RADIUS} м</p><p>Кеш: {(view.cache.bytes/1048576).toFixed(2)} / {options.budget} МиБ · Отбор: {result.ms.toFixed(0)} мс · {complete?'готов':'ожидание'}</p>{shareFallback&&<input aria-label="Ссылка на полный отбор" value={shareFallback} readOnly onFocus={e=>e.target.select()}/>}<label>Кеш данных<select value={options.budget} onChange={e=>request({...options,budget:Number(e.target.value)})}><option value="100">100 МиБ</option><option value="32">32 МиБ</option></select></label>{(result.error||view.error)&&<button onClick={()=>request({...options})}>Повторить загрузку</button>}</>}/></div>
    {boundaryError&&<p className="filter-note">Границы не загружены. <button onClick={()=>setBoundaryAttempt(n=>n+1)}>Повторить</button></p>}
    {boundaries&&showBoundaries&&<p className="filter-note">Границы земель: © BKG (2026), <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noopener noreferrer">dl-de/by-2-0</a>. Упрощены; источник на 01.01.2026.</p>}
  </main>;
}
