// 第 8 章 波分复用：多个波长共用一根光纤
import { THREE, makeScene, makeCamera, photon, glass, label, line, dust, Polyline } from '../lib/fx.js';
import { head, section, para, h, slider, seg, readouts, chartCanvas, cssVar, note, formula } from '../lib/ui.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V = 5;
const TB = 0.26;
const XL = -12;
const XM = -6.6;
const XD = 6.6;
const XR = 12;

/** 通道颜色：只是示意（实际都是 1550 nm 附近的不可见红外光） */
function chColor(i, n, k = 1) {
  const c = new THREE.Color();
  c.setHSL(n <= 1 ? 0.6 : 0.0 + (i / (n - 1)) * 0.76, 1, 0.55);
  return c.multiplyScalar(k);
}
function chCss(i, n) {
  const hh = n <= 1 ? 216 : (i / (n - 1)) * 274;
  return `hsl(${hh.toFixed(0)} 90% 55%)`;
}
const bit = (c, k) => {
  let x = Math.imul(c * 7919 + 13, 2654435761) ^ Math.imul(k + 101, 2246822519);
  x ^= x >>> 15;
  x = Math.imul(x, 2654435761);
  return ((x >>> 13) & 3) !== 0 ? 1 : 0; // 约 75% 为 1，画面更热闹
};

