import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import https from 'node:https';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {publishPlan,checkPayload,sha256} from './deployment-plan.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const exists=async p=>{try{await fs.access(p);return true;}catch{return false;}};
// Raw HTTPS preserves precompressed .br bytes, unlike fetch's automatic decoding.
const remoteGet=url=>new Promise((resolve,reject)=>{
  const request=https.get(url,{headers:{'Accept-Encoding':'identity'}},response=>{
    if(response.statusCode!==200){response.resume();reject(new Error('Dataset HTTP '+response.statusCode));return;}
    const chunks=[];response.on('data',b=>chunks.push(b));response.on('end',()=>resolve(Buffer.concat(chunks)));response.on('error',reject);
  });request.setTimeout(60000,()=>request.destroy(new Error('Dataset timeout')));request.on('error',reject);
});
let source=process.env.UAD_BINARY_DATA;
if(!source){
  const dataRoot=process.env.UAD_DATA_DIR||path.resolve(root,'../UAD_data');
  if(await exists(dataRoot))source=path.join(dataRoot,(await fs.readdir(dataRoot)).filter(n=>n.startsWith('binary-2020-2025-')).sort().at(-1)||'missing');
}
let remote=process.env.UAD_PUBLISHED_DATA_BASE_URL;
if(!remote&&await exists(path.join(root,'deployment/source.json')))remote=JSON.parse(await fs.readFile(path.join(root,'deployment/source.json'),'utf8')).dataBaseUrl;
const local=source&&await exists(path.join(source,'manifest.json'));
if(!local&&!remote)throw new Error('Provide local UAD_BINARY_DATA or published immutable UAD_PUBLISHED_DATA_BASE_URL');
if(!local&&!/^https:\/\/[a-z0-9-]+\.netlify\.app\/accidents\/__binary\/[a-f0-9]{32}\/$/.test(remote))throw new Error('Unsupported dataset source URL');
const read=name=>local?fs.readFile(path.join(source,name)):remoteGet(new URL(name,remote));
const manifestBytes=await read('manifest.json'),input=JSON.parse(manifestBytes);
input.source_manifest_sha256 ||= sha256(manifestBytes);
const plan=publishPlan(input);
const buildDir=path.join(root,'.netlify/site-build'),publishDir=path.join(root,'.netlify/publish');
await fs.mkdir(path.join(root,'netlify'),{recursive:true});
const assets=Object.fromEntries(plan.payloads.map(f=>[plan.base+f.path,{encoding:f.path.endsWith('.br')?'br':'identity',mime:f.path.endsWith('.json')?'application/json':f.path.endsWith('.br')?'application/vnd.apache.arrow.file':'application/octet-stream'}]));
assets[plan.base+'manifest.json']={encoding:'identity',mime:'application/json'};
await fs.writeFile(path.join(root,'netlify/data-index.js'),'export const ASSETS='+JSON.stringify(assets)+';\n');
await new Promise((resolve,reject)=>{
  const vite=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build','--outDir',buildDir],{
    cwd:root,stdio:'inherit',env:{...process.env,VITE_FILE_DATA_BASE_URL:plan.base}});
  vite.on('error',reject);vite.on('exit',code=>code===0?resolve():reject(new Error('Vite build failed: '+code)));
});
// Verify exact targets before replacing generated folders inside .netlify.
if(publishDir!==path.join(root,'.netlify','publish'))throw new Error('Unsafe publish directory');
await fs.rm(publishDir,{recursive:true,force:true});await fs.mkdir(publishDir,{recursive:true});
await fs.cp(buildDir,path.join(publishDir,'accidents'),{recursive:true});
const app=await fs.readFile(path.join(publishDir,'accidents/app.html'));
await fs.rename(path.join(publishDir,'accidents/index.html'),path.join(publishDir,'accidents/supabase.html'));
await fs.writeFile(path.join(publishDir,'accidents/index.html'),app);
await fs.writeFile(path.join(publishDir,'index.html'),'<!doctype html><html lang="ru"><meta charset="utf-8"><title>Unfallatlas</title><script>location.replace("/accidents/app.html"+location.search+location.hash)</script><a href="/accidents/app.html">Открыть Unfallatlas</a></html>');
const datasetDir=path.join(publishDir,'accidents/__binary',input.generation);await fs.mkdir(datasetDir,{recursive:true});
await fs.writeFile(path.join(datasetDir,'manifest.json'),JSON.stringify(plan.manifest));
let cursor=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<plan.payloads.length){
  const f=plan.payloads[cursor++],bytes=await read(f.path);checkPayload(f,bytes);
  const dest=path.join(datasetDir,f.path);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,bytes);
}}));
const report={generation:input.generation,dataBase:plan.base,source:local?'verified local export':'verified published dataset',
  files:plan.payloads.length,bytes:plan.payloads.reduce((sum,f)=>sum+f.bytes,0),years:input.years,createdAt:new Date().toISOString()};
await fs.writeFile(path.join(root,'.netlify/publication.json'),JSON.stringify(report,null,2));
console.log('Publication ready: '+JSON.stringify(report));
