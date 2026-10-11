import {useEffect,useState} from 'react';
import {overviewRow,overviewYears,participantNames,validateOverview} from './overview-data.js';
const nf=new Intl.NumberFormat('ru-RU'),decimal=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const labels=['ДТП с погибшими','ДТП с тяжелоранеными','ДТП с легкоранеными'];
const show=n=>n==null?'Нет данных':nf.format(n);
export default function Overview({year,land,names,generation}){
  const [data,setData]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[metric,setMetric]=useState('count');
  useEffect(()=>{
    const controller=new AbortController();setError('');
    fetch(import.meta.env.BASE_URL+'analytics/overview.json',{cache:'no-store',signal:controller.signal}).then(r=>{
      if(!r.ok)throw new Error('Обзор недоступен: HTTP '+r.status);return r.json();
    }).then(d=>{if(!controller.signal.aborted)setData(validateOverview(d));}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return()=>controller.abort();
  },[attempt]);
  const mismatch=data&&generation&&data.generation!==generation;
  if(error||mismatch)return <section className="overview"><h2>Обзор всех лет</h2><p role="alert">{error||'Обзор и карта относятся к разным наборам данных. Подготовьте обновлённый обзор.'}</p><button onClick={()=>{setData(null);setAttempt(a=>a+1);}}>Повторить загрузку обзора</button></section>;
  if(!data)return <section className="overview" aria-busy="true"><h2>Обзор всех лет</h2><p>Читаем сводки и автопарк…</p></section>;
  const current=overviewRow(data,year,land),trend=overviewYears.map(y=>overviewRow(data,y,land));
  const comparison=Array.from({length:16},(_,i)=>overviewRow(data,year,i+1)).sort((a,b)=>(b[metric]??-1)-(a[metric]??-1));
  const max=Math.max(1,...trend.map(r=>r[metric]??0));
  return <section className="overview" aria-labelledby="overview-title">
    <h2 id="overview-title">Обзор 2020–2025 · {land?names[land]:'Германия'}</h2>
    <p>Полные годовые сводки доступны независимо от загрузки карты. Сейчас выбран {year} год.</p>
    <div className="overview-cards">
      <article><span>ДТП с пострадавшими</span><strong>{show(current.count)}</strong></article>
      <article><span>ДТП с участием Pkw</span><strong>{show(current.participation.pkw)}</strong></article>
      <article><span>Средний автопарк Pkw</span><strong>{show(current.mean)}</strong></article>
      <article><span>ДТП с Pkw на 10 000 Pkw</span><strong>{current.rate==null?'Нет данных':decimal.format(current.rate)}</strong></article>
    </div>
    <div className="overview-grid">
      <article className="overview-panel"><h3>Динамика по годам</h3>
        <label>Показатель сравнения<select value={metric} onChange={e=>setMetric(e.target.value)}><option value="count">Все ДТП с пострадавшими</option><option value="rate">ДТП с Pkw на 10 000 Pkw</option></select></label>
        <div className="year-bars">{trend.map(r=><div key={r.year} className={r.year===year?'selected':''}><span>{r.year}</span><div className="bar-track" aria-hidden="true"><div style={{width:(r[metric]??0)/max*100+'%'}}/></div><strong>{metric==='rate'?(r.rate==null?'Нет данных':decimal.format(r.rate)):show(r.count)}</strong></div>)}</div>
        <details><summary>Таблица по годам и автопарк</summary><div className="overview-table"><table><thead><tr><th>Год</th><th>ДТП</th><th>ДТП с Pkw</th><th>Pkw на начало</th><th>Pkw на конец</th><th>На 10 000 Pkw</th></tr></thead><tbody>{trend.map(r=><tr key={r.year}><th>{r.year}</th><td>{show(r.count)}</td><td>{show(r.participation.pkw)}</td><td>{show(r.begin)}</td><td>{show(r.end)}</td><td>{r.rate==null?'Нет данных':decimal.format(r.rate)}</td></tr>)}</tbody></table></div></details>
      </article>
      <article className="overview-panel"><h3>Тяжесть ДТП · {year}</h3>{current.category.map((count,i)=><div className="overview-category" key={i}><span>{labels[i]}</span><strong>{show(count)} · {decimal.format(count/current.count*100)}%</strong><meter min="0" max={current.count||1} value={count} aria-label={labels[i]}/></div>)}<p>Категория определяется по наиболее тяжёлому последствию. Показаны ДТП, а не число погибших или раненых людей.</p>
        <h3>Участники · {year}</h3><dl className="overview-participants">{Object.entries(participantNames).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{show(current.participation[key])}</dd></div>)}</dl><p>Число ДТП с участием каждой группы. В одном ДТП могут быть несколько групп; эти числа нельзя складывать.</p>
      </article>
    </div>
    <article className="overview-panel"><h3>Сравнение земель · {year}</h3><p>Земли отсортированы по выбранному показателю. Германия использует национальный автопарк KBA, включая отдельную категорию «прочие», поэтому он может отличаться от суммы земель.</p><div className="overview-table"><table><thead><tr><th>Земля</th><th>ДТП</th><th>ДТП с Pkw</th><th>Средний парк Pkw</th><th>На 10 000 Pkw</th></tr></thead><tbody>{comparison.map(r=><tr key={r.land} className={land===r.land?'selected':''}><th>{names[r.land]}</th><td>{show(r.count)}</td><td>{show(r.participation.pkw)}</td><td>{show(r.mean)}</td><td>{r.rate==null?'Нет данных':decimal.format(r.rate)}</td></tr>)}</tbody></table></div></article>
    <details className="overview-method"><summary>Источники и метод расчёта</summary><p>Unfallatlas: геокодированные ДТП с пострадавшими за 2020–2025. KBA FZ 1: зарегистрированные Pkw на 1 января 2020–2026, по Германии и каждой земле. Средний парк = (парк на 1 января выбранного года + парк на 1 января следующего года) / 2.</p><p>Показатель = ДТП с участием Pkw / средний парк Pkw × 10 000. Он сопоставляет число ДТП и зарегистрированный парк; пробег и транзитный транспорт не учитываются. Для выбранной земли используется её собственный автопарк.</p><p>Сводки и небольшой автопарк остаются доступными после очистки кеша карты. Другие годы точек карты для обзора не нужны.</p></details>
  </section>;
}

