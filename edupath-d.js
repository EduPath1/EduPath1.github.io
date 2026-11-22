/* ============================================================
   EduPath — edupath-d.js (v2)
   Добавляет на страницы фото-баннеры на всю ширину (фото — фоном),
   описания разделов, подсказки и описания категорий.
   Картинки: assets/d/*.jpg (экспорт из Figma-файла «EduPath — картинки для дизайна D»).
   Если картинки ещё нет — баннер остаётся чёрным с текстом, ничего не ломается.
   ============================================================ */
(function () {
  "use strict";

  const IMG = (n) => `assets/d/d-${n}.jpg`;
  const lang = () => { try { return localStorage.getItem("edupath_lang") || "ru"; } catch (e) { return "ru"; } };

  const T = {
    ru: {
      credit: "Иллюстрация создана ИИ",
      uni_k: "Каталог университетов", uni_h: "50 сильных вузов и поиск по любому другому",
      uni_p: "Выбери уровень обучения и гражданство — и карточки покажут условия именно для тебя: тип подачи, ближайший дедлайн, стоимость обучения и процент приёма. Не нашёл свой вуз в списке? Введи название в поиск.",
      uni_t1h: "Настрой под себя", uni_t1p: "Уровень (Foundation, бакалавриат, магистратура, докторантура) и гражданство меняют цену, экзамены и визу.",
      uni_t2h: "Ищи двумя способами", uni_t2p: "По названию — если знаешь вуз. По условиям — если знаешь страну, бюджет, язык и нужную стипендию.",
      uni_t3h: "Открой досье и сохрани", uni_t3p: "В досье — требования, дедлайны, стоимость жизни, город, карта и официальные ссылки. Понравился вуз — сохрани в профиль.",
      legend: "Точка на карточке:", lg_r: "меньше месяца до дедлайна", lg_y: "около трёх месяцев", lg_g: "больше трёх месяцев", lg_n: "дедлайн не найден",
      res_k: "Полезное", res_h: "Официальные сайты для поступления — в одном месте",
      res_p: "Экзамены, стипендии, порталы подачи документов и проверенные сервисы для подготовки. Мы собираем только официальные и надёжные сайты, а ссылки проверяются автоматически каждую неделю.",
      res_i1h: "Начни с экзаменов", res_i1p: "Почти всем вузам нужен языковой экзамен, многим — академический (SAT, GRE и другие). Узнай нужный балл на сайте программы.",
      res_i2h: "Ищи стипендии заранее", res_i2p: "У государственных стипендий свои сроки, и они часто раньше дедлайнов вузов. Читай, кому дают и что покрывают.",
      res_i3h: "Проверяй «Только для граждан»", res_i3p: "Некоторые программы доступны лишь гражданам одной страны — такие карточки помечены.",
      cat: {
        english: "Экзамены, которые подтверждают уровень английского. Их просят почти все программы на английском языке; нужный балл зависит от вуза и программы.",
        academic: "Академические тесты: SAT и ACT для бакалавриата, GRE и GMAT для магистратуры, а также CSCA для Китая и EJU для Японии. Нужны не везде — проверяй требования программы.",
        languages: "Экзамены по китайскому, корейскому, японскому, немецкому, французскому и испанскому — для обучения на языке страны.",
        national: "Национальные экзамены: ЕНТ в Казахстане и ОРТ в Кыргызстане. Иногда их результаты принимают и зарубежные вузы.",
        prep: "Бесплатные и проверенные материалы для подготовки: официальные пробные тесты, уроки, тренажёры письма и аудирования.",
        grants: "Государственные и международные стипендии — от «Болашак» до DAAD, MEXT и GKS. Внимательно читай условия: кто может подать, что покрывается и когда приём.",
        apply: "Порталы, через которые подают документы сразу в несколько вузов одной страны: Common App, UCAS, uni-assist и другие.",
        countries: "Официальные сайты об учёбе в конкретной стране: правила поступления, визы, стоимость жизни и советы студентам.",
        rankings: "Рейтинги и базы программ. Помогают сравнить вузы и найти направление, но рейтинг — не единственный критерий выбора.",
        courses: "Онлайн-курсы от университетов: можно попробовать специальность и усилить портфолио.",
        tools: "Инструменты для учёбы: карточки для запоминания слов, переводчик, проверка грамматики, заметки и менеджер источников."
      },
      ct_k: "Контент", ct_h: "Новости, видео и фильмы о поступлении и жизни за рубежом",
      ct_p: "Лента собирается из открытых источников и обновляется каждые несколько часов. Нажми на карточку — откроется оригинал: мы показываем только заголовок и короткое описание.",
      ct_i1h: "Фильтруй по теме", ct_i1p: "Поступление, визы, жизнь в разных странах, опыт студентов, мотивация — выбери то, что важно сейчас.",
      ct_i2h: "Выбирай язык", ct_i2p: "Материалы на русском и английском. Английские видео — ещё и хорошая практика перед IELTS или TOEFL.",
      ct_i3h: "Проверяй даты", ct_i3p: "Правила поступления и визовые требования меняются. Смотри на дату публикации и сверяйся с официальными сайтами.",
      fc_k: "Фокус", fc_h: "Учись каждый день — понемногу, но регулярно",
      fc_p: "Запусти таймер, напиши, что учишь, и сохрани результат. Все занятия по дням появятся в профиле, а серия покажет, сколько дней подряд ты занимаешься.",
      fc_i1h: "Как считается серия", fc_i1p: "День засчитывается, если за него набралось 15 минут учёбы. Можно несколько коротких занятий — время сложится.",
      fc_i2h: "Попробуй 25/5", fc_i2p: "25 минут работы без отвлечений, потом 5 минут отдыха. После четырёх кругов — перерыв подольше. Таймер можно ставить на паузу.",
      fc_i3h: "Пиши своими словами", fc_i3p: "«IELTS Reading, 2 текста» понятнее, чем «английский». Через месяц увидишь, на что реально уходило время.",
      app_uni: "Университеты", app_uni_s: "Каталог из 50 вузов, поиск по любому другому и досье с картой и ценами",
      app_res: "Полезное", app_res_s: "Экзамены, стипендии, подача документов",
      app_ct: "Контент", app_ct_s: "Новости, видео и фильмы",
      app_fc: "Фокус", app_fc_s: "Таймер учёбы и серия дней",
      app_pr: "Профиль", app_pr_s: "Избранное и результаты тестов",
      test_k: "ИИ-подбор", test_h: "12 университетов под твои оценки, бюджет и мечты",
      test_p: "Ответь на вопросы — и получи вузы в четырёх категориях: от надёжных до вузов мечты. ИИ рекомендует, но не гарантирует поступление."
    },
    en: {
      credit: "AI-generated illustration",
      uni_k: "University catalog", uni_h: "50 strong universities, plus search for any other",
      uni_p: "Choose your degree level and citizenship and the cards show the conditions that apply to you: application type, nearest deadline, tuition and acceptance rate. Can't find your university? Type its name in the search.",
      uni_t1h: "Make it yours", uni_t1p: "Degree level (Foundation, Bachelor's, Master's, PhD) and citizenship change the price, exams and visa.",
      uni_t2h: "Search two ways", uni_t2p: "By name if you know the university. By conditions if you know the country, budget, language and scholarship you need.",
      uni_t3h: "Open the dossier and save", uni_t3p: "The dossier has requirements, deadlines, cost of living, the city, a map and official links. Like it? Save it to your profile.",
      legend: "Dot on the card:", lg_r: "less than a month to the deadline", lg_y: "about three months", lg_g: "more than three months", lg_n: "deadline not found",
      res_k: "Resources", res_h: "Official admission websites in one place",
      res_p: "Exams, scholarships, application portals and trusted prep services. We only collect official and reliable websites, and links are checked automatically every week.",
      res_i1h: "Start with exams", res_i1p: "Almost every university needs a language test, many also need an academic one (SAT, GRE and others). Check the required score on the program page.",
      res_i2h: "Look for scholarships early", res_i2p: "Government scholarships have their own deadlines, often earlier than universities'. Read who is eligible and what is covered.",
      res_i3h: "Watch for “citizens only”", res_i3p: "Some programs are open only to citizens of one country — those cards are marked.",
      cat: {
        english: "Tests that prove your English level. Almost every English-taught program asks for one; the required score depends on the university and program.",
        academic: "Academic tests: SAT and ACT for Bachelor's, GRE and GMAT for Master's, plus CSCA for China and EJU for Japan. Not always required — check the program.",
        languages: "Chinese, Korean, Japanese, German, French and Spanish exams — for studying in the local language.",
        national: "National exams: UNT in Kazakhstan and ORT in Kyrgyzstan. Some universities abroad accept their results too.",
        prep: "Free, trusted prep materials: official practice tests, lessons, writing and listening trainers.",
        grants: "Government and international scholarships — from Bolashak to DAAD, MEXT and GKS. Read the terms carefully: who can apply, what is covered and when.",
        apply: "Portals for applying to several universities in one country at once: Common App, UCAS, uni-assist and more.",
        countries: "Official sites about studying in a specific country: admission rules, visas, living costs and tips.",
        rankings: "Rankings and program databases. Useful for comparing, but a ranking is not the only thing that matters.",
        courses: "Online courses from universities: try a subject and strengthen your portfolio.",
        tools: "Study tools: flashcards, translator, grammar checker, notes and a reference manager."
      },
      ct_k: "Content", ct_h: "News, videos and films about admissions and life abroad",
      ct_p: "The feed is collected from open sources and refreshed every few hours. Tap a card to open the original — we only show the headline and a short teaser.",
      ct_i1h: "Filter by topic", ct_i1p: "Admissions, visas, life in different countries, student stories, motivation — pick what matters now.",
      ct_i2h: "Pick a language", ct_i2p: "Materials in Russian and English. English videos are also good practice before IELTS or TOEFL.",
      ct_i3h: "Check the dates", ct_i3p: "Admission and visa rules change. Look at the publication date and confirm on official websites.",
      fc_k: "Focus", fc_h: "Study every day — a little, but regularly",
      fc_p: "Start the timer, write what you're studying and save the result. Sessions appear in your profile by day, and the streak shows how many days in a row you've studied.",
      fc_i1h: "How the streak works", fc_i1p: "A day counts once you reach 15 minutes of study. Several short sessions add up.",
      fc_i2h: "Try 25/5", fc_i2p: "25 minutes of focused work, then a 5-minute break. After four rounds, take a longer break. You can pause the timer.",
      fc_i3h: "Use your own words", fc_i3p: "“IELTS Reading, 2 passages” says more than “English”. In a month you'll see where your time really went.",
      app_uni: "Universities", app_uni_s: "50 universities, search for any other, and dossiers with maps and prices",
      app_res: "Resources", app_res_s: "Exams, scholarships, applications",
      app_ct: "Content", app_ct_s: "News, videos and films",
      app_fc: "Focus", app_fc_s: "Study timer and streaks",
      app_pr: "Profile", app_pr_s: "Saved universities and test results",
      test_k: "AI matching", test_h: "12 universities for your grades, budget and dreams",
      test_p: "Answer the questions and get universities in four categories, from safe picks to dream schools. AI recommends, it does not guarantee admission."
    },
    kk: {
      credit: "Иллюстрацияны ЖИ жасаған",
      uni_k: "Университеттер каталогы", uni_h: "50 мықты университет және кез келгенін іздеу",
      uni_p: "Оқу деңгейі мен азаматтығыңды таңда — карточкалар дәл саған қатысты шарттарды көрсетеді: тапсыру түрі, жақын мерзім, оқу құны және қабылдау пайызы. Университетің тізімде жоқ па? Атауын іздеуге жаз.",
      uni_t1h: "Өзіңе баптау", uni_t1p: "Деңгей (Foundation, бакалавриат, магистратура, докторантура) мен азаматтық бағаны, емтихандар мен визаны өзгертеді.",
      uni_t2h: "Екі тәсілмен ізде", uni_t2p: "Атауы бойынша — университетті білсең. Шарттар бойынша — елді, бюджетті, тілді және стипендияны білсең.",
      uni_t3h: "Досьені ашып, сақта", uni_t3p: "Досьеде талаптар, мерзімдер, өмір сүру құны, қала, карта және ресми сілтемелер бар. Ұнаса — профильге сақта.",
      legend: "Карточкадағы нүкте:", lg_r: "мерзімге бір айдан аз", lg_y: "шамамен үш ай", lg_g: "үш айдан көп", lg_n: "мерзім табылмады",
      res_k: "Пайдалы", res_h: "Түсуге арналған ресми сайттар — бір жерде",
      res_p: "Емтихандар, стипендиялар, құжат тапсыру порталдары және дайындыққа арналған тексерілген сервистер. Тек ресми және сенімді сайттарды жинаймыз, сілтемелер апта сайын автоматты тексеріледі.",
      res_i1h: "Емтихандардан баста", res_i1p: "Барлық дерлік университетке тіл емтиханы, көбіне академиялық емтихан (SAT, GRE т.б.) керек. Қажетті балды бағдарлама сайтынан біл.",
      res_i2h: "Стипендияны ерте ізде", res_i2p: "Мемлекеттік стипендиялардың мерзімі өз алдына, көбіне университет мерзімінен ертерек. Кімге берілетінін және не өтелетінін оқы.",
      res_i3h: "«Тек азаматтарға» белгісін тексер", res_i3p: "Кейбір бағдарламалар бір елдің азаматтарына ғана ашық — ондай карточкалар белгіленген.",
      cat: {
        english: "Ағылшын тілі деңгейін растайтын емтихандар. Ағылшын тіліндегі бағдарламалардың барлығы дерлік сұрайды; қажетті балл университет пен бағдарламаға байланысты.",
        academic: "Академиялық тесттер: бакалавриатқа SAT пен ACT, магистратураға GRE мен GMAT, сондай-ақ Қытай үшін CSCA, Жапония үшін EJU. Барлық жерде керек емес — бағдарлама талаптарын тексер.",
        languages: "Қытай, корей, жапон, неміс, француз және испан тілдерінен емтихандар — сол елдің тілінде оқу үшін.",
        national: "Ұлттық емтихандар: Қазақстанда ҰБТ, Қырғызстанда ЖРТ. Кейде олардың нәтижесін шетелдік университеттер де қабылдайды.",
        prep: "Дайындыққа арналған тегін әрі тексерілген материалдар: ресми сынақ тесттер, сабақтар, жазу мен тыңдау жаттықтырғыштары.",
        grants: "Мемлекеттік және халықаралық стипендиялар — «Болашақтан» DAAD, MEXT және GKS-ке дейін. Шарттарын мұқият оқы: кім тапсыра алады, не өтеледі, қабылдау қашан.",
        apply: "Бір елдің бірнеше университетіне бірден құжат тапсыру порталдары: Common App, UCAS, uni-assist және басқалар.",
        countries: "Белгілі бір елде оқу туралы ресми сайттар: түсу ережелері, визалар, өмір сүру құны және кеңестер.",
        rankings: "Рейтингтер мен бағдарламалар базасы. Салыстыруға көмектеседі, бірақ рейтинг — жалғыз критерий емес.",
        courses: "Университеттердің онлайн-курстары: мамандықты байқап көріп, портфолионы күшейтуге болады.",
        tools: "Оқуға арналған құралдар: сөз жаттау карточкалары, аудармашы, грамматика тексеру, жазбалар және дереккөз менеджері."
      },
      ct_k: "Контент", ct_h: "Түсу және шетелдегі өмір туралы жаңалықтар, бейнелер мен фильмдер",
      ct_p: "Лента ашық дереккөздерден жиналып, бірнеше сағат сайын жаңарады. Карточканы бассаң — түпнұсқа ашылады: біз тек тақырып пен қысқа сипаттаманы көрсетеміз.",
      ct_i1h: "Тақырып бойынша сүз", ct_i1p: "Түсу, визалар, әр елдегі өмір, студенттер тәжірибесі, мотивация — қазір маңыздысын таңда.",
      ct_i2h: "Тілді таңда", ct_i2p: "Орыс және ағылшын тіліндегі материалдар. Ағылшынша бейнелер IELTS не TOEFL алдында жақсы жаттығу.",
      ct_i3h: "Күнін тексер", ct_i3p: "Түсу мен виза ережелері өзгереді. Жарияланған күнге қара және ресми сайттардан тексер.",
      fc_k: "Фокус", fc_h: "Күн сайын оқы — аздап, бірақ үзбей",
      fc_p: "Таймерді қос, не оқитыныңды жаз және нәтижені сақта. Барлық сабақ күндер бойынша профильде шығады, ал серия қатарынан неше күн оқығаныңды көрсетеді.",
      fc_i1h: "Серия қалай саналады", fc_i1p: "Күнге 15 минут оқу жиналса, күн есептеледі. Бірнеше қысқа сабақтың уақыты қосылады.",
      fc_i2h: "25/5 тәсілін байқа", fc_i2p: "25 минут алаңдамай жұмыс, кейін 5 минут демалыс. Төрт айналымнан кейін — ұзағырақ үзіліс. Таймерді кідіртуге болады.",
      fc_i3h: "Өз сөзіңмен жаз", fc_i3p: "«IELTS Reading, 2 мәтін» «ағылшыннан» гөрі түсінікті. Бір айдан кейін уақыт неге кеткенін көресің.",
      app_uni: "Университеттер", app_uni_s: "50 университет каталогы, кез келгенін іздеу және карта мен бағасы бар досье",
      app_res: "Пайдалы", app_res_s: "Емтихандар, стипендиялар, құжат тапсыру",
      app_ct: "Контент", app_ct_s: "Жаңалықтар, бейнелер мен фильмдер",
      app_fc: "Фокус", app_fc_s: "Оқу таймері және күндер сериясы",
      app_pr: "Профиль", app_pr_s: "Таңдаулылар мен тест нәтижелері",
      test_k: "ЖИ іріктеу", test_h: "Бағаңа, бюджетіңе және арманыңа сай 12 университет",
      test_p: "Сұрақтарға жауап бер — төрт санаттағы университеттерді ал: сенімдіден арман университетке дейін. ЖИ ұсынады, бірақ түсуге кепілдік бермейді."
    },
    ky: {
      credit: "Иллюстрацияны ЖИ жасаган",
      uni_k: "Университеттер каталогу", uni_h: "50 күчтүү университет жана каалаганын издөө",
      uni_p: "Окуу деңгээлин жана жарандыгыңды танда — карточкалар так сага тиешелүү шарттарды көрсөтөт: тапшыруу түрү, жакынкы мөөнөт, окуу наркы жана кабыл алуу пайызы. Университетиң тизмеде жокпу? Атын издөөгө жаз.",
      uni_t1h: "Өзүңө ылайыкта", uni_t1p: "Деңгээл (Foundation, бакалавриат, магистратура, докторантура) жана жарандык бааны, сынактарды жана визаны өзгөртөт.",
      uni_t2h: "Эки жол менен изде", uni_t2p: "Аты боюнча — университетти билсең. Шарттар боюнча — өлкөнү, бюджетти, тилди жана стипендияны билсең.",
      uni_t3h: "Досьени ачып, сакта", uni_t3p: "Досьеде талаптар, мөөнөттөр, жашоо наркы, шаар, карта жана расмий шилтемелер бар. Жакса — профилге сакта.",
      legend: "Карточкадагы чекит:", lg_r: "мөөнөткө бир айдан аз", lg_y: "болжол менен үч ай", lg_g: "үч айдан көп", lg_n: "мөөнөт табылган жок",
      res_k: "Пайдалуу", res_h: "Тапшырууга керектүү расмий сайттар — бир жерде",
      res_p: "Сынактар, стипендиялар, документ тапшыруу порталдары жана даярдыкка текшерилген сервистер. Расмий жана ишенимдүү сайттарды гана чогултабыз, шилтемелер жума сайын автоматтык текшерилет.",
      res_i1h: "Сынактардан башта", res_i1p: "Дээрлик бардык университетке тил сынагы, көбүнө академиялык сынак (SAT, GRE ж.б.) керек. Керектүү баллды программанын сайтынан бил.",
      res_i2h: "Стипендияны эрте изде", res_i2p: "Мамлекеттик стипендиялардын мөөнөтү өзүнчө, көбүнчө университеттердикинен эртерээк. Кимге берилерин жана эмнени жабарын оку.",
      res_i3h: "«Жарандар үчүн гана» белгисин текшер", res_i3p: "Айрым программалар бир өлкөнүн жарандарына гана ачык — андай карточкалар белгиленген.",
      cat: {
        english: "Англис тилинин деңгээлин тастыктаган сынактар. Англис тилиндеги дээрлик бардык программалар сурайт; керектүү балл университетке жана программага жараша.",
        academic: "Академиялык тесттер: бакалавриатка SAT жана ACT, магистратурага GRE жана GMAT, ошондой эле Кытай үчүн CSCA, Япония үчүн EJU. Бардык жерде керек эмес — программанын талаптарын текшер.",
        languages: "Кытай, корей, жапон, немис, француз жана испан тилдеринен сынактар — ошол өлкөнүн тилинде окуу үчүн.",
        national: "Улуттук сынактар: Казакстанда ҰБТ, Кыргызстанда ЖРТ. Кээде алардын жыйынтыгын чет өлкөлүк университеттер да кабыл алат.",
        prep: "Даярдыкка акысыз жана текшерилген материалдар: расмий сыноо тесттери, сабактар, жазуу жана угуу машыктыргычтары.",
        grants: "Мамлекеттик жана эл аралык стипендиялар — «Болашактан» DAAD, MEXT жана GKSке чейин. Шарттарын кунт коюп оку: ким тапшыра алат, эмне жабылат, кабыл алуу качан.",
        apply: "Бир өлкөнүн бир нече университетине бир убакта документ тапшыруучу порталдар: Common App, UCAS, uni-assist жана башкалар.",
        countries: "Белгилүү бир өлкөдө окуу тууралуу расмий сайттар: кабыл алуу эрежелери, визалар, жашоо наркы жана кеңештер.",
        rankings: "Рейтингдер жана программалар базасы. Салыштырууга жардам берет, бирок рейтинг — жалгыз критерий эмес.",
        courses: "Университеттердин онлайн-курстары: адистикти сынап көрүп, портфолиону күчөтсө болот.",
        tools: "Окуу үчүн куралдар: сөз жаттоо карточкалары, котормочу, грамматика текшерүү, жазуулар жана булактар менеджери."
      },
      ct_k: "Контент", ct_h: "Тапшыруу жана чет өлкөдөгү жашоо тууралуу жаңылыктар, видеолор жана тасмалар",
      ct_p: "Лента ачык булактардан чогултулуп, бир нече саат сайын жаңыланат. Карточканы бассаң — түп нуска ачылат: биз аталышты жана кыска сыпаттаманы гана көрсөтөбүз.",
      ct_i1h: "Тема боюнча чыпкала", ct_i1p: "Тапшыруу, визалар, ар кайсы өлкөдөгү жашоо, студенттердин тажрыйбасы, мотивация — азыр маанилүүсүн танда.",
      ct_i2h: "Тилди танда", ct_i2p: "Орус жана англис тилиндеги материалдар. Англисче видеолор IELTS же TOEFL алдында жакшы машыгуу.",
      ct_i3h: "Датасын текшер", ct_i3p: "Кабыл алуу жана виза эрежелери өзгөрөт. Жарыяланган датасын карап, расмий сайттардан текшер.",
      fc_k: "Фокус", fc_h: "Күн сайын оку — аздан, бирок үзгүлтүксүз",
      fc_p: "Таймерди коё бер, эмне окуп жатканыңды жаз жана жыйынтыкты сакта. Бардык сабактар күндөр боюнча профилде чыгат, серия катары менен канча күн окуганыңды көрсөтөт.",
      fc_i1h: "Серия кантип эсептелет", fc_i1p: "Күнүнө 15 мүнөт окуу топтолсо, күн эсептелет. Бир нече кыска сабактын убактысы кошулат.",
      fc_i2h: "25/5 ыкмасын сынап көр", fc_i2p: "25 мүнөт алаксыбай иштөө, анан 5 мүнөт эс алуу. Төрт айлампадан кийин — узунураак тыныгуу. Таймерди тындырса болот.",
      fc_i3h: "Өз сөзүң менен жаз", fc_i3p: "«IELTS Reading, 2 текст» «англис тилинен» түшүнүктүүрөөк. Бир айдан кийин убакыт эмнеге кеткенин көрөсүң.",
      app_uni: "Университеттер", app_uni_s: "50 университет, каалаганын издөө жана карта, баалары бар досье",
      app_res: "Пайдалуу", app_res_s: "Сынактар, стипендиялар, документ тапшыруу",
      app_ct: "Контент", app_ct_s: "Жаңылыктар, видеолор жана тасмалар",
      app_fc: "Фокус", app_fc_s: "Окуу таймери жана күндөр сериясы",
      app_pr: "Профиль", app_pr_s: "Тандалгандар жана тест жыйынтыктары",
      test_k: "ЖИ тандоо", test_h: "Бааларыңа, бюджетиңе жана кыялыңа ылайык 12 университет",
      test_p: "Суроолорго жооп бер — төрт категориядагы университеттерди ал: ишенимдүүдөн кыялдагыга чейин. ЖИ сунуштайт, бирок кабыл алууга кепилдик бербейт."
    },
    zh: {
      credit: "AI 生成插图",
      uni_k: "大学目录", uni_h: "50 所优秀大学，并可搜索任何其他大学",
      uni_p: "选择学历层次和国籍，卡片就会显示适用于你的条件：申请类型、最近的截止日期、学费和录取率。列表里没有你的大学？在搜索框输入名称即可。",
      uni_t1h: "按你的情况设置", uni_t1p: "学历层次（预科、本科、硕士、博士）和国籍会影响费用、考试和签证。",
      uni_t2h: "两种搜索方式", uni_t2p: "知道学校就按名称搜；知道国家、预算、语言和奖学金需求就按条件搜。",
      uni_t3h: "打开档案并收藏", uni_t3p: "档案包含要求、截止日期、生活成本、城市、地图和官方链接。喜欢就收藏到个人资料。",
      legend: "卡片上的圆点：", lg_r: "距截止不到一个月", lg_y: "约三个月", lg_g: "三个月以上", lg_n: "未找到截止日期",
      res_k: "实用资源", res_h: "申请所需的官方网站，集中一处",
      res_p: "考试、奖学金、申请门户和可信的备考服务。我们只收录官方和可靠的网站，链接每周自动检查。",
      res_i1h: "先从考试开始", res_i1p: "几乎所有大学都需要语言考试，很多还需要学术考试（SAT、GRE 等）。请在项目页面查看所需分数。",
      res_i2h: "尽早寻找奖学金", res_i2p: "政府奖学金有自己的截止日期，往往早于大学。请阅读申请资格和资助范围。",
      res_i3h: "留意「仅限公民」", res_i3p: "有些项目只对某一国家的公民开放，这类卡片已标注。",
      cat: {
        english: "证明英语水平的考试。几乎所有英语授课项目都要求提供；所需分数取决于学校和项目。",
        academic: "学术考试：本科用 SAT 和 ACT，硕士用 GRE 和 GMAT，另有中国的 CSCA 和日本的 EJU。并非都需要——请查看项目要求。",
        languages: "中文、韩语、日语、德语、法语和西班牙语考试——用于以当地语言学习。",
        national: "国家考试：哈萨克斯坦的 UNT 和吉尔吉斯斯坦的 ORT。部分海外大学也认可其成绩。",
        prep: "免费且可信的备考资料：官方模拟题、课程、写作和听力练习工具。",
        grants: "政府和国际奖学金——从 Bolashak 到 DAAD、MEXT 和 GKS。请仔细阅读条件：谁能申请、资助什么、何时截止。",
        apply: "可同时申请同一国家多所大学的门户：Common App、UCAS、uni-assist 等。",
        countries: "关于在某个国家留学的官方网站：录取规则、签证、生活成本和建议。",
        rankings: "排名和专业数据库。便于比较，但排名不是唯一标准。",
        courses: "大学提供的在线课程：可以试学专业、丰富作品集。",
        tools: "学习工具：单词卡片、翻译、语法检查、笔记和文献管理。"
      },
      ct_k: "内容", ct_h: "关于留学申请和海外生活的新闻、视频和电影",
      ct_p: "内容来自公开来源，每隔几小时更新一次。点击卡片即可打开原文——我们只显示标题和简短摘要。",
      ct_i1h: "按主题筛选", ct_i1p: "申请、签证、各国生活、学生经历、励志——选择你现在关心的。",
      ct_i2h: "选择语言", ct_i2p: "有俄语和英语资料。英语视频也是 IELTS 或 TOEFL 前的好练习。",
      ct_i3h: "注意日期", ct_i3p: "录取和签证规定会变化。请查看发布日期并到官网核实。",
      fc_k: "专注", fc_h: "每天学习——少一点，但要坚持",
      fc_p: "启动计时器，写下你在学什么，然后保存结果。每天的学习记录会出现在个人资料中，连续打卡显示你已连续学习了多少天。",
      fc_i1h: "连续打卡如何计算", fc_i1p: "一天累计学习 15 分钟即算一天。多次短时间学习会累加。",
      fc_i2h: "试试 25/5", fc_i2p: "专注 25 分钟，休息 5 分钟。四轮后休息更久一些。计时器可以暂停。",
      fc_i3h: "用自己的话记录", fc_i3p: "「IELTS 阅读，2 篇」比「英语」更清楚。一个月后你就能看清时间花在了哪里。",
      app_uni: "大学", app_uni_s: "50 所大学目录、任意大学搜索，以及带地图和费用的档案",
      app_res: "实用资源", app_res_s: "考试、奖学金、申请",
      app_ct: "内容", app_ct_s: "新闻、视频和电影",
      app_fc: "专注", app_fc_s: "学习计时器和连续打卡",
      app_pr: "个人资料", app_pr_s: "收藏的大学和测试结果",
      test_k: "AI 匹配", test_h: "符合你成绩、预算和梦想的 12 所大学",
      test_p: "回答问题，获得四类大学：从稳妥选择到梦想学校。AI 只提供建议，不保证录取。"
    }
  };
  const t = (k) => { const d = T[lang()] || T.ru; return d[k] != null ? d[k] : T.ru[k]; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const imgTag = (n, cls) => `<img class="${cls}" src="${IMG(n)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`;

  function banner(img, k, h, p, asH1) {
    const tag = asH1 ? "h1" : "h2";
    return `<section class="d-banner" data-d-banner>${imgTag(img, "d-banner-img")}
      <div class="d-banner-body"><div class="d-banner-text"><span class="d-banner-kicker" data-dt="${k}">${esc(t(k))}</span>
      <${tag} data-dt="${h}">${esc(t(h))}</${tag}><p data-dt="${p}">${esc(t(p))}</p></div></div>
      <span class="d-banner-credit" data-dt="credit">${esc(t("credit"))}</span></section>`;
  }
  function info(prefix, n, darkFirst) {
    let html = '<div class="d-info">';
    for (let i = 1; i <= n; i++) {
      html += `<article class="d-info-card${darkFirst && i === 1 ? " dark" : ""}"><span class="n">${i}</span>
        <h3 data-dt="${prefix}${i}h">${esc(t(prefix + i + "h"))}</h3><p data-dt="${prefix}${i}p">${esc(t(prefix + i + "p"))}</p></article>`;
    }
    return html + "</div>";
  }
  const before = (el, html) => el && el.insertAdjacentHTML("beforebegin", html);
  const after = (el, html) => el && el.insertAdjacentHTML("afterend", html);
  const hide = (el) => { if (el) el.style.display = "none"; };

  const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  // баннер встаёт сразу под шапкой, на всю ширину экрана
  const topBanner = (html) => {
    const anchor = document.getElementById("epDrawer") || document.getElementById("siteHeader");
    if (anchor) anchor.insertAdjacentHTML("afterend", html);
  };

  function build() {
    if (file === "universities.html") {
      const hero = document.querySelector("main.page > .hero");
      topBanner(banner("students", "uni_k", "uni_h", "uni_p", true));
      before(hero, info("uni_t", 3, true));
      hide(hero);
      const track = document.getElementById("cardsTrack");
      before(track, `<div class="d-legend"><b data-dt="legend">${esc(t("legend"))}</b>
        <span><i style="background:#C94C43"></i><em data-dt="lg_r" style="font-style:normal">${esc(t("lg_r"))}</em></span>
        <span><i style="background:#D6A22D"></i><em data-dt="lg_y" style="font-style:normal">${esc(t("lg_y"))}</em></span>
        <span><i style="background:#4C9667"></i><em data-dt="lg_g" style="font-style:normal">${esc(t("lg_g"))}</em></span>
        <span><i style="background:#C9CCD2"></i><em data-dt="lg_n" style="font-style:normal">${esc(t("lg_n"))}</em></span></div>`);
    }
    if (file === "resources.html") {
      const hero = document.querySelector(".res-hero");
      if (hero) { topBanner(banner("desk", "res_k", "res_h", "res_p", true)); hero.insertAdjacentHTML("afterbegin", info("res_i", 3, true)); hero.querySelectorAll(":scope > :not(.d-info)").forEach(hide); }
      const list = document.getElementById("resList");
      if (list) {
        const addDesc = () => list.querySelectorAll(".res-section[data-cat]").forEach((s) => {
          if (s.querySelector(".d-cat-desc")) return;
          const d = (T[lang()] || T.ru).cat[s.dataset.cat] || T.ru.cat[s.dataset.cat];
          if (d) after(s.querySelector("h2"), `<p class="d-cat-desc">${esc(d)}</p>`);
        });
        new MutationObserver(addDesc).observe(list, { childList: true });
        addDesc();
      }
    }
    if (file === "content.html") {
      const hero = document.querySelector(".ct-hero");
      if (hero) { topBanner(banner("phone", "ct_k", "ct_h", "ct_p", true)); hero.insertAdjacentHTML("afterbegin", info("ct_i", 3, true)); hero.querySelectorAll(":scope > :not(.d-info)").forEach(hide); }
    }
    if (file === "focus.html") {
      const hero = document.querySelector(".fc-hero");
      if (hero) { topBanner(banner("study", "fc_k", "fc_h", "fc_p", true)); hero.insertAdjacentHTML("afterbegin", info("fc_i", 3, true)); hero.querySelectorAll(":scope > :not(.d-info)").forEach(hide); }
    }
    if (file === "test.html") {
      topBanner(banner("graduation", "test_k", "test_h", "test_p", false));
      // баннер виден только на первом экране теста
      const intro = document.getElementById("screenIntro"), ban = document.querySelector("[data-d-banner]");
      if (intro && ban) {
        const sync = () => { ban.style.display = intro.classList.contains("active") ? "" : "none"; };
        new MutationObserver(sync).observe(intro, { attributes: true, attributeFilter: ["class"] }); sync();
      }
    }
  }

  function retranslate() {
    document.querySelectorAll("[data-dt]").forEach((el) => { el.textContent = t(el.dataset.dt); });
    document.querySelectorAll(".res-section[data-cat] .d-cat-desc").forEach((p) => {
      const cat = p.closest(".res-section").dataset.cat;
      p.textContent = (T[lang()] || T.ru).cat[cat] || T.ru.cat[cat] || "";
    });
  }
  window.addEventListener("edupath-lang-change", retranslate);

  const start = () => { build(); retranslate(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
