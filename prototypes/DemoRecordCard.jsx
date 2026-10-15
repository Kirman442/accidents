import {useState} from 'react';
import {fields,participantNames} from '../src/files/map-query.js';
import {accidentPatterns,accidentTypes} from '../src/files/scenario-labels.js';

function Symbol({kind}){
  return <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind==='pkw'?<><path d="M3 22v-6l5-2 4-6h9l5 7 3 2v5h-4m-18 0H3m10 0h6M8 14h18M16 8v6"/><circle cx="10" cy="22" r="3"/><circle cx="22" cy="22" r="3"/></>:
    kind==='rad'?<><circle cx="7" cy="23" r="6"/><circle cx="25" cy="23" r="6"/><path d="M7 23l6-13 8 13H7m14 0 3-17h-5M10 10h7"/></>:
    kind==='fuss'?<><circle cx="17" cy="5" r="3"/><path d="M15 10l-3 9 6 5 1 6M12 19l-7 10m10-18 7 6 7 1M14 12l-8 5"/></>:
    kind==='krad'?<><circle cx="7" cy="24" r="5"/><circle cx="26" cy="24" r="5"/><path d="M7 24l6-10h10l3 10M18 9h7l1 15M12 14H5M9 18h12"/><circle cx="14" cy="5" r="2"/></>:
    kind==='gkfz'?<><path d="M2 6h18v17H2V6m18 7h6l5 6v4H20"/><circle cx="8" cy="24" r="3"/><circle cx="25" cy="24" r="3"/></>:
    kind==='other_participant'?<><circle cx="6" cy="16" r="2"/><circle cx="16" cy="16" r="2"/><circle cx="26" cy="16" r="2"/></>:
    kind==='light-0'?<><circle cx="16" cy="16" r="6"/><path d="M16 2v4m0 20v4M2 16h4m20 0h4M6 6l3 3m14 14 3 3M6 26l3-3M23 9l3-3"/></>:
    kind==='light-1'?<><path d="M3 22h26M8 22a8 8 0 0 1 16 0M16 4v5M3 12l4 3m18 0 4-3M4 27h24"/></>:
    kind==='light-2'?<path d="M25 21A12 12 0 0 1 11 4 12 12 0 1 0 25 21Z"/>:
    kind==='road-0'?<><path d="M10 3 4 29m18-26 6 26M16 4v5m0 5v5m0 5v5"/></>:
    kind==='road-1'?<><path d="M9 5 3 29m18-10 3 10M13 7v5m0 5v5m0 4v3"/><path d="M24 3c0 0-5 7-5 10a5 5 0 0 0 10 0c0-3-5-10-5-10Z"/></>:
    <><path d="M6 19v-6l3-5h12l3 5v6H6M6 13h18m-9 9c-7 3 4 4-3 8m12-8c-7 3 4 4-3 8"/><circle cx="10" cy="19" r="1.5"/><circle cx="21" cy="19" r="1.5"/><path d="M27 1v7m-3-5 6 3m-6 0 6-3"/></>}
  </svg>;
}
function Badge({kind,label}){return <span className="record-icon" role="img" aria-label={label} tabIndex={0} title={label}><Symbol kind={kind}/><span className="icon-tooltip" aria-hidden="true">{label}</span></span>;}

export default function DemoRecordCard({year,name,onFilter,onClose}){
  const [light,setLight]=useState(0),[road,setRoad]=useState(0),[analysisNote,setAnalysisNote]=useState(false);
  return <>
    <p className="demo-badge">Условный пример · не запись из набора</p>
    <p>Июнь {year} · Пятница · 08:00–08:59</p>
    <p className="example-severity">С тяжелоранеными</p>
    <p className="muted">Категория ДТП; число пострадавших людей неизвестно.</p>
    <div className="record-icon-groups">
      <section aria-label="Участники ДТП"><h3>Участники</h3><div className="record-icon-row">{['pkw','rad'].map(key=><Badge key={key} kind={key} label={participantNames[key]}/>)}</div></section>
      <section aria-label="Условия ДТП"><h3>Условия</h3><div className="record-icon-row"><Badge kind={'light-'+light} label={fields.light.options[light].label}/><Badge kind={'road-'+road} label={fields.road_condition.options[road].label}/></div></section>
    </div>
    <h3>Ситуация ДТП</h3><p>{accidentPatterns[2]}</p>
    <button className="record-filter-action" onClick={()=>onFilter('accident_pattern',2)}>Показать ДТП с такой же ситуацией</button>
    <h3>Характер столкновения</h3><p>{accidentTypes[5]}</p>
    <button className="record-filter-action" onClick={()=>onFilter('accident_type',5)}>Показать ДТП с таким же характером столкновения</button>
    <h3>Место</h3><p>{name}</p><p className="muted">В настоящей карточке — «Посмотреть место на OpenStreetMap ↗». Условный пример не имеет координат.</p>
    <button onClick={()=>setAnalysisNote(!analysisNote)} aria-expanded={analysisNote}>Анализировать это место →</button>
    {analysisNote&&<p className="muted" role="status">Будущий раздел аналитики места с картой. Передадим точку, год и текущие фильтры. В этом макете переход ещё не подключён.</p>}
    <div className="panel-actions"><button onClick={onClose}>Закрыть → сводка</button></div>
    <details className="demo-icon-gallery"><summary>Проверка иконок · только в макете</summary>
      <p className="muted">Наведите или перейдите клавишей Tab для подсказки. Выбор ниже меняет только условную карточку.</p>
      <div className="record-icon-row">{Object.entries(participantNames).map(([key,label])=><Badge key={key} kind={key} label={label}/>)}</div>
      <label>Освещение примера<select aria-label="Освещение примера" value={light} onChange={e=>setLight(Number(e.target.value))}>{fields.light.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      <label>Дорога примера<select aria-label="Дорога примера" value={road} onChange={e=>setRoad(Number(e.target.value))}>{fields.road_condition.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
    </details>
  </>;
}
