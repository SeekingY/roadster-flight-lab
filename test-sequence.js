/**
 * Official demonstration playback, NOT a force/energy simulation.
 * Evidence: Tesla official video https://www.youtube.com/watch?v=qt5p-_tE8d0
 * The root task inspected frames at 11:00–12:04 and 15:35–16:01. Observations are
 * screen telemetry; geometry and the continuous trajectory are visual estimates.
 *
 * Conventions: metres / seconds / radians; nose = local -X, up = +Y.
 * pitch > 0 means nose up; Three.js vehicle.rotation.z = -sample.pitch.
 * roll is about the nose axis (-X); yaw is about world +Y.
 */
const PI = Math.PI;
const DEG = PI / 180;
const FT = 0.3048;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const vadd = (a, b) => a.map((v, i) => v + b[i]);
const vsub = (a, b) => a.map((v, i) => v - b[i]);
const vmul = (a, k) => a.map(v => v * k);
const vlength = a => Math.hypot(...a);

export const TRACK = Object.freeze({
  radius: 10.3,
  angle: 170 * DEG,
  terminalLength: 3.2,
  entryLength: 15,
  width: 3.2,
  surfaceThickness: 0.18,
  axleFront: -1.43,
  axleRear: 1.42,
  // Match car-v2.js; these remain model dimensions, not Tesla measurements.
  frontTireRadius: 0.365,
  rearTireRadius: 0.373,
  tireRadius: 0.369,
  frontHalfTrack: 0.865,
  rearHalfTrack: 0.89,
  tireHalfTrack: 0.8775,
  get arcLength() { return this.radius * this.angle; },
  get maxS() { return this.arcLength + this.terminalLength; },
  get height() { return this.radius * (1 - Math.cos(this.angle)) + this.terminalLength * Math.sin(this.angle); },
  provenance: '公开画面比例估计；非公布尺寸。170°弧后短切线段支撑两轴，非完整环道。',
});

export const OBSERVATIONS = Object.freeze([
  { videoTime: 660, pitchDeg: 0, altitudeFt: 0, downforceKg: null, phase: '进入巨型 C 坡' },
  { videoTime: 665, pitchDeg: 0.8, altitudeFt: 0, downforceKg: 11.0, phase: '驶上弯道入口' },
  { videoTime: 670, pitchDeg: 57.3, altitudeFt: 12.8, downforceKg: 993, phase: '沿轨爬升' },
  { videoTime: 675, pitchDeg: 109, altitudeFt: 39.8, downforceKg: 4386, phase: '越过垂直面' },
  { videoTime: 680, pitchDeg: 170, altitudeFt: 65.9, downforceKg: 4689, phase: '倒挂接近顶端' },
  { videoTime: 685, pitchDeg: 170, altitudeFt: 68.8, downforceKg: 4700, phase: '倒挂停留' },
  { videoTime: 690, pitchDeg: 157, altitudeFt: 58.1, downforceKg: 4697, phase: '倒车返回坡面' },
  { videoTime: 695, pitchDeg: 62.5, altitudeFt: 31.2, downforceKg: 4254, phase: '倒车下降' },
  { videoTime: 700, pitchDeg: 0, altitudeFt: 0, downforceKg: null, phase: '回到坡底' },
  { videoTime: 705, pitchDeg: 0, altitudeFt: 0, phase: '准备第二次爬升' },
  { videoTime: 710, pitchDeg: null, altitudeFt: 35, phase: '第二次爬升' },
  { videoTime: 712, pitchDeg: null, altitudeFt: 62, gForce: 1.1, phase: '接近坡顶、轮胎仍贴轨' },
  { videoTime: 713, pitchDeg: null, altitudeFt: 67.5, gForce: 0.2, phase: '离轨后继续俯仰翻转' },
  { videoTime: 714, pitchDeg: null, altitudeFt: 62.2, gForce: 0.3, phase: '翻正、背向坡面平移' },
  { videoTime: 715, pitchDeg: null, altitudeFt: 21.4, gForce: 3.3, phase: '正立下降、冷气制动白雾' },
  { videoTime: 716, pitchDeg: null, altitudeFt: 7.7, gForce: 0.3, phase: '进入近地白雾' },
  { videoTime: 717, pitchDeg: 0, altitudeFt: 0, phase: '接地时刻约值' },
  { videoTime: 720, pitchDeg: 0, altitudeFt: 0, phase: '正立落地' },
].map(Object.freeze));

