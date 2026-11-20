// 第 4 章 传播与数值孔径：光线在纤芯中锯齿形前进，入射角太大就会泄漏
import { THREE, makeScene, makeCamera, photon, lightColor, glass, label, line, setLine, arcPoints, deg, rad, Polyline, dust } from '../lib/fx.js';
import { head, section, para, h, slider, seg, toggle, readouts, formula, status } from '../lib/ui.js';
import { fresnelR } from './tir.js';

const FL = 24; // 光纤长度
const A = 0.72; // 纤芯半径
const B = 1.45; // 包层半径

export default {
  id: 'propagation',
  title: '传播与数值孔径',
  sub: '接收锥 · 锯齿光线',
  create(ctx) {
    const scene = makeScene(ctx);
    const camera = makeCamera(new THREE.Vector3(9, 2.4, 22), new THREE.Vector3(9, 0, 0), 40);
    camera.userData.fitWidth = 37;

    const core = new THREE.Mesh(new THREE.CylinderGeometry(A, A, FL, 64, 1, true).rotateZ(Math.PI / 2).translate(FL / 2, 0, 0), glass('#4c9dff', 0.16));
    const clad = new THREE.Mesh(new THREE.CylinderGeometry(B, B, FL, 64, 1, false).rotateZ(Math.PI / 2).translate(FL / 2, 0, 0), glass('#d6e7ff', 0.08));
    core.renderOrder = 2;
    clad.renderOrder = 1;
    scene.add(clad, core);
    // 纵剖面上的边界线，便于看清纤芯/包层
    for (const y of [A, -A]) scene.add(line([new THREE.Vector3(0, y, 0), new THREE.Vector3(FL, y, 0)], { color: '#4c9dff', width: 1.2, opacity: 0.55 }));
    for (const y of [B, -B]) scene.add(line([new THREE.Vector3(0, y, 0), new THREE.Vector3(FL, y, 0)], { color: '#8e8e93', width: 1, opacity: 0.45 }));
    const axis = line([new THREE.Vector3(-7, 0, 0), new THREE.Vector3(FL + 6, 0, 0)], { color: '#636366', width: 1, dashed: true, dash: 0.2, gap: 0.2, opacity: 0.7 });
    scene.add(axis);

    // 光源
    const src = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 32).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3a3a3c', roughness: 0.4, metalness: 0.6 }));
    const srcGlow = photon(lightColor(3), 0.9);
    scene.add(src, srcGlow);

    // 接收锥
    const coneMat = new THREE.MeshBasicMaterial({ color: lightColor(0.6), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(new THREE.BufferGeometry(), coneMat);
    const coneEdges = line([new THREE.Vector3(), new THREE.Vector3()], { color: '#9fc6ff', width: 1.2, dashed: true, dash: 0.16, gap: 0.12, opacity: 0.9 });
    scene.add(cone, coneEdges);

    const rayGroup = new THREE.Group();
    scene.add(rayGroup);
    const alphaArc = line([new THREE.Vector3(), new THREE.Vector3()], { color: '#f5f5f7', width: 1.5 });
    scene.add(alphaArc);

    const lblAlpha = label('α', 'math');
    const lblCone = label('', '');
    const lblCore = label('<b>纤芯 n₁</b>（中间蓝色区域）', 'plain');
    lblCore.position.set(FL - 4, -B - 0.55, 0);
    const lblClad = label('<b>包层 n₂</b>', 'plain');
    lblClad.position.set(FL - 4, B + 0.5, 0);
    const lblAir = label('<b>空气 n₀ = 1</b>', 'plain');
    lblAir.position.set(-4.2, -2.9, 0);
    const lblLeak = label('', 'warn');
    scene.add(lblAlpha, lblCone, lblCore, lblClad, lblAir, lblLeak);

    scene.add(dust(200, [40, 12, 16]));

    const S = { alpha: 14, n1: 1.48, n2: 1.4, cone: true };

    let path = null; // 主光路 Polyline
    let pPow = []; // 每个顶点处的剩余功率
    const flows = [];
    const photons = [];
    for (let i = 0; i < 9; i++) {
      const p = photon(lightColor(3.4), 0.55);
      scene.add(p);
      photons.push({ d: i * 4.2, p });
    }

    function addRay(a, b, P, width = 3) {
      const base = line([a, b], { color: lightColor(1.5), width, opacity: 0.2 + 0.8 * P, additive: true });
      const flow = line([a, b], { color: lightColor(4), width: width + 0.2, dashed: true, dash: 0.35, gap: 0.5, opacity: P, additive: true });
      rayGroup.add(base, flow);
      flows.push(flow);
    }

    function recompute() {
      // 清空旧光路
      for (const c of [...rayGroup.children]) {
        c.geometry.dispose();
        c.material.dispose();
        rayGroup.remove(c);
      }
      flows.length = 0;

      const { n1, n2 } = S;
      const NA = Math.sqrt(Math.max(0, n1 * n1 - n2 * n2));
      const amax = NA >= 1 ? Math.PI / 2 : Math.asin(NA);
      const thc = Math.asin(n2 / n1);
      const al = rad(S.alpha);
      const beta = Math.asin(Math.sin(al) / n1);
      const phi = Math.PI / 2 - beta; // 在纤芯壁上的入射角

      // 接收锥
      const ca = Math.min(amax, rad(80));
      const hgt = 4.2;
      cone.geometry.dispose();
      cone.geometry = new THREE.ConeGeometry(hgt * Math.tan(ca), hgt, 64, 1, true).rotateZ(-Math.PI / 2).translate(-hgt / 2, 0, 0);
      const e1 = new THREE.Vector3(-hgt, hgt * Math.tan(ca), 0);
      const e2 = new THREE.Vector3(-hgt, -hgt * Math.tan(ca), 0);
      setLine(coneEdges, [e1, new THREE.Vector3(), e2]);
      cone.visible = coneEdges.visible = S.cone;
      lblCone.visible = S.cone;
      lblCone.position.set(-hgt - 0.3, hgt * Math.tan(ca) + 0.45, 0);
      lblCone.userData.el.innerHTML = `<b>接收锥</b><small>半角 α<sub>max</sub> = ${deg(amax).toFixed(1)}°</small>`;

      // 入射光线
      const d0 = 6.5;
      const S0 = new THREE.Vector3(-d0 * Math.cos(al), -d0 * Math.sin(al), 0);
      src.position.copy(S0).multiplyScalar(1.07);
      src.rotation.z = al;
      srcGlow.position.copy(S0);
      const E = new THREE.Vector3(0, 0, 0);
      addRay(S0, E, 1);
      const pts = [S0, E.clone()];
      pPow = [1, 1];

      setLine(alphaArc, arcPoints(0, 0, 1.8, Math.PI, Math.PI + al, 24));
      alphaArc.visible = al > 0.01;
      lblAlpha.visible = al > 0.03;
      lblAlpha.position.set(2.3 * Math.cos(Math.PI + al / 2), 2.3 * Math.sin(Math.PI + al / 2), 0);

      // 纤芯中逐次反射
      let x = 0;
      let y = 0;
      let dy = 1;
      let P = 1;
      let bounces = 0;
      let leakTotal = 0;
      let firstLeak = null;
      const tb = Math.tan(beta);
      while (x < FL && bounces < 80) {
        if (beta < 1e-4) {
          x = FL;
          break;
        }
        const target = dy > 0 ? A : -A;
        const nx = x + Math.abs(target - y) / tb;
        if (nx >= FL) {
          const ny = y + dy * (FL - x) * tb;
          const a = new THREE.Vector3(x, y, 0);
          const b = new THREE.Vector3(FL, ny, 0);
          addRay(a, b, P);
          pts.push(b);
          pPow.push(P);
          x = FL;
          y = ny;
          break;
        }
        const a = new THREE.Vector3(x, y, 0);
        const b = new THREE.Vector3(nx, target, 0);
        addRay(a, b, P);
        pts.push(b);
        x = nx;
        y = target;
        bounces++;
        const R = fresnelR(n1, n2, phi);
        if (R < 1) {
          const leakP = P * (1 - R);
          leakTotal += leakP;
          // 折射进包层
          const tt = Math.asin(Math.min(1, (n1 / n2) * Math.sin(phi)));
          const lx = Math.sin(tt);
          const ly = Math.cos(tt) * dy;
          const tC = (B - A) / Math.abs(ly);
          const c1 = new THREE.Vector3(x + lx * tC, dy * B, 0);
          addRay(b, c1, leakP, 2.2);
          // 再从包层射入空气
          const sAir = n2 * Math.sin(tt);
          if (sAir < 1) {
            const ta = Math.asin(sAir);
            const c2 = c1.clone().add(new THREE.Vector3(Math.sin(ta), Math.cos(ta) * dy, 0).multiplyScalar(2.6));
            addRay(c1, c2, leakP * 0.9, 2);
          }
          if (!firstLeak) firstLeak = c1.clone();
          P *= R;
        }
        pPow.push(P);
        dy = -dy;
        if (P < 0.004) break;
      }
      if (beta < 1e-4) {
        const b = new THREE.Vector3(FL, 0, 0);
        addRay(E, b, P);
        pts.push(b);
        pPow.push(P);
      }
      // 出射
      if (x >= FL - 1e-6 && P > 0.004) {
        const outA = Math.asin(Math.min(1, n1 * Math.sin(beta)));
        const o = new THREE.Vector3(FL, y, 0);
        const o2 = o.clone().add(new THREE.Vector3(Math.cos(outA), Math.sin(outA) * dy, 0).multiplyScalar(5));
        addRay(o, o2, P);
        pts.push(o2);
        pPow.push(P);
      }

      path = new Polyline(pts);
      lblLeak.visible = !!firstLeak;
      if (firstLeak) {
        lblLeak.position.copy(firstLeak).add(new THREE.Vector3(0.8, firstLeak.y > 0 ? 0.7 : -0.7, 0));
        lblLeak.userData.el.innerHTML = '光从包层漏出';
      }

      const guided = S.alpha <= deg(amax) + 1e-9;
      ro.set('na', NA.toFixed(3));
      ro.set('amax', deg(amax).toFixed(1) + '°');
      ro.set('phi', `${deg(phi).toFixed(1)}° <small>/ θc ${deg(thc).toFixed(1)}°</small>`);
      ro.set('out', `${(P * 100).toFixed(P > 0.1 ? 0 : 1)}<small>%</small>`);
      if (guided) st.set(`α ≤ αmax：每次都在纤芯壁全反射（共 ${bounces} 次），光被完整导引`, 'ok');
      else st.set(`α > αmax：纤芯壁上的入射角小于临界角，每次反射都漏掉一部分，${bounces} 次反射后只剩 ${(P * 100).toFixed(1)}%`, 'bad');
    }

    function update(dt) {
      for (const f of flows) f.material.dashOffset -= dt * 2.4;
      if (!path) return;
      for (const q of photons) {
        q.d = (q.d + dt * 5) % (path.length + 6);
        if (q.d > path.length) {
          q.p.visible = false;
          continue;
        }
        q.p.visible = true;
        path.at(q.d, q.p.position);
        const i = path.index(q.d);
        q.p.material.opacity = Math.max(0.05, pPow[Math.min(i + 1, pPow.length - 1)] ?? 1);
      }
    }

    // 面板
    const ro = readouts([
      { key: 'na', label: '数值孔径 NA' },
      { key: 'amax', label: '最大接收角 αmax' },
      { key: 'phi', label: '纤芯壁入射角', wide: true },
      { key: 'out', label: '到达末端的光功率' },
    ]);
    const st = status();
    const aSl = slider({ label: '入射角 α（与光纤轴的夹角）', min: 0, max: 60, step: 0.5, value: S.alpha, format: (v) => v.toFixed(1) + '°', onInput: (v) => ((S.alpha = v), recompute()) });
    const n1Sl = slider({
      label: '纤芯折射率 n₁',
      min: 1.42,
      max: 1.6,
      step: 0.001,
      value: S.n1,
      format: (v) => v.toFixed(3),
      onInput: (v) => {
        S.n1 = v;
        if (S.n2 >= v) {
          S.n2 = v - 0.002;
          n2Sl.set(S.n2);
        }
        pre.set(null);
        recompute();
      },
    });
    const n2Sl = slider({
      label: '包层折射率 n₂',
      min: 1.3,
      max: 1.598,
      step: 0.001,
      value: S.n2,
      format: (v) => v.toFixed(3),
      onInput: (v) => {
        S.n2 = Math.min(v, S.n1 - 0.002);
        if (S.n2 !== v) n2Sl.set(S.n2);
        pre.set(null);
        recompute();
      },
    });
    const pre = seg({
      label: '光纤参数',
      options: [
        { value: 'demo', label: '夸张示意' },
        { value: 'mm', label: '多模 NA≈0.2' },
        { value: 'sm', label: '单模 NA≈0.14' },
      ],
      value: 'demo',
      onChange: (v) => {
        const p = { demo: [1.48, 1.4], mm: [1.475, 1.4614], sm: [1.4682, 1.4615] }[v];
        S.n1 = p[0];
        S.n2 = p[1];
        n1Sl.set(S.n1);
        n2Sl.set(S.n2);
        recompute();
      },
    });
    const coneT = toggle({ label: '显示接收锥', value: true, onChange: (v) => ((S.cone = v), recompute()) });

    const panel = [
      ...head(
        '第 4 章',
        '光在纤芯中锯齿形前进',
        '光从端面射入光纤，先在空气—纤芯界面折射，然后在纤芯壁上一次次全反射，走出一条锯齿形路线。但并不是所有方向射进来的光都能被“抓住”。',
      ),
      section('调节入射角', aSl.el, pre.el, n1Sl.el, n2Sl.el, coneT.el),
      section('', ro.el, h('div', { style: 'margin-top:10px' }, st.el)),
      section(
        '数值孔径 NA',
        para('入射角 α 越大，光进入纤芯后越“斜”，打到纤芯壁上的入射角就越小。要保证壁上仍是全反射，α 不能超过一个最大值 αmax。所有能被导引的入射方向组成一个圆锥，叫作<b>接收锥</b>。'),
        formula('NA = sin <i>α</i><sub>max</sub> = √(<i>n</i>₁² − <i>n</i>₂²)', '数值孔径只由纤芯、包层的折射率决定'),
        para('NA 越大，光纤越容易把光源发出的光收进来，但正如下一章会看到的，光线走的路径也更参差不齐。'),
      ),
      section(
        '把 α 拖过 αmax 试试',
        para('超过接收锥后，每次碰壁都会有一部分光折射进包层，再从包层漏到外面。反射几次后，光就几乎漏光了——这也是为什么光纤接头要严格对准。', true),
      ),
    ];

    recompute();
    return {
      scene,
      camera,
      panel,
      update,
      limits: { minDistance: 5, maxDistance: 45 },
      tools: [
        { label: '全景', group: 'view', active: true, home: true, onClick: () => ctx.flyTo(camera.userData.home.pos, camera.userData.home.target) },
        { label: '入射端', group: 'view', onClick: () => ctx.flyTo(new THREE.Vector3(-1, 1.2, 9), new THREE.Vector3(-1, 0, 0)) },
        { label: '立体', group: 'view', onClick: () => ctx.flyTo(new THREE.Vector3(-6, 6, 10), new THREE.Vector3(5, 0, 0)) },
      ],
    };
  },
};
