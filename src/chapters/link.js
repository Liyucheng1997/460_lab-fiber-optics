// 第 7 章 信号传输全过程：文字 → 比特 → 光脉冲 → 光纤（衰减/色散）→ 放大 → 光电检测 → 判决 → 文字
import { THREE, makeScene, makeCamera, photon, lightColor, glass, label, line, dust, clamp } from '../lib/fx.js';
import { head, section, para, h, slider, seg, toggle, readouts, chartCanvas, cssVar, note, status } from '../lib/ui.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry } from './overview.js';

const V = 5; // 脉冲速度（场景单位/秒）
const TB = 0.12; // 每比特间隔（动画秒）
const XT = -9.5; // 发射机出口
const XA0 = -1; // 放大器入口
const XA1 = 1; // 放大器出口
const XR = 9.5; // 接收机入口
const WIRE = 3.6; // 电线长度
const TRANSIT = (XR - XT) / V;

const FIBER = {
  1310: { a: 0.33, D: 0.5 },
  1550: { a: 0.19, D: 17 },
};
const SENS = { 2.5: -30, 10: -22, 40: -14 }; // 接收灵敏度 dBm（Q≈7）

function erfc(x) {
  // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
  return x >= 0 ? y : 2 - y;
}

function textToBits(str) {
  const bytes = new TextEncoder().encode(str);
  const bits = [];
  for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  return { bytes, bits };
}

