// 第 5 章 光纤类型与模式色散：阶跃多模 / 渐变多模 / 单模
import { THREE, makeScene, makeCamera, photon, lightColor, glass, label, line, dust } from '../lib/fx.js';
import { head, section, para, h, slider, toggle, chartCanvas, cssVar, note } from '../lib/ui.js';

const X0 = -10;
const FL = 20;
const V = 4; // 光沿路径的速度（场景单位/秒）
const CYCLE = 8.5;

const TYPES = [
  {
    key: 'step',
    name: '阶跃折射率多模光纤',
    short: '阶跃多模',
    y: 3.7,
    a: 0.9,
    modes: [0, 7, 13, 19, 25],
    desc: '纤芯折射率处处相同。不同角度的光线（不同“模式”）走的路程不一样长，斜着走的绕远路、到得晚。',
  },
  {
    key: 'graded',
    name: '渐变折射率多模光纤',
    short: '渐变多模',
    y: 0,
    a: 0.9,
    modes: [0, 0.3, 0.55, 0.78, 0.95],
    desc: '纤芯折射率从中心向外逐渐降低。光线被平滑地弯回轴线，走成波浪形；外圈折射率低、光跑得快，正好补偿了多走的路程。',
  },
  {
    key: 'single',
    name: '单模光纤',
    short: '单模',
    y: -3.7,
    a: 0.17,
    modes: [0],
    desc: '纤芯细到只容许一种模式（约 9 μm）。没有“快慢不同的路线”，脉冲几乎不展宽，是长途和骨干网的标准选择。',
  },
];

/** 每条光线：给定沿轴距离 s，返回横向偏移 y；以及轴向速度 */
function makeRay(type, m) {
  if (type.key === 'step') {
    const b = (m * Math.PI) / 180;
    const tb = Math.tan(b);
    const a = type.a;
    return {
      vx: V * Math.cos(b),
      y: (s) => {
        if (tb < 1e-6) return 0;
        const u = (s * tb) % (4 * a);
        return u < a ? u : u < 3 * a ? 2 * a - u : u - 4 * a;
      },
    };
  }
  if (type.key === 'graded') {
    const amp = m * type.a;
    const P = 5;
    return {
      vx: V * (1 - 0.0035 * m * m), // 自聚焦：几乎同时到达
      y: (s) => amp * Math.sin((2 * Math.PI * s) / P),
    };
  }
  return { vx: V, y: () => 0 };
}

