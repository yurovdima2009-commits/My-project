// Учебные схемы (SVG). Цвета берутся из CSS-переменных темы.
const T = ({ x, y, children, c = 'var(--fg-2)', s = 11, a = 'start', w = 400 }) => (
  <text x={x} y={y} fill={c} fontSize={s} textAnchor={a} fontWeight={w} fontFamily="var(--f-body)">{children}</text>
);
const Box = ({ children, h = 240 }) => (
  <svg viewBox={`0 0 560 ${h}`} className="diagram" role="img">{children}</svg>
);
const Candle = ({ x, o, c, h, l, w = 14 }) => {
  const up = c <= o; // в координатах SVG меньше = выше
  return (
    <g>
      <line x1={x} x2={x} y1={h} y2={l} stroke={up ? 'var(--up)' : 'var(--dn)'} strokeWidth="1.5" />
      <rect x={x - w / 2} y={Math.min(o, c)} width={w} height={Math.max(2, Math.abs(c - o))} fill={up ? 'var(--up)' : 'var(--dn)'} rx="1" />
    </g>
  );
};
const Path = ({ d, c = 'var(--fg-1)', w = 2, dash }) => <path d={d} fill="none" stroke={c} strokeWidth={w} strokeDasharray={dash} strokeLinejoin="round" />;

export function DOrderBook() {
  const asks = [[101.5, 40], [101.3, 75], [101.2, 30], [101.1, 55], [101.0, 22]];
  const bids = [[100.9, 35], [100.8, 60], [100.7, 90], [100.6, 28], [100.5, 50]];
  return (
    <Box h={260}>
      <T x={20} y={20} c="var(--fg-1)" s={12} w={600}>Стакан заявок</T>
      <T x={20} y={36} s={10}>цена · объём (лимитные заявки)</T>
      {asks.map(([p, v], i) => (
        <g key={p}>
          <rect x={120} y={46 + i * 18} width={v * 1.6} height={15} fill="var(--dn)" opacity="0.22" />
          <T x={20} y={58 + i * 18} c="var(--dn)" s={11}>{p.toFixed(1)}</T>
          <T x={80} y={58 + i * 18} s={11}>{v}</T>
        </g>
      ))}
      <rect x={14} y={138} width={290} height={20} fill="var(--accent)" opacity="0.1" />
      <T x={20} y={152} c="var(--accent)" s={11} w={600}>спред 0,1 = 101,0 − 100,9</T>
      {bids.map(([p, v], i) => (
        <g key={p}>
          <rect x={120} y={162 + i * 18} width={v * 1.6} height={15} fill="var(--up)" opacity="0.22" />
          <T x={20} y={174 + i * 18} c="var(--up)" s={11}>{p.toFixed(1)}</T>
          <T x={80} y={174 + i * 18} s={11}>{v}</T>
        </g>
      ))}
      <T x={330} y={64} c="var(--dn)" s={12} w={600}>ASK — продавцы</T>
      <T x={330} y={80} s={11}>Хотят продать не дешевле этой цены.</T>
      <T x={330} y={96} s={11}>Лучший ask = 101,0</T>
      <T x={330} y={186} c="var(--up)" s={12} w={600}>BID — покупатели</T>
      <T x={330} y={202} s={11}>Хотят купить не дороже этой цены.</T>
      <T x={330} y={218} s={11}>Лучший bid = 100,9</T>
      <T x={330} y={140} c="var(--fg-1)" s={11} w={600}>Последняя цена = цена последней сделки,</T>
      <T x={330} y={155} c="var(--fg-1)" s={11} w={600}>когда рыночный ордер «съел» заявку.</T>
    </Box>
  );
}

