import Chart from './chart.jsx';
import { candlesFromAnchors, fmtP, sma } from './lib.js';
const { useState, useMemo, useEffect, useRef } = React;

// Сценарии смоделированы по типичным историческим ситуациям; цены и время условные
export const CASES = [
  {
    id: 'c1', title: 'Ложный пробой сопротивления', pair: 'BTC/USDT', tf: '1h', tag: 'Ложный пробой', seed: 11, noise: 0.0022,
    anchors: [[0, 41200], [8, 40850], [15, 41950], [24, 40820], [32, 41980], [40, 40880], [48, 41960], [55, 41300], [62, 41880], [63, 41920], [64, 41820], [66, 41700], [75, 41300], [85, 40950], [96, 40650]],
    overrides: { 64: { o: 41920, h: 42480, c: 41820, vm: 3.8 } }, decision: 64,
    zones: [{ p1: 42000, p2: 42200, color: 'var(--dn)', label: 'стопы шортистов + buy-stop пробойщиков', i1: 10 }, { p1: 40780, p2: 40900, color: 'var(--up)', label: 'поддержка диапазона', i1: 5 }],
    levels: [{ price: 42000, label: 'сопротивление 42 000' }],
    context: 'Двое суток BTC ходит в диапазоне 40 800–42 000. Сопротивление протестировано трижды, над ним все видят «очевидный пробой». Последняя свеча выстрелила до 42 480 на тройном объёме, но закрылась под уровнем — на 41 820.',
    stops: 'Над 42 000 стояли стоп-лоссы шортистов и buy-stop ордера тех, кто покупает пробой. Тень до 42 480 их собрала: сработавшие стопы стали рыночными покупками, крупный продавец разгрузился в них.',
    best: 'short', ok: [], slZone: { short: [42500, 43100], long: [40700, 41500] },
    verdict: {
      short: 'Верно: ложный пробой с возвратом под уровень и объёмом — классический сетап на продажу. Цель — нижняя граница диапазона 40 900.',
      long: 'Вы купили в ловушке. Покупатели на пробое уже стали ликвидностью для продавца, а вернувшаяся под уровень цена — признак слабости.',
      skip: 'Осторожно, но это был один из самых чистых сетапов: вынос стопов, возврат под уровень, всплеск объёма.',
    },
  },
  {
    id: 'c2', title: 'Откат по восходящему тренду', pair: 'ETH/USDT', tf: '4h', tag: 'Откат по тренду', seed: 23, noise: 0.004,
    anchors: [[0, 2400], [10, 2560], [16, 2490], [28, 2705], [35, 2610], [48, 2860], [56, 2740], [59, 2716], [60, 2722], [62, 2760], [70, 2880], [76, 2850], [84, 2990], [96, 3080]],
    overrides: { 60: { l: 2702, c: 2722, vm: 1.6 } }, decision: 60,
    zones: [{ p1: 2690, p2: 2715, color: 'var(--up)', label: 'бывшее сопротивление → поддержка', i1: 24 }, { p1: 2595, p2: 2612, color: 'var(--dn)', label: 'стопы лонгистов под HL', i1: 32 }],
    levels: [], ma: 20,
    context: 'ETH в восходящем тренде: минимумы 2 490 → 2 610, максимумы 2 560 → 2 705 → 2 860. Цена откатила к уровню 2 705 (бывшее сопротивление) и к MA 20. Последняя свеча оставила нижнюю тень у 2 702.',
    stops: 'Стопы покупателей прячутся под последним HL (2 610) и под уровнем 2 700. Пока HL не пробит, структура тренда цела.',
    best: 'long', ok: [], slZone: { long: [2595, 2696], short: [2780, 2900] },
    verdict: {
      long: 'Верно: вход по тренду на откате к поддержке с понятным стопом. Риск небольшой, цель — обновление максимума 2 860 и выше.',
      short: 'Шорт против тренда без слома структуры. Минимумы растут, цена у поддержки — RR против вас.',
      skip: 'Пропуск допустим, но это хрестоматийный сетап «откат по тренду» с понятным стопом.',
    },
  },
  {
    id: 'c3', title: 'Паника на новостях', pair: 'BTC/USDT', tf: '15m', tag: 'Новости', seed: 37, noise: 0.0016,
    anchors: [[0, 60200], [12, 60550], [24, 60050], [40, 60450], [54, 60300], [55, 58200], [56, 57900], [58, 58650], [62, 59050], [70, 59300], [82, 59750], [96, 59950]],
    overrides: { 55: { o: 60300, h: 60380, l: 57300, c: 58200, vm: 7 }, 56: { l: 57150, c: 57900, vm: 5 } }, decision: 56,
    zones: [{ p1: 57100, p2: 57400, color: 'var(--dn)', label: 'каскад ликвидаций лонгов', i1: 50 }],
    levels: [{ price: 60000, label: 'круглый уровень 60 000' }],
    context: 'Вышли данные по инфляции хуже прогноза. За 30 минут BTC упал на 5%: огромные красные свечи, объём в 7 раз выше среднего, длинные нижние тени. В соцсетях паника.',
    stops: 'На проливе сработали стопы и ликвидации лонгов с плечом — это видно по аномальному объёму. Ниже ликвидности уже мало, а продавцы-паникёры закончились.',
    best: 'skip', ok: ['long'], slZone: { long: [56700, 57100], short: [58700, 59500] },
    verdict: {
      skip: 'Верно: в момент паники спред расширен, стопы проскальзывают, движения непредсказуемы. Профессионал ждёт, пока рынок успокоится, и ищет сетап после.',
      long: 'Сработало, но это ловля ножа. В момент пролива вы не знали, где дно, а стоп на такой волатильности легко проскальзывает. Повезло — не путайте удачу с системой.',
      short: 'Шорт на дне паники после −5% — продажа капитулировавшим. Здесь крупные участники как раз выкупают ликвидации.',
    },
  },
  {
    id: 'c4', title: 'Середина боковика', pair: 'SOL/USDT', tf: '1h', tag: 'Боковик', seed: 41, noise: 0.004,
    anchors: [[0, 146], [8, 151.6], [16, 140.4], [25, 151.8], [33, 140.2], [42, 151.5], [50, 140.6], [58, 146.4], [60, 146.0], [68, 151.3], [78, 140.7], [88, 151.0], [96, 146.2]],
    overrides: {}, decision: 60,
    zones: [{ p1: 151.2, p2: 152.2, color: 'var(--dn)', label: 'верх диапазона', i1: 4 }, { p1: 139.8, p2: 140.8, color: 'var(--up)', label: 'низ диапазона', i1: 4 }],
    levels: [],
    context: 'SOL три дня в диапазоне 140–152. Цена сейчас ровно посередине — на 146. Объём ниже среднего, сильных свечей нет.',
    stops: 'Стопы шортистов над 152, стопы лонгистов под 140. Посередине диапазона нет ни уровня, ни ликвидности — любой стоп случаен.',
    best: 'skip', ok: [], slZone: { long: [139, 140.4], short: [151.8, 153] },
    verdict: {
      skip: 'Верно: в середине боковика нет преимущества. До стопа и до цели одинаково далеко, RR около 1:1. Ждём подхода к границе.',
      long: 'Вход в середине диапазона — монетка. Даже если сделка дала результат, на дистанции такие входы съедают депозит комиссиями.',
      short: 'Вход в середине диапазона — монетка. Шорт имеет смысл от верхней границы, а не от середины.',
    },
  },
  {
    id: 'c5', title: 'Пробой и ретест уровня', pair: 'BTC/USDT', tf: '4h', tag: 'Пробой', seed: 53, noise: 0.003,
    anchors: [[0, 47500], [10, 49900], [17, 48300], [25, 49950], [31, 48700], [38, 49900], [42, 49400], [45, 51300], [48, 51800], [55, 50150], [56, 50480], [58, 50900], [65, 52300], [75, 53200], [85, 54000], [96, 54700]],
    overrides: { 45: { vm: 3.2 }, 46: { vm: 2 }, 55: { l: 49980, vm: 0.6 } }, decision: 56,
    zones: [{ p1: 49800, p2: 50050, color: 'var(--accent)', label: 'бывшее сопротивление 50 000', i1: 5 }],
    levels: [],
    context: 'BTC месяц упирался в 50 000. Наконец пробой на объёме в 3 раза выше среднего, цена ушла к 51 800. Затем спокойный откат на низком объёме обратно к 50 000 — и первая зелёная свеча от уровня.',
    stops: 'Опоздавшие шортисты держат стопы над 51 800. Те, кто покупал пробой, — под 49 800. Пока цена над уровнем, пробой подтверждён.',
    best: 'long', ok: [], slZone: { long: [48900, 49790], short: [51000, 52000] },
    verdict: {
      long: 'Верно: пробой с объёмом, откат без объёма и реакция от уровня — сетап «ретест». Стоп под уровнем, цель — продолжение движения.',
      short: 'Шорт против свежего пробоя с объёмом. Откат на низком объёме — это не слабость, а отсутствие продавцов.',
      skip: 'Можно пропустить, но ретест после пробоя с объёмом — один из самых надёжных сетапов.',
    },
  },
  {
    id: 'c6', title: 'Ложный пробой поддержки', pair: 'ETH/USDT', tf: '1h', tag: 'Ложный пробой', seed: 61, noise: 0.0026,
    anchors: [[0, 3080], [6, 3140], [12, 3006], [20, 3146], [28, 3003], [36, 3150], [44, 3008], [52, 3090], [57, 3020], [58, 3028], [60, 3045], [70, 3110], [80, 3165], [96, 3210]],
    overrides: { 58: { o: 3020, l: 2936, c: 3028, vm: 3.6 } }, decision: 58,
    zones: [{ p1: 2950, p2: 2995, color: 'var(--up)', label: 'стопы лонгистов под 3 000', i1: 8 }, { p1: 3140, p2: 3155, color: 'var(--dn)', label: 'верх диапазона', i1: 3 }],
    levels: [{ price: 3000, label: 'поддержка 3 000' }],
    context: 'ETH в диапазоне 3 000–3 150. Поддержка 3 000 держалась трижды. Последняя свеча пробила её до 2 936 на большом объёме, но закрылась обратно над уровнем — на 3 028.',
    stops: 'Под 3 000 скопились стопы покупателей и sell-stop ордера тех, кто продаёт пробой вниз. Крупный покупатель собрал их и набрал позицию.',
    best: 'long', ok: [], slZone: { long: [2880, 2932], short: [3040, 3100] },
    verdict: {
      long: 'Верно: ложный пробой вниз (spring). Стоп за минимумом тени, цель — верх диапазона 3 150.',
      short: 'Шорт на возврате над уровнем после выноса стопов — вы продаёте тому, кто только что собрал ликвидность.',
      skip: 'Пропуск допустим, но сетап был зеркальным отражением первого кейса — вынос и возврат.',
    },
  },
  {
    id: 'c7', title: 'Откат в нисходящем тренде', pair: 'SOL/USDT', tf: '4h', tag: 'Откат по тренду', seed: 71, noise: 0.005,
    anchors: [[0, 210], [10, 188], [16, 198], [28, 172], [35, 183], [48, 158], [55, 170], [57, 171.6], [58, 170.4], [60, 166], [68, 152], [74, 156], [82, 142], [96, 135]],
    overrides: { 58: { h: 173.2, vm: 1.4 } }, decision: 58, ma: 20,
    zones: [{ p1: 170.5, p2: 173, color: 'var(--dn)', label: 'бывший минимум → сопротивление', i1: 22 }, { p1: 183, p2: 185, color: 'var(--dn)', label: 'стопы шортистов над LH', i1: 30 }],
    levels: [],
    context: 'SOL в нисходящем тренде: максимумы 210 → 198 → 183, минимумы 188 → 172 → 158. Цена откатила к 172 — к бывшему минимуму и MA 20. Последняя свеча с верхней тенью до 173,2.',
    stops: 'Стопы шортистов — над последним LH 183. Пока он не пробит, тренд вниз.',
    best: 'short', ok: [], slZone: { short: [173.5, 185.5], long: [150, 165] },
    verdict: {
      short: 'Верно: продажа на откате к сопротивлению по тренду. Стоп над откатом или над LH, цель — обновление минимума.',
      long: 'Покупка против нисходящего тренда у сопротивления. Пока структура LH-LL цела, лонги — против течения.',
      skip: 'Пропуск допустим, но это зеркало кейса 2: откат по тренду к уровню.',
    },
  },
  {
    id: 'c8', title: 'FOMO на параболе', pair: 'DOGE/USDT', tf: '1h', tag: 'FOMO', seed: 83, noise: 0.006,
    anchors: [[0, 0.1], [20, 0.104], [30, 0.11], [40, 0.125], [48, 0.145], [54, 0.165], [58, 0.182], [60, 0.188], [61, 0.193], [62, 0.186], [64, 0.171], [70, 0.152], [80, 0.134], [96, 0.122]],
    overrides: { 56: { vm: 3 }, 58: { vm: 4 }, 59: { vm: 4.5 }, 60: { vm: 5 }, 61: { h: 0.1995, vm: 6 } }, decision: 60,
    zones: [],
    levels: [],
    context: 'Мем-монета выросла почти вдвое за двое суток. Последние свечи — огромные зелёные, объём растёт каждый час. В соцсетях «на луну», знакомые хвастаются прибылью.',
    stops: 'Стопов покупателей под ценой нет — все входили выше и выше без плана. Если начнётся разворот, падение пойдёт по пустому стакану.',
    best: 'skip', ok: ['short'], slZone: { short: [0.2, 0.215], long: [0.17, 0.18] },
    verdict: {
      skip: 'Верно: вход на вертикальном росте без сетапа — это FOMO. Вы не знаете, где стоп, а коррекции после парабол бывают на 30–40%.',
      long: 'Классический FOMO: покупка на эйфории у самого максимума. Тот, кто покупал на 0,10, продал вам.',
      short: 'Шорт параболы против импульса — рискованно: такие движения часто дают последний вынос вверх. Если стоп стоял далеко, сделка сработала, но это опытный приём.',
    },
  },
];

