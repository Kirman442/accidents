
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(new URL('..',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const dataDir=path.join(root,'data','transfer');
const tables=Array.from({length:16},(_,i)=>'unfallatlas_uland_'+String(i+1).padStart(2,'0'));
const columns=['oid','uland','ujahr','uwochentag','ukategorie','ist_strassenzustand','ist_rad','ist_pkw','ist_fuss','ist_krad','ist_gkfz','xgcswgs84','ygcswgs84'];
const sourceRef='uhtrklxakbomwuqnegea', targetRef='fiambamorokfphkzdjxc';
function readEnv(file){return Object.fromEntries(fs.readFileSync(file,'utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const p=l.indexOf('=');return[l.slice(0,p).trim(),l.slice(p+1).trim().replace(/^['"]|['"]$/g,'')]}));}
async function get(url,key,prefer){
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetch(url,{headers:{apikey:key,Authorization:'Bearer '+key,...(prefer?{Prefer:prefer}:{})},signal:AbortSignal.timeout(30000)});
  const body=await response.json();
  if(response.ok)return{body,total:Number((response.headers.get('content-range')||'').split('/')[1])};
  if(![500,502,503,504,429].includes(response.status)||attempt===2)throw new Error('REST '+response.status+': '+body.code);
  await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
 }
}
const csv=value=>value==null?'':('"'+String(value).replaceAll('"','""')+'"');
async function exportSource(){
 const vars=readEnv(path.resolve(root,'../accidents/.env')),url=vars.VITE_SUPABASE_URL,key=vars.VITE_SUPABASE_ANON_KEY;
 if(new URL(url).hostname!==sourceRef+'.supabase.co')throw new Error('Unexpected source');
 fs.mkdirSync(dataDir,{recursive:true}); const manifest={source:sourceRef,tables:{},total:0,createdAt:new Date().toISOString()};
 for(const table of tables){
  const land=Number(table.slice(-2));let offset=0,total=null,last=null;const rows=[];
  while(true){
   const params=new URLSearchParams({select:'*',uland:'eq.'+land,order:'oid.asc',offset:String(offset),limit:'5000'});
   const response=await get(url+'/rest/v1/unfallatlas_partitioned?'+params,key,offset===0?'count=exact':null);
   if(total===null){total=response.total;if(!Number.isSafeInteger(total))throw new Error('Missing source count');}
   if(!response.body.length)break;
   for(const row of response.body){
    if(!Number.isSafeInteger(row.oid)||Number(row.uland)!==land||(last!==null&&row.oid<=last))throw new Error('Invalid source identity: '+table);
    last=row.oid;rows.push(row);
   }
   offset+=response.body.length;
  }
  if(rows.length!==total)throw new Error('Source count mismatch: '+table);
  const json=JSON.stringify(rows);fs.writeFileSync(path.join(dataDir,table+'.json'),json);
  const lines=rows.map(row=>[...columns.map(c=>csv(row[c])),csv(row.geom==null?null:JSON.stringify(row.geom))].join(','));
  fs.writeFileSync(path.join(dataDir,table+'.csv'),lines.join('\n')+'\n');
  manifest.tables[table]={count:rows.length,sha256:createHash('sha256').update(json).digest('hex')};manifest.total+=rows.length;
  console.log(table+': exported '+rows.length);
 }
 fs.writeFileSync(path.join(dataDir,'manifest.json'),JSON.stringify(manifest,null,2));console.log('Export total: '+manifest.total);
}
function connectionEnv(){
 const text=fs.readFileSync(path.join(root,'data','uad_settings.txt'),'utf8');
 const url=new URL(text.split(/\r?\n/).find(line=>line.startsWith('postgres')));
 if(url.hostname!=='db.'+targetRef+'.supabase.co')throw new Error('Target guard failed');
 return {...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:url.pathname.slice(1),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'require',PGCONNECT_TIMEOUT:'10'};
}
function importTarget(){
 const manifest=JSON.parse(fs.readFileSync(path.join(dataDir,'manifest.json'),'utf8'));if(manifest.source!==sourceRef)throw new Error('Source guard failed');
 const statements=['BEGIN;','CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;'];
 for(const table of tables){
  const land=Number(table.slice(-2)), expected=manifest.tables[table].count;
  const json=fs.readFileSync(path.join(dataDir,table+'.json'),'utf8');
  if(createHash('sha256').update(json).digest('hex')!==manifest.tables[table].sha256)throw new Error('Export changed: '+table);
  statements.push('CREATE TABLE public.'+table+' (oid bigint PRIMARY KEY, uland bigint NOT NULL CHECK (uland='+land+'), ujahr bigint NOT NULL, uwochentag bigint, ukategorie bigint, ist_strassenzustand integer, ist_rad integer, ist_pkw integer, ist_fuss integer, ist_krad integer, ist_gkfz integer, xgcswgs84 text, ygcswgs84 text, geom extensions.geometry);');
  statements.push('CREATE TEMP TABLE stage_'+land+' (LIKE public.'+table+' INCLUDING DEFAULTS); ALTER TABLE stage_'+land+' DROP COLUMN geom; ALTER TABLE stage_'+land+' ADD COLUMN geom_json text;');
  const file=path.join(dataDir,table+'.csv').replaceAll('\\','/').replaceAll("'","''");
  statements.push('\\copy stage_'+land+" FROM '"+file+"' WITH (FORMAT csv)");
  statements.push('INSERT INTO public.'+table+' SELECT '+columns.join(',')+', CASE WHEN geom_json IS NULL THEN NULL ELSE extensions.ST_GeomFromGeoJSON(geom_json) END FROM stage_'+land+';');
  statements.push('CREATE INDEX '+table+'_geom_idx ON public.'+table+' USING gist(geom); CREATE INDEX '+table+'_ukategorie_idx ON public.'+table+'(ukategorie); CREATE INDEX '+table+'_uwochentag_idx ON public.'+table+'(uwochentag);');
  statements.push('ALTER TABLE public.'+table+' ENABLE ROW LEVEL SECURITY; CREATE POLICY public_read ON public.'+table+' FOR SELECT TO anon, authenticated USING(true); GRANT SELECT ON public.'+table+' TO anon, authenticated; ANALYZE public.'+table+';');
  statements.push('DO $$ BEGIN IF (SELECT count(*) FROM public.'+table+') <> '+expected+' THEN RAISE EXCEPTION \'Import count mismatch\'; END IF; END $$;');
 }
 statements.push("NOTIFY pgrst, 'reload schema';",'COMMIT;');
 const env=connectionEnv(); const executable=process.env.UAD_PSQL||'J:/Program Files/PostgreSQL/16/bin/psql.exe';
 const result=spawnSync(executable,['-X','-v','ON_ERROR_STOP=1','-f','-'],{env,input:statements.join('\n')+'\n',encoding:'utf8',maxBuffer:4*1024*1024});
 console.log(result.stdout||'');console.log((result.stderr||'').replaceAll(env.PGPASSWORD,'[REDACTED]'));if(result.error)throw result.error;if(result.status!==0)throw new Error('Import failed; transaction rolled back');
}
async function verifyTarget(){
 const vars=readEnv(path.join(root,'.env.local')),url=vars.VITE_SUPABASE_URL,key=vars.VITE_SUPABASE_ANON_KEY;
 if(new URL(url).hostname!==targetRef+'.supabase.co')throw new Error('Target guard failed');
 const manifest=JSON.parse(fs.readFileSync(path.join(dataDir,'manifest.json'),'utf8'));
 const {createClient}=await import('@supabase/supabase-js');const client=createClient(url,key,{auth:{persistSession:false}});
 const {fetchLand,toFeatures,mergeAttributes}=await import('../src/components/prod/utils/landRequests.js');
 let total=0;
 const start=performance.now();
 for(const table of tables){
  const geo=await fetchLand(client,table,'oid,xgcswgs84,ygcswgs84');
  const attributes=await fetchLand(client,table,'oid,uland,uwochentag,ukategorie,ist_rad,ist_pkw,ist_fuss');
  const merged=mergeAttributes(toFeatures(geo),attributes);
  if(merged.length!==manifest.tables[table].count)throw new Error('Target count mismatch: '+table);
  const source=JSON.parse(fs.readFileSync(path.join(dataDir,table+'.json'),'utf8'));
  for(let i=0;i<source.length;i++){
   const a=source[i],b=merged[i];
   for(const column of ['oid','uland','uwochentag','ukategorie','ist_rad','ist_pkw','ist_fuss'])if(a[column]!==b.properties[column])throw new Error('Attribute mismatch: '+table);
   if(Number(a.xgcswgs84)!==b.longitude||Number(a.ygcswgs84)!==b.latitude)throw new Error('Coordinate mismatch: '+table);
  }
  total+=merged.length;console.log(table+': verified '+merged.length);
 }
 const result={total,elapsedMs:Math.round(performance.now()-start),verifiedAt:new Date().toISOString(),mode:'sequential production loader verification'};
 fs.writeFileSync(path.join(dataDir,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
const mode=process.argv[2];
if(mode==='export')await exportSource();else if(mode==='import')importTarget();else if(mode==='verify')await verifyTarget();else throw new Error('Use export, import or verify');
