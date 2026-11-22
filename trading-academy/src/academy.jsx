import { LEVELS, LESSONS, TOTAL_MIN } from './lessons.js';
import { DIAGRAMS } from './diagrams.jsx';
import { shuffle, mulberry32, fmtUsd } from './lib.js';
const { useState, useMemo, useEffect, useRef } = React;

export function lessonDone(progress, id) { return !!(progress.lessons && progress.lessons[id] && progress.lessons[id].done); }

export function rankOf(progress) {
  const done = LESSONS.filter(l => lessonDone(progress, l.id)).length;
  let lvl = 0;
  for (const L of LEVELS) { if (LESSONS.filter(l => l.level === L.id).every(l => lessonDone(progress, l.id))) lvl = L.id; else break; }
  const exam = progress.exam && progress.exam.passed;
  return { done, total: LESSONS.length, level: lvl, title: exam ? 'Выпускник' : lvl ? LEVELS[lvl - 1].rank : 'Абитуриент' };
}

function Quiz({ items, state, onAnswer }) {
  return (
    <div className="quiz">
      {items.map((q, qi) => {
        const chosen = state ? state[qi] : undefined;
        return (
          <div className="q" key={qi}>
            <div className="q-t"><span className="q-n">{qi + 1}</span>{q.q}</div>
            <div className="q-opts">
              {q.o.map((o, oi) => {
                const cls = chosen == null ? '' : oi === q.a ? ' right' : oi === chosen ? ' wrong' : ' faded';
                return <button key={oi} className={'opt' + cls} disabled={chosen != null} onClick={() => onAnswer(qi, oi)}>{o}</button>;
              })}
            </div>
            {chosen != null && <div className={'q-why ' + (chosen === q.a ? 'ok' : 'bad')}>{chosen === q.a ? 'Верно. ' : 'Неверно. '}{q.why}</div>}
          </div>
        );
      })}
    </div>
  );
}

function NumTask({ task, state, onSolve }) {
  const [v, setV] = useState('');
  const [res, setRes] = useState(state ? 'ok' : null);
  const check = () => {
    const x = parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
    if (!isFinite(x)) { setRes('empty'); return; }
    const ok = Math.abs(x - task.answer) <= task.tol;
    setRes(ok ? 'ok' : 'bad');
    if (ok) onSolve();
  };
  return (
    <div className="task">
      <div className="eyebrow">Практическая задача</div>
      <p>{task.q}</p>
      <div className="row gap">
        <input id={'task-' + task.answer} className="inp" inputMode="decimal" placeholder="Ваш ответ" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()} />
        {task.unit && <span className="muted">{task.unit}</span>}
        <button className="btn" onClick={check}>Проверить</button>
      </div>
      {res === 'empty' && <div className="q-why bad">Введите число.</div>}
      {res === 'bad' && <div className="q-why bad">Пока нет. Подсказка: перечитайте пример в уроке. <button className="link" onClick={() => setRes('show')}>Показать решение</button></div>}
      {(res === 'ok' || res === 'show') && <div className={'q-why ' + (res === 'ok' ? 'ok' : '')}>{res === 'ok' ? 'Решено. ' : ''}{task.solution}</div>}
    </div>
  );
}

function PosSizeTool() {
  const [dep, setDep] = useState(10000), [risk, setRisk] = useState(1), [entry, setEntry] = useState(64000), [stop, setStop] = useState(62720);
  const dist = Math.abs(entry - stop);
  const riskUsd = dep * risk / 100;
  const qty = dist > 0 ? riskUsd / dist : 0;
  return (
    <div className="tool">
      <div className="eyebrow">Калькулятор размера позиции</div>
      <div className="grid4">
        <label>Депозит, $<input className="inp" type="number" value={dep} onChange={e => setDep(+e.target.value)} /></label>
        <label>Риск, %<input className="inp" type="number" step="0.1" value={risk} onChange={e => setRisk(+e.target.value)} /></label>
        <label>Вход<input className="inp" type="number" value={entry} onChange={e => setEntry(+e.target.value)} /></label>
        <label>Стоп<input className="inp" type="number" value={stop} onChange={e => setStop(+e.target.value)} /></label>
      </div>
      <div className="calc-out">
        <div><span>Риск</span><b>{fmtUsd(riskUsd)}</b></div>
        <div><span>Дистанция стопа</span><b>{entry ? (dist / entry * 100).toFixed(2) : 0}%</b></div>
        <div><span>Размер</span><b>{qty.toFixed(4)} шт.</b></div>
        <div><span>Номинал</span><b>{fmtUsd(qty * entry)}</b></div>
      </div>
    </div>
  );
}

