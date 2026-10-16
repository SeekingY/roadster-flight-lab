import { TRACK, KICKFLIP_COURSE, createTrackSamples, sampleTrack } from './test-sequence.js';

/**
 * The dark outdoor test venue observed in Tesla's event video.
 * Dimensions other than TRACK are visual staging estimates, not survey data.
 * The driving face is precisely sampleTrack(s,z); its outward normal points
 * toward the car. A 170-degree C and a short terminal, never a closed loop.
 *
 * API: buildTestEnvironment({THREE}) returns group, ramp, fleet, ground,
 * markings, lights (fixture geometry only), lightAnchors, rampSurface,
 * materials, setRampOpacity(value), setEdgeMode('red'|'white'), dispose().
 * All dimensions are metres, Y up. The root application owns scene lighting.
 */
export function buildTestEnvironment({ THREE }) {
  if (!THREE) throw new Error('buildTestEnvironment requires THREE');
  const group = new THREE.Group(); group.name = 'Roadster · observed night test venue';
  const ramp = new THREE.Group(); ramp.name = '170-degree open C ramp';
  const fleet = new THREE.Group(); fleet.name = 'Kickflip obstacle fleet · visual estimate';
  const markings = new THREE.Group(); markings.name = 'Flat approach markings';
  const lights = new THREE.Group(); lights.name = 'Test lamps · fixture geometry';
  group.add(ramp, fleet, markings, lights);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const buckets = new Map();
  const V = a => new THREE.Vector3(...a);
  const keep = g => (geometries.add(g),g);
  const mat = options => { const m=new THREE.MeshStandardMaterial(options);materials.add(m);return m; };
  const glow = (color,intensity=1.8) => mat({color,emissive:color,emissiveIntensity:intensity,roughness:.5,metalness:0,toneMapped:false});
  const steel = mat({color:'#30373d',roughness:.62,metalness:.74});
  const edgeSteel = mat({color:'#414a50',roughness:.62,metalness:.65});
  const underside = mat({color:'#373d42',roughness:.93,metalness:.12});
  const rubber = mat({color:'#101519',roughness:.91,metalness:0});
  const glass = mat({color:'#121e25',roughness:.19,metalness:.56});
  const chrome = mat({color:'#8c969c',roughness:.38,metalness:.83});
  const linePaint = mat({color:'#bdc8c9',roughness:.85,metalness:.02});
  const redLED = glow('#ea3c32',2.4), whiteLED=glow('#c8ebf0',1.7), lampLED=glow('#eaf7ff',2.1);
  let seed=73121;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function asphaltTexture(){
    const size=128,data=new Uint8Array(size*size*4);
    for(let i=0;i<size*size;i++){
      const value=205+Math.floor(random()*42),o=i*4;
      data[o]=value;data[o+1]=value;data[o+2]=value;data[o+3]=255;
    }
    const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps=true;texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
    textures.add(texture);return texture;
  }
  const asphalt=asphaltTexture();
  const roadMaterial=mat({color:'#69747a',roughness:.91,metalness:.025,map:asphalt,bumpMap:asphalt,bumpScale:.006});
  const groundMaterial=mat({color:'#151b20',roughness:.86,metalness:.025,map:asphalt,bumpMap:asphalt,bumpScale:.004});

  function addMesh(target,geometry,material,name,{cast=true,receive=true}={}){
    const mesh=new THREE.Mesh(keep(geometry),material);mesh.name=name;mesh.castShadow=cast;mesh.receiveShadow=receive;target.add(mesh);return mesh;
  }
  function batch(target,geometry,material){
    if(!buckets.has(target))buckets.set(target,new Map());
    const byMaterial=buckets.get(target);
    if(!byMaterial.has(material))byMaterial.set(material,[]);
    byMaterial.get(material).push(geometry);
  }
  function merge(list){
    const positions=[],normals=[],uvs=[];
    for(const original of list){
      const g=original.index?original.toNonIndexed():original;
      if(!g.attributes.normal)g.computeVertexNormals();
      const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
      for(let i=0;i<p.count;i++){
        positions.push(p.getX(i),p.getY(i),p.getZ(i));
        normals.push(n.getX(i),n.getY(i),n.getZ(i));uvs.push(uv?.getX(i)||0,uv?.getY(i)||0);
      }
      if(g!==original)g.dispose();original.dispose();
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    return geometry;
  }
  function box(target,size,position,material,rotation=null){
    const g=new THREE.BoxGeometry(...size);
    if(rotation)g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
    g.translate(...position);batch(target,g,material);
  }
  function beam(target,a,b,width,material=steel){
    const delta=V(b).sub(V(a)),length=delta.length();if(length<.001)return;
    const g=new THREE.BoxGeometry(width,length,width);
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    g.applyQuaternion(q);g.translate(...V(a).add(V(b)).multiplyScalar(.5).toArray());batch(target,g,material);
  }

  const samples=createTrackSamples(300);
  const offsetPoint=(sample,z,depth=0)=>[
    sample.position[0]+sample.normal[0]*depth,
    sample.position[1]+sample.normal[1]*depth,z
  ];
  // Samples increase in the driving direction. tangent × width(+Z) = normal.
  function ribbon(z0,z1,depth=0,{back=false,from=-TRACK.entryLength,to=TRACK.maxS}={}){
    const filtered=samples.filter(s=>s.s>=from&&s.s<=to);
    if(!filtered.length||filtered[0].s>from+.00001)filtered.unshift(sampleTrack(from));
    if(filtered.at(-1).s<to-.00001)filtered.push(sampleTrack(to));
    const positions=[],normals=[],uvs=[],indices=[];
    for(const sample of filtered){
      for(const z of [z0,z1]){
        positions.push(...offsetPoint(sample,z,depth));
        normals.push(...sample.normal.map(x=>back?-x:x));uvs.push(z/2,sample.s/2);
      }
    }
    for(let i=0;i<filtered.length-1;i++){
      const a=2*i,b=a+2;
      if(back)indices.push(a,a+1,b,a+1,b+1,b);else indices.push(a,b,a+1,a+1,b,b+1);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);
    return g;
  }
  function surfaceQuad(points,normal){
    const positions=points.flat(),indices=[0,1,2,0,2,3];
    const n=V(points[1]).sub(V(points[0])).cross(V(points[2]).sub(V(points[0])));
    if(n.dot(V(normal))<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  const half=TRACK.width/2;
  const rampSurface=addMesh(ramp,ribbon(-half,half),roadMaterial,'Driving face · shared trajectory surface');
  rampSurface.userData={surface:'sampleTrack(s,z)',normal:'sampleTrack(s).normal',provenance:TRACK.provenance};
  addMesh(ramp,ribbon(-half,half,-TRACK.surfaceThickness,{back:true}),underside,'Continuous structural underside');
  for(const sign of [-1,1])for(let i=0;i<samples.length-1;i++){
    const a=samples[i],b=samples[i+1],z=sign*half;
    batch(ramp,surfaceQuad([offsetPoint(a,z),offsetPoint(b,z),offsetPoint(b,z,-TRACK.surfaceThickness),offsetPoint(a,z,-TRACK.surfaceThickness)],[0,0,sign]),edgeSteel);
  }
  for(const sample of [samples[0],samples.at(-1)]){
    const normal=sample.tangent.map(v=>sample===samples[0]?-v:v);
    batch(ramp,surfaceQuad([offsetPoint(sample,-half),offsetPoint(sample,half),offsetPoint(sample,half,-TRACK.surfaceThickness),offsetPoint(sample,-half,-TRACK.surfaceThickness)],normal),edgeSteel);
  }
  addMesh(ramp,ribbon(-.035,.035,.009),linePaint,'White track centreline',{cast:false});
  // Red and white edge channels occupy distinct real strips, not a light halo.
  const redStrips=[],whiteStrips=[];
  for(const sign of [-1,1]){
    const z=sign*(half-.025);
    redStrips.push(addMesh(ramp,ribbon(z-.016,z+.016,.013),redLED,`${sign<0?'Left':'Right'} red edge LED`,{cast:false,receive:false}));
    const wz=sign*(half-.082);
    whiteStrips.push(addMesh(ramp,ribbon(wz-.009,wz+.009,.012),whiteLED,`${sign<0?'Left':'Right'} white edge LED`,{cast:false,receive:false}));
  }
  // Sparse panel joints are shallow real strips across the roadway.
  const jointMaterial=mat({color:'#3c464d',roughness:.94,metalness:.03});
  for(let s=1.8;s<TRACK.maxS;s+=2.3)batch(ramp,ribbon(-half+.1,half-.1,.002,{from:s-.008,to:s+.008}),jointMaterial);

  // Two curved Warren trusses stay entirely behind the road's driving face.
  const trussSamples=[];
  for(let s=2.8;s<TRACK.maxS;s+=1.75)trussSamples.push(sampleTrack(s));
  trussSamples.push(sampleTrack(TRACK.maxS));
  const supportPoints=[];
  for(const sign of [-1,1]){
    const z=sign*(half+.06),near=[],far=[];
    for(const sample of trussSamples){
      const a=offsetPoint(sample,z,-TRACK.surfaceThickness-.11);
      const b=offsetPoint(sample,z,-1.24);
      // At the foot only, the rear chord terminates on its foundation pad.
      a[1]=Math.max(.075,a[1]);b[1]=Math.max(.075,b[1]);near.push(a);far.push(b);
    }
    for(let i=0;i<near.length-1;i++){
      beam(ramp,near[i],near[i+1],.09);beam(ramp,far[i],far[i+1],.10);
      beam(ramp,near[i],far[i],.075);
      beam(ramp,i%2?far[i]:near[i],i%2?near[i+1]:far[i+1],.064);
    }
    beam(ramp,near.at(-1),far.at(-1),.075);
    supportPoints.push(...far);
    box(ramp,[1.8,.10,.48],[far[0][0],.015,z],steel);
  }
  for(let i=0;i<trussSamples.length;i+=2){
    const sample=trussSamples[i],a=offsetPoint(sample,-half-.06,-1.24),b=offsetPoint(sample,half+.06,-1.24);
    a[1]=b[1]=Math.max(.075,a[1]);beam(ramp,a,b,.075);
    if(i+2<trussSamples.length){const c=offsetPoint(trussSamples[i+2],half+.06,-1.24);c[1]=Math.max(.075,c[1]);beam(ramp,a,c,.052);}
  }
  // Low foundation outriggers give the freestanding structure visible footing.
  for(const sign of [-1,1]){
    const first=trussSamples[0],a=offsetPoint(first,sign*(half+.06),-.6);a[1]=.14;
    beam(ramp,a,[a[0]-1.1,.14,sign*3.15],.12);
    box(ramp,[.68,.12,.55],[a[0]-1.1,.025,sign*3.15],underside);
  }

  const groundGeometry=new THREE.PlaneGeometry(140,100);groundGeometry.rotateX(-Math.PI/2);groundGeometry.translate(3,-.035,0);
  const groundUV=groundGeometry.attributes.uv;for(let i=0;i<groundUV.count;i++)groundUV.setXY(i,groundUV.getX(i)*70,groundUV.getY(i)*50);
  const ground=addMesh(group,groundGeometry,groundMaterial,'Subtle asphalt apron',{cast:false});
  box(markings,[100,.006,.075],[0,.003,0],linePaint);
  for(const z of [-4.35,4.35]){
    box(markings,[100,.025,.025],[0,.018,z],redLED);
    for(let x=-45;x<=45;x+=7.5){
      box(markings,[.075,.82,.075],[x,.41,z+.1*Math.sign(z)],steel);
      box(markings,[.018,.65,.018],[x,.43,z+.04*Math.sign(z)],redLED);
    }
  }

  // Reference fleet: restrained abstract Tesla silhouettes, not claimed CAD.
  // These are transverse obstacles: local -X noses become world +Z noses.
  const obstacleX=KICKFLIP_COURSE?.obstaclePlaneX??0;
  const fleetEntries=[];
  function vehicleTransform(z){const m=new THREE.Matrix4().makeRotationY(Math.PI/2);m.setPosition(obstacleX,0,z);return m;}
  function vehicleGeo(g,m,material){g.applyMatrix4(m);batch(fleet,g,material);}
  function profileSolid(sections){
    const p=[],ix=[];
    for(const [x,halfWidth,bottom,top]of sections)p.push(x,bottom,-halfWidth,x,top,-halfWidth,x,top,halfWidth,x,bottom,halfWidth);
    for(let i=0;i<sections.length-1;i++)for(let j=0;j<4;j++){const a=i*4+j,b=(i+1)*4+j,c=(i+1)*4+(j+1)%4,d=i*4+(j+1)%4;ix.push(a,b,d,b,c,d);}
    ix.push(0,1,2,0,2,3);const e=(sections.length-1)*4;ix.push(e,e+2,e+1,e,e+3,e+2);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);
    // Signed volume chooses the outward orientation for this closed loft.
    let volume=0;for(let i=0;i<ix.length;i+=3){const a=V(p.slice(ix[i]*3,ix[i]*3+3)),b=V(p.slice(ix[i+1]*3,ix[i+1]*3+3)),c=V(p.slice(ix[i+2]*3,ix[i+2]*3+3));volume+=a.dot(b.cross(c));}
    if(volume<0)for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];
    g.setIndex(ix);g.computeVertexNormals();return g;
  }
  function wheel(m,x,z,r=.335,width=.18){
    const tire=new THREE.CylinderGeometry(r,r,width,18,1);tire.rotateX(Math.PI/2);tire.translate(x,r,z);vehicleGeo(tire,m,rubber);
    const rim=new THREE.CylinderGeometry(r*.64,r*.64,width+.012,12,1);rim.rotateX(Math.PI/2);rim.translate(x,r,z);vehicleGeo(rim,m,chrome);
    const cap=new THREE.CylinderGeometry(r*.35,r*.35,width+.018,12,1);cap.rotateX(Math.PI/2);cap.translate(x,r,z);vehicleGeo(cap,m,steel);
  }
  function car(z,color,name,{length=4.75,width=1.91,height=1.43}={}){
    const m=vehicleTransform(z),paint=mat({color,roughness:.27,metalness:.35});
    const l=length/2,w=width/2;
    vehicleGeo(profileSolid([[-l,w*.72,.29,.53],[-l*.84,w*.96,.25,.66],[-l*.38,w,.25,.75],[l*.34,w,.27,.76],[l*.85,w*.94,.29,.70],[l,w*.78,.34,.57]]),m,paint);
    vehicleGeo(profileSolid([[-l*.56,w*.76,.69,.73],[-l*.22,w*.71,.72,height],[l*.37,w*.69,.73,height*.98],[l*.70,w*.72,.69,.76]]),m,glass);
    // Body-colour pillars and rocker give a readable car rather than a dark block.
    for(const sign of[-1,1]){
      const sill=new THREE.BoxGeometry(length*.70,.11,.045).translate(.02,.31,sign*(w+.009));vehicleGeo(sill,m,steel);
      const pillar=new THREE.BoxGeometry(.055,height-.72,.035).translate(.25,(height+.72)/2,sign*w*.71);vehicleGeo(pillar,m,paint);
      for(const x of[-length*.29,length*.30])wheel(m,x,sign*(w-.02));
    }
    vehicleGeo(new THREE.BoxGeometry(.026,.035,width*.70).translate(-l-.005,.55,0),m,whiteLED);
    vehicleGeo(new THREE.BoxGeometry(.026,.035,width*.75).translate(l+.005,.57,0),m,redLED);
    vehicleGeo(new THREE.BoxGeometry(.02,.14,width*.61).translate(-l-.014,.36,0),m,rubber);
    fleetEntries.push({name,position:[obstacleX,0,z],yaw:Math.PI/2,estimatedDimensions:[length,width,height]});
  }
  car(-12,'#aeb9bf','Silver sedan · reference fleet');
  car(-6.7,'#8d242b','Red sedan · reference fleet',{length:4.95,width:1.98,height:1.47});
  car(-1.4,'#1c5b75','Blue sedan · reference fleet');
  car(3.9,'#9d8c5b','Champagne crossover · reference fleet',{length:4.78,width:1.97,height:1.66});
  {
    const z=10.7,m=vehicleTransform(z),paint=mat({color:'#e3e8e5',roughness:.30,metalness:.15});
    vehicleGeo(profileSolid([[-3.45,.91,.60,1.48],[-3.14,1.10,.48,2.38],[-2.27,1.19,.45,3.70],[.32,1.22,.45,3.87],[.94,1.20,.47,3.59],[1.07,1.18,.48,.97]]),m,paint);
    vehicleGeo(new THREE.BoxGeometry(3.9,.31,1.88).translate(1.15,.64,0),m,steel);
    vehicleGeo(surfaceQuad([[-3.05,2.25,-1.01],[-3.05,2.25,1.01],[-2.29,3.28,1.09],[-2.29,3.28,-1.09]],[-1,.6,0]),m,glass);
    for(const sign of[-1,1]){
      vehicleGeo(surfaceQuad([[-2.94,2.26,sign*1.151],[-2.20,3.28,sign*1.205],[-.45,3.23,sign*1.231],[-.48,2.22,sign*1.231]],[0,0,sign]),m,glass);
      for(const x of[-2.57,1.72,2.71])wheel(m,x,sign*1.12,.50,.27);
      vehicleGeo(new THREE.BoxGeometry(1.3,.14,.25).translate(-.72,.49,sign*1.20),m,chrome);
      vehicleGeo(new THREE.BoxGeometry(.055,.22,.19).translate(-2.2,2.38,sign*1.35),m,steel);
    }
    vehicleGeo(new THREE.BoxGeometry(.045,.09,1.80).translate(-3.46,.96,0),m,whiteLED);
    vehicleGeo(new THREE.BoxGeometry(.035,.35,1.57).translate(-3.47,.66,0),m,rubber);
    fleetEntries.push({name:'White Tesla Semi silhouette · no trailer',position:[obstacleX,0,z],yaw:Math.PI/2,estimatedDimensions:[6.9,2.7,3.9]});
  }
  fleet.userData={obstaclePlaneX:obstacleX,corridorZ:KICKFLIP_COURSE?.corridorZ??0,entries:fleetEntries,provenance:'车型与相对排列根据公开远景简化；非车辆CAD、非实测场地。'};

  const lightAnchors=[
    {position:[20,7.5,-13],target:[4,1,0],kind:'flood'},
    {position:[-19,7,13],target:[-3,5,0],kind:'flood'},
    {position:[35,5.7,12],target:[18,1,0],kind:'flood'}
  ];
  for(const {position:p}of lightAnchors){
    beam(lights,[p[0],0,p[2]],p,.115,steel);
    box(lights,[1.15,.09,1.15],[p[0],.035,p[2]],underside);
    box(lights,[1.75,.12,.14],[p[0],p[1],p[2]],steel);
    for(const dx of[-.58,0,.58]){
      box(lights,[.42,.27,.18],[p[0]+dx,p[1],p[2]],steel);
      box(lights,[.35,.20,.015],[p[0]+dx,p[1]-.035,p[2]+(p[2]>0?-.102:.102)],lampLED);
    }
  }
  for(const [target,byMaterial]of buckets)for(const [material,list]of byMaterial){
    const emissive=material.emissive?.getHex()!==0;
    addMesh(target,merge(list),material,`${target.name} · ${emissive?'emissive detail':'batched structure'}`,{cast:!emissive,receive:!emissive});
  }
  fleet.visible=false;
  const rampMaterials=new Map();ramp.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])rampMaterials.set(m,{opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite});});
  // Ramp shares some materials with the ground/fleet. Clone its materials before
  // fading so the root can soften the venue without fading other scene objects.
  const rampClones=new Map();ramp.traverse(o=>{if(!o.isMesh)return;const original=o.material;if(!rampClones.has(original)){const clone=original.clone();materials.add(clone);rampClones.set(original,clone);}o.material=rampClones.get(original);});
  let drawCalls=0,triangleCount=0;group.traverse(o=>{if(o.isMesh){drawCalls++;triangleCount+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  group.userData={provenance:'参考官方视频665/670/680/712/715/935/950秒截图；结构尺度为视觉估计。',drawCalls,triangleCount,trackHeight:TRACK.height,trackWidth:TRACK.width};
  function setRampOpacity(value=1){
    const opacity=Math.max(0,Math.min(1,Number(value)||0));ramp.visible=opacity>.005;
    for(const material of rampClones.values()){material.opacity=opacity;material.transparent=opacity<.999;material.depthWrite=opacity>.95;}
  }
  function setEdgeMode(mode='red'){
    const red=rampClones.get(redLED),white=rampClones.get(whiteLED);
    if(red)red.emissiveIntensity=mode==='white'?.32:2.4;
    if(white)white.emissiveIntensity=mode==='white'?2.7:.65;
  }
  setEdgeMode('red');
  function dispose(){for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();group.removeFromParent();}
  return {group,ramp,fleet,ground,markings,lights,lightAnchors,rampSurface,samples,fleetEntries,materials:[...materials],setRampOpacity,setEdgeMode,dispose,stats:group.userData};
}