export function DSlippage() {
  const lv = [[101.0, 22], [101.1, 55], [101.2, 30], [101.3, 75]];
  let rest = 100;
  return (
    <Box h={230}>
      <T x={20} y={22} c="var(--fg-1)" s={12} w={600}>Рыночная покупка 100 шт. «проедает» стакан</T>
      {lv.map(([p, v], i) => {
        const take = Math.min(rest, v); rest -= take;
        return (
          <g key={p}>
            <rect x={20} y={190 - i * 38} width={v * 3} height={28} fill="var(--dn)" opacity="0.18" rx="3" />
            <rect x={20} y={190 - i * 38} width={take * 3} height={28} fill="var(--dn)" opacity="0.6" rx="3" />
            <T x={30} y={208 - i * 38} c="var(--fg-1)" s={11} w={600}>{p.toFixed(1)}</T>
            <T x={260} y={208 - i * 38} s={11}>{take > 0 ? `куплено ${take} из ${v}` : 'не тронуто'}</T>
          </g>
        );
      })}
      <T x={390} y={80} c="var(--fg-1)" s={12} w={600}>Средняя цена входа</T>
      <T x={390} y={100} s={11}>(22×101,0 + 55×101,1 +</T>
      <T x={390} y={116} s={11}> 23×101,2) / 100 = 101,10</T>
      <T x={390} y={146} c="var(--dn)" s={12} w={600}>Проскальзывание 0,10</T>
      <T x={390} y={164} s={11}>против лучшего ask 101,0.</T>
      <T x={390} y={180} s={11}>Тонкий стакан = больше потерь.</T>
    </Box>
  );
}

export function DCandle() {
  return (
    <Box h={250}>
      <Candle x={70} o={170} c={70} h={40} l={205} w={34} />
      <T x={100} y={44}>High — максимум</T>
      <T x={100} y={74}>Close — закрытие</T>
      <T x={100} y={170}>Open — открытие</T>
      <T x={100} y={208}>Low — минимум</T>
      <T x={30} y={235} c="var(--up)" w={600}>Бычья свеча</T>
      <Candle x={250} o={70} c={170} h={40} l={205} w={34} />
      <T x={280} y={74}>Open</T>
      <T x={280} y={170}>Close</T>
      <T x={280} y={120} c="var(--fg-3)">тело</T>
      <T x={280} y={50} c="var(--fg-3)">тень</T>
      <T x={210} y={235} c="var(--dn)" w={600}>Медвежья свеча</T>
      <g>
        <Candle x={400} o={70} c={62} h={56} l={190} w={14} />
        <T x={380} y={218} s={10}>пин-бар</T>
        <Candle x={460} o={110} c={130} h={100} l={140} w={12} />
        <Candle x={480} o={135} c={85} h={78} l={142} w={16} />
        <T x={445} y={218} s={10}>поглощение</T>
        <Candle x={530} o={120} c={121} h={80} l={160} w={14} />
        <T x={515} y={218} s={10}>доджи</T>
      </g>
    </Box>
  );
}

export function DTimeframes() {
  const small = [[150, 120, 110, 160], [120, 140, 100, 148], [140, 95, 88, 146], [95, 70, 62, 104]];
  return (
    <Box h={230}>
      <T x={20} y={22} c="var(--fg-1)" s={12} w={600}>1 свеча 1h = 4 свечи 15m</T>
      <Candle x={90} o={150} c={70} h={62} l={160} w={40} />
      <T x={60} y={200} w={600}>1h</T>
      <T x={150} y={115} c="var(--fg-3)" s={20}>=</T>
      {small.map(([o, c, h, l], i) => <Candle key={i} x={210 + i * 34} o={o} c={c} h={h} l={l} w={20} />)}
      <T x={250} y={200} w={600}>15m × 4</T>
      <T x={360} y={70} c="var(--fg-1)" w={600}>Старший ТФ — направление</T>
      <T x={360} y={88}>1D / 4h: где тренд и ключевые уровни</T>
      <T x={360} y={118} c="var(--fg-1)" w={600}>Рабочий ТФ — сетап</T>
      <T x={360} y={136}>1h / 15m: точка входа и стоп</T>
      <T x={360} y={166} c="var(--fg-1)" w={600}>Младший ТФ — шум</T>
      <T x={360} y={184}>1m: много ложных сигналов</T>
    </Box>
  );
}

