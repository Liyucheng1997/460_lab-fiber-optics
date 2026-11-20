// 第 1 章 概览：一束光纤，光脉冲在其中奔跑
import { THREE, makeScene, makeCamera, photon, lightColor, glass, dust, label } from '../lib/fx.js';
import { head, section, para, h } from '../lib/ui.js';

export default {
  id: 'overview',
  title: '概览',
  sub: '光如何承载信息',
  create(ctx) {
    const scene = makeScene(ctx);
    const camera = makeCamera(new THREE.Vector3(-3, 3.2, 15), new THREE.Vector3(0.5, 0, 0), 40);
    camera.userData.fitWidth = 24;

    // 光纤束：从左侧散开的若干根，汇聚成束后在右端散成“光纤灯”
    const N = 46;
    const fibers = [];
    const rnd = mulberry(7);
    const tubeMat = new THREE.MeshBasicMaterial({ color: '#2a6cc4', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + rnd() * 0.3;
      const rr = Math.sqrt(rnd()) * 0.55;
      const by = Math.sin(a) * rr;
      const bz = Math.cos(a) * rr;
      const spreadL = 2.2 + rnd() * 2.4;
      const spreadR = 1.2 + rnd() * 3.2;
      const pts = [
        new THREE.Vector3(-13, by * spreadL * 2.2 - 0.5, bz * spreadL * 2.2),
        new THREE.Vector3(-8, by * 1.8 - 0.2, bz * 1.8),
        new THREE.Vector3(-3, by + Math.sin(i) * 0.05, bz),
        new THREE.Vector3(2, by * 1.05, bz * 1.05),
        new THREE.Vector3(6, by * 1.5 + 0.2, bz * 1.5),
        new THREE.Vector3(9 + rnd() * 1.5, by * spreadR * 2 + 1.2 + Math.sin(a) * 1.2, bz * spreadR * 1.6 + Math.cos(a) * 0.8),
      ];
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.035, 6, false), tubeMat);
      scene.add(tube);
      // 末端光点
      const tip = photon(lightColor(2.2), 0.35, 0.9);
      tip.position.copy(curve.getPoint(1));
      scene.add(tip);
      const pulses = [];
      const n = 2 + Math.floor(rnd() * 2);
      for (let k = 0; k < n; k++) {
        const p = photon(lightColor(3.2), 0.42);
        scene.add(p);
        pulses.push({ s: rnd(), sp: 0.07 + rnd() * 0.05, p });
      }
      fibers.push({ curve, pulses, tip, phase: rnd() * 10 });
    }

    // 束外的护套（半透明，只包住中段）
    const sheath = new THREE.Mesh(
      new THREE.CylinderGeometry(0.78, 0.78, 6.5, 64, 1, true).rotateZ(Math.PI / 2),
      glass('#d1d1d6', 0.05),
    );
    sheath.renderOrder = -1;
    sheath.position.set(-0.5, 0, 0);
    scene.add(sheath);

    const l1 = label('<b>光纤束</b><small>每根比头发丝略粗，约 0.25 mm</small>');
    l1.position.set(-1, 1.4, 0);
    scene.add(l1);
    const l2 = label('<b>光脉冲</b><small>“亮 = 1，暗 = 0”</small>');
    l2.position.set(-9, -2.6, 0);
    scene.add(l2);

    scene.add(dust(420, [34, 18, 22]));

    const tmp = new THREE.Vector3();
    function update(dt, t) {
      for (const f of fibers) {
        for (const q of f.pulses) {
          q.s = (q.s + dt * q.sp) % 1;
          f.curve.getPoint(q.s, tmp);
          q.p.position.copy(tmp);
          const edge = Math.min(q.s / 0.06, (1 - q.s) / 0.06, 1);
          q.p.material.opacity = edge;
        }
        f.tip.material.opacity = 0.55 + 0.45 * Math.sin(t * 2.4 + f.phase) ** 2;
      }
    }

    const go = (i) => () => {
      const btn = document.querySelectorAll('.nav-item')[i];
      btn && btn.click();
    };

    const panel = [
      ...head(
        '光纤通信 · 交互演示',
        '用光传递信息',
        '互联网上 95% 以上的数据，最终都要变成一串光脉冲，在一根比头发丝略粗的玻璃丝里，以约每秒 20 万公里的速度穿越城市、海底和大陆。',
      ),
      section(
        '几个关键数字',
        h(
          'div',
          { class: 'stats' },
          stat('≈ 20 万 km/s', '光在石英光纤中的速度，约为真空光速的 2/3（折射率 n ≈ 1.47）'),
          stat('0.2 dB/km', '1550 nm 波长下的损耗：传输 100 km 后仍剩约 1% 的光功率'),
          stat('125 μm', '光纤包层直径，单模光纤真正导光的纤芯只有约 9 μm'),
          stat('> 100 Tb/s', '单根光纤借助波分复用可达到的实验容量'),
        ),
      ),
      section(
        '你将了解',
        h(
          'div',
          { class: 'steps' },
          chapterLink('光纤结构', '纤芯、包层、涂覆层各自的作用', go(1)),
          chapterLink('全反射', '光为什么“逃不出”纤芯', go(2)),
          chapterLink('传播与数值孔径', '光以什么角度入射才能被导引', go(3)),
          chapterLink('光纤类型与模式色散', '多模、渐变、单模的区别', go(4)),
          chapterLink('损耗', '衰减谱、传输窗口与弯曲损耗', go(5)),
          chapterLink('信号传输全过程', '从文字到光脉冲再回到文字', go(6)),
          chapterLink('波分复用', '一根光纤同时传几十路信号', go(7)),
        ),
      ),
      section('', para('左边的三维舞台可以拖动旋转、滚轮缩放；每一章右侧都有可以调节的参数。键盘 ← → 切换章节，空格暂停动画。', true)),
    ];

    return { scene, camera, panel, update, autoRotate: true, autoRotateSpeed: 0.35, limits: { minDistance: 6, maxDistance: 40 } };
  },
};

function stat(num, txt) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat-num' }, num), h('div', { class: 'stat-txt' }, txt));
}
function chapterLink(name, desc, onClick) {
  const el = h('button', { class: 'step', type: 'button', onClick }, h('div', { class: 'step-name' }, name), h('div', { class: 'step-desc', style: 'display:block' }, desc));
  return el;
}

function mulberry(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export { mulberry };
