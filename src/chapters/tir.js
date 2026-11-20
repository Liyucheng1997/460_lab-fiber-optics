// 第 3 章 全反射：斯涅尔定律与临界角
import { THREE, makeScene, makeCamera, photon, lightColor, glass, label, line, setLine, arcPoints, deg, rad, clamp } from '../lib/fx.js';
import { head, section, para, h, slider, seg, toggle, readouts, formula, status } from '../lib/ui.js';

const PRESETS = {
  fiber: { n1: 1.468, n2: 1.462, label: '光纤芯/包层' },
  glass: { n1: 1.5, n2: 1.0, label: '玻璃→空气' },
  water: { n1: 1.33, n2: 1.0, label: '水→空气' },
};

/** 非偏振光的菲涅尔反射率 */
export function fresnelR(n1, n2, ti) {
  const s = (n1 / n2) * Math.sin(ti);
  if (s >= 1) return 1;
  const tt = Math.asin(s);
  const ci = Math.cos(ti);
  const ct = Math.cos(tt);
  const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct);
  const rp = (n2 * ci - n1 * ct) / (n2 * ci + n1 * ct);
  return (rs * rs + rp * rp) / 2;
}

export default {
  id: 'tir',
  title: '全反射',
  sub: '光为何逃不出纤芯',
  create(ctx) {
    const scene = makeScene(ctx);
    const camera = makeCamera(new THREE.Vector3(0, 0.4, 15.5), new THREE.Vector3(0, 0.2, 0), 38);
    camera.userData.fitWidth = 15.5;

    // 两种介质
    const upper = new THREE.Mesh(new THREE.BoxGeometry(15, 4.6, 3), glass('#4c9dff', 0.2));
    upper.position.y = 2.3;
    upper.renderOrder = 1;
    const lower = new THREE.Mesh(new THREE.BoxGeometry(15, 4.6, 3), glass('#c7c7cc', 0.06));
    lower.position.y = -2.3;
    lower.renderOrder = 1;
    scene.add(upper, lower);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x48484a, transparent: true, opacity: 0.6 });
    scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(upper.geometry), edgeMat).translateY(2.3));
    scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(lower.geometry), edgeMat).translateY(-2.3));

    const iface = line([new THREE.Vector3(-7.5, 0, 0), new THREE.Vector3(7.5, 0, 0)], { color: '#d1d1d6', width: 1.5, opacity: 0.7 });
    const normal = line([new THREE.Vector3(0, -4.2, 0), new THREE.Vector3(0, 4.2, 0)], { color: '#8e8e93', width: 1.2, dashed: true, dash: 0.18, gap: 0.14, opacity: 0.8 });
    scene.add(iface, normal);

    const L = 5.6;
    const O = new THREE.Vector3();
    function mkRay() {
      const base = line([O, O], { color: lightColor(1.6), width: 3, opacity: 1, additive: true });
      const flow = line([O, O], { color: lightColor(4), width: 3.2, dashed: true, dash: 0.35, gap: 0.45, additive: true });
      scene.add(base, flow);
      return { base, flow };
    }
    const rays = { inc: mkRay(), ref: mkRay(), tra: mkRay() };
    const hit = photon(lightColor(3), 1.0);
    scene.add(hit);

    const critLine = line([O, O], { color: '#ff9f0a', width: 1.4, dashed: true, dash: 0.15, gap: 0.12, opacity: 0.9 });
    scene.add(critLine);
    const arc1 = line([O, O], { color: '#f5f5f7', width: 1.6, opacity: 0.9 });
    const arc2 = line([O, O], { color: '#f5f5f7', width: 1.6, opacity: 0.9 });
    scene.add(arc1, arc2);

    // 倏逝波：全反射时界面另一侧的一层微光
    const evan = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.3),
      new THREE.MeshBasicMaterial({ color: lightColor(1.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    evan.position.set(0, -0.15, 0.01);
    scene.add(evan);

    const lblUp = label('', '');
    lblUp.position.set(-5.6, 3.9, 0);
    const lblLow = label('', '');
    lblLow.position.set(-5.6, -3.9, 0);
    const lblT1 = label('θ₁', 'math');
    const lblT2 = label('θ₂', 'math');
    const lblTc = label('θ<sub>c</sub>', 'math');
    const lblState = label('', 'accent');
    lblState.position.set(3.6, -0.55, 0);
    scene.add(lblUp, lblLow, lblT1, lblT2, lblTc, lblState);

    const S = { n1: 1.5, n2: 1.0, th: 50, sweep: false };

    function recompute() {
      const { n1, n2 } = S;
      const ti = rad(S.th);
      const R = fresnelR(n1, n2, ti);
      const s = (n1 / n2) * Math.sin(ti);
      const tirOn = s >= 1;
      const tt = tirOn ? null : Math.asin(s);
      const thc = n2 < n1 ? Math.asin(n2 / n1) : null;

      const pInc = new THREE.Vector3(-L * Math.sin(ti), L * Math.cos(ti), 0);
      const pRef = new THREE.Vector3(L * Math.sin(ti), L * Math.cos(ti), 0);
      setLine(rays.inc.base, [pInc, O]);
      setLine(rays.inc.flow, [pInc, O]);
      setLine(rays.ref.base, [O, pRef]);
      setLine(rays.ref.flow, [O, pRef]);
      const refK = Math.max(R, 0.02);
      rays.ref.base.material.opacity = 0.25 + 0.75 * refK;
      rays.ref.flow.material.opacity = refK;
      if (tt !== null) {
        const pT = new THREE.Vector3(L * Math.sin(tt), -L * Math.cos(tt), 0);
        setLine(rays.tra.base, [O, pT]);
        setLine(rays.tra.flow, [O, pT]);
        rays.tra.base.visible = rays.tra.flow.visible = true;
        rays.tra.base.material.opacity = 0.25 + 0.75 * (1 - R);
        rays.tra.flow.material.opacity = 1 - R;
        setLine(arc2, arcPoints(0, 0, 1.25, -Math.PI / 2, -Math.PI / 2 + tt, 32));
        arc2.visible = tt > 0.01;
        lblT2.visible = tt > 0.05;
        const m2 = -Math.PI / 2 + tt / 2;
        lblT2.position.set(1.75 * Math.cos(m2), 1.75 * Math.sin(m2), 0);
      } else {
        rays.tra.base.visible = rays.tra.flow.visible = false;
        arc2.visible = false;
        lblT2.visible = false;
      }
      setLine(arc1, arcPoints(0, 0, 1.45, Math.PI / 2, Math.PI / 2 + ti, 32));
      arc1.visible = ti > 0.01;
      lblT1.visible = ti > 0.05;
      const m1 = Math.PI / 2 + ti / 2;
      lblT1.position.set(1.95 * Math.cos(m1), 1.95 * Math.sin(m1), 0);

      if (thc !== null) {
        const pc = new THREE.Vector3(-4.6 * Math.sin(thc), 4.6 * Math.cos(thc), 0);
        setLine(critLine, [O, pc]);
        critLine.visible = true;
        lblTc.visible = true;
        lblTc.position.copy(pc).multiplyScalar(1.08);
      } else {
        critLine.visible = false;
        lblTc.visible = false;
      }
      evan.material.opacity = tirOn ? 0.14 : 0;

      lblUp.userData.el.innerHTML = `<b>光密介质 n₁ = ${n1.toFixed(3)}</b><small>例如纤芯</small>`;
      lblLow.userData.el.innerHTML = `<b>光疏介质 n₂ = ${n2.toFixed(3)}</b><small>例如包层</small>`;
      lblState.userData.el.innerHTML = tirOn ? '全反射：光全部留在上方' : `折射 ${Math.round((1 - R) * 100)}% · 反射 ${Math.round(R * 100)}%`;
      lblState.userData.el.className = 'lbl ' + (tirOn ? 'accent' : '');

      ro.set('thc', thc !== null ? `${deg(thc).toFixed(1)}°` : '<small>不存在（n₁ ≤ n₂）</small>');
      ro.set('tt', tt !== null ? `${deg(tt).toFixed(1)}°` : '<small>无折射光</small>');
      ro.set('R', `${(R * 100).toFixed(1)}<small>%</small>`);
      ro.set('T', `${((1 - R) * 100).toFixed(1)}<small>%</small>`);
      if (tirOn) st.set('入射角 ≥ 临界角：发生全反射，能量 100% 反射', 'ok');
      else if (thc !== null && S.th > deg(thc) - 8) st.set('接近临界角：折射光贴着界面掠出，反射迅速变强', 'warn');
      else st.set('入射角小于临界角：光大部分折射进入下方介质', '');
    }

    function update(dt, t) {
      for (const k of ['inc', 'ref', 'tra']) rays[k].flow.material.dashOffset -= dt * 2.2;
      critLine.material.dashOffset -= dt * 0.2;
      hit.material.opacity = 0.7 + 0.3 * Math.sin(t * 5);
      if (S.sweep && dt > 0) {
        S.th = 45 + 43.5 * Math.sin(t * 0.45);
        thSl.set(S.th);
        recompute();
      }
    }

    // 面板
    const ro = readouts([
      { key: 'thc', label: '临界角 θc' },
      { key: 'tt', label: '折射角 θ₂' },
      { key: 'R', label: '反射率 R' },
      { key: 'T', label: '透射率 T' },
    ]);
    const st = status();

    const presetSeg = seg({
      label: '介质组合',
      options: [
        { value: 'glass', label: '玻璃→空气' },
        { value: 'water', label: '水→空气' },
        { value: 'fiber', label: '纤芯→包层' },
      ],
      value: 'glass',
      onChange: (v) => {
        S.n1 = PRESETS[v].n1;
        S.n2 = PRESETS[v].n2;
        n1Sl.set(S.n1);
        n2Sl.set(S.n2);
        if (v === 'fiber') {
          S.th = 86;
          thSl.set(86);
        }
        recompute();
      },
    });
    const n1Sl = slider({ label: '上方折射率 n₁', min: 1.0, max: 1.8, step: 0.001, value: S.n1, format: (v) => v.toFixed(3), onInput: (v) => ((S.n1 = v), presetSeg.set(null), recompute()) });
    const n2Sl = slider({ label: '下方折射率 n₂', min: 1.0, max: 1.8, step: 0.001, value: S.n2, format: (v) => v.toFixed(3), onInput: (v) => ((S.n2 = v), presetSeg.set(null), recompute()) });
    const thSl = slider({
      label: '入射角 θ₁',
      min: 0,
      max: 89.5,
      step: 0.1,
      value: S.th,
      format: (v) => v.toFixed(1) + '°',
      onInput: (v) => {
        S.th = clamp(v, 0, 89.5);
        sweepT.set(false);
        S.sweep = false;
        recompute();
      },
    });
    const sweepT = toggle({ label: '自动扫描入射角', value: false, onChange: (v) => (S.sweep = v) });

    const panel = [
      ...head(
        '第 3 章',
        '全反射：把光关在玻璃里',
        '光从<b>光密介质</b>（折射率大）射向<b>光疏介质</b>（折射率小）时，会向远离法线的方向偏折。入射角越大，偏折越厉害；超过某个角度后，光就完全出不去了。',
      ),
      section('试一试', presetSeg.el, thSl.el, n1Sl.el, n2Sl.el, sweepT.el),
      section('', ro.el, h('div', { style: 'margin-top:10px' }, st.el)),
      section(
        '斯涅尔定律',
        formula('<i>n</i>₁ sin <i>θ</i>₁ = <i>n</i>₂ sin <i>θ</i>₂', '折射前后，“折射率 × 入射角正弦”保持不变'),
        para('当 θ₂ 达到 90°（折射光贴着界面走）时对应的入射角，叫作<b>临界角</b>：'),
        formula('sin <i>θ</i><sub>c</sub> = <i>n</i>₂ / <i>n</i>₁'),
        para('入射角 θ₁ ≥ θc 时，斯涅尔定律要求 sin θ₂ > 1——这不可能，于是光 100% 反射回来，这就是<b>全反射</b>。它和镜面反射不同：没有任何吸收损耗，反射多少次都不会变暗。'),
      ),
      section(
        '在光纤里',
        para('纤芯 n₁ ≈ 1.468，包层 n₂ ≈ 1.462，两者只差 0.4%，临界角约 85°。所以只有几乎<b>平行于光纤轴</b>前进的光（与界面夹角小于约 5°），才能一路全反射下去。选择“纤芯→包层”预设，把入射角拖到 85° 附近看看。'),
        para('图中界面下方那层微光，示意全反射时仍有一点电磁场渗入包层（倏逝波），只是它不带走能量。', true),
      ),
    ];

    recompute();
    return {
      scene,
      camera,
      panel,
      update,
      limits: { minDistance: 6, maxDistance: 30, minAzimuth: -0.9, maxAzimuth: 0.9, minPolar: 0.6, maxPolar: 2.5 },
    };
  },
};
