/* Anatomy view of the SAME vehicle mesh used by the Three.js scene.
 * No replacement vehicle, guessed internals, or extra mechanical components.
 * World convention: metres, Y up, -X forward. Projection only changes the view.
 * Surface sorting is a painter approximation, not an engineering clearance audit.
 */
export function createAnatomy({ THREE, container, car }) {
  if (!THREE || !container || !car?.group) throw new Error('Anatomy needs THREE, a container and the shared car.');
  const NS = 'http://www.w3.org/2000/svg';
  const W = 1200, H = 730;
  const eye = new THREE.Vector3(-6, 4, 6).normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(eye).normalize();
  const up = eye.clone().cross(right).normalize();
  const normalMatrix = new THREE.Matrix3();
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const cache = new Map(), poseCache = new Map(), seen = new Set();
  let destroyed = false, lastKey = '', lastTime = -Infinity, pending = null, timer = 0, projectionCache = null;
  const wrapper = document.createElement('div');
  wrapper.className = 'anatomy-figure';
  wrapper.innerHTML = `<style>
    .anatomy-figure{position:relative;display:flex;flex-direction:column;width:100%;height:100%;min-height:330px;overflow:hidden;border-radius:inherit;background:radial-gradient(ellipse at 52% 40%,#252a2c 0,#15191b 58%,#111517 100%);color:#d6d9d6;font-family:inherit}
    .anatomy-figure .anatomy-top,.anatomy-figure .anatomy-bottom{display:flex;justify-content:space-between;gap:16px;padding:22px 27px;z-index:1;font-size:11px;line-height:1.6;letter-spacing:.08em;flex-shrink:0}
    .anatomy-figure .anatomy-top{color:#b7bcb9;border-bottom:1px solid #ffffff09}
    .anatomy-figure .anatomy-number{color:#d7ba88}
    .anatomy-figure .anatomy-bottom{color:#858d8b;letter-spacing:.02em;padding-top:13px;padding-bottom:18px}
    .anatomy-figure .anatomy-readout{text-align:right;white-space:nowrap;color:#c4c7bd}
    .anatomy-figure svg{width:100%;height:100%;min-height:240px;flex:1;display:block;overflow:visible;outline:none}
    .anatomy-figure svg:focus-visible{box-shadow:inset 0 0 0 1px #d4b580}
    .anatomy-figure [data-part]{cursor:pointer}
    @media(max-width:600px){.anatomy-figure .anatomy-top,.anatomy-figure .anatomy-bottom{padding:16px 17px;font-size:9px;gap:10px}.anatomy-figure .anatomy-bottom{padding-top:5px}.anatomy-figure svg{min-height:220px}.anatomy-figure{min-height:300px}}
  </style>
  <div class="anatomy-top"><span class="anatomy-number">FIG. 02 / ANATOMY</span><span>共享几何 · 等轴测结构视图</span></div>
  <svg viewBox="0 0 ${W} ${H}" role="img" tabindex="0" aria-label="Roadster 共享车辆模型的等轴测结构视图；可点击部件查看说明。" preserveAspectRatio="xMidYMid meet"><defs><radialGradient id="anatomy-shadow"><stop stop-color="#000" stop-opacity=".7"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><ellipse cx="600" cy="553" rx="400" ry="132" fill="url(#anatomy-shadow)"/><g class="anatomy-parts"></g></svg>
  <div class="anatomy-bottom"><span>点选部件查看依据<br>结构位置含演示假设</span><span class="anatomy-readout">ASSEMBLED · 0%</span></div>`;
  container.appendChild(wrapper);
  const svg = wrapper.querySelector('svg');
  const layer = wrapper.querySelector('.anatomy-parts');
  const readout = wrapper.querySelector('.anatomy-readout');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = x => Number.isFinite(x) ? x.toFixed(2) : '0';

  // Weld coincident vertices for edge adjacency only; the original position
  // buffer remains the source of every point and of every visible surface.
  function geometryOf(mesh) {
    const g = mesh.geometry, p = g?.attributes?.position;
    if (!p) return null;
    const old = cache.get(g);
    if (old && old.version === p.version && old.count === p.count) return old;
    const vertices = [], remap = [], unique = new Map(), edges = new Map(), faces = [];
    for (let i = 0; i < p.count; i++) {
      const point = [p.getX(i), p.getY(i), p.getZ(i)];
      const key = point.map(x => Math.round(x * 1e6)).join(',');
      let id = unique.get(key);
      if (id === undefined) { id = vertices.length; unique.set(key, id); vertices.push(point); }
      remap.push(id);
    }
    const index = g.index, count = index ? index.count : p.count;
    const drawStart = Math.max(0, g.drawRange?.start || 0);
    const drawEnd = Math.min(count, drawStart + (g.drawRange?.count ?? Infinity));
    for (let i = drawStart; i + 2 < drawEnd; i += 3) {
      const ids = [0,1,2].map(j => remap[index ? index.getX(i+j) : i+j]);
      const [a,b,c] = ids.map(j => vertices[j]);
      const ab = new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
      const ac = new THREE.Vector3(c[0]-a[0],c[1]-a[1],c[2]-a[2]);
      const fn = ab.cross(ac);
      if (fn.lengthSq() < 1e-18) continue;
      fn.normalize();
      const group = g.groups?.find(gr => i >= gr.start && i < gr.start + gr.count);
      const face = { ids, normal:fn.toArray(), material:group?.materialIndex || 0 };
      const fi = faces.push(face)-1;
      for (let j=0;j<3;j++) {
        const a=ids[j], b=ids[(j+1)%3], k=a<b?`${a},${b}`:`${b},${a}`;
        if (!edges.has(k)) edges.set(k,{a,b,faces:[]});
        edges.get(k).faces.push(fi);
      }
    }
    const edgeList=[...edges.values()];
    // Join coplanar triangles into their actual outside loops, once per geometry.
    // In particular a flat side panel must not advertise its tessellation.
    const parents=faces.map((_,i)=>i);
    const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
    for(const edge of edgeList){
      if(edge.faces.length!==2)continue;
      const [ia,ib]=edge.faces,a=faces[ia],b=faces[ib],na=a.normal,nb=b.normal;
      const dot=na[0]*nb[0]+na[1]*nb[1]+na[2]*nb[2];
      if(dot<.99999||a.material!==b.material)continue;
      const av=vertices[a.ids[0]],bv=vertices[b.ids[0]];
      if(Math.abs(na[0]*(av[0]-bv[0])+na[1]*(av[1]-bv[1])+na[2]*(av[2]-bv[2]))>.0001)continue;
      parents[find(ib)]=find(ia);
    }
    const regions=new Map();
    for(let i=0;i<faces.length;i++){const root=find(i);if(!regions.has(root))regions.set(root,[]);regions.get(root).push(i);}
    const polygons=[];
    for(const members of regions.values()){
      if(members.length===1){polygons.push({loops:[faces[members[0]].ids],face:members[0]});continue;}
      const set=new Set(members),next=new Map();let boundaryCount=0;
      for(const fi of members){const ids=faces[fi].ids;for(let j=0;j<3;j++){
        const a=ids[j],b=ids[(j+1)%3],key=a<b?`${a},${b}`:`${b},${a}`;
        if(edges.get(key).faces.some(other=>other!==fi&&set.has(other)))continue;
        if(!next.has(a))next.set(a,[]);next.get(a).push(b);boundaryCount++;
      }}
      const used=new Set(),loops=[];let valid=true;
      for(const [start,targets]of next){for(const target of targets){
        if(used.has(`${start}>${target}`))continue;
        const loop=[start];let a=start,b=target;
        for(let step=0;step<=boundaryCount;step++){
          used.add(`${a}>${b}`);if(b===start)break;loop.push(b);
          const candidates=next.get(b)||[],c=candidates.find(c=>!used.has(`${b}>${c}`));
          if(c===undefined){valid=false;break;}a=b;b=c;
          if(step===boundaryCount)valid=false;
        }
        if(loop.length>=3)loops.push(loop);else valid=false;
      }}
      if(valid&&loops.length)polygons.push({loops,face:members[0]});
      else for(const fi of members)polygons.push({loops:[faces[fi].ids],face:fi});
    }
    const normals=[],normalIds=new Map();
    for(const face of faces){const key=face.normal.map(x=>Math.round(x*1e6)).join(',');if(!normalIds.has(key)){normalIds.set(key,normals.length);normals.push(face.normal);}face.normalId=normalIds.get(key);}
    const result = { vertices, faces, polygons, normals, edges:edgeList, version:p.version, count:p.count };
    cache.set(g,result);
    return result;
  }

  function isVisible(mesh) {
    for (let m=mesh; m; m=m.parent) { if (!m.visible) return false; if(m===car.group) break; }
    return true;
  }
  function isActive(part, state) {
    const selected = typeof state.selected === 'object' ? state.selected?.id : state.selected;
    if (selected && part.id===selected) return true;
    const mode=String(state.system || '').toLowerCase();
    const category=String(part.category || '').toLowerCase();
    if (!mode || ['all','overview','exterior','none'].includes(mode)) return false;
    if (mode === category) return true;
    return (/thrust|rocket|flight|propulsion/.test(mode) && /thrust|propulsion/.test(category)) ||
      (/suction|fan/.test(mode) && /suction|fan/.test(category)) ||
      (/aero|track/.test(mode) && /aero/.test(category));
  }
  function surfaceColor(part, material, normal, active) {
    const category=String(part.category || '').toLowerCase();
    const light=normal.y*.63-normal.x*.22+normal.z*.15;
    const tone=light>.56?0:light>.13?1:light>-.18?2:3;
    if(active) return ['#ecd5a4','#bfa477','#8d7856','#625640'][tone];
    if(/glass|window/.test(category)) return ['#8d9189','#606b6b','#39484b','#283538'][tone];
    const c=material?.color, luminance=c?(.2126*c.r+.7152*c.g+.0722*c.b):.6;
    if(/wheel|tire|tyre/.test(category) && luminance<.12) return ['#414649','#343a3d','#272e32','#20272b'][tone];
    if(/internal|chassis|underbody|suction/.test(category)) return ['#929a98','#6d7879','#505e61','#35454a'][tone];
    if(luminance<.045) return ['#61676a','#495359','#34434a','#28363c'][tone];
    return ['#d5d7cc','#aeb3ab','#808b88','#556467'][tone];
  }

  function snapshot(state) {
    car.group.updateWorldMatrix(true,true);
    seen.clear();
    const records=[];
    for(const part of car.parts || []) {
      if (!part.mesh) continue;
      part.mesh.traverse(mesh => {
        if(!mesh.isMesh || seen.has(mesh.uuid) || !isVisible(mesh)) return;
        seen.add(mesh.uuid);
        const geometry=geometryOf(mesh);
        if(!geometry?.faces.length) return;
        let pose=poseCache.get(mesh.uuid);
        const matrix=mesh.matrixWorld.elements;
        if(!pose||pose.geometry!==geometry||matrix.some((x,i)=>x!==pose.matrix[i])){
          normalMatrix.getNormalMatrix(mesh.matrixWorld);
          const mirror = mesh.matrixWorld.determinant() < 0 ? -1 : 1;
          const points=geometry.vertices.map(p => {
            v.fromArray(p).applyMatrix4(mesh.matrixWorld);
            return {x:v.dot(right),y:-v.dot(up),z:v.dot(eye)};
          });
          const transformed=geometry.normals.map(nn=>n.fromArray(nn).applyMatrix3(normalMatrix).normalize().multiplyScalar(mirror).clone());
          const dots=transformed.map(nn=>nn.dot(eye));
          pose={geometry,matrix:[...matrix],points,normals:geometry.faces.map(f=>transformed[f.normalId]),facing:geometry.faces.map(f=>dots[f.normalId])};
          poseCache.set(mesh.uuid,pose);
        }
        const points=pose.points.map(p=>({...p})),normals=pose.normals,facing=pose.facing;
        records.push({part,mesh,geometry,points,normals,facing,active:isActive(part,state)});
      });
    }
    return records;
  }

  function draw(state) {
    if(destroyed) return;
    lastTime=performance.now();
    car.group.updateWorldMatrix(true,true);
    const projectionKey=(car.parts||[]).map(part=>{
      if(!part.mesh)return '';
      return `${part.id}:${isVisible(part.mesh)?1:0}:${part.mesh.geometry?.attributes?.position?.version}:${part.mesh.matrixWorld.elements.map(x=>Math.round(x*1e6)).join(',')}`;
    }).join('|');
    if(projectionCache?.key===projectionKey){paint(state);return;}
    const records=snapshot(state), all=records.flatMap(r=>r.points);
    if(!all.length) {
      layer.innerHTML='<text x="600" y="360" fill="#aab1ad" text-anchor="middle" font-size="20">共享模型正在准备</text>';
      return;
    }
    let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
    for(const p of all){xmin=Math.min(xmin,p.x);xmax=Math.max(xmax,p.x);ymin=Math.min(ymin,p.y);ymax=Math.max(ymax,p.y);}
    // Fit the current assembled or exploded geometry; retain generous breathing
    // room rather than clipping parts as an assembly moves beyond its rest pose.
    const scale=Math.min(950/Math.max(xmax-xmin,.1),530/Math.max(ymax-ymin,.1));
    const cx=(xmin+xmax)/2, cy=(ymin+ymax)/2;
    for(const r of records) for(const p of r.points){p.x=W/2+(p.x-cx)*scale;p.y=H/2+(p.y-cy)*scale;}
    const items=[], triangles=[], edgeCandidates=[];
    let faceCount=0;
    for(const r of records) {
      const {part,mesh,geometry,points,normals,facing,active}=r;
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      const visible=geometry.faces.map((f,i)=> {
        const mat=materials[f.material] || materials[0];
        if(mat?.visible===false) return false;
        return mat?.side===THREE.DoubleSide || (mat?.side===THREE.BackSide?facing[i]<-1e-7:facing[i]>1e-7);
      });
      for(let fi=0;fi<geometry.faces.length;fi++)if(visible[fi]){triangles.push(geometry.faces[fi].ids.map(i=>points[i]));faceCount++;}
      for(const polygon of geometry.polygons) {
        const fi=polygon.face;
        if(!visible[fi])continue;
        const f=geometry.faces[fi],pts=polygon.loops.flatMap(loop=>loop.map(i=>points[i]));
        const mat=materials[f.material] || materials[0];
        const nn=normals[fi].clone();
        if(facing[fi]<0) nn.negate();
        const color=surfaceColor(part,mat,nn,false),litColor=surfaceColor(part,mat,nn,true);
        const d=polygon.loops.map(loop=>loop.map((i,j)=>`${j?'L':'M'}${fmt(points[i].x)},${fmt(points[i].y)}`).join('')+'Z').join('');
        const z=pts.reduce((sum,p)=>sum+p.z,0)/pts.length;
        // A same-color hairline seals raster antialiasing gaps. It never draws
        // a dark triangulation grid over otherwise smooth body panels.
        items.push({z,d,color,litColor,id:part.id,part});
      }
      for(const e of geometry.edges) {
        const fs=e.faces;
        if(!fs.some(i=>visible[i])) continue;
        const silhouette=fs.length===1 || fs.some(i=>facing[i]>0)&&fs.some(i=>facing[i]<=0);
        const crease=fs.length===2 && normals[fs[0]].dot(normals[fs[1]])<.72;
        if(!silhouette&&!crease) continue;
        edgeCandidates.push({a:points[e.a],b:points[e.b],color:silhouette?'#141f24':'#28383e',width:silhouette?.9:.5,part});
      }
    }
    items.sort((a,b)=>a.z-b.z);

    // Spatially indexed depth queries clip edge strokes behind the real mesh.
    // This prevents wireframe bleed-through when a wheel or panel is occluded.
    const CELL=36,COLS=Math.ceil(W/CELL),ROWS=Math.ceil(H/CELL),grid=Array.from({length:COLS*ROWS},()=>[]);
    const cellX=x=>Math.max(0,Math.min(COLS-1,Math.floor(x/CELL)));
    const cellY=y=>Math.max(0,Math.min(ROWS-1,Math.floor(y/CELL)));
    triangles.forEach((t,i)=> {
      const xs=t.map(p=>p.x),ys=t.map(p=>p.y);
      for(let y=cellY(Math.min(...ys));y<=cellY(Math.max(...ys));y++)
        for(let x=cellX(Math.min(...xs));x<=cellX(Math.max(...xs));x++)grid[y*COLS+x].push(i);
    });
    function exposed(p) {
      const candidates=grid[cellY(p.y)*COLS+cellX(p.x)];
      for(const idx of candidates) {
        const [a,b,c]=triangles[idx];
        const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
        if(Math.abs(den)<1e-6)continue;
        const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/den;
        const q=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/den;
        if(u<-.001||q<-.001||u+q>1.001)continue;
        const z=u*a.z+q*b.z+(1-u-q)*c.z;
        if(z>p.z+.003) return false;
      }
      return true;
    }
    const edgeBatches=new Map();
    for(const e of edgeCandidates) {
      const length=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y);
      if(length<.65)continue;
      const steps=Math.max(1,Math.ceil(length/7));
      const at=t=>({x:e.a.x+(e.b.x-e.a.x)*t,y:e.a.y+(e.b.y-e.a.y)*t,z:e.a.z+(e.b.z-e.a.z)*t});
      let d='',start=null;
      for(let j=0;j<steps;j++) {
        const show=exposed(at((j+.5)/steps));
        if(show&&start===null) start=j/steps;
        if(start!==null&&(!show||j===steps-1)) {
          const end=show?(j+1)/steps:j/steps;
          const a=at(start),b=at(end);
          d+=`M${fmt(a.x)},${fmt(a.y)}L${fmt(b.x)},${fmt(b.y)}`;
          start=null;
        }
      }
      if(d){const key=`${e.part.id}|${e.color}|${e.width}`;if(!edgeBatches.has(key))edgeBatches.set(key,{color:e.color,width:e.width,d:'',part:e.part});edgeBatches.get(key).d+=d;}
    }
    // Thin, real world-space depth layers batch same-part/same-tone triangles.
    // Vertices are unchanged. The 25 mm painter bands are a rendering compromise
    // for very detailed meshes; this is not a depth/clearance verification tool.
    const bands=new Map();
    for(const item of items){
      const band=Math.floor(item.z/.025),key=`${band}|${item.color}|${item.id}`;
      if(bands.has(key))bands.get(key).d+=item.d;
      else bands.set(key,{...item,band});
    }
    const batches=[...bands.values()].sort((a,b)=>a.band-b.band||a.z-b.z);
    projectionCache={key:projectionKey,batches,edges:[...edgeBatches.values()],faceCount,uniqueParts:new Set(records.map(r=>r.part.id)).size,nodes:[]};
    paint(state,true);
  }

  function paint(state,rebuild=false){
    const {batches,edges,faceCount,uniqueParts}=projectionCache;
    const active=new Map((car.parts||[]).map(p=>[p.id,isActive(p,state)]));
    if(rebuild||projectionCache.nodes.length!==batches.length+edges.length){
      const edgeMarkup=edges.map(e=>`<path d="${e.d}" fill="none" stroke="${active.get(e.part.id)?'#e4c58d':e.color}" stroke-width="${e.width}" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`);
      layer.innerHTML=batches.map(i=>{const color=active.get(i.id)?i.litColor:i.color;return `<path d="${i.d}" fill="${color}" fill-rule="nonzero" stroke="${color}" stroke-width="1.05" stroke-linejoin="round" data-part="${esc(i.id)}"/>`;}).join('')+edgeMarkup.join('');
      projectionCache.nodes=Array.from(layer.children||[]);
    }else{
      batches.forEach((item,i)=>{const color=active.get(item.id)?item.litColor:item.color,node=projectionCache.nodes[i];if(node.getAttribute('fill')!==color){node.setAttribute('fill',color);node.setAttribute('stroke',color);}});
      edges.forEach((item,i)=>{const color=active.get(item.part.id)?'#e4c58d':item.color,node=projectionCache.nodes[batches.length+i];if(node.getAttribute('stroke')!==color)node.setAttribute('stroke',color);});
    }
    const amount=Math.max(0,Math.min(1,Number(state.explode)||0));
    readout.textContent=`${amount>.015?'EXPLODED':'ASSEMBLED'} · ${Math.round(amount*100)}% · ${uniqueParts} 部件`;
    wrapper.dataset.faces=String(faceCount);
    wrapper.dataset.parts=String(uniqueParts);
    wrapper.dataset.projection='orthographic-y-up';
  }

  function render(state={}) {
    if(destroyed)return;
    const selected=typeof state.selected==='object'?state.selected?.id:state.selected;
    car.group.updateWorldMatrix(true,true);
    // Matrix signatures include moving wheels and aerodynamic surfaces, so this
    // SVG stays in sync even when the public mode/slider values do not change.
    const pose=[];
    for(const part of car.parts || []) if(part.mesh) {
      pose.push(isVisible(part.mesh)?1:0);
      for(const value of part.mesh.matrixWorld.elements)pose.push(Math.round(value*300));
    }
    const key=`${selected}|${state.system}|${Math.round((state.explode||0)*160)}|${pose.join(',')}`;
    if(key===lastKey&&!(state.force&&pending))return;
    lastKey=key;pending={...state};
    const elapsed=performance.now()-lastTime;
    if(state.force||elapsed>=100) { clearTimeout(timer);timer=0;draw(pending);pending=null; }
    else if(!timer) timer=setTimeout(()=>{timer=0;if(pending){draw(pending);pending=null;}},100-elapsed);
  }
  function onClick(event) {
    const node=event.target.closest('[data-part]');
    if(!node)return;
    const part=(car.parts || []).find(p=>String(p.id)===node.dataset.part);
    if(part)container.dispatchEvent(new CustomEvent('anatomyselect',{detail:{id:part.id,part},bubbles:true}));
  }
  svg.addEventListener('click',onClick);
  render({});
  return {
    render,
    destroy(){destroyed=true;clearTimeout(timer);svg.removeEventListener('click',onClick);wrapper.remove();cache.clear();poseCache.clear();}
  };
}
