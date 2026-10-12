import {useEffect,useRef,useState} from 'react';
import {overviewYears} from '../files/overview-data.js';
import {overviewStats,overviewComparison,overviewTrend,overviewChange,overviewMetrics} from './overview-model.js';
import './overview.css';
const nf=new Intl.NumberFormat('ru-RU'),df=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const show=value=>value==null?'Нет данных':nf.format(value);
const value=(row,metric)=>row[metric]==null?'Нет данных':metric==='count'?nf.format(row[metric]):df.format(row[metric]);
const participants=[['pkw','Pkw'],['rad','Велосипеды'],['fuss','Пешеходы'],['krad','Мототранспорт'],['gkfz','Грузовые ТС'],['other_participant','Другие']];
const severityNames=['С погибшими','С тяжелоранеными','С легкоранеными'];
function Choices({label,choices,current,onChange}){
  return <div className="ov-choices" role="group" aria-label={label}>{Object.entries(choices).map(([key,text])=><button key={key} type="button" aria-pressed={current===key} onClick={()=>onChange(key)}>{text}</button>)}</div>;
}
function MetricChoices(props){return <Choices {...props} choices={{count:'Количество ДТП',severity:'Тяжёлые последствия, %',rate:'На 10 000 Pkw'}}/>;}
function Delta({current,previous,points=false}){
  const delta=overviewChange(current,previous,points);
  return <span className="ov-change">{delta==null?'Нет сравнения с предыдущим годом':(delta>=0?'+':'')+df.format(delta)+(points?' п. п.':' %')+' к предыдущему году'}</span>;
}
function IndicatorCards({current,previous}){
  const indicators=[
    {label:'Все ДТП с пострадавшими',number:show(current.count),current:current.count,previous:previous?.count,help:'Это геокодированные ДТП с пострадавшими, а не все полицейские ДТП.'},
    {label:'ДТП с погибшими',number:show(current.category[0]),current:current.category[0],previous:previous?.category[0],help:'Число ДТП, в которых были погибшие. Число погибших людей в этом наборе отсутствует.'},
    {label:'Доля тяжёлых последствий',number:current.severity==null?'Нет данных':df.format(current.severity)+'%',current:current.severity,previous:previous?.severity,points:true,help:'Доля ДТП с погибшими или тяжелоранеными среди всех ДТП с пострадавшими.'},
    {label:'ДТП с Pkw на 10 000 Pkw',number:value(current,'rate'),current:current.rate,previous:previous?.rate,help:'ДТП с участием Pkw / средний парк Pkw на начало и конец года × 10 000. Без учёта пробега и транзита.'}
  ];
  const dialog=useRef(null),[help,setHelp]=useState('');
  function explain(text){setHelp(text);dialog.current.showModal();}
  return <section className="ov-panel" aria-label="Основные показатели"><h2>Основные показатели</h2><div className="ov-cards">{indicators.map(card=><article key={card.label} className="ov-card"><div className="ov-card-label">{card.label}<button className="ov-info" aria-label={'Пояснение: '+card.label} onClick={()=>explain(card.help)}>i</button></div><strong className="ov-card-value">{card.number}</strong><Delta {...card}/></article>)}</div><dialog ref={dialog} className="ov-dialog" aria-label="Пояснение показателя"><p>{help}</p><button onClick={()=>dialog.current.close()}>Закрыть</button></dialog></section>;
}
function YearTable({data,region,year}){
  return <div className="ov-table"><table><caption className="ov-sr-only">Показатели выбранной территории по годам</caption><thead><tr><th scope="col">Год</th><th scope="col">ДТП</th><th scope="col">Тяжёлые, %</th><th scope="col">На 10 000 Pkw</th></tr></thead><tbody>{overviewYears.map(y=>{const row=overviewStats(data,y,region);return <tr key={y} className={y===year?'ov-selected':''}><th scope="row">{y}</th><td>{value(row,'count')}</td><td>{value(row,'severity')}</td><td>{value(row,'rate')}</td></tr>;})}</tbody></table></div>;
}
function TrendChart({data,region,year,metric,mode,names,active}){
  const ref=useRef(null),[width,setWidth]=useState(700);
  useEffect(()=>{const el=ref.current;const observer=new ResizeObserver(entries=>{const next=entries[0].contentRect.width;if(next>0)setWidth(next);});observer.observe(el);return()=>observer.disconnect();},[]);
  const series=overviewTrend(data,region,metric,mode),a=series.selected,b=series.national;
  const all=[...a,...(b||[])].map(p=>p.value).filter(v=>v!=null);
  const w=Math.max(290,width),h=250,left=53,right=25,top=32,bottom=38;
  const minimum=mode==='bars'?0:Math.min(...all)*.9,maximum=Math.max(...all)*1.12;
  const span=maximum-minimum||1,x=i=>left+(w-left-right)*i/(a.length-1),sy=v=>h-bottom-(v-minimum)/span*(h-top-bottom);
  const path=points=>points.filter(p=>p.value!=null).map((p)=>{const i=a.findIndex(q=>q.year===p.year);return `${i?'L':'M'}${x(i)},${sy(p.value)}`;}).join(' ');
  const format=v=>metric==='count'&&!series.index?nf.format(v):df.format(v);
  return <div ref={ref} className="ov-chart" aria-busy={!active?undefined:false}>{mode==='table'?<YearTable data={data} region={region} year={year}/>:<svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${overviewMetrics[metric]}, ${names[region]}, 2020–2025${series.index?', индекс 2020 = 100':''}`}>
    {[0,1,2,3].map(i=>{const v=minimum+span*i/3;return <g key={i}><line x1={left} x2={w-right} y1={sy(v)} y2={sy(v)} stroke="#e8eef1"/><text x={left-8} y={sy(v)+4} textAnchor="end">{metric==='count'&&!series.index?Math.round(v/1000)+'к':df.format(v)}</text></g>;})}
    {b&&<path d={path(b)} stroke="#a1afbf" strokeWidth="2" strokeDasharray="5 4" fill="none"/>}
    {mode==='line'&&<path d={path(a)} stroke="#218978" strokeWidth="2.5" fill="none"/>}
    {a.map((p,i)=>{if(p.value==null)return null;const tick=w>560||[0,2,5].includes(i),xPos=mode==='bars'?left+(w-left-right)*(i+.5)/a.length:x(i),barWidth=(w-left-right)/a.length*.58;return <g key={p.year}>{mode==='bars'?<rect x={xPos-barWidth/2} y={sy(p.value)} width={barWidth} height={h-bottom-sy(p.value)} rx="3" fill={p.year===year?'#218978':'#8bc1b5'}><title>{p.year+': '+format(p.value)}</title></rect>:<circle cx={xPos} cy={sy(p.value)} r={p.year===year?6:4} fill="#218978"><title>{p.year+': '+format(p.value)}</title></circle>}{tick&&<><text className="ov-point-label" x={xPos} y={sy(p.value)-12} textAnchor={mode==='line'&&i===0?'start':mode==='line'&&i===5?'end':'middle'}>{format(p.value)}</text><text x={xPos} y={h-9} textAnchor="middle">{p.year}</text></>}</g>;})}
  </svg>}<p className="ov-muted">{mode==='table'?'Точные значения выбранной территории; выделен год из верхней панели.':(series.index?'Индекс 2020 = 100: сравнение темпов изменения. ':mode==='bars'?'Столбцы начинаются от нуля. ':'')+(b?'Зелёная линия — '+names[region]+', пунктир — Германия. ':names[region]+'. ')+overviewMetrics[metric]+'.'}</p></div>;
}
function SeverityPanel({current,name}){
  return <section className="ov-panel" aria-labelledby="ov-severity"><h2 id="ov-severity">Последствия</h2><p className="ov-muted">{name+' · '+current.year}</p><div className="ov-stack" aria-hidden="true">{current.category.map((n,i)=><span key={i} className={'ov-category-'+i} style={{width:(current.count?n/current.count*100:0)+'%'}}/>)}</div>{current.category.map((n,i)=><div className="ov-severity-row" key={i}><span><i className={'ov-swatch ov-category-'+i}/>{severityNames[i]}</span><strong>{show(n)+' · '+(current.count?df.format(n/current.count*100)+'%':'Нет данных')}</strong></div>)}<p className="ov-muted">Категория определяется по наиболее тяжёлому последствию ДТП.</p></section>;
}
function ParticipantsPanel({current,name,mode,setMode}){
  return <section className="ov-panel" aria-labelledby="ov-participants"><h2 id="ov-participants">Участники</h2><p className="ov-muted">{name+' · '+current.year}</p><Choices label="Представление участников" choices={{count:'Количество',share:'Доля ДТП, %'}} current={mode} onChange={setMode}/>{participants.map(([key,text])=><div className="ov-participant-row" key={key}><span>{text}</span><span className="ov-track" aria-hidden="true"><i style={{width:(current.count?current.participation[key]/current.count*100:0)+'%'}}/></span><strong>{mode==='count'?show(current.participation[key]):current.count?df.format(current.participation[key]/current.count*100)+'%':'Нет данных'}</strong></div>)}<p className="ov-muted">Группы пересекаются. Одно ДТП может включать несколько видов участников; доли не складываются в 100%.</p></section>;
}
function LandComparison({data,year,region,names,metric,setMetric,mode,setMode,onRegion}){
  const rows=overviewComparison(data,year,metric),max=Math.max(1,...rows.map(r=>r[metric]??0));
  return <section className="ov-panel" aria-labelledby="ov-lands"><h2 id="ov-lands">Сравнение земель</h2><p className="ov-muted">{year+' · '+overviewMetrics[metric]+' · Германия: '+value(overviewStats(data,year,0),metric)}</p><MetricChoices label="Показатель сравнения земель" current={metric} onChange={setMetric}/><Choices label="Представление сравнения земель" choices={{bars:'Полосы',table:'Таблица'}} current={mode} onChange={setMode}/>{mode==='table'?<div className="ov-table"><table><caption className="ov-sr-only">Сравнение всех 16 земель</caption><thead><tr><th scope="col">Земля</th><th scope="col">ДТП</th><th scope="col">Тяжёлые, %</th><th scope="col">На 10 000 Pkw</th></tr></thead><tbody>{rows.map(r=><tr key={r.land} className={r.land===region?'ov-selected':''}><th scope="row"><button className="ov-table-link" onClick={()=>onRegion(r.land)}>{names[r.land]}</button></th><td>{value(r,'count')}</td><td>{value(r,'severity')}</td><td>{value(r,'rate')}</td></tr>)}</tbody></table></div>:<div>{rows.map(r=><button key={r.land} className={'ov-land-row'+(r.land===region?' ov-selected':'')} onClick={()=>onRegion(r.land)} aria-label={names[r.land]+': '+value(r,metric)}><span>{names[r.land]}</span><span className="ov-track" aria-hidden="true"><i style={{width:(r[metric]??0)/max*100+'%'}}/></span><strong>{value(r,metric)}</strong></button>)}</div>}<p className="ov-muted">Сортировка по показателю, выбранному в этом блоке. Нажмите название земли, чтобы открыть её обзор. Абсолютное количество не учитывает население и объём движения.</p></section>;
}
function Sources({current,name}){
  return <section className="ov-panel"><h2>Источники и расчёты</h2><details className="ov-sources"><summary>Что именно показывают эти числа?</summary><p>Unfallatlas 2020–2025: геокодированные ДТП с пострадавшими. Категория «с погибшими» означает число таких ДТП, а не число погибших людей. Тяжёлые последствия — категории с погибшими и тяжелоранеными.</p><p>ДТП с Pkw на 10 000 Pkw = ДТП с участием Pkw / ((парк Pkw на 1 января года + парк Pkw на 1 января следующего года) / 2) × 10 000. Источник парка: KBA FZ 1, снимки на 1 января 2020–2026. Это приближение по двум концам года, без поправки на пробег и транзит; показатель не равен риску поездки.</p><p>Национальный парк берётся из опубликованного итога Германии, включая Sonstige, а не из суммы земель. Наличие Pkw и велосипеда в одном ДТП само по себе не описывает, кто с кем столкнулся.</p><p>{name+' · '+current.year+': парк Pkw на начало года '+show(current.begin)+', на конец '+show(current.end)+'; ДТП с Pkw '+show(current.participation.pkw)+'.'}</p></details></section>;
}
export default function NativeOverview({data,error,onRetry,context,names,onRegion,active}){
  const [trendMetric,setTrendMetric]=useState('count'),[trendMode,setTrendMode]=useState('line'),[landMetric,setLandMetric]=useState('count'),[landMode,setLandMode]=useState('bars'),[participantMode,setParticipantMode]=useState('count');
  const body=useRef(null);
  useEffect(()=>{if(!active)body.current?.querySelector('dialog[open]')?.close();},[active]);
  if(error)return <section className="native-overview"><p role="alert">{error}</p><button onClick={onRetry}>Повторить загрузку обзора</button></section>;
  if(!data)return <section className="native-overview" aria-busy="true"><p>Читаем сводки и автопарк…</p></section>;
  const {year,region}=context,current=overviewStats(data,year,region),previous=data.years[year-1]?overviewStats(data,year-1,region):null;
  return <div className="native-overview" ref={body}><p className="ov-notice">ДТП с пострадавшими. Числа относятся к происшествиям, а не к числу погибших или раненых людей. Отбор обзора — территория и год; остальные фильтры карты остаются только на карте.</p><IndicatorCards current={current} previous={previous}/><section className="ov-panel" aria-labelledby="ov-trend"><h2 id="ov-trend">Динамика по годам</h2><p className="ov-muted">{'2020–2025 · '+names[region]}</p><MetricChoices label="Показатель динамики" current={trendMetric} onChange={setTrendMetric}/><Choices label="Представление динамики" choices={{line:'Линия',bars:'Столбцы',table:'Таблица'}} current={trendMode} onChange={setTrendMode}/><TrendChart data={data} region={region} year={year} metric={trendMetric} mode={trendMode} names={names} active={active}/></section><div className="ov-columns"><div className="ov-left"><ParticipantsPanel current={current} name={names[region]} mode={participantMode} setMode={setParticipantMode}/><SeverityPanel current={current} name={names[region]}/></div><LandComparison data={data} year={year} region={region} names={names} metric={landMetric} setMetric={setLandMetric} mode={landMode} setMode={setLandMode} onRegion={onRegion}/></div><Sources current={current} name={names[region]}/></div>;
}