export function DOrders() {
  return (
    <Box h={250}>
      <Path d="M20,150 L70,130 L110,145 L160,110 L200,125 L240,118" c="var(--fg-1)" />
      <circle cx={240} cy={118} r="4" fill="var(--fg-1)" />
      <T x={248} y={114} c="var(--fg-1)" w={600}>текущая цена 100</T>
      {[
        [40, 'var(--up)', 'Take-Profit 110 — фиксируем прибыль'],
        [75, 'var(--accent)', 'Buy Stop 104 — купить на пробое вверх'],
        [170, 'var(--accent-2)', 'Buy Limit 96 — купить дешевле на откате'],
        [215, 'var(--dn)', 'Stop-Loss 93 — выход, если ошиблись'],
      ].map(([yy, c, t]) => (
        <g key={t}>
          <line x1={250} x2={540} y1={yy} y2={yy} stroke={c} strokeDasharray="6 4" strokeWidth="1.5" />
          <T x={256} y={yy - 6} c={c} w={600}>{t}</T>
        </g>
      ))}
      <T x={20} y={30} s={11}>Market — исполнить сразу</T>
      <T x={20} y={46} s={11}>по лучшей цене стакана</T>
    </Box>
  );
}

export function DTrend() {
  return (
    <Box h={240}>
      <Path d="M30,200 L110,120 L160,160 L250,80 L300,120 L390,40 L430,70" c="var(--up)" w={2.4} />
      {[[110, 120, 'HH'], [250, 80, 'HH'], [390, 40, 'HH']].map(([x, y, t], i) => <T key={i} x={x - 8} y={y - 10} c="var(--up)" w={700}>{t}</T>)}
      {[[160, 160, 'HL'], [300, 120, 'HL']].map(([x, y, t], i) => <T key={i} x={x - 8} y={y + 20} c="var(--accent)" w={700}>{t}</T>)}
      <Path d="M160,160 L300,120 L470,72" c="var(--accent)" w={1.2} dash="5 4" />
      <T x={300} y={200} c="var(--fg-1)" w={600}>Восходящий тренд:</T>
      <T x={300} y={216}>каждый максимум (HH) и минимум (HL) выше</T>
      <T x={300} y={232}>предыдущего. Слом — первый LL.</T>
    </Box>
  );
}

export function DLevels() {
  return (
    <Box h={240}>
      <rect x={20} y={62} width={520} height={18} fill="var(--dn)" opacity="0.14" />
      <T x={26} y={56} c="var(--dn)" w={600}>сопротивление 110</T>
      <rect x={20} y={168} width={520} height={18} fill="var(--up)" opacity="0.14" />
      <T x={26} y={204} c="var(--up)" w={600}>поддержка 100</T>
      <Path d="M20,150 L60,70 L100,160 L140,74 L180,172 L220,72 L250,120 L290,30 L330,72 L370,40 L410,70 L450,20" c="var(--fg-1)" />
      <circle cx={330} cy={72} r="6" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <T x={340} y={100} c="var(--accent)" w={600}>смена ролей:</T>
      <T x={340} y={116} c="var(--accent)">бывшее сопротивление</T>
      <T x={340} y={130} c="var(--accent)">стало поддержкой</T>
    </Box>
  );
}

export function DFakeout() {
  return (
    <Box h={250}>
      <line x1={20} x2={540} y1={90} y2={90} stroke="var(--fg-2)" strokeDasharray="6 4" />
      <T x={24} y={84} w={600}>уровень 120 (три касания)</T>
      <rect x={250} y={52} width={130} height={30} fill="var(--dn)" opacity="0.18" rx="4" />
      <T x={256} y={68} c="var(--dn)" s={10} w={600}>стопы шортистов</T>
      <T x={256} y={78} c="var(--dn)" s={10}>+ buy-stop пробойщиков</T>
      {[[50, 160, 110, 170, 100], [90, 110, 96, 116, 92], [130, 130, 150, 160, 125], [170, 150, 100, 155, 94], [210, 120, 140, 146, 110], [250, 140, 98, 150, 93]].map(([x, o, c, l, h], i) => <Candle key={i} x={x} o={o} c={c} h={h} l={l} />)}
      <Candle x={300} o={94} c={100} h={40} l={104} w={16} />
      <T x={312} y={44} c="var(--accent)" w={700}>вынос стопов</T>
      <Candle x={340} o={98} c={140} h={94} l={146} />
      <Candle x={380} o={140} c={185} h={135} l={192} />
      <Candle x={420} o={185} c={210} h={180} l={218} />
      <T x={420} y={130} c="var(--fg-1)" w={600}>Цена вернулась</T>
      <T x={420} y={146}>под уровень — ловушка</T>
      <T x={420} y={162}>для покупателей</T>
    </Box>
  );
}

