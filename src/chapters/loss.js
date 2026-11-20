// 第 6 章 损耗：弯曲损耗（三维）+ 衰减谱与传输窗口（图表）
import { THREE, makeScene, makeCamera, photon, lightColor, glass, label, dust, Polyline, arcPoints } from '../lib/fx.js';
import { head, section, para, h, slider, seg, toggle, readouts, chartCanvas, cssVar, note, formula, status } from '../lib/ui.js';

const STRAIGHT = 9;

/** 单位长度的弯曲泄漏率（示意模型） */
const leakRate = (R) => 2.5 * Math.exp(-2.2 * (R - 0.5));

/** 石英光纤衰减谱（dB/km），λ 单位 μm */
export function attenuation(l, lowWaterPeak = false) {
  const rayleigh = 0.85 / l ** 4;
  const ir = 7.81e11 * Math.exp(-48.48 / l);
  const uv = 1.1e-4 * Math.exp(4.63 / l);
  const oh = lowWaterPeak
    ? 0.03 * Math.exp(-(((l - 1.383) / 0.012) ** 2))
    : 0.5 * Math.exp(-(((l - 1.383) / 0.012) ** 2)) + 0.08 * Math.exp(-(((l - 1.24) / 0.015) ** 2)) + 0.05 * Math.exp(-(((l - 0.95) / 0.02) ** 2));
  return rayleigh + ir + uv + oh + 0.02;
}

