// Рыночные данные: Binance (REST + WebSocket, без ключей) с автоматическим переходом на симуляцию
import { mulberry32, gauss } from './lib.js';

export const SYMBOLS = [
  { s: 'BTCUSDT', base: 'BTC', name: 'Bitcoin', sim: 96500, vol: 0.0009 },
  { s: 'ETHUSDT', base: 'ETH', name: 'Ethereum', sim: 3350, vol: 0.0012 },
  { s: 'SOLUSDT', base: 'SOL', name: 'Solana', sim: 182, vol: 0.0016 },
  { s: 'BNBUSDT', base: 'BNB', name: 'BNB', sim: 655, vol: 0.0011 },
  { s: 'XRPUSDT', base: 'XRP', name: 'XRP', sim: 2.31, vol: 0.0016 },
  { s: 'DOGEUSDT', base: 'DOGE', name: 'Dogecoin', sim: 0.342, vol: 0.002 },
];
export const TFS = { '1m': 60e3, '5m': 300e3, '15m': 900e3, '1h': 3600e3 };
const REST_HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision'];
const WS_HOST = 'wss://stream.binance.com:9443';

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

class Market {
  constructor() {
    this.mode = 'connecting'; // live | sim | connecting
    this.reason = '';
    this.tickers = {};
    this.sym = 'BTCUSDT'; this.tf = '1m';
    this.candles = []; this.book = { bids: [], asks: [] }; this.trades = [];
    this.listeners = new Set(); this.priceListeners = new Set();
    this.restHost = REST_HOSTS[0];
    this.sim = {};
    this._emitPending = false;
    this.started = false;
    this.lastMsg = 0;
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  onPrice(fn) { this.priceListeners.add(fn); return () => this.priceListeners.delete(fn); }
  emit() {
    if (this._emitPending) return;
    this._emitPending = true;
    setTimeout(() => {
      this._emitPending = false; this.listeners.forEach(f => f());
      if (Date.now() - (this._savedAt || 0) > 5000) {
        this._savedAt = Date.now();
        const p = {}; for (const k in this.tickers) p[k] = this.tickers[k].last;
        try { localStorage.setItem('rta_v1_prices', JSON.stringify({ t: Date.now(), p })); } catch (_) {}
      }
    }, 220);
  }
  price(sym, hi, lo, last) { this.priceListeners.forEach(f => f(sym, { hi, lo, last })); }

  start(forceSim = false) {
    if (this.started) return; this.started = true;
    if (forceSim) { this.startSim('Выбран режим симуляции.'); return; }
    this.tryLive();
  }

  async tryLive() {
    this.mode = 'connecting'; this.emit();
    const syms = JSON.stringify(SYMBOLS.map(x => x.s));
    for (const host of REST_HOSTS) {
      try {
        const r = await Promise.race([fetch(`${host}/api/v3/ticker/24hr?symbols=${encodeURIComponent(syms)}`), timeout(5000)]);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const js = await r.json();
        for (const t of js) this.tickers[t.symbol] = { last: +t.lastPrice, open: +t.openPrice, high: +t.highPrice, low: +t.lowPrice, vol: +t.volume, qvol: +t.quoteVolume, chg: +t.priceChangePercent };
        this.restHost = host;
        this.mode = 'live'; this.reason = '';
        this.openTickerWS();
        await this.loadDetail();
        this.emit();
        return;
      } catch (e) { this.reason = String(e && e.message || e); }
    }
    this.startSim('Нет доступа к Binance из этой среды (' + this.reason + '). Включена реалистичная симуляция.');
  }

  openTickerWS() {
    try {
      const streams = SYMBOLS.map(x => x.s.toLowerCase() + '@miniTicker').join('/');
      const ws = new WebSocket(`${WS_HOST}/stream?streams=${streams}`);
      this.tws = ws;
      const guard = setTimeout(() => { if (this.mode === 'live' && Date.now() - this.lastMsg > 8000) this.startSim('WebSocket Binance не отвечает. Включена симуляция.'); }, 9000);
      ws.onmessage = ev => {
        this.lastMsg = Date.now();
        const m = JSON.parse(ev.data).data; if (!m) return;
        const last = +m.c, open = +m.o;
        this.tickers[m.s] = { last, open, high: +m.h, low: +m.l, vol: +m.v, qvol: +m.q, chg: ((last - open) / open) * 100 };
        if (m.s !== this.sym) this.price(m.s, last, last, last);
        this.emit();
      };
      ws.onerror = () => { clearTimeout(guard); if (this.mode === 'live') this.startSim('Соединение с Binance прервано. Включена симуляция.'); };
      ws.onclose = () => { clearTimeout(guard); };
    } catch (e) { this.startSim('WebSocket недоступен. Включена симуляция.'); }
  }

  async loadDetail() {
    const sym = this.sym, tf = this.tf;
    if (this.mode === 'sim') { this.simDetail(); return; }
    try {
      const [kl, dp] = await Promise.all([
        fetch(`${this.restHost}/api/v3/klines?symbol=${sym}&interval=${tf}&limit=300`).then(r => r.json()),
        fetch(`${this.restHost}/api/v3/depth?symbol=${sym}&limit=20`).then(r => r.json()),
      ]);
      if (sym !== this.sym || tf !== this.tf) return;
      this.candles = kl.map(k => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
      this.book = { bids: dp.bids.map(x => [+x[0], +x[1]]), asks: dp.asks.map(x => [+x[0], +x[1]]) };
      this.trades = [];
      this.openDetailWS();
      this.emit();
    } catch (e) {
      this.startSim('Не удалось загрузить свечи Binance. Включена симуляция.');
    }
  }

  openDetailWS() {
    if (this.dws) { try { this.dws.onclose = null; this.dws.close(); } catch (_) {} }
    const s = this.sym.toLowerCase();
    const ws = new WebSocket(`${WS_HOST}/stream?streams=${s}@kline_${this.tf}/${s}@depth20@100ms/${s}@aggTrade`);
    this.dws = ws;
    const mySym = this.sym, myTf = this.tf;
    ws.onmessage = ev => {
      if (mySym !== this.sym || myTf !== this.tf) return;
      this.lastMsg = Date.now();
      const msg = JSON.parse(ev.data); const d = msg.data; const st = msg.stream || '';
      if (st.includes('@kline')) {
        const k = d.k; const c = { t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v };
        const last = this.candles[this.candles.length - 1];
        if (last && last.t === c.t) this.candles = [...this.candles.slice(0, -1), c];
        else if (!last || c.t > last.t) this.candles = [...this.candles.slice(-499), c];
        const tk = this.tickers[mySym]; if (tk) this.tickers[mySym] = { ...tk, last: c.c };
        this.price(mySym, c.c, c.c, c.c);
      } else if (st.includes('@depth')) {
        this.book = { bids: d.bids.map(x => [+x[0], +x[1]]), asks: d.asks.map(x => [+x[0], +x[1]]) };
      } else if (st.includes('@aggTrade')) {
        const p = +d.p;
        this.trades = [{ p, q: +d.q, t: d.T, sell: d.m }, ...this.trades].slice(0, 40);
        this.price(mySym, p, p, p);
      }
      this.emit();
    };
    ws.onerror = () => { if (this.mode === 'live') this.startSim('Поток свечей Binance недоступен. Включена симуляция.'); };
  }

  select(sym, tf) {
    if (sym === this.sym && tf === this.tf) return;
    this.sym = sym; this.tf = tf;
    this.candles = []; this.book = { bids: [], asks: [] }; this.trades = [];
    this.emit();
    if (this.mode !== 'connecting') this.loadDetail();
  }

  // ───────── Симуляция
  startSim(reason) {
    if (this.mode === 'sim') return;
    try { this.tws && (this.tws.onerror = null, this.tws.close()); } catch (_) {}
    try { this.dws && (this.dws.onerror = null, this.dws.close()); } catch (_) {}
    this.mode = 'sim'; this.reason = reason || '';
    const rnd = mulberry32((Date.now() / 3600e3) | 0);
    let saved = {};
    try { const js = JSON.parse(localStorage.getItem('rta_v1_prices') || '{}'); if (js.t && Date.now() - js.t < 7 * 86400e3) saved = js.p || {}; } catch (_) {}
    for (const x of SYMBOLS) {
      const prev = this.tickers[x.s] || (saved[x.s] ? { last: saved[x.s], open: saved[x.s] * (1 + (rnd() - 0.5) * 0.03) } : null);
      const p = prev ? prev.last : x.sim * (1 + (rnd() - 0.5) * 0.04);
      const open = prev ? prev.open : p * (1 + (rnd() - 0.5) * 0.06);
      this.sim[x.s] = { p, open, high: Math.max(p, open) * (1 + rnd() * 0.015), low: Math.min(p, open) * (1 - rnd() * 0.015), vol: x.vol, sigma: x.vol, mu: 0, regimeLeft: 0, rnd: mulberry32(Math.floor(rnd() * 1e9)), m1: null, qvol: p * (2e5 + rnd() * 6e5) * (x.s === 'BTCUSDT' ? 1 : 0.4) };
      this.tickers[x.s] = this.simTicker(x.s);
    }
    this.simDetail();
    clearInterval(this.simTimer);
    this.simTimer = setInterval(() => this.simStep(), 500);
    this.emit();
  }

  simTicker(sym) {
    const s = this.sim[sym];
    return { last: s.p, open: s.open, high: s.high, low: s.low, vol: s.qvol / s.p, qvol: s.qvol, chg: ((s.p - s.open) / s.open) * 100 };
  }

  // История 1m свечей для выбранной пары: генерируем назад от текущей цены
  ensureHistory(sym) {
    const s = this.sim[sym];
    if (s.m1) return;
    const n = 7200;
    const now = Math.floor(Date.now() / 60e3) * 60e3;
    const rnd = s.rnd;
    const back = [];
    let p = s.p, sigma = s.vol, mu = 0, left = 0;
    for (let i = 0; i < n; i++) {
      if (left-- <= 0) { mu = (rnd() - 0.5) * s.vol * 0.16; left = 30 + Math.floor(rnd() * 200); }
      sigma = Math.max(s.vol * 0.5, Math.min(s.vol * 3, sigma * 0.95 + s.vol * 0.05 + (Math.abs(gauss(rnd)) - 0.8) * s.vol * 0.12));
      const c = p;
      const o = c / (1 + mu + gauss(rnd) * sigma);
      const h = Math.max(o, c) * (1 + Math.abs(gauss(rnd)) * sigma * 0.5);
      const l = Math.min(o, c) * (1 - Math.abs(gauss(rnd)) * sigma * 0.5);
      back.push({ t: now - i * 60e3, o, h, l, c, v: (s.qvol / 1440 / p) * (0.4 + rnd() * 1.2) * (1 + Math.abs(o - c) / (p * sigma)) });
      p = o;
    }
    back.reverse();
    s.m1 = back;
  }

  aggregate(m1, tf) {
    const ms = TFS[tf];
    if (ms === 60e3) return m1.slice(-300);
    const out = [];
    for (const c of m1) {
      const t = Math.floor(c.t / ms) * ms;
      const last = out[out.length - 1];
      if (last && last.t === t) { last.h = Math.max(last.h, c.h); last.l = Math.min(last.l, c.l); last.c = c.c; last.v += c.v; }
      else out.push({ ...c, t });
    }
    return out.slice(-300);
  }

  simDetail() {
    this.ensureHistory(this.sym);
    this.candles = this.aggregate(this.sim[this.sym].m1, this.tf);
    this.makeBook();
  }

  makeBook() {
    const s = this.sim[this.sym]; const p = s.p; const r = s.rnd;
    const tick = p >= 1000 ? 0.1 : p >= 10 ? 0.01 : p >= 1 ? 0.0001 : 0.00001;
    const step = Math.max(tick, p * 0.00004);
    const bids = [], asks = [];
    const bestBid = Math.floor(p / tick) * tick, bestAsk = bestBid + tick;
    const sz = (s.qvol / p) / 40000;
    let bp = bestBid, ap = bestAsk;
    for (let i = 0; i < 20; i++) {
      bids.push([bp, sz * (0.2 + r() * 2.5) * (r() < 0.08 ? 5 : 1)]);
      asks.push([ap, sz * (0.2 + r() * 2.5) * (r() < 0.08 ? 5 : 1)]);
      bp -= step * (1 + r() * 0.6); ap += step * (1 + r() * 0.6);
    }
    this.book = { bids, asks };
  }

  simStep() {
    const now = Date.now();
    for (const x of SYMBOLS) {
      const s = this.sim[x.s]; const r = s.rnd;
      if (s.regimeLeft-- <= 0) {
        const k = r();
        s.mu = k < 0.35 ? s.vol * 0.004 : k < 0.7 ? -s.vol * 0.004 : 0;
        if (k > 0.985) s.mu = (r() < 0.5 ? -1 : 1) * s.vol * 0.05; // импульс
        s.regimeLeft = Math.abs(s.mu) > s.vol * 0.02 ? 8 + r() * 16 : 60 + r() * 240;
      }
      s.sigma = Math.max(s.vol * 0.5, Math.min(s.vol * 2.5, s.sigma * 0.995 + s.vol * 0.005 + (Math.abs(gauss(r)) - 0.8) * s.vol * 0.03));
      const ret = s.mu + gauss(r) * s.sigma * 0.09;
      const prev = s.p;
      s.p = Math.max(1e-6, s.p * (1 + ret));
      s.high = Math.max(s.high, s.p); s.low = Math.min(s.low, s.p);
      s.qvol += Math.abs(ret) * s.p * 2000 * (x.s === 'BTCUSDT' ? 50 : 10);
      this.tickers[x.s] = this.simTicker(x.s);
      // 1m свечи
      if (s.m1) {
        const t = Math.floor(now / 60e3) * 60e3;
        const last = s.m1[s.m1.length - 1];
        const v = (s.qvol / 1440 / s.p) / 120 * (0.3 + r() * 1.4);
        if (last.t === t) { last.h = Math.max(last.h, s.p); last.l = Math.min(last.l, s.p); last.c = s.p; last.v += v; }
        else { s.m1.push({ t, o: prev, h: Math.max(prev, s.p), l: Math.min(prev, s.p), c: s.p, v }); if (s.m1.length > 8000) s.m1.shift(); }
      }
      this.price(x.s, Math.max(prev, s.p), Math.min(prev, s.p), s.p);
      if (x.s === this.sym && r() < 0.9) {
        const n = 1 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) this.trades = [{ p: s.p * (1 + (r() - 0.5) * s.vol * 0.1), q: ((s.qvol / s.p) / 60000) * (0.05 + r() * r() * 4), t: now, sell: ret < 0 ? r() < 0.7 : r() < 0.3 }, ...this.trades].slice(0, 40);
      }
    }
    const s = this.sim[this.sym];
    if (s && s.m1) {
      const ms = TFS[this.tf]; const t = Math.floor(now / ms) * ms;
      const last = this.candles[this.candles.length - 1];
      const m1last = s.m1[s.m1.length - 1];
      if (last && last.t === t) {
        this.candles = [...this.candles.slice(0, -1), { ...last, h: Math.max(last.h, s.p), l: Math.min(last.l, s.p), c: s.p, v: last.v + m1last.v * 0.01 }];
      } else {
        this.candles = [...this.candles.slice(-299), { t, o: last ? last.c : s.p, h: s.p, l: s.p, c: s.p, v: m1last.v }];
      }
      this.makeBook();
    }
    this.emit();
  }

  reconnect() {
    clearInterval(this.simTimer);
    this.mode = 'connecting'; this.sim = {};
    this.tryLive();
  }
}

export const market = new Market();
