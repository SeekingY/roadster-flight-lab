import {mkdir as makeOutputDirectory} from 'node:fs/promises';
await makeOutputDirectory('out',{recursive:true});
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const reports=[],errors=[],warnings=[],samples=[];
const url='http://127.0.0.1:8767/webgpu-probe-roadster.html';
for(const backend of ['webgpu','webgl','no-gpu-api']){
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  if(backend==='no-gpu-api')await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
  page.on('pageerror',e=>errors.push({backend,error:e.message}));
  page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')warnings.push({backend,type:m.type(),message:m.text()})});
  await page.goto(url+'?manual=1'+(backend==='webgl'?'&backend=webgl':''));
  await page.waitForFunction(()=>window.__webgpuProbe?.report?.rendered||window.__webgpuProbeError,{timeout:45000});
  assert.equal(await page.evaluate(()=>window.__webgpuProbeError),undefined);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:'out/webgpu-probe-'+backend+'.png'});
  if(backend!=='no-gpu-api')for(const [mode,t,name]of [['full',0,'entry'],['full',10,'climb'],['full',24,'inverted'],['full',35,'return'],['full',45,'second-entry'],['full',53,'release'],['full',55,'landing-jet'],['full',58,'landed'],['full',64,'end'],['kickflip',0,'kickflip-entry'],['kickflip',14,'kickflip'],['kickflip',15,'roll'],['kickflip',16.6,'roll-complete'],['kickflip',18,'kickflip-landed'],['kickflip',26,'kickflip-end']]){
    const sample=await page.evaluate(async([mode,t])=>{const p=window.__webgpuProbe;await p.setMode(mode);await p.seek(t);const s=p.sample();return {mode,t,position:s.position,renderedPosition:p.car.group.position.toArray(),pitch:s.pitch,roll:s.roll,rotation:p.car.group.rotation.toArray().slice(0,3),contact:s.contact,plumePower:s.plumePower,time:p.ui.time,phase:s.phase,ramp:p.environment.ramp.visible,fleet:p.environment.fleet.visible,bodyHeight:document.body.scrollHeight,bodyWidth:document.body.scrollWidth,width:innerWidth,height:innerHeight}},[mode,t]);
    assert(sample.position.every((v,i)=>Math.abs(v-sample.renderedPosition[i])<1e-8));assert(Math.abs(sample.rotation[0]+sample.roll)<1e-8);assert(Math.abs(sample.rotation[2]+sample.pitch)<1e-8);assert.equal(sample.ramp,mode==='full');assert.equal(sample.fleet,mode==='kickflip');assert.equal(sample.time,t);assert(sample.bodyWidth<=sample.width);samples.push({backend,name,...sample});
    if(['inverted','release','landing-jet','kickflip'].includes(name)){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:`out/webgpu-probe-${backend}-${name}.png`})}
  }
  await page.locator('[data-mode=full]').click();await page.evaluate(()=>window.__webgpuProbe.render());assert.equal(await page.locator('#timeline').getAttribute('max'),'64');
  await page.locator('#timeline').fill('24');await page.evaluate(()=>window.__webgpuProbe.render());assert.equal(await page.evaluate(()=>window.__webgpuProbe.ui.time),24);
  await page.locator('#speed').click();assert.equal(await page.evaluate(()=>window.__webgpuProbe.ui.speed),.5);
  await page.locator('[data-mode=kickflip]').click();await page.evaluate(()=>window.__webgpuProbe.render());assert.equal(await page.locator('#timeline').getAttribute('max'),'26');
  if(backend==='webgpu'){await page.setViewportSize({width:390,height:900});await page.evaluate(async()=>{const p=window.__webgpuProbe;await p.setMode('full');await p.seek(24)});await page.screenshot({path:'out/webgpu-probe-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
  reports.push(await page.evaluate(()=>({...window.__webgpuProbe.report,status:document.querySelector('#backend').textContent})));
  await page.close();
}
const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push({backend:'playback',error:e.message}));await page.goto(url);await page.waitForFunction(()=>window.__webgpuProbe?.report?.rendered);await page.locator('#play').click();await page.waitForFunction(()=>window.__webgpuProbe.ui.time>.25);await page.locator('#play').click();const paused=await page.evaluate(()=>({playing:window.__webgpuProbe.ui.playing,time:window.__webgpuProbe.ui.time}));assert.equal(paused.playing,false);assert(paused.time>.25);await page.close();
const result={reports,errors,warnings,samples,playback:paused};await writeFile('out/webgpu-probe.json',JSON.stringify(result,null,2));console.log(JSON.stringify({reports,errors,warnings,states:samples.length,playback:paused},null,2));await browser.close();
assert.equal(errors.length,0);assert(reports.every(r=>r.rendered));assert.equal(reports[0].backend,'WebGPUBackend');assert.equal(reports[1].backend,'WebGLBackend');assert.equal(reports[2].backend,'WebGLBackend');assert.equal(reports[2].gpuAPI,false);
