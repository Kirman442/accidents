// Bridge for trusted local prototypes during their staged migration to React.
const screen=document.currentScript.dataset.screen;
let revision=0;
const controls=['region','year','from','to','group'];
function context(){
  const result={};for(const key of controls){const input=document.getElementById(key);if(input)result[key]=key==='group'?input.value:Number(input.value);}
  if(result.to!=null)result.year=result.to;return result;
}
function emit(type,extra={}){window.parent.postMessage({type,screen,revision,context:context(),...extra},location.origin);}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='uad-prototype-select')return;
  if(!Number.isInteger(event.data.revision)||event.data.revision<revision)return;revision=event.data.revision;
  for(const key of controls){const input=document.getElementById(key),value=event.data.context?.[key];
    if(input&&value!=null&&Array.from(input.options).some(option=>option.value===String(value)))input.value=String(value);
  }
  document.getElementById('region').dispatchEvent(new Event('change',{bubbles:true}));
});
document.addEventListener('change',()=>queueMicrotask(()=>emit('uad-prototype-context')));
document.addEventListener('click',event=>{
  const link=event.target.closest('#map, #map-nav, a[href], [data-screen]');let target;
  if(link?.id==='map'||link?.id==='map-nav')target='map';
  else if(link?.href)target=link.href.match(/\/(overview|time|severity|map)-mockup\.html(?:\?|$)/)?.[1];
  else if(link?.dataset.screen)target=({'Обзор':'overview','Время и сезонность':'time','Тяжесть и условия':'severity','Карта ДТП':'map'})[link.dataset.screen];
  if(target){event.preventDefault();event.stopImmediatePropagation();emit('uad-prototype-navigate',{target});}
  else queueMicrotask(()=>emit('uad-prototype-context'));
},true);
emit('uad-prototype-ready');
