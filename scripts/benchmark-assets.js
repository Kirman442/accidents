import {createReadStream,existsSync,readdirSync,readFileSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import process from 'node:process';
export function binaryAssetsPlugin(root) {
  let source;
  const middleware=(req,res,next)=>{
    const prefix='/accidents/__binary/';
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(!pathname.startsWith(prefix))return next();
    try {
      if(!source) {
        const folder=process.env.UAD_BINARY_DATA || readdirSync(join(root,'data')).filter(n=>n.startsWith('binary-2020-2025-')).sort().at(-1);
        const path=process.env.UAD_BINARY_DATA?resolve(folder):join(root,'data',folder || 'missing');
        const manifest=JSON.parse(readFileSync(join(path,'manifest.json'),'utf8'));
        if(manifest.status!=='complete' || manifest.shards.length!==96)throw new Error('Требуется завершённый экспорт всех лет/земель');
        source={path,allowed:new Set(['manifest.json',...manifest.files.map(e=>e.path)])};
      }
      const name=decodeURIComponent(pathname.slice(prefix.length));
      if(!source.allowed.has(name)){res.statusCode=404;res.end('Unknown dataset asset');return;}
      const file=join(source.path,name);
      if(!existsSync(file)){res.statusCode=404;res.end('Missing dataset asset');return;}
      res.setHeader('Cache-Control',name==='manifest.json'?'no-store':'public, max-age=3600');
      res.setHeader('Content-Type',name.endsWith('.json')?'application/json':'application/octet-stream');
      if(name.endsWith('.br'))res.setHeader('Content-Encoding','br');
      if(name.endsWith('.gz'))res.setHeader('Content-Encoding','gzip');
      res.setHeader('Content-Length',statSync(file).size);
      const stream=createReadStream(file);
      stream.on('error',()=>{if(!res.headersSent)res.statusCode=500;res.end();});
      res.on('close',()=>stream.destroy());
      if(req.method==='HEAD'){res.end();stream.destroy();}else stream.pipe(res);
    }catch(error){res.statusCode=503;res.end(error.message);}
  };
  return {name:'uad-local-binary-assets',configureServer(server){server.middlewares.use(middleware);},
    configurePreviewServer(server){server.middlewares.use(middleware);}};
}