export default {
  id: 'link',
  title: '信号传输全过程',
  sub: '电 → 光 → 电',
  create(ctx) {
    const scene = makeScene(ctx);
    const camera = makeCamera(new THREE.Vector3(0, 5.5, 22), new THREE.Vector3(0, -0.3, 0), 40);
    camera.userData.fitWidth = 37;

    // ---------- 器件 ----------
    const boxMat = new THREE.MeshStandardMaterial({ color: '#2c2c2e', roughness: 0.35, metalness: 0.55 });
    const mkBox = (x, w = 2, hh = 1.6, d = 1.6) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, hh, d, 4, 0.18), boxMat);
      m.position.x = x;
      scene.add(m);
      return m;
    };
    mkBox(-10.5);
    const rx = mkBox(10.5);
    void rx;
    // 放大器：半透明外壳 + 掺铒光纤线圈
    const amp = new THREE.Mesh(new RoundedBoxGeometry(2, 1.6, 1.6, 4, 0.18), glass('#c7c7cc', 0.12));
    scene.add(amp);
    const coilMat = new THREE.MeshStandardMaterial({ color: '#4c9dff', emissive: new THREE.Color('#2f8cff'), emissiveIntensity: 1.5, roughness: 0.3 });
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 12, 64), coilMat);
    coil.rotation.y = Math.PI / 2;
    scene.add(coil);
    const pump = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.45, 0.6, 3, 0.08), boxMat);
    pump.position.set(0, 1.1, 0);
    scene.add(pump);
    const dcf = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 10, 48), new THREE.MeshStandardMaterial({ color: '#d1d1d6', roughness: 0.4 }));
    dcf.position.set(0, -0.35, 0.35);
    scene.add(dcf);

    // 发射窗口与探测器
    const txGlow = photon(lightColor(3.5), 1.5, 0);
    txGlow.position.set(XT, 0, 0);
    const pd = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 40).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1d1d1f', emissive: new THREE.Color('#2f8cff'), emissiveIntensity: 0, roughness: 0.3, metalness: 0.4 }));
    pd.position.set(XR - 0.02, 0, 0);
    const rxGlow = photon(lightColor(3), 1.2, 0);
    rxGlow.position.set(XR, 0, 0);
    scene.add(txGlow, pd, rxGlow);

    // 光纤
    const fiberMat = glass('#bcd6f5', 0.22);
    for (const [a, b] of [
      [XT, XA0],
      [XA1, XR],
    ]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, b - a, 24, 1, true).rotateZ(Math.PI / 2), fiberMat);
      f.position.x = (a + b) / 2;
      scene.add(f);
      scene.add(line([new THREE.Vector3(a, 0, 0), new THREE.Vector3(b, 0, 0)], { color: '#4c9dff', width: 1, opacity: 0.35 }));
    }
    // 电线
    const wireC = '#8e8e93';
    scene.add(line([new THREE.Vector3(-11.5 - WIRE, -0.5, 0), new THREE.Vector3(-11.5, -0.5, 0)], { color: wireC, width: 2 }));
    scene.add(line([new THREE.Vector3(11.5, -0.5, 0), new THREE.Vector3(11.5 + WIRE, -0.5, 0)], { color: wireC, width: 2 }));

    // 标签
    const L = (html, x, y, cls = '') => {
      const o = label(html, cls);
      o.position.set(x, y, 0);
      scene.add(o);
      return o;
    };
    L('<b>① 数据</b><small>文字 → UTF-8 → 比特</small>', -13.3, -1.45);
    L('<b>② 发射机</b><small>激光器 + 调制器 · 电→光</small>', -10.5, 1.75);
    const lblSpan1 = L('', -5.25, -0.95, 'plain');
    const lblAmp = L('', 0, 2.05);
    const lblSpan2 = L('', 5.25, -0.95, 'plain');
    L('<b>⑤ 接收机</b><small>光电二极管 · 光→电</small>', 10.5, 1.75);
    L('<b>⑥ 判决解码</b><small>比特 → 文字</small>', 13.6, -1.45);
    const lblRx = L('', 10.2, -2.6, 'plain');

    scene.add(dust(260, [40, 16, 18]));

    // ---------- 池 ----------
    const pulsePool = [];
    for (let i = 0; i < 90; i++) {
      const p = photon(lightColor(3.4), 0.5);
      p.visible = false;
      scene.add(p);
      pulsePool.push(p);
    }
    const bitGeo = new THREE.BoxGeometry(0.34, 1, 0.34);
    const bitMatOk = new THREE.MeshStandardMaterial({ color: '#f5f5f7', emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.05, roughness: 0.4 });
    const bitMatErr = new THREE.MeshStandardMaterial({ color: '#ff453a', emissive: new THREE.Color('#ff453a'), emissiveIntensity: 0.8, roughness: 0.4 });
    const mkBits = (n) =>
      Array.from({ length: n }, () => {
        const m = new THREE.Mesh(bitGeo, bitMatOk);
        m.visible = false;
        scene.add(m);
        return m;
      });
    const inBits = mkBits(20);
    const outBits = mkBits(20);

    // ---------- 状态与链路计算 ----------
    const S = { text: 'Hello 光纤!', lam: 1550, rate: 10, span: 50, edfa: true, dcf: true, t: 0, shown: -1, seed: 1 };
    let msg = textToBits(S.text);
    let M = { rx: [], samples: [], prx: 0, Q: 0, ber: 0, open: 1, broad: 1, errors: 0 };

    /** 在位置 x 处：相对功率（dB）与累计色散（ps/nm） */
    function stateAt(x) {
      const F = FIBER[S.lam];
      const kmPer = S.span / (XA0 - XT);
      const loss1 = F.a * S.span;
      if (x <= XA0) {
        const km = (x - XT) * kmPer;
        return { dB: -F.a * km, Dacc: F.D * km };
      }
      const after = S.edfa ? 0 : -loss1;
      const D1 = S.dcf ? 0 : F.D * S.span;
      if (x <= XA1) {
        const k = (x - XA0) / (XA1 - XA0);
        return { dB: -loss1 + (after + loss1) * k, Dacc: F.D * S.span + (D1 - F.D * S.span) * k };
      }
      const km = (x - XA1) * kmPer;
      return { dB: after - F.a * km, Dacc: D1 + F.D * km };
    }
    const broadOf = (Dacc) => Math.sqrt(1 + ((Math.abs(Dacc) * S.rate * S.rate) / 1e5) ** 2);

    function compute() {
      const end = stateAt(XR);
      const broad = broadOf(end.Dacc);
      const sb = 0.3 * broad; // 以比特周期为单位的脉冲 rms 宽度
      const hm = [];
      for (let m = -8; m <= 8; m++) hm.push(Math.exp(-(m * m) / (2 * sb * sb)));
      const H = hm.reduce((a, b) => a + b, 0);
      const open = (2 * hm[8] - H) / H;
      const prx = end.dB; // 发射功率 0 dBm
      const Q0 = 7 * Math.pow(10, (prx - SENS[S.rate]) / 20);
      const sn = 0.5 / Q0;
      const Q = open > 0 ? (open * 0.5) / sn : 0;
      const ber = open > 0 ? 0.5 * erfc(Q / Math.SQRT2) : 0.5;

      const rnd = mulberry(S.seed);
      const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
      const b = msg.bits;
      const rx = [];
      const samples = [];
      let errors = 0;
      for (let k = 0; k < b.length; k++) {
        let s = 0;
        for (let m = -8; m <= 8; m++) {
          const j = k - m;
          if (j >= 0 && j < b.length && b[j]) s += hm[m + 8];
        }
        s = s / H + gauss() * sn;
        samples.push(s);
        const d = s > 0.5 ? 1 : 0;
        rx.push(d);
        if (d !== b[k]) errors++;
      }
      M = { rx, samples, prx, Q, ber, open, broad, errors, sb, H, sn };

      // 标签与读数
      const F = FIBER[S.lam];
      lblSpan1.userData.el.innerHTML = `<b>③ 光纤 ${S.span} km</b><small>衰减 ${(F.a * S.span).toFixed(1)} dB · 色散 ${(F.D * S.span).toFixed(0)} ps/nm</small>`;
      lblSpan2.userData.el.innerHTML = `<b>光纤 ${S.span} km</b><small>衰减 ${(F.a * S.span).toFixed(1)} dB</small>`;
      lblAmp.userData.el.innerHTML = S.edfa ? `<b>④ EDFA 光放大器</b><small>增益 ${(F.a * S.span).toFixed(1)} dB${S.dcf ? ' · 含色散补偿' : ''}</small>` : `<b>④ 无放大器</b><small>${S.dcf ? '仅色散补偿' : '光纤直接相连'}</small>`;
      lblRx.userData.el.innerHTML = `<small>接收功率 ${prx.toFixed(1)} dBm · 灵敏度 ${SENS[S.rate]} dBm</small>`;
      coil.visible = S.edfa;
      pump.visible = S.edfa;
      dcf.visible = S.dcf;
      amp.material.opacity = S.edfa || S.dcf ? 0.12 : 0.03;

      ro.set('prx', `${prx.toFixed(1)}<small> dBm</small>`);
      ro.set('margin', `${(prx - SENS[S.rate]).toFixed(1)}<small> dB</small>`);
      ro.set('broad', `${broad.toFixed(2)}<small>×</small>`);
      ro.set('eye', open > 0 ? `${Math.round(open * 100)}<small>%</small>` : '<small>闭合</small>');
      ro.set('ber', ber < 1e-15 ? '< 10⁻¹⁵' : ber >= 0.01 ? ber.toFixed(2) : ber.toExponential(1).replace('e-', ' × 10⁻').replace(/(\d+)$/, (d) => toSup(d)));
      ro.set('err', `${errors}<small> / ${b.length} 比特</small>`);
      if (errors === 0 && ber < 1e-9) st.set('链路良好：误码率低于 10⁻⁹', 'ok');
      else if (errors === 0) st.set('勉强可用：这次没出错，但误码率偏高', 'warn');
      else if (open <= 0.05) st.set('色散太大：脉冲互相重叠，眼图闭合', 'bad');
      else st.set('光太弱：噪声淹没了信号', 'bad');
      redraw();
      S.shown = -1;
    }

    function restart() {
      S.t = 0;
      S.shown = -1;
    }

    // ---------- 动画 ----------
    function update(dt, t) {
      S.t += dt;
      const nb = msg.bits.length;
      const cycle = (nb - 1) * TB + TRANSIT + WIRE / V + 1.6;
      if (S.t > cycle) {
        S.t = 0;
        S.seed++;
        compute();
      }
      const T = S.t;
      const bits = msg.bits;

      // 输入电线上的比特
      let ui = 0;
      const k0 = Math.max(0, Math.ceil(T / TB));
      const k1 = Math.min(nb - 1, Math.floor((T + WIRE / V) / TB));
      for (let k = k0; k <= k1 && ui < inBits.length; k++) {
        const m = inBits[ui++];
        const x = -11.5 - (k * TB - T) * V;
        m.visible = true;
        m.material = bitMatOk;
        m.scale.y = bits[k] ? 0.7 : 0.08;
        m.position.set(x, -0.5 + m.scale.y / 2 + 0.05, 0);
      }
      for (; ui < inBits.length; ui++) inBits[ui].visible = false;

      // 光纤中的脉冲
      let pi = 0;
      const j0 = Math.max(0, Math.ceil((T - TRANSIT) / TB));
      const j1 = Math.min(nb - 1, Math.floor(T / TB));
      let txOn = 0;
      let rxOn = 0;
      for (let k = j0; k <= j1 && pi < pulsePool.length; k++) {
        if (!bits[k]) continue;
        const age = T - k * TB;
        const x = XT + age * V;
        const s = stateAt(x);
        const br = Math.min(broadOf(s.Dacc), 9);
        const bright = clamp(1 + s.dB / 30, 0.05, 1);
        const p = pulsePool[pi++];
        p.visible = true;
        p.position.set(x, 0, 0);
        p.scale.set(0.5 * br, 0.5, 1);
        p.material.opacity = bright / Math.sqrt(br);
        if (age < TB * 0.9) txOn = 1;
        if (age > TRANSIT - 0.12) rxOn = Math.max(rxOn, bright);
      }
      for (; pi < pulsePool.length; pi++) pulsePool[pi].visible = false;
      txGlow.material.opacity += ((txOn ? 1 : 0) - txGlow.material.opacity) * Math.min(1, dt * 30);
      rxGlow.material.opacity += (rxOn - rxGlow.material.opacity) * Math.min(1, dt * 20);
      pd.material.emissiveIntensity = rxGlow.material.opacity * 2;
      coilMat.emissiveIntensity = S.edfa ? 1.2 + 0.4 * Math.sin(t * 3) : 0;

      // 输出电线上的比特（判决结果）
      let oi = 0;
      const o0 = Math.max(0, Math.ceil((T - TRANSIT - WIRE / V) / TB));
      const o1 = Math.min(nb - 1, Math.floor((T - TRANSIT) / TB));
      for (let k = o0; k <= o1 && oi < outBits.length; k++) {
        const m = outBits[oi++];
        const x = 11.5 + (T - TRANSIT - k * TB) * V;
        const d = M.rx[k];
        m.visible = true;
        m.material = d === bits[k] ? bitMatOk : bitMatErr;
        m.scale.y = d ? 0.7 : 0.08;
        m.position.set(x, -0.5 + m.scale.y / 2 + 0.05, 0);
      }
      for (; oi < outBits.length; oi++) outBits[oi].visible = false;

      // 面板上的逐位输出
      const done = clamp(Math.floor((T - TRANSIT) / TB) + 1, 0, nb);
      if (done !== S.shown) {
        S.shown = done;
        renderBits(done);
      }
    }

    // ---------- 面板 ----------
    const input = h('input', { class: 'input', type: 'text', maxlength: '24', value: S.text, 'aria-label': '要发送的文字' });
    const sendBtn = h('button', { class: 'btn btn-primary', type: 'button' }, '发送');
    const send = () => {
      S.text = input.value || ' ';
      msg = textToBits(S.text);
      restart();
      compute();
    };
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => e.key === 'Enter' && send());

    const txBitsEl = h('div', { class: 'bits' });
    const rxBitsEl = h('div', { class: 'bits' });
    const outText = h('div', { class: 'msg-out' });

    function renderBits(done) {
      const b = msg.bits;
      let tx = '';
      let rxs = '';
      for (let k = 0; k < b.length; k++) {
        const sep = k % 8 === 7 ? ' ' : '';
        tx += b[k] + sep;
        if (k < done) rxs += M.rx[k] !== b[k] ? `<span class="b-err">${M.rx[k]}</span>${sep}` : M.rx[k] + sep;
        else rxs += `<span class="b-pend">·</span>${sep}`;
      }
      txBitsEl.innerHTML = tx;
      rxBitsEl.innerHTML = rxs;
      // 逐字符解码
      const chars = [...S.text];
      let off = 0;
      let html = '';
      const bytesDone = Math.floor(done / 8);
      for (const ch of chars) {
        const n = new TextEncoder().encode(ch).length;
        if (off + n > bytesDone) break;
        const rb = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          let v = 0;
          for (let k = 0; k < 8; k++) v = (v << 1) | M.rx[(off + i) * 8 + k];
          rb[i] = v;
        }
        const got = new TextDecoder('utf-8', { fatal: false }).decode(rb);
        const esc = got.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]).replace(/[\x00-\x1f\x7f]/g, '�');
        html += got === ch ? esc : `<span class="c-err">${esc || '�'}</span>`;
        off += n;
      }
      outText.innerHTML = html || '<span class="muted">等待光信号到达…</span>';
    }

    const ro = readouts([
      { key: 'prx', label: '接收光功率' },
      { key: 'margin', label: '功率余量' },
      { key: 'broad', label: '脉冲展宽' },
      { key: 'eye', label: '眼图张开度' },
      { key: 'ber', label: '理论误码率 BER' },
      { key: 'err', label: '本次误码' },
    ]);
    const st = status();

    const lamSeg = seg({ label: '波长', options: [{ value: 1310, label: '1310 nm' }, { value: 1550, label: '1550 nm' }], value: S.lam, onChange: (v) => ((S.lam = v), compute()) });
    const rateSeg = seg({ label: '码率', options: [{ value: 2.5, label: '2.5 Gb/s' }, { value: 10, label: '10 Gb/s' }, { value: 40, label: '40 Gb/s' }], value: S.rate, onChange: (v) => ((S.rate = v), compute()) });
    const spanSl = slider({ label: '每段光纤长度', min: 10, max: 150, step: 5, value: S.span, format: (v) => `${v} km × 2`, onInput: (v) => ((S.span = v), compute()) });
    const edfaT = toggle({ label: 'EDFA 光放大器', value: S.edfa, onChange: (v) => ((S.edfa = v), compute()) });
    const dcfT = toggle({ label: '色散补偿（DCF）', value: S.dcf, onChange: (v) => ((S.dcf = v), compute()) });

    // 示波器
    let scopeMode = 'wave';
    const scope = chartCanvas(200);
    const scopeSeg = seg({ options: [{ value: 'wave', label: '波形' }, { value: 'eye', label: '眼图' }], value: 'wave', onChange: (v) => ((scopeMode = v), redraw()) });

    function waveAt(t, sigma, norm) {
      // t 以比特周期为单位；返回脉冲叠加值
      const b = msg.bits;
      const k0 = Math.max(0, Math.floor(t - 8));
      const k1 = Math.min(b.length - 1, Math.ceil(t + 8));
      let s = 0;
      for (let k = k0; k <= k1; k++) if (b[k]) s += Math.exp(-((t - k) ** 2) / (2 * sigma * sigma));
      return s / norm;
    }
    function redraw() {
      if (!M.samples.length) return;
      const { g, w, h: hh } = scope.prep();
      const font = cssVar('--font');
      const primary = cssVar('--primary');
      const danger = cssVar('--danger');
      const text2 = cssVar('--text-2');
      const text3 = cssVar('--text-3');
      const lineC = cssVar('--line-strong');
      g.font = '11px ' + font;
      const rnd = mulberry(99 + S.seed);
      const noiseN = Math.min(msg.bits.length * 8 + 8, 4000);
      const noise = Array.from({ length: noiseN }, () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd()));
      const nz = (t) => {
        const u = (t + 0.5) * 8;
        const i = Math.max(0, Math.min(noiseN - 2, Math.floor(u)));
        const f = u - Math.floor(u);
        return (noise[i] * (1 - f) + noise[i + 1] * f) * M.sn;
      };
      const H0 = (() => {
        let s = 0;
        for (let m = -8; m <= 8; m++) s += Math.exp(-(m * m) / (2 * 0.09));
        return s;
      })();
      const rxWave = (t) => waveAt(t, M.sb, M.H) + nz(t);

      if (scopeMode === 'wave') {
        const nShow = Math.min(24, msg.bits.length);
        const L = 10;
        const R = w - 10;
        const X = (t) => L + ((t + 0.5) / nShow) * (R - L);
        const rows = [
          { name: '发送端光功率', y0: 88, amp: 56, f: (t) => waveAt(t, 0.3, H0 / H0) / 1 },
          { name: '接收端电信号（归一化）', y0: 182, amp: 64, f: rxWave },
        ];
        rows.forEach((r, i) => {
          g.fillStyle = text2;
          g.textAlign = 'left';
          g.fillText(r.name, L, r.y0 - r.amp - 8);
          g.strokeStyle = lineC;
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(L, r.y0);
          g.lineTo(R, r.y0);
          g.stroke();
          if (i === 1) {
            g.setLineDash([4, 3]);
            g.strokeStyle = text3;
            g.beginPath();
            g.moveTo(L, r.y0 - 0.5 * r.amp);
            g.lineTo(R, r.y0 - 0.5 * r.amp);
            g.stroke();
            g.setLineDash([]);
            g.fillStyle = text3;
            g.textAlign = 'right';
            g.fillText('判决门限', R, r.y0 - 0.5 * r.amp - 4);
          }
          g.strokeStyle = primary;
          g.lineWidth = 1.6;
          g.beginPath();
          for (let px = L; px <= R; px++) {
            const t = ((px - L) / (R - L)) * nShow - 0.5;
            let v = r.f(t);
            if (i === 0) v = Math.min(v, 1.2);
            const y = r.y0 - clamp(v, -0.3, 1.3) * r.amp;
            px === L ? g.moveTo(px, y) : g.lineTo(px, y);
          }
          g.stroke();
          if (i === 1) {
            for (let k = 0; k < nShow; k++) {
              const ok = M.rx[k] === msg.bits[k];
              g.fillStyle = ok ? primary : danger;
              g.beginPath();
              g.arc(X(k), r.y0 - clamp(M.samples[k], -0.3, 1.3) * r.amp, ok ? 2.5 : 4, 0, Math.PI * 2);
              g.fill();
            }
          }
          if (i === 0) {
            g.fillStyle = text3;
            g.textAlign = 'center';
            for (let k = 0; k < nShow; k++) g.fillText(msg.bits[k], X(k), r.y0 + 13);
          }
        });
      } else {
        const L = 34;
        const R = w - 14;
        const T = 16;
        const B = hh - 22;
        const X = (u) => L + (u / 2) * (R - L);
        const Y = (v) => B - ((clamp(v, -0.4, 1.4) + 0.4) / 1.8) * (B - T);
        g.strokeStyle = lineC;
        g.lineWidth = 1;
        g.strokeRect(L, T, R - L, B - T);
        g.setLineDash([4, 3]);
        g.strokeStyle = text3;
        g.beginPath();
        g.moveTo(L, Y(0.5));
        g.lineTo(R, Y(0.5));
        g.moveTo(X(1), T);
        g.lineTo(X(1), B);
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 0.28;
        g.strokeStyle = primary;
        g.lineWidth = 1.2;
        const nb = msg.bits.length;
        for (let k = 1; k < nb - 1; k++) {
          g.beginPath();
          for (let i = 0; i <= 60; i++) {
            const u = (i / 60) * 2;
            const t = k - 1 + u;
            const y = Y(rxWave(t - 0));
            i === 0 ? g.moveTo(X(u), y) : g.lineTo(X(u), y);
          }
          g.stroke();
        }
        g.globalAlpha = 1;
        g.fillStyle = text3;
        g.textAlign = 'right';
        g.fillText('1', L - 6, Y(1) + 4);
        g.fillText('0', L - 6, Y(0) + 4);
        g.textAlign = 'center';
        g.fillText('采样时刻', X(1), hh - 6);
        g.fillStyle = M.open > 0.3 ? text2 : danger;
        g.textAlign = 'left';
        g.fillText(M.open > 0 ? `眼图张开 ${Math.round(M.open * 100)}%` : '眼图闭合', L + 6, T + 14);
      }
    }

    const steps = [
      ['信源编码', '文字先按 UTF-8 编码成字节，每个字节 8 个比特。英文字母 1 字节，汉字 3 字节。', new THREE.Vector3(-13, 2.5, 8), new THREE.Vector3(-13, 0, 0)],
      ['电光转换', '发射机里的半导体激光器受电信号控制：比特 1 时发光，比特 0 时（几乎）不发光，这叫强度调制（OOK）。', new THREE.Vector3(-9, 2.5, 7.5), new THREE.Vector3(-10, 0, 0)],
      ['光纤传输', '光脉冲以约 20 万 km/s 前进。一路上它会变暗（衰减）、变宽（色散）：不同波长成分速度略有差别，脉冲被慢慢拉开。', new THREE.Vector3(-5, 3, 9), new THREE.Vector3(-5, 0, 0)],
      ['光放大', '掺铒光纤放大器（EDFA）用 980 nm 泵浦光激发铒离子，信号光经过时受激辐射，被直接放大，不用先转成电信号。色散补偿光纤（DCF）的色散符号相反，能把展宽的脉冲“压”回去。', new THREE.Vector3(1.5, 2.6, 6), new THREE.Vector3(0, 0, 0)],
      ['光电转换', '接收机里的光电二极管（PIN / APD）把光子变成电流：光越强，电流越大。', new THREE.Vector3(9, 2.5, 7.5), new THREE.Vector3(10, 0, 0)],
      ['判决与解码', '时钟恢复电路在每个比特的中间时刻采样，高于门限判为 1，否则为 0；再把比特重新组装成字节和文字。噪声或码间干扰让采样值越过门限，就产生误码。', new THREE.Vector3(13, 2.5, 8), new THREE.Vector3(13, 0, 0)],
    ];
    const stepEls = steps.map(([name, desc, pos, tgt], i) => {
      const el = h('button', { class: 'step', type: 'button' }, h('div', { class: 'step-name' }, name), h('div', { class: 'step-desc' }, desc));
      el.addEventListener('click', () => {
        const on = !el.classList.contains('on');
        stepEls.forEach((e) => e.classList.remove('on'));
        if (on) {
          el.classList.add('on');
          ctx.flyTo(pos, tgt);
        } else ctx.flyTo(camera.userData.home.pos, camera.userData.home.target);
        void i;
      });
      return el;
    });

    const panel = [
      ...head(
        '第 7 章',
        '一句话是怎样“坐着光”跑过 100 公里的',
        '输入一段文字，看它变成比特、变成光脉冲，在两段光纤中衰减和展宽，经过放大器，最后被接收机还原。调节右侧参数，制造（并修复）一条坏掉的链路。',
      ),
      section('发送内容', h('div', { class: 'msg-row' }, input, sendBtn), h('div', { class: 'note', style: 'margin:6px 0 4px' }, '发送的比特'), txBitsEl, h('div', { class: 'note', style: 'margin:10px 0 4px' }, '接收的比特（红色为误码）'), rxBitsEl, h('div', { class: 'note', style: 'margin:10px 0 4px' }, '接收端还原的文字'), outText),
      section('六个步骤（点击查看）', h('div', { class: 'steps' }, stepEls)),
      section('链路参数', lamSeg.el, rateSeg.el, spanSl.el, edfaT.el, dcfT.el),
      section('', ro.el, h('div', { style: 'margin-top:10px' }, st.el)),
      section('示波器', scopeSeg.el, scope.el, note('“眼图”把每两个比特周期的波形叠在一起：中间的“眼睛”张得越大，接收端越容易分清 0 和 1。')),
      section(
        '试试这些',
        h(
          'ul',
          { class: 'p-list' },
          h('li', { html: '关掉 EDFA，把每段拉到 120 km：光太弱，噪声淹没信号。' }),
          h('li', { html: '把码率调到 40 Gb/s、关掉色散补偿：脉冲严重重叠，眼图闭合。' }),
          h('li', { html: '换成 1310 nm：几乎没有色散，但损耗更大。' }),
        ),
        para('提示：三维场景中脉冲的亮度按分贝显示，实际上 100 km 后光功率只剩约 1%。', true),
      ),
    ];

    compute();
    renderBits(0);

    return {
      scene,
      camera,
      panel,
      update,
      redraw,
      limits: { minDistance: 4, maxDistance: 50 },
      tools: [
        { label: '重新发送', onClick: () => restart() },
        { label: '全景', group: 'view', active: true, home: true, onClick: () => (stepEls.forEach((e) => e.classList.remove('on')), ctx.flyTo(camera.userData.home.pos, camera.userData.home.target)) },
        { label: '近景', group: 'view', onClick: () => ctx.flyTo(new THREE.Vector3(-4, 1.6, 6), new THREE.Vector3(-1, 0, 0)) },
      ],
    };
  },
};

function toSup(d) {
  const m = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  return String(d)
    .replace(/^0+/, '')
    .split('')
    .map((c) => m[c])
    .join('');
}