function LeverageTool() {
  const [m, setM] = useState(1000), [lev, setLev] = useState(5), [move, setMove] = useState(2);
  const pos = m * lev;
  const liq = 100 / lev - 0.5;
  return (
    <div className="tool">
      <div className="eyebrow">Симулятор плеча</div>
      <div className="grid4">
        <label>Маржа, $<input className="inp" type="number" value={m} onChange={e => setM(+e.target.value)} /></label>
        <label>Плечо: {lev}x<input type="range" min="1" max="50" value={lev} onChange={e => setLev(+e.target.value)} /></label>
        <label>Движение против, %<input className="inp" type="number" step="0.5" value={move} onChange={e => setMove(+e.target.value)} /></label>
      </div>
      <div className="calc-out">
        <div><span>Позиция</span><b>{fmtUsd(pos)}</b></div>
        <div><span>Убыток</span><b className="dn">{fmtUsd(-Math.min(m, pos * move / 100))}</b></div>
        <div><span>% от маржи</span><b className="dn">{Math.min(100, lev * move).toFixed(1)}%</b></div>
        <div><span>Ликвидация через</span><b className={lev >= 10 ? 'dn' : ''}>{lev === 1 ? 'нет' : '≈' + liq.toFixed(1) + '%'}</b></div>
      </div>
      {lev > 1 && move >= liq && <div className="q-why bad">При таком движении позиция будет ликвидирована: вы теряете всю маржу {fmtUsd(m)}.</div>}
    </div>
  );
}

