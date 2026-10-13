document.title='UAD · лаборатория тяжести и условий';
document.querySelector('.sidebar .bottom').textContent='Отдельный макет для обсуждения';
document.querySelector('.toolbar .muted').textContent='Переключатель ниже меняет только панели «Освещение» и «Состояние дороги».';
const slPairPanel=el('pairs').closest('.panel');
slPairPanel.querySelector('h2').textContent='Тяжёлые последствия при разных сочетаниях условий';
slPairPanel.querySelector('.muted').textContent='Строки — освещение, столбцы — состояние дороги. Процент — доля ДТП с погибшими или тяжелоранеными среди всех ДТП сочетания.';
const slControls=document.createElement('div');slControls.className='pills sl-controls';slControls.setAttribute('aria-label','Представление сочетаний');
slControls.innerHTML='<button data-sl-mode="matrix" class="active" aria-pressed="true">Матрица</button><button data-sl-mode="dots" aria-pressed="false">Точки</button>';
slPairPanel.querySelector('.panel-head').after(slControls);
const slScale=document.createElement('p');slScale.className='sl-scale';slScale.innerHTML='<span>Доля тяжёлых последствий: 0%</span><i aria-hidden="true"></i><span>50% и выше</span>';
slControls.after(slScale);
const slDots=document.createElement('div');slDots.className='sl-dots';slDots.hidden=true;slDots.setAttribute('aria-label','Доли тяжёлых последствий по сочетаниям');
slPairPanel.querySelector('.pair-scroll').after(slDots);
const slNote=document.createElement('p');slNote.className='section-note';slNote.textContent='Нажмите ячейку или точку, чтобы увидеть числа всех категорий. Это раскрытие подробностей; общий отбор не меняется. Доли сравнивают последствия зарегистрированных ДТП, а не риск поездки.';slDots.after(slNote);
let slMode='matrix';const slColors=['#197b70','#96703a','#647995'];
function slDetails(i,j,s){const c=pair(s,i,j);message(lights[i]+' · '+roads[j]+'. Всего '+nf.format(total(c))+' ДТП. '+cats.map((label,k)=>label+': '+nf.format(c[k])).join('; ')+'. Доля тяжёлых последствий: '+percent(c[0]+c[1],total(c))+'.');}
const slOriginalRender=render;
render=function(){
  slOriginalRender();
  const from=+el('from').value,to=+el('to').value,years=Array.from({length:to-from+1},(_,i)=>from+i),s=summary(years,el('region').value,el('group').value);
  for(const axis of ['light','road']){
    const rows=conditionRows(s,axis);
    el(axis).querySelectorAll('.condition').forEach((node,i)=>{node.querySelector('.condition-head b').textContent='Всего '+nf.format(total(rows[i]))+' ДТП';if(unit==='share')node.querySelectorAll('.condition-values span').forEach((span,k)=>span.textContent+=' · '+nf.format(rows[i][k])+' ДТП');});
  }
  el('pairs').querySelectorAll('[data-pair]').forEach(button=>{const [i,j]=button.dataset.pair.split(',').map(Number),c=pair(s,i,j),n=total(c);button.querySelector('span').textContent='Всего '+nf.format(n)+' ДТП';if(n)button.querySelector('strong').textContent+=' тяжёлых';button.setAttribute('aria-label',lights[i]+', '+roads[j]+': '+percent(c[0]+c[1],n)+', всего '+nf.format(n)+' ДТП');});
  const values=s.conditions.filter((_,i)=>i%3===0).map((_,index)=>{const c=s.conditions.slice(index*3,index*3+3);return total(c)?(c[0]+c[1])/total(c)*100:0;}),max=Math.max(20,Math.ceil(Math.max(...values)/5)*5);
  let html='<p class="section-note">По горизонтали — доля тяжёлых последствий, %. Одна шкала для всех сочетаний. Цвет обозначает освещение.</p><div class="severity-legend">'+lights.map((name,i)=>'<span><i style="background:'+slColors[i]+'"></i>'+name+'</span>').join('')+'</div><div class="sl-dot-scroll"><div class="sl-dot-board"><div class="sl-dot-axis"><span></span><div>'+[0,1,2,3,4].map(i=>'<span style="left:'+i*25+'%">'+df.format(max*i/4)+'%</span>').join('')+'</div><span></span></div>';
  roads.forEach((road,j)=>{html+='<h3>'+road+'</h3>';lights.forEach((light,i)=>{const c=pair(s,i,j),n=total(c),v=n?(c[0]+c[1])/n*100:null;html+='<div class="sl-dot-row"><span>'+light+'</span><div class="sl-dot-track">'+(v==null?'Нет ДТП':'<button class="sl-dot" data-sl-pair="'+i+','+j+'" style="left:'+v/max*100+'%;background:'+slColors[i]+'" aria-label="'+light+', '+road+': '+df.format(v)+'%, всего '+nf.format(n)+' ДТП"></button>')+'</div><span><b>'+(v==null?'—':df.format(v)+'%')+'</b><small>Всего '+nf.format(n)+' ДТП</small></span></div>';});});
  slDots.innerHTML=html+'</div></div>';slDots.querySelectorAll('[data-sl-pair]').forEach(button=>button.onclick=()=>{const [i,j]=button.dataset.slPair.split(',').map(Number);slDetails(i,j,s);});
  slDots.hidden=slMode!=='dots';slPairPanel.querySelector('.pair-scroll').hidden=slMode!=='matrix';slScale.hidden=slMode!=='matrix';
  slPairPanel.querySelector('.muted').textContent=(slMode==='matrix'?'Строки — освещение, столбцы — состояние дороги.':'Три группы состояний дороги; цвет точки — освещение, положение — процент.')+' Доля ДТП с погибшими или тяжелоранеными среди всех ДТП сочетания.';
  const svg=el('trend').querySelector('svg'),ns='http://www.w3.org/2000/svg';
  const first=from-2020,last=to-2020,rect=document.createElementNS(ns,'rect');rect.setAttribute('x',String(Math.max(45,55+first*154-30)));rect.setAttribute('y','18');rect.setAttribute('width',String((last-first)*154+60));rect.setAttribute('height','170');rect.setAttribute('fill','#e4f2ee');svg.prepend(rect);
  el('trend').closest('.panel').querySelector('.muted').textContent='2020–2025 · выбранный период '+(from===to?to:from+'–'+to)+' выделен фоном · территория и участники из верхней панели';
};
slControls.querySelectorAll('button').forEach(button=>button.onclick=()=>{slMode=button.dataset.slMode;slControls.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});render();});
slPairPanel.querySelector('[data-help="pair"]').onclick=()=>message('Для каждого сочетания: (ДТП с погибшими + ДТП с тяжелоранеными) / все ДТП сочетания × 100%. Матрица показывает долю цветом, точки — положением на общей оси. Число «Всего» включает все три категории. Переключатель количества в разделе сравнения условий сюда не применяется. Нажатие раскрывает подробности и не фильтрует экран.');
el('region').onchange=el('group').onchange=()=>render();
render();
