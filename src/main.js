import './tokens.css';
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { hideLabels } from './lib/fx.js';
import { h } from './lib/ui.js';

import overview from './chapters/overview.js';
import structure from './chapters/structure.js';
import tir from './chapters/tir.js';
import propagation from './chapters/propagation.js';
import modes from './chapters/modes.js';
import loss from './chapters/loss.js';
import link from './chapters/link.js';
import wdm from './chapters/wdm.js';

const CHAPTERS = [overview, structure, tir, propagation, modes, loss, link, wdm];

// ---------- 渲染器 ----------
const stage = document.getElementById('stage');
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const pmrem = new THREE.PMREMGenerator(renderer);
const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'label-layer';
stage.appendChild(labelRenderer.domElement);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.82);
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const controls = new OrbitControls(new THREE.PerspectiveCamera(), canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.8;

// ---------- 镜头飞行 ----------
let fly = null;
const ease = (t) => 1 - Math.pow(1 - t, 3);
function flyTo(pos, target, dur = 1.1) {
  const cam = current?.inst.camera;
  if (!cam) return;
  fly = {
    t: 0,
    dur,
    p0: cam.position.clone(),
    p1: pos.clone(),
    t0: controls.target.clone(),
    t1: target.clone(),
  };
}

const ctx = {
  env,
  renderer,
  flyTo,
  controls,
  stage,
  refreshTools: () => renderTools(),
};

// ---------- 章节 ----------
const nav = document.getElementById('nav');
const panel = document.getElementById('panel');
const tools = document.getElementById('stageTools');
const stageNum = document.getElementById('stageNum');
const stageTitle = document.getElementById('stageTitle');
const progress = document.getElementById('progress');

const instances = new Map();
let current = null;
let paused = false;

const navBtns = CHAPTERS.map((ch, i) =>
  h(
    'button',
    { class: 'nav-item', type: 'button', onClick: () => go(i) },
    h('span', { class: 'nav-num' }, String(i + 1).padStart(2, '0')),
    h('span', { class: 'nav-label' }, ch.title, h('span', { class: 'nav-sub' }, ch.sub)),
  ),
);
nav.append(...navBtns);

function getInstance(i) {
  if (!instances.has(i)) {
    const inst = CHAPTERS[i].create(ctx);
    inst.scene.add(inst.camera);
    instances.set(i, inst);
  }
  return instances.get(i);
}

function go(i, { push = true } = {}) {
  i = Math.max(0, Math.min(CHAPTERS.length - 1, i));
  if (current && current.index === i) return;
  if (current) {
    current.inst.leave && current.inst.leave();
    hideLabels(current.inst.scene);
  }
  const ch = CHAPTERS[i];
  const inst = getInstance(i);
  current = { index: i, ch, inst };
  fly = null;

  navBtns.forEach((b, k) => b.classList.toggle('active', k === i));
  navBtns[i].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  stageNum.textContent = String(i + 1).padStart(2, '0');
  stageTitle.textContent = ch.title;
  progress.textContent = `${i + 1} / ${CHAPTERS.length}`;
  document.title = `${ch.title} · 光纤通信原理`;

  // 面板
  const prev = i > 0 ? h('button', { class: 'btn', type: 'button', onClick: () => go(i - 1) }, '上一章') : h('span');
  const next =
    i < CHAPTERS.length - 1
      ? h('button', { class: 'btn btn-primary', type: 'button', onClick: () => go(i + 1) }, `下一章：${CHAPTERS[i + 1].title}`)
      : h('button', { class: 'btn btn-primary', type: 'button', onClick: () => go(0) }, '回到开头');
  panel.replaceChildren(...inst.panel, h('div', { class: 'next-row' }, prev, next));
  panel.scrollTop = 0;

  // 镜头
  const cam = inst.camera;
  controls.object = cam;
  if (!inst._visited) {
    cam.position.copy(cam.userData.home.pos);
    controls.target.copy(cam.userData.home.target);
    inst._visited = true;
  } else {
    controls.target.copy(inst._target || cam.userData.home.target);
  }
  applyControlLimits(inst);
  resize();
  renderPass.scene = inst.scene;
  renderPass.camera = cam;

  renderTools();
  inst.enter && inst.enter();
  requestAnimationFrame(() => inst.redraw && inst.redraw());

  if (push) history.replaceState(null, '', '#' + ch.id);
}

function applyControlLimits(inst) {
  const l = inst.limits || {};
  controls.minDistance = l.minDistance ?? 2;
  controls.maxDistance = l.maxDistance ?? 80;
  controls.minPolarAngle = l.minPolar ?? 0;
  controls.maxPolarAngle = l.maxPolar ?? Math.PI;
  controls.minAzimuthAngle = l.minAzimuth ?? -Infinity;
  controls.maxAzimuthAngle = l.maxAzimuth ?? Infinity;
  controls.enablePan = l.pan ?? true;
  controls.autoRotate = !!inst.autoRotate;
  controls.autoRotateSpeed = inst.autoRotateSpeed || 0.6;
}

function renderTools() {
  if (!current) return;
  const inst = current.inst;
  const list = [...(inst.tools || [])];
  const btns = list.map((t) => {
    const b = h('button', { class: 'stage-btn' + (t.active ? ' active' : ''), type: 'button' }, t.label);
    b.addEventListener('click', () => {
      if (t.group) list.filter((o) => o.group === t.group).forEach((o) => (o.active = o === t));
      else if (t.toggle) t.active = !t.active;
      t.onClick && t.onClick(t.active);
      renderTools();
    });
    return b;
  });
  const pauseBtn = h('button', { class: 'stage-btn' + (paused ? ' active' : ''), type: 'button' }, paused ? '继续' : '暂停');
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    renderTools();
  });
  const resetBtn = h('button', { class: 'stage-btn', type: 'button' }, '重置视角');
  resetBtn.addEventListener('click', () => {
    const home = inst.camera.userData.home;
    flyTo(home.pos, home.target);
    (inst.tools || []).forEach((t) => {
      if (t.group === 'view') t.active = t.home === true;
    });
    renderTools();
  });
  tools.replaceChildren(...btns, pauseBtn, resetBtn);
}

