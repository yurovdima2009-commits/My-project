import Chart from './chart.jsx';
import { genMarket, sma, rsi, fmtP, fmtDateTime } from './lib.js';
import { newAccount, openPosition, placeOrder, cancelOrder, closePosition, editStops, tick, equityOf } from './engine.js';
import { OrderForm, PositionsTable, HistoryTable, StatsPanel, AccountBar } from './tradeui.jsx';
const { useState, useMemo, useEffect, useRef } = React;

const N = 1400, START = 150;
const ASSETS = [
  { name: 'Актив A (как BTC)', price: 28000, vol: 0.009 },
  { name: 'Актив B (как ETH)', price: 1800, vol: 0.011 },
  { name: 'Актив C (альткоин)', price: 22, vol: 0.016 },
];

export function newSim() {
  const seed = Math.floor(Math.random() * 1e6);
  return { seed, asset: seed % ASSETS.length, idx: START, account: newAccount() };
}

export default function Trainer({ sim, setSim }) {
  const a = ASSETS[sim.asset] || ASSETS[0];
  const all = useMemo(() => genMarket({ n: N, seed: sim.seed, price: a.price, vol: a.vol, stepMs: 3600e3, start: Date.UTC(2021, (sim.seed % 12), 1) }), [sim.seed]);
  const ma20 = useMemo(() => sma(all, 20), [all]);
  const ma50 = useMemo(() => sma(all, 50), [all]);
  const rs = useMemo(() => rsi(all), [all]);
  const [speed, setSpeed] = useState(0);
  const [sl, setSl] = useState(''), [tp, setTp] = useState('');
  const [pick, setPick] = useState('sl');
  const [tab, setTab] = useState('pos');
  const [ind, setInd] = useState({ ma: true, rsi: false });
  const idx = Math.min(sim.idx, N - 1);
  const cur = all[idx];
  const acc = sim.account;
  const prices = { SIM: cur.c };
  const simRef = useRef(sim); simRef.current = sim;

  const step = (k = 1) => setSim(s => {
    let ac = s.account, i = s.idx;
    for (let j = 0; j < k && i < N - 1; j++) {
      i++;
      const c = all[i];
      ac = tick(ac, 'SIM', { hi: c.h, lo: c.l, last: c.c }, c.t);
    }
    if (i === s.idx) return s;
    return { ...s, idx: i, account: ac };
  });

  useEffect(() => {
    if (!speed) return;
    const iv = setInterval(() => {
      if (simRef.current.idx >= N - 1) { setSpeed(0); return; }
      step(1);
    }, 1000 / speed);
    return () => clearInterval(iv);
  }, [speed, all]);

  useEffect(() => {
    const onKey = e => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      if (e.key === ' ') { e.preventDefault(); setSpeed(s => s ? 0 : 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [all]);

  const setAcc = fn => setSim(s => ({ ...s, account: fn(s.account) }));
  const submit = o => setAcc(ac => o.type === 'limit'
    ? placeOrder(ac, { sym: 'SIM', side: o.side, price: o.price, qty: o.qty, lev: o.lev, sl: o.sl, tp: o.tp, now: cur.t })
    : openPosition(ac, { sym: 'SIM', side: o.side, entry: cur.c, qty: o.qty, lev: o.lev, sl: o.sl, tp: o.tp, now: cur.t, prices }));

  const newSession = () => {
    setSpeed(0);
    setSim(s => {
      let ac = s.account;
      for (const p of ac.positions) ac = closePosition(ac, p.id, cur.c, 'manual', cur.t);
      for (const o of ac.orders) ac = cancelOrder(ac, o.id);
      const n = newSim();
      return { ...n, account: ac };
    });
  };

  const visible = all.slice(0, idx + 1);
  const lines = [];
  for (const p of acc.positions) {
    lines.push({ price: p.entry, color: 'var(--accent)', label: `${p.side === 'long' ? 'Long' : 'Short'} ${p.lev}x`, dash: '2 2' });
    lines.push({ price: p.sl, color: 'var(--dn)', label: 'SL', short: 'SL' });
    lines.push({ price: p.tp, color: 'var(--up)', label: 'TP', short: 'TP' });
  }
  for (const o of acc.orders) lines.push({ price: o.price, color: 'var(--accent-2)', label: 'Limit', dash: '6 3' });
  const slN = parseFloat(sl), tpN = parseFloat(tp);
  if (slN > 0) lines.push({ price: slN, color: 'var(--dn)', label: 'новый SL', dash: '3 3' });
  if (tpN > 0) lines.push({ price: tpN, color: 'var(--up)', label: 'новый TP', dash: '3 3' });
  const markers = [];
  for (const h of acc.history.slice(0, 40)) {
    if (h.sym !== 'SIM' || h.openT < all[0].t || h.closeT > cur.t) continue;
    markers.push({ t: h.openT, price: h.entry, type: h.side === 'long' ? 'buy' : 'sell' });
    markers.push({ t: h.closeT, price: h.exit, type: 'exit', label: (h.R >= 0 ? '+' : '') + h.R.toFixed(1) + 'R' });
  }
  const eq = equityOf(acc, prices);
  const dec = cur.c > 1000 ? 1 : cur.c > 10 ? 2 : 3;
  const chg = (cur.c - all[Math.max(0, idx - 24)].c) / all[Math.max(0, idx - 24)].c * 100;

  return (
    <div className="trainer">
      <div className="term-top">
        <div className="sym-block">
          <b>{a.name}</b>
          <span className="muted sm">исторический рынок · 1h · сессия #{sim.seed}</span>
        </div>
        <div className="tk"><span>Цена</span><b className={cur.c >= cur.o ? 'up' : 'dn'}>{fmtP(cur.c)}</b></div>
        <div className="tk"><span>24 свечи</span><b className={chg >= 0 ? 'up' : 'dn'}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}%</b></div>
        <div className="tk"><span>Дата</span><b>{fmtDateTime(cur.t)}</b></div>
        <div className="tk"><span>Прогресс</span><b>{idx - START} / {N - 1 - START}</b></div>
        <div className="player">
          <button className="btn" onClick={() => step(1)} disabled={idx >= N - 1}>Следующая свеча ›</button>
          <div className="speed">
            <button className={speed === 0 ? 'on' : ''} onClick={() => setSpeed(0)} aria-label="Пауза">❚❚</button>
            {[1, 5, 20].map(s => <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>▶ {s}x</button>)}
          </div>
          <button className="btn ghost" onClick={() => step(24)} disabled={idx >= N - 1}>+24 свечи</button>
          <button className="btn ghost" onClick={newSession}>Новая сессия</button>
        </div>
      </div>
      <AccountBar acc={acc} prices={prices} label="Счёт тренажёра" onReset={() => setSim(s => ({ ...s, account: newAccount() }))} />
      <div className="trainer-grid">
        <div className="card chart-card">
          <div className="chart-tools">
            <span className="muted sm">1x = 1 свеча в секунду · → следующая свеча · пробел — пуск/пауза · колесо — масштаб · перетаскивание — история</span>
            <span className="grow" />
            <button className={'mini' + (ind.ma ? ' on' : '')} onClick={() => setInd(i => ({ ...i, ma: !i.ma }))}>MA 20/50</button>
            <button className={'mini' + (ind.rsi ? ' on' : '')} onClick={() => setInd(i => ({ ...i, rsi: !i.rsi }))}>RSI</button>
          </div>
          <Chart candles={visible} height={440} initialCount={100} lines={lines} markers={markers}
            mas={ind.ma ? [{ values: ma20, color: 'var(--accent)', label: 'MA20' }, { values: ma50, color: 'var(--accent-2)', label: 'MA50' }] : []}
            rsiValues={ind.rsi ? rs : null} onPick={p => { const v = p.toFixed(dec); pick === 'sl' ? setSl(v) : setTp(v); }} />
          {idx >= N - 1 && <div className="q-why ok">Сессия завершена. Посмотрите статистику и начните новую.</div>}
        </div>
        <div className="card">
          <div className="card-h"><b>Новая сделка</b><span className="muted sm">комиссия 0,05%</span></div>
          <OrderForm idp="tr" base="шт." price={cur.c} equity={eq} available={acc.balance} onSubmit={submit} sl={sl} setSl={setSl} tp={tp} setTp={setTp} pick={pick} setPick={setPick} />
        </div>
      </div>
      <div className="card">
        <div className="tabs-mini big">
          <button className={tab === 'pos' ? 'on' : ''} onClick={() => setTab('pos')}>Позиции ({acc.positions.length + acc.orders.length})</button>
          <button className={tab === 'hist' ? 'on' : ''} onClick={() => setTab('hist')}>История и разбор ({acc.history.length})</button>
          <button className={tab === 'stats' ? 'on' : ''} onClick={() => setTab('stats')}>Статистика</button>
        </div>
        {tab === 'pos' && <PositionsTable acc={acc} prices={prices} onClose={id => setAcc(ac => closePosition(ac, id, cur.c, 'manual', cur.t))} onEdit={(id, v) => setAcc(ac => editStops(ac, id, v))} onCancel={id => setAcc(ac => cancelOrder(ac, id))} />}
        {tab === 'hist' && <HistoryTable history={acc.history} />}
        {tab === 'stats' && <StatsPanel acc={acc} prices={prices} />}
      </div>
    </div>
  );
}
