import {readFileSync,writeFileSync,mkdirSync,rmSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp'};
const assets={};
function collect(dir){for(const file of readdirSync(dir)){const full=path.join(dir,file);if(statSync(full).isDirectory())collect(full);else{const ext=path.extname(full);if(mime[ext])assets['/'+path.relative('public',full).replaceAll('\\','/')]={type:mime[ext],body:readFileSync(full).toString('base64')};}}}
collect('public');
const catalog=readFileSync('public/catalog.js','utf8').replaceAll('export const','const');
const worker=readFileSync('worker/index.js','utf8').replace("import {catalog,colors,languages} from '../public/catalog.js';",catalog);
rmSync('dist',{recursive:true,force:true});mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});
writeFileSync('dist/server/index.js','const ASSETS='+JSON.stringify(assets)+';\n'+worker);
writeFileSync('dist/.openai/hosting.json',readFileSync('.openai/hosting.json'));
console.log('Built With love by Nasra Worker with '+Object.keys(assets).length+' assets.');