// ---------- 尺寸 ----------
function resize() {
  const w = stage.clientWidth;
  const hh = stage.clientHeight;
  if (!w || !hh) return;
  renderer.setSize(w, hh, false);
  composer.setSize(w, hh);
  labelRenderer.setSize(w, hh);
  if (current) {
    const cam = current.inst.camera;
    cam.aspect = w / hh;
    // 舞台偏窄时放宽视野，保证章节声明的横向宽度（fitWidth）完整可见
    // 先适度放宽视野，仍不够就把“初始机位”沿视线往后退
    const base = cam.userData.baseFov || (cam.userData.baseFov = cam.fov);
    const home0 = cam.userData.home0 || (cam.userData.home0 = { pos: cam.userData.home.pos.clone(), target: cam.userData.home.target.clone() });
    const fitW = cam.userData.fitWidth;
    let fov = base;
    let newPos = home0.pos.clone();
    if (fitW) {
      const dist = home0.pos.distanceTo(home0.target);
      const hHalf = Math.atan(fitW / 2 / dist);
      const vfov = (2 * Math.atan(Math.tan(hHalf) / cam.aspect) * 180) / Math.PI;
      fov = Math.min(60, Math.max(base, vfov));
      const hHalfNow = Math.atan(Math.tan((fov * Math.PI) / 360) * cam.aspect);
      const need = fitW / 2 / Math.tan(hHalfNow);
      if (need > dist) newPos = home0.target.clone().add(home0.pos.clone().sub(home0.target).multiplyScalar(need / dist));
    }
    const atHome = cam.position.distanceTo(cam.userData.home.pos) < 1e-3;
    cam.userData.home.pos.copy(newPos);
    if (atHome) cam.position.copy(newPos);
    controls.maxDistance = Math.max(current.inst.limits?.maxDistance ?? 80, newPos.distanceTo(home0.target) * 1.4);
    cam.fov = fov;
    cam.updateProjectionMatrix();
    current.inst.resize && current.inst.resize(w, hh);
  }
}
new ResizeObserver(() => {
  resize();
  current?.inst.redraw && current.inst.redraw();
}).observe(stage);

// ---------- 主题 ----------
document.getElementById('themeBtn').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  if (dark) document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem('fiber-theme', dark ? 'dark' : 'light');
  } catch (e) {}
  current?.inst.redraw && current.inst.redraw();
});

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') go(current.index + 1);
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(current.index - 1);
  if (e.key === ' ') {
    e.preventDefault();
    paused = !paused;
    renderTools();
  }
});
window.addEventListener('hashchange', () => {
  const i = CHAPTERS.findIndex((c) => '#' + c.id === location.hash);
  if (i >= 0) go(i, { push: false });
});

// ---------- 循环 ----------
const clock = new THREE.Clock();
let simTime = 0;
function loop() {
  requestAnimationFrame(loop);
  const raw = Math.min(clock.getDelta(), 0.05);
  if (!current) return;
  const inst = current.inst;
  const dt = paused ? 0 : raw;
  simTime += dt;

  if (fly) {
    fly.t += raw / fly.dur;
    const k = ease(Math.min(1, fly.t));
    inst.camera.position.lerpVectors(fly.p0, fly.p1, k);
    controls.target.lerpVectors(fly.t0, fly.t1, k);
    if (fly.t >= 1) fly = null;
  }
  inst.update && inst.update(dt, simTime);
  inst.scene.traverse((o) => o.userData.tick && o.userData.tick(dt));
  controls.autoRotate = !!inst.autoRotate && !paused;
  controls.update(raw);
  (inst._target ||= new THREE.Vector3()).copy(controls.target);
  composer.render();
  labelRenderer.render(inst.scene, inst.camera);
}

window.__fiber = { instances, get current() { return current; }, go };
const start = CHAPTERS.findIndex((c) => '#' + c.id === location.hash);
go(start >= 0 ? start : 0, { push: false });
resize();
loop();
requestAnimationFrame(() => document.getElementById('loading').classList.add('done'));
