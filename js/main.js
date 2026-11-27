/* Фиджитал центр Хабаровск — UI logic (zones, price list) */
(function () {
  'use strict';

  /* ---------------- Price list (from the centre's official price list) ----------------
     wd = будни, we = выходные; keys = package length in hours */
  const PRICES = {
    pc:         { name: 'PC',              game: true,  wd: { 1: 110, 3: 300, 5: 450, 8: 700 },   we: { 1: 140, 3: 400, 5: 600, 8: 1000 } },
    ps:         { name: 'Sony PlayStation', game: true, wd: { 1: 250, 3: 650, 5: 1100, 8: 1600 }, we: { 1: 300, 3: 800, 5: 1300, 8: 2000 } },
    vr:         { name: 'VR',              game: true,  wd: { 1: 450, 3: 1200, 5: 2000, 8: 3000 }, we: { 1: 550, 3: 1300, 5: 2200, 8: 3800 } },
    switch:     { name: 'Nintendo Switch', game: true,  wd: { 1: 120, 3: 300, 5: 500, 8: 800 },   we: { 1: 140, 3: 350, 5: 600, 8: 1000 } },
    workout:    { name: 'Зона воркаут',    game: false, wd: { 1: 500, 3: 1200 },                  we: { 1: 600, 3: 1500 } },
    streetball: { name: 'Зона стритбол',   game: false, wd: { 1: 2500 },                          we: { 1: 3000 } },
    football:   { name: 'Зона футбол',     game: false, wd: { 1: 3000 },                          we: { 1: 3500 } }
  };
  const OPEN_H = 10, CLOSE_H = 21;

  const ZONES = {
    pc: {
      title: 'PC ЗОНА', tag: '20 ПК', from: 110, book: 'pc',
      imgs: ['assets/zones/pc-1.jpg', 'assets/zones/pc-2.jpg'],
      desc: 'Компьютерный зал на 20 мест с одинаковыми мощными ПК. Собирай пати и поднимай рейтинг.',
      features: ['Intel Core i5-13600KF + RTX 4060', 'Samsung Odyssey G4 — 240 Гц', 'Клавиатура Adamant, мышь Mirror, гарнитура Genezis', 'Кресла Zone 51 Clubpoint', 'Пакеты 3, 5 и 8 часов']
    },
    ps: {
      title: 'PLAYSTATION', tag: 'КОНСОЛИ', from: 250, book: 'ps',
      imgs: ['assets/zones/ps.jpg'],
      desc: 'Консоли Sony PlayStation на большом экране. Цена — за консоль, играйте компанией.',
      features: ['Файтинги, гонки, футбол', 'Удобно играть вдвоём и компанией', 'Подходит для дня рождения', 'Пакеты 3, 5 и 8 часов']
    },
    vr: {
      title: 'VR', tag: 'ВИРТУАЛЬНОСТЬ', from: 450, book: 'vr',
      imgs: ['assets/zones/vr.jpg'],
      desc: 'Шлем на голову — и ты внутри игры. Отличный вариант впервые попробовать виртуальную реальность.',
      features: ['Игры с полным погружением', 'Администратор поможет настроить шлем', 'Для детей и взрослых', 'Пакеты 3, 5 и 8 часов']
    },
    switch: {
      title: 'NINTENDO SWITCH', tag: 'КОНСОЛЬ', from: 120, book: 'switch',
      imgs: ['assets/zones/switch.jpg'],
      desc: 'Весёлые игры для компании и семьи — от гонок до вечеринок.',
      features: ['Игры для компании', 'Подходит для детей', 'Дешевле всего — от 120 ₽', 'Пакеты 3, 5 и 8 часов']
    },
    sport: {
      title: 'СПОРТ', tag: '3 ПЛОЩАДКИ', from: 500, book: 'workout',
      imgs: ['assets/zones/sport-1.jpg', 'assets/zones/sport-2.jpg', 'assets/zones/sport-3.jpg'],
      desc: 'Физическая часть фиджитала: тренируйся и играй на настоящих площадках.',
      features: ['Зона воркаута — от 500 ₽/час', 'Зона стритбола — от 2500 ₽/час', 'Зона футбола — от 3000 ₽/час', 'Аренда для команды и тренировок']
    }
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = (n) => n.toLocaleString('ru-RU') + ' ₽';
  const hoursWord = (h) => (h === 1 ? 'час' : h < 5 ? 'часа' : 'часов');

  // the pixel font has no ₽ glyph — render the sign in the display font
  function rub(el) {
    if (el && el.textContent.includes('₽')) el.innerHTML = el.textContent.replace(/\s*₽/, '<span class="rub">₽</span>');
  }
  $$('.pixel').forEach(rub);

  /* ---------------- Toast ---------------- */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg, ms = 3600) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), ms);
  }
  window.addEventListener('eca:toast', (e) => toast(e.detail.msg, e.detail.ms));

  /* ---------------- Broken images → keep gradient placeholder ---------------- */
  function watchImg(img) {
    const mark = () => img.classList.add('is-broken');
    if (img.complete && img.naturalWidth === 0 && img.src) mark();
    img.addEventListener('error', mark);
    img.addEventListener('load', () => img.classList.remove('is-broken'));
  }
  $$('.img-wrap img').forEach(watchImg);

  /* ---------------- Header ---------------- */
  const header = $('.header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const burger = $('#burger');
  const nav = $('#nav');
  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  $$('a', nav).forEach((a) => a.addEventListener('click', () => {
    burger.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  }));

  /* ---------------- Khabarovsk time (UTC+10) ---------------- */
  function khvNow() {
    const now = new Date();
    return new Date(now.getTime() + (now.getTimezoneOffset() + 600) * 60000);
  }
  const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

  /* ---------------- Open / closed status ---------------- */
  function updateOpen() {
    const n = khvNow();
    const open = n.getHours() >= OPEN_H && n.getHours() < CLOSE_H;
    $('#open-status').textContent = open ? 'Открыто до 21:00' : 'Сейчас закрыто · откроемся в 10:00';
    $('#open-dot').classList.toggle('is-closed', !open);
  }
  updateOpen();
  setInterval(updateOpen, 60000);

  /* ---------------- Zones tabs ---------------- */
  const zoneImg = $('#zone-img');
  const zonePrev = $('#zone-prev'), zoneNext = $('#zone-next'), zoneDots = $('#zone-dots');
  let zoneKey = 'pc', slide = 0;

  function showSlide(i, animate) {
    const z = ZONES[zoneKey];
    const n = z.imgs.length;
    slide = n ? (i + n) % n : 0;
    const apply = () => {
      if (n) { zoneImg.src = z.imgs[slide]; zoneImg.classList.remove('is-broken'); }
      else { zoneImg.removeAttribute('src'); zoneImg.classList.add('is-broken'); }
      zoneImg.alt = `Зона ${z.title}${n > 1 ? ` — фото ${slide + 1} из ${n}` : ''}`;
      zoneImg.classList.remove('is-switching');
    };
    if (animate) { zoneImg.classList.add('is-switching'); setTimeout(apply, 220); } else apply();
    const multi = n > 1;
    zonePrev.hidden = zoneNext.hidden = zoneDots.hidden = !multi;
    zoneDots.innerHTML = '';
    if (multi) z.imgs.forEach((_, k) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'zone__dot' + (k === slide ? ' is-active' : '');
      d.setAttribute('aria-label', `Фото ${k + 1}`);
      d.addEventListener('click', () => showSlide(k, true));
      zoneDots.appendChild(d);
    });
  }
  zonePrev.addEventListener('click', () => showSlide(slide - 1, true));
  zoneNext.addEventListener('click', () => showSlide(slide + 1, true));
  // swipe on touch screens
  let swipeX = null;
  const media = $('.zone__media');
  media.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') swipeX = e.clientX; });
  media.addEventListener('pointerup', (e) => {
    if (swipeX === null) return;
    const dx = e.clientX - swipeX; swipeX = null;
    if (Math.abs(dx) > 40 && ZONES[zoneKey].imgs.length > 1) showSlide(slide + (dx < 0 ? 1 : -1), true);
  });
  media.addEventListener('pointercancel', () => { swipeX = null; });

  function renderZone(key, animate) {
    const z = ZONES[key];
    zoneKey = key;
    $('#zone-title').textContent = z.title;
    $('#zone-tag').textContent = z.tag;
    $('#zone-desc').textContent = z.desc;
    $('#zone-price').textContent = fmt(z.from);
    rub($('#zone-price'));
    const ul = $('#zone-features');
    ul.innerHTML = '';
    z.features.forEach((f, i) => {
      const li = document.createElement('li');
      li.textContent = f;
      li.style.animationDelay = i * 60 + 'ms';
      ul.appendChild(li);
    });
    showSlide(0, animate);
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => { x.classList.toggle('is-active', x === t); x.setAttribute('aria-selected', String(x === t)); });
    renderZone(t.dataset.zone, true);
  }));
  renderZone('pc', false);

  /* ---------------- Price list with weekday / weekend toggle ---------------- */
  const grid = $('#price-grid');
  let dayType = isWeekend(khvNow()) ? 'we' : 'wd';
  const todayType = dayType;

  function renderPrices() {
    $$('.daytoggle__btn').forEach((b) => b.classList.toggle('is-active', b.dataset.day === dayType));
    const shown = dayType === 'we' ? 'на выходные (сб–вс)' : 'на будни (пн–пт)';
    const today = todayType === 'we' ? 'выходной' : 'будний день';
    $('#shown-label').innerHTML = dayType === todayType
      ? `Показаны цены <b>${shown}</b> — сегодня ${today}, это ваши цены.`
      : `Показаны цены <b>${shown}</b>. Сегодня ${today} — цены на сегодня на вкладке «${todayType === 'we' ? 'Выходные' : 'Будни'}».`;
    grid.innerHTML = '';
    const groups = [
      ['Игровые зоны', true, 'price-grid__row'],
      ['Спортивные зоны · аренда площадки', false, 'price-grid__row price-grid__row--sport']
    ];
    groups.forEach(([title, isGame, cls]) => {
      const h = document.createElement('h3');
      h.className = 'price-grid__title';
      h.textContent = title;
      const row = document.createElement('div');
      row.className = cls;
      grid.append(h, row);
      Object.entries(PRICES).filter(([, z]) => z.game === isGame).forEach(([key, z]) => renderCard(row, key, z));
    });
  }
  function renderCard(row, key, z) {
      const card = document.createElement('article');
      card.className = 'price-card' + (z.game ? '' : ' price-card--sport');
      const rows = Object.entries(z[dayType]).map(([h, p]) =>
        `<li><span>${h} ${hoursWord(+h)}</span><b class="pixel">${p}<span class="rub">₽</span></b></li>`
      ).join('');
      card.innerHTML = `
        <div class="price-card__head"><h3>${z.name}</h3>${z.game ? '<span class="price-card__gift">1-й час 0 ₽</span>' : '<span class="price-card__kind">аренда</span>'}</div>
        <ul>${rows}</ul>`;
      row.appendChild(card);
  }
  $$('.daytoggle__btn').forEach((b) => b.addEventListener('click', () => { dayType = b.dataset.day; renderPrices(); }));

  renderPrices();

  initCommon();

  /* ---------------- Reveal on scroll + footer year (shared by all pages) ---------------- */
  function initCommon() {
    if ('IntersectionObserver' in window) {
      document.documentElement.classList.add('js-reveal');
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
        });
      }, { threshold: 0.12 });
      $$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 80 + 'ms'; io.observe(el); });
    }
    const y = $('#year');
    if (y) y.textContent = new Date().getFullYear();
  }
})();
