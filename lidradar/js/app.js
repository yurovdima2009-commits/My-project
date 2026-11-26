// ЛидРадар — поиск клиентов, база, рассылка и демо-сайты. Всё хранится в браузере (localStorage).
(() => {
'use strict';

// ================= Утилиты =================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;
const DAY = 864e5;
let toastT;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
const fmtDate = ts => ts ? new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '';
const fmtDT = ts => new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const todayKey = () => new Date().toISOString().slice(0, 10);
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); };
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Скопировано'); return true; }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
    ta.remove(); toast(ok ? 'Скопировано' : 'Не удалось скопировать — выделите текст вручную'); return ok;
  }
}
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const ICON = {
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.2z"/></svg>',
  tg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.6 18.8 19c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-1 .5l.3-4.7 8.6-7.8c.4-.3-.1-.5-.6-.2L7 13l-4.6-1.4c-1-.3-1-1 .2-1.5l17.9-6.9c.8-.3 1.6.2 1.4 1.4z"/></svg>',
  vb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3c5 0 8 2 8 7.5S17 18 12 18l-4 3v-3.5C5 16.5 4 14 4 10.5 4 5 7 3 12 3z"/><path d="M10 8c0 2.5 1.5 4.5 4 5" stroke-linecap="round"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  vk: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 18c-6 0-9.5-4.1-9.6-11h3c.1 5 2.3 7.2 4.1 7.6V7h2.8v4.4c1.8-.2 3.6-2.2 4.2-4.4h2.8c-.5 2.7-2.4 4.7-3.8 5.5 1.4.7 3.6 2.4 4.4 5.5h-3.1c-.6-2-2.3-3.6-4.5-3.8V18H13z"/></svg>',
  ph: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
  web: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
};

// ================= Состояние =================
const KEY = 'lr_state_v1';
const DEFAULT_STATE = () => ({
  settings: { myName: '', offer: 'сайт-меню с заказом в WhatsApp', price: '5 000 ₽', myLink: '', apiKey: '', model: 'claude-opus-5-5', demoBase: '' },
  cities: ['Хабаровск'], cats: ['cafe', 'coffee'], words: [], openSphere: 'food',
  geo: {}, results: [], leads: {}, stop: {},
  templates: JSON.parse(JSON.stringify(window.DEFAULT_TEMPLATES)), tplId: 't1',
  autoTpl: { none: 't1', social: 't5', site: 't6' }, // какой шаблон подставлять: нет сайта / только соцсети / есть сайт
  demos: {}, sentLog: {},
  ui: { view: 'search', site: 'all', contact: 'all', hideChains: true, hideBase: false, sort: 'score', city: '', q: '', baseStatus: '', baseQ: '', mapSrc: 'results' },
});
let S;
try { S = Object.assign(DEFAULT_STATE(), JSON.parse(localStorage.getItem(KEY) || (window.LR_PRESET ? JSON.stringify(window.LR_PRESET) : '{}'))); } catch (e) { S = DEFAULT_STATE(); }
S.settings = Object.assign(DEFAULT_STATE().settings, S.settings);
S.ui = Object.assign(DEFAULT_STATE().ui, S.ui);
// Добавляем новые стандартные шаблоны тем, у кого приложение уже было установлено
window.DEFAULT_TEMPLATES.forEach(t => { if (!S.templates.some(x => x.id === t.id)) S.templates.push(JSON.parse(JSON.stringify(t))); });
S.autoTpl = Object.assign({ none: 't1', social: 't5', site: 't6' }, S.autoTpl);
const save = debounce(() => {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Память браузера переполнена. Очистите старые результаты поиска в «Настройках».', 5000); }
}, 250);
const saveNow = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
window.addEventListener('beforeunload', saveNow);