function buildCase(c) {
  return candlesFromAnchors({ anchors: c.anchors, seed: c.seed, noise: c.noise, overrides: c.overrides, stepMs: { '15m': 900e3, '1h': 3600e3, '4h': 14400e3 }[c.tf], baseVol: 1000 });
}

function evaluate(c, all, action, sl, tp) {
  const d = c.decision;
  const entry = all[d].c;
  const out = { entry, action };
  const actionScore = action === c.best ? 60 : c.ok.includes(action) ? 30 : 0;
  if (action === 'skip') {
    out.score = actionScore + (action === c.best ? 40 : 0);
    out.exitI = all.length - 1; out.R = 0;
    // что было бы
    const last = all[all.length - 1].c;
    out.moveAfter = (last - entry) / entry * 100;
    return out;
  }
  const dir = action === 'long' ? 1 : -1;
  let exit = all[all.length - 1].c, exitI = all.length - 1, reason = 'end';
  for (let i = d + 1; i < all.length; i++) {
    const k = all[i];
    if (dir > 0 ? k.l <= sl : k.h >= sl) { exit = sl; exitI = i; reason = 'sl'; break; }
    if (tp && (dir > 0 ? k.h >= tp : k.l <= tp)) { exit = tp; exitI = i; reason = 'tp'; break; }
  }
  const R = (exit - entry) * dir / Math.abs(entry - sl);
  const zone = c.slZone[action];
  let slq = 'ok';
  if (zone) {
    const [lo, hi] = zone;
    if (action === 'long') slq = sl > hi ? 'tight' : sl < lo ? 'wide' : 'ok';
    else slq = sl < lo ? 'tight' : sl > hi ? 'wide' : 'ok';
  }
  const slScore = slq === 'ok' ? 40 : slq === 'wide' ? 20 : 5;
  Object.assign(out, { exit, exitI, reason, R, slq, score: actionScore === 0 ? Math.min(20, slScore / 2) : actionScore + slScore });
  return out;
}

