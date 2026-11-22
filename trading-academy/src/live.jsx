import Chart from './chart.jsx';
import { market, SYMBOLS, TFS } from './market.js';
import { sma, ema, rsi, fmtP, fmtUsd, fmtPct, fmtVol, fmtK, decimalsFor } from './lib.js';
import { newAccount, openPosition, placeOrder, cancelOrder, closePosition, editStops, tick, equityOf } from './engine.js';
import { OrderForm, PositionsTable, HistoryTable, StatsPanel, AccountBar } from './tradeui.jsx';
const { useState, useMemo, useEffect, useReducer } = React;

export function useMarket() {
  const [, force] = useReducer(x => x + 1, 0);
  useEffect(() => market.on(force), []);
  return market;
}

function OrderBook({ book, last, dec }) {
  const asks = book.asks.slice(0, 11).reverse();
  const bids = book.bids.slice(0, 11);
  const mx = Math.max(1e-9, ...asks.map(x => x[1]), ...bids.map(x => x[1]));
  const spread = book.asks[0] && book.bids[0] ? book.asks[0][0] - book.bids[0][0] : null;
  const bidSum = bids.reduce((s, x) => s + x[1], 0), askSum = asks.reduce((s, x) => s + x[1], 0);
  const bp = bidSum + askSum ? bidSum / (bidSum + askSum) * 100 : 50;
  return (
    <div className="book">
      <div className="book-h"><span>Цена</span><span>Кол-во</span><span>Сумма</span></div>
      {asks.map((r, i) => (
        <div key={'a' + i} className="book-r ask"><i style={{ width: (r[1] / mx * 100) + '%' }} /><span>{fmtP(r[0], dec)}</span><span>{r[1].toPrecision(4)}</span><span>{fmtK(r[0] * r[1])}</span></div>
      ))}
      <div className="book-mid">
        <b>{fmtP(last, dec)}</b>
        <span className="muted sm">спред {spread != null ? fmtP(spread, dec) + ' · ' + (spread / last * 100).toFixed(4) + '%' : '—'}</span>
      </div>
      {bids.map((r, i) => (
        <div key={'b' + i} className="book-r bid"><i style={{ width: (r[1] / mx * 100) + '%' }} /><span>{fmtP(r[0], dec)}</span><span>{r[1].toPrecision(4)}</span><span>{fmtK(r[0] * r[1])}</span></div>
      ))}
      <div className="book-ratio"><i style={{ width: bp + '%' }} /><span className="up">B {bp.toFixed(0)}%</span><span className="dn">{(100 - bp).toFixed(0)}% S</span></div>
    </div>
  );
}

function Trades({ trades, dec }) {
  const p2 = x => String(x).padStart(2, '0');
  return (
    <div className="trades">
      <div className="book-h"><span>Цена</span><span>Кол-во</span><span>Время</span></div>
      {trades.slice(0, 22).map((t, i) => {
        const d = new Date(t.t);
        return <div key={i} className="book-r"><span className={t.sell ? 'dn' : 'up'}>{fmtP(t.p, dec)}</span><span>{t.q.toPrecision(4)}</span><span className="muted">{p2(d.getHours())}:{p2(d.getMinutes())}:{p2(d.getSeconds())}</span></div>;
      })}
      {!trades.length && <div className="empty sm">Ожидание сделок…</div>}
    </div>
  );
}

