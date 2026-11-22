import { previewOrder, upnl, stats, FLAG_NAMES, equityOf, usedMargin } from './engine.js';
import { fmtP, fmtUsd, fmtPct, fmtDateTime, decimalsFor } from './lib.js';
const { useState, useMemo, useEffect } = React;

const num = s => { const x = parseFloat(String(s).replace(',', '.').replace(/\s/g, '')); return isFinite(x) ? x : NaN; };
const roundP = (p, ref) => +p.toFixed(decimalsFor(ref));

export function OrderForm({ base, price, equity, available, onSubmit, sl, setSl, tp, setTp, pick, setPick, allowLimit = true, idp = 'of' }) {
  const [side, setSide] = useState('long');
  const [type, setType] = useState('market');
  const [lp, setLp] = useState('');
  const [lev, setLev] = useState(3);
  const [usd, setUsd] = useState('1000');
  const [msg, setMsg] = useState(null);
  const entry = type === 'limit' && num(lp) > 0 ? num(lp) : price;
  const notional = num(usd) || 0;
  const qty = entry > 0 ? notional / entry : 0;
  const pv = previewOrder({ side, entry, qty, lev, sl: num(sl), tp: num(tp), equity, available });
  const c = pv.calc;

  useEffect(() => { setMsg(null); }, [side, type, sl, tp, usd, lev]);

  const quickSl = pct => setSl(String(roundP(side === 'long' ? entry * (1 - pct / 100) : entry * (1 + pct / 100), entry)));
  const quickTp = r => {
    const s = num(sl);
    if (!(s > 0)) { setMsg({ bad: true, t: 'Сначала поставьте стоп — тейк считается от его расстояния.' }); return; }
    const d = Math.abs(entry - s);
    setTp(String(roundP(side === 'long' ? entry + d * r : entry - d * r, entry)));
  };
  const byRisk = () => {
    const s = num(sl);
    if (!(s > 0)) { setMsg({ bad: true, t: 'Чтобы посчитать размер по риску 1%, сначала поставьте стоп.' }); return; }
    const risk = equity * 0.01;
    const dist = Math.abs(entry - s);
    let q = (risk - entry * 0.0005 * 2 * (risk / dist)) / dist; // с учётом комиссий
    q = Math.max(0, risk / (dist + entry * 0.001));
    let n = q * entry;
    if (n / lev > available * 0.98) n = available * 0.98 * lev;
    setUsd(String(Math.floor(n)));
  };
  const pctOf = p => setUsd(String(Math.floor(available * lev * p / 100 * 0.995)));

  const submit = () => {
    if (!pv.ok) return;
    if (type === 'limit' && !(num(lp) > 0)) { setMsg({ bad: true, t: 'Укажите цену лимитного ордера.' }); return; }
    if (type === 'limit' && (side === 'long' ? num(lp) >= price : num(lp) <= price)) { setMsg({ bad: true, t: side === 'long' ? 'Buy Limit ставится ниже текущей цены. Для покупки выше — используйте рыночный ордер.' : 'Sell Limit ставится выше текущей цены.' }); return; }
    onSubmit({ side, type, price: entry, qty, lev, sl: num(sl), tp: num(tp) });
    setMsg({ bad: false, t: type === 'market' ? `Позиция ${side === 'long' ? 'Long' : 'Short'} открыта.` : 'Лимитный ордер выставлен.' });
    setSl(''); setTp('');
  };

  return (
    <div className="oform">
      <div className="seg2">
        <button className={'seg-b long' + (side === 'long' ? ' on' : '')} onClick={() => { setSide('long'); setSl(''); setTp(''); }}>Купить / Long</button>
        <button className={'seg-b short' + (side === 'short' ? ' on' : '')} onClick={() => { setSide('short'); setSl(''); setTp(''); }}>Продать / Short</button>
      </div>
      {allowLimit && (
        <div className="tabs-mini">
          <button className={type === 'market' ? 'on' : ''} onClick={() => setType('market')}>Рыночный</button>
          <button className={type === 'limit' ? 'on' : ''} onClick={() => setType('limit')}>Лимитный</button>
        </div>
      )}
      {type === 'limit' && <label>Цена ордера<input id={idp + '-lp'} className="inp" inputMode="decimal" value={lp} onChange={e => setLp(e.target.value)} placeholder={fmtP(price)} /></label>}
      <label>Плечо <b className={lev >= 8 ? 'dn' : lev >= 5 ? 'warn' : ''}>{lev}x</b>
        <input id={idp + '-lev'} type="range" min="1" max="10" value={lev} onChange={e => setLev(+e.target.value)} />
      </label>
      <label>Размер позиции, USDT <span className="muted sm">≈ {qty ? qty.toPrecision(4) : 0} {base}</span>
        <input id={idp + '-usd'} className="inp" inputMode="decimal" value={usd} onChange={e => setUsd(e.target.value)} />
      </label>
      <div className="quick">
        {[10, 25, 50, 100].map(p => <button key={p} onClick={() => pctOf(p)}>{p}%</button>)}
        <button className="acc" onClick={byRisk} title="Размер так, чтобы стоп стоил 1% капитала">Риск 1%</button>
      </div>
      <div className="sltp">
        <label className={pick === 'sl' ? 'picking' : ''}>Stop-Loss <span className="req">обязательно</span>
          <input id={idp + '-sl'} className="inp sl" inputMode="decimal" value={sl} onChange={e => setSl(e.target.value)} onFocus={() => setPick('sl')} placeholder="цена стопа" />
        </label>
        <div className="quick">{[0.5, 1, 2, 3].map(p => <button key={p} onClick={() => quickSl(p)}>−{p}%</button>)}</div>
        <label className={pick === 'tp' ? 'picking' : ''}>Take-Profit <span className="req">обязательно</span>
          <input id={idp + '-tp'} className="inp tp" inputMode="decimal" value={tp} onChange={e => setTp(e.target.value)} onFocus={() => setPick('tp')} placeholder="цена тейка" />
        </label>
        <div className="quick">{[1.5, 2, 3].map(r => <button key={r} onClick={() => quickTp(r)}>RR 1:{r}</button>)}</div>
        <div className="muted sm">Совет: кликните поле, затем по графику — цена подставится.</div>
      </div>
      <div className="summary">
        <div><span>Маржа</span><b>{fmtUsd(c.margin)}</b></div>
        <div><span>Комиссия</span><b>{fmtUsd(c.fee)}</b></div>
        <div><span>Риск</span><b className={c.riskPct > 2 ? 'dn' : c.riskPct > 1.05 ? 'warn' : 'up'}>{c.riskUsd != null ? `${fmtUsd(c.riskUsd)} · ${c.riskPct.toFixed(2)}%` : '—'}</b></div>
        <div><span>Цель</span><b>{c.rewardUsd != null ? fmtUsd(c.rewardUsd) : '—'}</b></div>
        <div><span>RR</span><b className={c.rr != null && c.rr < 1.5 ? 'warn' : ''}>{c.rr != null ? '1:' + c.rr.toFixed(2) : '—'}</b></div>
        <div><span>Ликвидация</span><b>{lev > 1 ? fmtP(c.liq) : 'нет'}</b></div>
      </div>
      {pv.errors.length > 0 && (num(sl) > 0 || num(tp) > 0) && <ul className="warns">{pv.errors.map(e => <li key={e} className="high">{e}</li>)}</ul>}
      {pv.warnings.length > 0 && <ul className="warns">{pv.warnings.map(w => <li key={w.t} className={w.sev}>{w.t}</li>)}</ul>}
      <button className={'btn wide ' + (side === 'long' ? 'buy' : 'sell')} disabled={!pv.ok} onClick={submit}>
        {pv.ok ? `${type === 'market' ? 'Открыть' : 'Выставить'} ${side === 'long' ? 'Long' : 'Short'} ${lev}x` : !(num(sl) > 0) || !(num(tp) > 0) ? 'Укажите SL и TP' : 'Проверьте параметры'}
      </button>
      {msg && <div className={'q-why ' + (msg.bad ? 'bad' : 'ok')}>{msg.t}</div>}
    </div>
  );
}

