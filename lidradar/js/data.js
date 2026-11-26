// Справочники: сферы бизнеса и как искать их на карте (OpenStreetMap)
// q — список фильтров Overpass. Можно добавлять свои категории по образцу.
window.SPHERES = [
  { id: 'food', label: 'Еда и напитки', cats: [
    { id: 'cafe', label: 'Кафе', q: ['["amenity"="cafe"]'] },
    { id: 'coffee', label: 'Кофейня', q: ['["amenity"="cafe"]["cuisine"~"coffee",i]', '["shop"="coffee"]', '["amenity"="cafe"]["name"~"коф|coffee",i]'] },
    { id: 'restaurant', label: 'Ресторан', q: ['["amenity"="restaurant"]'] },
    { id: 'fastfood', label: 'Фастфуд', q: ['["amenity"="fast_food"]'] },
    { id: 'pizza', label: 'Пиццерия', q: ['["cuisine"~"pizza",i]', '["amenity"~"restaurant|fast_food|cafe"]["name"~"пицц|pizza",i]'] },
    { id: 'shawarma', label: 'Шаурма', q: ['["cuisine"~"kebab|shawarma|doner",i]', '["amenity"~"fast_food|cafe"]["name"~"шаурм|шаверм|донер",i]'] },
    { id: 'sushi', label: 'Суши и роллы', q: ['["cuisine"~"sushi|japanese",i]', '["amenity"~"restaurant|fast_food|cafe"]["name"~"суши|ролл|sushi",i]'] },
    { id: 'burger', label: 'Бургерная', q: ['["cuisine"~"burger",i]', '["amenity"~"restaurant|fast_food|cafe"]["name"~"бургер|burger",i]'] },
    { id: 'bar', label: 'Бар / паб', q: ['["amenity"~"^(bar|pub)$"]'] },
    { id: 'bakery', label: 'Пекарня', q: ['["shop"="bakery"]'] },
    { id: 'confect', label: 'Кондитерская', q: ['["shop"~"confectionery|pastry"]'] },
  ]},
  { id: 'beauty', label: 'Красота', cats: [
    { id: 'beautysalon', label: 'Салон красоты', q: ['["shop"="beauty"]'] },
    { id: 'hair', label: 'Парикмахерская', q: ['["shop"="hairdresser"]'] },
    { id: 'barber', label: 'Барбершоп', q: ['["shop"="hairdresser"]["name"~"барбер|barber",i]', '["shop"="hairdresser"]["hairdresser"~"barber|male",i]'] },
    { id: 'nails', label: 'Маникюр', q: ['["beauty"~"nails"]', '["shop"="beauty"]["name"~"ногт|nail|маник",i]'] },
    { id: 'tattoo', label: 'Тату', q: ['["shop"="tattoo"]'] },
    { id: 'massage', label: 'Массаж', q: ['["shop"="massage"]', '["amenity"="massage"]'] },
    { id: 'spa', label: 'СПА / солярий', q: ['["leisure"="tanning_salon"]', '["amenity"="spa"]', '["leisure"="spa"]'] },
    { id: 'cosmetics', label: 'Магазин косметики', q: ['["shop"="cosmetics"]', '["shop"="perfumery"]'] },
  ]},
  { id: 'med', label: 'Медицина', cats: [
    { id: 'dentist', label: 'Стоматология', q: ['["amenity"="dentist"]', '["healthcare"="dentist"]'] },
    { id: 'clinic', label: 'Клиника', q: ['["amenity"="clinic"]', '["healthcare"="clinic"]'] },
    { id: 'vet', label: 'Ветклиника', q: ['["amenity"="veterinary"]'] },
    { id: 'optic', label: 'Оптика', q: ['["shop"="optician"]'] },
    { id: 'pharmacy', label: 'Аптека', q: ['["amenity"="pharmacy"]'] },
  ]},
  { id: 'pets', label: 'Животные', cats: [
    { id: 'petshop', label: 'Зоомагазин', q: ['["shop"="pet"]'] },
    { id: 'grooming', label: 'Груминг', q: ['["shop"="pet_grooming"]', '["amenity"="animal_grooming"]'] },
    { id: 'vet2', label: 'Ветклиника', q: ['["amenity"="veterinary"]'] },
  ]},
  { id: 'auto', label: 'Авто', cats: [
    { id: 'carrepair', label: 'Автосервис', q: ['["shop"="car_repair"]'] },
    { id: 'carwash', label: 'Автомойка', q: ['["amenity"="car_wash"]'] },
    { id: 'tyres', label: 'Шиномонтаж', q: ['["shop"="tyres"]'] },
    { id: 'carparts', label: 'Автозапчасти', q: ['["shop"="car_parts"]'] },
    { id: 'drivingschool', label: 'Автошкола', q: ['["amenity"="driving_school"]'] },
  ]},
  { id: 'sport', label: 'Спорт', cats: [
    { id: 'fitness', label: 'Фитнес-клуб', q: ['["leisure"="fitness_centre"]'] },
    { id: 'sportcentre', label: 'Спорткомплекс', q: ['["leisure"="sports_centre"]'] },
    { id: 'yoga', label: 'Йога / танцы', q: ['["name"~"йог|yoga|танц|dance",i]["leisure"~"fitness_centre|sports_centre|dance"]', '["leisure"="dance"]'] },
    { id: 'sportshop', label: 'Спорттовары', q: ['["shop"="sports"]'] },
  ]},
  { id: 'edu', label: 'Обучение', cats: [
    { id: 'lang', label: 'Языковая школа', q: ['["amenity"="language_school"]'] },
    { id: 'music', label: 'Музыкальная школа', q: ['["amenity"="music_school"]'] },
    { id: 'training', label: 'Курсы и кружки', q: ['["amenity"="training"]', '["amenity"="prep_school"]'] },
    { id: 'drivingschool2', label: 'Автошкола', q: ['["amenity"="driving_school"]'] },
  ]},
  { id: 'kids', label: 'Дети и праздники', cats: [
    { id: 'toys', label: 'Игрушки', q: ['["shop"="toys"]'] },
    { id: 'babygoods', label: 'Детские товары', q: ['["shop"="baby_goods"]'] },
    { id: 'party', label: 'Товары для праздника', q: ['["shop"="party"]'] },
    { id: 'kidscenter', label: 'Детский центр', q: ['["name"~"детск|развивающ|kids",i]["amenity"~"childcare|training|kindergarten"]'] },
  ]},
  { id: 'fun', label: 'Досуг', cats: [
    { id: 'hookah', label: 'Кальянная', q: ['["amenity"="hookah_lounge"]', '["name"~"кальян|hookah|lounge",i]["amenity"~"bar|cafe|pub"]'] },
    { id: 'quest', label: 'Квесты', q: ['["leisure"="escape_game"]'] },
    { id: 'karaoke', label: 'Караоке', q: ['["amenity"="karaoke_box"]', '["name"~"караоке",i]["amenity"~"bar|cafe|pub|restaurant"]'] },
    { id: 'bowling', label: 'Боулинг / бильярд', q: ['["leisure"="bowling_alley"]', '["leisure"="billiards"]'] },
    { id: 'bath', label: 'Бани и сауны', q: ['["amenity"="public_bath"]', '["leisure"="sauna"]'] },
  ]},
  { id: 'events', label: 'События и фото', cats: [
    { id: 'photo', label: 'Фотостудия', q: ['["shop"="photo"]', '["craft"="photographer"]', '["shop"="photo_studio"]'] },
    { id: 'florist', label: 'Цветы', q: ['["shop"="florist"]'] },
    { id: 'gift', label: 'Подарки', q: ['["shop"="gift"]'] },
  ]},
  { id: 'hotels', label: 'Отели и отдых', cats: [
    { id: 'hotel', label: 'Гостиница', q: ['["tourism"="hotel"]'] },
    { id: 'hostel', label: 'Хостел', q: ['["tourism"="hostel"]'] },
    { id: 'guest', label: 'Гостевой дом', q: ['["tourism"~"guest_house|apartment"]'] },
    { id: 'resort', label: 'База отдыха', q: ['["tourism"~"chalet|camp_site"]', '["leisure"="resort"]'] },
  ]},
  { id: 'home', label: 'Дом и ремонт', cats: [
    { id: 'diy', label: 'Стройматериалы', q: ['["shop"~"doityourself|hardware"]'] },
    { id: 'furniture', label: 'Мебель', q: ['["shop"="furniture"]', '["craft"="carpenter"]'] },
    { id: 'bathroom', label: 'Сантехника', q: ['["shop"="bathroom_furnishing"]', '["craft"="plumber"]'] },
    { id: 'windows', label: 'Окна и двери', q: ['["shop"~"doors|windows"]', '["craft"="window_construction"]'] },
    { id: 'curtains', label: 'Шторы и текстиль', q: ['["shop"~"curtain|fabric|interior_decoration"]'] },
  ]},
  { id: 'services', label: 'Бытовые услуги', cats: [
    { id: 'drycleaning', label: 'Химчистка', q: ['["shop"="dry_cleaning"]'] },
    { id: 'laundry', label: 'Прачечная', q: ['["shop"="laundry"]'] },
    { id: 'shoerepair', label: 'Ремонт обуви', q: ['["shop"="shoe_repair"]', '["craft"="shoemaker"]'] },
    { id: 'tailor', label: 'Ателье', q: ['["shop"="tailor"]', '["craft"~"tailor|dressmaker"]'] },
    { id: 'phonerepair', label: 'Ремонт техники', q: ['["shop"~"mobile_phone|electronics_repair|computer"]', '["craft"="electronics_repair"]'] },
    { id: 'keys', label: 'Ключи и замки', q: ['["shop"="locksmith"]', '["craft"="key_cutter"]'] },
  ]},
  { id: 'b2b', label: 'Услуги для бизнеса', cats: [
    { id: 'print', label: 'Типография', q: ['["shop"="copyshop"]', '["craft"="printer"]'] },
    { id: 'accountant', label: 'Бухгалтерия', q: ['["office"="accountant"]'] },
    { id: 'lawyer', label: 'Юристы', q: ['["office"="lawyer"]'] },
    { id: 'realty', label: 'Недвижимость', q: ['["office"="estate_agent"]'] },
    { id: 'insurance', label: 'Страхование', q: ['["office"="insurance"]'] },
  ]},
  { id: 'shops', label: 'Магазины', cats: [
    { id: 'clothes', label: 'Одежда', q: ['["shop"="clothes"]'] },
    { id: 'shoes', label: 'Обувь', q: ['["shop"="shoes"]'] },
    { id: 'jewelry', label: 'Ювелирный', q: ['["shop"="jewelry"]'] },
    { id: 'books', label: 'Книги', q: ['["shop"="books"]'] },
    { id: 'electronics', label: 'Электроника', q: ['["shop"="electronics"]'] },
    { id: 'phones', label: 'Телефоны', q: ['["shop"="mobile_phone"]'] },
    { id: 'bicycle', label: 'Велосипеды', q: ['["shop"="bicycle"]'] },
    { id: 'butcher', label: 'Мясная лавка', q: ['["shop"="butcher"]'] },
    { id: 'secondhand', label: 'Секонд-хенд', q: ['["shop"~"second_hand|charity"]'] },
    { id: 'household', label: 'Хозтовары', q: ['["shop"~"houseware|household"]'] },
    { id: 'florist2', label: 'Цветы', q: ['["shop"="florist"]'] },
  ]},
];

