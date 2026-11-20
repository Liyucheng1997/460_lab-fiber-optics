// 第 2 章 光纤结构：层层剥开的光纤
import { THREE, makeScene, makeCamera, photon, lightColor, glass, dust, label, lerp } from '../lib/fx.js';
import { head, section, para, h, slider, chartCanvas, cssVar, note } from '../lib/ui.js';

const LAYERS = [
  {
    key: 'core',
    name: '纤芯 Core',
    color: '#4c9dff',
    spec: '单模 ≈ 9 μm · 多模 50 / 62.5 μm',
    desc: '高纯石英（SiO₂）掺少量锗（GeO₂），折射率 n₁ 略高。光信号就在这里传播。',
  },
  {
    key: 'clad',
    name: '包层 Cladding',
    color: '#bcd6f5',
    spec: '直径 125 μm',
    desc: '同样是石英，但折射率 n₂ 比纤芯低约 0.3%–1%。正是这个微小差别，让纤芯边界上发生全反射，把光“关”在纤芯里。',
  },
  {
    key: 'coat',
    name: '涂覆层 Coating',
    color: '#e5e5ea',
    spec: '直径 250 μm（彩色标识）',
    desc: '丙烯酸树脂，拉丝时立即涂上。保护玻璃表面不被划伤和受潮，并缓冲微小弯曲。',
  },
  {
    key: 'jacket',
    name: '护套 Jacket',
    color: '#8e8e93',
    spec: '直径 0.9 – 3 mm',
    desc: '塑料紧套或外护套，里面通常还有芳纶纱作为抗拉件，承受施工时的拉力。',
  },
];