function ExpectancyTool() {
  const [wr, setWr] = useState(40), [rr, setRr] = useState(2), [risk, setRisk] = useState(100), [n, setN] = useState(100);
  const e = (wr / 100) * rr - (1 - wr / 100);
  const pts = useMemo(() => {
    const rnd = mulberry32(42 + wr * 7 + rr * 13);
    let eq = 0; const out = [0];
    for (let i = 0; i < n; i++) { eq += rnd() < wr / 100 ? rr * risk : -risk; out.push(eq); }
    return out;
  }, [wr, rr, risk, n]);
  const mx = Math.max(...pts.map(Math.abs), 1);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / n * 520 + 20).toFixed(1)},${(80 - v / mx * 64).toFixed(1)}`).join('');
  return (
    <div className="tool">
      <div className="eyebrow">Моделирование серии сделок</div>
      <div className="grid4">
        <label>Винрейт: {wr}%<input type="range" min="10" max="90" value={wr} onChange={e => setWr(+e.target.value)} /></label>
        <label>RR 1:{rr}<input type="range" min="0.5" max="5" step="0.25" value={rr} onChange={e => setRr(+e.target.value)} /></label>
        <label>Риск, $<input className="inp" type="number" value={risk} onChange={e => setRisk(+e.target.value)} /></label>
        <label>Сделок<input className="inp" type="number" value={n} onChange={e => setN(Math.max(10, Math.min(500, +e.target.value)))} /></label>
      </div>
      <svg viewBox="0 0 560 160" className="diagram">
        <line x1="20" x2="540" y1="80" y2="80" stroke="var(--line)" />
        <path d={d} fill="none" stroke={e >= 0 ? 'var(--up)' : 'var(--dn)'} strokeWidth="2" />
      </svg>
      <div className="calc-out">
        <div><span>Матожидание</span><b className={e >= 0 ? 'up' : 'dn'}>{(e >= 0 ? '+' : '') + e.toFixed(2)}R</b></div>
        <div><span>Ожидаемо за {n}</span><b className={e >= 0 ? 'up' : 'dn'}>{fmtUsd(e * risk * n, true)}</b></div>
        <div><span>В этой выборке</span><b className={pts[n] >= 0 ? 'up' : 'dn'}>{fmtUsd(pts[n], true)}</b></div>
      </div>
    </div>
  );
}

const TOOLS = { possize: PosSizeTool, leverage: LeverageTool, expectancy: ExpectancyTool };

function Exam({ progress, setProgress, onExit }) {
  const all = useMemo(() => LESSONS.flatMap(l => l.quiz.map(q => ({ ...q, lesson: l.title }))), []);
  const [qs] = useState(() => shuffle(all).slice(0, 15));
  const [ans, setAns] = useState({});
  const done = Object.keys(ans).length === qs.length;
  const right = qs.filter((q, i) => ans[i] === q.a).length;
  const pct = Math.round(right / qs.length * 100);
  const saved = useRef(false);
  useEffect(() => {
    if (done && !saved.current) {
      saved.current = true;
      setProgress(p => ({ ...p, exam: { best: Math.max(pct, (p.exam && p.exam.best) || 0), passed: (p.exam && p.exam.passed) || pct >= 80, last: pct, t: Date.now() } }));
    }
  }, [done]);
  return (
    <div className="lesson">
      <button className="link" onClick={onExit}>← К программе</button>
      <h2>Итоговый экзамен</h2>
      <p className="muted">15 случайных вопросов из всех уроков. Порог — 80%. Лучший результат: {(progress.exam && progress.exam.best) || 0}%.</p>
      <Quiz items={qs} state={ans} onAnswer={(qi, oi) => setAns(a => ({ ...a, [qi]: oi }))} />
      {done && (
        <div className={'exam-res ' + (pct >= 80 ? 'ok' : 'bad')}>
          <b>{pct}%</b> — {right} из {qs.length}. {pct >= 80 ? 'Экзамен сдан. Вы готовы к Live-терминалу.' : 'Не хватает до 80%. Повторите уроки с ошибками и попробуйте снова.'}
        </div>
      )}
    </div>
  );
}

export default function Academy({ progress, setProgress, goTab }) {
  const [cur, setCur] = useState(() => progress.cur || 'l1');
  const [exam, setExam] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const lesson = LESSONS.find(l => l.id === cur) || LESSONS[0];
  const lp = (progress.lessons && progress.lessons[lesson.id]) || {};
  const idx = LESSONS.indexOf(lesson);
  const r = rankOf(progress);
  const topRef = useRef(null);

  const open = id => { setCur(id); setExam(false); setNavOpen(false); setProgress(p => ({ ...p, cur: id })); if (topRef.current) topRef.current.scrollIntoView({ block: 'start' }); };
  const upd = fn => setProgress(p => {
    const ls = { ...(p.lessons || {}) };
    const cur = { ...(ls[lesson.id] || {}) };
    fn(cur);
    const q = cur.quiz || {};
    const answered = Object.keys(q).length;
    const right = lesson.quiz.filter((x, i) => q[i] === x.a).length;
    cur.score = Math.round(right / lesson.quiz.length * 100);
    if (answered === lesson.quiz.length && (!lesson.task || cur.task)) cur.done = true;
    ls[lesson.id] = cur;
    return { ...p, lessons: ls };
  });
  const Diagram = DIAGRAMS[lesson.diagram];
  const Tool = lesson.tool && TOOLS[lesson.tool];
  const quizDone = Object.keys(lp.quiz || {}).length === lesson.quiz.length;

  return (
    <div className="academy" ref={topRef}>
      <aside className={'syllabus' + (navOpen ? ' open' : '')}>
        <div className="syl-head">
          <div className="eyebrow">Программа</div>
          <div className="syl-sum">{LESSONS.length} уроков · 4 уровня · ≈{Math.round(TOTAL_MIN / 60 * 10) / 10} ч</div>
          <div className="bar"><i style={{ width: (r.done / r.total * 100) + '%' }} /></div>
          <div className="muted sm">Пройдено {r.done} из {r.total} · звание: <b>{r.title}</b></div>
        </div>
        {LEVELS.map(L => {
          const ls = LESSONS.filter(l => l.level === L.id);
          const d = ls.filter(l => lessonDone(progress, l.id)).length;
          return (
            <div key={L.id} className="lvl">
              <div className="lvl-h"><span>Уровень {L.id}. {L.name}</span><span className="muted sm">{d}/{ls.length}</span></div>
              {ls.map(l => {
                const n = LESSONS.indexOf(l) + 1;
                const st = (progress.lessons || {})[l.id];
                return (
                  <button key={l.id} className={'les-item' + (l.id === cur && !exam ? ' act' : '') + (st && st.done ? ' done' : '')} onClick={() => open(l.id)}>
                    <span className="les-n">{st && st.done ? '✓' : n}</span>
                    <span className="les-t">{l.title}</span>
                    <span className="les-m">{st && st.done ? st.score + '%' : l.min + ' мин'}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
        <button className={'les-item exam-item' + (exam ? ' act' : '') + (progress.exam && progress.exam.passed ? ' done' : '')} onClick={() => { setExam(true); setNavOpen(false); }}>
          <span className="les-n">★</span><span className="les-t">Итоговый экзамен</span><span className="les-m">{progress.exam ? progress.exam.best + '%' : '15 вопр.'}</span>
        </button>
      </aside>

      <div className="les-main">
        <button className="btn ghost syl-toggle" onClick={() => setNavOpen(o => !o)}>{navOpen ? 'Скрыть программу' : `Программа · урок ${idx + 1} из ${LESSONS.length}`}</button>
        {exam ? <Exam progress={progress} setProgress={setProgress} onExit={() => setExam(false)} /> : (
          <article className="lesson" key={lesson.id}>
            <div className="eyebrow">Уровень {lesson.level} · {LEVELS[lesson.level - 1].name} · урок {idx + 1} из {LESSONS.length} · {lesson.min} мин</div>
            <h2>{lesson.title}</h2>
            <figure className="fig">{Diagram && <Diagram />}</figure>
            {lesson.body.map((b, i) => {
              if (b.p) return <p key={i}>{b.p}</p>;
              if (b.h) return <h3 key={i}>{b.h}</h3>;
              if (b.list) return <ul key={i}>{b.list.map((x, j) => <li key={j}>{x}</li>)}</ul>;
              if (b.tip) return <div key={i} className="callout tip"><b>Практика</b>{b.tip}</div>;
              if (b.warn) return <div key={i} className="callout warn"><b>Осторожно</b>{b.warn}</div>;
              if (b.ex) return <div key={i} className="callout ex"><b>Пример</b>{b.ex}</div>;
              return null;
            })}
            <div className="keys">
              <div className="eyebrow">Главное</div>
              <div className="key-row">{lesson.keys.map(k => <span key={k} className="chip">{k}</span>)}</div>
            </div>
            {Tool && <Tool />}
            {lesson.task && <NumTask key={lesson.id} task={lesson.task} state={lp.task} onSolve={() => upd(c => { c.task = true; })} />}
            <div className="eyebrow mt">Проверка знаний</div>
            <Quiz items={lesson.quiz} state={lp.quiz} onAnswer={(qi, oi) => upd(c => { c.quiz = { ...(c.quiz || {}), [qi]: oi }; })} />
            {quizDone && (
              <div className="row gap wrap mt">
                <button className="btn ghost" onClick={() => upd(c => { c.quiz = {}; c.done = false; })}>Пройти тест заново</button>
                {lp.done ? <span className="pill ok">Урок пройден · {lp.score}%</span> : lesson.task ? <span className="pill">Решите задачу, чтобы закрыть урок</span> : null}
              </div>
            )}
            <div className="les-nav">
              {idx > 0 ? <button className="btn ghost" onClick={() => open(LESSONS[idx - 1].id)}>← {LESSONS[idx - 1].title}</button> : <span />}
              {idx < LESSONS.length - 1 ? <button className="btn" onClick={() => open(LESSONS[idx + 1].id)}>{LESSONS[idx + 1].title} →</button>
                : <button className="btn" onClick={() => setExam(true)}>Итоговый экзамен →</button>}
            </div>
            {[8, 14, 18].includes(idx + 1) && (
              <div className="callout ex">
                <b>Закрепите на практике</b>
                {idx + 1 === 8 ? 'Разберите кейсы с ложными пробоями во вкладке «Кейсы».' : idx + 1 === 14 ? 'Сделайте 30 сделок в тренажёре с риском 1%.' : 'Откройте Live-терминал и проведите первые сделки на виртуальном счёте.'}
                <button className="link" onClick={() => goTab(idx + 1 === 8 ? 'cases' : idx + 1 === 14 ? 'trainer' : 'live')}> Перейти →</button>
              </div>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
