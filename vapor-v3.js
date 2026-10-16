import * as THREE from 'three';

// Deterministic billboard density, not a CFD claim. Historical nozzle poses
// keep the wake in world space when the car rolls or translates.
export function createVapor({scene,sampleSequence}){
  const jets=2600,mist=1700,total=jets+mist;
  const positions=new Float32Array(total*3),sizes=new Float32Array(total),alphas=new Float32Array(total),seeds=new Float32Array(total),ages=new Float32Array(total);
  for(let i=0;i<total;i++)seeds[i]=(i*.61803398875)%1;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));geometry.setAttribute('aAlpha',new THREE.BufferAttribute(alphas,1));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));geometry.setAttribute('aAge',new THREE.BufferAttribute(ages,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.NormalBlending,uniforms:{uScale:{value:600},uTime:{value:0},uDepth:{value:null},uDepthEnabled:{value:0},uResolution:{value:new THREE.Vector2(1,1)},uNear:{value:.05},uFar:{value:240}},
    vertexShader:'attribute float aSize;attribute float aAlpha;attribute float aSeed;attribute float aAge;uniform float uScale;varying float vAlpha;varying float vSeed;varying float vAge;varying float vViewZ;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(190.,aSize*uScale/max(.3,-mv.z));vAlpha=aAlpha;vSeed=aSeed;vAge=aAge;vViewZ=mv.z;}',
    fragmentShader:`#include <packing>
    varying float vAlpha;varying float vSeed;varying float vAge;varying float vViewZ;uniform float uTime;uniform sampler2D uDepth;uniform float uDepthEnabled;uniform vec2 uResolution;uniform float uNear;uniform float uFar;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    void main(){vec2 p=gl_PointCoord*2.-1.;float a=vSeed*6.283; p=mat2(cos(a),sin(a),-sin(a),cos(a))*p;float r=dot(p,p);float n=noise(p*3.1+vSeed*31.+vec2(uTime*.17,0.))*.65+noise(p*7.7+vSeed*17.)*.25+noise(p*17.1)*.1;float density=pow(max(0.,1.-r),2.)*smoothstep(.18,.7,n);float sceneZ=perspectiveDepthToViewZ(texture2D(uDepth,gl_FragCoord.xy/uResolution).x,uNear,uFar);float soft=mix(1.,clamp((vViewZ-sceneZ)*1.6,0.,1.),uDepthEnabled);float light=mix(.57,.95,.5+.5*p.y);vec3 c=vec3(.71,.79,.83)*light;gl_FragColor=vec4(c,density*vAlpha*soft);}`});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;points.renderOrder=6;scene.add(points);
  const nozzles=[[-.92,.19,-.72],[-.92,.19,.72],[1.02,.19,-.72],[1.02,.19,.72]],pos=new THREE.Vector3(),vel=new THREE.Vector3();
  const history=Array.from({length:64},()=>({p:new THREE.Vector3(),q:new THREE.Quaternion()})),euler=new THREE.Euler(0,0,0,'YXZ');
  function update(s,mode,active){const power=active?s.plumePower:0,ground=active?(s.groundMist||0):0;points.visible=power>.003||ground>.003;if(!points.visible)return;
    for(let i=0;i<64;i++){const previous=sampleSequence(Math.max(0,s.time-i/63*.28),mode);history[i].p.set(...previous.position);history[i].power=previous.plumePower;euler.set(-previous.roll,previous.yaw,-previous.pitch);history[i].q.setFromEuler(euler)}
    for(let i=0;i<jets;i++){const seed=seeds[i],age=(seed+s.time*3.57)%1,h=history[Math.min(63,Math.floor(age*63))],angle=i*2.399963,r=Math.sqrt((i*.3727)%1)*(.018+age*age*.7);pos.set(...nozzles[i%4]).applyQuaternion(h.q).add(h.p);vel.set(Math.cos(angle)*r,-age*(3.8+power*4.3),Math.sin(angle)*r).applyQuaternion(h.q);pos.add(vel);pos.x+=Math.sin(i*.37+age*9.)*age*.22;pos.z+=Math.cos(i*.29+age*7.)*age*.2;positions.set(pos.toArray(),i*3);sizes[i]=.12+age*age*1.22;alphas[i]=power*h.power*.17*Math.sin(Math.PI*age)*(.4+.6*(1-age));ages[i]=age;}
    for(let i=0;i<mist;i++){const k=jets+i,age=(seeds[k]+s.time*.42)%1,angle=i*2.399963,r=Math.sqrt((i*.713)%1)*(1.8+age*6.5),h=history[Math.min(63,Math.floor(age*63))];positions[k*3]=h.p.x+Math.cos(angle)*r;positions[k*3+1]=.2+(1-age)*(.5+((i*.417)%1)*1.4);positions[k*3+2]=h.p.z+Math.sin(angle)*r*.65;sizes[k]=1.2+age*3.1;alphas[k]=ground*.10*Math.sin(Math.PI*age);ages[k]=age;}
    material.uniforms.uTime.value=s.time;for(const name of ['position','aSize','aAlpha','aAge'])geometry.attributes[name].needsUpdate=true;
  }
  return {points,material,update,resize:(h,w,dpr=1)=>{material.uniforms.uScale.value=h*dpr/2/Math.tan(18*Math.PI/180);material.uniforms.uResolution.value.set(w*dpr,h*dpr)},count:total};
}
