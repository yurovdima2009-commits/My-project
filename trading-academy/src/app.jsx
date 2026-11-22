import Academy, { rankOf } from './academy.jsx';
import Cases, { CASES } from './cases.jsx';
import Trainer, { newSim } from './trainer.jsx';
import Live from './live.jsx';
import { usePersistent, storageStatus } from './store.js';
import { newAccount, equityOf, tick } from './engine.js';
import { market } from './market.js';
import { fmtUsd } from './lib.js';
const { useState, useEffect } = React;

const TABS = [
  { id: 'academy', n: 1, t: 'Учебник', s: '18 уроков' },
  { id: 'cases', n: 2, t: 'Кейсы', s: '8 сценариев' },
  { id: 'trainer', n: 3, t: 'Тренажёр', s: 'ускоренная история' },
  { id: 'live', n: 4, t: 'Live-терминал', s: 'реальные котировки' },
];

function getHash() { const h = (location.hash || '').replace('#', ''); return TABS.some(t => t.id === h) ? h : 'academy'; }

function App() {
  const [tab, setTab] = useState(getHash);
  const [progress, setProgress] = usePersistent('progress', () => ({ lessons: {}, cur: 'l1' }));
  const [cases, setCases] = usePersistent('cases', () => ({ results: {} }));
  const [sim, setSim] = usePersistent('sim', newSim);
  const [live, setLive] = usePersistent('live', () => ({ account: newAccount(), ui: { sym: 'BTCUSDT', tf: '1m' } }));
  const [, setTick] = useState(0);

  useEffect(() => {
    const on = () => setTab(getHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  // котировки нужны и для открытых позиций, даже если вкладка терминала закрыта
  useEffect(() => { market.start(); const off = market.on(() => setTick(x => x + 1)); return off; }, []);
  // SL / TP / ликвидация / лимитные ордера проверяются на каждом изменении цены
  useEffect(() => market.onPrice((s, px) => setLive(l => { const a = tick(l.account, s, px, Date.now()); return a === l.account ? l : { ...l, account: a }; })), []);

  const go = id => { setTab(id); try { history.replaceState(null, '', '#' + id); } catch (_) { location.hash = id; } window.scrollTo(0, 0); };
  const r = rankOf(progress);
  const prices = {}; for (const k in market.tickers) prices[k] = market.tickers[k].last;
  const eq = equityOf(live.account, prices);
  const casesDone = Object.keys(cases.results || {}).length;
  const sub = {
    academy: `${r.done}/${r.total}`,
    cases: `${casesDone}/${CASES.length}`,
    trainer: `${sim.account.history.length} сделок`,
    live: fmtUsd(eq),
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
            <rect x="1" y="1" width="30" height="30" rx="7" fill="var(--bg-2)" stroke="var(--line-2)" />
            <line x1="9" x2="9" y1="8" y2="22" stroke="var(--dn)" strokeWidth="1.6" /><rect x="6.5" y="11" width="5" height="7" fill="var(--dn)" rx="1" />
            <line x1="16" x2="16" y1="6" y2="20" stroke="var(--up)" strokeWidth="1.6" /><rect x="13.5" y="9" width="5" height="8" fill="var(--up)" rx="1" />
            <line x1="23" x2="23" y1="4" y2="16" stroke="var(--up)" strokeWidth="1.6" /><rect x="20.5" y="6" width="5" height="7" fill="var(--up)" rx="1" />
            <path d="M5 26 L27 26" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <div>
            <b>Академия реального трейдинга</b>
            <span>от теории до реального рынка</span>
          </div>
        </div>
        <nav className="tabs" aria-label="Разделы">
          {TABS.map(t => (
            <button key={t.id} className={'tab' + (tab === t.id ? ' act' : '')} onClick={() => go(t.id)}>
              <span className="tab-n">{t.n}</span>
              <span className="tab-t">{t.t}<small>{sub[t.id]}</small></span>
            </button>
          ))}
        </nav>
        <div className="me">
          <span className="rank">{r.title}</span>
          <span className="muted sm" title={storageStatus() === 'cloud' ? 'Прогресс сохраняется в вашем личном хранилище' : 'Прогресс сохраняется в этом браузере'}>{storageStatus() === 'cloud' ? 'сохранено в аккаунте' : 'сохранено в браузере'}</span>
        </div>
      </header>
      <main className="main">
        {tab === 'academy' && <Academy progress={progress} setProgress={setProgress} goTab={go} />}
        {tab === 'cases' && <Cases results={cases.results || {}} setResults={fn => setCases(c => ({ ...c, results: fn(c.results || {}) }))} />}
        {tab === 'trainer' && <Trainer sim={sim} setSim={setSim} />}
        {tab === 'live' && <Live live={live} setLive={setLive} />}
      </main>
      <footer className="foot muted sm">
        Учебный проект. Все деньги виртуальные, сделки не отправляются на биржу. Не является инвестиционной рекомендацией.
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