export default {
  id: 'modes',
  title: '光纤类型与模式色散',
  sub: '多模 · 渐变 · 单模',
  create(ctx) {
    const scene = makeScene(ctx);
    const camera = makeCamera(new THREE.Vector3(-0.6, 1.2, 27), new THREE.Vector3(-0.6, 0, 0), 38);
    camera.userData.fitWidth = 27;

    const fibers = [];
    for (const T of TYPES) {
      const g = new THREE.Group();
      g.position.y = T.y;
      scene.add(g);
      const clad = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, FL, 64, 1, false).rotateZ(Math.PI / 2), glass('#d6e7ff', 0.07));
      clad.renderOrder = 1;
      g.add(clad);
      if (T.key === 'graded') {
        for (const k of [1, 0.75, 0.5, 0.25]) {
          const c = new THREE.Mesh(new THREE.CylinderGeometry(T.a * k, T.a * k, FL, 48, 1, true).rotateZ(Math.PI / 2), glass('#4c9dff', 0.07));
          c.renderOrder = 2;
          g.add(c);
        }
      } else {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(T.a, T.a, FL, 48, 1, true).rotateZ(Math.PI / 2), glass('#4c9dff', 0.2));
        c.renderOrder = 2;
        g.add(c);
      }
      for (const yy of [T.a, -T.a]) g.add(line([new THREE.Vector3(X0, yy, 0), new THREE.Vector3(X0 + FL, yy, 0)], { color: '#4c9dff', width: 1, opacity: 0.45 }));

      // 折射率分布 n(r)
      const prof = [];
      const xr = X0 - 1.2;
      const lv = (r) => {
        if (Math.abs(r) > T.a) return 0.3;
        if (T.key === 'graded') return 0.3 + 0.9 * (1 - (r / T.a) ** 2);
        return 1.2;
      };
      for (let i = 0; i <= 120; i++) {
        const r = -1.4 + (2.8 * i) / 120;
        prof.push(new THREE.Vector3(xr - lv(r), r, 0));
        if (T.key !== 'graded' && i < 120) {
          const r2 = -1.4 + (2.8 * (i + 1)) / 120;
          if (lv(r) !== lv(r2)) {
            const edge = Math.sign(r) * T.a;
            prof.push(new THREE.Vector3(xr - lv(r), edge, 0), new THREE.Vector3(xr - lv(r2), edge, 0));
          }
        }
      }
      g.add(line(prof, { color: '#f5f5f7', width: 1.6 }));
      g.add(line([new THREE.Vector3(xr, -1.5, 0), new THREE.Vector3(xr, 1.5, 0)], { color: '#636366', width: 1 }));
      const nl = label('n(r)', 'plain');
      nl.position.set(xr - 0.8, 1.85, 0);
      g.add(nl);

      const nameL = label(`<b>${T.name}</b>`, '');
      nameL.position.set(X0 + 3.2, 2.05, 0);
      g.add(nameL);

      // 终点探测器
      const det = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.25, 48).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2c2c2e', roughness: 0.5, metalness: 0.5, emissive: new THREE.Color('#2f8cff'), emissiveIntensity: 0 }));
      det.position.x = X0 + FL + 0.35;
      g.add(det);
      const detGlow = photon(lightColor(3), 2.2, 0);
      detGlow.position.x = X0 + FL + 0.2;
      g.add(detGlow);
      const timeL = label('', 'plain');
      timeL.position.set(X0 + FL + 1.1, -1.75, 0);
      g.add(timeL);

      // 光线
      const rays = T.modes.map((m, idx) => {
        const r = makeRay(T, m);
        const pts = [];
        const n = 400;
        for (let i = 0; i <= n; i++) {
          const s = (FL * i) / n;
          pts.push(new THREE.Vector3(X0 + s, r.y(s), 0));
        }
        const trail = line(pts, { color: lightColor(1.3 - idx * 0.12), width: 2, opacity: 0.8, additive: true });
        trail.geometry.instanceCount = 0;
        g.add(trail);
        const p = photon(lightColor(3.6), 0.7);
        g.add(p);
        return { ...r, trail, p, n, arrival: FL / r.vx, arrived: false };
      });
      fibers.push({ T, g, rays, det, detGlow, timeL, flash: 0 });
    }

    scene.add(dust(220, [40, 18, 16]));

    const S = { speed: 1, trails: true, t: 0 };

    function fire() {
      S.t = 0;
      for (const f of fibers) {
        f.timeL.userData.el.innerHTML = '';
        for (const r of f.rays) r.arrived = false;
      }
    }

    function update(dt) {
      S.t += dt * S.speed;
      if (S.t > CYCLE) fire();
      const t = S.t;
      const fade = t > CYCLE - 1 ? Math.max(0, (CYCLE - t) / 1) : 1;
      for (const f of fibers) {
        let first = Infinity;
        let last = 0;
        for (const r of f.rays) {
          const s = Math.min(FL, r.vx * t);
          r.p.position.set(X0 + s, r.y(s), 0);
          r.p.visible = s < FL;
          r.trail.visible = S.trails;
          r.trail.geometry.instanceCount = Math.floor((s / FL) * r.n);
          r.trail.material.opacity = 0.8 * fade;
          if (!r.arrived && s >= FL) {
            r.arrived = true;
            f.flash = 1;
          }
          first = Math.min(first, r.arrival);
          last = Math.max(last, r.arrival);
        }
        f.flash = Math.max(0, f.flash - dt * 2.5);
        f.detGlow.material.opacity = f.flash;
        f.det.material.emissiveIntensity = f.flash * 2;
        if (f.rays.every((r) => r.arrived) && !f.timeL.userData.el.innerHTML) {
          const spread = last - first;
          f.timeL.userData.el.innerHTML = spread < 0.005 ? '<b>同时到达</b>' : spread < 0.05 ? '<b>几乎同时到达</b>' : `<b>先后相差 ${spread.toFixed(2)} 秒</b>（动画时间）`;
        }
      }
    }

    // 输出脉冲图
    const chart = chartCanvas(220);
    function redraw() {
      const { g, w, h: hh } = chart.prep();
      const font = cssVar('--font');
      const text2 = cssVar('--text-2');
      const text3 = cssVar('--text-3');
      const primary = cssVar('--primary');
      const lineC = cssVar('--line-strong');
      const rows = fibers.length;
      const top = 14;
      const rowH = (hh - top - 22) / rows;
      const left = 72;
      const right = w - 12;
      const tMin = 4.85;
      const tMax = 5.85;
      const X = (t) => left + ((t - tMin) / (tMax - tMin)) * (right - left);
      const sig = 0.035;
      g.font = '12px ' + font;
      fibers.forEach((f, i) => {
        const y0 = top + rowH * (i + 1) - 6;
        g.strokeStyle = lineC;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(left, y0);
        g.lineTo(right, y0);
        g.stroke();
        g.fillStyle = text2;
        g.textAlign = 'right';
        g.fillText(f.T.short, left - 10, y0 - rowH * 0.3);
        // 输入脉冲（参考，虚线）
        const t0 = FL / V;
        const amp = rowH * 0.78;
        g.setLineDash([3, 3]);
        g.strokeStyle = text3;
        g.beginPath();
        for (let px = left; px <= right; px++) {
          const t = tMin + ((px - left) / (right - left)) * (tMax - tMin);
          const v = Math.exp(-((t - t0) ** 2) / (2 * sig * sig));
          px === left ? g.moveTo(px, y0 - v * amp) : g.lineTo(px, y0 - v * amp);
        }
        g.stroke();
        g.setLineDash([]);
        // 输出脉冲 = 各模式到达脉冲之和（能量守恒归一化）
        g.strokeStyle = primary;
        g.lineWidth = 2;
        g.beginPath();
        const K = f.rays.length;
        let peak = 0;
        const vals = [];
        for (let px = left; px <= right; px++) {
          const t = tMin + ((px - left) / (right - left)) * (tMax - tMin);
          let v = 0;
          for (const r of f.rays) v += Math.exp(-((t - r.arrival) ** 2) / (2 * sig * sig)) / K;
          vals.push(v);
          peak = Math.max(peak, v);
        }
        vals.forEach((v, k) => (k === 0 ? g.moveTo(left + k, y0 - v * amp) : g.lineTo(left + k, y0 - v * amp)));
        g.stroke();
        void peak;
      });
      g.fillStyle = text3;
      g.textAlign = 'center';
      g.fillText('到达时间 →', (left + right) / 2, hh - 6);
    }

    const speedSl = slider({ label: '动画速度', min: 0.25, max: 2, step: 0.05, value: 1, format: (v) => v.toFixed(2) + '×', onInput: (v) => (S.speed = v) });
    const trailT = toggle({ label: '显示光线轨迹', value: true, onChange: (v) => (S.trails = v) });

    const cards = TYPES.map((T) => h('div', { class: 'layer-item', style: 'cursor:default' }, h('div', {}, h('div', { class: 'layer-name' }, T.name), h('div', { class: 'layer-desc' }, T.desc))));

    const panel = [
      ...head(
        '第 5 章',
        '同一个脉冲，三种命运',
        '三根光纤同时从左端射入一个光脉冲。脉冲里的光沿着不同路线（模式）前进——它们能不能同时到达右端，决定了这根光纤能传多快的信号。',
      ),
      section('三种光纤', h('div', { class: 'layer-list' }, cards)),
      section('动画', h('div', { style: 'margin-bottom:10px' }, h('button', { class: 'btn btn-primary', type: 'button', onClick: fire }, '重新发射脉冲')), speedSl.el, trailT.el),
      section(
        '输出脉冲对比',
        chart.el,
        h('div', { class: 'chart-legend' }, h('span', {}, h('i', { style: `background:${'var(--text-3)'}` }), '输入脉冲（参考）'), h('span', {}, h('i', { style: 'background:var(--primary)' }), '输出脉冲')),
        note('各模式的到达时间不同，叠加起来就是一个被“拉宽、压矮”的脉冲。为了看清，动画把差异放大了很多倍。'),
      ),
      section(
        '模式色散为什么要紧？',
        para('数字信号是一串紧挨着的脉冲。脉冲一旦被拉宽，相邻的“1”和“0”就会互相重叠（码间干扰），接收端分不清。展宽越严重，能用的码率和距离就越小。'),
        para('数量级：阶跃多模约 <b>50 ns/km</b>，渐变多模约 <b>0.1–1 ns/km</b>，单模光纤没有模式色散，只剩很小的色度色散（第 7 章会用到）。所以数据中心内几百米用多模，城域网、海底光缆用单模。', true),
      ),
    ];

    fire();
    return {
      scene,
      camera,
      panel,
      update,
      redraw,
      limits: { minDistance: 6, maxDistance: 50 },
      tools: [
        { label: '重新发射', onClick: fire },
        { label: '全景', group: 'view', active: true, home: true, onClick: () => ctx.flyTo(camera.userData.home.pos, camera.userData.home.target) },
        { label: '出口特写', group: 'view', onClick: () => ctx.flyTo(new THREE.Vector3(12, 2, 11), new THREE.Vector3(8, 0, 0)) },
      ],
    };
  },
};
