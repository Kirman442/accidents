import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import './prepare-geography.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'public','prototypes');fs.mkdirSync(output,{recursive:true});
fs.copyFileSync(path.join(root,'src/app/prototype-bridge.js'),path.join(root,'public/prototype-bridge.js'));
for(const screen of ['overview','time','severity']){
  let html=fs.readFileSync(path.join(root,'prototypes',screen+'-mockup.html'),'utf8');
  html=html.replace('</head>', '<style>.layout{display:block}.sidebar{display:none}.content{max-width:none;padding:10px 12px;margin:0}.top{position:static;margin:0 0 10px;padding:0;background:transparent;border:0;box-shadow:none}.top .controls,.top h1,.top .kicker{display:none}.top .muted{margin:0}body{background:#f3f5f7}</style></head>');
  html=html.replace('</body>', '<script src="../prototype-bridge.js" data-screen="'+screen+'"></script></body>');
  fs.writeFileSync(path.join(output,screen+'-embedded.html'),html);
}
console.log('Prepared 3 embedded analytic prototypes');
