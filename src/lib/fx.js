// 三维场景通用工具：光子、发光线、标签、玻璃材质、路径采样
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/** 信号光的颜色（HDR 倍数越大越亮、辉光越强） */
export const LIGHT_HEX = '#2f8cff';
export function lightColor(intensity = 3, hex = LIGHT_HEX) {
  return new THREE.Color(hex).multiplyScalar(intensity);
}

let _glow = null;
/** 径向发光贴图（功能性渐变，只用于光点） */
export function glowTexture() {
  if (_glow) return _glow;
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.22)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  _glow = new THREE.CanvasTexture(c);
  _glow.colorSpace = THREE.SRGBColorSpace;
  return _glow;
}

/** 一个发光光点 */
export function photon(color = lightColor(3), size = 0.5, opacity = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

function flat(points) {
  const a = new Float32Array(points.length * 3);
  points.forEach((p, i) => {
    a[i * 3] = p.x;
    a[i * 3 + 1] = p.y;
    a[i * 3 + 2] = p.z || 0;
  });
  return a;
}

/** 有宽度的线（像素宽度），可虚线、可叠加发光 */
export function line(points, opts = {}) {
  const { color = '#ffffff', width = 2, opacity = 1, dashed = false, dash = 0.3, gap = 0.2, additive = false } = opts;
  const g = new LineGeometry();
  g.setPositions(flat(points));
  const m = new LineMaterial({
    color: color instanceof THREE.Color ? color : new THREE.Color(color),
    linewidth: width,
    transparent: true,
    opacity,
    dashed,
    dashSize: dash,
    gapSize: gap,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const l = new Line2(g, m);
  l.computeLineDistances();
  l.frustumCulled = false;
  return l;
}

/** 替换一条线的顶点 */
export function setLine(l, points) {
  l.geometry.dispose();
  const g = new LineGeometry();
  g.setPositions(flat(points.length >= 2 ? points : [points[0] || new THREE.Vector3(), points[0] || new THREE.Vector3()]));
  l.geometry = g;
  l.computeLineDistances();
}

/** CSS2D 标签 */
export function label(html, cls = '') {
  const el = document.createElement('div');
  el.className = 'lbl ' + cls;
  el.innerHTML = html;
  const o = new CSS2DObject(el);
  o.userData.el = el;
  return o;
}

/** 玻璃材质（半透明，不写深度） */
export function glass(color = '#9fc6ff', opacity = 0.16, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.1,
    metalness: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    ...extra,
  });
}

/** 新场景：暗色舞台 + 环境反射 + 柔和布光 */
export function makeScene(ctx) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050507);
  scene.environment = ctx.env;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a22, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(6, 10, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc6ff, 0.6);
  rim.position.set(-8, 3, -6);
  scene.add(rim);
  return scene;
}

export function makeCamera(pos, target, fov = 38) {
  const cam = new THREE.PerspectiveCamera(fov, 1, 0.05, 500);
  cam.position.copy(pos);
  cam.userData.home = { pos: pos.clone(), target: target.clone() };
  return cam;
}

/** 漂浮微尘，给暗色舞台一点空气感 */
export function dust(count = 300, size = [30, 16, 20]) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    p[i * 3] = (Math.random() - 0.5) * size[0];
    p[i * 3 + 1] = (Math.random() - 0.5) * size[1];
    p[i * 3 + 2] = (Math.random() - 0.5) * size[2];
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({
    size: 0.05,
    color: 0x8e8e93,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const pts = new THREE.Points(g, m);
  pts.userData.tick = (dt) => {
    pts.rotation.y += dt * 0.01;
  };
  return pts;
}

/** 折线路径：按弧长取点 */
export class Polyline {
  constructor(points) {
    this.pts = points;
    this.cum = [0];
    for (let i = 1; i < points.length; i++) this.cum.push(this.cum[i - 1] + points[i].distanceTo(points[i - 1]));
    this.length = this.cum[this.cum.length - 1];
  }
  index(d) {
    let lo = 0;
    let hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= d) lo = mid;
      else hi = mid;
    }
    return lo;
  }
  at(d, out = new THREE.Vector3()) {
    d = Math.max(0, Math.min(this.length, d));
    const i = this.index(d);
    const seg = this.cum[i + 1] - this.cum[i] || 1;
    return out.lerpVectors(this.pts[i], this.pts[Math.min(i + 1, this.pts.length - 1)], (d - this.cum[i]) / seg);
  }
  tangent(d, out = new THREE.Vector3()) {
    const i = this.index(Math.max(0, Math.min(this.length - 1e-6, d)));
    return out.subVectors(this.pts[Math.min(i + 1, this.pts.length - 1)], this.pts[i]).normalize();
  }
}

/** 圆弧点（xy 平面） */
export function arcPoints(cx, cy, r, a0, a1, n = 32, z = 0) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(new THREE.Vector3(cx + r * Math.cos(a), cy + r * Math.sin(a), z));
  }
  return pts;
}

/** 隐藏场景里的所有 CSS2D 标签（切换章节时用） */
export function hideLabels(scene) {
  scene.traverse((o) => {
    if (o.isCSS2DObject) o.element.style.display = 'none';
  });
}

export const deg = (r) => (r * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export { THREE };