// ================= Телефоны и каналы связи =================
function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  if (d.length === 10 && d[0] === '9') d = '7' + d;
  return d;
}
const isMobile = d => /^79\d{9}$/.test(d) || /^380\d{9}$/.test(d) || /^375(25|29|33|44)\d{7}$/.test(d) || /^77\d{9}$/.test(d);
const handleOf = s => String(s || '').trim().replace(/^https?:\/\/(www\.)?(instagram\.com|vk\.com|t\.me|telegram\.me)\//i, '').replace(/^@/, '').split(/[/?#]/)[0];
function channels(lead) {
  const d = normPhone(lead.phone), mob = isMobile(d);
  const waNum = normPhone(lead.whatsapp) || (mob ? d : '');
  return {
    phone: d ? { href: 'tel:+' + d, label: lead.phone } : null,
    wa: waNum ? { href: 'https://wa.me/' + waNum, num: waNum, sure: !!lead.whatsapp || mob } : (d ? { href: 'https://wa.me/' + d, num: d, sure: false } : null),
    tg: lead.telegram ? { href: 'https://t.me/' + handleOf(lead.telegram), label: '@' + handleOf(lead.telegram), sure: true } : (d ? { href: 'https://t.me/+' + d, label: 'по номеру', sure: mob } : null),
    vb: d ? { href: 'viber://chat?number=%2B' + d, label: 'по номеру', sure: mob } : null,
    ig: lead.instagram ? { href: 'https://instagram.com/' + handleOf(lead.instagram), label: '@' + handleOf(lead.instagram) } : null,
    vk: lead.vk ? { href: 'https://vk.com/' + handleOf(lead.vk), label: handleOf(lead.vk) } : null,
    web: lead.website ? { href: /^https?:/.test(lead.website) ? lead.website : 'https://' + lead.website, label: lead.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') } : null,
  };
}

// ================= Поиск по карте (OpenStreetMap) =================
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const CAT_INDEX = {}; window.SPHERES.forEach(sp => sp.cats.forEach(c => { if (!CAT_INDEX[c.id]) CAT_INDEX[c.id] = { ...c, sphere: sp.id }; }));
const parseFilter = f => [...f.matchAll(/\["([^"]+)"(?:\s*(=|~|!=)\s*"([^"]*)"(\s*,\s*i)?)?\]/g)].map(m => ({ k: m[1], op: m[2], v: m[3], i: !!m[4] }));
const matchFilter = (tags, conds) => conds.every(c => {
  const val = tags[c.k];
  if (!c.op) return val != null;
  if (val == null) return c.op === '!=';
  if (c.op === '=') return val === c.v;
  if (c.op === '!=') return val !== c.v;
  try { return new RegExp(c.v, c.i ? 'i' : '').test(val); } catch (e) { return false; }
});
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\"]/g, '\\$&');

async function geocode(city) {
  if (S.geo[city]) return S.geo[city];
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&featureType=settlement&accept-language=ru&q=${enc(city)}`);
  if (!r.ok) throw new Error('геокодер недоступен');
  const j = await r.json();
  if (!j.length) throw new Error(`город «${city}» не найден`);
  const g = j[0];
  const area = g.osm_type === 'relation' ? 3600000000 + Number(g.osm_id) : g.osm_type === 'way' ? 2400000000 + Number(g.osm_id) : null;
  const bb = g.boundingbox.map(Number); // [юг, север, запад, восток]
  S.geo[city] = { area, bbox: [bb[0], bb[2], bb[1], bb[3]], lat: +g.lat, lon: +g.lon, name: g.name || city };
  save();
  return S.geo[city];
}

async function overpass(q) {
  // Спрашиваем все серверы сразу и берём первый нормальный ответ: какой-нибудь из них почти всегда свободен
  const ctrls = OVERPASS.map(() => new AbortController());
  const timer = setTimeout(() => ctrls.forEach(c => c.abort()), 100000);
  const tries = OVERPASS.map(async (url, i) => {
    const r = await fetch(url, { method: 'POST', body: 'data=' + enc(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrls[i].signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j.remark && /runtime error|timed out|out of memory/i.test(j.remark) && !(j.elements || []).length) throw new Error(j.remark);
    return { j, i };
  });
  try {
    const { j, i } = await Promise.any(tries);
    ctrls.forEach((c, k) => { if (k !== i) c.abort(); });
    return j;
  } catch (e) {
    throw new Error('серверы карты сейчас перегружены — попробуйте через минуту');
  } finally { clearTimeout(timer); }
}

function normalizeEl(el, city, cats, words) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  if (lat == null || !t.name) return null;
  let cat = null;
  for (const c of cats) if (c.q.some(f => matchFilter(t, parseFilter(f)))) { cat = c; break; }
  let catLabel = cat?.label, sphere = cat?.sphere;
  if (!cat) {
    const w = words.find(w => new RegExp(reEsc(w), 'i').test(t.name));
    catLabel = w ? w[0].toUpperCase() + w.slice(1) + '…' : 'Другое'; sphere = 'other';
  }
  let website = t.website || t['contact:website'] || t.url || '';
  let instagram = t['contact:instagram'] || t.instagram || '';
  let vk = t['contact:vk'] || t.vk || '';
  let telegram = t['contact:telegram'] || t.telegram || '';
  if (/instagram\.com/i.test(website)) { instagram ||= website; website = ''; }
  else if (/vk\.com|vkontakte/i.test(website)) { vk ||= website; website = ''; }
  else if (/t\.me\//i.test(website)) { telegram ||= website; website = ''; }
  else if (/taplink|linktr|wa\.me|facebook\.com|ok\.ru|2gis|yandex\.ru\/maps/i.test(website)) website = '';
  const phones = [t.phone, t['contact:phone'], t['contact:mobile'], t.mobile].filter(Boolean).join(';');
  const street = t['addr:street'], hn = t['addr:housenumber'];
  return {
    id: el.type[0] + el.id, name: t.name.trim(), city, cat: catLabel, catId: cat?.id || 'custom', sphere,
    lat, lon, addr: street ? street + (hn ? ', ' + hn : '') : (t['addr:full'] || ''),
    phone: phones.split(';')[0].trim(), phones,
    whatsapp: t['contact:whatsapp'] || '', telegram, instagram, vk, website,
    email: t.email || t['contact:email'] || '', hours: t.opening_hours || '', cuisine: t.cuisine || '',
    brand: t.brand || (t['brand:wikidata'] ? t.name : ''),
  };
}

// Сайт: OpenStreetMap знает далеко не про все сайты, поэтому «нет на карте» = «не указан», пока не проверим
function siteOf(l) {
  if (l.website || l.check?.site === 'has') return 'site';
  return (l.instagram || l.vk || l.telegram) ? 'social' : 'none';
}
const isChecked = l => !!l.check;
function scoreLead(l, chainNames) {
  const site = siteOf(l);
  const d = normPhone(l.phone);
  if (chainNames) l.chainByName = chainNames.has(l.name.toLowerCase());
  const chain = !!l.brand || !!l.chainByName;
  let s = 0;
  if (site === 'none') s += isChecked(l) ? 42 : 26; else if (site === 'social') s += isChecked(l) ? 36 : 28; else s += 5;
  if (d) s += isMobile(d) ? 25 : 15;
  if (l.instagram || l.vk || l.telegram || l.whatsapp) s += 12;
  if (l.addr) s += 6; if (l.hours) s += 6; if (l.email) s += 4;
  if (chain) s -= 45;
  return { siteStatus: site, chain, score: Math.max(0, Math.min(100, s)) };
}

let searching = null;
async function runSearch() {
  if (searching) return;
  const cats = S.cats.map(id => CAT_INDEX[id]).filter(Boolean);
  const words = S.words.slice();
  if (!S.cities.length) return toast('Добавьте хотя бы один город');
  if (!cats.length && !words.length) return toast('Выберите категории или впишите своё слово');
  searching = { text: 'Готовлю поиск…' }; renderView();
  const found = []; const errors = [];
  for (const city of S.cities) {
    try {
      searching.text = `Ищу город «${city}» на карте…`; updateProgress();
      const g = await geocode(city);
      // поиск по прямоугольнику вокруг города: на серверах он в разы быстрее, чем по границе города
      const scope = `(${g.bbox.join(',')})`;
      const lines = [];
      cats.forEach(c => c.q.forEach(f => lines.push(`nwr${f}["name"]${scope};`)));
      words.forEach(w => ['amenity', 'shop', 'office', 'craft', 'leisure', 'tourism'].forEach(k => lines.push(`nwr["name"~"${reEsc(w)}",i]["${k}"]${scope};`)));
      const q = `[out:json][timeout:90];(${lines.join('')});out center tags;`;
      searching.text = `Собираю места: ${city} (${cats.length + words.length} категорий)…`; updateProgress();
      const j = await overpass(q);
      (j.elements || []).forEach(el => { const l = normalizeEl(el, city, cats, words); if (l) found.push(l); });
    } catch (e) { errors.push(`${city}: ${e.message}`); }
  }
  // убираем дубли, отмечаем сети
  const uniq = new Map(); found.forEach(l => { if (!uniq.has(l.id)) uniq.set(l.id, l); });
  const counts = {}; uniq.forEach(l => { const k = l.name.toLowerCase(); counts[k] = (counts[k] || 0) + 1; });
  const chainNames = new Set(Object.keys(counts).filter(k => counts[k] >= 3));
  const ids = [];
  uniq.forEach(l => {
    Object.assign(l, scoreLead(l, chainNames));
    const old = S.leads[l.id];
    S.leads[l.id] = old ? Object.assign({}, old, l, pickCrm(old)) : Object.assign(l, { status: 'new', added: Date.now() });
    if (old?.check) { const n = S.leads[l.id]; if (old.check.url && !n.website) n.website = old.check.url; ['instagram', 'vk', 'telegram', 'phone'].forEach(k => { if (!n[k] && old[k]) n[k] = old[k]; }); Object.assign(n, scoreLead(n)); }
    ids.push(l.id);
  });
  S.results = ids;
  // чистим старые лиды, которых нет ни в базе, ни в результатах, ни в демо
  const keep = new Set(ids);
  Object.keys(S.leads).forEach(id => { const l = S.leads[id]; if (!keep.has(id) && !l.inBase && !S.demos[id]) delete S.leads[id]; });
  searching = null; selected.clear(); page = 1; if (matchMedia('(max-width: 860px)').matches) configCollapsed = true;
  save(); renderView(); updateBadges();
  if (errors.length && !ids.length) toast('Не получилось: ' + errors.join('; '), 6000);
  else if (errors.length) toast(`Найдено ${ids.length}. Ошибки: ${errors.join('; ')}`, 6000);
  else toast(`Найдено мест: ${ids.length}`);
}
const CRM_FIELDS = ['check', 'inBase', 'status', 'note', 'person', 'nextDate', 'history', 'demoLink', 'msg', 'label', 'added', 'updated', 'lastContact', 'myPhone'];
const pickCrm = o => { const r = {}; CRM_FIELDS.forEach(k => { if (o[k] !== undefined) r[k] = o[k]; }); return r; };
function updateProgress() { const el = $('#progressText'); if (el && searching) el.textContent = searching.text; }

// ================= CRM-действия =================
function setStatus(id, status) {
  const l = S.leads[id]; if (!l || l.status === status) return;
  l.status = status; l.updated = Date.now(); l.inBase = true;
  (l.history ||= []).push({ t: Date.now(), s: status });
  if (status === 'sent') { l.lastContact = Date.now(); if (!l.nextDate || l.nextDate < Date.now()) l.nextDate = Date.now() + 3 * DAY; }
  if (status === 'client' || status === 'rejected') l.nextDate = null;
  save(); updateBadges();
}
function toBase(id, on = true) {
  const l = S.leads[id]; if (!l) return;
  l.inBase = on; if (on && !l.status) l.status = 'new'; l.updated = Date.now();
  if (on) (l.history ||= []).push({ t: Date.now(), s: 'в базу' });
  save(); updateBadges();
}
function toStop(id) {
  S.stop[id] = { name: S.leads[id]?.name || id, t: Date.now() };
  if (S.leads[id]) S.leads[id].inBase = false;
  save(); updateBadges();
}
function fillTemplate(text, lead) {
  const st = S.settings;
  return String(text || '')
    .replaceAll('{название}', lead.name || '')
    .replaceAll('{город}', lead.city || '')
    .replaceAll('{категория}', (lead.cat || '').toLowerCase())
    .replaceAll('{адрес}', lead.addr || '')
    .replaceAll('{демо}', lead.demoLink || '[ссылка на демо появится после «Сделать демо»]')
    .replaceAll('{моё_имя}', st.myName || '[ваше имя]')
    .replaceAll('{цена}', st.price || '')
    .replaceAll('{оффер}', st.offer || '');
}
const currentTpl = () => S.templates.find(t => t.id === S.tplId) || S.templates[0];
// Шаблон для клиента: выбранный вручную → по наличию сайта → основной
const leadTpl = l => S.templates.find(t => t.id === l.tplId) || S.templates.find(t => t.id === S.autoTpl[l.siteStatus || 'none']) || currentTpl();
const leadMessage = l => l.msg || fillTemplate(leadTpl(l)?.text, l);
const tplOptions = l => S.templates.map(t => `<option value="${t.id}" ${t.id === leadTpl(l)?.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('');

// ================= Проверка сайтов =================
let checking = null; const checkingIds = new Set();
const NOT_A_SITE = /2gis|yandex\.|google\.|goo\.gl|zoon|restoclub|tripadvisor|flamp|delivery-club|eda\.yandex|market-delivery|taplink|linktr|instagram|vk\.com|t\.me|wa\.me|ok\.ru|facebook|tiktok|youtube|avito|hh\.ru|rusprofile|list-org|spark|yell\.ru|orgpage|spravker/i;
function applyCheck(l, r, by) {
  let url = typeof r.website === 'string' ? r.website.trim() : '';
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  if (url && NOT_A_SITE.test(url)) url = '';
  l.check = { site: url ? 'has' : 'none', url: url || null, at: Date.now(), by, sure: r.sure !== false, note: String(r.note || '').slice(0, 160) };
  if (url) l.website = url;
  const clean = v => (typeof v === 'string' && v.trim() && !/^null$/i.test(v.trim())) ? v.trim() : '';
  if (!l.instagram && clean(r.instagram)) l.instagram = clean(r.instagram);
  if (!l.vk && clean(r.vk)) l.vk = clean(r.vk);
  if (!l.telegram && clean(r.telegram)) l.telegram = clean(r.telegram);
  if (!l.phone && clean(r.phone)) { l.phone = clean(r.phone); l.phones = l.phone; }
  Object.assign(l, scoreLead(l));
  l.updated = Date.now();
}
function setSiteManual(id, url) {
  const l = S.leads[id]; if (!l) return;
  if (url === null) applyCheck(l, { website: null }, 'manual');
  else { l.website = /^https?:/i.test(url) ? url : 'https://' + url; applyCheck(l, { website: l.website }, 'manual'); }
  save(); refreshAfterLeadChange();
}
async function checkLeads(ids) {
  ids = ids.filter(id => S.leads[id]);
  if (!ids.length) return toast('Некого проверять');
  if (!S.settings.apiKey) return openCheckModal(ids.slice(0, 25));
  if (checking) return toast('Проверка уже идёт');
  checking = { done: 0, total: ids.length, found: 0 };
  ids.forEach(id => checkingIds.add(id)); renderView();
  let errors = 0, lastErr = '';
  const queue = ids.slice();
  async function worker() {
    while (queue.length) {
      const id = queue.shift(); const l = S.leads[id];
      try {
        const text = await window.AI.ask(window.AI.checkPrompt(l), { apiKey: S.settings.apiKey, model: S.settings.model, maxTokens: 8000, webSearch: true });
        applyCheck(l, window.AI.extractJson(text), 'ai');
        if (l.check.site === 'has') checking.found++;
      } catch (e) { errors++; lastErr = e.message; if (/ключ|доступа|не найдена/i.test(e.message)) queue.length = 0; }
      checkingIds.delete(id); checking.done++; save();
      if (S.ui.view === 'search') renderView(); if (drawerId === id) renderDrawer();
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  const c = checking; checking = null; checkingIds.clear(); renderView(); if (drawerId) renderDrawer();
  toast(errors ? `Проверено ${c.done - errors} из ${c.total}. Ошибка: ${lastErr}` : `Проверено ${c.total}: сайт нашёлся у ${c.found}`, 6000);
}
let checkModal = null;
function openCheckModal(ids) { checkModal = { ids, answer: '' }; renderCheckModal(); }
function renderCheckModal() {
  if (!checkModal) { $('#modalRoot').innerHTML = ''; return; }
  const leads = checkModal.ids.map(id => S.leads[id]).filter(Boolean);
  $('#modalRoot').innerHTML = `<div class="modal" id="modal"><div class="modal-box small">
    <div class="mleft" style="border:0">
      <div class="row" style="justify-content:space-between;flex-wrap:nowrap"><h2>Проверить сайты: ${leads.length}</h2><button class="btn sm" data-act="cmClose" aria-label="Закрыть">✕</button></div>
      <div class="muted">Бесплатно через claude.ai: Claude сам поищет каждое заведение в интернете. Чтобы проверять в один клик, добавьте API-ключ в «Настройках».</div>
      <div class="chips">${leads.slice(0, 12).map(l => `<span class="chip">${esc(l.name)}</span>`).join('')}${leads.length > 12 ? `<span class="chip">и ещё ${leads.length - 12}</span>` : ''}</div>
      <div class="step"><div class="step-h"><span class="n">1</span>Скопируйте запрос и отправьте его в claude.ai</div>
        <div class="row"><button class="btn primary" data-act="cmCopy">Скопировать запрос</button><a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">Открыть claude.ai</a></div>
        <div class="hint">В claude.ai должен быть включён поиск в интернете (Web search) — значок в поле ввода.</div></div>
      <div class="step"><div class="step-h"><span class="n">2</span>Вставьте ответ Claude сюда</div>
        <textarea class="input" id="cmAnswer" rows="6" placeholder='[{"id": "n123", "website": …}]'>${esc(checkModal.answer)}</textarea>
        <button class="btn primary" data-act="cmApply">Применить</button></div>
    </div></div></div>`;
}
function applyBatchAnswer(text) {
  const arr = window.AI.extractJsonArray(text); let n = 0, found = 0;
  arr.forEach(r => { const l = S.leads[String(r.id || '').trim()]; if (l) { applyCheck(l, r, 'claude.ai'); n++; if (l.check.site === 'has') found++; } });
  save(); return { n, found };
}

// ================= Навигация =================
const view = $('#view');
let page = 1; const PAGE = 120; let configCollapsed = false;
const selected = new Set();
function go(name) { S.ui.view = name; save(); renderView(); }
function renderView() {
  $$('.nav[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === S.ui.view));
  if (bigMap) { bigMap.remove(); bigMap = null; }
  ({ search: viewSearch, base: viewBase, outreach: viewOutreach, map: viewMap, demos: viewDemos, templates: viewTemplates, settings: viewSettings }[S.ui.view] || viewSearch)();
}
function updateBadges() {
  const base = Object.values(S.leads).filter(l => l.inBase).length;
  const q = Object.values(S.leads).filter(l => l.inBase && l.status === 'queue').length;
  const b = $('#baseBadge'), qb = $('#queueBadge');
  b.hidden = !base; b.textContent = base; qb.hidden = !q; qb.textContent = q;
}

// ================= Вид: Поиск =================
function filteredResults() {
  const u = S.ui, q = u.q.trim().toLowerCase();
  let arr = S.results.map(id => S.leads[id]).filter(l => l && !S.stop[l.id]);
  if (u.city) arr = arr.filter(l => l.city === u.city);
  if (u.site === 'nosite') arr = arr.filter(l => l.siteStatus !== 'site');
  else if (u.site === 'verified') arr = arr.filter(l => l.siteStatus !== 'site' && isChecked(l));
  else if (u.site === 'unchecked') arr = arr.filter(l => l.siteStatus !== 'site' && !isChecked(l));
  else if (u.site !== 'all') arr = arr.filter(l => l.siteStatus === u.site);
  if (u.contact === 'phone') arr = arr.filter(l => l.phone);
  if (u.contact === 'mobile') arr = arr.filter(l => isMobile(normPhone(l.phone)) || l.whatsapp);
  if (u.contact === 'social') arr = arr.filter(l => l.instagram || l.vk || l.telegram);
  if (u.contact === 'any') arr = arr.filter(l => l.phone || l.instagram || l.vk || l.telegram || l.email);
  if (u.hideChains) arr = arr.filter(l => !l.chain);
  if (u.hideBase) arr = arr.filter(l => !l.inBase);
  if (q) arr = arr.filter(l => [l.name, l.addr, l.cat, l.phone].join(' ').toLowerCase().includes(q));
  const by = { score: (a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ru'), name: (a, b) => a.name.localeCompare(b.name, 'ru'), cat: (a, b) => a.cat.localeCompare(b.cat, 'ru') || b.score - a.score };
  return arr.sort(by[u.sort] || by.score);
}
function siteTag(l) {
  if (l.chain) return '<span class="tag chain">Сеть</span>';
  if (l.siteStatus === 'site') return '<span class="tag site">Есть сайт</span>';
  if (l.siteStatus === 'social') return isChecked(l) ? '<span class="tag social">Только соцсети ✓</span>' : '<span class="tag social unk" title="Соцсети есть, сайт не проверен">Соцсети · сайт?</span>';
  return isChecked(l) ? '<span class="tag hot">Нет сайта ✓</span>' : '<span class="tag unk" title="На карте сайт не указан. Нажмите «Проверить сайт»">Сайт не указан</span>';
}
const SPHERE_EMOJI = { food: '🍽', beauty: '💅', med: '🩺', pets: '🐾', auto: '🚗', sport: '🏋️', edu: '🎓', kids: '🧸', fun: '🎳', events: '📸', hotels: '🏨', home: '🛠', services: '🧺', b2b: '💼', shops: '🛍', other: '📍' };
const CAT_EMOJI = { cafe: '☕', coffee: '☕', restaurant: '🍽', fastfood: '🍔', pizza: '🍕', shawarma: '🌯', sushi: '🍣', burger: '🍔', bar: '🍸', bakery: '🥐', confect: '🧁', barber: '💈', hair: '✂️', nails: '💅', tattoo: '🖋', massage: '💆', florist: '💐', florist2: '💐', dentist: '🦷', vet: '🐾', vet2: '🐾', carwash: '🫧', fitness: '🏋️', hotel: '🏨', photo: '📸', hookah: '💨' };
const leadEmoji = l => CAT_EMOJI[l.catId] || SPHERE_EMOJI[l.sphere] || '📍';
const scoreRing = l => `<span class="ring ${l.score >= 60 ? 'hi' : l.score >= 40 ? 'mid' : ''}" style="--p:${l.score}" title="Оценка ${l.score} из 100: насколько это перспективный клиент"><b class="num">${l.score}</b></span>`;
function chIcons(l) {
  const c = channels(l);
  return [
    c.phone && `<a class="ch ph" href="${esc(c.phone.href)}" title="Позвонить ${esc(c.phone.label)}" data-stop>${ICON.ph}</a>`,
    c.wa && c.wa.sure && `<a class="ch wa" href="${esc(c.wa.href)}" target="_blank" rel="noopener" title="WhatsApp" data-stop>${ICON.wa}</a>`,
    c.tg && c.tg.sure && `<a class="ch tg" href="${esc(c.tg.href)}" target="_blank" rel="noopener" title="Telegram" data-stop>${ICON.tg}</a>`,
    c.ig && `<a class="ch ig" href="${esc(c.ig.href)}" target="_blank" rel="noopener" title="Instagram" data-stop>${ICON.ig}</a>`,
    c.vk && `<a class="ch vk" href="${esc(c.vk.href)}" target="_blank" rel="noopener" title="ВКонтакте" data-stop>${ICON.vk}</a>`,
    c.web && `<a class="ch" href="${esc(c.web.href)}" target="_blank" rel="noopener" title="Сайт" data-stop>${ICON.web}</a>`,
  ].filter(Boolean).join('');
}
function leadCard(l) {
  const st = window.STATUSES[l.status] || window.STATUSES.new;
  return `<article class="lead ${l.inBase ? 'inbase' : ''} ${drawerId === l.id ? 'sel' : ''} ${checkingIds.has(l.id) ? 'checking' : ''}" data-open="${esc(l.id)}" style="--status:${st.color}">
    <div class="lead-top"><input type="checkbox" data-check="${esc(l.id)}" ${selected.has(l.id) ? 'checked' : ''} aria-label="Выбрать">${siteTag(l)}<span style="flex:1"></span>${scoreRing(l)}</div>
    <div class="lead-id"><span class="avatar s-${esc(l.sphere || 'other')}">${leadEmoji(l)}</span><div style="min-width:0"><h3>${esc(l.name)}</h3>
    <div class="meta">${esc(l.cat)}${l.addr ? ' · ' + esc(l.addr) : ' · ' + esc(l.city)}</div></div></div>
    <div class="lead-bottom">${chIcons(l) || '<span class="muted" style="font-size:12px">контактов на карте нет</span>'}<span class="grow"></span>
      ${l.inBase ? `<span class="spill" style="font-size:11px"><i style="background:${st.color}"></i>${st.label}</span>` : `<button class="btn sm" data-act="tobase" data-id="${esc(l.id)}">+ В базу</button>`}
    </div></article>`;
}
function summaryTiles() {
  const all = S.results.map(id => S.leads[id]).filter(l => l && !S.stop[l.id] && !(S.ui.hideChains && l.chain));
  const n = f => all.filter(f).length;
  const tiles = [
    ['all', 'Всего', all.length, 'var(--text)'],
    ['verified', 'Нет сайта ✓', n(l => l.siteStatus !== 'site' && isChecked(l)), 'var(--accent)'],
    ['unchecked', 'Не проверено', n(l => l.siteStatus !== 'site' && !isChecked(l)), 'var(--faint)'],
    ['social', 'Соцсети', n(l => l.siteStatus === 'social'), 'var(--violet)'],
    ['site', 'Есть сайт', n(l => l.siteStatus === 'site'), 'var(--good)'],
  ];
  const unchecked = all.filter(l => l.siteStatus !== 'site' && !isChecked(l)).length;
  return `<div class="tiles">${tiles.map(([k, label, v, c]) => `<button class="tile ${S.ui.site === k ? 'on' : ''}" data-act="siteFilter" data-v="${k}" style="--c:${c}"><b class="num">${v}</b><span>${label}</span></button>`).join('')}</div>
  ${unchecked ? `<div class="checkbar"><span>⚠️ На карте указаны не все сайты. Перед тем как писать, проверьте — есть ли сайт на самом деле.</span><button class="btn sm primary" data-act="checkTop" ${checking ? 'disabled' : ''}>🔎 Проверить ${Math.min(20, unchecked)} лучших</button></div>` : ''}`;
}
function viewSearch() {
  const u = S.ui;
  const arr = searching ? [] : filteredResults();
  const cities = [...new Set(S.results.map(id => S.leads[id]?.city).filter(Boolean))];
  const sp = window.SPHERES.find(s => s.id === S.openSphere);
  const selCount = S.cats.length + S.words.length;
  view.innerHTML = `
  <div class="topbar"><h1>Поиск клиентов<span class="sub">${S.results.length ? `найдено ${S.results.length}` : 'по карте OpenStreetMap'}</span></h1>
    <button class="btn primary" data-act="search" ${searching ? 'disabled' : ''}>${searching ? 'Ищу…' : 'Найти'}</button></div>
  <div class="search-layout">
    <div class="config ${configCollapsed && S.results.length ? 'collapsed' : ''}" id="config">
      <div class="config-head mobile-only" style="justify-content:space-between;width:100%"><b>Настройки поиска</b><button class="btn sm" data-act="toggleConfig">${configCollapsed && S.results.length ? 'Развернуть' : 'Свернуть'}</button></div>
      <div>
        <div class="label">Города</div>
        <div class="chips">${S.cities.map(c => `<button class="chip on" data-act="rmCity" data-v="${esc(c)}">${esc(c)} <span class="x">✕</span></button>`).join('') || '<span class="muted">Добавьте город</span>'}</div>
        <form class="addline" data-form="city"><input class="input" id="cityIn" placeholder="Например, Владивосток" autocomplete="off"><button class="btn" type="submit">+</button></form>
      </div>
      <div>
        <div class="label">Категории <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">выбрано ${selCount}</span></div>
        <div class="chips" style="margin-bottom:10px">${S.cats.map(id => CAT_INDEX[id] ? `<button class="chip on" data-act="toggleCat" data-v="${id}">${esc(CAT_INDEX[id].label)} <span class="x">✕</span></button>` : '').join('')}${S.words.map(w => `<button class="chip on" data-act="rmWord" data-v="${esc(w)}">«${esc(w)}» <span class="x">✕</span></button>`).join('')}</div>
        <form class="addline" data-form="word"><input class="input" id="wordIn" placeholder="Своё слово в названии, например «пицц»" autocomplete="off"><button class="btn" type="submit">+</button></form>
        <div class="hint" style="margin-top:6px">Своё слово ищется в названиях: «шаурм» найдёт «Шаурма №1» и «Шаурмичная».</div>
        <div class="chips" style="margin-top:6px">${window.SPHERES.map(s => { const n = s.cats.filter(c => S.cats.includes(c.id)).length; return `<button class="chip ${S.openSphere === s.id ? 'on' : ''}" data-act="sphere" data-v="${s.id}">${esc(s.label)}${n ? ` <span class="count">${n}</span>` : ''}</button>`; }).join('')}</div>
        ${sp ? `<div class="sphere-cats chips">${sp.cats.map(c => `<button class="chip ${S.cats.includes(c.id) ? 'on' : 'add'}" data-act="toggleCat" data-v="${c.id}">${S.cats.includes(c.id) ? '✓' : '+'} ${esc(c.label)}</button>`).join('')}</div>` : ''}
      </div>
      <div class="hint">Данные берутся из открытой карты OpenStreetMap. Сайты и телефоны там указаны не у всех — поэтому у каждого места есть кнопка «Проверить сайт»: Claude поищет в интернете и найдёт сайт, телефон и соцсети.</div>
    </div>
    <div class="results">
      ${searching ? `<div class="progress"><div class="spin"></div><span id="progressText">${esc(searching.text)}</span></div>` : ''}
      ${S.results.length ? `<div class="filters">
        <input class="input grow" id="fq" placeholder="Поиск по найденным…" value="${esc(u.q)}">
        ${cities.length > 1 ? `<select class="input" data-ui="city"><option value="">Все города</option>${cities.map(c => `<option ${u.city === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>` : ''}
        <select class="input" data-ui="site">${[['all', 'Любой сайт'], ['nosite', 'Без сайта (все)'], ['verified', 'Нет сайта — проверено ✓'], ['unchecked', 'Сайт не проверен'], ['social', 'Только соцсети'], ['site', 'Есть сайт']].map(([v, n]) => `<option value="${v}" ${u.site === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <select class="input" data-ui="contact"><option value="all">Любые контакты</option><option value="any" ${u.contact === 'any' ? 'selected' : ''}>Есть хоть какой-то</option><option value="phone" ${u.contact === 'phone' ? 'selected' : ''}>С телефоном</option><option value="mobile" ${u.contact === 'mobile' ? 'selected' : ''}>С мобильным</option><option value="social" ${u.contact === 'social' ? 'selected' : ''}>Есть соцсети</option></select>
        <select class="input" data-ui="sort"><option value="score">Сначала перспективные</option><option value="name" ${u.sort === 'name' ? 'selected' : ''}>По названию</option><option value="cat" ${u.sort === 'cat' ? 'selected' : ''}>По категории</option></select>
        <label class="row muted" style="font-size:12px;gap:5px"><input type="checkbox" data-uicheck="hideChains" ${u.hideChains ? 'checked' : ''}> без сетей</label>
        <label class="row muted" style="font-size:12px;gap:5px"><input type="checkbox" data-uicheck="hideBase" ${u.hideBase ? 'checked' : ''}> скрыть из базы</label>
      </div>` : ''}
      ${selected.size ? `<div class="bulkbar"><b>Выбрано: ${selected.size}</b>
        <button class="btn sm primary" data-act="bulkBase">+ В базу</button>
        <button class="btn sm" data-act="bulkQueue">В очередь рассылки</button>
        <button class="btn sm" data-act="bulkCheck">🔎 Проверить сайты</button>
        <button class="btn sm danger" data-act="bulkStop">В стоп</button>
        <button class="btn sm" data-act="bulkClear">Снять</button></div>` : ''}
      <div class="scroll">
        ${!S.results.length && !searching ? `<div class="empty"><h3>Найдём клиентов на карте</h3>Выберите города и сферы слева и нажмите «Найти». Приложение соберёт заведения с адресами, телефонами и соцсетями, отметит тех, у кого нет сайта, и оценит каждого по шкале от 0 до 100.</div>` : ''}
        ${S.results.length && !arr.length && !searching ? `<div class="empty"><h3>Под фильтры никто не подошёл</h3>Ослабьте фильтры сверху.</div>` : ''}
        ${S.results.length && !searching ? summaryTiles() : ''}
        ${checking ? `<div class="progress"><div class="spin"></div><span>Проверяю сайты: ${checking.done} из ${checking.total}…</span></div>` : ''}
        ${arr.length ? `<div class="row" style="padding:12px 16px 0;justify-content:space-between"><span class="muted num">Показано ${Math.min(arr.length, page * PAGE)} из ${arr.length}</span><button class="btn sm" data-act="selectAll">Выбрать все ${arr.length}</button></div>` : ''}
        <div class="cards">${arr.slice(0, page * PAGE).map(leadCard).join('')}</div>
        ${arr.length > page * PAGE ? `<div style="text-align:center;padding:0 0 24px"><button class="btn" data-act="more">Показать ещё</button></div>` : ''}
      </div>
    </div>
  </div>`;
  listCtx = arr.map(l => l.id);
}

// ================= Вид: База =================
function baseLeads() {
  const u = S.ui, q = u.baseQ.trim().toLowerCase();
  let arr = Object.values(S.leads).filter(l => l.inBase && !S.stop[l.id]);
  if (u.baseStatus === 'today') arr = arr.filter(l => l.nextDate && l.nextDate <= endOfToday());
  else if (u.baseStatus) arr = arr.filter(l => (l.status || 'new') === u.baseStatus);
  if (q) arr = arr.filter(l => [l.name, l.city, l.cat, l.note, l.person, l.phone].join(' ').toLowerCase().includes(q));
  return arr.sort((a, b) => (b.updated || 0) - (a.updated || 0));
}
function viewBase() {
  const all = Object.values(S.leads).filter(l => l.inBase && !S.stop[l.id]);
  const counts = {}; all.forEach(l => { const s = l.status || 'new'; counts[s] = (counts[s] || 0) + 1; });
  const due = all.filter(l => l.nextDate && l.nextDate <= endOfToday() && !['client', 'rejected'].includes(l.status));
  const arr = baseLeads();
  view.innerHTML = `
  <div class="topbar"><h1>База клиентов<span class="sub">${all.length} в работе</span></h1>
    <input class="input" id="bq" placeholder="Поиск по базе…" value="${esc(S.ui.baseQ)}" style="width:220px">
    <button class="btn" data-act="exportCsv">Выгрузить в Excel</button></div>
  <div class="scroll">
    ${due.length ? `<div class="reminder">⏰ <b>Сегодня связаться: ${due.length}</b><span class="muted">${due.slice(0, 3).map(l => esc(l.name)).join(', ')}${due.length > 3 ? '…' : ''}</span><button class="btn sm" data-act="baseStatus" data-v="today" style="margin-left:auto">Показать</button></div>` : ''}
    <div class="pipeline">
      <button class="pipe ${!S.ui.baseStatus ? 'on' : ''}" data-act="baseStatus" data-v=""><b class="num">${all.length}</b><span>Все</span></button>
      ${Object.entries(window.STATUSES).map(([k, s]) => `<button class="pipe ${S.ui.baseStatus === k ? 'on' : ''}" data-act="baseStatus" data-v="${k}"><b class="num">${counts[k] || 0}</b><span><i style="background:${s.color}"></i>${s.label}</span></button>`).join('')}
    </div>
    ${!all.length ? `<div class="empty"><h3>База пока пустая</h3>Найдите места во вкладке «Поиск» и нажимайте «+ В базу» у перспективных.</div>` :
      !arr.length ? `<div class="empty"><h3>Здесь никого</h3>Выберите другой статус.</div>` : `
    <div class="table-wrap"><table class="table"><thead><tr><th>Клиент</th><th>Статус</th><th class="hide-m">Связь</th><th class="hide-m">Напомнить</th><th class="hide-m">Демо</th><th class="hide-m">Заметка</th></tr></thead><tbody>
    ${arr.map(l => { const st = window.STATUSES[l.status || 'new']; const overdue = l.nextDate && l.nextDate <= endOfToday();
      return `<tr data-open="${esc(l.id)}"><td><div class="name">${esc(l.name)}</div><div class="small">${esc(l.city)} · ${esc(l.cat)}</div></td>
      <td><span class="spill"><i style="background:${st.color}"></i>${st.label}</span></td>
      <td class="hide-m"><div class="row" style="gap:4px;flex-wrap:nowrap">${chIcons(l)}</div></td>
      <td class="hide-m small" style="${overdue ? 'color:var(--accent);font-weight:700' : ''}">${l.nextDate ? fmtDate(l.nextDate) : '—'}</td>
      <td class="hide-m">${l.demoLink ? '<span class="tag site">есть</span>' : '<span class="muted">—</span>'}</td>
      <td class="hide-m small" style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.note || '')}</td></tr>`; }).join('')}
    </tbody></table></div>`}
  </div>`;
  listCtx = arr.map(l => l.id);
}

// ================= Вид: Рассылка =================
let outIdx = 0;
function queueLeads() { return Object.values(S.leads).filter(l => l.inBase && l.status === 'queue' && !S.stop[l.id]).sort((a, b) => (b.score || 0) - (a.score || 0)); }
function viewOutreach() {
  const q = queueLeads();
  const sentToday = S.sentLog[todayKey()] || 0;
  if (outIdx >= q.length) outIdx = 0;
  const l = q[outIdx];
  const newInBase = Object.values(S.leads).filter(x => x.inBase && (x.status || 'new') === 'new').length;
  view.innerHTML = `
  <div class="topbar"><h1>Рассылка<span class="sub">в очереди ${q.length} · отправлено сегодня ${sentToday}</span></h1>
    ${newInBase ? `<button class="btn" data-act="queueAllNew">Добавить новых из базы (${newInBase})</button>` : ''}</div>
  <div class="scroll"><div class="outreach">
    ${!l ? `<div class="empty"><h3>Очередь пуста</h3>Отметьте клиентов в «Поиске» или «Базе» и нажмите «В очередь рассылки». Здесь вы будете проходить их по одному: сообщение уже готово, остаётся открыть мессенджер и отправить.</div>` : (() => {
      const c = channels(l); const msg = leadMessage(l);
      return `
      <div class="bar"><div style="width:${Math.round((outIdx) / q.length * 100)}%"></div></div>
      <div class="card-box stack">
        <div class="row" style="justify-content:space-between"><span class="muted num">${outIdx + 1} из ${q.length}</span><div class="row">${siteTag(l)}<span class="score ${l.score >= 60 ? 'hi' : ''}">${l.score}</span></div></div>
        <div><h2 style="margin:0 0 4px;font-size:22px">${esc(l.name)}</h2><div class="muted">${esc(l.city)} · ${esc(l.cat)}${l.addr ? ' · ' + esc(l.addr) : ''}</div></div>
        <div class="row">
          <select class="input" data-act-change="tpl" data-id="${esc(l.id)}" style="width:auto">${tplOptions(l)}</select>
          ${l.demoLink ? `<a class="btn sm" href="${esc(l.demoLink)}" target="_blank" rel="noopener">Открыть демо</a>` : `<button class="btn sm primary" data-act="demo" data-id="${esc(l.id)}">Сделать демо</button>`}
          <button class="btn sm" data-act="aiMsg" data-id="${esc(l.id)}">✨ Сделать личным</button>
          ${l.siteStatus !== 'site' && !isChecked(l) ? `<button class="btn sm" data-open="${esc(l.id)}" title="Сайт на карте не указан — проверьте в карточке">⚠️ Сайт не проверен</button>` : ''}
          ${l.msg ? `<button class="btn sm" data-act="resetMsg" data-id="${esc(l.id)}">Сбросить текст</button>` : ''}
        </div>
        <textarea class="input" id="outMsg" data-id="${esc(l.id)}" rows="9">${esc(msg)}</textarea>
        <div class="label" style="margin:0">Отправить через</div>
        <div class="bigsend">
          ${c.wa ? `<a class="chbtn ${c.wa.sure ? '' : 'off'}" data-send="wa" data-id="${esc(l.id)}" href="${esc(c.wa.href)}?text=${enc(msg)}" target="_blank" rel="noopener"><span class="ch wa">${ICON.wa}</span><span>WhatsApp<small>${c.wa.sure ? 'текст подставится' : 'похоже, городской номер'}</small></span></a>` : ''}
          ${c.tg ? `<a class="chbtn ${c.tg.sure ? '' : 'off'}" data-send="tg" data-id="${esc(l.id)}" href="${esc(c.tg.href)}" target="_blank" rel="noopener"><span class="ch tg">${ICON.tg}</span><span>Telegram<small>текст скопируется</small></span></a>` : ''}
          ${c.vb ? `<a class="chbtn ${c.vb.sure ? '' : 'off'}" data-send="vb" data-id="${esc(l.id)}" href="${esc(c.vb.href)}"><span class="ch vb">${ICON.vb}</span><span>Viber<small>текст скопируется</small></span></a>` : ''}
          ${c.ig ? `<a class="chbtn" data-send="ig" data-id="${esc(l.id)}" href="${esc(c.ig.href)}" target="_blank" rel="noopener"><span class="ch ig">${ICON.ig}</span><span>Instagram<small>${esc(c.ig.label)}</small></span></a>` : ''}
          ${c.vk ? `<a class="chbtn" data-send="vk" data-id="${esc(l.id)}" href="${esc(c.vk.href)}" target="_blank" rel="noopener"><span class="ch vk">${ICON.vk}</span><span>ВКонтакте<small>текст скопируется</small></span></a>` : ''}
          ${c.phone ? `<a class="chbtn" href="${esc(c.phone.href)}"><span class="ch ph">${ICON.ph}</span><span>Позвонить<small>${esc(c.phone.label)}</small></span></a>` : ''}
          ${!c.wa && !c.tg && !c.ig && !c.vk && !c.phone ? `<div class="muted">На карте нет контактов. <a href="https://2gis.ru/search/${enc(l.name + ' ' + l.city)}" target="_blank" rel="noopener">Найти в 2ГИС</a> или <a href="https://yandex.ru/maps/?text=${enc(l.name + ' ' + l.city)}" target="_blank" rel="noopener">Яндекс Картах</a>, потом впишите в карточке.</div>` : ''}
        </div>
        <div class="row" style="justify-content:space-between;margin-top:4px">
          <div class="row"><button class="btn" data-act="outSkip">Пропустить</button><button class="btn danger" data-act="outStop" data-id="${esc(l.id)}">В стоп</button><button class="btn" data-open="${esc(l.id)}">Карточка</button></div>
          <button class="btn primary" data-act="outSent" data-id="${esc(l.id)}">✓ Отправил, дальше</button>
        </div>
      </div>
      <div class="hint">Сообщения вы отправляете сами из своего мессенджера — так аккаунт не заблокируют за спам. Не пишите больше 20–30 новым людям в день с одного номера.</div>`; })()}
  </div></div>`;
  listCtx = q.map(x => x.id);
}

// ================= Вид: Карта =================
let bigMap = null;
// Подложка карты OpenStreetMap (бесплатно). В тёмной теме тайлы затемняются фильтром.
function addTiles(m) { L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'osm-tiles', attribution: '© OSM' }).addTo(m); }
const SITE_COLORS = { none: '#f2a93b', social: '#a77bf3', site: '#3fbf7a', chain: '#e25d5d' };
function viewMap() {
  const src = S.ui.mapSrc;
  const arr = src === 'base' ? Object.values(S.leads).filter(l => l.inBase && !S.stop[l.id]) : filteredResults();
  view.innerHTML = `
  <div class="topbar"><h1>Карта<span class="sub">${arr.length} точек</span></h1>
    <div class="chips"><button class="chip ${src !== 'base' ? 'on' : ''}" data-act="mapSrc" data-v="results">Результаты поиска</button><button class="chip ${src === 'base' ? 'on' : ''}" data-act="mapSrc" data-v="base">База</button></div></div>
  <div class="filters"><div class="legend">${src === 'base' ? Object.values(window.STATUSES).map(s => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join('') :
    `<span><i style="background:${SITE_COLORS.none}"></i>Нет сайта</span><span><i style="background:${SITE_COLORS.social}"></i>Только соцсети</span><span><i style="background:${SITE_COLORS.site}"></i>Есть сайт</span><span><i style="background:${SITE_COLORS.chain}"></i>Сеть</span>`}</div></div>
  <div id="bigmap"></div>`;
  if (typeof L === 'undefined') { $('#bigmap').innerHTML = '<div class="empty">Карта не загрузилась. Проверьте интернет.</div>'; return; }
  const g = S.geo[S.cities[0]];
  bigMap = L.map('bigmap', { zoomControl: true }).setView(g ? [g.lat, g.lon] : [48.48, 135.08], 12);
  bigMap.attributionControl.setPrefix(false); // без флага и ссылки Leaflet
  addTiles(bigMap);
  const pts = [];
  arr.forEach(l => {
    const color = src === 'base' ? (window.STATUSES[l.status || 'new'].color) : (l.chain ? SITE_COLORS.chain : SITE_COLORS[l.siteStatus]);
    const m = L.circleMarker([l.lat, l.lon], { radius: 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).addTo(bigMap);
    m.bindTooltip(esc(l.name)); m.on('click', () => openDrawer(l.id, arr.map(x => x.id)));
    pts.push([l.lat, l.lon]);
  });
  if (pts.length) bigMap.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
  listCtx = arr.map(l => l.id);
}

// ================= Вид: Демо =================
function viewDemos() {
  const list = Object.entries(S.demos).sort((a, b) => b[1].at - a[1].at);
  view.innerHTML = `
  <div class="topbar"><h1>Демо-сайты<span class="sub">${list.length} готово</span></h1><button class="btn primary" data-act="demoBlank">+ Новое демо вручную</button></div>
  <div class="scroll">
    ${!list.length ? `<div class="empty"><h3>Покажите клиенту его будущий сайт</h3>Откройте любого клиента и нажмите «Демо». ИИ напишет тексты под это заведение, приложение соберёт красивую страницу и даст ссылку, которую можно сразу отправить владельцу.</div>` : ''}
    <div class="demo-list">${list.map(([id, d]) => `<div class="card-box stack" style="gap:10px">
      <div><b style="font-size:15px">${esc(d.data.brand || 'Без названия')}</b><div class="muted" style="font-size:12px">${esc(d.data.city || '')} · ${esc(d.data.kind || '')} · ${fmtDate(d.at)}</div></div>
      <div class="row">
        ${d.link ? `<a class="btn sm" href="${esc(d.link)}" target="_blank" rel="noopener">Открыть</a><button class="btn sm" data-act="copyText" data-v="${esc(d.link)}">Ссылка</button>` : ''}
        <button class="btn sm" data-act="demoEdit" data-id="${esc(id)}">Изменить</button>
        <button class="btn sm danger" data-act="demoDel" data-id="${esc(id)}">Удалить</button>
      </div></div>`).join('')}</div>
  </div>`;
}

// ================= Вид: Шаблоны =================
let tplEdit = null;
function viewTemplates() {
  const t = S.templates.find(x => x.id === (tplEdit || S.tplId)) || S.templates[0];
  const sample = Object.values(S.leads).find(l => l.inBase) || { name: 'Кофейня «Зерно»', city: 'Хабаровск', cat: 'Кофейня', addr: 'ул. Ленина, 10', demoLink: 'https://…/demo.html#пример' };
  const vars = ['{название}', '{город}', '{категория}', '{адрес}', '{демо}', '{моё_имя}', '{цена}', '{оффер}'];
  view.innerHTML = `
  <div class="topbar"><h1>Шаблоны сообщений</h1><button class="btn" data-act="tplAdd">+ Новый шаблон</button></div>
  <div class="scroll"><div class="settings">
    <div class="chips">${S.templates.map(x => `<button class="chip ${x.id === t?.id ? 'on' : ''}" data-act="tplPick" data-v="${x.id}">${esc(x.name)}${Object.values(S.autoTpl).includes(x.id) ? ' ★' : ''}</button>`).join('')}</div>
    ${t ? `<div class="card-box stack">
      <label class="field"><span>Название</span><input class="input" id="tplName" value="${esc(t.name)}"></label>
      <div class="field"><span>Текст. Нажмите на переменную, чтобы вставить её:</span><div class="chips">${vars.map(v => `<button class="chip add" data-act="tplVar" data-v="${v}">${v}</button>`).join('')}</div></div>
      <textarea class="input" id="tplText" rows="11">${esc(t.text)}</textarea>
      <div class="field"><span>Подставлять автоматически, если у заведения:</span><div class="chips">${[['none', 'Нет сайта'], ['social', 'Только соцсети'], ['site', 'Есть сайт']].map(([k, n]) => `<button class="chip ${S.autoTpl[k] === t.id ? 'on' : 'add'}" data-act="tplAuto" data-k="${k}" data-v="${t.id}">${S.autoTpl[k] === t.id ? '✓' : '+'} ${n}</button>`).join('')}</div></div>
      <div class="row"><button class="btn danger" data-act="tplDel" data-v="${t.id}">Удалить шаблон</button></div>
    </div>
    <div class="card-box"><div class="label">Так увидит клиент (пример: ${esc(sample.name)})</div><div id="tplPreview" style="white-space:pre-wrap">${esc(fillTemplate(t.text, sample))}</div></div>` : ''}
    <button class="btn" data-act="tplReset" style="align-self:flex-start">Вернуть стандартные шаблоны</button>
  </div></div>`;
}

// ================= Вид: Настройки =================
function demoBase() {
  if (S.settings.demoBase) return S.settings.demoBase;
  if (location.protocol === 'https:') return new URL('demo.html', location.href).href;
  return 'https://yurovdima2009-commits.github.io/My-project/lidradar/demo.html';
}
function viewSettings() {
  const st = S.settings;
  const stops = Object.entries(S.stop);
  view.innerHTML = `
  <div class="topbar"><h1>Настройки</h1></div>
  <div class="scroll"><div class="settings">
    <div class="card-box stack">
      <div><h2>О вас</h2><div class="muted">Подставляется в сообщения и в плашку на демо-сайтах.</div></div>
      <div class="grid2"><label class="field"><span>Ваше имя</span><input class="input" data-set="myName" value="${esc(st.myName)}" placeholder="Дмитрий"></label>
      <label class="field"><span>Цена</span><input class="input" data-set="price" value="${esc(st.price)}" placeholder="5 000 ₽"></label></div>
      <label class="field"><span>Что вы предлагаете</span><input class="input" data-set="offer" value="${esc(st.offer)}"></label>
      <label class="field"><span>Ваша ссылка для кнопки «Хочу такой» на демо (Telegram или WhatsApp)</span><input class="input" data-set="myLink" value="${esc(st.myLink)}" placeholder="https://t.me/ваш_ник"></label>
    </div>
    <div class="card-box stack">
      <div><h2>ИИ (Claude)</h2><div class="muted">Без ключа всё работает через сайт claude.ai: приложение даст готовый промт, а ответ вы вставите обратно. С ключом тексты пишутся в один клик.</div></div>
      <label class="field"><span>API-ключ Anthropic</span><input class="input" type="password" data-set="apiKey" value="${esc(st.apiKey)}" placeholder="sk-ant-…" autocomplete="off"></label>
      <div class="hint">Ключ создаётся на console.anthropic.com (платно, по факту использования). Он хранится только в этом браузере. Не открывайте приложение с ключом на чужих компьютерах.</div>
      <label class="field"><span>Модель</span><select class="input" data-set="model">
        <option value="claude-opus-5-5" ${st.model === 'claude-opus-5-5' ? 'selected' : ''}>Claude Opus 5.5 — лучшие тексты</option>
        <option value="claude-sonnet-5-5" ${st.model === 'claude-sonnet-5-5' ? 'selected' : ''}>Claude Sonnet 5.5 — дешевле</option>
        <option value="claude-haiku-5-5" ${st.model === 'claude-haiku-5-5' ? 'selected' : ''}>Claude Haiku 5.5 — самая дешёвая</option></select></label>
      <div class="row"><button class="btn" data-act="testAi">Проверить ключ</button><span class="muted" id="aiTest"></span></div>
    </div>
    <div class="card-box stack">
      <div><h2>Где открываются демо-сайты</h2><div class="muted">Ссылка на демо ведёт на страницу demo.html из этого репозитория. Чтобы она открывалась у клиентов, включите GitHub Pages: репозиторий → Settings → Pages → выберите ветку → Save.</div></div>
      <label class="field"><span>Адрес страницы demo.html</span><input class="input" data-set="demoBase" value="${esc(st.demoBase)}" placeholder="${esc(demoBase())}"></label>
      <div class="hint">Оставьте пустым — будет использоваться ${esc(demoBase())}</div>
    </div>
    <div class="card-box stack">
      <div><h2>Данные</h2><div class="muted">Всё хранится в этом браузере. Делайте резервную копию раз в неделю.</div></div>
      <div class="row"><button class="btn" data-act="backup">Сохранить резервную копию</button><button class="btn" data-act="restore">Загрузить копию</button><button class="btn" data-act="exportCsv">Выгрузить базу в Excel</button></div>
      <div class="row"><button class="btn" data-act="clearResults">Очистить результаты поиска</button><button class="btn danger" data-act="resetAll">Стереть всё</button></div>
      <input type="file" id="restoreIn" accept=".json,application/json" hidden>
    </div>
    <div class="card-box stack">
      <div><h2>Стоп-лист</h2><div class="muted">Эти места не показываются в поиске и рассылке.</div></div>
      ${stops.length ? `<div class="chips">${stops.map(([id, s]) => `<button class="chip" data-act="unstop" data-v="${esc(id)}">${esc(s.name)} <span class="x">вернуть</span></button>`).join('')}</div>` : '<div class="muted">Пусто</div>'}
    </div>
  </div></div>`;
}

// ================= Карточка лида =================
const drawer = $('#drawer');
let drawerId = null, listCtx = [], drawerList = [], miniMap = null, siteInputOpen = false;
function openDrawer(id, list) { if (id !== drawerId) siteInputOpen = false; drawerId = id; drawerList = list && list.length ? list : (listCtx.includes(id) ? listCtx : [id]); renderDrawer(); drawer.classList.add('open'); $$('.lead.sel').forEach(e => e.classList.remove('sel')); $(`.lead[data-open="${CSS.escape(id)}"]`)?.classList.add('sel'); }
function closeDrawer() { drawer.classList.remove('open'); drawerId = null; $$('.lead.sel').forEach(e => e.classList.remove('sel')); if (miniMap) { miniMap.remove(); miniMap = null; } }
function renderDrawer() {
  const l = S.leads[drawerId]; if (!l) return closeDrawer();
  const i = drawerList.indexOf(l.id); const c = channels(l); const msg = leadMessage(l);
  const q = enc(l.name + ' ' + l.city);
  const chBtn = (key, cls, name, sub, href, extra = '') => href ? `<a class="chbtn ${extra}" data-send="${key}" data-id="${esc(l.id)}" href="${esc(href)}" ${href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}><span class="ch ${cls}">${ICON[cls]}</span><span>${name}<small>${esc(sub)}</small></span></a>` : '';
  drawer.innerHTML = `
  <div class="dhead">
    <button class="btn sm" data-act="dPrev" ${i <= 0 ? 'disabled' : ''} aria-label="Предыдущий">‹</button>
    <button class="btn sm" data-act="dNext" ${i < 0 || i >= drawerList.length - 1 ? 'disabled' : ''} aria-label="Следующий">›</button>
    <span class="pos num">${i >= 0 ? `${i + 1} / ${drawerList.length}` : ''}</span>
    <button class="btn sm" data-act="dClose" aria-label="Закрыть">✕</button>
  </div>
  <div class="dbody">
    <div class="dtitle"><div class="row">${siteTag(l)}${l.inBase ? `<span class="spill"><i style="background:${window.STATUSES[l.status || 'new'].color}"></i>${window.STATUSES[l.status || 'new'].label}</span>` : ''}</div>
      <h2>${esc(l.name)}</h2><div class="meta">📍 ${esc(l.city)} · ${esc(l.cat)}${l.addr ? ' · ' + esc(l.addr) : ''}</div></div>
    <div class="actions">
      ${l.inBase ? `<button class="btn" data-act="dUnbase">− Из базы</button>` : `<button class="btn primary" data-act="dBase">+ В базу</button>`}
      <button class="btn" data-act="dQueue" ${l.status === 'queue' ? 'disabled' : ''}>${l.status === 'queue' ? 'В очереди' : 'В очередь рассылки'}</button>
      <button class="btn" data-act="demo" data-id="${esc(l.id)}">🖥 ${l.demoLink ? 'Демо ✓' : 'Сделать демо'}</button>
      <button class="btn danger" data-act="dStop">⦸ В стоп</button>
    </div>
    <div class="stats"><div><b class="num">${l.score}</b><span>оценка</span></div><div><b>${l.siteStatus === 'site' ? 'есть' : !isChecked(l) ? '?' : l.siteStatus === 'social' ? 'соцсети' : 'нет'}</b><span>сайт</span></div><div><b class="num">${(l.history || []).filter(h => h.s === 'sent').length}</b><span>касаний</span></div></div>
    <div class="sitebox ${l.siteStatus === 'site' ? 'ok' : isChecked(l) ? 'none' : 'unk'}">
      <div class="label" style="margin:0">Сайт</div>
      <div class="sitestate">${l.siteStatus === 'site' ? `✅ Есть: <a href="${esc(channels(l).web?.href || '#')}" target="_blank" rel="noopener">${esc(channels(l).web?.label || '')}</a>` : isChecked(l) ? `❌ Сайта нет${l.siteStatus === 'social' ? ', только соцсети' : ''} <span class="muted">· проверено ${fmtDate(l.check.at)}${l.check.by === 'manual' ? ' вручную' : ''}</span>` : `❔ На карте не указан — <b>проверьте, прежде чем писать</b>`}
        ${l.check?.note ? `<div class="muted" style="font-size:12px;margin-top:3px">${esc(l.check.note)}</div>` : ''}</div>
      ${siteInputOpen ? `<div class="row" style="flex-wrap:nowrap"><input class="input" id="siteUrl" placeholder="https://адрес-сайта.ru"><button class="btn sm primary" data-act="dSiteHas">Сохранить</button></div>` : ''}
      <div class="row">
        ${checkingIds.has(l.id) ? `<span class="btn sm" aria-busy="true"><span class="spin"></span> Ищу в интернете…</span>` : `<button class="btn sm primary" data-act="dCheck">✨ Проверить ${S.settings.apiKey ? '(ИИ)' : 'через Claude'}</button>`}
        <a class="btn sm" href="https://yandex.ru/search/?text=${enc(l.name + ' ' + l.city + ' официальный сайт')}" target="_blank" rel="noopener">Яндекс</a>
        ${l.siteStatus !== 'site' ? `<button class="btn sm" data-act="dSiteHas">Сайт есть</button>` : ''}
        ${!isChecked(l) || l.siteStatus === 'site' ? `<button class="btn sm" data-act="dSiteNone">Сайта нет</button>` : ''}
        ${isChecked(l) ? `<button class="btn sm" data-act="dSiteReset" title="Сбросить проверку">↺</button>` : ''}
      </div>
    </div>
    <div>
      <div class="label">Написать</div>
      <div class="channels">
        ${c.ig ? chBtn('ig', 'ig', 'Instagram', c.ig.label, c.ig.href) : ''}
        ${c.wa ? chBtn('wa', 'wa', 'WhatsApp', c.wa.sure ? 'текст подставится' : 'городской номер?', c.wa.href + '?text=' + enc(msg), c.wa.sure ? '' : 'off') : ''}
        ${c.tg ? chBtn('tg', 'tg', 'Telegram', c.tg.label, c.tg.href, c.tg.sure ? '' : 'off') : ''}
        ${c.vb ? chBtn('vb', 'vb', 'Viber', 'по номеру', c.vb.href, c.vb.sure ? '' : 'off') : ''}
        ${c.vk ? chBtn('vk', 'vk', 'ВКонтакте', c.vk.label, c.vk.href) : ''}
        ${c.phone ? chBtn('ph', 'ph', 'Позвонить', c.phone.label, c.phone.href) : ''}
        ${c.web ? chBtn('web', 'web', 'Сайт', c.web.label, c.web.href) : ''}
      </div>
      ${!c.phone && !c.ig && !c.vk && !c.tg ? '<div class="hint" style="margin-top:8px">На карте нет контактов — найдите их по ссылкам ниже и впишите в поле «Телефон».</div>' : ''}
      <div class="linkrow" style="margin-top:8px">
        <a class="btn sm" href="https://2gis.ru/search/${q}" target="_blank" rel="noopener">2ГИС</a>
        <a class="btn sm" href="https://yandex.ru/maps/?text=${q}" target="_blank" rel="noopener">Яндекс Карты</a>
        <a class="btn sm" href="https://www.google.com/search?q=${q}+instagram" target="_blank" rel="noopener">Найти Instagram</a>
        <a class="btn sm" href="https://vk.com/search?c%5Bq%5D=${q}&c%5Bsection%5D=communities" target="_blank" rel="noopener">Найти VK</a>
      </div>
    </div>
    <div class="stack" style="gap:8px">
      <div class="label" style="margin:0;justify-content:space-between">Сообщение
        <select class="input" data-act-change="tpl" data-id="${esc(l.id)}" style="width:auto;padding:4px 8px;font-size:12px;text-transform:none;letter-spacing:0">${tplOptions(l)}</select></div>
      <textarea class="input" id="dMsg" rows="7">${esc(msg)}</textarea>
      <div class="row"><button class="btn sm" data-act="copyMsg">Копировать</button><button class="btn sm" data-act="aiMsg" data-id="${esc(l.id)}">✨ Сделать личным (ИИ)</button>${l.msg ? '<button class="btn sm" data-act="resetMsg" data-id="' + esc(l.id) + '">Сбросить</button>' : ''}</div>
    </div>
    <div>
      <div class="label">Статус</div>
      <div class="status-grid">${Object.entries(window.STATUSES).map(([k, s]) => `<button class="sbtn ${(l.inBase && (l.status || 'new') === k) ? 'on' : ''}" data-act="dStatus" data-v="${k}"><i style="background:${s.color}"></i>${s.label}</button>`).join('')}</div>
    </div>
    <div class="grid2">
      <label class="field"><span>Контактное лицо</span><input class="input" data-lead="person" value="${esc(l.person || '')}" placeholder="Анна, управляющая"></label>
      <label class="field"><span>Напомнить</span><input class="input" type="date" data-lead="nextDate" value="${l.nextDate ? new Date(l.nextDate - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10) : ''}"></label>
      <label class="field"><span>Телефон</span><input class="input" data-lead="phone" value="${esc(l.phone || '')}" placeholder="+7…"></label>
      <label class="field"><span>Instagram</span><input class="input" data-lead="instagram" value="${esc(l.instagram || '')}" placeholder="@ник"></label>
    </div>
    <label class="field"><span>Заметка</span><textarea class="input" data-lead="note" rows="3" placeholder="О чём договорились, что предложить…">${esc(l.note || '')}</textarea></label>
    ${l.demoLink ? `<div class="field"><span class="label" style="margin:0">Ссылка на демо</span><div class="row" style="flex-wrap:nowrap"><input class="input" readonly value="${esc(l.demoLink)}"><button class="btn sm" data-act="copyText" data-v="${esc(l.demoLink)}">Копировать</button></div></div>` : ''}
    <div><div class="label">На карте</div><div class="minimap" id="minimap"></div></div>
    ${(l.history || []).length ? `<div><div class="label">История</div><div class="history">${l.history.slice().reverse().slice(0, 12).map(h => `<div>${fmtDT(h.t)} — <b>${esc(window.STATUSES[h.s]?.label || h.s)}</b></div>`).join('')}</div></div>` : ''}
  </div>`;
  if (miniMap) { miniMap.remove(); miniMap = null; }
  if (typeof L !== 'undefined') {
    miniMap = L.map('minimap', { zoomControl: false, attributionControl: false }).setView([l.lat, l.lon], 15);
    addTiles(miniMap);
    drawerList.slice(0, 400).forEach(id => { const o = S.leads[id]; if (o && o.id !== l.id && Math.abs(o.lat - l.lat) < .03 && Math.abs(o.lon - l.lon) < .05) L.circleMarker([o.lat, o.lon], { radius: 5, color: '#fff', weight: 1, fillColor: '#8b93a4', fillOpacity: 1 }).addTo(miniMap).bindTooltip(esc(o.name)).on('click', () => openDrawer(o.id, drawerList)); });
    L.circleMarker([l.lat, l.lon], { radius: 9, color: '#fff', weight: 3, fillColor: '#f2a93b', fillOpacity: 1 }).addTo(miniMap);
    setTimeout(() => miniMap && miniMap.invalidateSize(), 250);
  }
}
function refreshAfterLeadChange() { if (drawerId) renderDrawer(); if (['base', 'search', 'outreach'].includes(S.ui.view)) renderView(); }

// ================= Конструктор демо =================
let B = null; // состояние конструктора
function openBuilder(leadId, manual) {
  const l = manual ? { id: 'm' + Date.now(), name: '', city: S.cities[0] || '', cat: '', sphere: 'other', manual: true } : S.leads[leadId];
  if (!l) return;
  const existing = S.demos[l.id];
  B = { lead: l, data: existing ? JSON.parse(JSON.stringify(existing.data)) : null, mode: S.settings.apiKey ? 'api' : 'manual', style: existing?.data?.style || styleFor(l), extra: existing?.extra || '', device: 'phone', link: existing?.link || '', busy: false, answer: '' };
  renderBuilder();
}
function styleFor(l) {
  const s = (l.cat || '') + ' ' + (l.name || '');
  if (/шаурм|шаверм|бургер|пицц|донер|фастфуд|хот-?дог/i.test(s)) return 'bold';
  if (/барбер|barber|тату|tattoo|кальян|бар\b|паб/i.test(s)) return 'dark';
  if (/салон|маник|ногт|бров|ресниц|красот|цвет|nail|beauty/i.test(s)) return 'soft';
  if (/кофе|кафе|пекар|ресторан|кондитер|coffee|cafe/i.test(s)) return 'warm';
  if (l.sphere === 'food') return /бургер|шаурм|фастфуд|пицц|донер/i.test(l.cat + l.name) ? 'bold' : 'warm';
  if (l.sphere === 'beauty') return /барбер|barber|тату|tattoo/i.test(l.cat + l.name) ? 'dark' : 'soft';
  if (l.sphere === 'fun') return 'dark';
  return 'clean';
}
function builderData() {
  if (!B.data) return null;
  const l = B.lead; const d = B.data;
  d.style = B.style;
  d._a = { name: S.settings.myName || '', link: /^https:\/\//.test(S.settings.myLink) ? S.settings.myLink : '' };
  ['phone', 'instagram', 'telegram', 'vk', 'whatsapp'].forEach(k => { if (!d[k] && l[k]) d[k] = l[k]; });
  return d;
}
function renderBuilder() {
  if (!B) { $('#modalRoot').innerHTML = ''; return; }
  const l = B.lead; const d = B.data;
  const accents = ['#8a4b2a', '#e8442c', '#c0627a', '#d4a24c', '#2463eb', '#2f8f5b', '#6b4fd8', '#111111'];
  const stepOk = n => n === 1 ? !!(l.name) : n === 2 ? !!d : !!B.link;
  $('#modalRoot').innerHTML = `
  <div class="modal" id="modal"><div class="modal-box">
    <div class="mleft">
      <div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div><h2>Демо для «${esc(l.name || 'нового клиента')}»</h2><div class="muted" style="font-size:12px">${esc(l.city || '')}${l.cat ? ' · ' + esc(l.cat) : ''}</div></div><button class="btn sm" data-act="bClose" aria-label="Закрыть">✕</button></div>
      <div class="step">
        <div class="step-h"><span class="n ${stepOk(1) ? 'ok' : ''}">1</span>Данные о месте</div>
        <div class="grid2">
          <label class="field"><span>Название</span><input class="input" data-b="name" value="${esc(l.name || '')}"></label>
          <label class="field"><span>Тип</span><input class="input" data-b="cat" value="${esc(l.cat || '')}" placeholder="Кофейня"></label>
          <label class="field"><span>Город</span><input class="input" data-b="city" value="${esc(l.city || '')}"></label>
          <label class="field"><span>Телефон</span><input class="input" data-b="phone" value="${esc(l.phone || '')}"></label>
        </div>
        <label class="field"><span>Адрес</span><input class="input" data-b="addr" value="${esc(l.addr || '')}"></label>
        <label class="field"><span>Что известно: меню, цены, услуги, фишки (необязательно)</span><textarea class="input" data-b="extra" rows="3" placeholder="Например: капучино 180, раф 250, круассаны свои, есть веранда, работаем с 8 утра">${esc(B.extra)}</textarea></label>
        <label class="field"><span>Фото для обложки — ссылка https (необязательно)</span><input class="input" data-b="bg" value="${esc(d?.bg || '')}" placeholder="https://…jpg"></label>
        <div class="field"><span>Стиль</span><div class="chips">${window.DEMO_STYLES.map(s => `<button class="chip ${B.style === s.id ? 'on' : ''}" data-act="bStyle" data-v="${s.id}" title="${esc(s.hint)}">${esc(s.label)}</button>`).join('')}</div></div>
        ${d ? `<div class="field"><span>Акцентный цвет</span><div class="swatches">${accents.map(a => `<button class="swatch ${d.accent === a ? 'on' : ''}" style="background:${a}" data-act="bAccent" data-v="${a}" aria-label="Цвет ${a}"></button>`).join('')}<button class="chip ${!d.accent ? 'on' : ''}" data-act="bAccent" data-v="">как в стиле</button></div></div>` : ''}
      </div>
      <div class="step">
        <div class="step-h"><span class="n ${stepOk(2) ? 'ok' : ''}">2</span>Тексты сайта</div>
        <div class="mode">
          <button class="${B.mode === 'api' ? 'on' : ''}" data-act="bMode" data-v="api"><b>✨ Claude по API</b><span>в 1 клик, нужен ключ</span></button>
          <button class="${B.mode === 'manual' ? 'on' : ''}" data-act="bMode" data-v="manual"><b>Через claude.ai</b><span>бесплатно, копировать-вставить</span></button>
          <button class="${B.mode === 'quick' ? 'on' : ''}" data-act="bMode" data-v="quick" style="grid-column:span 2"><b>Быстро — шаблон без ИИ</b><span>за секунду, тексты общие</span></button>
        </div>
        ${B.mode === 'api' ? (S.settings.apiKey ? `<button class="btn primary" data-act="bGen" ${B.busy ? 'disabled' : ''}>${B.busy ? '<span class="spin"></span> Claude пишет тексты…' : d ? 'Сгенерировать заново' : 'Сгенерировать тексты'}</button>` : `<div class="hint">Добавьте API-ключ в «Настройках» или выберите «Через claude.ai».</div>`) : ''}
        ${B.mode === 'manual' ? `
          <div class="row"><button class="btn" data-act="bCopyPrompt">1. Скопировать промт</button><a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">2. Открыть claude.ai</a></div>
          <div class="hint">В claude.ai вставьте промт (Ctrl+V), дождитесь ответа, нажмите «Copy» под блоком с JSON и вставьте сюда:</div>
          <textarea class="input" id="bAnswer" rows="4" placeholder='{"v": 1, "brand": …}'>${esc(B.answer)}</textarea>
          <button class="btn primary" data-act="bApply">3. Применить ответ</button>` : ''}
        ${B.mode === 'quick' ? `<button class="btn primary" data-act="bQuick">Собрать демо из шаблона</button>` : ''}
        ${d ? `<details><summary class="muted" style="cursor:pointer;font-size:12px">Редактировать тексты вручную (JSON)</summary><textarea class="input" id="bJson" rows="10" style="font:11.5px/1.45 var(--mono);margin-top:8px">${esc(JSON.stringify(Object.assign({}, d, { _a: undefined }), null, 2))}</textarea><button class="btn sm" data-act="bJsonApply" style="margin-top:6px">Применить</button></details>` : ''}
      </div>
      <div class="step">
        <div class="step-h"><span class="n ${stepOk(3) ? 'ok' : ''}">3</span>Ссылка для клиента</div>
        <button class="btn primary" data-act="bPublish" ${d ? '' : 'disabled'}>Получить ссылку</button>
        ${B.link ? `<div class="row" style="flex-wrap:nowrap"><input class="input" readonly value="${esc(B.link)}"><button class="btn sm" data-act="copyText" data-v="${esc(B.link)}">Копировать</button><a class="btn sm" href="${esc(B.link)}" target="_blank" rel="noopener">Открыть</a></div>
        <div class="hint">Ссылка сохранена в карточку клиента и подставляется в сообщения вместо {демо}.</div>` : `<div class="hint">Ссылка ведёт на ${esc(demoBase())}. Если она не открывается — включите GitHub Pages (подробнее в «Настройках»).</div>`}
        <button class="btn" data-act="bDownload" ${d ? '' : 'disabled'}>Скачать как HTML-файл</button>
      </div>
    </div>
    <div class="mright">
      <div class="tools"><div class="chips"><button class="chip ${B.device === 'phone' ? 'on' : ''}" data-act="bDevice" data-v="phone">Телефон</button><button class="chip ${B.device === 'desktop' ? 'on' : ''}" data-act="bDevice" data-v="desktop">Компьютер</button></div><span class="muted" style="font-size:12px;margin-left:auto">Предпросмотр</span></div>
      <div class="stage">${d ? `<iframe class="frame ${B.device === 'phone' ? 'phone' : ''}" id="bFrame" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" title="Предпросмотр демо-сайта"></iframe>` : `<div class="placeholder"><div style="font-size:40px">🖥</div><b>Здесь появится сайт</b><br>Выберите способ на шаге 2: так его увидит владелец с телефона.</div>`}</div>
    </div>
  </div></div>`;
  if (d) $('#bFrame').srcdoc = window.DemoSite.render(builderData());
}
function adoptStyle() { if (B.data && window.DemoSite.styles.includes(B.data.style)) B.style = B.data.style; }
function builderSyncLead() {
  // поля шага 1 → в данные демо
  const l = B.lead, d = B.data; if (!d) return;
  d.brand = l.name || d.brand; d.kind = l.cat || d.kind; d.city = l.city || d.city; d.address = l.addr || d.address; d.phone = l.phone || d.phone;
}
async function builderGen() {
  B.busy = true; renderBuilder();
  try {
    const text = await window.AI.ask(window.AI.demoPrompt(B.lead, B.extra, B.style), { apiKey: S.settings.apiKey, model: S.settings.model });
    B.data = window.AI.extractJson(text); adoptStyle(); builderSyncLead(); B.link = '';
    toast('Готово! Посмотрите предпросмотр справа');
  } catch (e) { toast(e.message, 6000); }
  B.busy = false; renderBuilder();
}
async function builderPublish() {
  const d = builderData(); if (!d) return;
  const packed = await window.DemoSite.pack(d);
  B.link = demoBase() + '#' + packed;
  const l = B.lead;
  if (l.manual) { S.demos[l.id] = { data: d, link: B.link, extra: B.extra, at: Date.now() }; }
  else {
    S.demos[l.id] = { data: d, link: B.link, extra: B.extra, at: Date.now() };
    if (S.leads[l.id]) { S.leads[l.id].demoLink = B.link; S.leads[l.id].updated = Date.now(); }
  }
  save(); renderBuilder(); copy(B.link);
  if (B.link.length > 3500) toast('Ссылка длинная — некоторые мессенджеры могут её обрезать. Сократите тексты.', 5000);
}

// ================= Обработка событий =================
document.addEventListener('click', async e => {
  const t = e.target;
  if (t.closest('[data-stop]')) return; // клик по иконке канала не открывает карточку
  const sendA = t.closest('[data-send]');
  if (sendA) {
    const l = S.leads[sendA.dataset.id];
    const msgEl = $('#outMsg') || $('#dMsg');
    if (l && msgEl && sendA.dataset.send === 'wa') { try { const u = new URL(sendA.href); u.searchParams.set('text', msgEl.value); sendA.href = u.toString(); } catch (_) {} }
    else if (l && msgEl && sendA.dataset.send !== 'ph' && sendA.dataset.send !== 'web') copy(msgEl.value);
    return;
  }
  const navB = t.closest('.nav[data-view]'); if (navB) { closeDrawer(); return go(navB.dataset.view); }
  if (t.closest('#themeBtn')) {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next; try { localStorage.setItem('lr_theme', next); } catch (_) {}
    renderView(); if (drawerId) renderDrawer(); return;
  }
  const chk = t.closest('[data-check]');
  if (chk) { const id = chk.dataset.check; chk.checked ? selected.add(id) : selected.delete(id); renderView(); return; }
  const a = t.closest('[data-act]');
  if (!a) { const op = t.closest('[data-open]'); if (op && !t.closest('a,button,input,select,textarea')) openDrawer(op.dataset.open); else if (op && t.closest('button[data-open]')) openDrawer(op.dataset.open); return; }
  const act = a.dataset.act, v = a.dataset.v, id = a.dataset.id;
  const l = id ? S.leads[id] : drawerId ? S.leads[drawerId] : null;
  switch (act) {
    // поиск
    case 'search': runSearch(); break;
    case 'rmCity': S.cities = S.cities.filter(c => c !== v); save(); renderView(); break;
    case 'rmWord': S.words = S.words.filter(c => c !== v); save(); renderView(); break;
    case 'sphere': S.openSphere = S.openSphere === v ? '' : v; save(); renderView(); break;
    case 'toggleCat': S.cats = S.cats.includes(v) ? S.cats.filter(c => c !== v) : [...S.cats, v]; save(); renderView(); break;
    case 'toggleConfig': configCollapsed = !configCollapsed; renderView(); break;
    case 'more': page++; renderView(); break;
    case 'tobase': toBase(id); toast('Добавлено в базу'); renderView(); if (drawerId === id) renderDrawer(); break;
    case 'selectAll': filteredResults().forEach(x => selected.add(x.id)); renderView(); break;
    case 'bulkClear': selected.clear(); renderView(); break;
    case 'bulkCheck': { const ids = [...selected]; selected.clear(); checkLeads(ids); break; }
    case 'checkTop': checkLeads(filteredResults().filter(x => x.siteStatus !== 'site' && !isChecked(x) && !x.chain).slice(0, 20).map(x => x.id)); break;
    case 'siteFilter': S.ui.site = S.ui.site === v && v !== 'all' ? 'all' : v; page = 1; save(); renderView(); break;
    case 'dCheck': checkLeads([drawerId]); break;
    case 'dSiteNone': setSiteManual(drawerId, null); toast('Отмечено: сайта нет'); break;
    case 'dSiteHas': { const inp = $('#siteUrl'); if (!inp) { siteInputOpen = true; renderDrawer(); $('#siteUrl')?.focus(); break; } const u = inp.value.trim(); if (!u) { toast('Вставьте адрес сайта'); break; } siteInputOpen = false; setSiteManual(drawerId, u); toast('Сайт сохранён'); break; }
    case 'dSiteReset': { const x = S.leads[drawerId]; if (x) { if (x.check?.url && x.website === x.check.url) x.website = ''; delete x.check; Object.assign(x, scoreLead(x)); save(); refreshAfterLeadChange(); } break; }
    case 'cmClose': checkModal = null; renderCheckModal(); break;
    case 'cmCopy': copy(window.AI.checkBatchPrompt(checkModal.ids.map(id => S.leads[id]).filter(Boolean))); break;
    case 'cmApply': try { const r = applyBatchAnswer($('#cmAnswer').value); checkModal = null; renderCheckModal(); renderView(); if (drawerId) renderDrawer(); toast(`Обновлено ${r.n}: сайт нашёлся у ${r.found}`, 5000); } catch (err) { toast('Не получилось прочитать ответ: ' + err.message, 5000); } break;
    case 'bulkBase': selected.forEach(x => toBase(x)); toast(`В базу: ${selected.size}`); selected.clear(); renderView(); break;
    case 'bulkQueue': selected.forEach(x => { toBase(x); setStatus(x, 'queue'); }); toast(`В очередь: ${selected.size}`); selected.clear(); renderView(); break;
    case 'bulkStop': selected.forEach(x => toStop(x)); toast(`В стоп: ${selected.size}`); selected.clear(); renderView(); break;
    // база
    case 'baseStatus': S.ui.baseStatus = v; save(); renderView(); break;
    case 'exportCsv': exportCsv(); break;
    // рассылка
    case 'queueAllNew': Object.values(S.leads).forEach(x => { if (x.inBase && (x.status || 'new') === 'new' && !S.stop[x.id]) setStatus(x.id, 'queue'); }); outIdx = 0; renderView(); break;
    case 'outSkip': outIdx++; renderView(); break;
    case 'outStop': toStop(id); renderView(); toast('В стоп-листе'); break;
    case 'outSent': setStatus(id, 'sent'); S.sentLog[todayKey()] = (S.sentLog[todayKey()] || 0) + 1; save(); renderView(); toast('Отмечено. Напомню через 3 дня'); break;
    // карта
    case 'mapSrc': S.ui.mapSrc = v; save(); renderView(); break;
    // карточка
    case 'dClose': closeDrawer(); break;
    case 'dPrev': openDrawer(drawerList[drawerList.indexOf(drawerId) - 1], drawerList); break;
    case 'dNext': openDrawer(drawerList[drawerList.indexOf(drawerId) + 1], drawerList); break;
    case 'dBase': toBase(drawerId); refreshAfterLeadChange(); toast('Добавлено в базу'); break;
    case 'dUnbase': toBase(drawerId, false); refreshAfterLeadChange(); break;
    case 'dQueue': toBase(drawerId); setStatus(drawerId, 'queue'); refreshAfterLeadChange(); toast('Добавлено в очередь рассылки'); break;
    case 'dStop': { const next = drawerList[drawerList.indexOf(drawerId) + 1]; toStop(drawerId); toast('В стоп-листе'); if (next) openDrawer(next, drawerList); else closeDrawer(); renderView(); break; }
    case 'dStatus': toBase(drawerId); setStatus(drawerId, v); refreshAfterLeadChange(); break;
    case 'copyMsg': copy($('#dMsg').value); break;
    case 'copyText': copy(v); break;
    case 'resetMsg': if (l) { delete l.msg; save(); refreshAfterLeadChange(); } break;
    case 'aiMsg': {
      if (!l) break;
      const box = $('#outMsg') || $('#dMsg'); const prompt = window.AI.messagePrompt(l, box.value, { name: S.settings.myName, offer: S.settings.offer, price: S.settings.price });
      if (!S.settings.apiKey) { await copy(prompt); toast('Нет API-ключа: промт скопирован — вставьте его в claude.ai и скопируйте ответ сюда', 5000); window.open('https://claude.ai/new', '_blank', 'noopener'); break; }
      a.disabled = true; a.innerHTML = '<span class="spin"></span> Пишу…';
      try { const text = await window.AI.ask(prompt, { apiKey: S.settings.apiKey, model: S.settings.model, maxTokens: 4000 }); l.msg = text.trim(); save(); toast('Готово'); }
      catch (err) { toast(err.message, 6000); }
      refreshAfterLeadChange(); break;
    }
    // демо
    case 'demo': openBuilder(id || drawerId); break;
    case 'demoBlank': openBuilder(null, true); break;
    case 'demoEdit': { if (S.leads[id]) openBuilder(id); else { const dm = S.demos[id]; B = { lead: { id, name: dm.data.brand, city: dm.data.city, cat: dm.data.kind, addr: dm.data.address, phone: dm.data.phone, manual: true, sphere: 'other' }, data: dm.data, mode: 'quick', style: dm.data.style, extra: dm.extra || '', device: 'phone', link: dm.link, answer: '' }; renderBuilder(); } break; }
    case 'demoDel': delete S.demos[id]; if (S.leads[id]) delete S.leads[id].demoLink; save(); renderView(); break;
    case 'bClose': B = null; renderBuilder(); refreshAfterLeadChange(); break;
    case 'bStyle': B.style = v; renderBuilder(); break;
    case 'bAccent': if (B.data) { B.data.accent = v || null; B.link = ''; renderBuilder(); } break;
    case 'bMode': B.mode = v; renderBuilder(); break;
    case 'bDevice': B.device = v; renderBuilder(); break;
    case 'bGen': builderGen(); break;
    case 'bQuick': B.data = window.AI.quickDemo(B.lead, B.style); B.link = ''; renderBuilder(); break;
    case 'bCopyPrompt': copy(window.AI.demoPrompt(B.lead, B.extra, B.style)); break;
    case 'bApply': try { B.answer = $('#bAnswer').value; B.data = window.AI.extractJson(B.answer); adoptStyle(); builderSyncLead(); B.link = ''; renderBuilder(); toast('Применено'); } catch (err) { toast('Не получилось прочитать ответ: ' + err.message, 5000); } break;
    case 'bJsonApply': try { B.data = JSON.parse($('#bJson').value); adoptStyle(); B.link = ''; renderBuilder(); toast('Применено'); } catch (err) { toast('Ошибка в JSON: ' + err.message, 5000); } break;
    case 'bPublish': builderPublish(); break;
    case 'bDownload': download(`${(B.lead.name || 'demo').replace(/[^\wа-яё -]/gi, '').trim() || 'demo'}.html`, window.DemoSite.render(builderData()), 'text/html'); break;
    // шаблоны
    case 'tplPick': tplEdit = v; renderView(); break;
    case 'tplAdd': { const nt = { id: 't' + Date.now(), name: 'Новый шаблон', text: 'Здравствуйте! …' }; S.templates.push(nt); tplEdit = nt.id; save(); renderView(); break; }
    case 'tplDel': if (S.templates.length <= 1) return toast('Нужен хотя бы один шаблон'); S.templates = S.templates.filter(x => x.id !== v); if (S.tplId === v) S.tplId = S.templates[0].id; Object.keys(S.autoTpl).forEach(k => { if (S.autoTpl[k] === v) S.autoTpl[k] = S.tplId; }); tplEdit = null; save(); renderView(); break;
    case 'tplAuto': S.autoTpl[a.dataset.k] = v; save(); renderView(); toast('Готово: этот шаблон будет подставляться сам'); break;
    case 'tplVar': { const ta = $('#tplText'); const p = ta.selectionStart; ta.value = ta.value.slice(0, p) + v + ta.value.slice(ta.selectionEnd); ta.focus(); ta.selectionStart = ta.selectionEnd = p + v.length; ta.dispatchEvent(new Event('input', { bubbles: true })); break; }
    case 'tplReset': S.templates = JSON.parse(JSON.stringify(window.DEFAULT_TEMPLATES)); S.tplId = 't1'; S.autoTpl = { none: 't1', social: 't5', site: 't6' }; tplEdit = null; save(); renderView(); break;
    // настройки
    case 'testAi': { const out = $('#aiTest'); out.textContent = 'Проверяю…'; try { await window.AI.ask('Ответь одним словом: работает', { apiKey: S.settings.apiKey, model: S.settings.model, maxTokens: 2000 }); out.textContent = '✓ Ключ работает'; } catch (err) { out.textContent = err.message; } break; }
    case 'backup': download(`lidradar-backup-${todayKey()}.json`, JSON.stringify(Object.assign({}, S, { settings: Object.assign({}, S.settings, { apiKey: '' }) })), 'application/json'); toast('Копия сохранена (без API-ключа)'); break;
    case 'restore': $('#restoreIn').click(); break;
    case 'clearResults': S.results = []; Object.keys(S.leads).forEach(k => { if (!S.leads[k].inBase && !S.demos[k]) delete S.leads[k]; }); save(); toast('Результаты поиска очищены'); renderView(); break;
    case 'resetAll': if (a.dataset.confirm !== '1') { a.dataset.confirm = '1'; a.textContent = 'Точно стереть? Нажмите ещё раз'; return; } localStorage.removeItem(KEY); location.reload(); break;
    case 'unstop': delete S.stop[v]; save(); renderView(); break;
  }
});

document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault();
  if (f.dataset.form === 'city') { const v = $('#cityIn').value.trim(); if (v && !S.cities.includes(v)) S.cities.push(v); }
  if (f.dataset.form === 'word') { const v = $('#wordIn').value.trim().toLowerCase(); if (v && !S.words.includes(v)) S.words.push(v); }
  save(); renderView();
});

const onFilterQ = debounce(v => { S.ui.q = v; page = 1; save(); viewSearch(); const i = $('#fq'); if (i) { i.focus(); i.selectionStart = i.selectionEnd = i.value.length; } }, 250);
const onBaseQ = debounce(v => { S.ui.baseQ = v; save(); viewBase(); const i = $('#bq'); if (i) { i.focus(); i.selectionStart = i.selectionEnd = i.value.length; } }, 250);
const tplSave = debounce(() => { const p = $('#tplPreview'); const t = S.templates.find(x => x.id === (tplEdit || S.tplId)); if (p && t) p.textContent = fillTemplate(t.text, Object.values(S.leads).find(l => l.inBase) || { name: 'Кофейня «Зерно»', city: 'Хабаровск', cat: 'Кофейня', addr: 'ул. Ленина, 10', demoLink: 'https://…/demo.html#пример' }); }, 200);
const rerenderPreview = debounce(() => { if (B && B.data) { builderSyncLead(); const f = $('#bFrame'); if (f) f.srcdoc = window.DemoSite.render(builderData()); } }, 400);

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'fq') return onFilterQ(t.value);
  if (t.id === 'bq') return onBaseQ(t.value);
  if (t.dataset.set) { S.settings[t.dataset.set] = t.value.trim(); save(); return; }
  if (t.dataset.lead && drawerId) {
    const l = S.leads[drawerId]; const k = t.dataset.lead;
    if (k === 'nextDate') l.nextDate = t.value ? new Date(t.value + 'T09:00').getTime() : null;
    else l[k] = t.value;
    l.updated = Date.now(); save(); return;
  }
  if (t.id === 'dMsg' && drawerId) { S.leads[drawerId].msg = t.value; save(); return; }
  if (t.id === 'outMsg') { S.leads[t.dataset.id].msg = t.value; save(); return; }
  if (t.id === 'tplName' || t.id === 'tplText') { const tp = S.templates.find(x => x.id === (tplEdit || S.tplId)); if (tp) { tp[t.id === 'tplName' ? 'name' : 'text'] = t.value; save(); tplSave(); } return; }
  if (t.dataset.b && B) {
    const k = t.dataset.b;
    if (k === 'extra') B.extra = t.value;
    else if (k === 'bg') { if (B.data) { B.data.bg = t.value.trim(); B.link = ''; } }
    else { B.lead[k] = t.value; if (!B.lead.manual && S.leads[B.lead.id]) save(); }
    B.link = B.link && k !== 'extra' ? '' : B.link;
    rerenderPreview(); return;
  }
  if (t.id === 'bAnswer' && B) B.answer = t.value;
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.ui) { S.ui[t.dataset.ui] = t.value; page = 1; save(); renderView(); }
  if (t.dataset.uicheck) { S.ui[t.dataset.uicheck] = t.checked; page = 1; save(); renderView(); }
  if (t.dataset.actChange === 'tpl') { const l = S.leads[t.dataset.id]; if (l) { l.tplId = t.value; delete l.msg; save(); refreshAfterLeadChange(); } }
  if (t.dataset.set === 'model') { S.settings.model = t.value; save(); }
  if (t.dataset.lead && (S.ui.view === 'base')) viewBase();
  if (t.id === 'restoreIn') restore(t);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (checkModal) { checkModal = null; renderCheckModal(); } else if (B) { B = null; renderBuilder(); } else if (drawerId) closeDrawer(); }
  if (drawerId && !e.target.closest('input,textarea,select') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    const i = drawerList.indexOf(drawerId) + (e.key === 'ArrowRight' ? 1 : -1);
    if (drawerList[i]) openDrawer(drawerList[i], drawerList);
  }
});

// ================= Экспорт / импорт =================
function exportCsv() {
  const rows = [['Название', 'Город', 'Категория', 'Статус', 'Оценка', 'Сайт', 'Адрес', 'Телефон', 'WhatsApp', 'Telegram', 'Instagram', 'VK', 'Email', 'Контактное лицо', 'Заметка', 'Напомнить', 'Демо', 'Широта', 'Долгота']];
  Object.values(S.leads).filter(l => l.inBase).forEach(l => rows.push([l.name, l.city, l.cat, window.STATUSES[l.status || 'new'].label, l.score, l.siteStatus === 'site' ? l.website : l.siteStatus === 'social' ? 'только соцсети' : 'нет', l.addr, l.phones || l.phone, l.whatsapp, l.telegram, l.instagram, l.vk, l.email, l.person, l.note, l.nextDate ? new Date(l.nextDate).toLocaleDateString('ru-RU') : '', l.demoLink, l.lat, l.lon]));
  if (rows.length === 1) return toast('В базе пока никого нет');
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  download(`baza-klientov-${todayKey()}.csv`, csv, 'text/csv;charset=utf-8');
  toast(`Выгружено: ${rows.length - 1}`);
}
async function restore(input) {
  const f = input.files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (!j.leads || !j.settings) throw new Error();
    const key = S.settings.apiKey;
    S = Object.assign(DEFAULT_STATE(), j); S.settings.apiKey ||= key;
    saveNow(); toast('Копия загружена'); renderView(); updateBadges();
  } catch (e) { toast('Это не файл резервной копии ЛидРадара'); }
  input.value = '';
}

// ================= Старт =================
renderView();
updateBadges();
})();
