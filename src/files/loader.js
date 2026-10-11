import {BudgetCache} from './cache.js';
import {datasetSpec} from './catalog.js';
import {combineStats,verifySummary} from '../benchmark/analytics.js';
const aborted=()=>new DOMException('Загрузка отменена','AbortError');
export class FileLoader {
  constructor({manifest,summaries,base,pool,onUpdate,limitBytes=100*1048576}) {
    Object.assign(this,{manifest,summaries,base,pool,onUpdate});
    this.cache=new BudgetCache(limitBytes);this.epoch=0;this.operation=Promise.resolve();this.active=null;this.closed=false;
  }
  emit(state){if(!this.closed)this.onUpdate({...state,cache:this.cache.snapshot()});}
  abortActive(){if(this.active){this.active.cancelled=true;this.pool.cancel(this.active.id);}}
  async drop(entries,runId){if(this.pool.closed){this.cache.clear();return;}for(const entry of entries)await Promise.all(this.pool.slots.map((_,i)=>this.pool.run(i,{type:'drop',key:entry.key,runId})));}
  select(year,format,limitBytes=this.cache.limitBytes) {
    const epoch=++this.epoch;this.abortActive();
    const operation=this.operation.catch(()=>{}).then(async()=>{
      if(this.closed||epoch!==this.epoch)throw aborted();
      if(this.pool.closed){this.cache.clear();if(!this.pool.recreate)throw new Error('Workers остановлены. Перезагрузите страницу.');this.pool=this.pool.recreate();}
      const spec=datasetSpec(this.manifest,this.base,year,format);
      let entry=this.cache.get(spec.key);
      if(entry&&entry.bytes<=limitBytes){
        await this.drop(this.cache.reserve(0,limitBytes));
        if(epoch!==this.epoch)throw aborted();
        this.emit({state:'ready',year,format,parts:entry.parts,fromCache:true,loaded:16});return entry;
      }
      // Release old entries before admission; only one year loads at a time.
      await this.drop(this.cache.reserve(spec.reservedBytes,limitBytes));
      if(epoch!==this.epoch)throw aborted();
      const run={id:epoch,key:spec.key,cancelled:false};this.active=run;
      const parts=[];let failure;
      this.emit({state:'loading',year,format,parts:[],fromCache:false,loaded:0,reservedBytes:spec.reservedBytes});
      const work=this.pool.slots.map(async(_,slot)=>{
        try {
          for(let index=slot;index<16;index+=4){
            if(run.cancelled||epoch!==this.epoch)throw aborted();
            const task=spec.tasks[index];
            const part=await this.pool.run(slot,{type:'load',...task,key:spec.key,runId:run.id,
              summary:this.summaries.years[year].lands[task.land]});
            if(run.cancelled||epoch!==this.epoch)throw aborted();
            parts.push(part);
            this.emit({state:'loading',year,format,parts:[...parts],loaded:parts.length,fromCache:false,reservedBytes:spec.reservedBytes});
          }
        }catch(error){failure ||= error;run.cancelled=true;this.pool.cancel(run.id);throw error;}
      });
      await Promise.allSettled(work);
      if(failure||run.cancelled||epoch!==this.epoch){
        await this.drop([{key:spec.key}],run.id);this.active=null;
        if(epoch!==this.epoch)throw aborted();
        this.emit({state:'error',year,format,parts:[],loaded:0,error:failure?.message || 'Отменено'});
        throw failure || aborted();
      }
      try {
        parts.sort((a,b)=>a.land-b.land);
        verifySummary(combineStats(parts.map(p=>p.stats)),this.summaries.years[year].national);
        entry={key:spec.key,year,format,parts,bytes:parts.reduce((n,p)=>n+p.sourceBytes+p.snapshotBytes,0)};
        if(entry.bytes>spec.reservedBytes)throw new Error('Фактические буферы превысили резерв памяти');
        this.cache.put(entry);this.active=null;
        this.emit({state:'ready',year,format,parts,fromCache:false,loaded:16});return entry;
      }catch(error){await this.drop([{key:spec.key}],run.id);this.active=null;
        this.emit({state:'error',year,format,parts:[],loaded:0,error:error.message});throw error;}
    });
    const guarded=operation.catch(error=>{if(epoch===this.epoch && error.name!=='AbortError')this.emit({state:'error',year,format,parts:[],loaded:0,error:error.message});throw error;});
    this.operation=guarded;return guarded;
  }
  clear() {
    const epoch=++this.epoch;this.abortActive();
    const operation=this.operation.catch(()=>{}).then(async()=>{
      if(this.closed||epoch!==this.epoch)return;
      await this.drop(this.cache.clear());this.emit({state:'idle',parts:[],loaded:0});
    });this.operation=operation;return operation;
  }
  stop(){this.epoch++;this.abortActive();this.emit({state:'idle',parts:[],loaded:0});}
  close(){this.closed=true;this.epoch++;this.abortActive();this.pool.close();this.cache.clear();}
}