export const KICKFLIP_OBSERVATIONS = Object.freeze([
  { videoTime: 935, pitchDeg: null, altitudeFt: 0, altitudeEvidence: '画面接地观察', phase: '沿白中线接近横向车队' },
  { videoTime: 940, pitchDeg: null, altitudeFt: 0, altitudeEvidence: '画面接地观察', phase: '平地驶近障碍' },
  { videoTime: 945, pitchDeg: null, altitudeFt: 0, altitudeEvidence: '画面接地观察', phase: '保持正向接近' },
  { videoTime: 947, pitchDeg: null, altitudeFt: 0, altitudeEvidence: '画面接地观察', phase: '接近车队与 Semi' },
  { videoTime: 948, pitchDeg: null, altitudeFt: 0, gForce: 1.0, phase: '仍在地面' },
  { videoTime: 949, pitchDeg: null, altitudeFt: 31, gForce: 0.6, altitudeApproximate: true, altitudeEvidence: '画面约31 ft；播放器控件遮挡部分字形', phase: '空中沿车长轴侧滚' },
  { videoTime: 950, pitchDeg: null, altitudeFt: 23.9, gForce: 0.2, phase: '底盘可见、三束冷气喷流' },
  { videoTime: 951, pitchDeg: null, altitudeFt: 19.8, gForce: 0.7, phase: '白雾中继续下降' },
  { videoTime: 952, pitchDeg: null, altitudeFt: 3.4, gForce: 0.9, phase: '接近地面' },
  { videoTime: 953, pitchDeg: null, altitudeFt: 0, altitudeApproximate: true, altitudeEvidence: '接地时刻约值', phase: '约此时接地' },
  { videoTime: 955, pitchDeg: null, altitudeFt: 0, altitudeEvidence: '画面接地观察', phase: '白雾散去，继续向前' },
  { videoTime: 961, pitchDeg: null, altitudeFt: 0, altitudeEvidence: '画面接地观察', phase: '结束此段重放' },
].map(Object.freeze));

export const KICKFLIP_COURSE = Object.freeze({
  startPosition: Object.freeze([42, 0, 0]),
  endPosition: Object.freeze([-35, 0, 0]),
  obstaclePlaneX: 0,
  obstacleBandX: Object.freeze([-3, 3]),
  direction: Object.freeze([-1, 0, 0]),
  corridorZ: 0,
  takeoffTime: 13.15,
  landingTime: 18,
  provenance: '横向车队/Semi为视频场景；绝对坐标、跨度与滚转角仅为视觉近似。此段不用C坡。',
});

export const SEQUENCE_INFO = Object.freeze({
  source: 'https://www.youtube.com/watch?v=qt5p-_tE8d0',
  kind: 'observed-video-playback',
  label: '官方演示动作重放 · 轨迹近似，非实时飞行动力学',
  full: Object.freeze({ duration: 64, videoStart: 660, available: true }),
  inversion: Object.freeze({ duration: 45, videoStart: 660, available: true }),
  flight: Object.freeze({ duration: 19, videoStart: 705, available: true }),
  kickflip: Object.freeze({ duration: 26, videoStart: 935, available: true }),
});

/** s is surface travel measured from the flat-to-curve join; positive climbs. */
export function sampleTrack(s, widthOffset = 0) {
  s = finite(s);
  let x, y, angle;
  if (s < 0) {
    x = -s; y = 0; angle = 0;
  } else if (s <= TRACK.arcLength) {
    angle = s / TRACK.radius;
    x = -TRACK.radius * Math.sin(angle);
    y = TRACK.radius * (1 - Math.cos(angle));
  } else {
    angle = TRACK.angle;
    const d = s - TRACK.arcLength;
    x = -TRACK.radius * Math.sin(angle) - d * Math.cos(angle);
    y = TRACK.radius * (1 - Math.cos(angle)) + d * Math.sin(angle);
  }
  return {
    position: [x, y, finite(widthOffset)],
    tangent: [-Math.cos(angle), Math.sin(angle), 0],
    normal: [Math.sin(angle), Math.cos(angle), 0],
    angle, s,
    onBuiltTrack: s >= -TRACK.entryLength && s <= TRACK.maxS,
  };
}

