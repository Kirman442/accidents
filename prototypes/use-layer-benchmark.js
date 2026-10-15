import {useEffect,useRef,useState} from 'react';

export function summarizeFrames(samples){
  const sorted=[...samples].sort((a,b)=>a-b),sum=samples.reduce((a,b)=>a+b,0);
  return {frames:samples.length,meanMs:sum/(samples.length||1),p95Ms:sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)]??0,maxMs:sorted.at(-1)??0,over50:samples.filter(n=>n>50).length};
}

// RAF measures browser responsiveness; before/after render measures CPU submission,
// not GPU completion. No synchronous GPU readback is performed during a run.
export function cameraRange(samples){
  if(!samples.length)return {longitudeSpan:0,zoomSpan:0,samples:0};
  return {longitudeSpan:Math.max(...samples.map(s=>s.longitude))-Math.min(...samples.map(s=>s.longitude)),zoomSpan:Math.max(...samples.map(s=>s.zoom))-Math.min(...samples.map(s=>s.zoom)),samples:samples.length};
}
export function useLayerBenchmark({getCamera,getRenderedCamera,setCamera,setMode,mode,metadata,counters}){
  const [running,setRunning]=useState(false),[results,setResults]=useState([]);
  const active=useRef(null),frame=useRef(null),renderStart=useRef(0);
  useEffect(()=>()=>{cancelAnimationFrame(frame.current);active.current?.observer?.disconnect();active.current=null;},[]);
  function start(scenario){
    if(active.current)return;
    const origin={...getCamera()},startTime=performance.now(),initial={...counters.current};
    const run={samples:[],renders:[],longTasks:[],deckCameras:[],mapCameras:[],last:null,metadata:{...metadata},initial};
    if(PerformanceObserver.supportedEntryTypes.includes('longtask')){run.observer=new PerformanceObserver(list=>run.longTasks.push(...list.getEntries().map(e=>e.duration)));run.observer.observe({type:'longtask'});}
    active.current=run;setRunning(true);
    function tick(now){
      if(active.current!==run)return;
      const elapsed=now-startTime,t=elapsed/1000;
      // First second is a warm-up, including first layer activation.
      if(elapsed>=1000){if(run.last!=null)run.samples.push(now-run.last);run.last=now;}
      if(scenario==='switch')setMode(Math.floor(t)%2?'points':'hex');
      else if(scenario==='zoom'){
        // Hold each zoom for 500 ms so the 250 ms debounce can actually settle
        // and resize/reaggregate, rather than measuring only camera animation.
        const step=Math.floor(t*2);if(run.step!==step){run.step=step;setCamera({...origin,zoom:origin.zoom+.75*Math.sin(step*Math.PI/4)});}
      }else setCamera({...origin,longitude:origin.longitude+.8*Math.sin(t*Math.PI/2)});
      if(elapsed<7000){frame.current=requestAnimationFrame(tick);return;}
      const counterDelta=Object.fromEntries(Object.keys(counters.current).map(k=>[k,counters.current[k]-(initial[k]||0)]));
      if(run.observer){run.longTasks.push(...run.observer.takeRecords().map(e=>e.duration));run.observer.disconnect();}
      const deckRange=cameraRange(run.deckCameras),mapRange=cameraRange(run.mapCameras),key=scenario==='pan'?'longitudeSpan':'zoomSpan',threshold=scenario==='pan'?.5:.5;
      const motion={deck:deckRange,basemap:mapRange,verified:scenario==='switch'?null:deckRange[key]>threshold&&mapRange[key]>threshold};
      const result={benchmarkVersion:2,date:new Date().toISOString(),scenario,...run.metadata,motion,raf:summarizeFrames(run.samples),renderCPU:summarizeFrames(run.renders),longTasks:run.longTasks,counterDelta,heapBytes:performance.memory?.usedJSHeapSize??null};
      active.current=null;setCamera(origin);setMode(mode);setResults(rows=>[result,...rows].slice(0,20));setRunning(false);
    }
    frame.current=requestAnimationFrame(tick);
  }
  function beforeRender(){renderStart.current=performance.now();}
  function afterRender(){if(active.current&&renderStart.current){active.current.renders.push(performance.now()-renderStart.current);const rendered=getRenderedCamera();if(rendered.deck)active.current.deckCameras.push(rendered.deck);if(rendered.basemap)active.current.mapCameras.push(rendered.basemap);}}
  function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(results,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='uad-layer-benchmark.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return {running,results,start,beforeRender,afterRender,download};
}
