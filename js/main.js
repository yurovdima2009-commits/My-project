/* Фиджитал центр Хабаровск — UI logic (zones, price list, booking calculator) */
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
      img: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&q=75&auto=format&fit=crop',
      desc: 'Компьютерный зал на 20 мест с одинаковыми мощными ПК. Собирай пати и поднимай рейтинг.',
      features: ['Intel Core i5-13600KF + RTX 4060', 'Samsung Odyssey G4 — 240 Гц', 'Клавиатура Adamant, мышь Mirror, гарнитура Genezis', 'Кресла Zone 51 Clubpoint', 'Пакеты 3, 5 и 8 часов']
    },
    ps: {
      title: 'PLAYSTATION', tag: 'КОНСОЛИ', from: 250, book: 'ps',
      img: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=1200&q=75&auto=format&fit=crop',
      desc: 'Консоли Sony PlayStation на большом экране. Цена — за консоль, играйте компанией.',
      features: ['Файтинги, гонки, футбол', 'Удобно играть вдвоём и компанией', 'Подходит для дня рождения', 'Пакеты 3, 5 и 8 часов']
    },
    vr: {
      title: 'VR', tag: 'ВИРТУАЛЬНОСТЬ', from: 450, book: 'vr',
      img: 'https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=1200&q=75&auto=format&fit=crop',
      desc: 'Шлем на голову — и ты внутри игры. Отличный вариант впервые попробовать виртуальную реальность.',
      features: ['Игры с полным погружением', 'Администратор поможет настроить шлем', 'Для детей и взрослых', 'Пакеты 3, 5 и 8 часов']
    },
    switch: {
      title: 'NINTENDO SWITCH', tag: 'КОНСОЛЬ', from: 120, book: 'switch',
      img: 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=1200&q=75&auto=format&fit=crop',
      desc: 'Весёлые игры для компании и семьи — от гонок до вечеринок.',
      features: ['Игры для компании', 'Подходит для детей', 'Дешевле всего — от 120 ₽', 'Пакеты 3, 5 и 8 часов']
    },
    sport: {
      title: 'СПОРТ', tag: '3 ПЛОЩАДКИ', from: 500, book: 'workout',
      img: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200&q=75&auto=format&fit=crop',
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
  function renderZone(key, animate) {
    const z = ZONES[key];
    $('#zone-title').textContent = z.title;
    $('#zone-tag').textContent = z.tag;
    $('#zone-desc').textContent = z.desc;
    $('#zone-price').textContent = fmt(z.from);
    rub($('#zone-price'));
    $('#zone-book').textContent = 'Забронировать ' + z.title;
    $('#zone-book').dataset.zone = z.book;
    const ul = $('#zone-features');
    ul.innerHTML = '';
    z.features.forEach((f, i) => {
      const li = document.createElement('li');
      li.textContent = f;
      li.style.animationDelay = i * 60 + 'ms';
      ul.appendChild(li);
    });
    if (animate) {
      zoneImg.classList.add('is-switching');
      setTimeout(() => {
        zoneImg.src = z.img;
        zoneImg.alt = 'Зона ' + z.title;
        zoneImg.classList.remove('is-switching');
      }, 250);
    }
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => { x.classList.toggle('is-active', x === t); x.setAttribute('aria-selected', String(x === t)); });
    renderZone(t.dataset.zone, true);
  }));
  renderZone('pc', false);
  $('#zone-book').addEventListener('click', (e) => {
    const zone = e.currentTarget.dataset.zone;
    if (zone) { fZone.value = zone; fillHours(); updateCalc(); }
  });

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
    $$('.price-card__btn', grid).forEach((b) => b.addEventListener('click', () => {
      fZone.value = b.dataset.zone; fillHours(); updateCalc();
      $('#booking').scrollIntoView({ behavior: 'smooth' });
    }));
  }
  function renderCard(row, key, z) {
      const card = document.createElement('article');
      card.className = 'price-card' + (z.game ? '' : ' price-card--sport');
      const rows = Object.entries(z[dayType]).map(([h, p]) =>
        `<li><span>${h} ${hoursWord(+h)}</span><b class="pixel">${p}<span class="rub">₽</span></b></li>`
      ).join('');
      card.innerHTML = `
        <div class="price-card__head"><h3>${z.name}</h3>${z.game ? '<span class="price-card__gift">1-й час 0 ₽</span>' : '<span class="price-card__kind">аренда</span>'}</div>
        <ul>${rows}</ul>
        <button class="price-card__btn" type="button" data-zone="${key}">Выбрать →</button>`;
      row.appendChild(card);
  }
  $$('.daytoggle__btn').forEach((b) => b.addEventListener('click', () => { dayType = b.dataset.day; renderPrices(); }));

  /* ---------------- Booking calculator ---------------- */
  const fZone = $('#f-zone'), fDate = $('#f-date'), fStart = $('#f-start'), fHours = $('#f-hours');

  Object.entries(PRICES).forEach(([key, z]) => {
    const o = document.createElement('option');
    o.value = key; o.textContent = z.name;
    fZone.appendChild(o);
  });
  for (let h = OPEN_H; h < CLOSE_H; h++) {
    const o = document.createElement('option');
    o.value = h; o.textContent = String(h).padStart(2, '0') + ':00';
    fStart.appendChild(o);
  }
  const nowK = khvNow();
  let startDay = new Date(nowK);
  if (nowK.getHours() >= CLOSE_H - 1) startDay.setDate(startDay.getDate() + 1);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  fDate.value = iso(startDay);
  fDate.min = iso(nowK);
  const nextHour = nowK.getHours() + 1;
  fStart.value = String(nextHour >= OPEN_H && nextHour < CLOSE_H ? nextHour : OPEN_H);

  function fillHours() {
    const z = PRICES[fZone.value];
    const prev = fHours.value;
    fHours.innerHTML = '';
    Object.keys(z.wd).forEach((h) => {
      const o = document.createElement('option');
      o.value = h; o.textContent = `${h} ${hoursWord(+h)}`;
      fHours.appendChild(o);
    });
    if ([...fHours.options].some((o) => o.value === prev)) fHours.value = prev;
  }

  function selectedDayType() {
    const [y, m, d] = (fDate.value || iso(nowK)).split('-').map(Number);
    return isWeekend(new Date(y, m - 1, d)) ? 'we' : 'wd';
  }

  function updateCalc() {
    const z = PRICES[fZone.value];
    const dt = selectedDayType();
    const hours = +fHours.value;
    const start = +fStart.value;
    const price = z[dt][hours];
    const lines = $('#calc-lines');
    lines.innerHTML = '';
    const add = (l, r, cls) => {
      const div = document.createElement('div');
      if (cls) div.className = cls;
      div.innerHTML = `<span>${l}</span><span>${r}</span>`;
      lines.appendChild(div);
    };
    add(`${z.name} · ${dt === 'we' ? 'выходные' : 'будни'} · ${hours} ${hoursWord(hours)}`, fmt(price));
    let total = price;
    if (z.game) {
      const gift = Math.min(z[dt][1], price);
      add('🎁 Первый час бесплатно', '−' + fmt(gift), 'is-bonus');
      total -= gift;
    }
    if (start + hours > CLOSE_H) {
      add(`⚠ Центр закрывается в 21:00 — начни не позже ${String(CLOSE_H - hours).padStart(2, '0')}:00`, '', 'is-warn');
    }
    $('#calc-total').textContent = total + ' ₽';
    rub($('#calc-total'));
  }
  fZone.addEventListener('input', () => { fillHours(); updateCalc(); });
  [fStart, fHours, fDate].forEach((el) => el.addEventListener('input', updateCalc));
  fillHours();
  fHours.value = '3';
  renderPrices();
  updateCalc();

  $('#booking-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    let ok = true;
    $$('input[required]', form).forEach((inp) => {
      const bad = !inp.value.trim() || (inp.type === 'tel' && inp.value.replace(/\D/g, '').length < 11);
      inp.classList.toggle('is-invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { toast('Заполни имя и телефон — мы перезвоним для подтверждения'); return; }
    if (+fStart.value + +fHours.value > CLOSE_H) { toast('Центр работает до 21:00 — выбери время начала пораньше'); return; }
    toast(`Заявка принята! ${PRICES[fZone.value].name}, ${fDate.value.split('-').reverse().join('.')} в ${fStart.options[fStart.selectedIndex].text}. Администратор перезвонит 🎮`, 5000);
    $('#f-name').value = ''; $('#f-phone').value = '';
  });
  $$('#booking-form input[required]').forEach((i) => i.addEventListener('input', () => i.classList.remove('is-invalid')));

  // simple phone mask
  const phone = $('#f-phone');
  phone.addEventListener('input', () => {
    let d = phone.value.replace(/\D/g, '');
    if (!d) { phone.value = ''; return; }
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (!d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    const p = ['+7'];
    if (d.length > 1) p.push(' (' + d.slice(1, 4));
    if (d.length >= 4) p.push(') ' + d.slice(4, 7));
    if (d.length >= 7) p.push('-' + d.slice(7, 9));
    if (d.length >= 9) p.push('-' + d.slice(9, 11));
    phone.value = p.join('');
  });

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