function EditStops({ p, onEdit }) {
  const [sl, setSl] = useState(String(p.sl)), [tp, setTp] = useState(String(p.tp));
  const [open, setOpen] = useState(false);
  if (!open) return <button className="mini" onClick={() => setOpen(true)}>Изменить</button>;
  return (
    <span className="edit-st">
      <input className="inp xs" value={sl} onChange={e => setSl(e.target.value)} aria-label="Новый стоп" />
      <input className="inp xs" value={tp} onChange={e => setTp(e.target.value)} aria-label="Новый тейк" />
      <button className="mini on" onClick={() => { onEdit(p.id, { sl: num(sl), tp: num(tp) }); setOpen(false); }}>OK</button>
    </span>
  );
}

export function PositionsTable({ acc, prices, onClose, onEdit, onCancel }) {
  if (!acc.positions.length && !acc.orders.length) return <div className="empty">Открытых позиций нет. Выберите направление, поставьте SL и TP и откройте сделку.</div>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>Пара</th><th>Сторона</th><th>Размер</th><th>Вход</th><th>Цена</th><th>SL / TP</th><th>Ликв.</th><th>P&amp;L</th><th>R</th><th></th></tr></thead>
        <tbody>
          {acc.positions.map(p => {
            const px = prices[p.sym];
            const pl = px ? upnl(p, px) - p.feeOpen : 0;
            const R = pl / p.riskUsd;
            return (
              <tr key={p.id}>
                <td><b>{p.sym.replace('USDT', '')}</b><span className="muted">/USDT</span></td>
                <td><span className={'pill ' + (p.side === 'long' ? 'up' : 'dn')}>{p.side === 'long' ? 'Long' : 'Short'} {p.lev}x</span></td>
                <td>{fmtUsd(p.entry * p.qty)}</td>
                <td>{fmtP(p.entry)}</td>
                <td>{fmtP(px)}</td>
                <td><span className="dn">{fmtP(p.sl)}</span> / <span className="up">{fmtP(p.tp)}</span> {onEdit && <EditStops p={p} onEdit={onEdit} />}</td>
                <td className="muted">{p.lev > 1 ? fmtP(p.liq) : '—'}</td>
                <td className={pl >= 0 ? 'up' : 'dn'}><b>{fmtUsd(pl, true)}</b><br /><small>{fmtPct(pl / p.margin * 100)} ROE</small></td>
                <td className={R >= 0 ? 'up' : 'dn'}>{R.toFixed(2)}R</td>
                <td><button className="mini danger" onClick={() => onClose(p.id)}>Закрыть</button></td>
              </tr>
            );
          })}
          {acc.orders.map(o => (
            <tr key={o.id} className="order-row">
              <td><b>{o.sym.replace('USDT', '')}</b><span className="muted">/USDT</span></td>
              <td><span className="pill">{o.side === 'long' ? 'Buy' : 'Sell'} Limit {o.lev}x</span></td>
              <td>{fmtUsd(o.price * o.qty)}</td>
              <td>{fmtP(o.price)}</td>
              <td>{fmtP(prices[o.sym])}</td>
              <td><span className="dn">{fmtP(o.sl)}</span> / <span className="up">{fmtP(o.tp)}</span></td>
              <td className="muted">ожидает</td><td></td><td></td>
              <td><button className="mini" onClick={() => onCancel(o.id)}>Отменить</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const REASON = { sl: 'Стоп', tp: 'Тейк', manual: 'Вручную', liq: 'Ликвидация' };

export function HistoryTable({ history, timeFmt = fmtDateTime }) {
  if (!history.length) return <div className="empty">История пуста. Закрытые сделки появятся здесь с оценкой A–F.</div>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>Время</th><th>Пара</th><th>Сторона</th><th>Вход → выход</th><th>Причина</th><th>Итог</th><th>R</th><th>Оценка</th><th>Ошибки риск-менеджмента</th></tr></thead>
        <tbody>
          {history.map(h => (
            <tr key={h.id}>
              <td className="muted">{timeFmt(h.closeT)}</td>
              <td><b>{h.sym.replace('USDT', '')}</b></td>
              <td><span className={'pill ' + (h.side === 'long' ? 'up' : 'dn')}>{h.side === 'long' ? 'Long' : 'Short'} {h.lev}x</span></td>
              <td>{fmtP(h.entry)} → {fmtP(h.exit)}</td>
              <td>{REASON[h.reason]}</td>
              <td className={h.net >= 0 ? 'up' : 'dn'}><b>{fmtUsd(h.net, true)}</b></td>
              <td className={h.R >= 0 ? 'up' : 'dn'}>{h.R.toFixed(2)}R</td>
              <td><span className={'grade g' + h.grade}>{h.grade}</span></td>
              <td className="flags">{h.flags.length ? h.flags.map((f, i) => <span key={i} className={'flag ' + f.sev}>{f.t}</span>) : <span className="muted">Нарушений нет</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EquityCurve({ points, start }) {
  if (points.length < 2) return <div className="empty sm">Кривая капитала появится после первых закрытых сделок.</div>;
  const W = 560, H = 140;
  const vs = points.map(p => p.v);
  const lo = Math.min(start, ...vs), hi = Math.max(start, ...vs);
  const r = hi - lo || 1;
  const x = i => 30 + i / (points.length - 1) * (W - 40);
  const y = v => 10 + (H - 24) * (1 - (v - lo) / r);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const lastV = vs[vs.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="diagram eq">
      <line x1="30" x2={W - 10} y1={y(start)} y2={y(start)} stroke="var(--line-2)" strokeDasharray="4 4" />
      <text x="2" y={y(start) + 4} fontSize="9" fill="var(--fg-3)">старт</text>
      <path d={d + `L${x(points.length - 1)},${H - 14}L30,${H - 14}Z`} fill={lastV >= start ? 'var(--up)' : 'var(--dn)'} opacity="0.1" />
      <path d={d} fill="none" stroke={lastV >= start ? 'var(--up)' : 'var(--dn)'} strokeWidth="2" />
      <circle cx={x(points.length - 1)} cy={y(lastV)} r="3.5" fill={lastV >= start ? 'var(--up)' : 'var(--dn)'} />
    </svg>
  );
}

export function StatsPanel({ acc, prices }) {
  const s = useMemo(() => stats(acc), [acc]);
  const eq = equityOf(acc, prices);
  const flags = Object.entries(s.flagCount).sort((a, b) => b[1] - a[1]);
  return (
    <div className="stats">
      <div className="stat-grid">
        <div><span>Сделок</span><b>{s.n}</b></div>
        <div><span>Винрейт</span><b>{s.winrate.toFixed(1)}%</b></div>
        <div><span>Средний R</span><b className={s.avgR >= 0 ? 'up' : 'dn'}>{s.avgR >= 0 ? '+' : ''}{s.avgR.toFixed(2)}R</b></div>
        <div><span>Profit factor</span><b>{isFinite(s.pf) ? s.pf.toFixed(2) : '∞'}</b></div>
        <div><span>Итог по сделкам</span><b className={s.net >= 0 ? 'up' : 'dn'}>{fmtUsd(s.net, true)}</b></div>
        <div><span>Макс. просадка</span><b className={s.mdd > 10 ? 'dn' : ''}>{s.mdd.toFixed(2)}%</b></div>
        <div><span>Комиссии</span><b>{fmtUsd(s.fees)}</b></div>
        <div><span>Дисциплина</span><b className={s.discipline >= 80 ? 'up' : s.discipline >= 50 ? 'warn' : 'dn'}>{s.discipline.toFixed(0)}%</b></div>
      </div>
      <div className="stats-cols">
        <div>
          <div className="eyebrow">Кривая капитала · сейчас {fmtUsd(eq)}</div>
          <EquityCurve points={acc.equity} start={acc.start} />
        </div>
        <div>
          <div className="eyebrow">Частые ошибки</div>
          {flags.length ? flags.map(([k, n]) => (
            <div key={k} className="flag-row"><span>{FLAG_NAMES[k] || k}</span><b>{n}</b></div>
          )) : <div className="empty sm">Ошибок пока нет. Держите риск ≤ 1% и RR ≥ 1:1,5.</div>}
          <div className="muted sm mt">Дисциплина — доля сделок с оценкой A или B. Цель перед реальными деньгами: 50+ сделок, дисциплина ≥ 80%, средний R &gt; 0.</div>
        </div>
      </div>
    </div>
  );
}

export function AccountBar({ acc, prices, onReset, label }) {
  const [confirm, setConfirm] = useState(false);
  const eq = equityOf(acc, prices);
  const used = usedMargin(acc);
  const unreal = acc.positions.reduce((s, p) => s + (prices[p.sym] ? upnl(p, prices[p.sym]) : 0), 0);
  const total = eq - acc.start;
  return (
    <div className="accbar">
      <div className="acc-k"><span>{label}</span><b>{fmtUsd(eq)}</b></div>
      <div className="acc-k"><span>Свободно</span><b>{fmtUsd(acc.balance)}</b></div>
      <div className="acc-k"><span>В марже</span><b>{fmtUsd(used)}</b></div>
      <div className="acc-k"><span>Нереализ. P&amp;L</span><b className={unreal >= 0 ? 'up' : 'dn'}>{fmtUsd(unreal, true)}</b></div>
      <div className="acc-k"><span>С начала</span><b className={total >= 0 ? 'up' : 'dn'}>{fmtUsd(total, true)} · {fmtPct(total / acc.start * 100)}</b></div>
      <div className="acc-reset">
        {confirm ? (
          <span className="row gap"><span className="muted sm">Сбросить счёт до $10 000 и удалить историю?</span><button className="mini danger" onClick={() => { onReset(); setConfirm(false); }}>Да, сбросить</button><button className="mini" onClick={() => setConfirm(false)}>Нет</button></span>
        ) : <button className="mini" onClick={() => setConfirm(true)}>Сбросить счёт</button>}
      </div>
    </div>
  );
}
