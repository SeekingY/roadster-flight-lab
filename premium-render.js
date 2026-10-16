import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {Reflector} from 'three/addons/objects/Reflector.js';

// Product photography setup. All textures are generated locally; no HDRI fetches.
export function createPremiumRender({renderer,scene,camera,car}){
  RectAreaLightUniformsLib.init();
  const lights=new THREE.Group();scene.add(lights);
  const area=(color,power,w,h,pos,target)=>{const l=new THREE.RectAreaLight(color,power,w,h);l.position.set(...pos);l.lookAt(...target);lights.add(l);return l};
  area(0xf4f1e6,3.6,7,2,[5,5,1],[7,.3,0]);
  area(0xc7e3ff,5,6,1,[8,2.3,-4],[7,.6,0]);
  area(0xffe8d2,2.4,3,3,[2,1.6,3],[6,.4,0]);
  area(0xe0f0ff,4,5,.5,[10,3.5,3],[7,.7,0]);

  const room=new THREE.Scene();room.background=new THREE.Color('#151a20');
  const panel=(w,h,pos,target,power,color)=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide}));mesh.position.set(...pos);mesh.lookAt(...target);room.add(mesh)};
  panel(9,1.6,[0,5,0],[0,0,0],2.6,0xfff5e9);
  panel(8,1.4,[3,2.2,-5],[0,.7,0],3,0xd2e9ff);
  panel(3,4,[-5,2,2],[0,1,0],1.7,0xffe7ce);
  panel(5,.6,[3,3.5,4],[0,1,0],2.7,0xf1f7ff);
  // Black flags give glass and clearcoat a defined dark edge.
  panel(2,5,[-3,2,-3],[0,1,0],.02,0xffffff);
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.025).texture;
  room.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}});pmrem.dispose();
  scene.environment=environment;

  const floorShader={
    uniforms:{tDiffuse:{value:null},color:{value:new THREE.Color()},textureMatrix:{value:new THREE.Matrix4()},uResolution:{value:new THREE.Vector2(1024,768)},uStrength:{value:.25}},
    vertexShader:`uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 vWorld;void main(){vUv=textureMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 uResolution;uniform float uStrength;varying vec4 vUv;varying vec3 vWorld;
    float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){vec2 uv=vUv.xy/vUv.w;vec3 reflected=vec3(0.);float blur=2.3+length(vWorld.xz-vec2(7.,0.))*.22;for(int i=0;i<9;i++){float a=float(i)*2.39996;vec2 d=vec2(cos(a),sin(a))*sqrt(float(i)/8.)*blur/uResolution;reflected+=texture2D(tDiffuse,uv+d).rgb;}reflected/=9.;float distance=length(vWorld.xz-vec2(7.,0.));float fade=exp(-pow(length((vWorld.xz-vec2(7.,0.))*vec2(.13,.20)),2.));vec3 base=vec3(.012,.017,.022)+(hash(vWorld.xz*140.)-.5)*.0008;gl_FragColor=vec4(base+reflected*uStrength*fade,exp(-distance*distance*.025));}`
  };
  const floor=new Reflector(new THREE.PlaneGeometry(80,80),{textureWidth:1024,textureHeight:768,multisample:0,clipBias:.0001,shader:floorShader});
  floor.rotation.x=-Math.PI/2;floor.position.set(7,-.026,0);floor.material.toneMapped=false;floor.material.transparent=true;floor.material.depthWrite=false;floor.renderOrder=-1;scene.add(floor);
  const reflect=floor.onBeforeRender;
  floor.onBeforeRender=function(r,s,c,...args){if(s.overrideMaterial)return;const hidden=[];s.traverse(o=>{if(o.visible&&o.userData.noReflection){hidden.push(o);o.visible=false}});reflect.call(this,r,s,c,...args);hidden.forEach(o=>o.visible=true)};

  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
  const composer=new EffectComposer(renderer,target);
  composer.addPass(new RenderPass(scene,camera));
  const ao=new GTAOPass(scene,camera,512,512,undefined,{radius:.24,distanceExponent:1.6,thickness:.18,samples:12},{radius:5,rings:2,samples:12});
  const hideAo=ao.overrideVisibility.bind(ao);
  ao.overrideVisibility=()=>{hideAo();scene.traverse(o=>{if(o.isMesh&&o.material?.transparent)o.visible=false})};
  ao.blendIntensity=.42;composer.addPass(ao);
  const bloom=new UnrealBloomPass(new THREE.Vector2(512,512),.16,.38,1.35);composer.addPass(bloom);
  const grade=new ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float lum=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(lum),c,.93);c*=mix(vec3(.95,.99,1.035),vec3(1.025,1.003,.97),smoothstep(.02,.9,lum));gl_FragColor=vec4(c,1.);}`});composer.addPass(grade);composer.addPass(new OutputPass());
  let quality='cinema',view='exterior';
  const resize=(w,h)=>{const dpr=Math.min(devicePixelRatio,quality==='cinema'?1.75:1.25);renderer.setPixelRatio(dpr);renderer.setSize(w,h);composer.setPixelRatio(dpr);composer.setSize(w,h);const rw=Math.min(1536,Math.round(w*dpr*.65)),rh=Math.min(1024,Math.round(h*dpr*.65));floor.getRenderTarget().setSize(rw,rh);floor.material.uniforms.uResolution.value.set(rw,rh)};
  function setQuality(value){quality=value;ao.enabled=value==='cinema';bloom.enabled=value==='cinema';floor.visible=view==='exterior'&&value==='cinema';resize(renderer.domElement.clientWidth,renderer.domElement.clientHeight)}
  function setView(value){view=value;lights.visible=value==='exterior';floor.visible=value==='exterior'&&quality==='cinema';scene.fog.density=value==='exterior'?.012:.0055;scene.environmentIntensity=value==='exterior'?.42:.23;ao.blendIntensity=value==='exterior'?.42:.24;ao.updateGtaoMaterial({radius:value==='exterior'?.24:.7,thickness:value==='exterior'?.18:.55});bloom.strength=value==='exterior'?.11:.18}
  const render=()=>{if(ao.enabled){ao.overrideVisibility();ao.renderOverride(renderer,ao.normalMaterial,ao.normalRenderTarget,0x7777ff,1);ao.restoreVisibility();ao._renderGBuffer=false}composer.render()};
  return {render,resize,setQuality,setView,composer,ao,bloom,floor,lights,environment,get quality(){return quality}};
}
