import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=process.env.UAD_GEOGRAPHY_DATA||path.resolve(root,'../UAD_data/geography-2025-v1');
const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
if(manifest.schema_version!==1||Object.keys(manifest.files).sort().join(',')!=='population,states')throw new Error('Invalid geography manifest');
const payloads=Object.values(manifest.files).map(entry=>{
  if(!/^(states|population)-[a-f0-9]{16}\.json$/.test(entry.path))throw new Error('Unsafe geography path');
  const bytes=fs.readFileSync(path.join(source,entry.path));
  if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw new Error('Changed geography asset');
  return {entry,bytes};
});
const destination=path.join(root,'public/geography');fs.mkdirSync(destination,{recursive:true});
for(const {entry,bytes} of payloads)fs.writeFileSync(path.join(destination,entry.path),bytes);
fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest));
console.log('Prepared independent state boundaries and population assets');
