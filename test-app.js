import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GEO,MAT} from './lab-kit.js';
import {buildCar} from './car-v2.js';
import {createAnatomy} from './anatomy-view.js';
import {buildTestEnvironment} from './test-environment.js';
import {TRACK,SEQUENCE_INFO,sampleSequence} from './test-sequence.js';
import {createPremiumRender} from './premium-render.js';
import {createVapor} from './vapor-v3.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const filmMode=new URLSearchParams(location.search).has('film');
const ui={view:'exterior',mode:'full',time:0,playing:false,speed:1,camera:'director',explode:0,selected:null};
const scene=new THREE.Scene();scene.background=new THREE.Color('#080b0f');scene.fog=new THREE.FogExp2('#080b0f',.004);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.91;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
$('#stage').appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(36,1,.05,240);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=3;controls.maxDistance=105;controls.maxPolarAngle=Math.PI*.505;controls.enablePan=true;
scene.add(new THREE.HemisphereLight(0xc4d6df,0x12151b,.65));
const key=new THREE.DirectionalLight(0xf2f1e7,3.1);key.position.set(-10,28,14);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=6;key.shadow.camera.bottom=-6;key.shadow.camera.far=45;key.shadow.bias=-.00005;key.shadow.normalBias=.004;scene.add(key,key.target);
const rim=new THREE.DirectionalLight(0xa8c9df,2);rim.position.set(10,12,-15);scene.add(rim);
const frontFill=new THREE.DirectionalLight(0xe4e1d6,.9);frontFill.position.set(-28,8,10);scene.add(frontFill);
const env=buildTestEnvironment({THREE});scene.add(env.group);
const car=buildCar({THREE,MAT,GEO});scene.add(car.group);
for(const item of car.parts){if(item.category==='glass'){const m=item.mesh.material;m.color.set('#03070b');m.metalness=.02;m.envMapIntensity=.8;m.roughness=.10;m.clearcoat=1;m.clearcoatRoughness=.055}}
const premium=createPremiumRender({renderer,scene,camera,car});
for(const item of car.parts)if(item.category==='body')item.mesh.receiveShadow=true;
env.ground.material=new THREE.MeshStandardMaterial({color:0x0b1017,map:env.ground.material.map,bumpMap:env.ground.material.map,bumpScale:.004,roughness:.93,metalness:.08});env.ground.receiveShadow=true;env.ground.scale.set(6,1,6);env.ground.material.map.repeat.multiplyScalar(6);
const showroomCanvas=document.createElement('canvas');showroomCanvas.width=showroomCanvas.height=256;const scx=showroomCanvas.getContext('2d'),sg=scx.createRadialGradient(128,128,8,128,128,128);sg.addColorStop(0,'rgba(38,55,67,.8)');sg.addColorStop(.55,'rgba(21,32,41,.4)');sg.addColorStop(1,'rgba(8,11,15,0)');scx.fillStyle=sg;scx.fillRect(0,0,256,256);
const showroomGround=new THREE.Mesh(new THREE.PlaneGeometry(15,12),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(showroomCanvas),transparent:true,depthWrite:false,toneMapped:false}));showroomGround.rotation.x=-Math.PI/2;showroomGround.position.set(7,-.018,0);scene.add(showroomGround);
showroomGround.userData.noReflection=true;
// Soft contact pool; it stays on the ground and fades as the car rises.
const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;const cx=contactCanvas.getContext('2d'),cg=cx.createRadialGradient(64,64,4,64,64,64);cg.addColorStop(0,'rgba(0,0,0,.72)');cg.addColorStop(.55,'rgba(0,0,0,.38)');cg.addColorStop(1,'rgba(0,0,0,0)');cx.fillStyle=cg;cx.fillRect(0,0,128,128);
const contact=new THREE.Mesh(new THREE.PlaneGeometry(6.8,3.8),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(contactCanvas),transparent:true,depthWrite:false,opacity:.75,toneMapped:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.011;scene.add(contact);
contact.userData.noReflection=true;
// Narrow floodlight pools reveal the scene without turning the night into day.
const floodLights=env.lightAnchors.map(a=>{const l=new THREE.SpotLight(0xc5deea,550,.0,.62,.7,1.4);l.position.set(...a.position);l.target.position.set(...a.target);scene.add(l,l.target);return l});
const redFill=new THREE.PointLight(0xed3026,12,9,2);redFill.position.set(2,.8,4);scene.add(redFill);

const vapor=createVapor({scene,sampleSequence});
vapor.material.uniforms.uDepth.value=premium.ao.depthTexture;
const worldPoint=new THREE.Vector3(),right=new THREE.Vector3(),tempTarget=new THREE.Vector3(),desiredPosition=new THREE.Vector3(),desiredTarget=new THREE.Vector3();
let anatomy=null,exploded=0,needsRender=true,lastShadow='',lastAnatomy='',tour=false,tourTime=0,lastFrame=performance.now(),fps=60,frames=0,fpsSince=performance.now();
const timecode=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const lerp=(a,b,t)=>a+(b-a)*t,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
function duration(){return SEQUENCE_INFO[ui.mode].duration}
function sample(){return sampleSequence(ui.time,ui.mode)}
function syncPlay(){$('#play-label').textContent=ui.playing?'暂停重放':ui.time>=duration()?'重新播放':'开始重放';$('#play-icon').textContent=ui.playing?'Ⅱ':'▶';$('#speed').textContent=ui.speed+'×'}
function applyCamera(position,target,fov=36){camera.clearViewOffset();camera.fov=fov;camera.position.copy(position);controls.target.copy(target);camera.lookAt(target);camera.updateProjectionMatrix();needsRender=true}
function exteriorCamera(){
 const origin=new THREE.Vector3(7,.56,0),offset=new THREE.Vector3(-6.5,1.65,7.4);const pos=origin.clone().add(offset);
 const forward=origin.clone().sub(pos).normalize();right.copy(forward).cross(camera.up).normalize();const target=origin.clone().addScaledVector(right,innerWidth<600?0:-1.05);
 if(innerWidth<600){pos.copy(origin).add(new THREE.Vector3(-13,4.8,13.5));target.y=.8}
 applyCamera(pos,target,innerWidth<600?40:34);
}
function setView(view){
 ui.view=view;document.body.dataset.view=view;$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 $('#anatomy-stage').hidden=view!=='anatomy';$('#anatomy-tools').hidden=view!=='anatomy';$('#stage').style.visibility=view==='anatomy'?'hidden':'visible';
 if(view!=='test')ui.playing=false;
 if(view==='exterior'){ui.camera='director';exteriorCamera()}
 if(view==='anatomy'&&!anatomy)anatomy=createAnatomy({THREE,container:$('#anatomy-stage'),car});
 lastAnatomy='';lastShadow='';needsRender=true;syncPlay();update(0,true);
}
function setMode(mode,{play=false,changeView=true}={}){
 ui.mode=mode;ui.time=0;ui.playing=play;ui.explode=0;
 $$('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('#timeline').max=duration();$('#total').textContent=timecode(duration());
 if(changeView)setView('test');ui.playing=play;ui.camera='director';$$('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera==='director'));
 syncPlay();lastShadow='';needsRender=true;update(0,true);
}
function frameCamera(s){
 if(ui.view!=='test'||ui.camera==='free')return;
 const p=new THREE.Vector3(...s.position),isKick=ui.mode==='kickflip',fullTime=ui.mode==='flight'?ui.time+45:ui.time;
 if(ui.camera==='wide'){
  desiredPosition.set(isKick?24:34,isKick?14:17,isKick?-36:-47);desiredTarget.set(isKick?0:-2,isKick?4.5:10,0);
 }else if(ui.camera==='chase'){
  desiredPosition.copy(p).add(new THREE.Vector3(7,3.5,-11));desiredTarget.copy(p).add(new THREE.Vector3(0,.6,0));
 }else if(isKick){
  if(ui.time<12.3){desiredPosition.copy(p).add(new THREE.Vector3(9,3,-4));desiredTarget.copy(p).add(new THREE.Vector3(-7,1.4,0))}
  else if(ui.time<18.5){desiredPosition.set(18,13,-34);desiredTarget.set(0,5,0)}
  else{desiredPosition.copy(p).add(new THREE.Vector3(7,3.6,-17));desiredTarget.copy(p).add(new THREE.Vector3(0,.7,0))}
 }else if(fullTime<4){
  desiredPosition.copy(p).add(new THREE.Vector3(7,2.2,-6.5));desiredTarget.copy(p).add(new THREE.Vector3(-1,.8,0));
 }else if(fullTime>52.45){
  desiredPosition.copy(p).add(new THREE.Vector3(10,fullTime>54.3?6:4,fullTime>54.3?-23:-19));desiredTarget.copy(p).add(new THREE.Vector3(-1,fullTime>54.3?-3:.7,0));
 }else{desiredPosition.set(34,17,-47);desiredTarget.set(-2,10.2,0)}
 const trackOverview=!isKick&&(ui.camera==='wide'||(ui.camera==='director'&&fullTime>=4&&fullTime<=52.45));
 const reserveControls=!filmMode&&!document.body.classList.contains('recording')&&innerWidth>=600&&trackOverview;
 if(innerWidth<600||reserveControls){const away=desiredPosition.clone().sub(desiredTarget);desiredPosition.copy(desiredTarget).addScaledVector(away,1.35)}
 applyCamera(desiredPosition,desiredTarget,ui.camera==='wide'?39:36);
 if(reserveControls)camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*.075,innerWidth,innerHeight);
}
function updateVapor(s){
 vapor.update(s,ui.mode,ui.view==='test');
}
function caption(s){
 const ft=ui.mode==='flight'?s.time+45:s.time;
 let number='01 / INVERSION',title='贴着跑道，穿过垂直面。',description='攀爬 · 倒挂停留 · 倒车返回';
 if(ui.mode==='kickflip'){number='03 / KICKFLIP';title='离开地面，完成整周侧滚。';description='平地起跳 · 跨越横向车队 · 正向着陆'}
 else if(ft>=45){number='02 / RELEASE';title='离轨，翻正，后退着陆。';description='继续俯仰翻转 · 冷气制动 · 正立接地'}
 else if(ft>=20&&ft<28){title='倒挂，也能停在原地。';description='约 170° 姿态 · 轮胎保持贴轨 · 吸附下压力'}
 else if(ft>=28){title='沿着同一条坡面，倒车返回。';description='保持接触 · 俯仰随坡面下降 · 回到入口'}
 $('#shot-number').textContent=number;$('#shot-title').textContent=title;$('#shot-description').textContent=description;
}
function readout(s){
 const tel=s.telemetry,alt=tel?.altitudeFt;$('#altitude').textContent=Number.isFinite(alt)?alt.toFixed(1):'—';$('#altitude-m').textContent=Number.isFinite(alt)?(alt*.3048).toFixed(1)+' m':'未显示';
 $('#pitch').textContent=Number.isFinite(tel?.pitchDeg)?Math.round(tel.pitchDeg)+'°':Math.round(((s.pitch*180/Math.PI)%360+360)%360)+'°';$('#pitch').title=Number.isFinite(tel?.pitchDeg)?'官方画面读数插值':'重建姿态估计';
 $('#roll').textContent=Math.round(s.roll*180/Math.PI)+'°';$('#roll').title='重建姿态估计';
 if(Number.isFinite(tel?.downforceKg)){$('#load-label').textContent='下压力';$('#load').textContent=Math.round(tel.downforceKg).toLocaleString('en-US')+' kg'}
 else if(Number.isFinite(tel?.gForce)){$('#load-label').textContent='过载';$('#load').textContent=tel.gForce.toFixed(1)+' g'}
 else{$('#load-label').textContent='画面载荷';$('#load').textContent='—'}
 $('#contact-status').textContent=s.contact?(s.contactMode==='track'&&s.position[1]>.5?'轮胎贴附坡面':'轮胎接触地面'):'轮胎离轨 · 冷气姿态调整';$('#contact-dot').classList.toggle('air',!s.contact);
 $('#timeline').value=s.time;$('#timeline').style.setProperty('--progress',clamp(s.time/s.duration)*100+'%');$('#elapsed').textContent=timecode(s.time);$('#source-time').textContent=timecode(s.videoTime);$('#phase-label').textContent=s.phase;caption(s);
}
function update(dt=0,force=false){
 const s=sample();const isTest=ui.view==='test';
 exploded=lerp(exploded,ui.explode,1-Math.exp(-Math.max(dt,1/120)/.24));if(Math.abs(exploded-ui.explode)<.001)exploded=ui.explode;
 car.update({explode:ui.view==='anatomy'?exploded:0,aeroDeploy:0,fanPower:s.contact&&s.position[1]>.5?1:0,dt:0,time:s.time,speed:0,paused:true,showInternal:ui.view==='anatomy'&&exploded>.01});
 if(isTest){car.group.position.set(...s.position);car.group.rotation.set(-s.roll,s.yaw,-s.pitch,'YXZ')}
 else{car.group.position.set(ui.view==='exterior'?7:0,0,0);car.group.rotation.set(0,0,0)}
 for(const w of car.wheels){w.rotation.z=isTest?-s.wheelTravel/w.userData.radius:0;for(const child of w.children)if(child.userData.fixedBrake){child.rotation.z=-w.rotation.z;child.position.copy(child.userData.fixedBrake).applyAxisAngle(new THREE.Vector3(0,0,1),-w.rotation.z)}}
 env.ramp.visible=isTest&&ui.mode!=='kickflip';env.fleet.visible=isTest&&ui.mode==='kickflip';env.markings.visible=isTest;env.lights.visible=isTest;showroomGround.visible=ui.view==='exterior';redFill.visible=isTest;
 env.setEdgeMode((ui.mode==='flight'||s.time>45)?'white':'red');
 car.group.updateMatrixWorld(true);contact.position.x=car.group.position.x;contact.position.z=car.group.position.z;contact.material.opacity=.8*Math.exp(-Math.max(0,car.group.position.y)/7);contact.visible=ui.view!=='anatomy';
 premium.setView(ui.view);key.intensity=ui.view==='exterior'?.65:2.7;rim.intensity=ui.view==='exterior'?.45:1.45;frontFill.intensity=ui.view==='exterior'?.25:.9;floodLights.forEach(l=>l.visible=isTest);
 vapor.material.uniforms.uDepthEnabled.value=premium.quality==='cinema'?1:0;
 key.position.copy(car.group.position).add(new THREE.Vector3(-10,14,8));key.target.position.copy(car.group.position).add(new THREE.Vector3(0,.4,0));key.target.updateMatrixWorld();
 const shadowKey=[ui.view,ui.mode,...car.group.position.toArray().map(v=>Math.round(v*25)),Math.round(s.pitch*80),Math.round(s.roll*80),Math.round(exploded*100)].join('|');
 if(shadowKey!==lastShadow){renderer.shadowMap.needsUpdate=true;lastShadow=shadowKey;needsRender=true}
 if(isTest)frameCamera(s);updateVapor(s);readout(s);
 if(ui.view==='anatomy'&&anatomy){const k=[exploded.toFixed(3),ui.selected].join('|');if(force||k!==lastAnatomy){anatomy.render({explode:exploded,selected:ui.selected,system:'all',force:filmMode||force});lastAnatomy=k}}
 if(ui.view!=='anatomy'&&(force||needsRender||ui.playing||tour)){premium.render();needsRender=false}
 return s;
}
function resize(){const w=$('#stage').clientWidth,h=$('#stage').clientHeight;premium.resize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();vapor.resize(h,w,renderer.getPixelRatio());if(ui.view==='exterior')exteriorCamera();lastAnatomy='';needsRender=true;update(0,true)}
function play(){if(tour)stopTour();if(ui.view!=='test')setView('test');if(ui.time>=duration())ui.time=0;ui.playing=!ui.playing;syncPlay();needsRender=true}
function seek(t){ui.time=clamp(Number(t)||0,0,duration());needsRender=true;return update(0,true)}
function openOriginal(){ui.playing=false;syncPlay();const t=Math.floor(sample().videoTime);$('#original-time').textContent=timecode(t);$('#original-link').href=`https://www.youtube.com/watch?v=qt5p-_tE8d0&t=${t}s`;$('#original-player').src=`https://www.youtube.com/embed/qt5p-_tE8d0?start=${t}&rel=0`;$('#original-dialog').showModal()}
function stopTour(){tour=false;document.body.classList.remove('recording');ui.playing=false;setView('exterior');syncPlay()}
function startTour(){tour=true;tourTime=0;ui.playing=false;ui.explode=0;document.body.classList.add('recording');filmSeek(0)}
function filmSeek(t){
 tourTime=clamp(t,0,28);let view='test',mode='full',time=0;
 if(t<3){view='exterior'}else if(t<15){mode='full';time=(t-3)/12*44.5}
 else if(t<21){mode='flight';time=(t-15)/6*18.8}
 else if(t<26){mode='kickflip';time=11.7+(t-21)/5*8.3}
 else if(t<27.2){view='anatomy';mode='full';ui.explode=.85;exploded=.85}
 else{view='exterior';ui.explode=0;exploded=0}
 if(ui.mode!==mode){ui.mode=mode;$('#timeline').max=duration()}
 if(ui.view!==view)setView(view);ui.time=time;ui.camera='director';update(0,true);
}
$('#home').addEventListener('click',e=>{e.preventDefault();if(tour)stopTour();setView('exterior')});
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>{if(tour)stopTour();setView(b.dataset.view)}));
$$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{if(tour)stopTour();setMode(b.dataset.mode)}));
$$('[data-camera]').forEach(b=>b.addEventListener('click',()=>{ui.camera=b.dataset.camera;$$('[data-camera]').forEach(x=>x.classList.toggle('active',x===b));needsRender=true;update(0,true)}));
$('#hero-play').addEventListener('click',()=>setMode('full',{play:true}));$('#play').addEventListener('click',play);
$('#restart').addEventListener('click',()=>{ui.time=0;needsRender=true;update(0,true);syncPlay()});
$('#speed').addEventListener('click',()=>{ui.speed=ui.speed===1?.5:ui.speed===.5?.25:1;syncPlay()});
$('#timeline').addEventListener('input',e=>{const requested=e.target.value;if(ui.view!=='test')setView('test');ui.playing=false;seek(requested);syncPlay()});
$('#explode').addEventListener('click',()=>{ui.explode=ui.explode?0:1;$('#explode').setAttribute('aria-pressed',String(!!ui.explode));lastAnatomy='';needsRender=true});
$('#anatomy-stage').addEventListener('anatomyselect',e=>{ui.selected=e.detail.id;$('#part-detail').textContent=e.detail.part.name+' · '+e.detail.part.evidence;lastAnatomy='';update(0,true)});
$('#research-open').addEventListener('click',()=>{ui.playing=false;syncPlay();$('#research-dialog').showModal()});$('#research-close').addEventListener('click',()=>$('#research-dialog').close());
$('#research-dialog').insertAdjacentHTML('beforeend','<div class="dialog-links"><a href="webgpu-probe-roadster.html?mode=full" target="_blank">WebGPU 测试重放 ↗</a><a href="quality-comparison.html" target="_blank">画质前后对照 ↗</a><a href="ENGINE-EVALUATION.md" target="_blank">渲染方案与实测记录 ↗</a></div>');
$('#original-open').addEventListener('click',openOriginal);$('#original-close').addEventListener('click',()=>{$('#original-dialog').close();$('#original-player').src=''});$('#original-dialog').addEventListener('close',()=>{$('#original-player').src=''});
$('#film-play').addEventListener('click',startTour);
$('#quality').addEventListener('click',()=>{premium.setQuality(premium.quality==='cinema'?'balanced':'cinema');$('#quality').textContent=premium.quality==='cinema'?'画质 · 精致':'画质 · 流畅';lastShadow='';resize()});
controls.addEventListener('start',()=>{if(ui.view==='test'){ui.camera='free';$$('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera==='free'))}});controls.addEventListener('change',()=>{needsRender=true});
addEventListener('resize',resize);addEventListener('keydown',e=>{if(['INPUT','BUTTON'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;if(e.key===' '){e.preventDefault();play()}if(e.key==='Escape'&&tour)stopTour();if(e.key.toLowerCase()==='r'){ui.camera='director';if(ui.view==='exterior')exteriorCamera();update(0,true)}});
function loop(now){const dt=Math.min(.1,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
 if(!filmMode&&!document.hidden){if(tour){filmSeek(tourTime+dt);if(tourTime>=28)stopTour()}else{if(ui.playing){ui.time=Math.min(duration(),ui.time+dt*ui.speed);if(ui.time>=duration()){ui.playing=false;syncPlay()}}controls.update();update(dt)}}
 frames++;if(now-fpsSince>1000){fps=frames*1000/(now-fpsSince);fpsSince=now;frames=0}requestAnimationFrame(loop)
}
window.__roadsterTest={THREE,scene,renderer,camera,controls,car,premium,vapor,environment:env,ui,seek,setMode,setView,update,sample,getMetrics:()=>({fps,parts:car.parts.length,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,state:sample(),view:ui.view,quality:premium.quality})};
window.__film={ready:true,loaded:()=>true,len:28,start:startTour,step:dt=>filmSeek(tourTime+dt),seek:filmSeek};
window.__lab={renderer,get fps(){return fps},partCount:()=>car.parts.length,get tris(){return renderer.info.render.triangles}};
document.body.dataset.view='exterior';resize();exteriorCamera();update(0,true);$('#loading').remove();document.documentElement.dataset.ready='true';if(filmMode)startTour();requestAnimationFrame(loop);
