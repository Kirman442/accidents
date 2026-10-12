import {ASSETS} from '../data-index.js';
export default async function dataEncoding(request,context){
  const pathname=new URL(request.url).pathname;
  if(!Object.hasOwn(ASSETS,pathname))return new Response('Unknown dataset asset',{status:404});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
  const response=await context.next();
  if(response.status!==200)return response;
  const entry=ASSETS[pathname],headers=new Headers(response.headers);
  if(entry.encoding==='br'){
    const original=response.headers.get('content-encoding');
    if(original&&original!=='identity')return new Response('Unexpected origin compression',{status:502});
    headers.set('Content-Encoding','br');
  }
  headers.set('Content-Type',entry.mime);
  headers.set('Cache-Control','public, max-age=31536000, immutable, no-transform');
  headers.set('X-Content-Type-Options','nosniff');headers.set('Timing-Allow-Origin','*');
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
}
