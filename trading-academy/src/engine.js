// Торговый движок: изолированная маржа, комиссии, SL/TP/ликвидация, разбор ошибок
import { uid } from './lib.js';

export const FEE = 0.0005;   // 0,05% тейкер
export const MMR = 0.005;    // поддерживающая маржа 0,5%
export const START_BALANCE = 10000;

export function newAccount(start = START_BALANCE) {
  return { balance: start, start, positions: [], orders: [], history: [], equity: [{ t: Date.now(), v: start }], drawings: {}, createdAt: Date.now() };
}

export function liqPrice(side, entry, lev) {
  if (lev <= 1) return side === 'long' ? 0 : entry * 2; // без плеча ликвидации фактически нет
  return side === 'long' ? entry * (1 - 1 / lev + MMR) : entry * (1 + 1 / lev - MMR);
}

export function upnl(p, price) {
  const dir = p.side === 'long' ? 1 : -1;
  return (price - p.entry) * p.qty * dir;
}

export function equityOf(acc, prices) {
  let e = acc.balance;
  for (const p of acc.positions) {
    const px = prices[p.sym];
    e += p.margin + (px ? upnl(p, px) : 0);
  }
  for (const o of acc.orders) e += o.margin + o.feeRes;
  return e;
}

export function usedMargin(acc) {
  return acc.positions.reduce((s, p) => s + p.margin, 0) + acc.orders.reduce((s, o) => s + o.margin + o.feeRes, 0);
}

// Проверка параметров ордера. Возвращает {ok, errors[], warnings[], calc}
export function previewOrder({ side, entry, qty, lev, sl, tp, equity, available }) {
  const errors = [], warnings = [];
  const notional = entry * qty;
  const margin = notional / lev;
  const fee = notional * FEE;
  const liq = liqPrice(side, entry, lev);
  let riskUsd = null, rewardUsd = null, rr = null, riskPct = null;
  if (!(qty > 0) || !(entry > 0)) errors.push('Укажите размер позиции.');
  if (!(sl > 0)) errors.push('Stop-Loss обязателен.');
  if (!(tp > 0)) errors.push('Take-Profit обязателен.');
  if (sl > 0) {
    if (side === 'long' && sl >= entry) errors.push('Для лонга стоп должен быть ниже цены входа.');
    if (side === 'short' && sl <= entry) errors.push('Для шорта стоп должен быть выше цены входа.');
    if (side === 'long' && lev > 1 && sl <= liq) errors.push('Стоп ниже цены ликвидации — позицию ликвидируют раньше стопа. Уменьшите плечо или подвиньте стоп.');
    if (side === 'short' && lev > 1 && sl >= liq) errors.push('Стоп выше цены ликвидации — позицию ликвидируют раньше стопа.');
  }
  if (tp > 0) {
    if (side === 'long' && tp <= entry) errors.push('Для лонга тейк должен быть выше цены входа.');
    if (side === 'short' && tp >= entry) errors.push('Для шорта тейк должен быть ниже цены входа.');
  }
  if (margin + fee > available + 1e-9) errors.push('Недостаточно свободных средств для маржи.');
  if (sl > 0 && qty > 0) {
    riskUsd = Math.abs(entry - sl) * qty + fee * 2;
    riskPct = (riskUsd / equity) * 100;
    if (riskPct > 2) warnings.push({ sev: 'high', t: `Риск ${riskPct.toFixed(2)}% депозита — в 2+ раза выше нормы 1%.` });
    else if (riskPct > 1.05) warnings.push({ sev: 'mid', t: `Риск ${riskPct.toFixed(2)}% — выше правила 1%.` });
    const stopDist = Math.abs(entry - sl) / entry * 100;
    if (stopDist < 0.15) warnings.push({ sev: 'mid', t: `Стоп всего ${stopDist.toFixed(2)}% от входа — внутри обычного шума, высок шанс случайного срабатывания.` });
  }
  if (tp > 0 && sl > 0 && qty > 0) {
    rewardUsd = Math.abs(tp - entry) * qty - fee * 2;
    rr = Math.abs(tp - entry) / Math.abs(entry - sl);
    if (rr < 1.5) warnings.push({ sev: 'mid', t: `Прибыль/риск 1:${rr.toFixed(2)} — ниже 1:1,5. С таким RR нужен высокий винрейт.` });
  }
  if (lev >= 8) warnings.push({ sev: 'mid', t: `Плечо ${lev}x: ликвидация в ~${(100 / lev - MMR * 100).toFixed(1)}% от входа.` });
  if (margin > equity * 0.5) warnings.push({ sev: 'high', t: 'В одну сделку заложено больше 50% капитала.' });
  return { ok: errors.length === 0, errors, warnings, calc: { notional, margin, fee, liq, riskUsd, rewardUsd, rr, riskPct } };
}

