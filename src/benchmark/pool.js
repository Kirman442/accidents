export class DataPool {
  constructor(WorkerClass,size=4) {
    this.nextId=0; this.closed=false;
    this.slots=Array.from({length:size},()=>{
      const worker=new WorkerClass(),slot={worker,tail:Promise.resolve(),pending:new Map()};
      worker.onmessage=({data})=>{
        const pending=slot.pending.get(data.id); if(!pending)return;
        slot.pending.delete(data.id); clearTimeout(pending.timer);
        if(data.error)pending.reject(new Error(data.error));else pending.resolve(data.result);
      };
      worker.onerror=event=>{event.preventDefault();this.close(new Error(event.message || 'Ошибка worker'));};
      worker.onmessageerror=()=>this.close(new Error('Не прочитан ответ worker'));
      return slot;
    });
  }
  run(index,task) {
    const slot=this.slots[index];
    const operation=slot.tail.then(()=>{
      if(this.closed)throw new DOMException('Загрузка отменена','AbortError');
      return new Promise((resolve,reject)=>{
        const id=this.nextId++;
        const timer=setTimeout(()=>this.close(new Error('Превышено время обработки')),120000);
        slot.pending.set(id,{resolve,reject,timer});
        try{slot.worker.postMessage({id,task});}catch(error){this.close(error);}
      });
    });
    slot.tail=operation.catch(()=>{});
    return operation;
  }
  close(error=new DOMException('Загрузка отменена','AbortError')) {
    this.closed=true;
    for(const slot of this.slots){
      slot.worker.terminate();
      for(const pending of slot.pending.values()){clearTimeout(pending.timer);pending.reject(error);}
      slot.pending.clear();
    }
  }
}