export default function Cases({ results, setResults }) {
  const [ci, setCi] = useState(0);
  const c = CASES[ci];
  const all = useMemo(() => buildCase(c), [c]);
  const ma = useMemo(() => c.ma ? sma(all, c.ma) : null, [all]);
  const [action, setAction] = useState(null);
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [pick, setPick] = useState('sl');
  const [res, setRes] = useState(null);
  const [shown, setShown] = useState(c.decision + 1);
  const timer = useRef(null);

  useEffect(() => { setAction(null); setSl(''); setTp(''); setRes(null); setShown(c.decision + 1); clearInterval(timer.current); }, [ci]);
  useEffect(() => () => clearInterval(timer.current), []);

  const entry = all[c.decision].c;
  const slN = parseFloat(String(sl).replace(',', '.')), tpN = parseFloat(String(tp).replace(',', '.'));
  let err = '';
  if (action && action !== 'skip') {
    if (!(slN > 0)) err = 'Поставьте Stop-Loss: кликните по графику или введите цену.';
    else if (action === 'long' && slN >= entry) err = 'Для лонга стоп должен быть ниже цены входа.';
    else if (action === 'short' && slN <= entry) err = 'Для шорта стоп должен быть выше цены входа.';
    else if (tpN > 0 && (action === 'long' ? tpN <= entry : tpN >= entry)) err = 'Тейк-профит должен быть в сторону сделки.';
  }

  const check = () => {
    if (!action || err) return;
    const r = evaluate(c, all, action, slN, tpN > 0 ? tpN : null);
    setRes(r);
    setResults(p => ({ ...p, [c.id]: { score: Math.max(r.score, (p[c.id] && p[c.id].score) || 0), last: r.score, action, R: r.R, t: Date.now() } }));
    let k = c.decision + 1;
    clearInterval(timer.current);
    timer.current = setInterval(() => { k++; setShown(k); if (k >= all.length) clearInterval(timer.current); }, 55);
  };

  const dec = entry > 1000 ? 0 : entry > 10 ? 1 : 4;
  const lines = [
    ...c.levels.map(l => ({ price: l.price, color: 'var(--fg-2)', label: l.label, dash: '6 4' })),
    { price: entry, color: 'var(--accent)', label: 'вход ' + fmtP(entry, dec), dash: '2 3' },
  ];
  if (slN > 0 && action !== 'skip') lines.push({ price: slN, color: 'var(--dn)', label: 'SL', short: 'SL' });
  if (tpN > 0 && action !== 'skip') lines.push({ price: tpN, color: 'var(--up)', label: 'TP', short: 'TP' });
  const markers = [];
  if (res && action !== 'skip' && shown > res.exitI) {
    markers.push({ t: all[c.decision].t, price: entry, type: action === 'long' ? 'buy' : 'sell' });
    markers.push({ t: all[res.exitI].t, price: res.exit, type: 'exit', label: res.R >= 0 ? `+${res.R.toFixed(2)}R` : `${res.R.toFixed(2)}R` });
  }
  const total = Object.values(results).reduce((s, r) => s + r.score, 0);
  const doneN = Object.keys(results).length;
  const finished = shown >= all.length;

  return (
    <div className="cases">
      <div className="case-list">
        {CASES.map((x, i) => (
          <button key={x.id} className={'case-chip' + (i === ci ? ' act' : '') + (results[x.id] ? ' done' : '')} onClick={() => setCi(i)}>
            <span className="cc-n">{i + 1}</span>
            <span className="cc-t">{x.title}<small>{x.pair} · {x.tf} · {x.tag}</small></span>
            {results[x.id] && <span className={'cc-s ' + (results[x.id].score >= 70 ? 'up' : results[x.id].score >= 40 ? 'warn' : 'dn')}>{results[x.id].score}</span>}
          </button>
        ))}
        <div className="muted sm case-total">Пройдено {doneN} из {CASES.length} · средний балл {doneN ? Math.round(total / doneN) : 0}</div>
      </div>
      <div className="case-body">
        <div className="case-chart card">
          <div className="card-h"><b>{c.pair}</b><span className="muted">{c.tf} · кейс {ci + 1}: {c.title}</span></div>
          <Chart key={c.id} autoFit={false} candles={all.slice(0, shown)} height={420} padRight={all.length - shown} initialCount={all.length}
            zones={c.zones} lines={lines} markers={markers} decisionIndex={c.decision} mas={ma ? [{ values: ma, color: 'var(--accent-2)', label: 'MA ' + c.ma }] : []}
            fitPrices={[slN > 0 ? slN : null, tpN > 0 ? tpN : null, ...(res ? all.map(x => x.h).concat(all.map(x => x.l)) : [])]}
            onPick={!res && action && action !== 'skip' ? (p => { const v = p.toFixed(dec); pick === 'sl' ? setSl(v) : setTp(v); }) : null} />
        </div>
        <div className="case-side card">
          <div className="eyebrow">Ситуация</div>
          <p>{c.context}</p>
          <div className="eyebrow">Где стоят стопы</div>
          <p>{c.stops}</p>
          {!res ? (
            <>
              <div className="eyebrow">Ваше решение · цена входа {fmtP(entry, dec)}</div>
              <div className="seg3">
                <button className={'seg-b long' + (action === 'long' ? ' on' : '')} onClick={() => setAction('long')}>Long</button>
                <button className={'seg-b short' + (action === 'short' ? ' on' : '')} onClick={() => setAction('short')}>Short</button>
                <button className={'seg-b' + (action === 'skip' ? ' on' : '')} onClick={() => setAction('skip')}>Пропустить</button>
              </div>
              {action && action !== 'skip' && (
                <div className="stops-in">
                  <div className="row gap">
                    <label className="grow">Stop-Loss<input id="case-sl" className="inp" inputMode="decimal" value={sl} onChange={e => setSl(e.target.value)} onFocus={() => setPick('sl')} placeholder="обязательно" /></label>
                    <label className="grow">Take-Profit<input id="case-tp" className="inp" inputMode="decimal" value={tp} onChange={e => setTp(e.target.value)} onFocus={() => setPick('tp')} placeholder="по желанию" /></label>
                  </div>
                  <div className="muted sm">Клик по графику ставит: <button className={'mini' + (pick === 'sl' ? ' on' : '')} onClick={() => setPick('sl')}>SL</button> <button className={'mini' + (pick === 'tp' ? ' on' : '')} onClick={() => setPick('tp')}>TP</button></div>
                  {slN > 0 && !err && <div className="muted sm">Риск на сделку: {(Math.abs(entry - slN) / entry * 100).toFixed(2)}% цены{tpN > 0 ? ` · RR 1:${(Math.abs(tpN - entry) / Math.abs(entry - slN)).toFixed(2)}` : ''}</div>}
                </div>
              )}
              {err && <div className="q-why bad">{err}</div>}
              <button className="btn wide" disabled={!action || !!err} onClick={check}>Проверить</button>
            </>
          ) : (
            <div className="case-res">
              <div className={'score-big ' + (res.score >= 70 ? 'up' : res.score >= 40 ? 'warn' : 'dn')}>{res.score}<small>/100</small></div>
              {action !== 'skip' ? (
                <div className="res-line">
                  {finished ? <>Результат: <b className={res.R >= 0 ? 'up' : 'dn'}>{res.R >= 0 ? '+' : ''}{res.R.toFixed(2)}R</b> · {res.reason === 'sl' ? 'сработал стоп' : res.reason === 'tp' ? 'взят тейк' : 'позиция на конец периода'}</> : 'Рынок дорисовывается…'}
                </div>
              ) : (
                <div className="res-line">После точки решения цена прошла {res.moveAfter >= 0 ? '+' : ''}{res.moveAfter.toFixed(2)}%.</div>
              )}
              <p><b>{action === c.best ? 'Лучшее решение.' : c.ok.includes(action) ? 'Допустимо, но не лучшее.' : 'Ошибка.'}</b> {c.verdict[action]}</p>
              {action !== 'skip' && (
                <p className="muted">
                  Стоп: {res.slq === 'ok' ? 'стоял в логичном месте — за уровнем или экстремумом.' : res.slq === 'tight' ? 'слишком близко — внутри зоны, которую рынок использует для выноса стопов.' : 'слишком далеко — риск больше, чем требует сетап, RR страдает.'}
                  {c.slZone[action] && ` Логичная зона стопа: ${fmtP(c.slZone[action][0], dec)} – ${fmtP(c.slZone[action][1], dec)}.`}
                </p>
              )}
              {action !== c.best && <p className="muted">Лучшее решение: <b>{c.best === 'long' ? 'Long' : c.best === 'short' ? 'Short' : 'Пропустить'}</b>. {c.verdict[c.best]}</p>}
              <div className="row gap wrap">
                <button className="btn ghost" onClick={() => { setRes(null); setShown(c.decision + 1); setAction(null); setSl(''); setTp(''); }}>Решить заново</button>
                {ci < CASES.length - 1 && <button className="btn" onClick={() => setCi(ci + 1)}>Следующий кейс →</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