function tradeFlags(acc, pos, now) {
  const flags = [];
  if (pos.riskPct > 2) flags.push({ k: 'risk', sev: 'high', t: `Риск ${pos.riskPct.toFixed(2)}% депозита (норма ≤ 1%)` });
  else if (pos.riskPct > 1.05) flags.push({ k: 'risk', sev: 'mid', t: `Риск ${pos.riskPct.toFixed(2)}% — выше 1%` });
  if (pos.rr != null && pos.rr < 1.5) flags.push({ k: 'rr', sev: 'mid', t: `Плановый RR 1:${pos.rr.toFixed(2)} ниже 1:1,5` });
  if (pos.lev >= 8) flags.push({ k: 'lev', sev: 'mid', t: `Высокое плечо ${pos.lev}x` });
  if (pos.margin > pos.eqAtOpen * 0.5) flags.push({ k: 'size', sev: 'high', t: 'Больше половины капитала в одной сделке' });
  const lastLoss = acc.history.find(h => h.net < 0);
  if (lastLoss && now - lastLoss.closeT < 3 * 60e3 && pos.openT - lastLoss.closeT < 3 * 60e3 && pos.openT >= lastLoss.closeT) {
    flags.push({ k: 'revenge', sev: 'high', t: 'Сделка мести: вход менее чем через 3 минуты после убытка' });
  }
  const recent = acc.history.filter(h => pos.openT - h.openT < 60 * 60e3 && h.openT <= pos.openT).length;
  if (recent >= 5) flags.push({ k: 'over', sev: 'mid', t: `Овертрейдинг: ${recent + 1}-я сделка за час` });
  return flags;
}

export function openPosition(acc, { sym, side, entry, qty, lev, sl, tp, now, prices, fromOrder = false }) {
  const notional = entry * qty;
  const margin = notional / lev;
  const fee = notional * FEE;
  const eq = equityOf(acc, prices);
  const riskUsd = Math.abs(entry - sl) * qty + fee * 2;
  const pos = {
    id: uid(), sym, side, entry, qty, lev, sl, tp, initSl: sl, margin, feeOpen: fee,
    liq: liqPrice(side, entry, lev), openT: now, riskUsd, riskPct: (riskUsd / eq) * 100,
    rr: Math.abs(tp - entry) / Math.abs(entry - sl), eqAtOpen: eq, slWidened: false, fromOrder,
  };
  pos.flags = tradeFlags(acc, pos, now);
  return { ...acc, balance: acc.balance - (fromOrder ? 0 : margin + fee), positions: [...acc.positions, pos] };
}

export function placeOrder(acc, { sym, side, price, qty, lev, sl, tp, now }) {
  const notional = price * qty;
  const margin = notional / lev, feeRes = notional * FEE;
  const o = { id: uid(), sym, side, price, qty, lev, sl, tp, margin, feeRes, t: now };
  return { ...acc, balance: acc.balance - margin - feeRes, orders: [...acc.orders, o] };
}

export function cancelOrder(acc, id) {
  const o = acc.orders.find(x => x.id === id); if (!o) return acc;
  return { ...acc, balance: acc.balance + o.margin + o.feeRes, orders: acc.orders.filter(x => x.id !== id) };
}

export function closePosition(acc, id, price, reason, now) {
  const p = acc.positions.find(x => x.id === id); if (!p) return acc;
  let gross = upnl(p, price);
  const feeClose = reason === 'liq' ? 0 : price * p.qty * FEE;
  if (reason === 'liq') gross = -p.margin;
  const net = gross - p.feeOpen - feeClose;
  const R = net / p.riskUsd;
  const flags = [...(p.flags || [])];
  if (p.slWidened) flags.push({ k: 'moved', sev: 'high', t: 'Стоп отодвигали дальше от входа' });
  if (reason === 'liq') flags.push({ k: 'liq', sev: 'high', t: 'Позицию ликвидировали — стоп был дальше ликвидации' });
  if (reason === 'manual' && net > 0 && R < 0.5 && p.rr >= 1.5) flags.push({ k: 'early', sev: 'low', t: `Ранний выход из прибыли: +${R.toFixed(2)}R при цели ${p.rr.toFixed(1)}R` });
  if (reason === 'manual' && net < 0 && R < -1.05) flags.push({ k: 'late', sev: 'high', t: 'Убыток больше запланированного риска' });
  const rec = {
    id: p.id, sym: p.sym, side: p.side, entry: p.entry, exit: price, qty: p.qty, lev: p.lev, sl: p.initSl, finalSl: p.sl, tp: p.tp,
    openT: p.openT, closeT: now, reason, gross, fees: p.feeOpen + feeClose, net, R, riskPct: p.riskPct, rr: p.rr, flags,
    grade: gradeOf(flags, R, reason),
  };
  const balance = acc.balance + (reason === 'liq' ? 0 : p.margin + gross - feeClose);
  const history = [rec, ...acc.history].slice(0, 300);
  const eqPts = [...acc.equity, { t: now, v: balance + acc.positions.filter(x => x.id !== id).reduce((s, x) => s + x.margin, 0) + acc.orders.reduce((s, o) => s + o.margin + o.feeRes, 0) }].slice(-400);
  return { ...acc, balance, positions: acc.positions.filter(x => x.id !== id), history, equity: eqPts };
}

