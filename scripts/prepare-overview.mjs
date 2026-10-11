import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateOverview,overviewYears} from '../src/files/overview-data.js';
// CSV state machine retains quoted commas and escaped quotes in KBA district names.
export function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('Unclosed CSV quote');
  if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
  const header=rows.shift().map(v=>v.replace(/^\uFEFF/,''));
  return rows.filter(r=>r.some(v=>v)).map(r=>{
    if(r.length!==header.length)throw new Error('Invalid CSV row width');
    return Object.fromEntries(header.map((k,i)=>[k,r[i]]));
  });
}
export function prepareOverview(folder){
  const manifest=JSON.parse(readFileSync(resolve(folder,'manifest.json'),'utf8'));
  if(manifest.status!=='complete')throw new Error('Incomplete binary export');
  const sources={};
  function verified(path){
    const bytes=readFileSync(resolve(folder,path)),sha256=createHash('sha256').update(bytes).digest('hex');
    if(manifest.files.find(f=>f.path===path)?.sha256!==sha256)throw new Error('Source checksum mismatch: '+path);
    sources[path]=sha256;return bytes.toString('utf8');
  }
  const summaries=JSON.parse(verified('analytics/accident_summaries.json'));
  const fleet=parseCsv(verified('analytics/fleet_snapshots.csv')).filter(r=>['national','land'].includes(r.geography_level)).map(r=>({snapshot_date:r.snapshot_date,geography_level:r.geography_level,region_code:r.region_code,pkw:Number(r.pkw)}));
  const compact=s=>({count:s.count,category:[1,2,3].map(k=>Number(s.distributions.category[k]||0)),participation:s.participation});
  const years=Object.fromEntries(overviewYears.map(y=>[y,{national:compact(summaries.years[y].national),lands:Object.fromEntries(Array.from({length:16},(_,i)=>[i+1,compact(summaries.years[y].lands[i+1])]))}]));
  return validateOverview({schema_version:1,generation:manifest.generation,sources,years,fleet});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw new Error('Usage: node scripts/prepare-overview.mjs <complete binary export> [output JSON]');
  const output=resolve(process.argv[3]||'public/analytics/overview.json');
  mkdirSync(dirname(output),{recursive:true});
  const text=JSON.stringify(prepareOverview(resolve(process.argv[2])))+'\n';
  writeFileSync(output,text);console.log(`Overview: ${output}, ${Buffer.byteLength(text)} bytes`);
}
