import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import NativeOverview from '../src/app/NativeOverview.jsx';
import NativeTime from '../src/app/NativeTime.jsx';
import NativeSeverity from '../src/app/NativeSeverity.jsx';
import {loadStateBoundaries} from '../src/files/geography-data.js';
import './shell-layout-lab.css';
import MapPanelLab from './MapPanelLab.jsx';
const mapLab=location.pathname.endsWith('/map-workspace-lab.html');
const names=['Германия','Schleswig-Holstein','Hamburg','Niedersachsen','Bremen','Nordrhein-Westfalen','Hessen','Rheinland-Pfalz','Baden-Württemberg','Bayern','Saarland','Berlin','Brandenburg','Mecklenburg-Vorpommern','Sachsen','Sachsen-Anhalt','Thüringen'];
const screens={overview:'Обзор',time:'Время и сезонность',severity:'Последствия и условия',map:'Карта ДТП'};
const groups={all:'Все ДТП',pkw:'С участием Pkw',rad:'С велосипедистами',fuss:'С пешеходами',krad:'С мототранспортом',gkfz:'С грузовыми ТС',other_participant:'С другими участниками'};
const years=[2020,2021,2022,2023,2024,2025],nf=new Intl.NumberFormat('ru-RU');
const participants=['Pkw','Велосипедисты','Пешеходы','Мототранспорт','Грузовые ТС','Другие'];
function coordinates(g){return g.type==='Polygon'?g.coordinates:g.coordinates.flat();}
export function MapSketch({region,data,active}){
  const [geometry,setGeometry]=useState(null),[error,setError]=useState(''),[panel,setPanel]=useState('summary'),[selected,setSelected]=useState(false),[values,setValues]=useState(participants.map(()=>1));
  useEffect(()=>{if(active&&!geometry)loadStateBoundaries().then(setGeometry).catch(e=>setError(e.message));},[active,geometry]);
  const feature=geometry?.features.find(f=>Number(f.properties.state_code)===region);
  const rings=(feature?[feature]:geometry?.features||[]).flatMap(f=>coordinates(f.geometry));
  const project=([x,y])=>[x*70,600-y*100];
  const points=rings.flat().map(project),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const minX=Math.min(...xs),minY=Math.min(...ys),w=Math.max(...xs)-minX,h=Math.max(...ys)-minY;
  const viewBox=points.length?`${minX-25} ${minY-25} ${w+50} ${h+50}`:'0 0 700 850';
  return <div className="lab-workspace"><section className="lab-map" aria-label="Схема карты с границами земель">
    <div className="map-caption">Границы BKG · схема без тайлов и точек ДТП</div>
    {error?<p role="alert">{error}</p>:geometry?<svg viewBox={viewBox} role="img" aria-label={'Границы: '+names[region]}>{geometry.features.map(f=><path key={f.properties.state_code} d={coordinates(f.geometry).map(r=>'M'+r.map(p=>project(p).join(',')).join('L')+'Z').join('')} fill={Number(f.properties.state_code)===region?'var(--selected)':'var(--map-land)'} stroke={Number(f.properties.state_code)===region?'var(--accent)':'var(--map-border)'} strokeWidth="1" vectorEffect="non-scaling-stroke"/>)}</svg>:<p>Готовим контуры…</p>}
    <div className="map-actions"><button onClick={()=>{setSelected(true);setPanel('record');}}>Пример карточки</button></div><small className="map-credit">© BKG (2026), dl-de/by-2-0 · контуры упрощены</small>
  </section>{mapLab?<MapPanelLab region={region} name={names[region]} data={data} panel={panel} setPanel={setPanel} selected={selected} setSelected={setSelected}/>:<aside className="lab-information"><div className="panel-tabs" role="group" aria-label="Информационная панель">{[['summary','Сводка'],['filters','Фильтры'],['record','ДТП']].map(([key,label])=><button key={key} aria-pressed={panel===key} onClick={()=>setPanel(key)}>{label}</button>)}</div>
    <div className="information-body">{panel==='summary'?<><h2>Текущий отбор</h2><p>{names[region]} · {data.year}</p><strong className="summary-number">{nf.format(data.count)}</strong><p>ДТП с пострадавшими</p><p className="muted">Здесь будет сводка отбора карты. Сейчас число взято из Обзора; схема показывает только границы.</p><button onClick={()=>setPanel('filters')}>Настроить фильтры</button></>:panel==='filters'?<><h2>Участники</h2><p className="muted">Образец компактного контрола. В этой лаборатории отбор не пересчитывается.</p><p className="filter-legend">− без участия · ○ любые · + с участием</p><div className="participant-filters">{participants.map((name,i)=><fieldset className="tri-row" key={name}><legend>{name}</legend><div className="tri-control">{['Без участия','Любые — участие не учитывается','С участием'].map((label,j)=><label key={label} data-mode={j} title={label}><input type="radio" aria-label={name+': '+label} name={'participant-'+i} checked={values[i]===j} onChange={()=>setValues(v=>v.map((x,k)=>k===i?j:x))}/><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{j===1?<circle cx="12" cy="12" r="7"/>:<><path d="M5 12h14"/>{j===2&&<path d="M12 5v14"/>}</>}</svg></label>)}</div></fieldset>)}</div><p className="muted">Сетка часов и полный редактор — следующий этап согласования.</p></>:<><h2>{selected?'Пример карточки ДТП':'ДТП не выбрано'}</h2><p className="muted">Демонстрация размера панели, без реальной записи.</p>{selected&&<><p className="example-severity">С тяжелоранеными</p><p>Участники: Pkw · велосипед</p><p>Открытие и закрытие не меняют область схемы карты.</p><button onClick={()=>{setSelected(false);setPanel('summary');}}>Закрыть → сводка</button></>}</>}</div>
  </aside>}</div>;
}
export function Lab(){
  const query=new URLSearchParams(location.search);
  const [screen,setScreen]=useState(Object.hasOwn(screens,query.get('screen'))?query.get('screen'):(mapLab?'map':'overview'));
  const [region,setRegion]=useState(Number(query.get('region'))>=0&&Number(query.get('region'))<=16?Number(query.get('region')):0),[year,setYear]=useState(years.includes(Number(query.get('year')))?Number(query.get('year')):2025);
  const [from,setFrom]=useState(2020),[to,setTo]=useState(2025),[group,setGroup]=useState('all'),[theme,setTheme]=useState(document.documentElement.dataset.theme);
  const [headerSize,setHeaderSize]=useState(36),[width,setWidth]=useState(1190),[data,setData]=useState(null),[error,setError]=useState('');
  const scrolls=useRef({}),menu=useRef(null);
  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('uad-shell-lab-theme',theme);}catch{/* Optional preview preference. */}},[theme]);
  useEffect(()=>{const controller=new AbortController();Promise.all(['overview','time','severity'].map(name=>fetch(import.meta.env.BASE_URL+'analytics/'+name+'.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}))).then(([overview,time,severity])=>{if(!controller.signal.aborted)setData({overview,time,severity});}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[]);
  useEffect(()=>{history.replaceState(null,'','?'+new URLSearchParams({screen,region,year}));},[screen,region,year]);
  function navigate(next){scrolls.current[screen]=window.scrollY;setScreen(next);menu.current?.close();requestAnimationFrame(()=>window.scrollTo(0,scrolls.current[next]||0));}
  const context={region,year,from,to,group},annual=data&&(region?data.overview.years[year].lands[region]:data.overview.years[year].national);
  const links=()=>Object.entries(screens).map(([key,label])=><button key={key} aria-current={screen===key?'page':undefined} onClick={()=>navigate(key)}>{label}</button>);
  return <div className={mapLab?'shell-lab map-workspace-lab':'shell-lab'} style={{'--header-control':headerSize+'px','--analytics-width':width+'px'}}>
    <div className="lab-settings"><span>{mapLab?'Лаборатория карты и панели':'Лаборатория темы и оболочки'}</span><label>Контролы<select aria-label="Размеры контролов" value={headerSize} onChange={e=>setHeaderSize(Number(e.target.value))}><option value="40">32 / 40</option><option value="36">32 / 36</option></select></label><label>Ширина аналитики<select aria-label="Ширина аналитики" value={width} onChange={e=>setWidth(Number(e.target.value))}>{[1040,1120,1190].map(n=><option key={n} value={n}>{n} px</option>)}</select></label><small>Отдельный макет · данные UAD · карту и фильтры согласуем отдельно</small></div>
    <div className="lab-shell"><aside className="lab-nav"><div className="brand">Unfallatlas</div><nav aria-label="Разделы приложения">{links()}</nav></aside><div className="lab-body">
      <header className="lab-header"><div className="heading"><button className="menu-open" aria-label="Открыть меню" onClick={()=>menu.current.showModal()}>☰</button><div><h1>{screens[screen]}</h1><p>{names[region]} · {screen==='map'||screen==='overview'?year:`${from}–${to}`}{screen==='overview'?' · Все ДТП':''}</p></div></div>
      <div className="header-controls"><label>Территория<select aria-label="Территория" value={region} onChange={e=>setRegion(Number(e.target.value))}>{names.map((name,i)=><option key={name} value={i}>{name}</option>)}</select></label>{screen==='map'||screen==='overview'?<label>Год<select aria-label="Год" value={year} onChange={e=>setYear(Number(e.target.value))}>{years.map(y=><option key={y}>{y}</option>)}</select></label>:<>{[['С года',from,v=>{setFrom(v);if(v>to)setTo(v);}],['По год',to,v=>{setTo(v);if(v<from)setFrom(v);}]].map(([label,value,set])=><label key={label}>{label}<select aria-label={label} value={value} onChange={e=>set(Number(e.target.value))}>{years.map(y=><option key={y}>{y}</option>)}</select></label>)}<label>Участники<select aria-label="Участники" value={group} onChange={e=>setGroup(e.target.value)}>{Object.entries(groups).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></>}
      {screen!=='map'&&<button onClick={()=>navigate('map')}>Показать на карте →</button>}<div className="theme-group" role="group" aria-label="Тема приложения"><button aria-label="Тёмная тема" aria-pressed={theme==='dark'} onClick={()=>setTheme('dark')}>☾</button><button aria-label="Светлая тема" aria-pressed={theme==='light'} onClick={()=>setTheme('light')}>☀</button></div></div></header>
      <main className={screen==='map'?'lab-content map-content':'lab-content'}>{error?<p role="alert">Не удалось загрузить сводки: {error}</p>:!data?<p role="status">Загружаем сводки…</p>:<>
        <section hidden={screen!=='overview'}><NativeOverview data={data.overview} context={context} names={names} onRegion={setRegion} active={screen==='overview'}/></section>
        <section hidden={screen!=='time'}><NativeTime data={data.time} context={context} names={names}/></section>
        <section hidden={screen!=='severity'}><NativeSeverity data={data.severity} context={context} names={names} active={screen==='severity'}/></section>
        <section hidden={screen!=='map'}><div className="map-result"><strong>{nf.format(annual.count)} ДТП{mapLab?' за год · без фильтров':''}</strong><span>{names[region]} · {year}</span><small>Схема компоновки · точки не загружены</small></div><MapSketch region={region} data={{...annual,year}} active={screen==='map'}/></section>
      </>}</main></div></div><dialog ref={menu} className="lab-menu" aria-label="Меню разделов"><button onClick={()=>menu.current.close()}>Закрыть меню</button><nav>{links()}</nav></dialog>
  </div>;
}
createRoot(document.getElementById('root')).render(<Lab/>);
