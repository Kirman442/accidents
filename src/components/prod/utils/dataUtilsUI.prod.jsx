
import {useState,useCallback,useRef,useEffect} from 'react';
import {createClient} from '@supabase/supabase-js';
import {fetchLand,toFeatures,mergeAttributes,loadPhase} from './landRequests.js';
const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=url && key ? createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}) : null;
const empty=()=>({loading:false,loadingAttributes:false,errors:{},initialFeatures:[],fullFeatures:[],initialLoadTime:null,fullLoadTime:null,geoComplete:false,attributesComplete:false,geoLoadedLands:0});
export function usePartitionLoader() {
  const [state,setState]=useState(empty);
  const active=useRef(null);
  const cancelLoading=useCallback(()=>{active.current?.abort();active.current=null;},[]);
  useEffect(()=>cancelLoading,[cancelLoading]);
  const loadPartitions=useCallback(async tables=>{
    active.current?.abort();
    const controller=new AbortController(); active.current=controller;
    const signal=controller.signal, start=performance.now();
    setState({...empty(),loading:true});
    try {
      if (!supabase) throw new Error('Supabase connection is not configured');
      const initialFeatures=await loadPhase(
        tables,
        async table=>toFeatures(await fetchLand(supabase,table,'oid,xgcswgs84,ygcswgs84',{signal})),
        signal,
        4,
        features=>{
          if (active.current!==controller || signal.aborted) return;
          setState(prev=>active.current===controller && !signal.aborted ? {
            ...prev,
            initialFeatures:[...prev.initialFeatures,...features],
            geoLoadedLands:prev.geoLoadedLands+1
          } : prev);
        }
      );
      if (active.current!==controller || signal.aborted) return;
      setState(prev=>({...prev,initialFeatures,geoLoadedLands:tables.length,loading:false,loadingAttributes:true,geoComplete:true,initialLoadTime:(performance.now()-start)/1000}));
      const attrStart=performance.now();
      const attributes=await loadPhase(tables,table=>fetchLand(supabase,table,'oid,uland,uwochentag,ukategorie,ist_rad,ist_pkw,ist_fuss',{signal}),signal);
      const fullFeatures=mergeAttributes(initialFeatures,attributes);
      if (active.current!==controller || signal.aborted) return;
      setState(prev=>({...prev,fullFeatures,loadingAttributes:false,attributesComplete:true,fullLoadTime:(performance.now()-attrStart)/1000}));
    } catch(error) {
      if (active.current!==controller || signal.aborted) return;
      controller.abort();
      setState(prev=>({...prev,loading:false,loadingAttributes:false,errors:{global:error}}));
    }
  },[]);
  return {state,loadPartitions,cancelLoading};
}