export default {
  id: 'wdm',
  title: '波分复用',
  sub: '一根光纤里的彩虹',
  create(ctx) {
    const scene = makeScene(ctx);
    const camera = makeCamera(new THREE.Vector3(0, 4.5, 21), new THREE.Vector3(0, 0, 0), 40);
    camera.userData.fitWidth = 35;

    // 合波 / 分波器（棱镜示意）
    const prismGeo = new THREE.CylinderGeometry(1.1, 1.1, 1.6, 3).rotateX(Math.PI / 2);
    const mux = new THREE.Mesh(prismGeo, glass('#e5e5ea', 0.22, { clearcoat: 1 }));
    mux.position.x = XM;
    mux.rotation.z = Math.PI / 2;
    const demux = new THREE.Mesh(prismGeo, glass('#e5e5ea', 0.22, { clearcoat: 1 }));
    demux.position.x = XD;
    demux.rotation.z = -Math.PI / 2;
    scene.add(mux, demux);
    const fiber = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, XD - XM - 1.2, 32, 1, true).rotateZ(Math.PI / 2), glass('#bcd6f5', 0.25));
    scene.add(fiber);
    scene.add(line([new THREE.Vector3(XM + 0.6, 0, 0), new THREE.Vector3(XD - 0.6, 0, 0)], { color: '#f5f5f7', width: 1, opacity: 0.25 }));

    const lblMux = label('<b>合波器 MUX</b><small>把各波长汇入一根光纤</small>');
    lblMux.position.set(XM, -2.0, 0);
    const lblFiber = label('<b>同一根光纤</b><small>各波长互不干扰，各走各的</small>');
    lblFiber.position.set(0, 1.0, 0);
    const lblDemux = label('<b>分波器 DEMUX</b><small>按波长分开，送往各自的接收机</small>');
    lblDemux.position.set(XD, -2.0, 0);
    scene.add(lblMux, lblFiber, lblDemux);

    scene.add(dust(240, [40, 16, 18]));

    const chGroup = new THREE.Group();
    scene.add(chGroup);
    let chans = [];
    const pool = [];
    for (let i = 0; i < 260; i++) {
      const p = photon(new THREE.Color(1, 1, 1), 0.48);
      p.visible = false;
      scene.add(p);
      pool.push(p);
    }

    const S = { n: 6, rate: 100, t: 0 };
    const boxMat = new THREE.MeshStandardMaterial({ color: '#2c2c2e', roughness: 0.35, metalness: 0.55 });

    function build() {
      for (const c of [...chGroup.children]) {
        chGroup.remove(c);
        c.traverse((o) => {
          if (o.geometry && o.geometry !== boxGeo) o.geometry.dispose();
          if (o.material && o.material !== boxMat) o.material.dispose();
          if (o.isCSS2DObject) o.element.remove();
        });
      }
      const n = S.n;
      const spread = Math.min(3.6, 0.45 * (n - 1));
      chans = [];
      for (let i = 0; i < n; i++) {
        const y = n === 1 ? 0 : spread - (2 * spread * i) / (n - 1);
        const col = chColor(i, n, 1);
        const tx = new THREE.Mesh(boxGeo, boxMat);
        tx.position.set(XL - 0.5, y, 0);
        const rx = new THREE.Mesh(boxGeo, boxMat);
        rx.position.set(XR + 0.5, y, 0);
        const txG = photon(chColor(i, n, 3), 0.7, 0.9);
        txG.position.set(XL, y, 0);
        const rxG = photon(chColor(i, n, 3), 0.9, 0);
        rxG.position.set(XR, y, 0);
        const p1 = new THREE.Vector3(XL, y, 0);
        const pm = new THREE.Vector3(XM + 0.55, 0, 0);
        const pd = new THREE.Vector3(XD - 0.55, 0, 0);
        const p2 = new THREE.Vector3(XR, y, 0);
        const guideA = line([p1, pm], { color: col.clone().multiplyScalar(0.9), width: 1.3, opacity: 0.45, additive: true });
        const guideB = line([pd, p2], { color: col.clone().multiplyScalar(0.9), width: 1.3, opacity: 0.45, additive: true });
        chGroup.add(tx, rx, txG, rxG, guideA, guideB);
        const showLbl = n <= 8 || i === 0 || i === n - 1;
        if (showLbl) {
          const lam = (1530.33 + i * 0.8).toFixed(1);
          const lt = label(`λ${sub(i + 1)} ${lam} nm`, 'plain');
          lt.position.set(XL - 2.6, y, 0);
          chGroup.add(lt);
          const lr = label(`λ${sub(i + 1)}`, 'plain');
          lr.position.set(XR + 1.7, y, 0);
          chGroup.add(lr);
        }
        const yo = n === 1 ? 0 : ((i / (n - 1)) * 2 - 1) * 0.07;
        const path = new Polyline([p1, pm, new THREE.Vector3(XM + 0.6, yo, 0), new THREE.Vector3(XD - 0.6, yo, 0), pd, p2]);
        chans.push({ i, y, col: chColor(i, n, 3.4), path, rxG, phase: (i * 0.37) % TB });
      }
      const tl = label('<b>激光器</b><small>每个波长一路信号</small>');
      tl.position.set(XL - 0.5, spread + 1.4, 0);
      const rl = label('<b>接收机</b>');
      rl.position.set(XR + 0.5, spread + 1.2, 0);
      chGroup.add(tl, rl);

      const total = S.n * S.rate;
      ro.set('n', `${S.n}<small> 路</small>`);
      ro.set('cap', total >= 1000 ? `${(total / 1000).toFixed(total % 1000 ? 1 : 0)}<small> Tb/s</small>` : `${total}<small> Gb/s</small>`);
      redraw();
    }
    const boxGeo = new RoundedBoxGeometry(1, 0.32, 0.6, 3, 0.08);

    function update(dt) {
      S.t += dt;
      const T = S.t;
      let pi = 0;
      for (const c of chans) {
        const transit = c.path.length / V;
        const k0 = Math.ceil((T - c.phase - transit) / TB);
        const k1 = Math.floor((T - c.phase) / TB);
        let hit = 0;
        for (let k = k0; k <= k1 && pi < pool.length; k++) {
          if (!bit(c.i, k)) continue;
          const age = T - c.phase - k * TB;
          const p = pool[pi++];
          p.visible = true;
          p.material.color.copy(c.col);
          c.path.at(age * V, p.position);
          if (age > transit - 0.1) hit = 1;
        }
        c.rxG.material.opacity += (hit - c.rxG.material.opacity) * Math.min(1, dt * 18);
      }
      for (; pi < pool.length; pi++) pool[pi].visible = false;
    }

    // 面板
    const ro = readouts([
      { key: 'n', label: '波长通道数' },
      { key: 'cap', label: '这根光纤的总容量' },
    ]);
    const nSl = slider({ label: '通道数', min: 1, max: 16, step: 1, value: S.n, format: (v) => v + ' 路', onInput: (v) => ((S.n = v), build()) });
    const rateSeg = seg({ label: '每路速率', options: [{ value: 10, label: '10 Gb/s' }, { value: 100, label: '100 Gb/s' }, { value: 400, label: '400 Gb/s' }], value: S.rate, onChange: (v) => ((S.rate = v), build()) });

    const chart = chartCanvas(150);
    function redraw() {
      const { g, w, h: hh } = chart.prep();
      const font = cssVar('--font');
      const text3 = cssVar('--text-3');
      const lineC = cssVar('--line-strong');
      const L = 12;
      const R = w - 12;
      const B = hh - 24;
      const l0 = 1529;
      const l1 = 1530.33 + 15 * 0.8 + 1.2;
      const X = (l) => L + ((l - l0) / (l1 - l0)) * (R - L);
      g.strokeStyle = lineC;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(L, B);
      g.lineTo(R, B);
      g.stroke();
      for (let i = 0; i < S.n; i++) {
        const lc = 1530.33 + i * 0.8;
        g.strokeStyle = chCss(i, S.n);
        g.fillStyle = chCss(i, S.n);
        g.lineWidth = 2;
        g.beginPath();
        for (let px = X(lc - 0.4); px <= X(lc + 0.4); px++) {
          const l = l0 + ((px - L) / (R - L)) * (l1 - l0);
          const v = Math.exp(-(((l - lc) / 0.09) ** 2));
          const y = B - v * (B - 14);
          px <= X(lc - 0.4) + 0.5 ? g.moveTo(px, y) : g.lineTo(px, y);
        }
        g.stroke();
      }
      g.fillStyle = text3;
      g.font = '11px ' + font;
      g.textAlign = 'center';
      for (const l of [1530, 1534, 1538, 1542]) g.fillText(l + ' nm', X(l), hh - 7);
    }

    const panel = [
      ...head(
        '第 8 章',
        '波分复用：一根光纤，几十路信号',
        '不同波长（颜色）的光在同一根光纤里传播时互不干扰。于是可以用多个激光器，各自发一路信号，合到一根光纤里传，到对端再按波长分开。这就是 <b>WDM</b>（Wavelength Division Multiplexing）。',
      ),
      section('调节', nSl.el, rateSeg.el, ro.el),
      section('光谱（每个峰是一路信号）', chart.el, note('通道间隔 0.8 nm（100 GHz）。三维动画为了区分，把各通道画成了不同颜色；实际它们都是 1530–1565 nm 附近人眼看不见的红外光。')),
      section(
        '容量是怎么叠上去的',
        formula('总容量 = 通道数 × 每路速率'),
        para('掺铒放大器的 C 波段（1530–1565 nm）宽约 4.4 THz。按 50 GHz 间隔可以放下约 <b>80–96 个通道</b>，每路 400 Gb/s，单根光纤就能传约 <b>30–40 Tb/s</b>；再加上 L 波段，可以翻一倍。'),
        para('合波器和分波器在实际设备中通常是阵列波导光栅（AWG）或薄膜滤波片，这里用棱镜示意“按波长分光”的作用。', true),
      ),
      section(
        '回顾整条链路',
        para('光纤用<b>全反射</b>把光关在纤芯里；用<b>单模</b>消除模式色散；选在<b>1550 nm</b>损耗最低的窗口；用<b>EDFA</b>每隔几十到上百公里直接放大光信号；再用<b>波分复用</b>把容量乘上几十倍——这就是今天跨洋海底光缆的基本原理。', true),
      ),
    ];

    build();
    return {
      scene,
      camera,
      panel,
      update,
      redraw,
      limits: { minDistance: 4, maxDistance: 50 },
      tools: [
        { label: '全景', group: 'view', active: true, home: true, onClick: () => ctx.flyTo(camera.userData.home.pos, camera.userData.home.target) },
        { label: '合波器', group: 'view', onClick: () => ctx.flyTo(new THREE.Vector3(-8.5, 2.5, 8), new THREE.Vector3(-7.5, 0, 0)) },
        { label: '分波器', group: 'view', onClick: () => ctx.flyTo(new THREE.Vector3(8.5, 2.5, 8), new THREE.Vector3(7.5, 0, 0)) },
      ],
    };
  },
};

function sub(n) {
  const m = '₀₁₂₃₄₅₆₇₈₉';
  return String(n)
    .split('')
    .map((d) => m[d])
    .join('');
}