function gradeOf(flags, R, reason) {
  const hi = flags.filter(f => f.sev === 'high').length, mid = flags.filter(f => f.sev === 'mid').length;
  if (reason === 'liq' || hi >= 2) return 'F';
  if (hi === 1) return 'D';
  if (mid >= 2) return 'C';
  if (mid === 1) return 'B';
  return 'A';
}

export function editStops(acc, id, { sl, tp }) {
  return {
    ...acc, positions: acc.positions.map(p => {
      if (p.id !== id) return p;
      const n = { ...p };
      if (sl != null && sl > 0) {
        const widened = p.side === 'long' ? sl < p.sl : sl > p.sl;
        if (widened && (p.side === 'long' ? sl < p.initSl : sl > p.initSl)) n.slWidened = true;
        n.sl = sl;
      }
      if (tp != null && tp > 0) n.tp = tp;
      return n;
    }),
  };
}

// Проверка по движению цены. hi/lo — диапазон за период (для свечей), для тика hi=lo=price
export function tick(acc, sym, { hi, lo, last }, now) {
  let a = acc, changed = false;
  // лимитные ордера
  for (const o of acc.orders) {
    if (o.sym !== sym) continue;
    const fill = o.side === 'long' ? lo <= o.price : hi >= o.price;
    if (fill) {
      a = { ...a, orders: a.orders.filter(x => x.id !== o.id), balance: a.balance };
      const prices = { [sym]: last };
      a = openPosition(a, { sym, side: o.side, entry: o.price, qty: o.qty, lev: o.lev, sl: o.sl, tp: o.tp, now, prices, fromOrder: true });
      // маржа уже зарезервирована: корректируем
      const p = a.positions[a.positions.length - 1];
      a = { ...a, balance: a.balance + o.margin + o.feeRes - p.margin - p.feeOpen };
      changed = true;
    }
  }
  for (const p of a.positions) {
    if (p.sym !== sym) continue;
    let exit = null, reason = null;
    if (p.side === 'long') {
      if (p.lev > 1 && lo <= p.liq && p.liq > p.sl) { exit = p.liq; reason = 'liq'; }
      else if (lo <= p.sl) { exit = Math.min(p.sl, hi); reason = 'sl'; }
      else if (hi >= p.tp) { exit = Math.max(p.tp, lo); reason = 'tp'; }
    } else {
      if (p.lev > 1 && hi >= p.liq && p.liq < p.sl) { exit = p.liq; reason = 'liq'; }
      else if (hi >= p.sl) { exit = Math.max(p.sl, lo); reason = 'sl'; }
      else if (lo <= p.tp) { exit = Math.min(p.tp, hi); reason = 'tp'; }
    }
    if (exit != null) { a = closePosition(a, p.id, exit, reason, now); changed = true; }
  }
  return changed ? a : acc;
}

export function stats(acc) {
  const h = acc.history;
  const n = h.length;
  const wins = h.filter(x => x.net > 0);
  const losses = h.filter(x => x.net <= 0);
  const gp = wins.reduce((s, x) => s + x.net, 0), gl = -losses.reduce((s, x) => s + x.net, 0);
  const avgR = n ? h.reduce((s, x) => s + x.R, 0) / n : 0;
  let peak = acc.start, mdd = 0;
  for (const p of acc.equity) { peak = Math.max(peak, p.v); mdd = Math.max(mdd, (peak - p.v) / peak); }
  const flagCount = {};
  for (const x of h) for (const f of x.flags) flagCount[f.k] = (flagCount[f.k] || 0) + 1;
  const clean = h.filter(x => x.grade === 'A' || x.grade === 'B').length;
  return {
    n, winrate: n ? (wins.length / n) * 100 : 0, avgR, pf: gl > 0 ? gp / gl : gp > 0 ? Infinity : 0,
    net: h.reduce((s, x) => s + x.net, 0), mdd: mdd * 100, best: n ? Math.max(...h.map(x => x.net)) : 0,
    worst: n ? Math.min(...h.map(x => x.net)) : 0, fees: h.reduce((s, x) => s + x.fees, 0), flagCount,
    discipline: n ? (clean / n) * 100 : 100,
  };
}

export const FLAG_NAMES = {
  risk: 'Риск выше 1%', rr: 'Низкий RR', lev: 'Высокое плечо', size: 'Слишком крупная позиция', revenge: 'Сделка мести',
  over: 'Овертрейдинг', moved: 'Отодвинутый стоп', liq: 'Ликвидация', early: 'Ранний выход из прибыли', late: 'Убыток больше риска',
};
