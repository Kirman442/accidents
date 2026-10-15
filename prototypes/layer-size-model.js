import {getHexagonEdgeLengthAvg} from 'h3-js';
// deck.gl/MapLibre use a 512-unit Mercator world at zoom 0.
export function metersPerPixel(zoom,latitude){return 78271.51696*Math.cos(latitude*Math.PI/180)/2**zoom;}
export function chooseH3(zoom,latitude,target=36){const mpp=metersPerPixel(zoom,latitude);let best=3,distance=Infinity;for(let res=3;res<=10;res++){const diameter=2*getHexagonEdgeLengthAvg(res,'m')/mpp,delta=Math.abs(Math.log(diameter/target));if(delta<distance){distance=delta;best=res;}}return best;}
export function chooseRadius(zoom,latitude,target=36){const desired=metersPerPixel(zoom,latitude)*target/2,candidates=[50,100,200,500,1000,2000,5000,10000,20000,50000,100000,200000];return candidates.reduce((best,n)=>Math.abs(Math.log(n/desired))<Math.abs(Math.log(best/desired))?n:best,candidates[0]);}
export const compareBreaks=[1,167,334,500,667,834];
export function compareBin(count,max=1000){return Math.min(5,Math.max(0,Math.floor(count*6/max)));}
