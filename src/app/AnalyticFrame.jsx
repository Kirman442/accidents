import {useCallback,useEffect,useRef} from 'react';
import {acceptPrototypeRevision} from './shell-state.js';
export default function AnalyticFrame({screen,title,context,active,onMessage}){
  const frame=useRef(null),initial=useRef(context),current=useRef(context),ready=useRef(false),revision=useRef(0);current.current=context;
  const src=useRef(import.meta.env.BASE_URL+'prototypes/'+screen+'-embedded.html?'+new URLSearchParams(initial.current));
  const send=useCallback(()=>{if(ready.current)frame.current?.contentWindow.postMessage({type:'uad-prototype-select',context:current.current,revision:++revision.current},location.origin);},[]);
  useEffect(()=>{
    const receive=e=>{
      if(e.origin!==location.origin||e.source!==frame.current?.contentWindow||e.data?.screen!==screen)return;
      if(e.data.type==='uad-prototype-ready'){ready.current=true;send();return;}
      if(acceptPrototypeRevision(e.data.revision,revision.current)&&['uad-prototype-context','uad-prototype-navigate'].includes(e.data.type))onMessage(screen,e.data);
    };
    window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
  },[screen,onMessage,send]);
  useEffect(()=>{send();},[context,send]);
  return <section hidden={!active} aria-label={title}><iframe ref={frame} src={src.current} title={title+' · макет'} className="shell-prototype"/></section>;
}