export function DVolume() {
  const bars = [20, 24, 18, 22, 26, 20, 80, 70, 60];
  const bars2 = [20, 24, 18, 22, 26, 20, 23, 15, 12];
  return (
    <Box h={230}>
      <T x={20} y={20} c="var(--fg-1)" w={600}>Пробой с объёмом</T>
      <Path d="M20,110 L50,100 L80,108 L110,98 L140,104 L170,100 L200,60 L230,50 L260,40" c="var(--up)" />
      <line x1={20} x2={270} y1={95} y2={95} stroke="var(--fg-3)" strokeDasharray="4 3" />
      {bars.map((h, i) => <rect key={i} x={20 + i * 30 - 9} y={210 - h} width={18} height={h} fill={i >= 6 ? 'var(--up)' : 'var(--fg-3)'} opacity="0.7" />)}
      <T x={300} y={20} c="var(--fg-1)" w={600}>Пробой без объёма</T>
      <Path d="M300,110 L330,100 L360,108 L390,98 L420,104 L450,100 L480,86 L510,104 L540,120" c="var(--dn)" />
      <line x1={300} x2={550} y1={95} y2={95} stroke="var(--fg-3)" strokeDasharray="4 3" />
      {bars2.map((h, i) => <rect key={i} x={300 + i * 30 - 9} y={210 - h} width={18} height={h} fill={i >= 6 ? 'var(--dn)' : 'var(--fg-3)'} opacity="0.7" />)}
      <T x={20} y={140} c="var(--up)">крупные участники участвуют</T>
      <T x={300} y={140} c="var(--dn)">нет интереса — высокий риск возврата</T>
    </Box>
  );
}

export function DIndicators() {
  return (
    <Box h={250}>
      <Path d="M20,120 C80,60 120,150 180,90 S280,40 330,70 S430,140 540,110" c="var(--fg-1)" />
      <Path d="M20,125 C90,100 150,110 200,95 S300,70 350,82 S450,110 540,112" c="var(--accent)" w={1.6} />
      <T x={430} y={60} c="var(--accent)" w={600}>MA 20 — средняя</T>
      <T x={20} y={22} c="var(--fg-1)" w={600}>Цена выше MA — тренд вверх, ниже — вниз</T>
      <rect x={20} y={170} width={520} height={60} fill="var(--bg-2)" rx="4" />
      <line x1={20} x2={540} y1={182} y2={182} stroke="var(--dn)" strokeDasharray="3 3" />
      <line x1={20} x2={540} y1={218} y2={218} stroke="var(--up)" strokeDasharray="3 3" />
      <Path d="M20,205 C80,180 120,215 180,190 S280,172 330,184 S430,226 540,205" c="var(--accent-2)" w={1.6} />
      <T x={24} y={180} c="var(--dn)" s={10}>70 перекупленность</T>
      <T x={24} y={229} c="var(--up)" s={10}>30 перепроданность</T>
      <T x={470} y={196} c="var(--accent-2)" s={10}>RSI 14</T>
    </Box>
  );
}

export function DRisk1() {
  return (
    <Box h={240}>
      <rect x={20} y={40} width={500} height={34} rx="4" fill="var(--bg-2)" />
      <rect x={20} y={40} width={5} height={34} fill="var(--dn)" />
      <T x={30} y={62} c="var(--fg-1)" w={600}>Депозит $10 000</T>
      <T x={360} y={62} c="var(--dn)" w={600}>риск 1% = $100</T>
      <T x={20} y={110} c="var(--fg-1)" s={13} w={600}>Размер позиции = Риск ÷ (Вход − Стоп)</T>
      <T x={20} y={140}>Вход 100, стоп 95 → расстояние 5 → 100 ÷ 5 = 20 монет ($2 000)</T>
      <T x={20} y={162}>Вход 100, стоп 98 → расстояние 2 → 100 ÷ 2 = 50 монет ($5 000)</T>
      <T x={20} y={196} c="var(--accent)" w={600}>Стоп определяет рынок (за уровнем), а размер — ваша формула.</T>
      <T x={20} y={214} c="var(--accent)">В обоих случаях при стопе вы теряете ровно $100.</T>
    </Box>
  );
}

