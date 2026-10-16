import {readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const result=await build({absWorkingDir:root,entryPoints:['test-app.js'],bundle:true,write:false,format:'iife',target:'es2020',minify:true,legalComments:'inline'});
const html=(await readFile(path.join(root,'test-index.template.html'),'utf8')).replace('/*APP_CSS*/',await readFile(path.join(root,'test-style.css'),'utf8')).replace('/*APP_JS*/',()=>result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
await writeFile(path.join(root,'roadster.html'),html);
await build({absWorkingDir:root,entryPoints:['webgpu-probe-app.js'],outfile:path.join(root,'webgpu.bundle.js'),bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'inline',plugins:[{name:'webgpu-three',setup(b){b.onResolve({filter:/^three$/},()=>({path:path.join(root,'node_modules/three/build/three.webgpu.js')}))}}]});
console.log('Built standalone main demo and bundled WebGPU replay.');
