import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildCar} from './car-v2.js';
import {buildTestEnvironment} from './test-environment.js';
import {sampleSequence,SEQUENCE_INFO} from './test-sequence.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],params=new URLSearchParams(location.search);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),timecode=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const ui={view:params.get('mode')==='full'||params.get('mode')==='kickflip'?'test':'exterior',mode:params.get('mode')==='kickflip'?'kickflip':'full',time:Math.max(0,Number(params.get('t'))||0),playing:false,speed:1,camera:'wide'};
let renderer,car,environment,scene,camera,controls,report,dirty=true,rendering=false,lastFrame=performance.now(),lastState;
const manual=params.has('manual'),requested=params.get('backend')==='webgl'?'WebGL2':'WebGPU';

async function init(){
  const forceWebGL=requested==='WebGL2'||!navigator.gpu;
  let fallbackReason=requested==='WebGPU'&&!navigator.gpu?'当前上下文未提供 navigator.gpu（需要受支持浏览器及安全上下文）':null;
  renderer=new THREE.WebGPURenderer({antialias:true,forceWebGL});
  try{await renderer.init()}catch(error){
    if(forceWebGL)throw error;
    fallbackReason=String(error);try{renderer.dispose()}catch{}
    renderer=new THREE.WebGPURenderer({antialias:true,forceWebGL:true});await renderer.init();
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  $('#stage').prepend(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color('#080b10');scene.fog=new THREE.FogExp2('#080b10',.003);
  camera=new THREE.PerspectiveCamera(36,1,.05,420);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=3;controls.maxDistance=110;controls.maxPolarAngle=Math.PI*.505;
  controls.addEventListener('change',()=>{dirty=true});controls.addEventListener('start',()=>{ui.camera='free';syncControls()});
  car=buildCar({THREE,GEO:{rbox:(w,h,d,r=.008,seg=2)=>new RoundedBoxGeometry(w,h,d,seg,r),merge:mergeGeometries}});scene.add(car.group);
  for(const item of car.parts)if(item.category==='glass'){const m=item.mesh.material;m.color.set('#060b0d');m.metalness=.05;m.envMapIntensity=.42;m.roughness=.22;m.clearcoat=.4;m.clearcoatRoughness=.2}
  environment=buildTestEnvironment({THREE});environment.ground.scale.set(4,1,4);environment.ground.material.color.set('#070b0e');environment.ground.material.envMapIntensity=.12;scene.add(environment.group);
  const studio=new THREE.Scene();studio.background=new THREE.Color('#10151c');
  for(const [w,h,p,r,c]of [[8,2,[0,5,0],[-Math.PI/2,0,0],2.5],[8,3,[-5,2,5],[0,Math.PI/4,0],1.2],[9,2,[5,3,-5],[0,-Math.PI/4,0],1.8]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(c,c,c),side:THREE.DoubleSide}));m.position.set(...p);m.rotation.set(...r);studio.add(m)}
  const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(studio,.025).texture;scene.environmentIntensity=.52;
  scene.add(new THREE.HemisphereLight(0xbfd4e4,0x12151a,.9));
  for(const [color,intensity,p]of [[0xf4f1e6,2.5,[-8,28,14]],[0x93bbdd,1.7,[10,12,-15]],[0xffffff,.5,[-28,8,10]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...p);scene.add(light)}
  const floodLights=environment.lightAnchors.map(a=>{const light=new THREE.SpotLight(0xc5deea,550,0,.62,.7,1.4);light.position.set(...a.position);light.target.position.set(...a.target);scene.add(light,light.target);return light});
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const cx=shadowCanvas.getContext('2d'),g=cx.createRadialGradient(64,64,3,64,64,64);g.addColorStop(0,'rgba(0,0,0,.82)');g.addColorStop(1,'rgba(0,0,0,0)');cx.fillStyle=g;cx.fillRect(0,0,128,128);
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(6.5,3.2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.011;scene.add(contact);
  const vapor=makeVapor();scene.add(vapor.jets,vapor.mist);
  let adapterInfo=renderer.backend.device?.adapterInfo;
  if(!adapterInfo&&navigator.gpu){try{adapterInfo=(await navigator.gpu.requestAdapter())?.info}catch{}}
  // Class names are minified by the release bundler; Three.js backend flags are stable.
  const backendId=renderer.backend.isWebGPUBackend?'WebGPUBackend':renderer.backend.isWebGLBackend?'WebGLBackend':'UnknownBackend';
  report={three:THREE.REVISION,requested,backend:backendId,backendClassName:renderer.backend.constructor.name,secure:isSecureContext,gpuAPI:!!navigator.gpu,adapter:adapterInfo?{vendor:adapterInfo.vendor,architecture:adapterInfo.architecture,isFallbackAdapter:adapterInfo.isFallbackAdapter}:null,fallbackReason,parts:car.parts.length,customShaderMaterials:0,rendered:false,frames:0,vapor:'instanced camera-facing CanvasTexture quads; standard MeshBasicMaterial; no custom GLSL'};
  scene.traverse(o=>{if(o.material?.isShaderMaterial)report.customShaderMaterials++});
  const applyPose=()=>{
    const s=sampleSequence(ui.time,ui.mode);lastState=s;ui.time=s.time;
    car.update({explode:0,aeroDeploy:0,fanPower:s.contact&&s.position[1]>.5?1:0,dt:0,time:s.time,speed:0,paused:true,showInternal:false});
    if(ui.view==='test'){car.group.position.set(...s.position);car.group.rotation.set(-s.roll,s.yaw,-s.pitch,'YXZ')}else{car.group.position.set(0,0,0);car.group.rotation.set(0,0,0)}
    for(const wheel of car.wheels){wheel.rotation.z=ui.view==='test'?-s.wheelTravel/wheel.userData.radius:0;for(const child of wheel.children)if(child.userData.fixedBrake){child.rotation.z=-wheel.rotation.z;child.position.copy(child.userData.fixedBrake).applyAxisAngle(new THREE.Vector3(0,0,1),-wheel.rotation.z)}}
    environment.ramp.visible=ui.view==='test'&&ui.mode!=='kickflip';environment.fleet.visible=ui.view==='test'&&ui.mode==='kickflip';environment.markings.visible=environment.lights.visible=ui.view==='test';environment.setEdgeMode(s.time>45?'white':'red');floodLights.forEach(light=>light.visible=ui.view==='test');
    car.group.updateMatrixWorld(true);contact.position.x=car.group.position.x;contact.position.z=car.group.position.z;contact.material.opacity=.7*Math.exp(-Math.max(0,car.group.position.y)/7);
    if(ui.camera!=='free')frameCamera(s);
    vapor.update(s,ui.view==='test',camera,car.group);
    syncReadout(s);return s;
  };
  const render=async()=>{if(rendering)return report;rendering=true;dirty=false;try{applyPose();await renderer.renderAsync(scene,camera);report.frames++;report.rendered=true;return report}finally{rendering=false}};
  window.__webgpuProbe={renderer,scene,car,camera,controls,environment,report,ui,render,sample:()=>sampleSequence(ui.time,ui.mode),seek:async t=>{ui.time=clamp(Number(t)||0,0,SEQUENCE_INFO[ui.mode].duration);dirty=true;await render();return lastState},setMode:async mode=>{setMode(mode);await render();return lastState},advance:async dt=>{ui.time=clamp(ui.time+dt,0,SEQUENCE_INFO[ui.mode].duration);dirty=true;await render();return lastState}};
  const resize=()=>{const w=$('#stage').clientWidth,h=$('#stage').clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true};addEventListener('resize',resize);resize();syncControls();await render();$('#loading').classList.add('hidden');
  const actual=report.backend==='WebGPUBackend'?'WebGPU':'WebGL 2';$('#backend').classList.toggle('fallback',actual==='WebGL 2'&&requested==='WebGPU');$('#backend').textContent=`实际后端 ${actual} · ${report.adapter?.vendor||'adapter'} ${report.adapter?.architecture||''} · ${car.parts.length} parts${actual==='WebGL 2'&&requested==='WebGPU'?' · 自动回退':''}`;$('#backend').title=report.fallbackReason||report.backend;
  if(!manual)renderer.setAnimationLoop(async()=>{if(rendering)return;const now=performance.now(),dt=Math.min(.08,(now-lastFrame)/1000);lastFrame=now;controls.update();if(ui.playing){ui.time=Math.min(SEQUENCE_INFO[ui.mode].duration,ui.time+dt*ui.speed);dirty=true;if(ui.time>=SEQUENCE_INFO[ui.mode].duration){ui.playing=false;syncControls()}}if(dirty||ui.playing)await render()});
}

function frameCamera(s){
  const position=new THREE.Vector3(),target=new THREE.Vector3(),p=ui.view==='test'?new THREE.Vector3(...s.position):new THREE.Vector3();
  if(ui.view==='exterior'){position.set(-7.3,2.65,7.1);target.set(0,.52,0);camera.fov=34}
  else if(ui.camera==='chase'){position.copy(p).add(new THREE.Vector3(8,4,-13));target.copy(p).add(new THREE.Vector3(0,.7,0));camera.fov=40}
  else if(ui.mode==='kickflip'){position.set(23,15,-38);target.set(0,4,0);camera.fov=42}
  else{position.set(34,17,-47);target.set(-2,10.2,0);camera.fov=40}
  if(innerWidth<700){const offset=position.clone().sub(target);position.copy(target).addScaledVector(offset,ui.view==='exterior'?1.15:1.3);camera.fov+=4}
  camera.position.copy(position);controls.target.copy(target);camera.lookAt(target);camera.updateProjectionMatrix();
}
function syncControls(){
  $$('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===(ui.view==='exterior'?'exterior':ui.mode)));$$('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===ui.camera));
  $('#play').textContent=ui.playing?'Ⅱ 暂停重放':'▶ 开始重放';$('#speed').textContent=ui.speed+'×';$('#timeline').max=SEQUENCE_INFO[ui.mode].duration;$('#total').textContent=timecode(SEQUENCE_INFO[ui.mode].duration);
  $('#telemetry').classList.toggle('hidden',ui.view==='exterior');$('#phase').classList.toggle('hidden',ui.view==='exterior');$('#hero-label').classList.toggle('hidden',ui.view!=='exterior');
}
function syncReadout(s){
  $('#timeline').value=ui.time;$('#elapsed').textContent=timecode(ui.time);$('#altitude').textContent=Number.isFinite(s.telemetry?.altitudeFt)?s.telemetry.altitudeFt.toFixed(1):'—';$('#angle-label').textContent=ui.mode==='kickflip'?'侧滚姿态':'俯仰姿态';$('#angle').textContent=Math.round((ui.mode==='kickflip'?s.roll:s.pitch)*180/Math.PI)+'°';$('#source-time').textContent=timecode(s.videoTime);$('#phase').textContent=s.phase;
  for(const [id,backend]of [['gpu-link','webgpu'],['gl-link','webgl']]){const q=new URLSearchParams();if(backend==='webgl')q.set('backend','webgl');if(ui.view==='test'){q.set('mode',ui.mode);q.set('t',ui.time.toFixed(2))}$('#'+id).href='?'+q.toString()}
}
function setMode(mode){ui.playing=false;ui.time=0;ui.camera='wide';if(mode==='exterior')ui.view='exterior';else{ui.view='test';ui.mode=mode==='kickflip'?'kickflip':'full'}dirty=true;syncControls()}
$$('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));$$('[data-camera]').forEach(b=>b.addEventListener('click',()=>{ui.camera=b.dataset.camera;dirty=true;syncControls()}));
$('#play').addEventListener('click',()=>{if(ui.view==='exterior')setMode('full');if(ui.time>=SEQUENCE_INFO[ui.mode].duration)ui.time=0;ui.playing=!ui.playing;dirty=true;syncControls()});
$('#restart').addEventListener('click',()=>{ui.time=0;dirty=true});$('#speed').addEventListener('click',()=>{ui.speed=ui.speed===1?.5:ui.speed===.5?.25:1;syncControls()});
$('#timeline').addEventListener('input',event=>{const requestedTime=Number(event.target.value);if(ui.view==='exterior'){ui.view='test';ui.camera='wide'}ui.time=requestedTime;ui.playing=false;dirty=true;syncControls()});
addEventListener('keydown',event=>{if(event.code==='Space'&&!['INPUT','BUTTON','A'].includes(document.activeElement?.tagName)){event.preventDefault();$('#play').click()}});

function makeVapor(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,.85)');gradient.addColorStop(.34,'rgba(240,248,255,.48)');gradient.addColorStop(1,'rgba(240,248,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(canvas),geometry=new THREE.PlaneGeometry(1,1);
  const create=count=>{const material=new THREE.MeshBasicMaterial({color:0xd8e7ef,map:texture,transparent:true,opacity:.1,depthWrite:false,side:THREE.DoubleSide});const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.frustumCulled=false;mesh.renderOrder=6;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);return mesh};
  const jets=create(160),mist=create(96),dummy=new THREE.Object3D(),point=new THREE.Vector3(),localJets=[[-.92,.19,-.72],[-.92,.19,.72],[1.02,.19,-.72],[1.02,.19,.72]];
  return {jets,mist,update(s,visible,camera,vehicle){
    const power=visible?s.plumePower:0,groundMist=visible?(s.groundMist||0):0;jets.visible=power>.003;mist.visible=groundMist>.003;jets.material.opacity=power*.13;mist.material.opacity=groundMist*.12;
    if(jets.visible){for(let i=0;i<jets.count;i++){const age=(i*.61803398875+s.time*1.32)%1,a=i*2.399963,r=(.025+age*age*.75)*((i*.3727)%1),j=localJets[i%4],length=.3+age*(3.1+power*3.4);point.set(j[0]+Math.cos(a)*r,j[1]-length,j[2]+Math.sin(a)*r).applyMatrix4(vehicle.matrixWorld);dummy.position.copy(point);dummy.quaternion.copy(camera.quaternion);dummy.scale.setScalar((.2+age*1.1)*Math.sin(Math.PI*age));dummy.updateMatrix();jets.setMatrixAt(i,dummy.matrix)}jets.instanceMatrix.needsUpdate=true}
    if(mist.visible){for(let i=0;i<mist.count;i++){const age=(i*.61803398875+s.time*.25)%1,a=i*2.399963,r=Math.sqrt((i*.713)%1)*(3+age*6);dummy.position.set(s.position[0]+Math.cos(a)*r,.16+(1-age)*(.3+((i*.417)%1)*1.6),Math.sin(a)*r*.6);dummy.quaternion.copy(camera.quaternion);dummy.scale.setScalar((1.5+age*3)*Math.sin(Math.PI*age));dummy.updateMatrix();mist.setMatrixAt(i,dummy.matrix)}mist.instanceMatrix.needsUpdate=true}
  }};
}
init().catch(error=>{$('#loading').textContent=`图形后端初始化失败：${error.message}。可尝试顶部 WebGL 2 入口。`;window.__webgpuProbeError=String(error);console.error(error)});
