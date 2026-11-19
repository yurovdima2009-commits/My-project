/* EROFEY CYBER ARENA — UI logic (tabs, tariffs, booking calculator, etc.) */
(function () {
  'use strict';

  /* ---------------- Data (demo prices) ---------------- */
  const RATES = { // ₽ per hour: morning 09–13, day 13–23, night 23–09
    pc:   { name: 'PC ZONE',  m: 120, d: 170, n: 140 },
    vip:  { name: 'VIP',      m: 200, d: 260, n: 220 },
    ps5:  { name: 'PS5 ZONE', m: 250, d: 320, n: 280 },
    boot: { name: 'BOOTCAMP', m: 900, d: 1200, n: 1000 }
  };

  const ZONES = {
    pc: {
      title: 'PC ZONE', tag: '30 ПК', price: 'от 120 ₽',
      img: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&q=75&auto=format&fit=crop',
      desc: 'Общий зал с неоновым светом и звукоизоляцией. Идеально, чтобы собрать пати и поднять рейтинг.',
      features: ['RTX 4070 Ti + мониторы 240 Гц', 'Механика, топовые мыши и гарнитуры', 'Все онлайн-игры и лаунчеры', 'Мультиплеер и места рядом для пати', 'Доставка снеков прямо к месту']
    },
    vip: {
      title: 'VIP', tag: '6 ПК', price: 'от 200 ₽',
      img: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1200&q=75&auto=format&fit=crop',
      desc: 'Отдельная комната с приглушённым светом, широкими столами и OLED-мониторами 360 Гц.',
      features: ['RTX 4080 Super + OLED 360 Гц', 'Кресла премиум-класса', 'Отдельный кондиционер', 'Тишина и приватность', 'Приоритет в турнирах клуба']
    },
    ps5: {
      title: 'PS5 ZONE', tag: '3 ЛОЖИ', price: 'от 250 ₽',
      img: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=1200&q=75&auto=format&fit=crop',
      desc: 'Ложи с большими диванами и 65" 4K-телевизорами. Цена — за всю консоль, играйте хоть вчетвером.',
      features: ['PS5 Pro + 65" 4K 120 Гц', 'До 4 геймпадов DualSense', 'EA FC, Mortal Kombat, Tekken, GT7', 'Саундбар 5.1', 'Можно отметить день рождения']
    },
    boot: {
      title: 'BOOTCAMP', tag: '5 ПК', price: 'от 900 ₽',
      img: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=1200&q=75&auto=format&fit=crop',
      desc: 'Закрытая комната на 5 мест для команд: тренировки, разбор демок и подготовка к турнирам.',
      features: ['5 ПК уровня VIP в одной комнате', 'Экран 75" для разбора демок', 'Маркерная доска и голосовая связь', 'Цена — за всю комнату', 'Пакеты на неделю для команд']
    }
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

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
  $$('.img-wrap img').forEach((img) => {
    const mark = () => img.classList.add('is-broken');
    if (img.complete && img.naturalWidth === 0 && img.src) mark();
    img.addEventListener('error', mark);
    img.addEventListener('load', () => img.classList.remove('is-broken'));
  });

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

  /* ---------------- Countdown: end of current month ---------------- */
  const cd = $('#countdown');
  function tick() {
    const n = khvNow();
    const end = new Date(n.getFullYear(), n.getMonth() + 1, 1, 0, 0, 0);
    let s = Math.max(0, Math.floor((end - n) / 1000));
    const d = Math.floor(s / 86400); s %= 86400;
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    cd.textContent = (d > 0 ? d + 'д ' : '') + `${h}:${m}:${sec}`;
  }
  if (cd) { tick(); setInterval(tick, 1000); }

  /* ---------------- Zones tabs ---------------- */
  const zoneImg = $('#zone-img');
  function renderZone(key, animate) {
    const z = ZONES[key];
    $('#zone-title').textContent = z.title;
    $('#zone-tag').textContent = z.tag;
    $('#zone-desc').textContent = z.desc;
    $('#zone-price').textContent = z.price.replace('от ', '');
    rub($('#zone-price'));
    $('#zone-book').textContent = 'Забронировать ' + z.title;
    $('#zone-book').dataset.zone = key;
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
    if (zone) { $('#f-zone').value = zone; updateCalc(); }
  });

  /* ---------------- Current tariff highlight ---------------- */
  (function highlightTariff() {
    const h = khvNow().getHours();
    $$('.tariff').forEach((el) => {
      const from = +el.dataset.from, to = +el.dataset.to;
      const inRange = from < to ? (h >= from && h < to) : (h >= from || h < to);
      el.classList.toggle('is-now', inRange);
    });
  })();

  /* ---------------- Booking calculator ---------------- */
  const fZone = $('#f-zone'), fDate = $('#f-date'), fStart = $('#f-start'),
    fHours = $('#f-hours'), fHoursVal = $('#f-hours-val'), fNew = $('#f-new');

  for (let h = 0; h < 24; h++) {
    const o = document.createElement('option');
    o.value = h; o.textContent = String(h).padStart(2, '0') + ':00';
    fStart.appendChild(o);
  }
  const nowK = khvNow();
  fStart.value = String((nowK.getHours() + 1) % 24);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  fDate.value = iso(nowK);
  fDate.min = iso(nowK);

  const periodOf = (h) => (h >= 9 && h < 13 ? 'm' : h >= 13 && h < 23 ? 'd' : 'n');
  const PERIOD_NAME = { m: 'Утро', d: 'День', n: 'Ночь' };
  const fmt = (n) => n.toLocaleString('ru-RU') + ' ₽';

  function updateCalc() {
    const r = RATES[fZone.value];
    const hours = +fHours.value;
    const start = +fStart.value;
    fHoursVal.textContent = hours;
    const buckets = { m: 0, d: 0, n: 0 };
    let total = 0, firstHour = 0;
    for (let i = 0; i < hours; i++) {
      const p = periodOf((start + i) % 24);
      buckets[p]++;
      total += r[p];
      if (i === 0) firstHour = r[p];
    }
    const lines = $('#calc-lines');
    lines.innerHTML = '';
    Object.keys(buckets).forEach((p) => {
      if (!buckets[p]) return;
      const div = document.createElement('div');
      div.innerHTML = `<span>${r.name} · ${PERIOD_NAME[p]} · ${buckets[p]} ч × ${fmt(r[p])}</span><span>${fmt(buckets[p] * r[p])}</span>`;
      lines.appendChild(div);
    });
    if (fNew.checked) {
      const div = document.createElement('div');
      div.className = 'is-bonus';
      div.innerHTML = `<span>🎁 Первый час в подарок</span><span>−${fmt(firstHour)}</span>`;
      lines.appendChild(div);
      total -= firstHour;
    }
    $('#calc-total').textContent = fmt(total);
    rub($('#calc-total'));
  }
  [fZone, fStart, fHours, fNew, fDate].forEach((el) => el.addEventListener('input', updateCalc));
  updateCalc();

  $('#booking-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    let ok = true;
    $$('input[required]', form).forEach((inp) => {
      const bad = !inp.value.trim() || (inp.type === 'tel' && inp.value.replace(/\D/g, '').length < 10);
      inp.classList.toggle('is-invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { toast('Заполни имя и телефон — мы перезвоним для подтверждения'); return; }
    toast(`Заявка принята! ${RATES[fZone.value].name}, ${fDate.value.split('-').reverse().join('.')} в ${fStart.options[fStart.selectedIndex].text}. Перезвоним в течение 5 минут 🎮`, 5000);
    form.name.value = ''; form.phone.value = '';
  });
  $$('#booking-form input[required]').forEach((i) => i.addEventListener('input', () => i.classList.remove('is-invalid')));

  // simple phone mask
  const phone = $('#booking-form input[type="tel"]');
  phone.addEventListener('input', () => {
    let d = phone.value.replace(/\D/g, '');
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

  /* ---------------- Reveal on scroll ---------------- */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    $$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 80 + 'ms'; io.observe(el); });
  } else {
    $$('.reveal').forEach((el) => el.classList.add('is-visible'));
  }

  $('#year').textContent = new Date().getFullYear();
})();
