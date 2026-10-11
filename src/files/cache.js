export class BudgetCache {
  constructor(limitBytes) { this.limitBytes=limitBytes;this.entries=new Map(); }
  get bytes() { return [...this.entries.values()].reduce((n,e)=>n+e.bytes,0); }
  get(key) {
    const entry=this.entries.get(key);
    if(entry){this.entries.delete(key);this.entries.set(key,entry);}
    return entry;
  }
  reserve(bytes,limitBytes=this.limitBytes) {
    if(!Number.isSafeInteger(limitBytes)||limitBytes<=0||!Number.isSafeInteger(bytes)||bytes<0||bytes>limitBytes)
      throw new Error('Набор данных не помещается в выбранный бюджет кеша');
    this.limitBytes=limitBytes;
    const removed=[];
    while(this.bytes+bytes>limitBytes){
      const key=this.entries.keys().next().value;
      removed.push(this.entries.get(key));this.entries.delete(key);
    }
    return removed;
  }
  put(entry) {
    if(this.entries.has(entry.key)||this.bytes+entry.bytes>this.limitBytes)
      throw new Error('Превышен бюджет удерживаемых буферов');
    this.entries.set(entry.key,entry);
  }
  clear(){const removed=[...this.entries.values()];this.entries.clear();return removed;}
  snapshot(){return {limitBytes:this.limitBytes,bytes:this.bytes,entries:[...this.entries.values()].map(({key,year,format,bytes})=>({key,year,format,bytes}))};}
}