/** Use these same surface vertices to build the scene track. */
export function createTrackSamples(segments = 220) {
  const count = Math.max(8, Math.floor(finite(segments, 220)));
  return Array.from({ length: count + 1 }, (_, i) => {
    const s = -TRACK.entryLength + (TRACK.entryLength + TRACK.maxS) * i / count;
    const center = sampleTrack(s);
    return { ...center, left: sampleTrack(s, -TRACK.width / 2).position, right: sampleTrack(s, TRACK.width / 2).position };
  });
}

function wheelCenter(s, radius) {
  const p = sampleTrack(s);
  return vadd(p.position, vmul(p.normal, radius));
}

/**
 * Solve the rigid wheelbase against the offset track curve. Both wheel centres
 * are exactly one tire radius from their surface contacts, including the entry
 * transition. This avoids placing a tangent-oriented car through the curved rail.
 */
export function sampleTrackPose(s) {
  s = finite(s);
  const wheelbase = TRACK.axleRear - TRACK.axleFront;
  const dy = TRACK.frontTireRadius - TRACK.rearTireRadius;
  const centerDistance = Math.hypot(wheelbase, dy);
  let lo = 0, hi = wheelbase;
  for (let i = 0; i < 36; i++) {
    const d = (lo + hi) * 0.5;
    if (vlength(vsub(wheelCenter(s + d, TRACK.frontTireRadius), wheelCenter(s - d, TRACK.rearTireRadius))) < centerDistance) lo = d;
    else hi = d;
  }
  const d = (lo + hi) * 0.5;
  const frontS = s + d, rearS = s - d;
  const frontCenter = wheelCenter(frontS, TRACK.frontTireRadius), rearCenter = wheelCenter(rearS, TRACK.rearTireRadius);
  const diff = vsub(frontCenter, rearCenter);
  // Front/rear wheel radii differ in v2: solve the rigid rotation using the
  // actual local axle-centre vector rather than pretending its Y component is 0.
  const pitch = -Math.atan2(-wheelbase * diff[1] - dy * diff[0], -wheelbase * diff[0] + dy * diff[1]);
  const localX = [Math.cos(pitch), -Math.sin(pitch), 0], localY = [Math.sin(pitch), Math.cos(pitch), 0];
  const midpoint = vmul(vadd(frontCenter, rearCenter), 0.5);
  const axleMidX = (TRACK.axleFront + TRACK.axleRear) * 0.5;
  const position = vsub(vsub(midpoint, vmul(localX, axleMidX)), vmul(localY, TRACK.tireRadius));
  const front = sampleTrack(frontS), rear = sampleTrack(rearS);
  const contacts = [front, rear].flatMap((p, axle) => [-1, 1].map(side => ({
    axle: axle === 0 ? 'front' : 'rear', side,
    position: [p.position[0], p.position[1], side * (axle === 0 ? TRACK.frontHalfTrack : TRACK.rearHalfTrack)],
    normal: [...p.normal], onTrack: p.onBuiltTrack,
  })));
  return { position, pitch, roll: 0, yaw: 0, s, contacts, frontS, rearS };
}

// Shape-preserving cubic interpolation prevents track travel overshoot at a stop.
function pchip(points, t) {
  if (t <= points[0][0]) return points[0][1];
  if (t >= points.at(-1)[0]) return points.at(-1)[1];
  const n = points.length, h = [], slopes = [], derivatives = [];
  for (let i = 0; i < n - 1; i++) { h[i] = points[i + 1][0] - points[i][0]; slopes[i] = (points[i + 1][1] - points[i][1]) / h[i]; }
  derivatives[0] = slopes[0]; derivatives[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) derivatives[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
      derivatives[i] = (w1 + w2) / (w1 / slopes[i - 1] + w2 / slopes[i]);
    }
  }
  let i = 0;
  while (points[i + 1][0] < t) i++;
  const u = (t - points[i][0]) / h[i], u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * points[i][1] + (u3 - 2 * u2 + u) * h[i] * derivatives[i]
    + (-2 * u3 + 3 * u2) * points[i + 1][1] + (u3 - u2) * h[i] * derivatives[i + 1];
}

