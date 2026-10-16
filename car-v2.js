/* Roadster 2026 · second exterior reconstruction.
 * Reference: Tesla's 2026 presentation, rear test footage at 10:55–12:00,
 * and the Ano White / Hidden Aero front photograph. Not manufacturer CAD.
 * X points rearward, Y upward, Z across the car. All dimensions are estimates.
 * Surface topology is rebuilt from shared silhouette curves; no v1 body is used.
 * 2026-10 finish pass: continuous shoulder normals, inset wheel liners,
 * sculpted glazing edges, tire beads and brake/rim detail. These small surface
 * features are visual reconstruction, not measured manufacturing geometry.
 */
export function buildCar({ THREE, MAT = {}, GEO = {} }) {
  const group = new THREE.Group(); group.name = 'Roadster · presentation vehicle exterior';
  const assemblies = [], parts = [], aero = [], wheels = [], nozzles = [], internal = [];
  const liftNozzles = [], fanRotors = [];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (t, a = 0, b = 1) => Math.max(a, Math.min(b, t));
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const vec = a => new THREE.Vector3(...a);
  const evidence = 'B · 按 Tesla 2026 官方演示画面重建；比例和尺寸为图像估计';
  const assumed = 'C · 原理演示；非 Tesla 已公开的内部工程结构';
  let counter = 0;

  const paint = new THREE.MeshPhysicalMaterial({ color: '#d8ddd9', metalness: .10, roughness: .235, clearcoat: .94, clearcoatRoughness: .095, envMapIntensity: .85 });
  const paintDark = new THREE.MeshPhysicalMaterial({ color: '#bac1bf', metalness: .14, roughness: .27, clearcoat: .85, clearcoatRoughness: .12 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#070e13', metalness: .04, roughness: .16, clearcoat: 1, clearcoatRoughness: .09, envMapIntensity: .55, ior: 1.48, reflectivity: .55 });
  const windscreen = new THREE.MeshPhysicalMaterial({ color: '#0a1014', metalness: .04, roughness: .16, clearcoat: 1, clearcoatRoughness: .09, envMapIntensity: .55, ior: 1.48, reflectivity: .55 });
  const carbon = new THREE.MeshStandardMaterial({ color: '#101619', metalness: .18, roughness: .48 });
  const graphite = new THREE.MeshStandardMaterial({ color: '#252b2d', metalness: .85, roughness: .25 });
  const satin = new THREE.MeshStandardMaterial({ color: '#070b0c', metalness: .08, roughness: .52 });
  const lampRecess = new THREE.MeshPhysicalMaterial({ color: '#46565d', metalness: .25, roughness: .24, clearcoat: .8, clearcoatRoughness: .12 });
  const titanium = new THREE.MeshStandardMaterial({ color: '#777e80', metalness: .93, roughness: .31 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: '#4d5152', metalness: .64, roughness: .5 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#141819', metalness: 0, roughness: .79 });
  const red = new THREE.MeshPhysicalMaterial({ color: '#ba1917', emissive: '#ef231c', emissiveIntensity: 1.7, roughness: .19, metalness: .1, clearcoat: .85 });
  const whiteLamp = new THREE.MeshPhysicalMaterial({ color: '#e8eeeb', emissive: '#dce8ee', emissiveIntensity: 1.6, roughness: .19, clearcoat: 1 });
  const amber = new THREE.MeshStandardMaterial({ color: '#a26520', emissive: '#e78520', emissiveIntensity: .25, roughness: .35 });
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = c.height = 512; const ctx = c.getContext('2d');
    ctx.fillStyle = '#888'; ctx.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = '#353535'; ctx.fillRect(68 + 112 * k, 0, 4, 512); }
    ctx.strokeStyle = '#727272'; ctx.lineWidth = 2;
    for (let y = -24; y < 536; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y + 20); ctx.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); rubber.bumpMap = t; rubber.bumpScale = .0008;
  }

  function add(geometry, material, name, category = 'body', pos = [0, 0, 0], explode = [0, 0, 0], source = evidence, parent = group, hidden = false) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...pos);
    return register(mesh, name, category, explode, source, parent, hidden);
  }
  function register(mesh, name, category, explode, source = evidence, parent = group, hidden = false) {
    parent.add(mesh); mesh.name = name; mesh.visible = !hidden;
    const item = { id: `v2-${String(++counter).padStart(3, '0')}`, name, category, mesh, base: mesh.position.toArray(), explode: [...explode], evidence: source, hidden };
    mesh.userData = { ...mesh.userData, partId: item.id, name, category, evidence: source, basePosition: mesh.position.clone(), hiddenInternal: hidden };
    mesh.traverse(o => { if (o.isMesh) {
      o.castShadow = true;
      // The thin painted shell still casts onto wheels and the ground. Sampling
      // a track-scale shadow map back onto it creates diagonal self-shadow acne;
      // its continuous curvature is instead lit by the PBR environment.
      o.receiveShadow = o.material !== paint && o.material !== paintDark;
      o.userData.partId = item.id; o.userData.category = category; o.userData.evidence = source;
    } });
    assemblies.push(item); if (hidden) internal.push(mesh); return mesh;
  }
  function box(w, h, d, r = .008) { return GEO.rbox ? GEO.rbox(w, h, d, Math.min(r, w / 3, h / 3, d / 3), 2) : new THREE.BoxGeometry(w, h, d); }
  function lathe(points, n = 96) { return new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), n); }
  function merge(geos) {
    if (GEO.merge) return GEO.merge(geos);
    const p = [], n = []; for (const source of geos) { const g = source.index ? source.toNonIndexed() : source; if (!g.attributes.normal) g.computeVertexNormals(); p.push(...g.attributes.position.array); n.push(...g.attributes.normal.array); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); return g;
  }
  function orient(g) {
    const p = g.attributes.position, ix = g.index; let volume = 0;
    for (let i = 0; i < (ix?.count ?? p.count); i += 3) { const a = new THREE.Vector3().fromBufferAttribute(p, ix ? ix.getX(i) : i), b = new THREE.Vector3().fromBufferAttribute(p, ix ? ix.getX(i + 1) : i + 1), c = new THREE.Vector3().fromBufferAttribute(p, ix ? ix.getX(i + 2) : i + 2); volume += a.dot(b.cross(c)); }
    if (volume < 0 && ix) for (let i = 0; i < ix.count; i += 3) { const b = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, b); }
    g.computeVertexNormals(); return g;
  }
  // A closed, smooth outer skin with a real inner wall. Border faces use their
  // own vertices, so the reflection on the outer skin cannot be pulled by caps.
  function skin(fn, nu = 48, nv = 16, thickness = .015, expected = [0, 1, 0]) {
    const positions = [], outer = [], normals = [], index = [], row = nv + 1, ref = vec(expected);
    const at = (u, v) => vec(fn(clamp(u), clamp(v)));
    const du = at(.501, .5).sub(at(.499, .5)), dv = at(.5, .501).sub(at(.5, .499));
    const flip = du.cross(dv).dot(ref) < 0;
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const u = i / nu, v = j / nv, p = at(u, v), tu = at(u + .0002, v).sub(at(u - .0002, v)), tv = at(u, v + .0002).sub(at(u, v - .0002));
      let n = tu.cross(tv);
      // Collapsed tips are sampled just inside the surface for a stable tangent.
      if (n.lengthSq() < 1e-22) {
        const uu = clamp(u, .0003, .9997), vv = clamp(v, .0003, .9997);
        n = at(uu + .0002, vv).sub(at(uu - .0002, vv)).cross(at(uu, vv + .0002).sub(at(uu, vv - .0002)));
      }
      n.normalize().multiplyScalar(flip ? -1 : 1); outer.push(p); normals.push(n); positions.push(...p.toArray());
    }
    const count = outer.length;
    outer.forEach((p, i) => positions.push(...p.clone().addScaledVector(normals[i], -thickness).toArray()));
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = i * row + j, b = a + row;
      const tri = flip ? [a, a + 1, b, a + 1, b + 1, b] : [a, b, a + 1, a + 1, b, b + 1];
      index.push(...tri, tri[0] + count, tri[2] + count, tri[1] + count, tri[3] + count, tri[5] + count, tri[4] + count);
    }
    const boundary = [...Array(row).keys(), ...Array.from({ length: nu }, (_, i) => (i + 1) * row + nv), ...Array.from({ length: nv }, (_, i) => count - 2 - i), ...Array.from({ length: nu - 1 }, (_, i) => (nu - 1 - i) * row)];
    for (let k = 0; k < boundary.length; k++) {
      const a = boundary[k], b = boundary[(k + 1) % boundary.length], start = positions.length / 3;
      for (const id of [a, b, b + count, a + count]) positions.push(...positions.slice(id * 3, id * 3 + 3));
      if (flip) index.push(start, start + 2, start + 1, start, start + 3, start + 2); else index.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(index); orient(g);
    // Preserve double-precision parametric normals. Reconstructing normals from
    // very thin Float32 triangles around wheel arches imprints their diagonals
    // into the clearcoat. The independently duplicated wall vertices keep their
    // geometric normals, while outer and inner skins remain smooth and exact.
    const normal = g.attributes.normal;
    for (let i = 0; i < count; i++) { const n = normals[i]; normal.setXYZ(i, n.x, n.y, n.z); normal.setXYZ(i + count, -n.x, -n.y, -n.z); }
    return g;
  }
  function prism(points, direction = [0, -.012, 0]) {
    const p = points.flat(), ix = [], n = points.length;
    for (const v of points) p.push(...v.map((x, i) => x + direction[i]));
    for (let j = 1; j < n - 1; j++) ix.push(0, j, j + 1, n, n + j + 1, n + j);
    for (let j = 0; j < n; j++) { const k = (j + 1) % n; ix.push(j, n + j, n + k, j, n + k, k); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix); orient(g);
    const flat = g.toNonIndexed(); flat.computeVertexNormals(); g.dispose(); return flat;
  }
  function line(points, radius = .002, closed = false) {
    const path = new THREE.CatmullRomCurve3(points.map(vec), closed, 'centripetal');
    const tube = new THREE.TubeGeometry(path, Math.max(24, points.length * 8), radius, 6, closed);
    if (closed) return tube;
    return merge([tube, ...[points[0], points.at(-1)].map(p => new THREE.SphereGeometry(radius, 8, 6).translate(...p))]);
  }
  function curve(table, x, column = 1) {
    if (x <= table[0][0]) return table[0][column];
    for (let i = 1; i < table.length; i++) if (x <= table[i][0]) {
      const a = table[i - 1], b = table[i], t = (x - a[0]) / (b[0] - a[0]);
      const prev = table[Math.max(0, i - 2)], next = table[Math.min(table.length - 1, i + 1)];
      const m0 = (b[column] - prev[column]) / (b[0] - prev[0]), m1 = (next[column] - a[column]) / (next[0] - a[0]), h = b[0] - a[0];
      return (2 * t ** 3 - 3 * t ** 2 + 1) * a[column] + (t ** 3 - 2 * t ** 2 + t) * m0 * h + (-2 * t ** 3 + 3 * t ** 2) * b[column] + (t ** 3 - t ** 2) * m1 * h;
    }
    return table.at(-1)[column];
  }

  const frontX = -2.34, rearX = 2.34, frontAxle = -1.43, rearAxle = 1.42;
  const widths = [[frontX, .92], [-2.08, .977], [-1.43, 1.005], [-.65, .969], [.25, .964], [1.05, 1.024], [1.42, 1.04], [1.95, 1.008], [rearX, .97]];
  const edges = [[frontX, .475], [-2.08, .61], [-1.76, .747], [-1.43, .788], [-.90, .743], [-.35, .743], [.35, .765], [1.05, .804], [1.42, .822], [1.92, .802], [rearX, .765]];
  const width = x => curve(widths, x), edge = x => curve(edges, x);
  const bonnetHalf = x => lerp(.693, .57, clamp((x - frontX) / 1.40));
  const bonnetY = x => lerp(.508, .748, clamp((x - frontX) / 1.398));
  const roofBaseWidth = x => x <= 1.205 ? lerp(.728, .802, clamp((x + .942) / 2.147)) : lerp(.802, .804, clamp((x - 1.205) / .322));
  const sillY = x => x <= 1.205 ? lerp(.751, .776, clamp((x + .942) / 2.147)) : lerp(.776, .792, clamp((x - 1.205) / .322));

  // The central hood stays an honest, almost planar trapezoid.
  const hood = skin((u, v) => { const x = lerp(frontX, -.942, u), z = lerp(-bonnetHalf(x), bonnetHalf(x), v); return [x, bonnetY(x) + .006 * Math.sin(Math.PI * v) * Math.sin(Math.PI * u), z]; }, 48, 28, .014);
  add(hood, paint, '平直梯形前舱盖', 'body', [0, 0, 0], [-.30, .68, 0]);

  // The broad front shoulder is one C1-continuous loft. Matching its tangent
  // to the hood at the inner edge removes the pinched highlight of a ruled
  // folded patch, while the wheel crown still defines the wedge silhouette.
  const fender = (x, v, sign) => {
    const inner = bonnetHalf(x), w = width(x), z = lerp(inner, w, v), innerY = bonnetY(x), outerY = edge(x);
    // The crown reaches full height before crossing the tire's inner shoulder;
    // a symmetric ease across the whole width would dip into the wheel liner.
    const y = lerp(innerY, outerY, smooth(v / .48)) + .004 * Math.sin(Math.PI * v) ** 2;
    return [x, y, sign * z];
  };
  for (const sign of [-1, 1]) {
    const cavityStart = -2.29, cavityEnd = -1.97;
    const boundaryV = t => .025 + .42 * t;
    const insetFender = (x, v) => {
      const p = fender(x, v, sign), t = (x - cavityStart) / (cavityEnd - cavityStart), bv = boundaryV(clamp(t));
      if (t > 0 && t < 1 && v < bv) p[1] -= .003 * Math.sin(Math.PI * t) * Math.sin(Math.PI * v / bv);
      return p;
    };
    // One continuous closed white shell avoids coincident cap faces at the
    // former patch boundaries. Its inset is a depressed surface with a thin,
    // fitted dark lens; the border is not a hole through the fender.
    add(skin((u, v) => insetFender(lerp(frontX, -.942, u), v), 88, 36, .014), paint, `${sign > 0 ? '右' : '左'}连续前翼与隐藏灯座`, 'body', [0, 0, 0], [-.25, .62, sign * .1]);
    add(skin((u, v) => { const x = lerp(cavityStart + .001, cavityEnd - .001, u), t = (x - cavityStart) / (cavityEnd - cavityStart), p = insetFender(x, boundaryV(t) * lerp(.008, .985, v)); p[1] += .0006; return p; }, 32, 18, .0018), lampRecess, `${sign > 0 ? '右' : '左'}隐藏前灯浅槽透镜`, 'body', [0, 0, 0], [-.25, .62, sign * .1]);
    const lightX = -2.04, lt = (lightX - cavityStart) / (cavityEnd - cavityStart), lightPoints = [];
    for (let k = 0; k <= 8; k++) { const p = insetFender(lightX, boundaryV(lt) * lerp(.10, .94, k / 8)); p[1] += .002; lightPoints.push(p); }
    add(line(lightPoints, .0045), whiteLamp, `${sign > 0 ? '右' : '左'}细前灯`, 'body', [0, 0, 0], [-.25, .62, sign * .1]);

    add(skin((u, v) => { const x = lerp(-.941, 1.52, u), zi = roofBaseWidth(x), z = lerp(zi, width(x), v), target = lerp(sillY(x), edge(x), v) + .009 * Math.sin(Math.PI * v), startV = clamp((z - bonnetHalf(-.942)) / (width(-.942) - bonnetHalf(-.942))), startY = fender(-.942, startV, sign)[1]; return [x, lerp(startY, target, smooth((x + .941) / .21)), sign * z]; }, 82, 18, .014), paint, `${sign > 0 ? '右' : '左'}连续肩部曲面`, 'body', [0, 0, 0], [0, .44, sign * .28]);
  }

  // Side skin: continuously changing cross-section, swept circular arch, and a
  // slightly tucked rocker. Smooth normals are shared along the entire arch.
  const archR = .397;
  const lowerEdge = x => {
    let y = curve([[frontX, .195], [-1.9, .15], [-.8, .16], [.8, .17], [1.95, .20], [rearX, .29]], x);
    for (const axle of [frontAxle, rearAxle]) {
      const d = Math.abs(x - axle);
      if (d <= archR) y = Math.max(y, .368 + Math.sqrt(Math.max(0, archR * archR - d * d)));
      else if (d < archR + .022) y = lerp(.368, y, smooth((d - archR) / .022));
    }
    return y;
  };
  const sideZ = (x, y) => { const t = clamp((y - .17) / Math.max(.2, edge(x) - .17)); return width(x) - .095 * (1 - smooth(t)) - .012 * Math.sin(Math.PI * t); };
  const sideXs = Array.from({ length: 161 }, (_, i) => lerp(frontX, rearX, i / 160));
  for (const axle of [frontAxle, rearAxle]) {
    for (let i = 0; i <= 96; i++) sideXs.push(axle + archR * Math.cos(Math.PI * i / 96));
    sideXs.push(axle - archR - .022, axle + archR + .022);
  }
  sideXs.sort((a, b) => a - b); const sampledX = sideXs.filter((x, i) => !i || x - sideXs[i - 1] > .00001);
  const sideXAt = u => { const t = u * (sampledX.length - 1), k = Math.min(sampledX.length - 2, Math.floor(t)); return lerp(sampledX[k], sampledX[k + 1], t - k); };
  for (const sign of [-1, 1]) {
    add(skin((u, v) => { const x = sideXAt(u), y = lerp(lowerEdge(x), edge(x) - .001, v), wrap = .105 * (1 - v) * (1 - smooth((x - frontX) / .25)); return [x + wrap, y, sign * sideZ(x, y)]; }, sampledX.length - 1, 18, .018, [0, 0, sign]), paint, `${sign > 0 ? '右' : '左'}整形侧壳与连续轮眉`, 'body', [0, 0, 0], [0, 0, sign * .50]);
    const skirtPoints = [[-1.00, .155, sign * .897], [-.75, .147, sign * .89], [.25, .156, sign * .89], [1.0, .17, sign * .936]];
    add(skin((u, v) => { const x = lerp(-1.01, 1.01, u), y = lerp(.147, .185, v), z = sideZ(x, .17) + .018 * Math.sin(Math.PI * v); return [x, y, sign * z]; }, 64, 6, .015, [0, 0, sign]), carbon, `${sign > 0 ? '右' : '左'}薄碳纤维侧裙`, 'aero', [0, 0, 0], [0, -.09, sign * .48]);
    // Very shallow, face-aligned panel breaks; no embossed tubes.
    const doorEnd = sign;
    const seam = [[-.87, .70], [-.86, .59], [-.81, .25], [-.68, .205], [.63, .22], [.88, .40], [.98, .75]];
    const seamG = skin((u, v) => { const n = seam.length - 1, k = Math.min(n - 1, Math.floor(u * n)), t = u * n - k, x = lerp(seam[k][0], seam[k + 1][0], t) + (v - .5) * .0022, y = lerp(seam[k][1], seam[k + 1][1], t); return [x, y, sign * (sideZ(x, y) + .0016)]; }, 96, 1, .0008, [0, 0, sign]);
    add(seamG, satin, `${sign > 0 ? '右' : '左'}齐平门缝`, 'body', [0, 0, 0], [0, 0, sign * .50]);
    add(box(.14, .006, .003, .001), graphite, `${sign > 0 ? '右' : '左'}齐平门把手`, 'body', [.51, .69, sign * (sideZ(.51, .69) + .001)], [0, 0, sign * .50]);
    add(box(.063, .015, .008, .003), amber, `${sign > 0 ? '右' : '左'}前翼侧标记`, 'body', [-1.00, .57, sign * (sideZ(-1.00, .57) + .002)], [0, 0, sign * .50]);
  }

  // Flat roof with independently controlled windshield rake and side glazing.
  // All four glazing surfaces share their exact boundary coordinates.
  const roofFront = -.24, roofRear = .61;
  const roofY = x => 1.088 + .013 * Math.sin(Math.PI * clamp((x - roofFront) / (roofRear - roofFront)));
  const roofW = x => lerp(.607, .635, clamp((x - roofFront) / (roofRear - roofFront)));
  add(skin((u, v) => { const x = lerp(roofFront, roofRear, u), z = lerp(-roofW(x), roofW(x), v); return [x, roofY(x) - .012 * Math.pow(Math.abs(2 * v - 1), 4), z]; }, 40, 32, .011), glass, '平缓黑色玻璃顶盖', 'glass', [0, 0, 0], [0, 1.04, 0]);
  const windshieldSurface = (u, v) => {
    const x = lerp(-.942, roofFront, u), w = lerp(.728, .607, u), z = lerp(-w, w, v);
    return [x - .014 * Math.sin(Math.PI * u), lerp(.751, 1.088, u) + .013 * Math.sin(Math.PI * u) - .012 * u * Math.pow(Math.abs(2 * v - 1), 4), z];
  };
  add(skin(windshieldSurface, 44, 36, .009), windscreen, '低倾角连续风挡', 'glass', [0, 0, 0], [0, 1.04, 0]);
  add(skin((u, v) => { const x = lerp(roofRear, 1.527, u), w = lerp(.635, .485, u); return [x, lerp(1.088, .795, u) + .006 * Math.sin(Math.PI * u) - .012 * (1 - u) * Math.pow(Math.abs(2 * v - 1), 4), lerp(-w, w, v)]; }, 44, 30, .009), glass, '收窄的后窗玻璃', 'glass', [0, 0, 0], [0, 1.04, 0]);
  for (const sign of [-1, 1]) {
    const p00 = [-.942, .751, sign * .728], p10 = [1.205, .776, sign * .802], p01 = [roofFront, 1.076, sign * .607], p11 = [roofRear, 1.076, sign * .635];
    const sideWindow = (u, v) => { const low = p00.map((a, k) => lerp(a, p10[k], u)), high = p01.map((a, k) => lerp(a, p11[k], u)); return low.map((a, k) => lerp(a, high[k], v)); };
    add(skin(sideWindow, 48, 20, .009, [0, 0, sign]), glass, `${sign > 0 ? '右' : '左'}平直梯形侧窗`, 'glass', [0, 0, 0], [0, .90, sign * .16]);
    // The broad painted rear buttress is a defining silhouette in the footage.
    add(skin((u, v) => { const x = lerp(roofRear, 1.527, u), zi = lerp(.635, .485, u), yi = lerp(1.076, .795, u), zo = lerp(.635, .804, u), yo = lerp(1.076, .792, u); return [x, lerp(yi, yo, v) + .009 * Math.sin(Math.PI * v) * Math.sin(Math.PI * u), sign * lerp(zi, zo, v)]; }, 46, 20, .014), paint, `${sign > 0 ? '右' : '左'}锐利后窗支撑面`, 'body', [0, 0, 0], [.16, .70, sign * .18]);
    // The small trailing glass-to-body closure follows the side window corner.
    add(prism([[roofRear, 1.076, sign * .635], [1.205, .776, sign * .802], [1.527, .792, sign * .804]], [0, -.014, 0]), paint, `${sign > 0 ? '右' : '左'}后窗外侧支撑面`, 'body', [0, 0, 0], [.16, .70, sign * .18]);
  }

  add(skin((u, v) => { const x = lerp(1.529, 2.17, u), z = lerp(-width(x), width(x), v); return [x, lerp(.796, .783, u) + .008 * Math.sin(Math.PI * v), z]; }, 32, 32, .014), paint, '平直宽体后甲板', 'body', [0, 0, 0], [.28, .58, 0]);
  const spoiler = add(skin((u, v) => { const z = lerp(-.963, .963, v), x = lerp(-.08, .09, u) - .014 * Math.pow(Math.abs(2 * v - 1), 6); return [x, .004 * Math.sin(Math.PI * v) - .007 * u - .005 * Math.pow(Math.abs(2 * v - 1), 4), z]; }, 16, 36, .014), paint, '与尾部齐平的主动翼片', 'aero', [2.25, .783, 0], [.30, .72, 0]); aero.push(spoiler);

  // The nose recedes underneath the hood; its corners wrap around the body.
  add(skin((u, v) => { const z = lerp(-.705, .705, u), y = lerp(.184, .508, v), x = lerp(-2.235, -2.344, v) - .012 * Math.cos(z / .705 * Math.PI / 2); return [x, y, z]; }, 48, 16, .018, [-1, 0, 0]), satin, '内收宽幅黑色前部', 'body', [0, 0, 0], [-.40, .02, 0]);
  for (const sign of [-1, 1]) add(skin((u, v) => {
    const yTop = lerp(.508, .475, u), yBottom = lerp(.184, .195, u), y = lerp(yBottom, yTop, v), z = lerp(.705, sideZ(frontX, y), u);
    return [lerp(-2.235, -2.344, v) + .006 * Math.sin(Math.PI * u), y, sign * z];
  }, 18, 18, .015, [-1, 0, 0]), paint, `${sign > 0 ? '右' : '左'}回收式前保险杠侧角`, 'body', [0, 0, 0], [-.40, .02, 0]);
  add(skin((u, v) => { const z = lerp(-.875, .875, u), x = lerp(-2.26, -2.10, v) + .035 * (Math.abs(z) / .875) ** 4; return [x, .168 - .008 * Math.sin(Math.PI * u), z]; }, 48, 10, .014), carbon, '薄前分流器', 'aero', [0, 0, 0], [-.42, -.08, 0]);
  const frontBlade = add(box(.065, .024, 1.36, .007), graphite, '前部齐平主动气动翼片', 'aero', [-2.25, .197, 0], [-.43, -.04, 0]); aero.push(frontBlade);

  // Deeply recessed rear light channel and sculpted dark lower tail.
  add(skin((u, v) => { const z = lerp(-.962, .962, u); return [2.348 - .018 * (Math.abs(z) / .962) ** 4, lerp(.654, .765, v), z]; }, 60, 8, .022, [1, 0, 0]), satin, '嵌入式尾灯黑色凹槽', 'body', [0, 0, 0], [.46, .12, 0]);
  add(box(.015, .010, 1.885, .004), red, '窄贯穿红色尾灯', 'body', [2.356, .712, 0], [.46, .12, 0]);
  add(box(.012, .005, .89, .002), red, '中央细尾灯层', 'body', [2.354, .729, 0], [.46, .12, 0]);
  add(skin((u, v) => { const z = lerp(-.974, .974, u), y = lerp(.478, .652, v), x = 2.32 - .075 * Math.sin(Math.PI * u) * (1 - v) - .019 * Math.sin(Math.PI * v); return [x, y, z]; }, 60, 14, .018, [1, 0, 0]), graphite, '后部深色折面保险杠', 'body', [0, 0, 0], [.46, .1, 0]);
  for (const sign of [-1, 1]) add(skin((u, v) => { const z = lerp(.70, .975, u), y = lerp(.265, .64, v); return [2.295 - .10 * Math.sin(Math.PI * u) * (1 - v), y, sign * z]; }, 20, 18, .02, [1, 0, 0]), carbon, `${sign > 0 ? '右' : '左'}尾部黑色气动外角`, 'aero', [0, 0, 0], [.45, -.02, sign * .12]);
  // Diffuser tunnel: upper opening, lower ramp, two broad outer walls and fins.
  add(skin((u, v) => { const x = lerp(1.54, 2.36, u), z = lerp(-.64, .64, v); return [x, .125 + .14 * u * u + .015 * Math.sin(Math.PI * v), z]; }, 36, 24, .018), carbon, '大型后扩散器上扬底板', 'aero', [0, 0, 0], [.43, -.08, 0]);
  add(box(.15, .065, 1.20, .024), carbon, '扩散器上方四喷口横梁', 'thruster', [2.26, .433, 0], [.44, .02, 0]);
  for (const sign of [-1, 1]) add(prism([[1.68, .135, sign * .64], [2.36, .26, sign * .64], [2.31, .45, sign * .62], [1.87, .405, sign * .58]], [0, 0, -sign * .024]), carbon, `${sign > 0 ? '右' : '左'}扩散器外侧导板`, 'aero', [0, 0, 0], [.43, -.08, sign * .04]);
  const fins = [];
  for (const z of [-.40, -.20, 0, .20, .40]) fins.push(prism([[1.66, .15, z], [2.34, .26, z], [2.30, .375, z], [1.91, .305, z]], [0, 0, .012]));
  add(merge(fins), carbon, '后扩散器连续纵向导流片', 'aero', [0, 0, 0], [.43, -.08, 0]);
  for (const z of [-.33, -.11, .11, .33]) {
    const n = new THREE.Group(); n.position.set(2.337, .429, z);
    const bell = lathe([[.028, -.045], [.036, -.045], [.039, -.004], [.037, .009], [.032, .009], [.028, -.035], [.028, -.045]], 64); bell.rotateZ(-Math.PI / 2);
    n.add(new THREE.Mesh(bell, titanium));
    const back = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, .006, 48), satin); back.rotation.z = Math.PI / 2; back.position.x = -.033; n.add(back);
    register(n, '中央四联冷气喷口', 'thruster', [.49, .02, 0]); nozzles.push({ position: [2.35, .429, z], direction: [1, 0, 0], kind: 'rear', mesh: n });
  }
  const plate = add(box(.022, .115, .235, .009), paintDark, '演示车 RDSTR 牌照', 'body', [2.315, .55, 0], [.48, .1, 0]);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 192; const c = canvas.getContext('2d'); c.fillStyle = '#bcc3c3'; c.fillRect(0, 0, 384, 192); c.strokeStyle = '#747f80'; c.lineWidth = 7; c.strokeRect(10, 10, 364, 172); c.font = '76px Georgia'; c.textAlign = 'center'; c.fillStyle = '#596669'; c.fillText('RDSTR', 192, 122);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const gm = new THREE.MeshStandardMaterial({ map: texture, roughness: .6 });
    const labelG = new THREE.PlaneGeometry(.218, .104); labelG.rotateY(Math.PI / 2); add(labelG, gm, 'RDSTR 牌照表面', 'body', [2.327, .55, 0], [.48, .1, 0]);
  }

  // Wide tires, deep black rims and tapered spokes. Tread relief is a material
  // detail; no little boxes protrude from the tire silhouette.
  for (const axle of [frontAxle, rearAxle]) for (const sign of [-1, 1]) {
    const rear = axle > 0, radius = rear ? .373 : .365, half = rear ? .165 : .148, centerZ = rear ? .89 : .865;
    const wheel = new THREE.Group(); wheel.position.set(axle, radius, sign * centerZ); wheel.userData.radius = radius;
    const tireProfile = [[.265, -half + .018], [.288, -half], [.329, -half - .001], [radius - .010, -half + .023], [radius, -half + .060], [radius, half - .060], [radius - .010, half - .023], [.329, half + .001], [.288, half], [.265, half - .018], [.265, -half + .018]];
    const tg = lathe(tireProfile, 128); tg.rotateX(Math.PI / 2); wheel.add(new THREE.Mesh(tg, rubber));
    const barrel = lathe([[.263, -half + .015], [.280, -half + .015], [.282, -half + .031], [.270, -half + .047], [.270, half - .047], [.282, half - .031], [.280, half - .015], [.263, half - .015], [.263, -half + .015]], 112); barrel.rotateX(Math.PI / 2); wheel.add(new THREE.Mesh(barrel, graphite));
    const rimLip = new THREE.TorusGeometry(.277, .0043, 8, 128); rimLip.translate(0, 0, sign * (half - .020)); wheel.add(new THREE.Mesh(rimLip, titanium));
    // The public imagery establishes a ventilated performance brake, but not
    // this drilling pattern. Small closed bores and a separate hat are detail
    // for the visual study, with no asserted rotor specification.
    const rotorShape = new THREE.Shape(); rotorShape.moveTo(.237, 0);
    for (let k = 1; k <= 96; k++) { const a = k / 96 * Math.PI * 2; rotorShape.lineTo(Math.cos(a) * .237, Math.sin(a) * .237); } rotorShape.closePath();
    for (const [ring, phase] of [[.188, 0], [.216, .5]]) for (let k = 0; k < 24; k++) {
      const a = (k + phase) / 24 * Math.PI * 2, cx = Math.cos(a) * ring, cy = Math.sin(a) * ring, h = new THREE.Path();
      for (let j = 0; j <= 8; j++) { const b = -j / 8 * Math.PI * 2, x = cx + Math.cos(b) * .0039, y = cy + Math.sin(b) * .0039; if (!j) h.moveTo(x, y); else h.lineTo(x, y); } h.closePath(); rotorShape.holes.push(h);
    }
    const disc = new THREE.ExtrudeGeometry(rotorShape, { depth: .016, bevelEnabled: false, curveSegments: 1, steps: 1 }); disc.translate(0, 0, sign * .061 - .008); wheel.add(new THREE.Mesh(disc, brakeMat));
    const hat = new THREE.CylinderGeometry(.085, .085, .020, 64); hat.rotateX(Math.PI / 2); hat.translate(0, 0, sign * .075); wheel.add(new THREE.Mesh(hat, titanium));
    const spokes = [];
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * Math.PI * 2, shape = new THREE.Shape();
      shape.moveTo(-.012, .043); shape.lineTo(.013, .043); shape.lineTo(.025, .245); shape.lineTo(.015, .269); shape.lineTo(-.004, .257); shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: .014, bevelEnabled: true, bevelThickness: .0018, bevelSize: .0018, bevelSegments: 2, curveSegments: 3, steps: 1 });
      const pp = g.attributes.position;
      for (let i = 0; i < pp.count; i++) pp.setZ(i, half - .078 + .042 * clamp(pp.getY(i) / .269) + pp.getZ(i));
      g.computeVertexNormals(); if (sign < 0) g.rotateY(Math.PI); g.rotateZ(a); spokes.push(g);
    }
    wheel.add(new THREE.Mesh(merge(spokes), graphite));
    const hub = new THREE.CylinderGeometry(.047, .047, .024, 64); hub.rotateX(Math.PI / 2); hub.translate(0, 0, sign * (half - .056)); wheel.add(new THREE.Mesh(hub, graphite));
    const boltGeos = [];
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; const g = new THREE.CylinderGeometry(.005, .005, .004, 8); g.rotateX(Math.PI / 2); g.translate(Math.cos(a) * .036, Math.sin(a) * .036, sign * (half - .041)); boltGeos.push(g); }
    wheel.add(new THREE.Mesh(merge(boltGeos), titanium));
    const beadRings = [];
    for (const rr of [.292, .332]) { const g = new THREE.TorusGeometry(rr, .0007, 4, 112); g.translate(0, 0, sign * (half + (rr > .31 ? -.001 : .001))); beadRings.push(g); }
    wheel.add(new THREE.Mesh(merge(beadRings), rubber));
    const caliper = new THREE.Mesh(box(.052, .164, .045, .012), graphite); caliper.position.set(.176, .041, sign * .079); caliper.userData.fixedBrake = caliper.position.clone(); wheel.add(caliper);
    register(wheel, `${rear ? '后' : '前'}${sign > 0 ? '右' : '左'}宽胎与深色细辐轮圈`, 'wheels', [0, 0, sign * .95], 'B/C · 胎面与细辐轮廓按官方画面；轮圈倒角、制动盘孔位和尺寸为视觉估计'); wheels.push(wheel);
    // Liner follows the same arch radius and remains hidden inside the body edge.
    const liner = skin((u, v) => { const a = Math.PI * u, x = axle + archR * Math.cos(a), y = .362 + archR * Math.sin(a), outside = sideZ(x, y) - .022, z = sign * lerp(.79, outside, v); return [x, y, z]; }, 96, 6, .007, [0, -1, 0]);
    add(liner, satin, `${rear ? '后' : '前'}${sign > 0 ? '右' : '左'}轮拱内衬`, 'body', [0, 0, 0], [0, 0, sign * .5]);
  }

  add(box(3.61, .055, 1.35, .02), carbon, '封闭下部平台', 'body', [0, .15, 0], [0, -.10, 0]);
  // Only a small explanatory internal set is retained; none shapes the exterior.
  const vessels = new THREE.Group(); vessels.position.set(.38, .48, 0);
  for (const z of [-.23, .23]) { const g = lathe([[0, -.46], [.08, -.45], [.13, -.39], [.145, -.28], [.145, .28], [.13, .39], [.08, .45], [0, .46]], 64); g.rotateZ(Math.PI / 2); g.translate(0, 0, z); vessels.add(new THREE.Mesh(g, carbon)); }
  register(vessels, '储气容器 · 布局原理示意', 'internal', [0, .48, 0], assumed, group, true);
  const fanGroup = new THREE.Group(); fanGroup.position.set(-.24, .23, 0);
  for (const x of [-.28, .28]) {
    const ring = new THREE.Mesh(lathe([[.195, -.025], [.216, -.025], [.216, .025], [.195, .025], [.195, -.025]], 64), graphite); ring.position.x = x; fanGroup.add(ring);
    const rot = new THREE.Group(); rot.position.x = x; const bladeGeos = [];
    for (let k = 0; k < 9; k++) { const g = box(.065, .012, .126, .005); g.rotateZ(.24); g.translate(0, 0, .12); g.rotateY(k / 9 * Math.PI * 2); bladeGeos.push(g); }
    rot.add(new THREE.Mesh(merge(bladeGeos), titanium)); fanGroup.add(rot); fanRotors.push(rot);
  }
  register(fanGroup, '车底抽吸风扇 · 原理示意', 'suction', [-.25, -.08, 0], assumed, group, true);
  for (const x of [-.81, .97]) for (const sign of [-1, 1]) {
    const n = new THREE.Mesh(lathe([[.018, .055], [.018, .05], [.03, .015], [.055, -.02], [.061, -.015], [.037, .025], [.026, .06], [.018, .055]], 48), titanium); n.position.set(x, .195, sign * .60);
    register(n, '向下冷气喷口 · 假设位置', 'thruster', [x < 0 ? -.15 : .15, -.08, sign * .3], assumed, group, true); liftNozzles.push(n); nozzles.push({ position: [x, .178, sign * .6], direction: [0, -1, 0], kind: 'lift', mesh: n });
  }

  for (const p of assemblies) { let k = 0; p.mesh.traverse(o => { if (o.isMesh) parts.push({ ...p, id: `${p.id}-${++k}`, mesh: o, base: o.position.toArray(), assembly: p.id }); }); }
  function update(state = {}) {
    const e = clamp(Number(state.explode || 0)), deploy = clamp(Number(state.aeroDeploy ?? state.aero ?? 0)), dt = clamp(Number(state.dt || 0), 0, .05);
    for (const p of assemblies) p.mesh.position.set(...p.base.map((x, i) => x + p.explode[i] * e));
    const show = !!state.showInternal || e > .02;
    for (const m of internal) m.visible = show;
    spoiler.position.y += .15 * deploy; spoiler.rotation.z = -.045 * deploy; frontBlade.position.y -= .035 * deploy;
    if (!state.paused && dt) for (const w of wheels) { w.rotation.z -= Number(state.speed || 0) / w.userData.radius * dt; for (const m of w.children) if (m.userData.fixedBrake) { m.rotation.z = -w.rotation.z; m.position.copy(m.userData.fixedBrake).applyAxisAngle(new THREE.Vector3(0, 0, 1), -w.rotation.z); } }
    for (const r of fanRotors) r.rotation.y = Number(state.time || 0) * Number(state.fanPower || 0) * 3;
  }
  group.userData.dimensions = { length: 4.72, width: 2.12, height: 1.11, source: 'B/C · reference-proportioned estimates, not Tesla specifications' };
  group.userData.referenceSet = ['tesla-front.png', 'test-655.png', 'test-700.png', 'test-705.png', 'test-715.png', 'test-720.png'];
  group.userData.physicalPartCount = parts.length;
  return { group, parts, assemblies, aero, wheels, nozzles, internal, update };
}