// Статусы работы с клиентом
window.STATUSES = {
  new:        { label: 'Новый',       color: '#8b93a7' },
  queue:      { label: 'В очереди',   color: '#5b8def' },
  sent:       { label: 'Написал',     color: '#e0a23a' },
  replied:    { label: 'Ответил',     color: '#3fb7c9' },
  interested: { label: 'Интерес',     color: '#a77bf3' },
  client:     { label: 'Клиент',      color: '#3fbf7a' },
  rejected:   { label: 'Отказ',       color: '#e25d5d' },
};

// Шаблоны сообщений по умолчанию. Переменные в фигурных скобках подставляются сами.
window.DEFAULT_TEMPLATES = [
  { id: 't1', name: 'Первое сообщение + демо', text:
`Здравствуйте! Меня зовут {моё_имя}, я делаю сайты для небольших заведений в г. {город}.

Заметил, что у «{название}» нет своего сайта — гости ищут вас в интернете и не находят меню, цены и как заказать.

Я уже собрал для вас бесплатный демо-сайт, посмотрите, как это могло бы выглядеть:
{демо}

Если понравится — доведу до готового за {цена} и пару дней. Если нет — просто проигнорируйте, без обид 🙂` },
  { id: 't5', name: 'Только соцсети + демо', text:
`Здравствуйте! Меня зовут {моё_имя}, я делаю сайты для небольших заведений в г. {город}.

Вижу, что «{название}» ведёт соцсети, а своего сайта пока нет. В ленте меню и цены быстро теряются, а сайт находят через Яндекс и Google и открывают за пару секунд.

Я собрал для вас бесплатный пример, как это могло бы выглядеть:
{демо}

Если понравится — сделаю под ключ за {цена}. Если нет — просто проигнорируйте 🙂` },
  { id: 't6', name: 'Есть сайт — обновить', text:
`Здравствуйте! Меня зовут {моё_имя}, я делаю сайты для заведений в г. {город}.

Посмотрел сайт «{название}» и сделал бесплатный пример обновлённой версии: удобной с телефона, с меню и быстрым заказом в WhatsApp:
{демо}

Если интересно — расскажу, что ещё можно улучшить на текущем сайте. Если нет — просто проигнорируйте, без обид 🙂` },
  { id: 't2', name: 'Короткое без демо', text:
`Здравствуйте! Подскажите, кто у вас отвечает за рекламу и сайт?

Я {моё_имя}, делаю сайты-меню и страницы для записи для заведений в г. {город}. Могу бесплатно показать пример для «{название}» — интересно?` },
  { id: 't3', name: 'Напоминание через 2–3 дня', text:
`Добрый день! Напомню про демо-сайт для «{название}»: {демо}

Успели посмотреть? Готов ответить на вопросы и поправить всё под вас.` },
  { id: 't4', name: 'Скрипт для звонка', text:
`— Здравствуйте, это «{название}»? Меня зовут {моё_имя}.
— Я делаю сайты для местного бизнеса в г. {город}. Увидел, что у вас пока нет своего сайта.
— Я бесплатно сделал для вас пример — можно скинуть ссылку в WhatsApp или Telegram, чтобы вы посмотрели?
— Кому лучше отправить?` },
];

// Стили демо-сайтов
window.DEMO_STYLES = [
  { id: 'warm',  label: 'Тёплый',   hint: 'кафе, пекарни, рестораны' },
  { id: 'bold',  label: 'Яркий',    hint: 'фастфуд, бургеры, шаурма' },
  { id: 'soft',  label: 'Нежный',   hint: 'салоны, маникюр, цветы' },
  { id: 'dark',  label: 'Тёмный',   hint: 'барбершопы, бары, тату' },
  { id: 'clean', label: 'Строгий',  hint: 'услуги, клиники, авто' },
];
