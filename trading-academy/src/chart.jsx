import { fmtP, fmtTime, fmtVol, niceStep, decimalsFor, clamp } from './lib.js';
const { useState, useRef, useEffect, useMemo, useLayoutEffect } = React;

function useWidth(ref) {
  const [w, setW] = useState(600);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    setW(el.clientWidth || 600);
    const ro = new ResizeObserver(() => setW(el.clientWidth || 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}

// Универсальный свечной график на SVG: панорама, масштаб, перекрестие, линии, зоны, маркеры
export default function Chart({
  candles, height = 380, lines = [], zones = [], trendLines = [], markers = [], mas = [],
  showVolume = true, rsiValues = null, padRight = 4, onPick = null, tool = 'none', onAddDrawing = null,
  decisionIndex = null, fitPrices = [], initialCount = 90, minCount = 20, follow = true, dim = null,
  watermark = null, compact = false, autoFit = true,
}) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const W = useWidth(wrapRef);
  const [count, setCount] = useState(initialCount);
  const [offset, setOffset] = useState(0);
  const [hover, setHover] = useState(null);
  const [draft, setDraft] = useState(null);
  const drag = useRef(null);

  const axisR = compact ? 56 : 66, axisB = 20;
  const rsiH = rsiValues ? 64 : 0;
  const volH = showVolume ? Math.round((height - axisB - rsiH) * 0.16) : 0;
  const mainH = height - axisB - rsiH - volH;
  const plotW = Math.max(50, W - axisR);

  const n = candles.length;
  const cnt = Math.min(count, Math.max(minCount, n), autoFit ? Math.max(minCount, Math.floor(plotW / 5)) : Infinity);
  const off = clamp(offset, 0, Math.max(0, n - minCount));
  const endIdx = n - off;
  const startIdx = Math.max(0, endIdx - cnt);
  const vis = candles.slice(startIdx, endIdx);
  const slots = cnt + (off === 0 ? padRight : 0);
  const slotW = plotW / Math.max(1, slots);
  const step = n > 1 ? candles[1].t - candles[0].t : 60000;
  const t0 = n ? candles[0].t : 0;

  const [pMin, pMax] = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const c of vis) { if (c.l < lo) lo = c.l; if (c.h > hi) hi = c.h; }
    for (const p of fitPrices) if (p != null && isFinite(p)) { lo = Math.min(lo, p); hi = Math.max(hi, p); }
    for (const z of zones) { if (z.fit) { lo = Math.min(lo, z.p1, z.p2); hi = Math.max(hi, z.p1, z.p2); } }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    const pad = (hi - lo) * 0.08 || hi * 0.01 || 1;
    return [lo - pad, hi + pad];
  }, [vis, fitPrices.join(','), zones]);

  const y = p => 8 + (mainH - 16) * (1 - (p - pMin) / (pMax - pMin));
  const yInv = py => pMin + (1 - (py - 8) / (mainH - 16)) * (pMax - pMin);
  const xOfIdx = idx => (idx - startIdx + 0.5) * slotW;
  const idxOfX = px => startIdx + px / slotW - 0.5;
  const idxOfT = t => (t - t0) / step;

  const vMax = useMemo(() => Math.max(1, ...vis.map(c => c.v || 0)), [vis]);
  const dec = decimalsFor(vis.length ? vis[vis.length - 1].c : 1);

  // колесо — масштаб
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const onWheel = e => {
      e.preventDefault();
      setCount(c => clamp(Math.round(c * (e.deltaY > 0 ? 1.12 : 0.89)), minCount, Math.max(minCount, 400)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const local = e => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = e => {
    const p = local(e);
    drag.current = { x: p.x, off, moved: false };
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const onMove = e => {
    const p = local(e);
    if (drag.current) {
      const dx = p.x - drag.current.x;
      if (Math.abs(dx) > 4) drag.current.moved = true;
      if (drag.current.moved && tool === 'none') {
        setOffset(clamp(Math.round(drag.current.off + dx / slotW), 0, Math.max(0, n - minCount)));
      }
    }
    if (p.x <= plotW && p.y <= mainH) {
      const idx = Math.round(idxOfX(p.x));
      setHover({ x: p.x, y: p.y, idx, price: yInv(p.y) });
    } else setHover(null);
  };
  const onUp = e => {
    const d = drag.current; drag.current = null;
    if (!d || d.moved) return;
    const p = local(e);
    if (p.x > plotW || p.y > mainH) return;
    const price = yInv(p.y);
    const fi = idxOfX(p.x);
    const t = t0 + fi * step;
    if (tool === 'hline' && onAddDrawing) { onAddDrawing({ type: 'hline', price }); return; }
    if (tool === 'trend' && onAddDrawing) {
      if (!draft) setDraft({ t, p: price });
      else { onAddDrawing({ type: 'trend', t1: draft.t, p1: draft.p, t2: t, p2: price }); setDraft(null); }
      return;
    }
    if (onPick) onPick(price, t, Math.round(fi));
  };

  // сетка цен
  const pStep = niceStep(pMax - pMin, mainH / 55);
  const gridP = [];
  for (let p = Math.ceil(pMin / pStep) * pStep; p < pMax; p += pStep) gridP.push(p);
  const tEvery = Math.max(1, Math.round(90 / slotW));
  const isDay = step >= 86400e3 * 0.99;

  const last = vis[vis.length - 1];
  const hc = hover && candles[clamp(hover.idx, 0, n - 1)];
  const legend = hc || last;

  const cw = Math.max(1, slotW * 0.68);
  const lastY = last ? y(last.c) : 0;

  return (
    <div ref={wrapRef} className="chart-wrap" style={{ height }}>
      <svg ref={svgRef} width={W} height={height} className={'chart-svg' + (tool !== 'none' ? ' tool-on' : onPick ? ' pick-on' : '')}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => setHover(null)}
        onDoubleClick={() => { setOffset(0); setCount(initialCount); }}>
        <rect x="0" y="0" width={plotW} height={mainH + volH + rsiH} fill="var(--chart-bg)" />
        {watermark && <text x={plotW / 2} y={mainH / 2 + 14} textAnchor="middle" className="wm">{watermark}</text>}
        {gridP.map(p => (
          <g key={p}>
            <line x1="0" x2={plotW} y1={y(p)} y2={y(p)} className="grid" />
            <text x={plotW + 6} y={y(p) + 4} className="ax">{fmtP(p, dec)}</text>
          </g>
        ))}
        {vis.map((c, k) => (k + startIdx) % tEvery === 0 ? (
          <g key={'t' + c.t}>
            <line x1={xOfIdx(k + startIdx)} x2={xOfIdx(k + startIdx)} y1="0" y2={mainH + volH + rsiH} className="grid" />
            <text x={xOfIdx(k + startIdx)} y={height - 6} textAnchor="middle" className="ax">{fmtTime(c.t, isDay ? 'day' : '')}</text>
          </g>
        ) : null)}

        {zones.map((z, i) => {
          const y1 = y(Math.max(z.p1, z.p2)), y2 = y(Math.min(z.p1, z.p2));
          const x1 = z.i1 != null ? Math.max(0, xOfIdx(z.i1) - slotW / 2) : 0;
          const x2 = z.i2 != null ? Math.min(plotW, xOfIdx(z.i2) + slotW / 2) : plotW;
          return (
            <g key={'z' + i}>
              <rect x={x1} y={y1} width={Math.max(0, x2 - x1)} height={Math.max(1, y2 - y1)} fill={z.color} opacity={z.opacity || 0.16} />
              {z.label && <text x={x1 + 6} y={y1 + 13} className="zl" fill={z.text || z.color}>{z.label}</text>}
            </g>
          );
        })}

        {decisionIndex != null && decisionIndex >= startIdx && (
          <g>
            <line x1={xOfIdx(decisionIndex) + slotW / 2} x2={xOfIdx(decisionIndex) + slotW / 2} y1="0" y2={mainH} className="decision" />
            <text x={xOfIdx(decisionIndex) + slotW / 2 + 5} y={14} className="zl" fill="var(--accent)">точка решения</text>
          </g>
        )}
        {dim != null && dim > startIdx && (
          <rect x={xOfIdx(dim) - slotW / 2} y="0" width={Math.max(0, plotW - xOfIdx(dim) + slotW / 2)} height={mainH} fill="var(--accent)" opacity="0.05" />
        )}

        {showVolume && vis.map((c, k) => {
          const h = (c.v / vMax) * (volH - 4);
          return <rect key={'v' + c.t} x={xOfIdx(k + startIdx) - cw / 2} y={mainH + volH - h} width={cw} height={Math.max(0.5, h)} className={c.c >= c.o ? 'vol-up' : 'vol-dn'} />;
        })}

        {vis.map((c, k) => {
          const x = xOfIdx(k + startIdx);
          const up = c.c >= c.o;
          const yo = y(c.o), yc = y(c.c);
          return (
            <g key={'c' + c.t} className={up ? 'cu' : 'cd'}>
              <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} />
              <rect x={x - cw / 2} y={Math.min(yo, yc)} width={cw} height={Math.max(1, Math.abs(yc - yo))} />
            </g>
          );
        })}

        {mas.map((m, i) => {
          let d = '';
          for (let k = startIdx; k < endIdx; k++) {
            const v = m.values[k]; if (v == null) continue;
            d += (d ? 'L' : 'M') + xOfIdx(k).toFixed(1) + ',' + y(v).toFixed(1);
          }
          return <path key={'ma' + i} d={d} fill="none" stroke={m.color} strokeWidth="1.4" opacity="0.9" />;
        })}

        {trendLines.map((tl, i) => {
          const x1 = xOfIdx(idxOfT(tl.t1)), x2 = xOfIdx(idxOfT(tl.t2));
          return <line key={'tl' + i} x1={x1} y1={y(tl.p1)} x2={x2} y2={y(tl.p2)} stroke={tl.color || 'var(--draw)'} strokeWidth="1.6" />;
        })}
        {draft && hover && (
          <line x1={xOfIdx(idxOfT(draft.t))} y1={y(draft.p)} x2={hover.x} y2={hover.y} stroke="var(--draw)" strokeDasharray="4 3" strokeWidth="1.4" />
        )}

        {markers.map((m, i) => {
          const fi = idxOfT(m.t);
          if (fi < startIdx - 1 || fi > endIdx + padRight) return null;
          const x = xOfIdx(Math.round(fi)), yy = y(m.price);
          const col = m.type === 'buy' ? 'var(--up)' : m.type === 'sell' ? 'var(--dn)' : 'var(--fg-2)';
          const pts = m.type === 'buy' ? `${x},${yy + 3} ${x - 5},${yy + 12} ${x + 5},${yy + 12}` :
            m.type === 'sell' ? `${x},${yy - 3} ${x - 5},${yy - 12} ${x + 5},${yy - 12}` : null;
          return (
            <g key={'m' + i}>
              {pts ? <polygon points={pts} fill={col} /> : <circle cx={x} cy={yy} r="4" fill="none" stroke={col} strokeWidth="2" />}
              {m.label && <text x={x + 7} y={m.type === 'sell' ? yy - 8 : yy + 14} className="ml" fill={col}>{m.label}</text>}
            </g>
          );
        })}

        {lines.map((l, i) => {
          const yy = y(l.price);
          if (yy < -2 || yy > mainH + 2) {
            return (
              <g key={'l' + i}>
                <rect x={plotW + 1} y={yy < 0 ? 2 : mainH - 16} width={axisR - 2} height="15" rx="2" fill={l.color} opacity="0.7" />
                <text x={plotW + 5} y={yy < 0 ? 13 : mainH - 5} className="tag">{yy < 0 ? '▲ ' : '▼ '}{l.short || ''}</text>
              </g>
            );
          }
          return (
            <g key={'l' + i}>
              <line x1="0" x2={plotW} y1={yy} y2={yy} stroke={l.color} strokeDasharray={l.dash || '5 4'} strokeWidth="1.2" />
              {l.label && (
                <g>
                  <rect x={4} y={yy - 9} width={Math.min(plotW - 8, l.label.length * 6.4 + 10)} height="16" rx="3" fill="var(--bg-0)" stroke={l.color} strokeWidth="1" />
                  <text x={9} y={yy + 3} className="ll" fill={l.color}>{l.label}</text>
                </g>
              )}
              <rect x={plotW + 1} y={yy - 8} width={axisR - 2} height="16" rx="2" fill={l.color} />
              <text x={plotW + 5} y={yy + 4} className="tag">{fmtP(l.price, dec)}</text>
            </g>
          );
        })}

        {last && off === 0 && (
          <g>
            <line x1="0" x2={plotW} y1={lastY} y2={lastY} className={last.c >= last.o ? 'lastl up' : 'lastl dn'} />
            <rect x={plotW + 1} y={lastY - 8} width={axisR - 2} height="16" rx="2" className={last.c >= last.o ? 'tagbg up' : 'tagbg dn'} />
            <text x={plotW + 5} y={lastY + 4} className="tag">{fmtP(last.c, dec)}</text>
          </g>
        )}

        {rsiValues && (
          <g transform={`translate(0,${mainH + volH})`}>
            <line x1="0" x2={plotW} y1="0" y2="0" className="sep" />
            <rect x="0" y={rsiH * 0.3} width={plotW} height={rsiH * 0.4} fill="var(--accent)" opacity="0.05" />
            {[30, 70].map(v => <text key={v} x={plotW + 6} y={rsiH * (1 - v / 100) + 4} className="ax">{v}</text>)}
            <path fill="none" stroke="var(--accent)" strokeWidth="1.3" d={(() => {
              let d = '';
              for (let k = startIdx; k < endIdx; k++) { const v = rsiValues[k]; if (v == null) continue; d += (d ? 'L' : 'M') + xOfIdx(k).toFixed(1) + ',' + (rsiH * (1 - v / 100)).toFixed(1); }
              return d;
            })()} />
            <text x="6" y="12" className="ax">RSI 14 {rsiValues[Math.min(n - 1, hover ? clamp(hover.idx, 0, n - 1) : n - 1)]?.toFixed(1)}</text>
          </g>
        )}

        {showVolume && <line x1="0" x2={plotW} y1={mainH} y2={mainH} className="sep" />}
        <line x1={plotW} x2={plotW} y1="0" y2={height - axisB} className="sep" />

        {hover && (
          <g pointerEvents="none">
            <line x1={hover.x} x2={hover.x} y1="0" y2={mainH + volH + rsiH} className="cross" />
            <line x1="0" x2={plotW} y1={hover.y} y2={hover.y} className="cross" />
            <rect x={plotW + 1} y={hover.y - 8} width={axisR - 2} height="16" rx="2" fill="var(--fg-3)" />
            <text x={plotW + 5} y={hover.y + 4} className="tag">{fmtP(hover.price, dec)}</text>
            {hc && (
              <g>
                <rect x={clamp(hover.x - 38, 0, plotW - 76)} y={height - axisB + 1} width="76" height="17" rx="2" fill="var(--fg-3)" />
                <text x={clamp(hover.x, 38, plotW - 38)} y={height - 7} textAnchor="middle" className="tag">{fmtTime(hc.t, isDay ? 'day' : '')}</text>
              </g>
            )}
          </g>
        )}
      </svg>
      {legend && (
        <div className="legend">
          <span>O <b className={legend.c >= legend.o ? 'up' : 'dn'}>{fmtP(legend.o, dec)}</b></span>
          <span>H <b className={legend.c >= legend.o ? 'up' : 'dn'}>{fmtP(legend.h, dec)}</b></span>
          <span>L <b className={legend.c >= legend.o ? 'up' : 'dn'}>{fmtP(legend.l, dec)}</b></span>
          <span>C <b className={legend.c >= legend.o ? 'up' : 'dn'}>{fmtP(legend.c, dec)}</b></span>
          {!compact && <span className="hide-sm">V <b>{fmtVol(legend.v || 0)}</b></span>}
          {mas.map((m, i) => <span key={i} className="hide-sm" style={{ color: m.color }}>{m.label}</span>)}
        </div>
      )}
      {off > 0 && <button className="to-live" onClick={() => setOffset(0)}>К последней свече →</button>}
      {tool === 'trend' && <div className="tool-hint">{draft ? 'Кликните вторую точку линии' : 'Кликните первую точку трендовой линии'}</div>}
      {tool === 'hline' && <div className="tool-hint">Кликните на уровень цены</div>}
    </div>
  );
}