const A = TRACK.arcLength;
const INVERSION_TRAVEL = [
  [0, -7], [5, 0], [10, TRACK.radius * 57.3 * DEG],
  [15, TRACK.radius * 109 * DEG], [20, A + 1.55],
  [23.5, A + 1.72], [25.5, A + 1.72], [30, TRACK.radius * 157 * DEG],
  [35, TRACK.radius * 62.5 * DEG], [40, -4.5], [45, -4.5],
];

/** Telemetry interpolation is visibly separate from the geometric trajectory. */
export function sampleObservedTelemetry(videoTime) {
  const records = videoTime >= 935 ? KICKFLIP_OBSERVATIONS : OBSERVATIONS;
  const t = clamp(finite(videoTime, 660), records[0].videoTime, records.at(-1).videoTime);
  let i = 0;
  while (i < records.length - 2 && records[i + 1].videoTime < t) i++;
  const a = records[i], b = records[i + 1];
  const f = clamp((t - a.videoTime) / (b.videoTime - a.videoTime), 0, 1);
  const interp = key => {
    if (f === 0) return Number.isFinite(a[key]) ? a[key] : null;
    if (f === 1) return Number.isFinite(b[key]) ? b[key] : null;
    return Number.isFinite(a[key]) && Number.isFinite(b[key]) ? a[key] + (b[key] - a[key]) * f : null;
  };
  const altitudeFt = interp('altitudeFt');
  return {
    videoTime: t, pitchDeg: interp('pitchDeg'), altitudeFt, gForce: interp('gForce'), downforceKg: interp('downforceKg'),
    altitudeM: altitudeFt === null ? null : altitudeFt * FT,
    sourceKind: 'official-video-screen-readout',
    interpolated: f > 0 && f < 1,
    sourceFrames: [a.videoTime, b.videoTime],
    altitudeApproximate: Boolean((f < 1 && a.altitudeApproximate) || (f > 0 && b.altitudeApproximate)),
    altitudeEvidence: f === 0 ? a.altitudeEvidence || '画面高度读数' : f === 1 ? b.altitudeEvidence || '画面高度读数' : '所列两帧之间的读数插值',
    label: '发布会画面读数（帧间插值），非本模型物理解算',
  };
}

function firstRun(t) {
  const s = pchip(INVERSION_TRAVEL, clamp(t, 0, 45));
  const pose = sampleTrackPose(s);
  const h = 0.01;
  const speed = (pchip(INVERSION_TRAVEL, clamp(t + h, 0, 45)) - pchip(INVERSION_TRAVEL, clamp(t - h, 0, 45))) / (2 * h);
  const phase = t < 5 ? '驶入弯道' : t < 16 ? '沿轨爬升' : t < 23.5 ? '进入倒挂姿态'
    : t < 25.5 ? '倒挂停留' : t < 39 ? '倒车沿轨返回' : '坡底停稳';
  return { ...pose, wheelTravel: s + 7, wheelSpeed: speed, contact: true, contactMode: 'track', plumePower: 0, phase, direction: Math.sign(speed), pending: false };
}

const RELEASE_TIME = 52.4;
const SECOND_TRAVEL = [
  [45, -4.5], [46.1, -4.5], [48, TRACK.radius * 42 * DEG],
  [50, TRACK.radius * 103 * DEG], [52, TRACK.radius * 162 * DEG],
  [RELEASE_TIME, A + 1.72],
];
const RELEASE = sampleTrackPose(A + 1.72);
const FLIGHT_X = [
  [RELEASE_TIME, RELEASE.position[0]], [53, RELEASE.position[0] + 3.5],
  [54, RELEASE.position[0] + 9.3], [55, RELEASE.position[0] + 15],
  [56, RELEASE.position[0] + 19.5], [57, RELEASE.position[0] + 22.4],
  [59, RELEASE.position[0] + 24.8], [64, RELEASE.position[0] + 24.8],
];
const FLIGHT_Y = [
  // First positional derivative follows the terminal tangent, then follows the
  // observed descent envelope. This is deliberately a replay, not ballistics.
  [RELEASE_TIME, RELEASE.position[1]],
  [52.5, RELEASE.position[1] + (3.5 / 0.6) * Math.tan(10 * DEG) * 0.1],
  [52.8, RELEASE.position[1] + 0.21],
  [53, 67.5 * FT], [54, 62.2 * FT], [55, 21.4 * FT],
  [56, 7.7 * FT], [57, 0], [64, 0],
];
const FLIGHT_PITCH = [
  [RELEASE_TIME, RELEASE.pitch], [53, 250 * DEG], [54, 350 * DEG],
  [54.6, 360 * DEG], [64, 360 * DEG],
];
const FLIGHT_PLUME = [
  [RELEASE_TIME, 0], [52.7, 0.4], [53, 0.52], [54, 0.45],
  [54.65, 0.82], [55, 1], [56, 0.95], [57, 0.58], [58.5, 0], [64, 0],
];

