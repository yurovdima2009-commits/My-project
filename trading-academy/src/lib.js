// Общие утилиты: случайные числа, генерация свечей, индикаторы, форматирование

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rnd) {
  let u = 0, v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Свечи по опорным точкам: anchors = [[index, price], ...]
// overrides = {i: {o,h,l,c,v}} частичная замена
export function candlesFromAnchors({ anchors, seed = 1, noise = 0.004, wick = 0.5, start = Date.UTC(2024, 0, 8, 9), stepMs = 3600e3, baseVol = 1000, overrides = {} }) {
  const rnd = mulberry32(seed);
  const n = anchors[anchors.length - 1][0] + 1;
  const closes = new Array(n);
  for (let k = 0; k < anchors.length - 1; k++) {
    const [i0, p0] = anchors[k], [i1, p1] = anchors[k + 1];
    for (let i = i0; i <= i1; i++) {
      const t = (i - i0) / Math.max(1, i1 - i0);
      closes[i] = p0 + (p1 - p0) * t;
    }
  }
  // шум, затухающий к опорным точкам
  let drift = 0;
  const out = [];
  let prevC = closes[0];
  for (let i = 0; i < n; i++) {
    drift = drift * 0.6 + gauss(rnd) * noise * 0.8;
    const base = closes[i];
    const isAnchor = anchors.some(a => a[0] === i);
    const c = isAnchor ? base : base * (1 + drift);
    const o = i === 0 ? c * (1 - noise * gauss(rnd) * 0.5) : prevC;
    const body = Math.abs(c - o);
    const range = Math.max(body, base * noise * 0.8);
    const h = Math.max(o, c) + range * wick * rnd();
    const l = Math.min(o, c) - range * wick * rnd();
    const v = baseVol * (0.6 + rnd() * 0.8) * (1 + Math.abs(c - o) / (base * noise * 2));
    out.push({ t: start + i * stepMs, o, h, l, c, v });
    prevC = c;
  }
  for (const k in overrides) {
    const i = +k; if (!out[i]) continue;
    const ov = overrides[k];
    const cd = { ...out[i] };
    if (ov.o != null) cd.o = ov.o;
    if (ov.c != null) cd.c = ov.c;
    if (ov.vm != null) cd.v *= ov.vm;
    cd.h = Math.max(cd.o, cd.c, ov.h != null ? ov.h : cd.h);
    cd.l = Math.min(cd.o, cd.c, ov.l != null ? ov.l : cd.l);
    out[i] = cd;
    if (out[i + 1] && ov.c != null) {
      const nx = { ...out[i + 1], o: ov.c };
      nx.h = Math.max(nx.h, nx.o, nx.c); nx.l = Math.min(nx.l, nx.o, nx.c);
      out[i + 1] = nx;
    }
  }
  return out;
}

// Реалистичный рынок: смена режимов (тренд/боковик/паника), кластеры волатильности
export function genMarket({ n = 400, seed = 7, price = 100, stepMs = 3600e3, start = Date.UTC(2023, 2, 1), vol = 0.008 }) {
  const rnd = mulberry32(seed);
  const out = [];
  let p = price, sigma = vol, regime = 0, left = 0, mu = 0;
  for (let i = 0; i < n; i++) {
    if (left <= 0) {
      const r = rnd();
      if (r < 0.32) { regime = 1; mu = vol * (0.15 + rnd() * 0.25); }
      else if (r < 0.62) { regime = -1; mu = -vol * (0.15 + rnd() * 0.25); }
      else if (r < 0.94) { regime = 0; mu = 0; }
      else { regime = 2; mu = (rnd() < 0.5 ? -1 : 1) * vol * 1.2; }
      left = regime === 2 ? 3 + Math.floor(rnd() * 5) : 20 + Math.floor(rnd() * 50);
    }
    left--;
    sigma = Math.max(vol * 0.5, Math.min(vol * 3, sigma * 0.92 + vol * 0.08 + Math.abs(gauss(rnd)) * vol * 0.06));
    const s = regime === 2 ? sigma * 2.2 : sigma;
    const ret = mu + gauss(rnd) * s;
    const o = p;
    const c = Math.max(0.0001, o * (1 + ret));
    const h = Math.max(o, c) * (1 + Math.abs(gauss(rnd)) * s * 0.45);
    const l = Math.min(o, c) * (1 - Math.abs(gauss(rnd)) * s * 0.45);
    const v = 1000 * (0.5 + rnd()) * (1 + Math.abs(ret) / vol) * (regime === 2 ? 2.5 : 1);
    out.push({ t: start + i * stepMs, o, h, l, c, v });
    p = c;
    if (regime === 0) p = p + (price - p) * 0.0; // боковик без тяги
  }
  return out;
}

export function sma(arr, n, key = 'c') {
  const out = new Array(arr.length).fill(null);
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    s += arr[i][key];
    if (i >= n) s -= arr[i - n][key];
    if (i >= n - 1) out[i] = s / n;
  }
  return out;
}

export function ema(arr, n, key = 'c') {
  const out = new Array(arr.length).fill(null);
  const k = 2 / (n + 1);
  let e = null;
  for (let i = 0; i < arr.length; i++) {
    const x = arr[i][key];
    e = e == null ? x : x * k + e * (1 - k);
    if (i >= n - 1) out[i] = e;
  }
  return out;
}

export function rsi(arr, n = 14) {
  const out = new Array(arr.length).fill(null);
  let g = 0, l = 0;
  for (let i = 1; i < arr.length; i++) {
    const d = arr[i].c - arr[i - 1].c;
    const up = Math.max(d, 0), dn = Math.max(-d, 0);
    if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; out[i] = 100 - 100 / (1 + g / (l || 1e-9)); } }
    else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; out[i] = 100 - 100 / (1 + g / (l || 1e-9)); }
  }
  return out;
}

export function decimalsFor(p) {
  if (p >= 1000) return 2;
  if (p >= 10) return 2;
  if (p >= 1) return 3;
  if (p >= 0.1) return 4;
  return 5;
}

export function fmtP(p, d) {
  if (p == null || !isFinite(p)) return '—';
  const dd = d != null ? d : decimalsFor(Math.abs(p));
  return p.toLocaleString('ru-RU', { minimumFractionDigits: dd, maximumFractionDigits: dd });
}

export function fmtUsd(x, sign = false) {
  if (x == null || !isFinite(x)) return '—';
  const s = Math.abs(x).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pre = x < 0 ? '−' : sign && x > 0 ? '+' : '';
  return pre + '$' + s;
}

export function fmtPct(x, sign = true) {
  if (x == null || !isFinite(x)) return '—';
  const pre = x < 0 ? '−' : sign && x > 0 ? '+' : '';
  return pre + Math.abs(x).toFixed(2) + '%';
}

export function fmtK(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(1);
}

export function fmtVol(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + ' млрд';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + ' млн';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + ' тыс';
  return v.toFixed(2);
}

export function fmtTime(t, tf) {
  const d = new Date(t);
  const p2 = x => String(x).padStart(2, '0');
  if (tf === 'day') return p2(d.getDate()) + '.' + p2(d.getMonth() + 1);
  return p2(d.getHours()) + ':' + p2(d.getMinutes());
}

export function fmtDateTime(t) {
  const d = new Date(t);
  const p2 = x => String(x).padStart(2, '0');
  return p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
}

export function niceStep(range, ticks) {
  const raw = range / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  const nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  return nf * mag;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
