// Сборка демо-сайта из JSON. Используется и в приложении (предпросмотр), и в demo.html (ссылка для клиента).
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const emph = s => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const digits = p => String(p || '').replace(/[^\d+]/g, '');
  const waNum = p => { let d = String(p || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1); return d; };
  const safeUrl = u => /^https:\/\//i.test(String(u || '')) ? String(u) : '';
  const handle = s => String(s || '').replace(/^https?:\/\/(www\.)?[^/]+\//i, '').replace(/^@/, '').replace(/\/$/, '');

  const STYLES = {
    warm:  { bg: '#f6efe4', fg: '#2b1d14', muted: '#7a6555', card: '#fffaf2', line: '#e6d9c6', accent: '#8a4b2a', dfont: "'Cormorant Garamond', Georgia, serif", bfont: "'Manrope', system-ui, sans-serif", dweight: 500, fonts: 'Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;600;700', radius: '18px' },
    bold:  { bg: '#fff4dc', fg: '#141414', muted: '#5c5446', card: '#ffffff', line: '#141414', accent: '#e8442c', dfont: "'Unbounded', 'Arial Black', sans-serif", bfont: "'Manrope', system-ui, sans-serif", dweight: 800, fonts: 'Unbounded:wght@600;800&family=Manrope:wght@400;600;700;800', radius: '14px', border: '2px solid #141414', shadow: '4px 4px 0 #141414' },
    soft:  { bg: '#fbf2f0', fg: '#3b2a2e', muted: '#8a7276', card: '#ffffff', line: '#efdcd8', accent: '#c0627a', dfont: "'Playfair Display', Georgia, serif", bfont: "'Manrope', system-ui, sans-serif", dweight: 500, fonts: 'Playfair+Display:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;600;700', radius: '24px' },
    dark:  { bg: '#121212', fg: '#f1ece4', muted: '#a39d94', card: '#1c1c1c', line: '#2c2c2c', accent: '#d4a24c', dfont: "'Oswald', Impact, sans-serif", bfont: "'Manrope', system-ui, sans-serif", dweight: 600, fonts: 'Oswald:wght@500;600;700&family=Manrope:wght@400;600;700', radius: '10px', upper: true },
    clean: { bg: '#f5f7fa', fg: '#14202b', muted: '#5f6b77', card: '#ffffff', line: '#e1e6ec', accent: '#2463eb', dfont: "'Onest', system-ui, sans-serif", bfont: "'Onest', system-ui, sans-serif", dweight: 700, fonts: 'Onest:wght@400;500;600;700;800', radius: '16px' },
  };

  function render(d, opts = {}) {
    d = d || {};
    const st = STYLES[d.style] || STYLES.warm;
    const accent = /^#[0-9a-f]{3,8}$/i.test(d.accent || '') ? d.accent : st.accent;
    const phone = d.phone || '';
    const wa = waNum(d.whatsapp || phone);
    const tg = handle(d.telegram);
    const ig = handle(d.instagram);
    const vk = handle(d.vk);
    const title = Array.isArray(d.title) ? d.title : [d.title || d.brand || 'Добро пожаловать'];
    const hits = Array.isArray(d.hits) ? d.hits.slice(0, 12) : [];
    const menu = Array.isArray(d.menu) ? d.menu.slice(0, 8) : [];
    const features = Array.isArray(d.features) ? d.features.slice(0, 6) : [];
    const reviews = Array.isArray(d.reviews) ? d.reviews.slice(0, 6) : [];
    const pills = Array.isArray(d.pill) ? d.pill : [];
    const canOrder = d.order !== false && (wa || tg) && [...hits, ...menu.flatMap(s => s.items || [])].some(i => i.price);
    const author = d._a || {};
    const bg = safeUrl(d.bg);
    const mapQ = encodeURIComponent([d.city, d.address, d.brand].filter(Boolean).join(' '));

    const priceBtn = (it, i) => it.price ? `<div class="price-row"><span class="price">${esc(it.price)}</span>${canOrder ? `<button class="add" data-add="${i}" aria-label="Добавить в заказ">+</button>` : ''}</div>` : '';
    const allItems = [];
    const itemCard = (it) => { const i = allItems.push(it) - 1; return `
      <article class="item">
        ${safeUrl(it.photo) ? `<img src="${esc(it.photo)}" alt="" loading="lazy">` : it.emoji ? `<div class="emoji">${esc(it.emoji)}</div>` : ''}
        <h3>${esc(it.name)}</h3>
        ${it.desc ? `<p>${esc(it.desc)}</p>` : ''}
        ${priceBtn(it, i)}
      </article>`; };

    const hitsHtml = hits.length ? `<section id="hits"><div class="wrap"><h2>${emph(d.hitsTitle || 'Популярное')}</h2><div class="grid">${hits.map(itemCard).join('')}</div></div></section>` : '';
    const menuHtml = menu.length ? `<section id="menu"><div class="wrap"><h2>${emph(d.menuTitle || 'Меню и цены')}</h2>${menu.map(s => `
      <div class="menu-sec"><h3 class="sec-t">${esc(s.section)}</h3>${(s.items || []).slice(0, 20).map(it => { const i = allItems.push(it) - 1; return `
        <div class="row"><div><b>${esc(it.name)}</b>${it.desc ? `<small>${esc(it.desc)}</small>` : ''}</div><span class="dots"></span>${it.price ? `<span class="price">${esc(it.price)}</span>` : ''}${canOrder && it.price ? `<button class="add sm" data-add="${i}" aria-label="Добавить">+</button>` : ''}</div>`; }).join('')}</div>`).join('')}</div></section>` : '';
    const featHtml = features.length ? `<section><div class="wrap"><h2>${emph(d.featuresTitle || 'Почему выбирают нас')}</h2><div class="feats">${features.map(f => `<div class="feat"><div class="ficon">${esc(f.icon || '✦')}</div><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></div>`).join('')}</div></div></section>` : '';
    const aboutHtml = d.about ? `<section><div class="wrap about"><h2>${emph(d.aboutTitle || 'О нас')}</h2><p>${esc(d.about)}</p></div></section>` : '';
    const revHtml = reviews.length ? `<section><div class="wrap"><h2>${emph(d.reviewsTitle || 'Отзывы гостей')}</h2><div class="revs">${reviews.map(r => `<blockquote><div class="stars">${'★'.repeat(Math.max(1, Math.min(5, r.stars || 5)))}</div><p>${esc(r.text)}</p><cite>${esc(r.name || 'Гость')}</cite></blockquote>`).join('')}</div>${d.reviewsNote ? `<p class="note">${esc(d.reviewsNote)}</p>` : ''}</div></section>` : '';
    const socials = [
      phone && `<a class="soc" href="tel:${esc(digits(phone))}">📞 ${esc(phone)}</a>`,
      wa && `<a class="soc" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>`,
      tg && `<a class="soc" href="https://t.me/${esc(tg)}" target="_blank" rel="noopener">Telegram</a>`,
      ig && `<a class="soc" href="https://instagram.com/${esc(ig)}" target="_blank" rel="noopener">Instagram</a>`,
      vk && `<a class="soc" href="https://vk.com/${esc(vk)}" target="_blank" rel="noopener">ВКонтакте</a>`,
    ].filter(Boolean).join('');

    const css = `
:root{--bg:${st.bg};--fg:${st.fg};--muted:${st.muted};--card:${st.card};--line:${st.line};--accent:${accent};--r:${st.radius};--df:${st.dfont};--bf:${st.bfont}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--bf);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{max-width:1080px;margin:0 auto;padding:0 max(18px,env(safe-area-inset-left))}
header.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
header.top .wrap{display:flex;align-items:center;gap:12px;height:64px}
.logo{font-family:var(--df);font-weight:${st.dweight};font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;${st.upper ? 'text-transform:uppercase;letter-spacing:.04em;' : ''}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:999px;padding:12px 22px;font-weight:700;text-decoration:none;border:0;cursor:pointer;font:inherit;font-weight:700;white-space:nowrap}
.btn.main{background:var(--accent);color:#fff;${st.border ? `border:${st.border};box-shadow:${st.shadow};` : ''}}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--fg)}
.btn.sm{padding:8px 14px;font-size:14px}
.hero{padding:72px 0 56px;position:relative;overflow:hidden}
${bg ? `.hero{background:linear-gradient(180deg,color-mix(in srgb,var(--bg) 55%,transparent),var(--bg)),url("${esc(bg)}") center/cover}` : ''}
.pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px}
.pill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:5px 12px;font-size:13px;font-weight:600;color:var(--muted)}
.pill b{background:var(--fg);color:var(--bg);border-radius:6px;padding:1px 6px;font-size:12px}
h1{font-family:var(--df);font-weight:${st.dweight};font-size:clamp(40px,8vw,84px);line-height:1.02;margin:0 0 18px;letter-spacing:-.01em;text-wrap:balance;${st.upper ? 'text-transform:uppercase;' : ''}}
h1 span{display:block}
h1 em,h2 em{color:var(--accent);font-style:${d.style === 'bold' || d.style === 'dark' || d.style === 'clean' ? 'normal' : 'italic'}}
.sub{font-size:clamp(16px,2.2vw,19px);color:var(--muted);max-width:620px;margin:0 0 30px}
.cta{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.cta .tel{color:var(--muted);text-decoration:none;font-weight:600}
section{padding:56px 0}
h2{font-family:var(--df);font-weight:${st.dweight};font-size:clamp(30px,5vw,46px);line-height:1.1;margin:0 0 28px;text-wrap:balance;${st.upper ? 'text-transform:uppercase;' : ''}}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
.item{background:var(--card);border:${st.border || '1px solid var(--line)'};border-radius:var(--r);padding:20px;display:flex;flex-direction:column;gap:8px;${st.shadow ? `box-shadow:${st.shadow};` : ''}}
.item img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:calc(var(--r) - 6px);margin-bottom:4px}
.item .emoji{font-size:40px;line-height:1}
.item h3{margin:0;font-size:18px}
.item p{margin:0;color:var(--muted);font-size:14px;flex:1}
.price-row{display:flex;align-items:center;justify-content:space-between;margin-top:6px}
.price{font-weight:800;white-space:nowrap}
.add{width:38px;height:38px;border-radius:50%;border:0;background:var(--accent);color:#fff;font-size:22px;line-height:1;cursor:pointer;flex:none}
.add.sm{width:30px;height:30px;font-size:18px;margin-left:10px}
.add.ok{background:var(--fg)}
.menu-sec{margin-bottom:30px}
.sec-t{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);margin:0 0 10px}
.row{display:flex;align-items:baseline;gap:10px;padding:12px 0;border-bottom:1px dashed var(--line)}
.row small{display:block;color:var(--muted);font-size:13px}
.row .dots{flex:1}
.feats{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:22px}
.feat h3{margin:8px 0 6px;font-size:18px}.feat p{margin:0;color:var(--muted)}
.ficon{width:48px;height:48px;border-radius:14px;background:color-mix(in srgb,var(--accent) 14%,transparent);display:grid;place-items:center;font-size:24px}
.about p{font-size:18px;max-width:720px;color:var(--muted)}
.revs{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
blockquote{margin:0;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:20px}
blockquote p{margin:8px 0 12px}.stars{color:var(--accent);letter-spacing:2px}cite{font-style:normal;font-weight:700;font-size:14px}
.note{color:var(--muted);font-size:13px;margin-top:14px}
.contacts{background:var(--card);border-top:1px solid var(--line)}
.cgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px}
.cgrid h3{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:0 0 8px}
.cgrid p{margin:0;font-size:17px}
.socs{display:flex;gap:8px;flex-wrap:wrap}
.soc{border:1px solid var(--line);border-radius:999px;padding:8px 14px;text-decoration:none;font-weight:600;font-size:14px;background:var(--bg)}
footer{padding:28px 0 110px;color:var(--muted);font-size:13px}
.ribbon{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:40;background:#111;color:#fff;border-radius:999px;padding:10px 12px 10px 18px;display:flex;align-items:center;gap:12px;font:600 13px/1.3 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3);max-width:calc(100% - 24px)}
.ribbon a{background:#fff;color:#111;border-radius:999px;padding:7px 12px;text-decoration:none;white-space:nowrap}
.cartbtn{position:fixed;right:16px;bottom:76px;z-index:41;display:none}
.cartbtn.show{display:inline-flex}
.sheet{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.45);display:none;align-items:flex-end;justify-content:center}
.sheet.show{display:flex}
.sheet .box{background:var(--bg);width:100%;max-width:520px;border-radius:22px 22px 0 0;padding:22px;max-height:80vh;overflow:auto}
.sheet h3{margin:0 0 12px;font-family:var(--df);font-size:26px}
.cl{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}
.cl span{flex:1}.cl button{width:28px;height:28px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer}
.sheet textarea{width:100%;margin:12px 0;border:1px solid var(--line);border-radius:12px;padding:10px;font:inherit;background:var(--card);color:var(--fg)}
@media (max-width:600px){header.top .tel-top{display:none}.hero{padding:48px 0 40px}section{padding:40px 0}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}`;

    const js = canOrder ? `
(function(){var items=${JSON.stringify(allItems.map(i => ({ n: String(i.name || ''), p: String(i.price || '') }))).replace(/</g, '\\u003c')};var cart={};
var wa=${JSON.stringify(wa)},tg=${JSON.stringify(tg)};
function upd(){var n=0;for(var k in cart)n+=cart[k];var b=document.getElementById('cartbtn');b.classList.toggle('show',n>0);document.getElementById('cn').textContent=n;
var l=document.getElementById('cl');l.innerHTML='';for(var k in cart){var d=document.createElement('div');d.className='cl';var s=document.createElement('span');s.textContent=items[k].n+' × '+cart[k];var m=document.createElement('button');m.textContent='−';m.onclick=(function(k){return function(){cart[k]--;if(!cart[k])delete cart[k];upd();}})(k);d.appendChild(s);d.appendChild(m);l.appendChild(d);}}
document.addEventListener('click',function(e){var a=e.target.closest('[data-add]');if(a){var i=a.getAttribute('data-add');cart[i]=(cart[i]||0)+1;a.classList.add('ok');a.textContent='✓';setTimeout(function(){a.classList.remove('ok');a.textContent='+'},700);upd();}});
document.getElementById('cartbtn').onclick=function(){document.getElementById('sheet').classList.add('show')};
document.getElementById('sheet').onclick=function(e){if(e.target.id==='sheet')this.classList.remove('show')};
document.getElementById('send').onclick=function(){var t='Здравствуйте! Хочу заказать:\\n';for(var k in cart)t+='• '+items[k].n+' × '+cart[k]+(items[k].p?' ('+items[k].p+')':'')+'\\n';var c=document.getElementById('cc').value.trim();if(c)t+='\\n'+c;
var u=wa?'https://wa.me/'+wa+'?text='+encodeURIComponent(t):'https://t.me/'+tg;window.open(u,'_blank');};})();` : '';

    const ribbon = opts.noRibbon ? '' : `<div class="ribbon"><span>Демо-сайт для «${esc(d.brand || 'вашего заведения')}»${author.name ? ' · сделал ' + esc(author.name) : ''}</span>${author.link ? `<a href="${esc(author.link)}" target="_blank" rel="noopener">Хочу такой</a>` : ''}</div>`;

    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(d.brand || 'Демо-сайт')}${d.city ? ' — ' + esc(d.city) : ''}</title>
<meta name="description" content="${esc(d.subtitle || '')}">
<meta property="og:title" content="${esc(d.brand || 'Демо-сайт')}"><meta property="og:description" content="${esc(d.subtitle || '')}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=${st.fonts}&display=swap" rel="stylesheet">
<style>${css}</style></head><body>
<header class="top"><div class="wrap"><div class="logo">${esc(d.brand || '')}</div>
${phone ? `<a class="btn ghost sm tel-top" href="tel:${esc(digits(phone))}">📞 ${esc(phone)}</a>` : ''}
${hits.length || menu.length ? `<a class="btn main sm" href="#${hits.length ? 'hits' : 'menu'}">${esc(d.navCta || (menu.length || d.order ? 'Меню' : 'Услуги'))}</a>` : ''}</div></header>
<div class="hero"><div class="wrap">
${pills.length ? `<div class="pills">${pills[0] && /^[\d.,]+$/.test(pills[0]) ? `<span class="pill"><b>${esc(pills[0])}</b>${esc(pills[1] || '')}</span>` : pills.map(p => `<span class="pill">${esc(p)}</span>`).join('')}</div>` : ''}
<h1>${title.map(t => `<span>${emph(t)}</span>`).join('')}</h1>
${d.subtitle ? `<p class="sub">${esc(d.subtitle)}</p>` : ''}
<div class="cta">${hits.length || menu.length ? `<a class="btn main" href="#${hits.length ? 'hits' : 'menu'}">${esc(d.cta || 'Смотреть меню')}</a>` : wa ? `<a class="btn main" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">${esc(d.cta || 'Записаться')}</a>` : ''}
${phone ? `<a class="tel" href="tel:${esc(digits(phone))}">📞 ${esc(phone)}</a>` : ''}</div>
</div></div>
${hitsHtml}${menuHtml}${featHtml}${aboutHtml}${revHtml}
<section class="contacts" id="contacts"><div class="wrap"><h2>${emph(d.contactsTitle || 'Как нас найти')}</h2><div class="cgrid">
${d.address ? `<div><h3>Адрес</h3><p>${esc([d.city, d.address].filter(Boolean).join(', '))}</p><p style="margin-top:8px"><a href="https://yandex.ru/maps/?text=${mapQ}" target="_blank" rel="noopener">Открыть на карте →</a></p></div>` : ''}
${d.hours ? `<div><h3>Часы работы</h3><p>${esc(d.hours)}</p></div>` : ''}
${socials ? `<div><h3>Связаться</h3><div class="socs">${socials}</div></div>` : ''}
</div></div></section>
<footer><div class="wrap">© ${new Date().getFullYear()} ${esc(d.brand || '')}${d.footer ? ' · ' + esc(d.footer) : ''}</div></footer>
${canOrder ? `<button class="btn main cartbtn" id="cartbtn">🛒 Заказ · <span id="cn">0</span></button>
<div class="sheet" id="sheet"><div class="box"><h3>Ваш заказ</h3><div id="cl"></div><textarea id="cc" rows="2" placeholder="Имя, адрес или время, когда заберёте"></textarea>
<button class="btn main" id="send" style="width:100%">Отправить заказ в ${wa ? 'WhatsApp' : 'Telegram'}</button></div></div>` : ''}
${ribbon}
<script>${js}<\/script></body></html>`;
  }

  // Упаковка данных демо в короткую ссылку (сжатие + base64url)
  async function pack(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let out = bytes, prefix = 'j';
    if (typeof CompressionStream !== 'undefined') {
      const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      out = new Uint8Array(await new Response(cs).arrayBuffer()); prefix = 'z';
    }
    let bin = ''; out.forEach(b => bin += String.fromCharCode(b));
    return prefix + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function unpack(str) {
    const prefix = str[0]; const b64 = str.slice(1).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64); const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    if (prefix === 'z') {
      const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return JSON.parse(await new Response(ds).text());
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  window.DemoSite = { render, pack, unpack, styles: Object.keys(STYLES) };
})();