export function DExpectancy() {
  const wr = [30, 40, 50, 60];
  const rr = [1, 1.5, 2, 3];
  return (
    <Box h={250}>
      <T x={20} y={20} c="var(--fg-1)" w={600}>Матожидание на сделку (в R) = WR×RR − (1−WR)</T>
      <T x={120} y={46} s={10}>соотношение прибыль/риск (RR)</T>
      {rr.map((r, j) => <T key={r} x={130 + j * 100} y={64} c="var(--fg-1)" w={600}>1 : {r}</T>)}
      {wr.map((w, i) => (
        <g key={w}>
          <T x={20} y={94 + i * 38} c="var(--fg-1)" w={600}>{w}% побед</T>
          {rr.map((r, j) => {
            const e = (w / 100) * r - (1 - w / 100);
            return (
              <g key={r}>
                <rect x={115 + j * 100} y={74 + i * 38} width={90} height={30} rx="4" fill={e > 0 ? 'var(--up)' : 'var(--dn)'} opacity={Math.min(0.7, 0.15 + Math.abs(e) * 0.4)} />
                <T x={160 + j * 100} y={94 + i * 38} a="middle" c="var(--fg-1)" w={600}>{(e >= 0 ? '+' : '') + e.toFixed(2)}R</T>
              </g>
            );
          })}
        </g>
      ))}
    </Box>
  );
}

export function DLeverage() {
  const lv = [1, 2, 3, 5, 10, 20, 50];
  return (
    <Box h={240}>
      <T x={20} y={20} c="var(--fg-1)" w={600}>Через сколько % движения против вас — ликвидация</T>
      {lv.map((l, i) => {
        const d = l === 1 ? 100 : 100 / l - 0.5;
        const w = (Math.min(d, 100) / 100) * 380;
        return (
          <g key={l}>
            <T x={20} y={52 + i * 26} c="var(--fg-1)" w={600}>{l}x</T>
            <rect x={60} y={40 + i * 26} width={w} height={16} rx="3" fill={l >= 10 ? 'var(--dn)' : l >= 5 ? 'var(--warn)' : 'var(--up)'} opacity="0.75" />
            <T x={66 + w} y={52 + i * 26}>{l === 1 ? 'нет ликвидации (−100% цены)' : '≈ ' + d.toFixed(1) + '%'}</T>
          </g>
        );
      })}
    </Box>
  );
}

export function DDrawdown() {
  const pts = [10, 20, 30, 40, 50, 60, 70, 80];
  return (
    <Box h={240}>
      <T x={20} y={20} c="var(--fg-1)" w={600}>Чтобы вернуть убыток, нужен больший рост</T>
      {pts.map((p, i) => {
        const need = (1 / (1 - p / 100) - 1) * 100;
        const x = 40 + i * 62;
        const h1 = p * 1.6, h2 = Math.min(180, need * 0.45);
        return (
          <g key={p}>
            <rect x={x} y={210 - h1} width={20} height={h1} fill="var(--dn)" opacity="0.7" rx="2" />
            <rect x={x + 22} y={210 - h2} width={20} height={h2} fill="var(--up)" opacity="0.7" rx="2" />
            <T x={x + 21} y={226} a="middle" s={10}>−{p}%</T>
            <T x={x + 32} y={205 - h2} a="middle" s={10} c="var(--up)">+{need.toFixed(0)}%</T>
          </g>
        );
      })}
    </Box>
  );
}

export function DEmotions() {
  const st = [[40, 190, 'неверие'], [100, 150, 'надежда'], [160, 105, 'оптимизм'], [220, 60, 'азарт'], [270, 32, 'эйфория (FOMO)'], [330, 70, 'тревога'], [380, 120, 'отрицание'], [430, 175, 'паника'], [480, 210, 'капитуляция'], [530, 180, 'депрессия']];
  return (
    <Box h={240}>
      <Path d="M20,205 C80,170 150,100 220,60 S290,20 330,70 S420,170 480,210 S530,190 545,175" c="var(--accent)" w={2.4} />
      {st.map(([x, y, t], i) => (
        <g key={t}>
          <circle cx={x} cy={y} r="3.5" fill={i === 4 ? 'var(--dn)' : 'var(--fg-1)'} />
          <T x={x} y={y - 9} a="middle" s={10} c={i === 4 ? 'var(--dn)' : 'var(--fg-2)'} w={i === 4 ? 700 : 400}>{t}</T>
        </g>
      ))}
      <T x={20} y={232} c="var(--fg-3)" s={10}>Толпа покупает на эйфории и продаёт на капитуляции — ровно наоборот.</T>
    </Box>
  );
}