export default {
  id: 'structure',
  title: '光纤结构',
  sub: '纤芯 · 包层 · 涂覆层',
  create(ctx) {
    const scene = makeScene(ctx);
    const camera = makeCamera(new THREE.Vector3(5.5, 4.2, 10.5), new THREE.Vector3(0.6, 0, 0), 36);
    camera.userData.fitWidth = 15;

    const X0 = -7;
    const R = { core: 0.3, clad: 0.78, coat: 1.12, jacket: 1.55 };
    const mats = {
      core: glass('#7fb8ff', 0.55, { emissive: new THREE.Color('#0a4fb0'), emissiveIntensity: 0.9 }),
      clad: glass('#d6e7ff', 0.2, { clearcoat: 1, clearcoatRoughness: 0.1 }),
      coat: new THREE.MeshPhysicalMaterial({ color: '#a1a1a6', roughness: 0.35, transparent: true, opacity: 0.5, depthWrite: false }),
      jacket: new THREE.MeshStandardMaterial({ color: '#3a3a3c', roughness: 0.6, metalness: 0.0, transparent: true, opacity: 1 }),
    };
    const base = { core: 0.55, clad: 0.2, coat: 0.5, jacket: 1 };
    const meshes = {};
    for (const k of ['jacket', 'coat', 'clad', 'core']) {
      const g = new THREE.CylinderGeometry(R[k], R[k], 1, 96, 1, false).rotateZ(-Math.PI / 2);
      g.translate(0.5, 0, 0); // 从 x=0 到 x=1
      const m = new THREE.Mesh(g, mats[k]);
      m.position.x = X0;
      m.renderOrder = { jacket: 1, coat: 2, clad: 3, core: 4 }[k];
      scene.add(m);
      meshes[k] = m;
    }

    // 出射端的光锥
    const coneGeo = new THREE.ConeGeometry(0.9, 3, 48, 1, true).rotateZ(Math.PI / 2);
    coneGeo.translate(1.5, 0, 0);
    const cone = new THREE.Mesh(
      coneGeo,
      new THREE.MeshBasicMaterial({ color: lightColor(0.35, '#7fb8ff'), transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    scene.add(cone);
    const endGlow = photon(lightColor(3), 1.3);
    scene.add(endGlow);

    // 纤芯里的光脉冲
    const pulses = [];
    for (let i = 0; i < 7; i++) {
      const p = photon(lightColor(3.4), 0.62);
      scene.add(p);
      pulses.push({ s: i / 7, p });
    }

    // 标签
    const labels = {};
    for (const L of LAYERS) {
      const o = label(`<b>${L.name.split(' ')[0]}</b><small>${L.spec}</small>`);
      scene.add(o);
      labels[L.key] = o;
    }

    scene.add(dust(260, [30, 14, 18]));

    let strip = 0.75;
    let ends = {};
    function layout() {
      const e = {
        jacket: -2.2,
        coat: lerp(-2.0, 0.6, strip),
        clad: lerp(-1.8, 3.8, strip),
      };
      e.core = e.clad;
      ends = e;
      for (const k of Object.keys(meshes)) meshes[k].scale.x = e[k] - X0;
      labels.jacket.position.set(-4.8, R.jacket + 0.55, 0);
      labels.coat.position.set((e.jacket + e.coat) / 2 + 0.2, R.coat + 0.5, 0);
      labels.clad.position.set((e.coat + e.clad) / 2 + 0.2, R.clad + 0.5, 0);
      labels.core.position.set(e.clad + 0.9, -0.95, 0);
      cone.position.x = e.clad;
      endGlow.position.x = e.clad + 0.02;
    }
    layout();

    let focus = null;
    function setFocus(k) {
      focus = focus === k ? null : k;
      for (const key of Object.keys(meshes)) {
        const dim = focus && focus !== key;
        mats[key].transparent = true;
        mats[key].opacity = dim ? base[key] * (key === 'jacket' ? 0.12 : 0.3) : base[key];
        mats[key].depthWrite = key === 'jacket' && !dim;
        mats[key].needsUpdate = true;
        labels[key].userData.el.classList.toggle('dim', !!dim);
        labels[key].userData.el.classList.toggle('accent', focus === key);
      }
      items.forEach((it) => it.classList.toggle('on', it.dataset.key === focus));
    }

    const tmp = new THREE.Vector3();
    function update(dt, t) {
      const len = ends.clad - X0;
      for (const q of pulses) {
        q.s = (q.s + dt * 0.16) % 1;
        q.p.position.set(X0 + q.s * len, 0, 0);
        q.p.material.opacity = Math.min(1, q.s / 0.05, (1 - q.s) / 0.04);
      }
      const flick = 0.75 + 0.25 * Math.sin(t * 6) * Math.sin(t * 2.3);
      endGlow.material.opacity = flick;
      cone.material.opacity = 0.03 + 0.03 * flick;
      void tmp;
    }

    // 面板
    const items = LAYERS.map((L) =>
      h(
        'button',
        { class: 'layer-item', type: 'button', 'data-key': L.key, onClick: () => setFocus(L.key) },
        h('span', { class: 'layer-dot', style: `background:${L.color}` }),
        h('div', {}, h('div', { class: 'layer-name' }, L.name), h('div', { class: 'layer-desc' }, `${L.spec}。${L.desc}`)),
      ),
    );

    const stripCtl = slider({
      label: '剥开程度',
      min: 0,
      max: 1,
      step: 0.01,
      value: strip,
      format: (v) => Math.round(v * 100) + '%',
      onInput: (v) => {
        strip = v;
        layout();
      },
    });

    const scale = chartCanvas(170);
    function redraw() {
      const { g, w, h: hh } = scale.prep();
      const text = cssVar('--text');
      const text3 = cssVar('--text-3');
      const primary = cssVar('--primary');
      const fills = { coat: cssVar('--fill'), clad: cssVar('--line-strong') };
      const r250 = Math.min(w / 4.6, hh / 2 - 22);
      const draw = (cx, coreUm, title) => {
        const cy = hh / 2 - 6;
        const k = r250 / 125;
        g.fillStyle = fills.coat;
        g.beginPath();
        g.arc(cx, cy, 125 * k, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = fills.clad;
        g.beginPath();
        g.arc(cx, cy, 62.5 * k, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = primary;
        g.beginPath();
        g.arc(cx, cy, Math.max(1.5, (coreUm / 2) * k), 0, Math.PI * 2);
        g.fill();
        g.fillStyle = text;
        g.font = '600 12.5px ' + cssVar('--font');
        g.textAlign = 'center';
        g.fillText(title, cx, hh - 10);
        g.fillStyle = text3;
        g.font = '11px ' + cssVar('--font');
        g.fillText(`纤芯 ${coreUm} μm`, cx, cy + 3 + 62.5 * k + 13);
      };
      draw(w * 0.27, 9, '单模光纤');
      draw(w * 0.73, 50, '多模光纤');
    }

    const panel = [
      ...head(
        '第 2 章',
        '一根光纤的四层结构',
        '光纤是同心的多层细丝。真正导光的只有中间的玻璃（纤芯 + 包层），外面两层都是“保镖”。点下面的条目，可以在三维模型里单独查看它。',
      ),
      section('从里到外', h('div', { class: 'layer-list' }, items)),
      section('调节', stripCtl.el),
      section(
        '真实比例（截面）',
        scale.el,
        note('浅灰外圈为 250 μm 涂覆层，深灰为 125 μm 包层，蓝色为纤芯。单模光纤的纤芯只有包层直径的约 1/14。左侧三维模型为看清结构，放大了纤芯。'),
      ),
      section(
        '为什么要有包层？',
        para('如果直接用一根裸玻璃丝，光也能靠玻璃—空气界面的全反射前进；但表面一旦沾上灰尘、水汽或被手指碰到，光就会从接触点漏出去。'),
        para('包层把“反射面”藏到了玻璃内部：纤芯与包层的界面永远干净、平滑，这才让光能稳定地传几十公里。'),
      ),
    ];

    return {
      scene,
      camera,
      panel,
      update,
      redraw,
      limits: { minDistance: 3, maxDistance: 30 },
      tools: [
        { label: '斜视', group: 'view', active: true, home: true, onClick: () => ctx.flyTo(camera.userData.home.pos, camera.userData.home.target) },
        { label: '侧视', group: 'view', onClick: () => ctx.flyTo(new THREE.Vector3(-0.5, 0.2, 13), new THREE.Vector3(-0.5, 0, 0)) },
        { label: '端面', group: 'view', onClick: () => ctx.flyTo(new THREE.Vector3(ends.clad + 4.2, 0.6, 0.6), new THREE.Vector3(ends.clad, 0, 0)) },
      ],
    };
  },
};
