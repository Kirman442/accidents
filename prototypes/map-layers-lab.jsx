import {useEffect,useMemo,useRef,useState} from 'react';
import DeckGL from '@deck.gl/react';
import {GeoJsonLayer,ScatterplotLayer,PolygonLayer} from '@deck.gl/layers';
import {HeatmapLayer,HexagonLayer,ScreenGridLayer} from '@deck.gl/aggregation-layers';
import {H3HexagonLayer} from '@deck.gl/geo-layers';
import {cellToLatLng,cellArea,cellToBoundary} from 'h3-js';
import {Map as MapView} from '@vis.gl/react-maplibre';
import {WebMercatorViewport} from '@deck.gl/core';
import RuntimeWorker from '../src/files/runtime.worker.js?worker';
import HexWorker from './h3-counts.worker.js?worker';
import {RuntimePool} from '../src/files/pool.js';
import {FileLoader} from '../src/files/loader.js';
import {validateCatalog,catalogYears} from '../src/files/catalog.js';
import {emptyFilters,fields,participantNames} from '../src/files/map-query.js';
import {loadStateBoundaries} from '../src/files/geography-data.js';
import {palette} from './hex-lab-model.js';
import {chooseH3,chooseRadius,compareBin} from './layer-size-model.js';
import {useLayerBenchmark} from './use-layer-benchmark.js';
import {screenGridReference} from './screen-grid-model.js';
import {hexagonCenter} from './hexagon-picking.js';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map-layers-lab.css';
const names=['Германия','Schleswig-Holstein','Hamburg','Niedersachsen','Bremen','Nordrhein-Westfalen','Hessen','Rheinland-Pfalz','Baden-Württemberg','Bayern','Saarland','Berlin','Brandenburg','Mecklenburg-Vorpommern','Sachsen','Sachsen-Anhalt','Thüringen'];
const base=(import.meta.env.VITE_FILE_DATA_BASE_URL||import.meta.env.BASE_URL+'__binary/').replace(/\/?$/,'/');
const styles={dark:'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',light:'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'};
const nf=new Intl.NumberFormat('ru-RU');
const blankSnapshot={positions:new Float64Array(),positions3:new Float64Array(),handles:[],count:0};
export default function LayersLab(){
  const loader=useRef(null),mapBox=useRef(null),revision=useRef(0),detailRevision=useRef(0),hexWorker=useRef(null),hexRequest=useRef(0);
  const [year,setYear]=useState(2025),[years,setYears]=useState([2025]),[land,setLand]=useState(0),[theme,setTheme]=useState('dark');
  const [view,setView]=useState({state:'catalog',parts:[],loaded:0}),[retry,setRetry]=useState(0),[error,setError]=useState('');
  const [group,setGroup]=useState('all'),[category,setCategory]=useState(0),[snapshot,setSnapshot]=useState(blankSnapshot),[querying,setQuerying]=useState(false);
  const [opacity,setOpacity]=useState(.65),[gap,setGap]=useState(.1);
  const deckRef=useRef(null),baseMapRef=useRef(null),lastGPUPath=useRef(''),gpuUpdated=useRef(null);
  const [engine,setEngine]=useState('gpu'),[targetPixels,setTargetPixels]=useState(24),[gpuInfo,setGPUInfo]=useState({path:'ожидание',updatedAt:null}),[visited,setVisited]=useState({gpu:true,h3:false,points:false,heat:false});
  const [gpuCheck,setGPUCheck]=useState(null),[colorMax,setColorMax]=useState(10000);
  const [gridInfo,setGridInfo]=useState('ожидание');
  const breaks=Array.from({length:6},(_,i)=>i?Math.ceil(colorMax*i/6):1);
  const [mode,setMode]=useState('auto'),[manualRes,setManualRes]=useState('auto'),[hex,setHex]=useState(null),[aggregating,setAggregating]=useState(false);
  const [camera,setCameraState]=useState({longitude:10.4,latitude:51.1,zoom:4.6,pitch:0,bearing:0}),[showBoundaries,setShowBoundaries]=useState(true),[selection,setSelection]=useState(null),[detail,setDetail]=useState(null);
  const [cameraDriver,setCameraDriver]=useState('react'),[radiusPolicy,setRadiusPolicy]=useState('screen'),[fixedRadius,setFixedRadius]=useState(1000);
  const cameraRef=useRef(camera),cameraTimer=useRef(null);
  const [settledCamera,setSettledCamera]=useState(camera);
  const [dataPolicy,setDataPolicy]=useState('stable'),[lifecycle,setLifecycle]=useState('visible'),[geometry,setGeometry]=useState('h3'),[devicePixels,setDevicePixels]=useState('native');
  const counters=useRef({dataBuilds:0,workerRequests:0,polygonCalls:0,cameraStateUpdates:0,gpuUpdates:0});
  function observeCamera(next){cameraRef.current=next;clearTimeout(cameraTimer.current);if(cameraDriver==='react'){counters.current.cameraStateUpdates++;setCameraState(next);}else cameraTimer.current=setTimeout(()=>{counters.current.cameraStateUpdates++;setCameraState(cameraRef.current);setSettledCamera(cameraRef.current);},250);}
  function setCamera(update){const next=typeof update==='function'?update(cameraRef.current):update;observeCamera(next);if(cameraDriver==='deck')deckRef.current?.deck?.setProps({initialViewState:next});}
  useEffect(()=>()=>clearTimeout(cameraTimer.current),[]);
  // Do not pass the original initialViewState through the React wrapper:
  // its own rerenders would overwrite imperative benchmark camera commands.
  useEffect(()=>{if(cameraDriver==='deck')deckRef.current?.deck?.setProps({initialViewState:{...cameraRef.current}});},[cameraDriver]);
  function getRenderedCamera(){const viewport=deckRef.current?.deck?.getViewports()[0],map=baseMapRef.current?.getMap(),center=map?.getCenter();return {deck:viewport?{longitude:viewport.longitude,zoom:viewport.zoom}:null,basemap:map?{longitude:center.lng,zoom:map.getZoom()}:null};}
  const benchmark=useLayerBenchmark({getCamera:()=>cameraRef.current,getRenderedCamera,setCamera,setMode,mode,metadata:{engine,mode,cameraDriver,radiusPolicy,fixedRadius,dataPolicy,lifecycle,geometry,devicePixels,count:snapshot.count,year,land,zoom:camera.zoom,targetPixels,manualRes,theme,opacity,gap,colorMax,screenMarginPixels:engine==='screen'?2:null,showBoundaries,visited:{...visited},dpr:window.devicePixelRatio},counters});
  function startBenchmark(scenario){benchmark.start(scenario);mapBox.current?.scrollIntoView({block:'start'});}
  useEffect(()=>{const timer=setTimeout(()=>setSettledCamera(camera),250);return()=>clearTimeout(timer);},[camera]);
  const [autoMode,setAutoMode]=useState('hex');
  useEffect(()=>{if(settledCamera.zoom>=10.2)setAutoMode('points');else if(settledCamera.zoom<=9.8)setAutoMode('hex');},[settledCamera.zoom]);
  const activeMode=mode==='auto'?autoMode:mode;
  const resolution=manualRes==='auto'?chooseH3(settledCamera.zoom,settledCamera.latitude,targetPixels):Number(manualRes);
  const radius=radiusPolicy==='fixed'?fixedRadius:chooseRadius(settledCamera.zoom,settledCamera.latitude,targetPixels);
  useEffect(()=>{setSelection(null);setDetail(null);},[radius,resolution,engine]);
  useEffect(()=>{if(engine==='screen'){setSelection(null);setDetail(null);setGPUCheck(null);}},[settledCamera,engine,targetPixels]);
  useEffect(()=>{const key=activeMode==='hex'?engine:activeMode;setVisited(v=>v[key]?v:{...v,[key]:true});},[activeMode,engine]);
  useEffect(()=>{const controller=new AbortController();let instance;
    setError('');setView({state:'catalog',parts:[],loaded:0});setSnapshot(blankSnapshot);setSelection(null);setDetail(null);
    Promise.all(['manifest.json','analytics/accident_summaries.json'].map(path=>fetch(base+path,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('Каталог: HTTP '+r.status);return r.json();}))).then(([manifest,summaries])=>{
      if(controller.signal.aborted)return;validateCatalog(manifest);setYears(catalogYears(manifest));
      instance=new FileLoader({manifest,summaries,base,pool:new RuntimePool(RuntimeWorker),onUpdate:setView,limitBytes:100*1048576});loader.current=instance;
      return instance.select(year,'arrow').catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return()=>{controller.abort();instance?.close();loader.current=null;};
  },[year,retry]);
  const [boundaries,setBoundaries]=useState(null);
  useEffect(()=>{let alive=true;loadStateBoundaries().then(b=>{if(alive)setBoundaries(b);}).catch(()=>{});return()=>{alive=false;};},[]);
  useEffect(()=>{const current=++revision.current;if(view.state!=='ready'||!loader.current)return;let alive=true;setQuerying(true);setSelection(null);setDetail(null);
    const source=view.parts.filter(p=>!land||p.land===land),filters=emptyFilters();if(group!=='all')filters[group]=1;if(category)filters.category=[category];
    loader.current.query(year,'arrow',source.map(p=>p.land),filters).then(replies=>{
      if(!alive||current!==revision.current)return;const masks=new Map(replies.map(r=>[r.land,r.mask])),count=replies.reduce((sum,r)=>sum+r.count,0),positions=new Float64Array(count*2),positions3=new Float64Array(count*3),handles=[];let cursor=0;
      for(const p of source)for(let i=0;i<p.ids.length;i++)if(masks.get(p.land)[i]){positions[cursor*2]=p.positions[i*2];positions[cursor*2+1]=p.positions[i*2+1];positions3[cursor*3]=p.positions[i*2];positions3[cursor*3+1]=p.positions[i*2+1];handles.push({year,land:p.land,id:p.ids[i],index:i});cursor++;}
      if(cursor!==count)throw new Error('Маска не совпала с числом ДТП');setSnapshot({positions,positions3,handles,count});setQuerying(false);
    }).catch(e=>{if(alive&&current===revision.current){setError(e.message);setQuerying(false);}});
    return()=>{alive=false;};
  },[view,land,group,category,year]);
  useEffect(()=>{
    const worker=new HexWorker();hexWorker.current=worker;setHex(null);
    worker.onmessage=({data})=>{if(data.id!==hexRequest.current)return;if(data.error)setError(data.error);else setHex(data);setAggregating(false);};
    worker.onerror=()=>{setError('Ошибка worker агрегации');setAggregating(false);};
    worker.postMessage({type:'init',positions:snapshot.positions});
    return()=>{worker.onmessage=null;worker.terminate();hexWorker.current=null;};
  },[snapshot]);
  useEffect(()=>{
    const id=++hexRequest.current;if(activeMode!=='hex'||engine!=='h3'||querying||view.state!=='ready'||!hexWorker.current)return;
    counters.current.workerRequests++;setAggregating(true);hexWorker.current.postMessage({type:'compute',id,resolution});
  },[snapshot,resolution,activeMode,engine,querying,view.state]);
  function fitLand(value){setLand(value);if(!value){setCamera({longitude:10.4,latitude:51.1,zoom:4.6,pitch:0,bearing:0});return;}const f=boundaries?.features.find(f=>Number(f.properties.state_code)===value);if(!f)return;
    const xy=f.geometry.coordinates.flat(f.geometry.type==='MultiPolygon'?2:1),xs=xy.map(p=>p[0]),ys=xy.map(p=>p[1]),rect=mapBox.current.getBoundingClientRect();const fitted=new WebMercatorViewport({width:rect.width,height:rect.height}).fitBounds([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],{padding:45});setCamera({longitude:fitted.longitude,latitude:fitted.latitude,zoom:fitted.zoom,pitch:0,bearing:0});
  }
  const ready=view.state==='ready'&&!querying&&!error;
  const copyCamera=dataPolicy==='copy'?camera:null;
  const binary=useMemo(()=>{counters.current.dataBuilds++;return {length:snapshot.count,attributes:{getPosition:{value:copyCamera?snapshot.positions3.slice():snapshot.positions3,size:3}}};},[snapshot,copyCamera]);
  const cellData=useMemo(()=>{if(!hex)return null;counters.current.dataBuilds++;return copyCamera?hex.cells.map(c=>({...c})):hex.cells;},[hex,copyCamera]);
  const heatColors=useMemo(()=>palette.map(c=>c.slice(0,3)),[]);
  useEffect(()=>{setGPUCheck(null);},[snapshot,radius]);
  const layers=useMemo(()=>{
    const pickable=ready,list=[];
    if(visited.gpu)list.push(new HexagonLayer({id:'lab-gpu',visible:activeMode==='hex'&&engine==='gpu',data:binary,radius,gpuAggregation:true,colorAggregation:'SUM',getColorWeight:1,elevationAggregation:'SUM',getElevationWeight:1,extruded:false,coverage:1-gap,opacity,colorRange:palette,colorScaleType:'quantize',colorDomain:[0,colorMax],pickable,onSetColorDomain:()=>{counters.current.gpuUpdates++;setGPUInfo(info=>({...info,updatedAt:(gpuUpdated.current=Date.now())}));}}));
    if(visited.screen)list.push(new ScreenGridLayer({id:'lab-screen',visible:activeMode==='hex'&&engine==='screen',data:binary,gpuAggregation:true,aggregation:'SUM',getWeight:1,cellSizePixels:targetPixels,cellMarginPixels:2,opacity,colorRange:palette,colorScaleType:'quantize',colorDomain:[0,colorMax],pickable}));
    if(visited.h3&&cellData){const props={id:'lab-h3',visible:activeMode==='hex'&&engine==='h3',data:cellData,getFillColor:d=>palette[compareBin(d.count,colorMax)],extruded:false,opacity,stroked:false,pickable,updateTriggers:{getFillColor:colorMax}};
      list.push(geometry==='h3'?new H3HexagonLayer({...props,getHexagon:d=>d.id,coverage:1-gap,highPrecision:'auto'}):new PolygonLayer({...props,getPolygon:d=>{counters.current.polygonCalls++;return cellToBoundary(d.id,true);}}));}
    if(visited.points)list.push(new ScatterplotLayer({id:'lab-points',visible:activeMode==='points',data:binary,getRadius:2,radiusUnits:'pixels',getFillColor:theme==='dark'?[110,208,223,190]:[17,100,140,190],pickable}));
    if(visited.heat)list.push(new HeatmapLayer({id:'lab-heat',visible:activeMode==='heat',data:binary,getWeight:1,radiusPixels:30,intensity:1,threshold:.05,weightsTextureSize:1024,debounceTimeout:250,aggregation:'SUM',colorRange:heatColors,pickable:false}));
    if(boundaries)list.push(new GeoJsonLayer({id:'lab-boundaries',visible:showBoundaries,data:boundaries,filled:false,stroked:true,getLineColor:f=>Number(f.properties.state_code)===land?[242,180,85,235]:theme==='dark'?[180,203,212,125]:[60,85,95,135],getLineWidth:f=>Number(f.properties.state_code)===land?2:1,lineWidthUnits:'pixels',pickable:false,updateTriggers:{getLineColor:[land,theme],getLineWidth:land}}));
    if(selection?.kind==='point')list.push(new ScatterplotLayer({id:'lab-selected',data:[selection.position],getPosition:d=>d,getRadius:8,radiusUnits:'pixels',filled:false,stroked:true,getLineColor:[245,180,80,255],getLineWidth:2,lineWidthUnits:'pixels'}));
    return lifecycle==='remove'?list.filter(l=>l.props.visible!==false):list;
  },[ready,binary,activeMode,engine,visited,cellData,geometry,lifecycle,radius,targetPixels,heatColors,theme,showBoundaries,boundaries,land,selection,opacity,gap,colorMax]);
  function afterRender(){benchmark.afterRender();const list=deckRef.current?.deck?.props.layers||[],layer=list.find(l=>l.id==='lab-gpu'),path=layer?.state?.aggregatorType;if(path&&lastGPUPath.current!==path){lastGPUPath.current=path;setGPUInfo(i=>({...i,path}));}const gridPath=list.find(l=>l.id==='lab-screen')?.state?.aggregatorType;if(gridPath&&gridPath!==gridInfo)setGridInfo(gridPath);}
  function checkGPU(){try{
    const deck=deckRef.current?.deck,screen=engine==='screen',layer=deck?.props.layers.find(l=>l.id===(screen?'lab-screen':'lab-gpu')),aggregator=layer?.state?.aggregator,attribute=aggregator?.getResult(0);
    if(!attribute)throw new Error('Результат ещё не готов');
    const values=attribute.value||new Float32Array(attribute.buffer.readSyncWebGL().buffer),stride=(attribute.stride||4)/4,offset=(attribute.offset||0)/4;
    let total=0,nonempty=0;for(let i=0;i<aggregator.binCount;i++){const n=values[offset+i*stride];if(Number.isFinite(n)&&n>0){total+=n;nonempty++;}}
    const reference=screen?screenGridReference(snapshot.positions,deck.getViewports()[0],targetPixels):null,expected=reference?.count??snapshot.count;
    setGPUCheck({total,expected,screen,nonempty,valid:total===expected,diagnostic:JSON.stringify({bins:aggregator.binCount,points:aggregator.props.pointCount,range:aggregator.props.binIdRange,nearEdge:reference?.nearEdge})});
  }catch(e){setGPUCheck({error:e.message});}}
  function pick(info){if(!ready)return;if(info.layer?.id.startsWith('lab-screen')&&info.object){const c=info.object,viewport=deckRef.current.deck.getViewports()[0];setSelection({kind:'cell',screen:true,count:c.value,center:viewport.unproject([(c.col+.5)*targetPixels,(c.row+.5)*targetPixels]).slice(0,2),area:null});setDetail(null);return;}if(info.layer?.id.startsWith('lab-h3')&&info.object){const c=info.object;setSelection({kind:'cell',...c,center:cellToLatLng(c.id).reverse(),area:cellArea(c.id,'km2')});setDetail(null);}else if(info.layer?.id.startsWith('lab-gpu')&&info.object){const layer=deckRef.current.deck.props.layers.find(l=>l.id==='lab-gpu'),center=hexagonCenter(info.object,layer?.state,layer?.context.viewport);setSelection({kind:'cell',...info.object,position:center,center,area:null});setDetail(null);}else if(info.layer?.id==='lab-points'&&info.index>=0){const handle=snapshot.handles[info.index],position=[snapshot.positions[info.index*2],snapshot.positions[info.index*2+1]];setSelection({kind:'point',handle,position});setDetail(null);const selectedRevision=revision.current,detailRequest=++detailRevision.current;loader.current.details(year,'arrow',[handle]).then(r=>{if(selectedRevision===revision.current&&detailRequest===detailRevision.current)setDetail(r[0].record);}).catch(e=>setError(e.message));}}
  const loading=view.state!=='ready'&&!error;
  const explanation=activeMode==='hex'?(engine==='screen'?`ScreenGridLayer: ${gridInfo}. Ячейки ${targetPixels} px. Суммы относятся к экранной сетке, не ко всей территории. Размер области меняется при zoom.`:engine==='gpu'?`HexagonLayer: ${gpuInfo.path==='gpu'?'GPU':gpuInfo.path==='cpu'?'CPU fallback':'ожидание'}. Радиус ${nf.format(radius)} м. ${nf.format(snapshot.count)} ДТП в исходном отборе.`:`H3 ${hex?.resolution??resolution} · ${hex?nf.format(hex.totalCells):'…'} непустых ячеек. Сумма: ${hex?nf.format(hex.count):'…'} ДТП.`):activeMode==='points'?'Одна точка — одно геокодированное ДТП с пострадавшими.':'Сглаженная концентрация: вес ДТП 1, радиус30px. Цвет не означает точное число или риск поездки.';
  const status=error?error:loading?`Загружаем ${year}: ${view.loaded}/16 земель. Итог появится после полной проверки.`:querying?'Обновляем отбор…':activeMode==='hex'&&engine==='h3'&&aggregating?(hex?'Обновляем ячейки; предыдущий слой остаётся видимым…':'Считаем ячейки H3…'):`${nf.format(snapshot.count)} ДТП · ${names[land]} · ${year}`;
  return <main className="layers-lab"><h1>Карта и слои · реальный эксперимент</h1><fieldset disabled={benchmark.running} className="layers-toolbar">
    <label>Год<select aria-label="Год" value={year} onChange={e=>setYear(Number(e.target.value))}>{years.map(y=><option key={y}>{y}</option>)}</select></label>
    <label>Территория<select aria-label="Территория" value={land} onChange={e=>fitLand(Number(e.target.value))}>{names.map((n,i)=><option key={n} value={i}>{n}</option>)}</select></label>
    <label>Участники<select aria-label="Участники" value={group} onChange={e=>setGroup(e.target.value)}><option value="all">Все</option>{Object.entries(participantNames).map(([k,n])=><option key={k} value={k}>{n}</option>)}</select></label>
    <label>Последствия<select aria-label="Последствия" value={category} onChange={e=>setCategory(Number(e.target.value))}><option value="0">Все</option>{fields.category.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
    <label>Режим<select aria-label="Режим" value={mode} onChange={e=>{setMode(e.target.value);setSelection(null);setDetail(null);}}><option value="auto">Авто</option><option value="hex">Ячейки</option><option value="points">Точки</option><option value="heat">Тепловая карта</option></select></label>
    <label>Движок ячеек<select aria-label="Движок ячеек" value={engine} onChange={e=>{setEngine(e.target.value);setSelection(null);}}><option value="gpu">HexagonLayer · GPU</option><option value="screen">ScreenGridLayer · GPU</option><option value="h3">H3HexagonLayer · worker</option></select></label><label>Размер на экране<select aria-label="Размер на экране" value={targetPixels} onChange={e=>setTargetPixels(Number(e.target.value))}>{[16,24,32,36,48].map(p=><option key={p} value={p}>{p} px · ориентир</option>)}</select></label><label>Разрешение H3<select aria-label="Разрешение H3" disabled={engine!=='h3'} value={manualRes} onChange={e=>{setManualRes(e.target.value);setSelection(null);}}><option value="auto">Автоматически по размеру</option>{[3,4,5,6,7,8,9,10].map(r=><option key={r} value={r}>H3 · {r}</option>)}</select></label>
    <label>Прозрачность ячеек<select aria-label="Прозрачность ячеек" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}><option value="0.4">40%</option><option value="0.65">65%</option><option value="0.85">85%</option><option value="1">100%</option></select></label><label>Зазор ячеек<select aria-label="Зазор ячеек" disabled={engine==='screen'} value={gap} onChange={e=>setGap(Number(e.target.value))}><option value="0">Без зазора</option><option value="0.1">10%</option><option value="0.2">20%</option></select></label><label>Цветовая шкала до<select aria-label="Цветовая шкала до" value={colorMax} onChange={e=>setColorMax(Number(e.target.value))}>{[100,250,500,1000,5000,10000,50000].map(n=><option key={n} value={n}>{nf.format(n)} ДТП</option>)}</select></label><label>Подложка<select aria-label="Подложка" value={theme} onChange={e=>setTheme(e.target.value)}><option value="dark">Dark Matter</option><option value="light">Positron</option></select></label>
    <button onClick={()=>setCamera(c=>({...c,zoom:Math.min(17,c.zoom+1)}))}>Приблизить +</button><button onClick={()=>setCamera(c=>({...c,zoom:Math.max(3,c.zoom-1)}))}>Отдалить −</button><button onClick={()=>{fitLand(11);setCamera({longitude:13.405,latitude:52.52,zoom:11.5,pitch:0,bearing:0});}}>Berlin · город</button>
  </fieldset><div className={'layers-status'+(error?' error':'')} role={error?'alert':'status'}>{status}{error&&<button onClick={()=>setRetry(n=>n+1)}>Повторить</button>}</div>
  <details className="benchmark" open><summary>Проверка гипотез Performance Optimization</summary><fieldset disabled={benchmark.running} className="layers-toolbar">
    <label>Радиус GPU<select aria-label="Радиус GPU" disabled={engine!=='gpu'} value={radiusPolicy} onChange={e=>setRadiusPolicy(e.target.value)}><option value="screen">По размеру на экране</option><option value="fixed">Фиксированный в метрах</option></select></label>
    <label>Фиксированный радиус<select aria-label="Фиксированный радиус" disabled={engine!=='gpu'||radiusPolicy!=='fixed'} value={fixedRadius} onChange={e=>setFixedRadius(Number(e.target.value))}>{[500,1000,2000,5000].map(r=><option key={r} value={r}>{nf.format(r)} м</option>)}</select></label>
    <label>Управление камерой<select aria-label="Управление камерой" value={cameraDriver} onChange={e=>{clearTimeout(cameraTimer.current);setCameraState(cameraRef.current);setSettledCamera(cameraRef.current);setCameraDriver(e.target.value);if(e.target.value==='deck')setDataPolicy('stable');}}><option value="react">React · каждый кадр</option><option value="deck">deck.gl · UI после движения</option></select></label>
    <label>Ссылки на данные<select aria-label="Ссылки на данные" disabled={cameraDriver==='deck'} value={dataPolicy} onChange={e=>setDataPolicy(e.target.value)}><option value="stable">Стабильные · оптимизация</option><option value="copy">Копировать при движении · контроль</option></select></label>
    <label>Переключение слоёв<select aria-label="Переключение слоёв" value={lifecycle} onChange={e=>setLifecycle(e.target.value)}><option value="visible">visible · сохранять</option><option value="remove">Удалять и создавать</option></select></label>
    <label>Геометрия H3<select aria-label="Геометрия H3" disabled={engine!=='h3'} value={geometry} onChange={e=>setGeometry(e.target.value)}><option value="h3">H3HexagonLayer</option><option value="polygons">PolygonLayer · массив в getPolygon</option></select></label>
    <label>Пиксели deck.gl<select aria-label="Пиксели deck.gl" value={devicePixels} onChange={e=>setDevicePixels(e.target.value)}><option value="native">DPR устройства</option><option value="1">DPR 1</option></select></label>
    <button disabled={!ready||aggregating} onClick={()=>startBenchmark('pan')}>Тест перемещения · 7 с</button><button disabled={!ready||aggregating} onClick={()=>startBenchmark('zoom')}>Тест масштаба · 7 с</button><button disabled={!ready||aggregating} onClick={()=>startBenchmark('switch')}>Тест переключения · 7 с</button>
    <button disabled={!benchmark.results.length} onClick={benchmark.download}>Скачать замеры JSON</button>
  </fieldset><p className="layers-muted">{benchmark.running?'Идёт прогон. Не меняйте параметры и держите вкладку активной.':'Меняйте один параметр за раз. 1 с прогрева + 6 с RAF-замеров; камера затем возвращается.'} RAF — задержки браузерных кадров, не FPS видеокарты. CPU render — синхронный вызов deck.gl, не завершение GPU. Подложка участвует в RAF; DPR меняется только у deck.gl. PolygonLayer не поддерживает наш зазор. Скрытые слои сохраняют ресурсы: visible экономит пересоздание, но не память.</p>
  {benchmark.results.length>0&&<div className="benchmark-table"><table><thead><tr><th>Прогон / движение</th><th>Настройки</th><th>RAF среднее / p95 / max, мс</th><th>Кадры &gt;50 мс</th><th>CPU render среднее, мс</th><th>Данные / H3 запросы / getPolygon</th><th>React камера / Hex GPU события</th></tr></thead><tbody>{benchmark.results.map((r,i)=><tr key={i}><td>{r.scenario} · {r.motion?.verified===true?'подтверждено':r.motion?.verified===false?'НЕ ПОДТВЕРЖДЕНО':'нет проверки'}</td><td>{r.engine} · {r.dataPolicy} · {r.lifecycle} · {r.geometry} · DPR {r.devicePixels} · {r.cameraDriver} · {r.engine==='screen'?`${r.targetPixels} px`:r.radiusPolicy}{r.engine!=='screen'&&r.radiusPolicy==='fixed'?` ${r.fixedRadius} м`:''}</td><td>{[r.raf.meanMs,r.raf.p95Ms,r.raf.maxMs].map(n=>n.toFixed(1)).join(' / ')}</td><td>{r.raf.over50}</td><td>{r.renderCPU.meanMs.toFixed(2)}</td><td>{r.counterDelta.dataBuilds} / {r.counterDelta.workerRequests} / {r.counterDelta.polygonCalls}</td><td>{r.counterDelta.cameraStateUpdates??'—'} / {r.counterDelta.gpuUpdates??'—'}</td></tr>)}</tbody></table></div>}</details>
  <div className="layers-workspace"><div ref={mapBox} className="layers-map" aria-label="Карта ДТП"><DeckGL ref={deckRef} useDevicePixels={devicePixels==='native'?true:1} onBeforeRender={benchmark.beforeRender} onAfterRender={afterRender} viewState={cameraDriver==='react'?camera:undefined} initialViewState={undefined} onViewStateChange={({viewState})=>{if(!benchmark.running)observeCamera(viewState);}} controller={!benchmark.running} layers={layers} onClick={pick} getTooltip={info=>activeMode==='hex'&&info.object?`${nf.format(info.object.value??info.object.count)} ДТП`:null}><MapView ref={baseMapRef} mapStyle={styles[theme]} attributionControl/></DeckGL></div>
  <aside className="layers-panel"><h2>{activeMode==='hex'?'ДТП в географических ячейках':activeMode==='heat'?'Концентрация ДТП':'Отдельные ДТП'}</h2><strong className="count">{ready?nf.format(snapshot.count):'—'}</strong><p>{names[land]} · {year}</p><p className="layers-muted">{explanation}</p>
  {activeMode==='hex'?<><h3>Количество ДТП в ячейке</h3><ul className="layers-legend">{breaks.map((n,i)=><li key={n}><i style={{background:`rgb(${palette[i].slice(0,3).join(',')})`}}/>{i===breaks.length-1?`${nf.format(n)} и больше`:`${n}–${breaks[i+1]-1}`}</li>)}</ul><p className="layers-muted">Одинаковая цветовая шкала для двух движков. Сетки различаются: совпадение итогов не означает совпадение отдельных ячеек.</p></>:null}
  <>{activeMode==='hex'&&(engine==='gpu'||engine==='screen')&&<><button disabled={!ready} onClick={checkGPU}>Проверить сумму GPU</button>{gpuCheck&&<p className="layers-muted" role="status">{gpuCheck.error||`Сумма ячеек: ${nf.format(gpuCheck.total)} · CPU: ${nf.format(gpuCheck.expected)} · ${nf.format(gpuCheck.nonempty)} непустых · ${gpuCheck.valid?(gpuCheck.screen?'совпадает с CPU-проверкой экранной сетки':'совпадает с отбором'):'НЕ СОВПАЛА'}`}</p>}{gpuCheck?.diagnostic&&<details><summary>Диагностика буферов</summary><p className="layers-muted">{gpuCheck.diagnostic}</p></details>}</>}</><label><input type="checkbox" checked={showBoundaries} onChange={e=>setShowBoundaries(e.target.checked)}/> Границы земель</label>
  {activeMode==='heat'&&<><div className="heat-legend"/><p className="layers-muted">Меньше ← концентрация → больше. Цветовая шкала адаптивная, точных значений не показывает.</p></>}
  {selection?.kind==='cell'?<><h3>Выбранная ячейка</h3><p><strong>{nf.format(selection.count)} ДТП</strong> · {!selection.center?'Не удалось определить центр ячейки':selection.screen?'экранная ячейка; площадь меняется с масштабом':selection.area!=null?selection.area.toFixed(2)+' км²':'площадь зависит от геометрии сетки'}</p><button disabled={!selection.center} onClick={()=>setCamera(c=>({...c,longitude:selection.center[0],latitude:selection.center[1],zoom:Math.min(16,c.zoom+2)}))}>Приблизить к ячейке</button></>:selection?.kind==='point'?<><h3>Выбранное ДТП</h3>{detail?<><p>{fields.category.options.find(o=>o.value===detail.category)?.label}</p><p>{detail.month}.{year} · {String(detail.hour).padStart(2,'0')}:00–{String(detail.hour).padStart(2,'0')}:59</p><p>{detail.participants.map(k=>participantNames[k]).join(' · ')}</p><a href={`https://www.openstreetmap.org/?mlat=${detail.latitude}&mlon=${detail.longitude}#map=18/${detail.latitude}/${detail.longitude}`} target="_blank" rel="noreferrer">Посмотреть место на OpenStreetMap ↗</a></>:<p>Читаем запись…</p>}<button onClick={()=>setCamera(c=>({...c,longitude:selection.position[0],latitude:selection.position[1],zoom:Math.max(c.zoom,14)}))}>Приблизить к ДТП</button></>:<p className="layers-muted">Нажмите ячейку или точку. Выбор сам по себе не двигает камеру.</p>}
  {selection&&<button onClick={()=>{setSelection(null);setDetail(null);}}>Закрыть сведения</button>}
  <details open><summary>Параметры эксперимента</summary><p className="layers-muted">Zoom {camera.zoom.toFixed(2)} · Центр {camera.longitude.toFixed(5)}, {camera.latitude.toFixed(5)} · Авто: точки от10.2, ячейки до9.8. Пересчёт H3 при перемещении не запускается. Данные: {dataPolicy} · слои: {lifecycle} · DPR deck.gl: {devicePixels}.</p><p className="layers-muted">Движок GPU: {gpuInfo.path} · последнее событие обновления {gpuInfo.updatedAt==null?'—':new Date(gpuInfo.updatedAt).toLocaleTimeString('ru-RU')}. Время выполнения GPU отдельно не измерено.</p>{hex&&<p className="layers-muted">H3 {hex.resolution}: {Math.round(hex.indexMs)} мс{hex.cached?' · кеш':''}. Сумма {nf.format(hex.count)} · запрос #{hex.id}. Геометрия: {geometry==='h3'?'H3HexagonLayer':'PolygonLayer / getPolygon'}, не worker.</p>}</details>
  <p className="layers-muted">© BKG (2026), dl-de/by-2-0 · границы. Эксперимент, основной сайт не изменён.</p></aside></div></main>;
}