export default function Live({ live, setLive }) {
  const m = useMarket();
  const [sym, setSym] = useState(() => (live.ui && live.ui.sym) || 'BTCUSDT');
  const [tf, setTf] = useState(() => (live.ui && live.ui.tf) || '1m');
  const [sl, setSl] = useState(''), [tp, setTp] = useState('');
  const [pick, setPick] = useState('sl');
  const [tool, setTool] = useState('none');
  const [tab, setTab] = useState('pos');
  const [side, setSide] = useState('book');
  const [ind, setInd] = useState({ ma20: true, ma50: false, ema200: false, rsi: false, vol: true });
  const acc = live.account;

  useEffect(() => { m.start(); }, []);
  useEffect(() => { m.select(sym, tf); setSl(''); setTp(''); }, [sym, tf]);

  const meta = SYMBOLS.find(x => x.s === sym);
  const tk = m.tickers[sym];
  const prices = {};
  for (const k in m.tickers) prices[k] = m.tickers[k].last;
  const last = (m.candles.length ? m.candles[m.candles.length - 1].c : tk && tk.last) || 0;
  if (last) prices[sym] = last;
  const dec = decimalsFor(last || 1);
  const eq = equityOf(acc, prices);

  const ma20 = useMemo(() => sma(m.candles, 20), [m.candles]);
  const ma50 = useMemo(() => sma(m.candles, 50), [m.candles]);
  const e200 = useMemo(() => ema(m.candles, 200), [m.candles]);
  const rs = useMemo(() => rsi(m.candles), [m.candles]);

  const setAcc = fn => setLive(l => ({ ...l, account: fn(l.account) }));
  const submit = o => setAcc(ac => o.type === 'limit'
    ? placeOrder(ac, { sym, side: o.side, price: o.price, qty: o.qty, lev: o.lev, sl: o.sl, tp: o.tp, now: Date.now() })
    : openPosition(ac, { sym, side: o.side, entry: last, qty: o.qty, lev: o.lev, sl: o.sl, tp: o.tp, now: Date.now(), prices }));
  const chooseSym = s => { setSym(s); setLive(l => ({ ...l, ui: { ...(l.ui || {}), sym: s, tf } })); };
  const chooseTf = t => { setTf(t); setLive(l => ({ ...l, ui: { ...(l.ui || {}), sym, tf: t } })); };

  const drawings = (acc.drawings && acc.drawings[sym]) || [];
  const addDrawing = d => { setAcc(ac => ({ ...ac, drawings: { ...(ac.drawings || {}), [sym]: [...((ac.drawings || {})[sym] || []), d] } })); if (d.type === 'hline') setTool('none'); if (d.type === 'trend') setTool('none'); };
  const clearDrawings = () => setAcc(ac => ({ ...ac, drawings: { ...(ac.drawings || {}), [sym]: [] } }));

  const lines = [];
  for (const d of drawings) if (d.type === 'hline') lines.push({ price: d.price, color: 'var(--draw)', dash: '1 0', short: '—' });
  for (const p of acc.positions.filter(p => p.sym === sym)) {
    lines.push({ price: p.entry, color: 'var(--accent)', label: `${p.side === 'long' ? 'Long' : 'Short'} ${p.lev}x · ${fmtUsd(p.entry * p.qty)}`, dash: '2 2', short: 'Вход' });
    lines.push({ price: p.sl, color: 'var(--dn)', label: 'SL', short: 'SL' });
    lines.push({ price: p.tp, color: 'var(--up)', label: 'TP', short: 'TP' });
    if (p.lev > 1) lines.push({ price: p.liq, color: 'var(--warn)', label: 'Ликвидация', dash: '1 3', short: 'Ликв' });
  }
  for (const o of acc.orders.filter(o => o.sym === sym)) lines.push({ price: o.price, color: 'var(--accent-2)', label: `${o.side === 'long' ? 'Buy' : 'Sell'} Limit`, dash: '6 3' });
  const slN = parseFloat(sl), tpN = parseFloat(tp);
  if (slN > 0) lines.push({ price: slN, color: 'var(--dn)', label: 'новый SL', dash: '3 3' });
  if (tpN > 0) lines.push({ price: tpN, color: 'var(--up)', label: 'новый TP', dash: '3 3' });
  const t0 = m.candles.length ? m.candles[0].t : 0;
  const markers = [];
  for (const h of acc.history.slice(0, 60)) {
    if (h.sym !== sym || h.openT < t0) continue;
    markers.push({ t: h.openT, price: h.entry, type: h.side === 'long' ? 'buy' : 'sell' });
    markers.push({ t: h.closeT, price: h.exit, type: 'exit', label: (h.R >= 0 ? '+' : '') + h.R.toFixed(1) + 'R' });
  }
  for (const p of acc.positions) if (p.sym === sym && p.openT >= t0) markers.push({ t: p.openT, price: p.entry, type: p.side === 'long' ? 'buy' : 'sell' });

  const mas = [];
  if (ind.ma20) mas.push({ values: ma20, color: 'var(--accent)', label: 'MA20 ' + (ma20[ma20.length - 1] ? fmtP(ma20[ma20.length - 1], dec) : '') });
  if (ind.ma50) mas.push({ values: ma50, color: 'var(--accent-2)', label: 'MA50 ' + (ma50[ma50.length - 1] ? fmtP(ma50[ma50.length - 1], dec) : '') });
  if (ind.ema200) mas.push({ values: e200, color: 'var(--warn)', label: 'EMA200' });

  const status = m.mode === 'live' ? { c: 'up', t: 'LIVE · Binance' } : m.mode === 'sim' ? { c: 'warn', t: 'Симуляция' } : { c: '', t: 'Подключение…' };

  return (
    <div className="live">
      <div className="pairs">
        {SYMBOLS.map(x => {
          const t = m.tickers[x.s];
          return (
            <button key={x.s} className={'pair' + (x.s === sym ? ' act' : '')} onClick={() => chooseSym(x.s)}>
              <b>{x.base}<span className="muted">/USDT</span></b>
              <span>{t ? fmtP(t.last) : '—'}</span>
              <span className={t && t.chg >= 0 ? 'up' : 'dn'}>{t ? fmtPct(t.chg) : ''}</span>
            </button>
          );
        })}
      </div>
      <div className="term-top">
        <div className="sym-block"><b>{meta.base}/USDT</b><span className="muted sm">{meta.name} · бессрочный, изолированная маржа</span></div>
        <div className="tk"><span>Цена</span><b className={tk && tk.chg >= 0 ? 'up' : 'dn'}>{fmtP(last, dec)}</b></div>
        <div className="tk"><span>Изм. 24ч</span><b className={tk && tk.chg >= 0 ? 'up' : 'dn'}>{tk ? fmtPct(tk.chg) : '—'}</b></div>
        <div className="tk hide-sm"><span>Макс. 24ч</span><b>{tk ? fmtP(tk.high, dec) : '—'}</b></div>
        <div className="tk hide-sm"><span>Мин. 24ч</span><b>{tk ? fmtP(tk.low, dec) : '—'}</b></div>
        <div className="tk hide-sm"><span>Объём 24ч (USDT)</span><b>{tk ? fmtVol(tk.qvol) : '—'}</b></div>
        <div className="conn">
          <span className={'dot ' + status.c} /> <b>{status.t}</b>
          {m.mode === 'sim' && <button className="mini" onClick={() => m.reconnect()}>Подключить Binance</button>}
        </div>
      </div>
      {m.mode === 'sim' && m.reason && <div className="notice">{m.reason} Котировки двигаются реалистично, но это не реальный рынок. Откройте файл приложения в обычном браузере — тогда подключатся настоящие котировки Binance.</div>}
      <AccountBar acc={acc} prices={prices} label="Мой капитал" onReset={() => setLive(l => ({ ...l, account: newAccount() }))} />

      <div className="live-grid">
        <div className="card chart-card">
          <div className="chart-tools">
            <div className="tabs-mini">{Object.keys(TFS).map(t => <button key={t} className={t === tf ? 'on' : ''} onClick={() => chooseTf(t)}>{t}</button>)}</div>
            <span className="sep-v" />
            {[['ma20', 'MA20'], ['ma50', 'MA50'], ['ema200', 'EMA200'], ['rsi', 'RSI'], ['vol', 'Объём']].map(([k, l]) => (
              <button key={k} className={'mini' + (ind[k] ? ' on' : '')} onClick={() => setInd(i => ({ ...i, [k]: !i[k] }))}>{l}</button>
            ))}
            <span className="sep-v" />
            <button className={'mini' + (tool === 'hline' ? ' on' : '')} onClick={() => setTool(t => t === 'hline' ? 'none' : 'hline')} title="Горизонтальный уровень">— Уровень</button>
            <button className={'mini' + (tool === 'trend' ? ' on' : '')} onClick={() => setTool(t => t === 'trend' ? 'none' : 'trend')} title="Трендовая линия">╱ Тренд</button>
            {drawings.length > 0 && <button className="mini" onClick={clearDrawings}>Стереть линии ({drawings.length})</button>}
          </div>
          {m.candles.length ? (
            <Chart key={sym + tf} candles={m.candles} height={460} initialCount={110} lines={lines} markers={markers} mas={mas}
              showVolume={ind.vol} rsiValues={ind.rsi ? rs : null} tool={tool} onAddDrawing={addDrawing}
              trendLines={drawings.filter(d => d.type === 'trend')}
              watermark={meta.base + '/USDT · ' + tf}
              onPick={p => { const v = p.toFixed(dec); pick === 'sl' ? setSl(v) : setTp(v); }} />
          ) : <div className="chart-loading">Загрузка свечей…</div>}
        </div>
        <div className="card side-card">
          <div className="tabs-mini">
            <button className={side === 'book' ? 'on' : ''} onClick={() => setSide('book')}>Стакан</button>
            <button className={side === 'trades' ? 'on' : ''} onClick={() => setSide('trades')}>Сделки</button>
          </div>
          {side === 'book' ? <OrderBook book={m.book} last={last} dec={dec} /> : <Trades trades={m.trades} dec={dec} />}
        </div>
        <div className="card form-card">
          <div className="card-h"><b>Ордер · {meta.base}/USDT</b><span className="muted sm">комиссия 0,05%</span></div>
          {last ? <OrderForm idp="lv" base={meta.base} price={last} equity={eq} available={acc.balance} onSubmit={submit} sl={sl} setSl={setSl} tp={tp} setTp={setTp} pick={pick} setPick={setPick} /> : <div className="empty">Ожидание цены…</div>}
        </div>
      </div>

      <div className="card">
        <div className="tabs-mini big">
          <button className={tab === 'pos' ? 'on' : ''} onClick={() => setTab('pos')}>Позиции и ордера ({acc.positions.length + acc.orders.length})</button>
          <button className={tab === 'hist' ? 'on' : ''} onClick={() => setTab('hist')}>История сделок и разбор ({acc.history.length})</button>
          <button className={tab === 'stats' ? 'on' : ''} onClick={() => setTab('stats')}>Статистика счёта</button>
        </div>
        {tab === 'pos' && <PositionsTable acc={acc} prices={prices} onClose={id => setAcc(ac => { const p = ac.positions.find(x => x.id === id); return p && prices[p.sym] ? closePosition(ac, id, prices[p.sym], 'manual', Date.now()) : ac; })} onEdit={(id, v) => setAcc(ac => editStops(ac, id, v))} onCancel={id => setAcc(ac => cancelOrder(ac, id))} />}
        {tab === 'hist' && <HistoryTable history={acc.history} />}
        {tab === 'stats' && <StatsPanel acc={acc} prices={prices} />}
      </div>
    </div>
  );
}
