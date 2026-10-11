import {DataPool} from '../benchmark/pool.js';
export class RuntimePool extends DataPool {
  constructor(WorkerClass){super(WorkerClass,4);this.WorkerClass=WorkerClass;}
  recreate(){return new RuntimePool(this.WorkerClass);}
  cancel(runId){for(const slot of this.slots)slot.worker.postMessage({cancel:runId});}
}
