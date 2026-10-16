import {mkdir as makeOutputDirectory} from 'node:fs/promises';
await makeOutputDirectory('out',{recursive:true});
import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(pathToFileURL(resolve('roadster.html')).href+'?film=1');await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
await page.evaluate(()=>{document.body.classList.remove('recording');window.__roadsterTest.setView('exterior')});
const shot=async name=>{await page.screenshot({path:resolve('out',name+'.png')});console.log(name)};
await shot('test-final-hero');
const samples=[];
for(const [mode,t,name]of [['full',10,'climb'],['full',24,'inverted'],['full',35,'return'],['full',53,'release'],['full',55,'landing-jet'],['full',58,'landed'],['kickflip',14,'kickflip'],['kickflip',15,'roll'],['kickflip',18,'kickflip-landed']]){
 const s=await page.evaluate(([mode,t])=>{const a=window.__roadsterTest;a.setMode(mode);a.seek(t);return a.sample()},[mode,t]);samples.push({name,...s});await shot('test-'+name);
}
await page.getByRole('button',{name:'参考与对照'}).click();const research=await page.locator('#research-dialog').isVisible();await shot('test-research');await page.locator('#research-close').click();
await page.getByRole('button',{name:'Anatomy',exact:true}).click();await page.locator('#explode').click();await page.evaluate(()=>{const a=window.__roadsterTest;for(let i=0;i<180;i++)a.update(1/60);a.update(0,true)});await shot('test-anatomy');
await page.setViewportSize({width:390,height:900});await page.getByRole('button',{name:'车辆外观',exact:true}).click();await shot('test-mobile-hero');
await page.evaluate(()=>{const a=window.__roadsterTest;a.setMode('full');a.seek(24)});await shot('test-mobile-inverted');
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
await writeFile('out/test-qa.json',JSON.stringify({errors,overflow,research,samples,metrics:await page.evaluate(()=>window.__roadsterTest.getMetrics())},null,2));
console.log(JSON.stringify({errors,overflow,research}));await browser.close();
