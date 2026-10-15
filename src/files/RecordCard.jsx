import {useEffect,useState} from 'react';
import {fields,participantNames} from './map-query.js';
import {accidentTypes as types,accidentPatterns as patterns} from './scenario-labels.js';
import {RecordBadge} from './RecordIcons.jsx';
const months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const days=['','Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const shortTime=r=>`${months[r.month-1]} ${r.year} · ${days[r.weekday]} · ${String(r.hour).padStart(2,'0')}:00–${String(r.hour).padStart(2,'0')}:59`;
export default function RecordCard({loader,handle,choices,truncated,names,format,onSelect,onScenario,onClose,onZoom,onNotify}){
  const [lookup,setLookup]=useState({loading:true,items:[],error:''});
  useEffect(()=>{if(lookup.error)onNotify?.(lookup.error,'error');},[lookup.error,onNotify]);
  useEffect(()=>{
    let alive=true;
    loader.current.details(handle.year,format,[handle,...choices.filter(c=>c.id!==handle.id)].slice(0,8))
      .then(items=>{if(alive)setLookup({loading:false,items,error:''});})
      .catch(e=>{if(alive)setLookup({loading:false,items:[],error:e.message});});
    return()=>{alive=false;};
  },[loader,handle,choices,format]);
  const record=lookup.items.find(item=>item.handle.id===handle.id)?.record;
  return <aside className="record-card" aria-label="Карточка ДТП">
    <header><h2>Выбранное ДТП</h2><button onClick={onClose} aria-label="Закрыть карточку ДТП">×</button></header>

    {lookup.loading&&<p role="status">Читаем сведения о точке…</p>}{lookup.error&&<p role="alert">{lookup.error}</p>}
    {record&&<>
      <p className="record-time">{shortTime(record)}</p>
      <p className={'record-severity severity-'+record.category}>{fields.category.options.find(o=>o.value===record.category).label}</p>
      <p className="filter-note">Последствия относятся ко всему ДТП. Число пострадавших людей неизвестно.</p>
      <div className="record-icon-groups"><section aria-label="Участники ДТП"><h3>Участники</h3><div className="record-icon-row">{record.participants.map(k=><RecordBadge key={k} kind={k} label={participantNames[k]}/>)}</div></section><section aria-label="Условия ДТП"><h3>Условия</h3><div className="record-icon-row"><RecordBadge kind={'light-'+record.light} label={fields.light.options[record.light].label}/><RecordBadge kind={'road-'+record.road} label={fields.road_condition.options[record.road].label}/></div></section></div>
      <h3>Ситуация ДТП</h3><p>{patterns[record.accidentPattern]}</p>{onScenario&&<button className="record-filter-action" onClick={()=>onScenario('accident_pattern',record.accidentPattern)}>Показать ДТП с такой же ситуацией</button>}
      <h3>Характер столкновения</h3><p>{types[record.accidentType]}</p>{onScenario&&<button className="record-filter-action" onClick={()=>onScenario('accident_type',record.accidentType)}>Показать ДТП с таким же характером столкновения</button>}
      <button aria-label="Приблизить к ДТП" onClick={()=>onZoom(record)}><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M10 7v6M7 10h6"/></svg> Приблизить к ДТП</button>
      <h3>Место</h3><p>{names[record.land]}</p><p className="filter-note">Адрес отсутствует в наборе. Название населённого пункта пока не подключено.</p>
      <a href={`https://www.openstreetmap.org/?mlat=${record.latitude}&mlon=${record.longitude}#map=18/${record.latitude}/${record.longitude}`} target="_blank" rel="noopener noreferrer">Посмотреть место на OpenStreetMap ↗</a>
      {choices.length>1&&<details><summary>Несколько точек рядом с кликом: {truncated?'не менее '+(choices.length+1):choices.length}</summary><p className="filter-note">Область попадания на экране; это не радиус 50 м.{truncated?' Показаны первые 8. Увеличьте масштаб для остальных.':''}</p><ol>{lookup.items.map(item=><li key={item.handle.id}><button aria-pressed={item.handle.id===handle.id} onClick={()=>onSelect(item.handle,choices,truncated)}>{shortTime(item.record)} · {fields.category.options.find(o=>o.value===item.record.category).label}</button></li>)}</ol></details>}

    </>}
  </aside>;
}