function secondRun(t) {
  if (t <= RELEASE_TIME) {
    const s = pchip(SECOND_TRAVEL, t), pose = sampleTrackPose(s), h = 0.01;
    const speed = (pchip(SECOND_TRAVEL, Math.min(RELEASE_TIME, t + h)) - pchip(SECOND_TRAVEL, Math.max(45, t - h))) / (2 * h);
    return {
      ...pose, wheelTravel: s + 7, wheelSpeed: speed, contact: true,
      contactMode: 'track', plumePower: 0, direction: Math.sign(speed), pending: false,
      phase: t < 46.1 ? '第二次起步准备' : t < 51.5 ? '再次沿轨爬升' : '接近坡顶 · 接触即将释放',
    };
  }
  const x = pchip(FLIGHT_X, t), height = pchip(FLIGHT_Y, t);
  const pitch = pchip(FLIGHT_PITCH, t), groundContact = t >= 57;
  const h = 0.01;
  const vx = (pchip(FLIGHT_X, Math.min(64, t + h)) - pchip(FLIGHT_X, Math.max(RELEASE_TIME, t - h))) / (2 * h);
  const vy = (pchip(FLIGHT_Y, Math.min(64, t + h)) - pchip(FLIGHT_Y, Math.max(RELEASE_TIME, t - h))) / (2 * h);
  const groundTravel = x - pchip(FLIGHT_X, 57);
  return {
    position: [x, height, 0], pitch, roll: 0, yaw: 0, s: null,
    contacts: groundContact ? [TRACK.axleFront, TRACK.axleRear].flatMap((axleX, i) => [-1, 1].map(side => ({
      axle: i === 0 ? 'front' : 'rear', side,
      position: [x + axleX, 0, side * (i === 0 ? TRACK.frontHalfTrack : TRACK.rearHalfTrack)], normal: [0, 1, 0], onTrack: false,
    }))) : [],
    wheelTravel: A + 1.72 + 7 - (groundContact ? groundTravel : 0),
    wheelSpeed: groundContact ? -vx : 0,
    contact: groundContact, contactMode: groundContact ? 'ground' : 'air',
    plumePower: pchip(FLIGHT_PLUME, t),
    groundMist: t >= 54.6 && t <= 58.5 ? pchip(FLIGHT_PLUME, t) : 0,
    velocity: [vx, vy, 0], direction: -1, pending: false,
    phase: t < 53.4 ? '离轨 · 继续俯仰翻转' : t < 54.7 ? '翻至正立 · 背向坡面平移'
      : t < 57 ? '冷气制动 · 正立下降' : t < 59 ? '后退着陆 · 白雾散去' : '着陆停稳',
    attitudeProvenance: '由713–716秒画面估计：170°继续俯仰到360°，无偏航掉头。',
  };
}

const KICKFLIP_X = [
  [0, 42], [5, 34], [10, 20], [12, 12], [13, 7], [13.15, 6.2],
  [14, 2], [15, -4], [16, -10], [17, -17], [18, -23], [21, -30], [26, -35],
];
const KICKFLIP_Y = [
  [0, 0], [13.15, 0], [13.4, 2.2], [14, 31 * FT],
  [15, 23.9 * FT], [16, 19.8 * FT], [17, 3.4 * FT], [18, 0], [26, 0],
];
const KICKFLIP_ROLL = [
  [0, 0], [13.3, 0], [14, 95 * DEG], [15, 220 * DEG],
  [16, 330 * DEG], [16.6, 360 * DEG], [26, 360 * DEG],
];
const KICKFLIP_PLUME = [
  [0, 0], [12.95, 0], [13.25, 0.88], [14, 0.55], [15, 0.72],
  [15.6, 1], [16.5, 0.95], [17.2, 0.72], [18, 0.4], [19.5, 0], [26, 0],
];

