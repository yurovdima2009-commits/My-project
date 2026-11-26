// Работа с ИИ (Claude). Два режима:
// 1) «Через claude.ai» — приложение готовит промт, вы вставляете его в чат и копируете ответ обратно. Бесплатно, ключ не нужен.
// 2) «Через API» — в один клик, нужен свой API-ключ Anthropic (console.anthropic.com). Ключ хранится только в вашем браузере.
(function () {
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.7.0/+esm';
  let sdkPromise = null;
  const loadSdk = () => (sdkPromise ||= import(SDK_URL));

  async function ask(prompt, { apiKey, model = 'claude-opus-5-5', maxTokens = 16000, effort = 'low' } = {}) {
    if (!apiKey) throw new Error('Добавьте API-ключ в «Настройках» или используйте режим «через claude.ai».');
    let mod;
    try { mod = await loadSdk(); } catch (e) { throw new Error('Не загрузилась библиотека Claude. Проверьте интернет.'); }
    const Anthropic = mod.default || mod.Anthropic;
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    try {
      const params = {
        model, max_tokens: maxTokens,
        output_config: { effort },
        messages: [{ role: 'user', content: prompt }],
      };
      // Если модель откажется отвечать, сервер сам попробует запасную модель
      if (/^claude-(opus-5-5|sonnet-5-5|fable)/.test(model)) {
        params.betas = ['server-side-fallback-2026-07-01'];
        params.fallbacks = 'default';
      }
      const res = await client.beta.messages.create(params);
      if (res.stop_reason === 'refusal') throw new Error('ИИ отказался выполнять этот запрос. Попробуйте изменить данные.');
      const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
      if (res.stop_reason === 'max_tokens') throw new Error('Ответ получился слишком длинным и оборвался. Попробуйте ещё раз.');
      return text;
    } catch (e) {
      if (mod.AuthenticationError && e instanceof mod.AuthenticationError) throw new Error('Неверный API-ключ. Проверьте его в «Настройках».');
      if (mod.PermissionDeniedError && e instanceof mod.PermissionDeniedError) throw new Error('У ключа нет доступа к этой модели.');
      if (mod.NotFoundError && e instanceof mod.NotFoundError) throw new Error('Модель не найдена. Выберите другую в «Настройках».');
      if (mod.RateLimitError && e instanceof mod.RateLimitError) throw new Error('Слишком много запросов. Подождите минуту.');
      if (mod.APIConnectionError && e instanceof mod.APIConnectionError) throw new Error('Нет связи с сервером Claude. Проверьте интернет или VPN.');
      if (mod.APIError && e instanceof mod.APIError) throw new Error('Ошибка Claude API: ' + (e.message || e.status));
      throw e;
    }
  }

  // Достаёт JSON из ответа (даже если ИИ обернул его в ```json ... ```)
  function extractJson(text) {
    const s = String(text || '');
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = fence ? fence[1] : s;
    const start = body.indexOf('{'), end = body.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('В ответе не найден JSON. Скопируйте ответ целиком.');
    return JSON.parse(body.slice(start, end + 1));
  }

  function leadFacts(lead) {
    return [
      `Название: ${lead.name}`,
      `Тип: ${lead.cat || ''}`,
      `Город: ${lead.city || ''}`,
      lead.addr && `Адрес: ${lead.addr}`,
      lead.phone && `Телефон: ${lead.phone}`,
      lead.hours && `Часы работы (формат OpenStreetMap): ${lead.hours}`,
      lead.cuisine && `Кухня/специализация: ${lead.cuisine}`,
      lead.instagram && `Instagram: ${lead.instagram}`,
      lead.telegram && `Telegram: ${lead.telegram}`,
      lead.vk && `VK: ${lead.vk}`,
      lead.website && `Сайт: ${lead.website}`,
    ].filter(Boolean).join('\n');
  }

  function demoPrompt(lead, extra, style) {
    return `Ты — дизайнер и копирайтер. Ты делаешь для небольшого местного бизнеса демо его собственного одностраничного сайта. Демо увидит владелец до того, как что-то купит, поэтому текст должен звучать так, будто его писали именно для этого места: конкретно, тепло, без канцелярита и без пустых слов вроде «лучший», «качественный», «индивидуальный подход».

Данные о заведении:
${leadFacts(lead)}
${extra ? `\nДополнительно известно (используй это в первую очередь):\n${extra}\n` : ''}
Правила:
- Пиши по-русски.
- Не выдумывай факты, которых нет в данных: награды, годы работы, рейтинги, количество клиентов. Отзывы не пиши.
- Если меню/услуги и цены не даны, придумай 6 правдоподобных позиций для такого типа заведения, а цены пиши как «от … ₽» в разумном для России диапазоне. Это демо, владелец потом заменит их.
- Часы работы переведи в понятный вид («Пн–Пт 9:00–21:00, Сб–Вс 10:00–22:00»). Если их нет — null.
- В title 2 строки, одно ключевое слово во второй строке выдели звёздочками: *слово*.
- accent — цвет в HEX, подходящий характеру места.
- order: true для еды и товаров (гости смогут собрать заказ и отправить в WhatsApp), false для услуг с записью.

Верни ТОЛЬКО JSON, без пояснений, строго такой структуры:
{
  "v": 1,
  "style": "${style || 'warm'}",
  "brand": "название как на вывеске",
  "kind": "тип заведения",
  "city": "город",
  "address": "адрес или null",
  "phone": "телефон или null",
  "instagram": "ник или null",
  "telegram": "ник или null",
  "hours": "часы работы или null",
  "accent": "#rrggbb",
  "title": ["первая строка", "вторая *строка*"],
  "subtitle": "1–2 предложения о месте",
  "cta": "текст главной кнопки (2–3 слова)",
  "pill": ["короткая плашка 1", "плашка 2"],
  "hitsTitle": "заголовок блока популярного",
  "hits": [{"name": "…", "desc": "одна строка", "price": "от 250 ₽", "emoji": "☕"}],
  "featuresTitle": "заголовок блока преимуществ",
  "features": [{"icon": "эмодзи", "title": "…", "text": "одно предложение"}],
  "about": "абзац о месте, 2–3 предложения",
  "order": true
}
hits — 6 штук, features — 3 штуки.`;
  }

  function messagePrompt(lead, baseText, me) {
    return `Помоги написать первое сообщение владельцу местного бизнеса. Я — ${me.name || 'фрилансер'}, предлагаю: ${me.offer || 'сделать сайт'}${me.price ? ` (цена ${me.price})` : ''}.

О бизнесе:
${leadFacts(lead)}
Сайт у них: ${lead.siteStatus === 'site' ? 'есть' : lead.siteStatus === 'social' ? 'нет, только соцсети' : 'нет'}.

Вот мой черновик:
---
${baseText}
---

Перепиши его так, чтобы он звучал по-человечески и лично для этого места: упомяни одну конкретную деталь о нём. До 500 символов. Без спама, без «уникального предложения», без восклицательных знаков подряд. Если в черновике есть ссылка — сохрани её как есть. Верни только текст сообщения.`;
  }

  // Быстрое демо без ИИ: заготовки по сферам
  const PRESETS = {
    food: { style: 'warm', order: true, cta: 'Смотреть меню', hitsTitle: 'Чаще всего *берут*', featuresTitle: 'Почему к нам *возвращаются*',
      hits: [['Капучино', 'Двойной эспрессо и молоко', 'от 190 ₽', '☕'], ['Сырники', 'Со сметаной и ягодным соусом', 'от 290 ₽', '🥞'], ['Завтрак дня', 'Меняется каждое утро', 'от 390 ₽', '🍳'], ['Суп дня', 'Спросите у бариста', 'от 260 ₽', '🍲'], ['Десерт', 'Свежая выпечка', 'от 220 ₽', '🍰'], ['Лимонад', 'Домашний, 0,4 л', 'от 210 ₽', '🍋']],
      features: [['⏱', 'Быстро', 'Заказ готов, пока вы ищете, где сесть.'], ['🥡', 'С собой', 'Упакуем аккуратно, чтобы ничего не остыло.'], ['📍', 'Рядом', 'Удобно заскочить по пути.']] },
    beauty: { style: 'soft', order: false, cta: 'Записаться', hitsTitle: 'Услуги и *цены*', featuresTitle: 'Почему *нам доверяют*',
      hits: [['Маникюр с покрытием', 'Аккуратно и надолго', 'от 1 500 ₽', '💅'], ['Стрижка', 'С укладкой', 'от 1 200 ₽', '✂️'], ['Окрашивание', 'Подбор оттенка под вас', 'от 3 000 ₽', '🎨'], ['Брови', 'Коррекция и окрашивание', 'от 800 ₽', '✨'], ['Макияж', 'Дневной и вечерний', 'от 2 000 ₽', '💄'], ['Уход', 'Для волос и кожи', 'от 1 500 ₽', '🌿']],
      features: [['🧼', 'Чистота', 'Стерильные инструменты для каждого гостя.'], ['🕐', 'Без ожидания', 'Приходите ко времени — мы вас ждём.'], ['💬', 'Запись в мессенджере', 'Напишите, подберём удобное время.']] },
    dark: { style: 'dark', order: false, cta: 'Записаться', hitsTitle: 'Услуги и *цены*', featuresTitle: 'Почему *к нам*',
      hits: [['Мужская стрижка', 'С мытьём и укладкой', 'от 1 000 ₽', '✂️'], ['Борода', 'Моделирование и уход', 'от 700 ₽', '🧔'], ['Стрижка + борода', 'Комплекс', 'от 1 600 ₽', '💈'], ['Детская стрижка', 'До 12 лет', 'от 800 ₽', '👦'], ['Камуфляж седины', 'Естественный результат', 'от 900 ₽', '🎨'], ['Опасная бритва', 'Горячее полотенце', 'от 900 ₽', '🪒']],
      features: [['🎯', 'Точно', 'Стрижём так, как вы попросили.'], ['☕', 'Атмосфера', 'Кофе и спокойная музыка, пока ждёте.'], ['📲', 'Онлайн-запись', 'Напишите, и мы подберём время.']] },
    generic: { style: 'clean', order: false, cta: 'Связаться', hitsTitle: 'Чем мы *поможем*', featuresTitle: 'Почему *выбирают нас*',
      hits: [['Консультация', 'Разберёмся в задаче', 'бесплатно', '💬'], ['Основная услуга', 'Опишем подробно', 'от 1 000 ₽', '🛠'], ['Срочно', 'Когда нужно сегодня', 'по запросу', '⚡'], ['Выезд', 'По городу', 'от 500 ₽', '🚗'], ['Гарантия', 'На все работы', 'включено', '✅'], ['Для бизнеса', 'Работаем по договору', 'по запросу', '📄']],
      features: [['📍', 'Рядом', 'Работаем в вашем районе.'], ['🕐', 'Вовремя', 'Сроки обсуждаем заранее и соблюдаем.'], ['💬', 'На связи', 'Отвечаем в мессенджерах.']] },
  };
  function quickDemo(lead, style) {
    const sp = lead.sphere;
    const key = sp === 'food' ? 'food' : sp === 'beauty' ? (/барбер|barber|тату|tattoo/i.test(lead.name + lead.cat) ? 'dark' : 'beauty') : 'generic';
    const p = PRESETS[key];
    return {
      v: 1, style: style || p.style, brand: lead.name, kind: lead.cat, city: lead.city,
      address: lead.addr || null, phone: lead.phone || null, instagram: lead.instagram || null, telegram: lead.telegram || null, vk: lead.vk || null,
      hours: lead.hours || null, accent: null,
      title: [lead.name, `${lead.cat || 'Ждём'} *рядом с вами*`],
      subtitle: `${lead.cat || 'Место'} в г. ${lead.city}${lead.addr ? ', ' + lead.addr : ''}. Посмотрите, что у нас есть, и напишите — ответим быстро.`,
      cta: p.cta, pill: lead.addr ? ['📍 ' + lead.addr] : [],
      hitsTitle: p.hitsTitle, hits: p.hits.map(([name, desc, price, emoji]) => ({ name, desc, price, emoji })),
      featuresTitle: p.featuresTitle, features: p.features.map(([icon, title, text]) => ({ icon, title, text })),
      about: null, order: p.order, footer: 'позиции и цены на демо примерные',
    };
  }

  window.AI = { ask, extractJson, demoPrompt, messagePrompt, quickDemo };
})();
