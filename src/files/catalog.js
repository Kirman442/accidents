export function validateCatalog(manifest) {
  if(manifest.status!=='complete'||!manifest.generation||manifest.shards?.length!==96||!Array.isArray(manifest.files))
    throw new Error('Требуется завершённый набор данных за 2020–2025 годы');
  const keys=new Set(manifest.shards.map(e=>e.year+':'+e.land));
  for(let year=2020;year<=2025;year++)for(let land=1;land<=16;land++)
    if(!keys.has(year+':'+land))throw new Error('Отсутствует год или земля в каталоге');
  return manifest;
}
export function datasetSpec(manifest,base,year,format) {
  if(![2020,2021,2022,2023,2024,2025].includes(year)||!['arrow','parquet'].includes(format))throw new Error('Неизвестный год или формат');
  const find=(land,kind,compression)=>{
    const entries=manifest.files.filter(e=>e.scope==='runtime'&&e.year===year&&e.land===land&&e.format===kind&&e.compression===compression);
    const entry=entries[0];
    if(entries.length!==1||!Number.isSafeInteger(entry.rows)||entry.rows<=0||!Number.isSafeInteger(entry.bytes)||entry.bytes<=0||
      !/^[a-f0-9]{64}$/.test(entry.sha256)||typeof entry.path!=='string'||entry.path.includes('..')||!entry.path.startsWith(kind==='parquet'?'parquet/':'arrow/'))
      throw new Error('Некорректная запись файла в каталоге');
    return entry;
  };
  const tasks=Array.from({length:16},(_,index)=>{
    const land=index+1,raw=find(land,'arrow-file','identity'),stream=find(land,'arrow-stream','identity');
    const file=find(land,format==='arrow'?'arrow-file':'parquet',format==='arrow'?'br':'zstd10');
    if(raw.rows!==file.rows||stream.rows!==file.rows)throw new Error('Разные числа строк в вариантах файла');
    return {land,year,rows:file.rows,format,url:base+file.path+'?v='+file.sha256,generation:manifest.generation,
      decodedSha256:format==='arrow'?raw.sha256:file.sha256,
      reservedBytes:Math.max(raw.bytes,stream.bytes)+file.rows*20+65536};
  });
  return {key:manifest.generation+':'+format+':'+year,year,format,tasks,
    reservedBytes:tasks.reduce((n,t)=>n+t.reservedBytes,0)};
}