export default {
  id: 'loss',
  title: '损耗',
  sub: '衰减谱 · 弯曲损耗',
  create(ctx) {
    const scene = makeScene(ctx);
    const camera = makeCamera(new THREE.Vector3(-1.5, 3.5, 17), new THREE.Vector3(-2, 0, 0), 40);
    camera.userData.fitWidth = 21;

    const coreMat = glass('#4c9dff', 0.3, { emissive: new THREE.Color('#0a3a80'), emissiveIntensity: 0.35 });
    const cladMat = glass('#d6e7ff', 0.08, { roughness: 0.35 });
    const core = new THREE.Mesh(new THREE.BufferGeometry(), coreMat);
    const clad = new THREE.Mesh(new THREE.BufferGeometry(), cladMat);
    core.renderOrder = 2;
    clad.renderOrder = 1;
    scene.add(clad, core);

    const inGlow = photon(lightColor(3), 1.4);
    const outGlow = photon(lightColor(3), 1.4);
    scene.add(inGlow, outGlow);
    const lblIn = label('');
    const lblOut = label('');
    const lblBend = label('', 'warn');
    scene.add(lblIn, lblOut, lblBend);
    scene.add(dust(240, [36, 16, 18]));

    const S = { R: 2.2, lam: 1.55, dist: 80, lwp: false };
    let path = null;
    let arcS0 = 0;
    let arcS1 = 0;

    function build() {
      const R = S.R;
      const pts = [];
      for (let i = 0; i <= 40; i++) pts.push(new THREE.Vector3(-STRAIGHT + (STRAIGHT * i) / 40, R, 0));
      const arc = arcPoints(0, 0, R, Math.PI / 2, -Math.PI / 2, 80);
      arc.shift();
      pts.push(...arc);
      for (let i = 1; i <= 40; i++) pts.push(new THREE.Vector3(-(STRAIGHT * i) / 40, -R, 0));
      path = new Polyline(pts);
      arcS0 = STRAIGHT;
      arcS1 = STRAIGHT + Math.PI * R;
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
      core.geometry.dispose();
      clad.geometry.dispose();
      core.geometry = new THREE.TubeGeometry(curve, 360, 0.12, 16, false);
      clad.geometry = new THREE.TubeGeometry(curve, 360, 0.34, 24, false);
      inGlow.position.set(-STRAIGHT, R, 0);
      outGlow.position.set(-STRAIGHT, -R, 0);

      const T = Math.exp(-leakRate(R) * Math.PI * R);
      const dB = -10 * Math.log10(T);
      lblIn.position.set(-STRAIGHT + 1.6, R + 1.0, 0);
      lblIn.userData.el.innerHTML = '<b>输入 100%</b>';
      lblOut.position.set(-STRAIGHT + 1.6, -R - 1.0, 0);
      lblOut.userData.el.innerHTML = `<b>输出 ${(T * 100).toFixed(T > 0.1 ? 0 : 1)}%</b><small>弯曲损耗 ${dB.toFixed(dB < 1 ? 2 : 1)} dB</small>`;
      lblBend.visible = dB > 0.3;
      lblBend.position.set(R + 1.9, 0.9, 0);
      lblBend.userData.el.innerHTML = '弯曲外侧漏光';
      outGlow.material.opacity = Math.max(0.05, T);

      const mm = R * 7.5;
      bro.set('r', `${mm.toFixed(1)}<small> mm</small>`);
      bro.set('db', `${dB.toFixed(dB < 1 ? 2 : 1)}<small> dB</small>`);
      if (mm >= 30) bst.set('普通单模光纤（G.652）的安全弯曲半径', 'ok');
      else if (mm >= 7.5) bst.set('普通光纤开始明显漏光；抗弯光纤（G.657）仍可接受', 'warn');
      else bst.set('弯得太紧：大量漏光，玻璃还可能因应力断裂', 'bad');
    }

    // 光子池
    const POOL = 160;
    const pool = [];
    for (let i = 0; i < POOL; i++) {
      const p = photon(lightColor(3.2), 0.48);
      p.visible = false;
      scene.add(p);
      pool.push({ p, alive: false, s: 0, esc: false, vel: new THREE.Vector3(), life: 0 });
    }
    let spawnAcc = 0;
    const tan = new THREE.Vector3();
    const out = new THREE.Vector3();

    function update(dt) {
      spawnAcc += dt * 7;
      while (spawnAcc >= 1) {
        spawnAcc -= 1;
        const q = pool.find((o) => !o.alive);
        if (q) {
          q.alive = true;
          q.esc = false;
          q.s = 0;
          q.p.visible = true;
          q.p.material.opacity = 1;
        }
      }
      const lr = leakRate(S.R);
      for (const q of pool) {
        if (!q.alive) continue;
        if (q.esc) {
          q.p.position.addScaledVector(q.vel, dt);
          q.life -= dt;
          q.p.material.opacity = Math.max(0, q.life / 1.4) * 0.9;
          if (q.life <= 0) {
            q.alive = false;
            q.p.visible = false;
          }
          continue;
        }
        const ds = dt * 5.5;
        q.s += ds;
        if (q.s >= path.length) {
          q.alive = false;
          q.p.visible = false;
          continue;
        }
        path.at(q.s, q.p.position);
        if (q.s > arcS0 && q.s < arcS1 && Math.random() < 1 - Math.exp(-lr * ds)) {
          path.tangent(q.s, tan);
          out.copy(q.p.position).setZ(0).normalize();
          q.vel.copy(tan).multiplyScalar(0.85).addScaledVector(out, 0.55).normalize().multiplyScalar(5);
          q.esc = true;
          q.life = 1.4;
        }
      }
    }

    // ---------- 面板：弯曲 ----------
    const bro = readouts([
      { key: 'r', label: '弯曲半径（对应实际）' },
      { key: 'db', label: '这一个 U 形弯的损耗' },
    ]);
    const bst = status();
    const rSl = slider({ label: '弯曲半径', min: 0.5, max: 4.2, step: 0.02, value: S.R, format: (v) => (v * 7.5).toFixed(1) + ' mm', onInput: (v) => ((S.R = v), build()) });

    // ---------- 面板：衰减谱 ----------
    const chart = chartCanvas(210);
    const lro = readouts([
      { key: 'a', label: '衰减系数 α' },
      { key: 'tot', label: '总损耗 αL' },
      { key: 'pout', label: '输出功率（输入 0 dBm）' },
      { key: 'rem', label: '剩余光功率' },
    ]);
    function budget() {
      const a = attenuation(S.lam, S.lwp);
      const tot = a * S.dist;
      lro.set('a', `${a.toFixed(2)}<small> dB/km</small>`);
      lro.set('tot', `${tot.toFixed(1)}<small> dB</small>`);
      lro.set('pout', `${(-tot).toFixed(1)}<small> dBm</small>`);
      const rem = Math.pow(10, -tot / 10) * 100;
      lro.set('rem', rem >= 0.01 ? `${rem < 1 ? rem.toPrecision(2) : rem.toFixed(1)}<small>%</small>` : `${rem.toExponential(1)}<small>%</small>`);
      redraw();
    }
    function redraw() {
      const { g, w, h: hh } = chart.prep();
      const font = cssVar('--font');
      const primary = cssVar('--primary');
      const text2 = cssVar('--text-2');
      const text3 = cssVar('--text-3');
      const lineC = cssVar('--line-strong');
      const L = 36;
      const Rr = w - 10;
      const T = 24;
      const Bm = hh - 26;
      const l0 = 0.75;
      const l1 = 1.7;
      const yMax = 2.5;
      const X = (l) => L + ((l - l0) / (l1 - l0)) * (Rr - L);
      const Y = (v) => Bm - (Math.min(v, yMax) / yMax) * (Bm - T);
      g.font = '11px ' + font;
      // 网格
      g.strokeStyle = lineC;
      g.lineWidth = 1;
      g.fillStyle = text3;
      g.textAlign = 'right';
      for (let v = 0; v <= yMax + 1e-6; v += 0.5) {
        g.globalAlpha = v === 0 ? 1 : 0.5;
        g.beginPath();
        g.moveTo(L, Y(v));
        g.lineTo(Rr, Y(v));
        g.stroke();
        g.globalAlpha = 1;
        g.fillText(v.toFixed(1), L - 6, Y(v) + 4);
      }
      g.textAlign = 'center';
      for (let l = 0.8; l <= 1.7001; l += 0.1) g.fillText(Math.round(l * 1000), X(l), hh - 9);
      // 窗口
      for (const [lw, name] of [
        [0.85, '第一窗口'],
        [1.31, '第二窗口'],
        [1.55, '第三窗口'],
      ]) {
        g.setLineDash([3, 3]);
        g.strokeStyle = text3;
        g.beginPath();
        g.moveTo(X(lw), T);
        g.lineTo(X(lw), Bm);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = text2;
        g.fillText(name, X(lw), T - 8);
      }
      // 曲线
      g.strokeStyle = primary;
      g.lineWidth = 2;
      g.beginPath();
      for (let px = L; px <= Rr; px++) {
        const l = l0 + ((px - L) / (Rr - L)) * (l1 - l0);
        const y = Y(attenuation(l, S.lwp));
        px === L ? g.moveTo(px, y) : g.lineTo(px, y);
      }
      g.stroke();
      // 当前波长
      const a = attenuation(S.lam, S.lwp);
      g.fillStyle = primary;
      g.beginPath();
      g.arc(X(S.lam), Y(a), 5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = cssVar('--panel');
      g.beginPath();
      g.arc(X(S.lam), Y(a), 2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = cssVar('--text');
      g.font = '600 12px ' + font;
      const lbl = `${a.toFixed(2)} dB/km`;
      const right = X(S.lam) + 8 + g.measureText(lbl).width > Rr;
      g.textAlign = right ? 'right' : 'left';
      g.fillText(lbl, X(S.lam) + (right ? -8 : 8), Y(a) - 9);
    }
    const lamSeg = seg({
      label: '工作波长',
      options: [
        { value: 0.85, label: '850 nm' },
        { value: 1.31, label: '1310 nm' },
        { value: 1.55, label: '1550 nm' },
      ],
      value: S.lam,
      onChange: (v) => ((S.lam = v), budget()),
    });
    const dSl = slider({ label: '传输距离 L', min: 1, max: 200, step: 1, value: S.dist, format: (v) => v + ' km', onInput: (v) => ((S.dist = v), budget()) });
    const lwpT = toggle({ label: '低水峰光纤（G.652.D）', value: false, onChange: (v) => ((S.lwp = v), budget()) });

    const panel = [
      ...head(
        '第 6 章',
        '光为什么会越走越弱',
        '再纯的玻璃也会吸收和散射一点光；光纤弯得太狠，光也会从弯道外侧“甩”出去。损耗决定了光信号不放大能走多远。',
      ),
      section(
        '弯曲损耗（左侧三维）',
        para('在弯道外侧，光要比内侧“跑得更快”才能跟上，一旦超过包层里的光速，这部分光就脱离束缚辐射出去。把半径调小，看看弯道上漏出的光点。'),
        rSl.el,
        bro.el,
        h('div', { style: 'margin-top:10px' }, bst.el),
      ),
      section(
        '衰减谱（dB/km）与三个传输窗口',
        chart.el,
        note('曲线左侧下降段是<b>瑞利散射</b>（∝ 1/λ⁴，玻璃中微小的密度起伏），右侧上升是<b>红外吸收</b>（Si–O 键振动），1383 nm 附近的尖峰是残留水分（OH⁻）的吸收。'),
        lamSeg.el,
        lwpT.el,
        dSl.el,
        lro.el,
      ),
      section(
        '用分贝算损耗',
        formula('<i>P</i><sub>out</sub> [dBm] = <i>P</i><sub>in</sub> [dBm] − <i>α</i> · <i>L</i>', '每 3 dB 功率减半，每 10 dB 降到 1/10'),
        para('850 nm 便宜的光源配多模光纤，用于几百米内的短距离；1310 nm 色散最小；<b>1550 nm 损耗最低（约 0.2 dB/km）</b>，并且正好落在掺铒光纤放大器的工作波段，所以长途干线几乎都用它。', true),
      ),
    ];

    build();
    budget();
    return {
      scene,
      camera,
      panel,
      update,
      redraw,
      limits: { minDistance: 4, maxDistance: 40 },
      tools: [
        { label: '全景', group: 'view', active: true, home: true, onClick: () => ctx.flyTo(camera.userData.home.pos, camera.userData.home.target) },
        { label: '弯道特写', group: 'view', onClick: () => ctx.flyTo(new THREE.Vector3(S.R + 4, 3, 7), new THREE.Vector3(S.R * 0.6, 0, 0)) },
      ],
    };
  },
};
