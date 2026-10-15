import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publish=path.join(root,'.netlify/publish');
const site=process.env.UAD_VERIFY_SITE||'https://kirman442-uad-step08.netlify.app';
if(!/^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(site))throw new Error('Unsupported verification origin');
const digest=b=>createHash('sha256').update(b).digest('hex');
// Netlify's Pretty URLs rewrites the root fallback anchor, but not its script.
// Permit only that specific equivalent link; all other bytes stay significant.
const rootHTML=bytes=>bytes.toString().replace(/href=(["'])\/accidents\/app(?:\.html)?\1/g,'href="/accidents/app"');
async function list(directory,prefix=''){
  const result=[];
  for(const entry of await fs.readdir(directory,{withFileTypes:true})){
    const name=prefix+'/'+entry.name;
    if(entry.isDirectory())result.push(...await list(path.join(directory,entry.name),name));
    else if(entry.isFile())result.push(name);
  }
  return result;
}
const get=(name,depth=0)=>new Promise((resolve,reject)=>{
  const request=https.get(site+name,{headers:{'Accept-Encoding':'identity'}},response=>{
    if([301,302,307,308].includes(response.statusCode)&&response.headers.location){
      response.resume();const target=new URL(response.headers.location,site+name);
      if(target.origin!==site||depth>=5){reject(new Error('Unexpected redirect: '+name));return;}
      get(target.pathname+target.search,depth+1).then(resolve,reject);return;
    }
    const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,bytes:Buffer.concat(chunks)}));response.on('error',reject);
  });request.setTimeout(60000,()=>request.destroy(new Error('Timeout '+name)));request.on('error',reject);
});
const publication=JSON.parse(await fs.readFile(path.join(root,'.netlify/publication.json'),'utf8'));
const files=(await list(publish)).sort(),checks=[];
let cursor=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<files.length){
  const name=files[cursor++],[remote,local]=await Promise.all([get(name),fs.readFile(path.join(publish,name))]);
  const exact=digest(remote.bytes)===digest(local),prettyRoot=name==='/index.html'&&rootHTML(remote.bytes)===rootHTML(local);
  if(remote.status!==200||!exact&&!prettyRoot)throw new Error('HTTP/hash mismatch: '+name);
  if(name.endsWith('.br')&&remote.headers['content-encoding']!=='br')throw new Error('Missing Brotli encoding: '+name);
  checks.push({path:name,status:remote.status,bytes:remote.bytes.length,sha256:digest(remote.bytes),sourceBytes:local.length,sourceSha256:digest(local),match:exact?'exact':'netlify-pretty-root-link',encoding:remote.headers['content-encoding']||'identity'});
}}));
const manifest=JSON.parse(await fs.readFile(path.join(publish,publication.dataBase,'manifest.json'),'utf8'));
for(const entry of manifest.files.filter(f=>f.published)){
  const check=checks.find(c=>c.path===publication.dataBase+entry.path);
  if(!check||check.sha256!==entry.sha256||check.bytes!==entry.bytes)throw new Error('Manifest mismatch: '+entry.path);
}
const missing=await get(publication.dataBase+'missing-test-file.arrow.br');
if(missing.status!==404)throw new Error('Unknown data path must return 404');
const report={site,date:new Date().toISOString(),generation:publication.generation,dataFiles:publication.files,dataBytes:publication.bytes,unknownDataStatus:missing.status,checks:checks.sort((a,b)=>a.path.localeCompare(b.path))};
const output=process.env.UAD_VERIFY_REPORT||path.resolve(root,'../UAD_data/netlify-uiux-2026-10-15-http.json');
await fs.writeFile(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({checks:checks.length,dataFiles:report.dataFiles,dataBytes:report.dataBytes,unknownDataStatus:report.unknownDataStatus,output}));
