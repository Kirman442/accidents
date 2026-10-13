import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'prototypes/severity-mockup.html'),'utf8');
const html=source.replace('</head>','<link rel="stylesheet" href="severity-layout-lab.css"></head>').replace('</body>','<script src="severity-layout-lab-controls.js"></script></body>');
fs.writeFileSync(path.join(root,'prototypes/severity-layout-lab.html'),html);
console.log('Prepared separate severity lab; original app prototype unchanged');
