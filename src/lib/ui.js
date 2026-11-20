// 讲解面板的 DOM 小组件（全部基于 tokens.css / style.css 的类名）

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** 章节开头：小标题 + 大标题 + 导语 */
export function head(kicker, title, lead) {
  return [h('div', { class: 'p-kicker' }, kicker), h('h2', { class: 'p-title' }, title), h('p', { class: 'p-lead', html: lead })];
}

export function section(title, ...children) {
  return h('section', { class: 'p-sec' }, title ? h('h3', {}, title) : null, ...children);
}

export const para = (html, muted = false) => h('p', { class: 'p-text' + (muted ? ' muted' : ''), html });
export const list = (items) => h('ul', { class: 'p-list' }, items.map((t) => h('li', { html: t })));
export const formula = (html, note) => h('div', { class: 'formula', html: html + (note ? `<span class="note">${note}</span>` : '') });
export const note = (html) => h('p', { class: 'note', html });

/** 滑块 */
export function slider({ label, min, max, step = 1, value, format = (v) => v, onInput }) {
  const val = h('span', { class: 'ctrl-value' });
  const input = h('input', { class: 'range', type: 'range', min, max, step, value, 'aria-label': label });
  const paint = () => {
    const v = Number(input.value);
    val.innerHTML = format(v);
    input.style.setProperty('--pct', ((v - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100 + '%');
  };
  input.addEventListener('input', () => {
    paint();
    onInput && onInput(Number(input.value));
  });
  paint();
  const el = h('div', { class: 'ctrl' }, h('div', { class: 'ctrl-head' }, h('span', { class: 'ctrl-label' }, label), val), input);
  return {
    el,
    input,
    get: () => Number(input.value),
    set(v, fire = false) {
      input.value = v;
      paint();
      if (fire && onInput) onInput(Number(input.value));
    },
    setRange(mn, mx) {
      input.min = mn;
      input.max = mx;
      paint();
    },
  };
}

/** 分段控件 */
export function seg({ label, options, value, onChange }) {
  let cur = value;
  const btns = options.map((o) =>
    h('button', { type: 'button', title: o.title || o.label, onClick: () => set(o.value, true) }, o.label),
  );
  const bar = h('div', { class: 'seg', role: 'group' }, btns);
  function set(v, fire = false) {
    cur = v;
    options.forEach((o, i) => btns[i].classList.toggle('on', o.value === v));
    if (fire && onChange) onChange(v);
  }
  set(value);
  const el = h('div', { class: 'ctrl' }, label ? h('div', { class: 'ctrl-head' }, h('span', { class: 'ctrl-label' }, label)) : null, bar);
  return { el, set, get: () => cur };
}

/** 开关 */
export function toggle({ label, value = false, onChange }) {
  let on = value;
  const sw = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-label': label, onClick: () => set(!on, true) });
  function set(v, fire = false) {
    on = v;
    sw.classList.toggle('on', on);
    sw.setAttribute('aria-checked', String(on));
    if (fire && onChange) onChange(on);
  }
  set(value);
  const el = h('div', { class: 'switch-row' }, h('span', { class: 'ctrl-label' }, label), sw);
  return { el, set, get: () => on };
}

/** 读数卡片 */
export function readouts(defs) {
  const cells = {};
  const el = h(
    'div',
    { class: 'readouts' },
    defs.map((d) => {
      const v = h('div', { class: 'r-value' }, '—');
      cells[d.key] = v;
      return h('div', { class: 'readout' + (d.wide ? ' wide' : '') }, h('div', { class: 'r-label' }, d.label), v);
    }),
  );
  return {
    el,
    set(key, html) {
      if (cells[key] && cells[key].innerHTML !== html) cells[key].innerHTML = html;
    },
  };
}

/** 状态（小圆点 + 文字） */
export function status(text = '', kind = '') {
  const el = h('span', { class: 'status ' + kind }, text);
  return {
    el,
    set(t, k) {
      el.textContent = t;
      el.className = 'status ' + (k || '');
    },
  };
}

/** 高清 2D 画布（图表用），返回绘制上下文和尺寸 */
export function chartCanvas(height = 180) {
  const c = h('canvas', { class: 'chart' });
  c.style.height = height + 'px';
  function prep() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth || 320;
    const hh = height;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(hh * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(hh * dpr);
    }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hh);
    return { g, w, h: hh };
  }
  return { el: c, prep };
}

/** 读取 CSS 变量（图表配色跟随主题） */
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
