import {useEffect,useState} from 'react';
import {fields,participantNames} from './map-query.js';
import {NEAR_LIMIT,NEAR_PAGE} from './record-details.js';
const months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const days=['','Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const types=['Другое происшествие','Столкновение с начинающим движение, останавливающимся или стоящим ТС',
  'Столкновение с движущимся впереди или ожидающим ТС','Столкновение с попутным ТС сбоку','Столкновение со встречным ТС',
  'Столкновение с поворачивающим или пересекающим путь ТС','Столкновение между ТС и пешеходом','Наезд на препятствие на дороге','Съезд с дороги вправо','Съезд с дороги влево'];
const patterns=['','ДТП при движении','ДТП при повороте','ДТП при выезде / пересечении','ДТП при переходе дороги',
  'ДТП с неподвижным транспортом','ДТП в продольном движении','Другое ДТП'];
const shortTime=r=>`${months[r.month-1]} ${r.year} · ${days[r.weekday]} · ${String(r.hour).padStart(2,'0')}:00–${String(r.hour).padStart(2,'0')}:59`;
function ParticipantIcon({name}){
  return <svg width="23" height="23" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
    {name==='fuss'?<><circle cx="13" cy="4" r="2"/><path d="m12 7-2 6 4 4 1 5M10 13l-4 8m6-13 5 4 4 1M11 8l-5 4"/></>:
      name==='rad'||name==='krad'?<><circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><path d={name==='rad'?'M5 17 9 9l6 8H5m10 0 3-11h-4M7 9h5':'M5 17 10 11h6l3 6M13 8h5l1 9M8 11H5'}/></>:
      name==='other_participant'?<><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></>:
      <><path d={name==='pkw'?'M3 16V10l3-5h12l3 5v6H3M3 10h18':'M2 5h12v12H2V5m12 5h5l3 4v3h-8'}/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>}
  </svg>;
}
export default function RecordCard({loader,handle,choices,truncated,names,format,filters,lands,ready,onSelect,onClose}){
  const [lookup,setLookup]=useState({loading:true,items:[],error:''}),[expanded,setExpanded]=useState(false);
  const [near,setNear]=useState({loading:false,items:[],count:null,error:'',ms:0}),[pages,setPages]=useState(1);
  useEffect(()=>{
    let alive=true;
    loader.current.details(handle.year,format,[handle,...choices.filter(c=>c.id!==handle.id)].slice(0,8))
      .then(items=>{if(alive)setLookup({loading:false,items,error:''});})
      .catch(e=>{if(alive)setLookup({loading:false,items:[],error:e.message});});
    return()=>{alive=false;};
  },[loader,handle,choices,format]);
  const record=lookup.items.find(item=>item.handle.id===handle.id)?.record;
  useEffect(()=>{
    if(!expanded||!record||!ready)return;
    let alive=true;const start=performance.now();setNear({loading:true,items:[],count:null,error:'',ms:0});
    // A bounded prefix supplies "show more" while retaining at most 100 record DTOs.
    loader.current.nearby(handle.year,format,lands,filters,{id:handle.id,longitude:record.longitude,latitude:record.latitude},pages*NEAR_PAGE)
      .then(value=>{if(alive)setNear({...value,loading:false,error:'',ms:performance.now()-start});})
      .catch(e=>{if(alive)setNear({loading:false,items:[],count:null,error:e.message,ms:0});});
    return()=>{alive=false;};
  },[expanded,record,ready,handle,format,lands,filters,pages,loader]);
  return <aside className="record-card" aria-label="Карточка ДТП">
    <header><h2>Выбранное ДТП</h2><button onClick={onClose} aria-label="Закрыть карточку ДТП">×</button></header>
    {lookup.loading&&<p role="status">Читаем сведения о точке…</p>}{lookup.error&&<p role="alert">{lookup.error}</p>}
    {record&&<>
      <p className="record-time">{shortTime(record)}</p>
      <p className={'record-severity severity-'+record.category}>{fields.category.options.find(o=>o.value===record.category).label}</p>
      <p className="filter-note">Последствия относятся ко всему ДТП. Число пострадавших людей неизвестно.</p>
      <h3>Участвовали</h3><ul className="record-participants">{record.participants.map(k=><li key={k}><ParticipantIcon name={k}/><span>{participantNames[k]}</span></li>)}</ul>
      {!record.participants.length&&<p>Отмеченные группы отсутствуют.</p>}
      <h3>Условия</h3><p>{fields.light.options[record.light].label} · {fields.road_condition.options[record.road].label}</p>
      <h3>Сценарий</h3><p>{patterns[record.accidentPattern]}</p><p>{types[record.accidentType]}</p>
      <h3>Место</h3><p>{names[record.land]}</p><p className="filter-note">Адрес отсутствует в наборе. Название населённого пункта пока не подключено.</p>
      <a href={`https://www.openstreetmap.org/?mlat=${record.latitude}&mlon=${record.longitude}#map=18/${record.latitude}/${record.longitude}`} target="_blank" rel="noopener noreferrer">Посмотреть место на OpenStreetMap ↗</a>
      {choices.length>1&&<details><summary>Несколько точек рядом с кликом: {truncated?'не менее '+(choices.length+1):choices.length}</summary><p className="filter-note">Область попадания на экране; это не радиус 50 м.{truncated?' Показаны первые 8. Увеличьте масштаб для остальных.':''}</p><ol>{lookup.items.map(item=><li key={item.handle.id}><button aria-pressed={item.handle.id===handle.id} onClick={()=>onSelect(item.handle,choices,truncated)}>{shortTime(item.record)} · {fields.category.options.find(o=>o.value===item.record.category).label}</button></li>)}</ol></details>}
      <details onToggle={e=>setExpanded(e.currentTarget.open)}><summary>Другие ДТП в пределах 50 м</summary>
        <p className="filter-note">{handle.year} год · текущие фильтры и территория · выбранное ДТП исключено.</p>
        {!ready&&<p>Дождитесь завершения загрузки и отбора.</p>}
        {ready&&near.loading&&<p role="status">Считаем окрестность…</p>}
        {ready&&near.error&&<p role="alert">{near.error}</p>}
        {ready&&!near.loading&&near.count!=null&&<><p><strong>{near.count} других ДТП</strong></p><ol className="record-neighbors">{near.items.map(item=><li key={item.handle.id}><button onClick={()=>onSelect(item.handle,[item.handle],false)}>{Math.round(item.distance)} м · {shortTime(item.record)}<br/>{fields.category.options.find(o=>o.value===item.record.category).label} · {item.record.participants.map(k=>participantNames[k]).join(', ')||'Нет отмеченных групп'}</button></li>)}</ol>
          {near.items.length<Math.min(near.count,NEAR_LIMIT)&&<button onClick={()=>setPages(p=>p+1)}>Показать ещё {NEAR_PAGE}</button>}
          {near.count>NEAR_LIMIT&&near.items.length===NEAR_LIMIT&&<p>Показаны ближайшие {NEAR_LIMIT} из {near.count}. Уточните фильтры для остальных.</p>}
          <p className="filter-note">{near.ms.toFixed(0)} мс · расстояния приблизительные. Скопление ДТП не определяет риск поездки.</p>
        </>}
      </details>
    </>}
  </aside>;
}