function kickflipRun(t) {
  const x = pchip(KICKFLIP_X, t), y = pchip(KICKFLIP_Y, t);
  const contact = t <= KICKFLIP_COURSE.takeoffTime || t >= KICKFLIP_COURSE.landingTime;
  const h = 0.01;
  const vx = (pchip(KICKFLIP_X, Math.min(26, t + h)) - pchip(KICKFLIP_X, Math.max(0, t - h))) / (2 * h);
  const vy = (pchip(KICKFLIP_Y, Math.min(26, t + h)) - pchip(KICKFLIP_Y, Math.max(0, t - h))) / (2 * h);
  const takeoffX = pchip(KICKFLIP_X, KICKFLIP_COURSE.takeoffTime);
  const landingX = pchip(KICKFLIP_X, KICKFLIP_COURSE.landingTime);
  const wheelTravel = t <= KICKFLIP_COURSE.takeoffTime ? 42 - x
    : 42 - takeoffX + (t >= KICKFLIP_COURSE.landingTime ? landingX - x : 0);
  return {
    position: [x, y, 0], pitch: 0, roll: pchip(KICKFLIP_ROLL, t), yaw: 0,
    s: null, contact, contactMode: contact ? 'ground' : 'air',
    contacts: contact ? [TRACK.axleFront, TRACK.axleRear].flatMap((axleX, i) => [-1, 1].map(side => ({
      axle: i === 0 ? 'front' : 'rear', side,
      position: [x + axleX, 0, side * (i === 0 ? TRACK.frontHalfTrack : TRACK.rearHalfTrack)],
      normal: [0, 1, 0], onTrack: false,
    }))) : [],
    wheelTravel, wheelSpeed: contact ? -vx : 0,
    plumePower: pchip(KICKFLIP_PLUME, t),
    groundMist: t >= 15.6 && t <= 19.5 ? pchip(KICKFLIP_PLUME, t) : 0,
    velocity: [vx, vy, 0], direction: 1, pending: false,
    phase: t < 12 ? '沿白中线接近横向车队' : t <= 13.15 ? '平地接近 · 准备起跳'
      : t < 14.4 ? '离地侧滚 · 跨越车队前缘' : t < 16.6 ? '完整滚转 · 冷气姿态调整'
        : t < 18 ? '翻正下降 · 近地白雾' : t < 19.5 ? '正向接地 · 白雾散去' : '继续前进',
    attitudeProvenance: '947–952秒画面确认沿车长轴完整侧滚；连续位置、滚转角与方向为视觉近似。',
  };
}

/** Deterministic sampler. No timers, physics mutations, or runtime dependencies. */
export function sampleSequence(time = 0, mode = 'full') {
  mode = Object.hasOwn(SEQUENCE_INFO, mode) && typeof SEQUENCE_INFO[mode] === 'object' ? mode : 'full';
  const info = SEQUENCE_INFO[mode];
  const t = clamp(finite(time), 0, info.duration);
  const fullTime = mode === 'flight' ? t + 45 : t;
  const sample = mode === 'kickflip' ? kickflipRun(t) : fullTime > 45 ? secondRun(fullTime) : firstRun(fullTime);
  const videoTime = info.videoStart === null ? null : info.videoStart + t;
  return {
    ...sample, time: t, duration: info.duration, mode, videoTime,
    telemetry: videoTime === null ? null : sampleObservedTelemetry(videoTime),
    done: t >= info.duration, playback: true,
    provenance: '动作依官方视频观察；连续位置/轨道尺寸为视觉估计，非真实实时动力学。',
  };
}

export function createTestSequence(mode = 'full') {
  let time = 0;
  let state = sampleSequence(time, mode);
  return {
    get state() { return state; },
    get mode() { return mode; },
    sample: (t, selectedMode = mode) => sampleSequence(t, selectedMode),
    reset(selectedMode = mode) { mode = selectedMode; time = 0; return state = sampleSequence(time, mode); },
    seek(t) { time = Math.max(0, finite(t)); return state = sampleSequence(time, mode); },
    step(dt, running = true) { if (running && Number.isFinite(dt) && dt > 0) time += dt; state = sampleSequence(time, mode); time = state.time; return state; },
  };
}
