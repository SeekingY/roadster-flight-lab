import {mkdir as makeOutputDirectory} from 'node:fs/promises';
await makeOutputDirectory('out',{recursive:true});
import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(pathToFileURL(resolve('roadster.html')).href+'?film=1');await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
const report=await page.evaluate(async()=>{
 const a=window.__roadsterTest,gl=a.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info'),results=[];
 document.body.classList.remove('recording');
 for(const quality of ['cinema','balanced'])for(const [view,mode,time]of [['exterior','full',0],['test','full',24],['test','flight',10]]){
  a.premium.setQuality(quality);a.setMode(mode);a.setView(view);a.seek(time);
  const draw=i=>{a.ui.time=time+(view==='test'?i/60:0);a.update(1/60,true);gl.finish()};
  for(let i=0;i<8;i++)draw(i);
  const samples=[];for(let i=0;i<40;i++){const start=performance.now();draw(i);samples.push(performance.now()-start)}samples.sort((x,y)=>x-y);
  results.push({quality,view,mode,time,frames:40,meanMs:samples.reduce((x,y)=>x+y,0)/samples.length,p50Ms:samples[20],p95Ms:samples[38]});
 }
 return {browser:navigator.userAgent,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight],pixelRatio:a.renderer.getPixelRatio(),parts:a.car.parts.length,results,method:'40 scripted update+render+gl.finish samples after 8 warmups; desktop headless Chrome; includes CPU and GPU synchronization; not interactive FPS or a cross-engine ranking'};
});report.errors=errors;await writeFile('out/premium-performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(errors.length)process.exitCode=1;