export function DTilt() {
  const s = [[1, 'L'], [1, 'L'], [2, 'L'], [4, 'L'], [8, 'L']];
  return (
    <Box h={220}>
      <T x={20} y={22} c="var(--fg-1)" w={600}>«Отыграться»: размер растёт после каждого убытка</T>
      {s.map(([m], i) => (
        <g key={i}>
          <rect x={40 + i * 70} y={180 - m * 18} width={40} height={m * 18} fill="var(--dn)" opacity={0.35 + i * 0.12} rx="3" />
          <T x={60 + i * 70} y={196} a="middle" s={10}>сделка {i + 1}</T>
          <T x={60 + i * 70} y={172 - m * 18} a="middle" s={10} c="var(--dn)">−{m}%</T>
        </g>
      ))}
      <T x={400} y={70} c="var(--fg-1)" w={600}>Итог: −16% за час</T>
      <T x={400} y={90}>Решение: стоп-день после</T>
      <T x={400} y={106}>2–3 убытков или −3%.</T>
    </Box>
  );
}

export function DPlan() {
  const items = ['Рынок и таймфрейм', 'Сетап: какой паттерн я торгую', 'Условие входа', 'Где стоп и почему там', 'Цель и RR ≥ 1:2', 'Риск ≤ 1% депозита', 'Что делаю, если цена не пошла'];
  return (
    <Box h={240}>
      <rect x={20} y={14} width={300} height={214} rx="6" fill="var(--bg-2)" />
      <T x={36} y={38} c="var(--fg-1)" s={12} w={700}>Чек-лист перед сделкой</T>
      {items.map((t, i) => (
        <g key={t}>
          <rect x={36} y={52 + i * 24} width={12} height={12} rx="2" fill="none" stroke="var(--accent)" />
          <path d={`M38,${58 + i * 24} l3,3 l5,-6`} stroke="var(--accent)" fill="none" strokeWidth="1.6" />
          <T x={56} y={62 + i * 24}>{t}</T>
        </g>
      ))}
      <T x={350} y={60} c="var(--fg-1)" w={600}>Журнал после сделки</T>
      <T x={350} y={80}>• скрин входа и выхода</T>
      <T x={350} y={98}>• результат в R</T>
      <T x={350} y={116}>• соблюдён ли план</T>
      <T x={350} y={134}>• эмоция на входе</T>
      <T x={350} y={170} c="var(--accent)">Анализ раз в неделю по</T>
      <T x={350} y={186} c="var(--accent)">20+ сделкам, а не по одной.</T>
    </Box>
  );
}

export function DPath() {
  const st = ['Теория', 'Кейсы', 'Тренажёр', 'Демо-счёт 50+ сделок', 'Малый реальный счёт', 'Масштабирование'];
  return (
    <Box h={200}>
      {st.map((t, i) => (
        <g key={t}>
          <rect x={20 + i * 90} y={70 - i * 8} width={82} height={60 + i * 8} rx="6" fill="var(--accent)" opacity={0.12 + i * 0.1} />
          <T x={61 + i * 90} y={150} a="middle" s={10} c="var(--fg-1)" w={600}>{t.split(' ')[0]}</T>
          <T x={61 + i * 90} y={164} a="middle" s={10}>{t.split(' ').slice(1).join(' ')}</T>
          <T x={61 + i * 90} y={100} a="middle" s={16} c="var(--fg-1)" w={700}>{i + 1}</T>
        </g>
      ))}
      <T x={20} y={30} c="var(--fg-1)" w={600}>Переходите на следующий шаг, только если на текущем матожидание &gt; 0</T>
    </Box>
  );
}

export const DIAGRAMS = {
  orderbook: DOrderBook, slippage: DSlippage, candle: DCandle, tf: DTimeframes, orders: DOrders,
  trend: DTrend, levels: DLevels, fakeout: DFakeout, volume: DVolume, indicators: DIndicators,
  risk1: DRisk1, expectancy: DExpectancy, leverage: DLeverage, drawdown: DDrawdown,
  emotions: DEmotions, tilt: DTilt, plan: DPlan, path: DPath,
};
