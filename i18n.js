// ============================================================
// EduPath — i18n.js (v3)
// Переводы RU / EN / ZH / KK / KY + мобильное бургер-меню
// + Fun Zone
// ============================================================

(function() {
  "use strict";

  const LANG_KEY = "edupath_lang";

  const translations = {
    ru: {
      nav_home: "Главная", nav_universities: "Университеты", nav_profile: "Профиль",
      nav_fanzone: "🤡 Fun Zone",
      nav_login: "Войти", nav_logout: "Выйти", nav_hello: "Привет",

      home_eyebrow: "Тест на подбор университета",
      home_title_pre: "Пройди тест — и найди ", home_title_em: "свой", home_title_post: " университет",
      home_sub: "Подбор направлений и вузов по твоим предпочтениям, результатам тестов и бюджету. Отвечай на вопросы — дальше система сама решит, что уточнить.",
      home_cta: "Начать поиск университетов",
      home_note: "На основе специального ИИ поймём, какой университет может вам подойти",
      home_quote_top: "«С нами —", home_quote_bottom: "комфортнее, практичнее, эффективнее»",
      home_seam_desc_top: "Помимо учебных показателей нам важно, в какой среде хочет жить абитуриент.",
      home_seam_desc_bottom: "Мы рекомендуем только те университеты, которые подходят тебе по-настоящему хорошо.",
      home_how_title: "Как это работает", home_how_sub: "Три шага от первого вопроса до списка подходящих университетов.",
      home_step1_title: "Личные данные", home_step1_desc: "Твои интересы, увлечения и предпочтения по стране, климату и формату обучения.",
      home_step2_title: "Показатели", home_step2_desc: "Оценки, результаты экзаменов (SAT, IELTS и др.) и ориентировочный бюджет.",
      home_step3_title: "Результаты теста", home_step3_desc: "Список университетов, которые подходят тебе больше всего, с пояснениями и советами.",
      home_footer: "EduPath © 2026. Все права защищены",
      city_seoul: "Сеул", city_berlin: "Берлин", city_boston: "Бостон", city_shanghai: "Шанхай",

      catalog_title: "Университеты", catalog_sub: "Выбери страну и университет",
      catalog_filters: "Фильтры",
      catalog_budget_label: "Бюджет на обучение (USD/год)",
      catalog_budget_from: "от", catalog_budget_to: "до",
      catalog_country_label: "Страна", catalog_country_all: "Все страны",
      catalog_grant_label: "Финансовая помощь", catalog_grant_only: "Только с полным грантом",
      catalog_apply: "Применить", catalog_reset: "Сбросить",
      catalog_choose_uni: "Выбери университет",
      catalog_choose_hint: "Кликни на страну слева, потом на университет, чтобы увидеть подробную информацию.",
      catalog_search_placeholder: "Найти университет...",
      catalog_search_empty: "Извините, мы пока работаем над добавлением этого университета",
      catalog_saved_ok: "Успешно сохранили университет",
      catalog_saved_remove: "Университет убран из избранного",
      catalog_need_login: "Чтобы сохранять вузы, войдите в аккаунт",
      catalog_save_btn: "Сохранить в избранное", catalog_saved_btn: "В избранном",

      profile_greeting: "Привет", profile_logout: "Выйти",
      profile_saved_title: "⭐ Понравившиеся университеты",
      profile_saved_sub: "Те, которые ты отметил звёздочкой в каталоге",
      profile_tests_title: "🎯 Результаты теста",
      profile_tests_sub: "Университеты, которые ИИ подобрал по твоим ответам",
      profile_empty_saved: "Ты пока не сохранил ни одного университета.",
      profile_empty_saved_hint: "Зайди в каталог и нажми на звёздочку рядом с вузом.",
      profile_empty_tests: "Ты пока не проходил тест.",
      profile_empty_tests_hint: "Пройти тест на подбор университета →",
      profile_need_login_title: "Сначала войди в аккаунт",
      profile_need_login_desc: "Чтобы сохранять университеты и видеть результаты тестов — создай аккаунт или войди.",
      profile_create_account: "Создать аккаунт",
      profile_loading: "Загрузка профиля",
      profile_last_test: "Последний тест", profile_test: "Тест",
      profile_unis_found: "университетов найдено",

      test_title: "Найдём твой идеальный университет",
      test_sub: "Ответь на несколько вопросов — про учёбу, страну мечты, климат и то, как ты хочешь жить.",
      test_start: "Начать", test_question: "Вопрос", test_of: "из",
      test_ask: "ИИ спрашивает", test_thinking: "ИИ думает",
      test_answer_placeholder: "Напиши свой ответ здесь...", test_send: "Отправить",
      test_restart: "Пройти заново",
      test_final_title: "Готово! Вот твои университеты",
      test_final_sub: "ИИ проанализировал твои ответы и подобрал варианты по 4 категориям.",
      test_saved_banner: "Ваш результат сохранён в профиле",
      test_saved_hint: "Посмотреть в профиле →",
      test_not_saved_banner: "Войдите, чтобы сохранить результат",
      test_not_saved_hint: "Войти",
      test_cat_academic: "Подходят по учебным показателям",
      test_cat_lifestyle: "Подходят по желанию жить",
      test_cat_safe: "Куда шанс поступить высокий",
      test_cat_reach: "Куда мог бы, но не дотягиваешь",
      test_empty_category: "Ничего не подошло в этой категории",
      test_more: "Подробнее →",
      test_analyzing: "ИИ анализирует 250 университетов",

      modal_hello: "Добро пожаловать",
      modal_hello_sub: "Создай аккаунт, чтобы сохранять университеты",
      modal_name: "Имя", modal_name_ph: "Например, Айсана",
      modal_email: "Email", modal_password: "Пароль",
      modal_password_ph: "Минимум 6 символов",
      modal_submit_register: "Создать аккаунт", modal_submit_login: "Войти",
      modal_switch_register: "Уже есть аккаунт?", modal_switch_login: "Нет аккаунта?",
      modal_switch_register_btn: "Войти", modal_switch_login_btn: "Создать",
      modal_welcome_back: "С возвращением", modal_welcome_back_sub: "Войди в свой аккаунт",

      // ===== FUN ZONE =====
      fz_title: "FUN ZONE",
      fz_warning_1: "⚠️ Эта страница абсолютно бесполезна.",
      fz_warning_2: "Мы могли бы потратить это время на улучшение алгоритма поступления. Мы выбрали это.",
      fz_aura_title: "University Aura 🗿",
      fz_aura_sub: "Введи свои данные — получи бессмысленный, но очень серьёзный показатель.",
      fz_gpa: "GPA", fz_sat: "SAT", fz_ielts: "IELTS",
      fz_sleep: "Часов сна", fz_study: "Часов учёбы в день",
      fz_calc_aura: "🔥 ПОСЧИТАТЬ АУРУ",
      fz_your_aura: "YOUR ACADEMIC AURA",
      fz_aura_hint: "Это НЕ настоящий академический показатель. Это шутка.",

      fz_roulette_title: "Randomize My Future 🎰",
      fz_roulette_sub: "Пусть сайт решит твою судьбу. Отменить нельзя. (Можно, кнопка ниже.)",
      fz_roulette_btn: "🎰 ПУСТЬ САЙТ РЕШИТ МОЮ СУДЬБУ",
      fz_roulette_spinning: "Крутим...",
      fz_roulette_congrats: "Поздравляем.",
      fz_roulette_again: "🔄 Я НЕ ПРИНИМАЮ СВОЮ СУДЬБУ",

      fz_battle_title: "University Smash or Pass ⚔️",
      fz_battle_sub: "Выбери двух бойцов. Победитель определится абсолютно честно (нет).",
      fz_battle_pick1: "Боец 1", fz_battle_pick2: "Боец 2",
      fz_battle_go: "⚔️ В БОЙ",
      fz_battle_winner: "ПОБЕДИТЕЛЬ",
      fz_battle_reason: "Причина",
      fz_battle_random: "🎲 Случайная пара",

      fz_cat_aura: "Aura",
      fz_cat_drip: "Drip",
      fz_cat_parent: "Parent Approval",
      fz_cat_suffering: "Academic Suffering",
      fz_cat_sleep: "Sleep",
      fz_cat_mc: "Main Character Energy",
      fz_cat_scholarship: "Scholarship Energy",
      fz_cat_npc: "NPC Level",

      fz_cooked_title: "How Cooked Am I? 💀",
      fz_cooked_sub: "Реальные данные. Нереальный вердикт.",
      fz_cooked_btn: "💀 НАСКОЛЬКО Я ПРОЖАРЕН",
      fz_cooked_verdict: "YOU ARE COOKED",
      fz_cooked_days: "Дней до дедлайна",
      fz_cooked_disclaimer: "Результат ни на что не влияет. Успокойся.",

      fz_not_enough: "Заполни все поля, бро 😭",
      fz_loading: "Загружаем вузы...",
      fz_loading_error: "Не смогли загрузить список вузов. Проверь интернет.",

      footer_note: "Fun Zone — шутка. Реальные рекомендации — в тесте."
    },

    en: {
      nav_home: "Home", nav_universities: "Universities", nav_profile: "Profile",
      nav_fanzone: "🤡 Fun Zone",
      nav_login: "Log in", nav_logout: "Log out", nav_hello: "Hi",

      home_eyebrow: "University matching test",
      home_title_pre: "Take the test — find ", home_title_em: "your", home_title_post: " university",
      home_sub: "We match programs and universities to your preferences, test scores and budget.",
      home_cta: "Start searching for universities",
      home_note: "A dedicated AI works out which university could suit you",
      home_quote_top: "“With us it's —", home_quote_bottom: "more comfortable, more practical, more effective”",
      home_seam_desc_top: "Beyond academic scores, we care about the environment you want to live in.",
      home_seam_desc_bottom: "We only recommend universities that genuinely fit you.",
      home_how_title: "How it works", home_how_sub: "Three steps from the first question to a list of matching universities.",
      home_step1_title: "Personal details", home_step1_desc: "Your interests, hobbies and preferences on country, climate and study format.",
      home_step2_title: "Your scores", home_step2_desc: "Grades, test results (SAT, IELTS, etc.) and your approximate budget.",
      home_step3_title: "Test results", home_step3_desc: "A list of universities that suit you best, with explanations and tips.",
      home_footer: "EduPath © 2026. All rights reserved",
      city_seoul: "Seoul", city_berlin: "Berlin", city_boston: "Boston", city_shanghai: "Shanghai",

      catalog_title: "Universities", catalog_sub: "Pick a country and university",
      catalog_filters: "Filters", catalog_budget_label: "Tuition budget (USD/year)",
      catalog_budget_from: "from", catalog_budget_to: "to",
      catalog_country_label: "Country", catalog_country_all: "All countries",
      catalog_grant_label: "Financial aid", catalog_grant_only: "Only with full scholarship",
      catalog_apply: "Apply", catalog_reset: "Reset",
      catalog_choose_uni: "Pick a university", catalog_choose_hint: "Click on a country on the left, then a university to see details.",
      catalog_search_placeholder: "Find a university...", catalog_search_empty: "Sorry, we're still working on adding this university",
      catalog_saved_ok: "University saved successfully", catalog_saved_remove: "University removed from favorites",
      catalog_need_login: "Log in to save universities",
      catalog_save_btn: "Save to favorites", catalog_saved_btn: "Saved",

      profile_greeting: "Hi", profile_logout: "Log out",
      profile_saved_title: "⭐ Favorite universities", profile_saved_sub: "Those you starred in the catalog",
      profile_tests_title: "🎯 Test results", profile_tests_sub: "Universities the AI matched to your answers",
      profile_empty_saved: "You haven't saved any university yet.",
      profile_empty_saved_hint: "Go to the catalog and click the star next to a university.",
      profile_empty_tests: "You haven't taken the test yet.",
      profile_empty_tests_hint: "Take the university matching test →",
      profile_need_login_title: "Please log in first",
      profile_need_login_desc: "Create an account or log in to save universities and view test results.",
      profile_create_account: "Create account", profile_loading: "Loading profile",
      profile_last_test: "Last test", profile_test: "Test",
      profile_unis_found: "universities found",

      test_title: "Let's find your perfect university",
      test_sub: "Answer a few questions about study, dream country, climate, and how you want to live.",
      test_start: "Start", test_question: "Question", test_of: "of",
      test_ask: "AI asks", test_thinking: "AI is thinking",
      test_answer_placeholder: "Type your answer here...", test_send: "Send",
      test_restart: "Take again",
      test_final_title: "Done! Here are your universities",
      test_final_sub: "The AI analyzed your answers and picked options in 4 categories.",
      test_saved_banner: "Your result has been saved to profile",
      test_saved_hint: "See in profile →", test_not_saved_banner: "Log in to save the result",
      test_not_saved_hint: "Log in",
      test_cat_academic: "Fit by academics", test_cat_lifestyle: "Fit by lifestyle",
      test_cat_safe: "High admission chances", test_cat_reach: "Could get in, but need to step up",
      test_empty_category: "Nothing matched in this category",
      test_more: "More →", test_analyzing: "AI is analyzing 250 universities",

      modal_hello: "Welcome", modal_hello_sub: "Create an account to save universities",
      modal_name: "Name", modal_name_ph: "e.g. Aisana", modal_email: "Email",
      modal_password: "Password", modal_password_ph: "At least 6 characters",
      modal_submit_register: "Create account", modal_submit_login: "Log in",
      modal_switch_register: "Already have an account?", modal_switch_login: "No account?",
      modal_switch_register_btn: "Log in", modal_switch_login_btn: "Create",
      modal_welcome_back: "Welcome back", modal_welcome_back_sub: "Log in to your account",

      // ===== FUN ZONE =====
      fz_title: "FUN ZONE",
      fz_warning_1: "⚠️ This page is completely useless.",
      fz_warning_2: "We could have spent this development time improving the admission algorithm. We chose this instead.",
      fz_aura_title: "University Aura 🗿",
      fz_aura_sub: "Enter your stats — get a meaningless but very serious score.",
      fz_gpa: "GPA", fz_sat: "SAT", fz_ielts: "IELTS",
      fz_sleep: "Hours of sleep", fz_study: "Hours of study per day",
      fz_calc_aura: "🔥 CALCULATE MY AURA",
      fz_your_aura: "YOUR ACADEMIC AURA",
      fz_aura_hint: "This is NOT a real academic metric. It's a joke.",

      fz_roulette_title: "Randomize My Future 🎰",
      fz_roulette_sub: "Let the website decide your fate. You cannot refuse. (You can, button below.)",
      fz_roulette_btn: "🎰 LET THE WEBSITE DECIDE MY FUTURE",
      fz_roulette_spinning: "Spinning...",
      fz_roulette_congrats: "Congratulations.",
      fz_roulette_again: "🔄 I DON'T ACCEPT MY FATE",

      fz_battle_title: "University Smash or Pass ⚔️",
      fz_battle_sub: "Pick two fighters. Winner decided absolutely fairly (not).",
      fz_battle_pick1: "Fighter 1", fz_battle_pick2: "Fighter 2",
      fz_battle_go: "⚔️ FIGHT",
      fz_battle_winner: "WINNER",
      fz_battle_reason: "Reason",
      fz_battle_random: "🎲 Random pair",

      fz_cat_aura: "Aura",
      fz_cat_drip: "Drip",
      fz_cat_parent: "Parent Approval",
      fz_cat_suffering: "Academic Suffering",
      fz_cat_sleep: "Sleep",
      fz_cat_mc: "Main Character Energy",
      fz_cat_scholarship: "Scholarship Energy",
      fz_cat_npc: "NPC Level",

      fz_cooked_title: "How Cooked Am I? 💀",
      fz_cooked_sub: "Real data. Unreal verdict.",
      fz_cooked_btn: "💀 HOW COOKED AM I",
      fz_cooked_verdict: "YOU ARE COOKED",
      fz_cooked_days: "Days until deadline",
      fz_cooked_disclaimer: "The result changes nothing. Chill.",

      fz_not_enough: "Fill in all the fields, bro 😭",
      fz_loading: "Loading universities...",
      fz_loading_error: "Couldn't load the university list. Check your connection.",

      footer_note: "Fun Zone is a joke. Real recommendations — in the test."
    },

    zh: {
      nav_home: "首页", nav_universities: "大学", nav_profile: "个人主页",
      nav_fanzone: "🤡 Fun Zone",
      nav_login: "登录", nav_logout: "退出", nav_hello: "你好",

      home_eyebrow: "大学匹配测试",
      home_title_pre: "参加测试，找到", home_title_em: "属于你的", home_title_post: "大学",
      home_sub: "根据你的偏好、考试成绩和预算，为你匹配专业和大学。",
      home_cta: "开始寻找大学", home_note: "专属人工智能将判断哪所大学适合你",
      home_quote_top: "「有我们，", home_quote_bottom: "更舒适、更务实、更高效」",
      home_seam_desc_top: "除了学习成绩，我们同样关心你想生活在怎样的环境中。",
      home_seam_desc_bottom: "我们只推荐真正适合你的大学。",
      home_how_title: "工作原理", home_how_sub: "从第一个问题到匹配大学列表，只需三步。",
      home_step1_title: "个人信息", home_step1_desc: "你的兴趣、爱好以及对国家、气候和学习方式的偏好。",
      home_step2_title: "成绩指标", home_step2_desc: "成绩、考试结果（SAT、雅思等）和大致预算。",
      home_step3_title: "测试结果", home_step3_desc: "最适合你的大学清单，并附有说明和建议。",
      home_footer: "EduPath © 2026 版权所有",
      city_seoul: "首尔", city_berlin: "柏林", city_boston: "波士顿", city_shanghai: "上海",

      catalog_title: "大学", catalog_sub: "选择国家和大学",
      catalog_filters: "筛选", catalog_budget_label: "学费预算（美元/年）",
      catalog_budget_from: "从", catalog_budget_to: "到",
      catalog_country_label: "国家", catalog_country_all: "所有国家",
      catalog_grant_label: "经济援助", catalog_grant_only: "仅显示全额奖学金",
      catalog_apply: "应用", catalog_reset: "重置",
      catalog_choose_uni: "选择一所大学", catalog_choose_hint: "点击左侧的国家，然后点击大学查看详细信息。",
      catalog_search_placeholder: "查找大学...", catalog_search_empty: "抱歉，我们正在努力添加这所大学",
      catalog_saved_ok: "大学已成功保存", catalog_saved_remove: "大学已从收藏中移除",
      catalog_need_login: "登录后才能保存大学",
      catalog_save_btn: "保存到收藏", catalog_saved_btn: "已收藏",

      profile_greeting: "你好", profile_logout: "退出",
      profile_saved_title: "⭐ 收藏的大学", profile_saved_sub: "你在目录中加星标的大学",
      profile_tests_title: "🎯 测试结果", profile_tests_sub: "人工智能根据你的回答匹配的大学",
      profile_empty_saved: "你还没有保存任何大学。",
      profile_empty_saved_hint: "进入目录，点击大学旁边的星星。",
      profile_empty_tests: "你还没有参加过测试。",
      profile_empty_tests_hint: "参加大学匹配测试 →",
      profile_need_login_title: "请先登录",
      profile_need_login_desc: "创建账号或登录以保存大学并查看测试结果。",
      profile_create_account: "创建账号", profile_loading: "正在加载个人资料",
      profile_last_test: "最近测试", profile_test: "测试",
      profile_unis_found: "所大学找到",

      test_title: "让我们找到你理想的大学",
      test_sub: "回答几个关于学习、梦想国家、气候和生活方式的问题。",
      test_start: "开始", test_question: "问题", test_of: "/",
      test_ask: "AI 提问", test_thinking: "AI 正在思考",
      test_answer_placeholder: "在这里输入你的答案...", test_send: "发送",
      test_restart: "重新测试",
      test_final_title: "完成！这是你的大学",
      test_final_sub: "AI 分析了你的回答，并按 4 个类别推荐了选项。",
      test_saved_banner: "你的结果已保存到个人资料", test_saved_hint: "在个人资料中查看 →",
      test_not_saved_banner: "登录以保存结果", test_not_saved_hint: "登录",
      test_cat_academic: "学业上适合", test_cat_lifestyle: "生活方式上适合",
      test_cat_safe: "录取机会高", test_cat_reach: "有机会，但需要提升",
      test_empty_category: "此类别中没有匹配项",
      test_more: "更多 →", test_analyzing: "AI 正在分析 250 所大学",

      modal_hello: "欢迎", modal_hello_sub: "创建账号以保存大学",
      modal_name: "姓名", modal_name_ph: "例如：Aisana", modal_email: "邮箱",
      modal_password: "密码", modal_password_ph: "至少 6 个字符",
      modal_submit_register: "创建账号", modal_submit_login: "登录",
      modal_switch_register: "已有账号？", modal_switch_login: "没有账号？",
      modal_switch_register_btn: "登录", modal_switch_login_btn: "创建",
      modal_welcome_back: "欢迎回来", modal_welcome_back_sub: "登录你的账号",

      // ===== FUN ZONE =====
      fz_title: "FUN ZONE",
      fz_warning_1: "⚠️ 这个页面完全没有用。",
      fz_warning_2: "我们本可以用这些开发时间改进录取算法。但我们选择了这个。",
      fz_aura_title: "University Aura 🗿",
      fz_aura_sub: "输入你的数据，获得一个毫无意义但非常严肃的分数。",
      fz_gpa: "GPA", fz_sat: "SAT", fz_ielts: "IELTS",
      fz_sleep: "睡眠小时数", fz_study: "每天学习小时数",
      fz_calc_aura: "🔥 计算我的气场",
      fz_your_aura: "你的学术气场",
      fz_aura_hint: "这不是真实的学术指标。这只是个玩笑。",

      fz_roulette_title: "Randomize My Future 🎰",
      fz_roulette_sub: "让网站决定你的命运。你无法拒绝。（可以，按钮在下面。）",
      fz_roulette_btn: "🎰 让网站决定我的未来",
      fz_roulette_spinning: "旋转中...",
      fz_roulette_congrats: "恭喜。",
      fz_roulette_again: "🔄 我不接受我的命运",

      fz_battle_title: "University Smash or Pass ⚔️",
      fz_battle_sub: "选两个战士。胜者将绝对公平地决出（并不）。",
      fz_battle_pick1: "战士 1", fz_battle_pick2: "战士 2",
      fz_battle_go: "⚔️ 开战",
      fz_battle_winner: "获胜者",
      fz_battle_reason: "原因",
      fz_battle_random: "🎲 随机组合",

      fz_cat_aura: "气场",
      fz_cat_drip: "潮度",
      fz_cat_parent: "家长认可度",
      fz_cat_suffering: "学业痛苦",
      fz_cat_sleep: "睡眠",
      fz_cat_mc: "主角能量",
      fz_cat_scholarship: "奖学金能量",
      fz_cat_npc: "NPC 等级",

      fz_cooked_title: "How Cooked Am I? 💀",
      fz_cooked_sub: "真实数据。离谱判决。",
      fz_cooked_btn: "💀 我有多惨",
      fz_cooked_verdict: "你完蛋了",
      fz_cooked_days: "距截止日期还有几天",
      fz_cooked_disclaimer: "结果不影响任何事。冷静。",

      fz_not_enough: "把所有字段都填了，兄弟 😭",
      fz_loading: "正在加载大学...",
      fz_loading_error: "无法加载大学列表。检查网络。",

      footer_note: "Fun Zone 是玩笑。真正的推荐在测试里。"
    },

    kk: {
      nav_home: "Басты бет", nav_universities: "Университеттер", nav_profile: "Профиль",
      nav_fanzone: "🤡 Fun Zone",
      nav_login: "Кіру", nav_logout: "Шығу", nav_hello: "Сәлем",

      home_eyebrow: "Университет таңдау тесті",
      home_title_pre: "Тестен өт — ", home_title_em: "өзіңе сай", home_title_post: " университетті тап",
      home_sub: "Қалауларыңа, тест нәтижелеріне және бюджетіңе сай мамандықтар мен университеттерді іріктейміз.",
      home_cta: "Университеттерді іздеп бастау",
      home_note: "Арнайы ЖИ саған қандай университет сәйкес келетінін анықтайды",
      home_quote_top: "«Бізбен —", home_quote_bottom: "ыңғайлырақ, тиімдірек, нәтижелірек»",
      home_seam_desc_top: "Оқу көрсеткіштерінен бөлек, абитуриенттің қандай ортада өмір сүргісі келетіні де маңызды.",
      home_seam_desc_bottom: "Біз тек саған шынымен сәйкес келетін университеттерді ұсынамыз.",
      home_how_title: "Бұл қалай жұмыс істейді",
      home_how_sub: "Бірінші сұрақтан сәйкес университеттер тізіміне дейін үш қадам.",
      home_step1_title: "Жеке деректер", home_step1_desc: "Сенің қызығушылықтарың, хоббиің, ел және оқу форматына қатысты қалауларың.",
      home_step2_title: "Көрсеткіштер", home_step2_desc: "Бағалар, тест нәтижелері (SAT, IELTS және т.б.) және шамамен бюджет.",
      home_step3_title: "Тест нәтижелері", home_step3_desc: "Саған ең сәйкес келетін университеттер тізімі, түсіндірмелермен.",
      home_footer: "EduPath © 2026. Барлық құқықтар қорғалған",
      city_seoul: "Сеул", city_berlin: "Берлин", city_boston: "Бостон", city_shanghai: "Шанхай",

      catalog_title: "Университеттер", catalog_sub: "Ел мен университет таңда",
      catalog_filters: "Сүзгілер", catalog_budget_label: "Оқу бюджеті (USD/жыл)",
      catalog_budget_from: "бастап", catalog_budget_to: "дейін",
      catalog_country_label: "Ел", catalog_country_all: "Барлық елдер",
      catalog_grant_label: "Қаржылық көмек", catalog_grant_only: "Тек толық грантпен",
      catalog_apply: "Қолдану", catalog_reset: "Тазарту",
      catalog_choose_uni: "Университет таңда",
      catalog_choose_hint: "Сол жақтағы елді басып, содан кейін университетті басып, толық ақпаратты көріңіз.",
      catalog_search_placeholder: "Университет іздеу...", catalog_search_empty: "Кешіріңіз, біз бұл университетті қосып жатырмыз",
      catalog_saved_ok: "Университет сәтті сақталды", catalog_saved_remove: "Университет таңдаулылардан алынды",
      catalog_need_login: "Университеттерді сақтау үшін аккаунтқа кіріңіз",
      catalog_save_btn: "Таңдаулыларға сақтау", catalog_saved_btn: "Таңдаулыларда",

      profile_greeting: "Сәлем", profile_logout: "Шығу",
      profile_saved_title: "⭐ Ұнаған университеттер",
      profile_saved_sub: "Каталогта жұлдызшамен белгілегендеріңіз",
      profile_tests_title: "🎯 Тест нәтижелері",
      profile_tests_sub: "ЖИ сенің жауаптарыңа сай таңдаған университеттер",
      profile_empty_saved: "Сен әзірге бірде-бір университетті сақтамадың.",
      profile_empty_saved_hint: "Каталогқа кіріп, университет жанындағы жұлдызшаны басыңыз.",
      profile_empty_tests: "Сен әзірге тест тапсырмадың.",
      profile_empty_tests_hint: "Университет таңдау тестінен өту →",
      profile_need_login_title: "Алдымен аккаунтқа кіріңіз",
      profile_need_login_desc: "Университеттерді сақтау және тест нәтижелерін көру үшін аккаунт жасаңыз немесе кіріңіз.",
      profile_create_account: "Аккаунт жасау", profile_loading: "Профиль жүктелуде",
      profile_last_test: "Соңғы тест", profile_test: "Тест",
      profile_unis_found: "университет табылды",

      test_title: "Өзіңе сай университетті табайық",
      test_sub: "Оқу, армандаған ел, климат және өмір салты туралы бірнеше сұраққа жауап бер.",
      test_start: "Бастау", test_question: "Сұрақ", test_of: "/",
      test_ask: "ЖИ сұрайды", test_thinking: "ЖИ ойланып жатыр",
      test_answer_placeholder: "Жауабыңды осында жаз...", test_send: "Жіберу",
      test_restart: "Қайта өту",
      test_final_title: "Дайын! Міне сенің университеттерің",
      test_final_sub: "ЖИ жауаптарыңды талдап, 4 санат бойынша нұсқаларды таңдады.",
      test_saved_banner: "Нәтижең профильде сақталды", test_saved_hint: "Профильде көру →",
      test_not_saved_banner: "Нәтижені сақтау үшін кіріңіз", test_not_saved_hint: "Кіру",
      test_cat_academic: "Оқу көрсеткіштері бойынша сәйкес",
      test_cat_lifestyle: "Өмір салты бойынша сәйкес",
      test_cat_safe: "Түсу мүмкіндігі жоғары",
      test_cat_reach: "Мүмкіндік бар, бірақ күшейту керек",
      test_empty_category: "Бұл санатта ештеңе сәйкес келмеді",
      test_more: "Толығырақ →", test_analyzing: "ЖИ 250 университетті талдап жатыр",

      modal_hello: "Қош келдің", modal_hello_sub: "Университеттерді сақтау үшін аккаунт жаса",
      modal_name: "Аты", modal_name_ph: "Мысалы, Айсана", modal_email: "Email",
      modal_password: "Құпия сөз", modal_password_ph: "Кемінде 6 таңба",
      modal_submit_register: "Аккаунт жасау", modal_submit_login: "Кіру",
      modal_switch_register: "Аккаунтың бар ма?", modal_switch_login: "Аккаунтың жоқ па?",
      modal_switch_register_btn: "Кіру", modal_switch_login_btn: "Жасау",
      modal_welcome_back: "Қайта келдің", modal_welcome_back_sub: "Аккаунтыңа кір",

      // ===== FUN ZONE =====
      fz_title: "FUN ZONE",
      fz_warning_1: "⚠️ Бұл бет мүлдем пайдасыз.",
      fz_warning_2: "Біз бұл уақытты қабылдау алгоритмін жақсартуға жұмсай алар едік. Біз мұны таңдадық.",
      fz_aura_title: "University Aura 🗿",
      fz_aura_sub: "Деректеріңді енгіз — мағынасыз, бірақ өте байсалды көрсеткіш ал.",
      fz_gpa: "GPA", fz_sat: "SAT", fz_ielts: "IELTS",
      fz_sleep: "Ұйқы сағаттары", fz_study: "Күніне оқу сағаттары",
      fz_calc_aura: "🔥 АУРАМДЫ ЕСЕПТЕУ",
      fz_your_aura: "СЕНІҢ АКАДЕМИЯЛЫҚ АУРАҢ",
      fz_aura_hint: "Бұл НАҚТЫ академиялық көрсеткіш ЕМЕС. Бұл әзіл.",

      fz_roulette_title: "Randomize My Future 🎰",
      fz_roulette_sub: "Сайт тағдырыңды шешсін. Бас тарта алмайсың. (Аласың, төмендегі батырма.)",
      fz_roulette_btn: "🎰 САЙТ ТАҒДЫРЫМДЫ ШЕШСІН",
      fz_roulette_spinning: "Айналдырып жатырмыз...",
      fz_roulette_congrats: "Құттықтаймыз.",
      fz_roulette_again: "🔄 МЕН ТАҒДЫРЫМДЫ ҚАБЫЛДАМАЙМЫН",

      fz_battle_title: "University Smash or Pass ⚔️",
      fz_battle_sub: "Екі жауынгерді таңда. Жеңімпаз мүлдем әділ анықталады (жоқ).",
      fz_battle_pick1: "Жауынгер 1", fz_battle_pick2: "Жауынгер 2",
      fz_battle_go: "⚔️ ШАЙҚАС",
      fz_battle_winner: "ЖЕҢІМПАЗ",
      fz_battle_reason: "Себебі",
      fz_battle_random: "🎲 Кездейсоқ жұп",

      fz_cat_aura: "Аура",
      fz_cat_drip: "Drip",
      fz_cat_parent: "Ата-ана мақұлдауы",
      fz_cat_suffering: "Академиялық азап",
      fz_cat_sleep: "Ұйқы",
      fz_cat_mc: "Басты кейіпкер энергиясы",
      fz_cat_scholarship: "Стипендия энергиясы",
      fz_cat_npc: "NPC деңгейі",

      fz_cooked_title: "How Cooked Am I? 💀",
      fz_cooked_sub: "Нақты деректер. Нақты емес үкім.",
      fz_cooked_btn: "💀 ҚАНШАЛЫҚ ЖАНЫП ТҰРМЫН",
      fz_cooked_verdict: "СЕН ЖАНЫП ТҰРСЫҢ",
      fz_cooked_days: "Дедлайнға дейінгі күндер",
      fz_cooked_disclaimer: "Нәтиже ештеңеге әсер етпейді. Тыныштал.",

      fz_not_enough: "Барлық өрісті толтыр, бауырым 😭",
      fz_loading: "Университеттер жүктелуде...",
      fz_loading_error: "Университет тізімін жүктей алмадық. Интернетті тексер.",

      footer_note: "Fun Zone — әзіл. Нақты ұсыныстар — тестте."
    },

    ky: {
      nav_home: "Башкы бет", nav_universities: "Университеттер", nav_profile: "Профиль",
      nav_fanzone: "🤡 Fun Zone",
      nav_login: "Кирүү", nav_logout: "Чыгуу", nav_hello: "Салам",

      home_eyebrow: "Университет тандоо тести",
      home_title_pre: "Тесттен өт — ", home_title_em: "өзүңө ылайык", home_title_post: " университет тап",
      home_sub: "Каалоолоруңа, тест жыйынтыктарыңа жана бюджетіңе ылайык багыттар мен университеттерди тандайбыз.",
      home_cta: "Университеттерди издей баштоо",
      home_note: "Атайын ЖИ сага кайсы университет ылайыктуу экенин аныктайт",
      home_quote_top: "«Биз менен —", home_quote_bottom: "ыңгайлуураак, практикалык, натыйжалуу»",
      home_seam_desc_top: "Окуу көрсөткүчтөрүнөн тышкары, абитуриенттин кандай чөйрөдө жашагысы келгени да маанилүү.",
      home_seam_desc_bottom: "Биз сага чындап ылайыктуу университеттерди гана сунуштайбыз.",
      home_how_title: "Бул кантип иштейт",
      home_how_sub: "Биринчи суроодон ылайыктуу университеттердин тизмесине чейин үч кадам.",
      home_step1_title: "Жеке маалыматтар", home_step1_desc: "Сенин кызыгууларың, хоббииң, өлкө жана окуу форматы боюнча каалоолоруң.",
      home_step2_title: "Көрсөткүчтөр", home_step2_desc: "Баалар, тест жыйынтыктары (SAT, IELTS ж.б.) жана болжолдуу бюджет.",
      home_step3_title: "Тест жыйынтыктары", home_step3_desc: "Сага эң ылайыктуу университеттердин тизмеси, түшүндүрмөлөр менен.",
      home_footer: "EduPath © 2026. Бардык укуктар корголгон",
      city_seoul: "Сеул", city_berlin: "Берлин", city_boston: "Бостон", city_shanghai: "Шанхай",

      catalog_title: "Университеттер", catalog_sub: "Өлкө жана университет танда",
      catalog_filters: "Фильтрлер", catalog_budget_label: "Окуу бюджети (USD/жыл)",
      catalog_budget_from: "баштап", catalog_budget_to: "чейин",
      catalog_country_label: "Өлкө", catalog_country_all: "Бардык өлкөлөр",
      catalog_grant_label: "Каржылык жардам", catalog_grant_only: "Толук грант менен гана",
      catalog_apply: "Колдонуу", catalog_reset: "Тазалоо",
      catalog_choose_uni: "Университет танда",
      catalog_choose_hint: "Сол жактагы өлкөнү басып, анан университетти басып, толук маалыматты көрүңүз.",
      catalog_search_placeholder: "Университет издөө...", catalog_search_empty: "Кечиресиз, биз бул университетти кошуп жатабыз",
      catalog_saved_ok: "Университет ийгиликтүү сакталды", catalog_saved_remove: "Университет тандалмалардан алынды",
      catalog_need_login: "Университеттерди сактоо үчүн аккаунтка кириңиз",
      catalog_save_btn: "Тандалмаларга сактоо", catalog_saved_btn: "Тандалмаларда",

      profile_greeting: "Салам", profile_logout: "Чыгуу",
      profile_saved_title: "⭐ Жаккан университеттер",
      profile_saved_sub: "Каталогдо жылдызча менен белгилегендериңиз",
      profile_tests_title: "🎯 Тест жыйынтыктары",
      profile_tests_sub: "ЖИ сенин жоопторуңа ылайык тандаган университеттер",
      profile_empty_saved: "Сен азырынча бир да университет сактаган жоксуң.",
      profile_empty_saved_hint: "Каталогго кирип, университеттин жанындагы жылдызчаны басыңыз.",
      profile_empty_tests: "Сен азырынча тест тапшырган жоксуң.",
      profile_empty_tests_hint: "Университет тандоо тестинен өтүү →",
      profile_need_login_title: "Адеги аккаунтка кириңиз",
      profile_need_login_desc: "Университеттерди сактоо жана тест жыйынтыктарын көрүү үчүн аккаунт түзүңүз же кириңиз.",
      profile_create_account: "Аккаунт түзүү", profile_loading: "Профиль жүктөлүүдө",
      profile_last_test: "Акыркы тест", profile_test: "Тест",
      profile_unis_found: "университет табылды",

      test_title: "Өзүңө ылайыктуу университетти табабыз",
      test_sub: "Окуу, кыялдагы өлкө, климат жана жашоо образы тууралуу бир нече суроого жооп бер.",
      test_start: "Баштоо", test_question: "Суроо", test_of: "/",
      test_ask: "ЖИ сурайт", test_thinking: "ЖИ ойлонуп жатат",
      test_answer_placeholder: "Жообуңду ушул жерге жаз...", test_send: "Жөнөтүү",
      test_restart: "Кайра өтүү",
      test_final_title: "Даяр! Мына сенин университеттериң",
      test_final_sub: "ЖИ жоопторуңду талдап, 4 категория боюнча варианттарды тандады.",
      test_saved_banner: "Жыйынтыгың профилде сакталды", test_saved_hint: "Профилде көрүү →",
      test_not_saved_banner: "Жыйынтыкты сактоо үчүн кириңиз", test_not_saved_hint: "Кирүү",
      test_cat_academic: "Окуу көрсөткүчтөрү боюнча ылайыктуу",
      test_cat_lifestyle: "Жашоо образы боюнча ылайыктуу",
      test_cat_safe: "Тапшыруу мүмкүнчүлүгү жогору",
      test_cat_reach: "Мүмкүнчүлүк бар, бирок күчөтүү керек",
      test_empty_category: "Бул категорияда эч нерсе ылайыктуу болгон жок",
      test_more: "Кененирээк →", test_analyzing: "ЖИ 250 университетти талдап жатат",

      modal_hello: "Кош келиңиз", modal_hello_sub: "Университеттерди сактоо үчүн аккаунт түзүңүз",
      modal_name: "Аты", modal_name_ph: "Мисалы, Айсана", modal_email: "Email",
      modal_password: "Сырсөз", modal_password_ph: "Жок дегенде 6 белги",
      modal_submit_register: "Аккаунт түзүү", modal_submit_login: "Кирүү",
      modal_switch_register: "Аккаунтуңуз барбы?", modal_switch_login: "Аккаунтуңуз жокпу?",
      modal_switch_register_btn: "Кирүү", modal_switch_login_btn: "Түзүү",
      modal_welcome_back: "Кайра кош келиңиз", modal_welcome_back_sub: "Аккаунтуңузга кириңиз",

      // ===== FUN ZONE =====
      fz_title: "FUN ZONE",
      fz_warning_1: "⚠️ Бул барак толугу менен пайдасыз.",
      fz_warning_2: "Биз бул убакытты кабыл алуу алгоритмин жакшыртууга жумшай алмакпыз. Биз муну тандадык.",
      fz_aura_title: "University Aura 🗿",
      fz_aura_sub: "Маалыматтарыңды киргиз — маанисиз, бирок абдан олуттуу көрсөткүч ал.",
      fz_gpa: "GPA", fz_sat: "SAT", fz_ielts: "IELTS",
      fz_sleep: "Уйку сааттары", fz_study: "Күнүнө окуу сааттары",
      fz_calc_aura: "🔥 АУРАМДЫ ЭСЕПТЕ",
      fz_your_aura: "СЕНИН АКАДЕМИЯЛЫК АУРАҢ",
      fz_aura_hint: "Бул НАКЫЙ академиялык көрсөткүч ЭМЕС. Бул тамаша.",

      fz_roulette_title: "Randomize My Future 🎰",
      fz_roulette_sub: "Сайт тагдырыңды чечсин. Баш тарта албайсың. (Аласың, төмөнкү баскыч.)",
      fz_roulette_btn: "🎰 САЙТ ТАГДЫРЫМДЫ ЧЕЧСИН",
      fz_roulette_spinning: "Айлантып жатабыз...",
      fz_roulette_congrats: "Куттуктайбыз.",
      fz_roulette_again: "🔄 МЕН ТАГДЫРЫМДЫ КАБЫЛ АЛБАЙМЫН",

      fz_battle_title: "University Smash or Pass ⚔️",
      fz_battle_sub: "Эки жоокерди танда. Жеңүүчү толугу менен адилеттүү аныкталат (жок).",
      fz_battle_pick1: "Жоокер 1", fz_battle_pick2: "Жоокер 2",
      fz_battle_go: "⚔️ САЛГЫЛАШУУ",
      fz_battle_winner: "ЖЕҢҮҮЧҮ",
      fz_battle_reason: "Себеби",
      fz_battle_random: "🎲 Кокустан жуп",

      fz_cat_aura: "Аура",
      fz_cat_drip: "Drip",
      fz_cat_parent: "Ата-эне жактыруусу",
      fz_cat_suffering: "Академиялык азап",
      fz_cat_sleep: "Уйку",
      fz_cat_mc: "Башкы каарман энергиясы",
      fz_cat_scholarship: "Стипендия энергиясы",
      fz_cat_npc: "NPC деңгээли",

      fz_cooked_title: "How Cooked Am I? 💀",
      fz_cooked_sub: "Чыныгы маалыматтар. Чыныгы эмес өкүм.",
      fz_cooked_btn: "💀 КАНЧАЛЫК КҮЙҮП ЖАТАМ",
      fz_cooked_verdict: "СЕН КҮЙҮП ЖАТАСЫҢ",
      fz_cooked_days: "Дедлайнга чейинки күндөр",
      fz_cooked_disclaimer: "Жыйынтык эч нерсеге таасир этпейт. Тынчтан.",

      fz_not_enough: "Бардык талааларды толтур, байке 😭",
      fz_loading: "Университеттер жүктөлүүдө...",
      fz_loading_error: "Университеттердин тизмесин жүктөй албадык. Интернетти текшер.",

      footer_note: "Fun Zone — тамаша. Чыныгы сунуштар — тестте."
    }
  };

  // ============================================================
  // ЯДРО
  // ============================================================

  function getLang() {
    return localStorage.getItem(LANG_KEY) || "ru";
  }

  function emitLangChange() {
    window.dispatchEvent(new Event("edupath-lang-change"));
  }

  function setLang(lang) {
    if (!translations[lang]) return;
    localStorage.setItem(LANG_KEY, lang);
    applyAll();
    document.documentElement.lang = lang;

    document.querySelectorAll(".lang-option").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });

    emitLangChange();
  }

  function t(key) {
    const lang = getLang();
    const dict = translations[lang] || translations.ru;
    return dict[key] !== undefined ? dict[key] : (translations.ru[key] || key);
  }

  function applyAll() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      el.setAttribute("placeholder", t(key));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      const key = el.getAttribute("data-i18n-title");
      el.setAttribute("title", t(key));
    });
  }

  // ============================================================
  // БУРГЕР-МЕНЮ
  // ============================================================

  function buildBurgerMenu() {
    const nav = document.querySelector("nav.wrap");
    if (!nav) return;
    if (nav.querySelector(".burger-btn")) return;

    const burger = document.createElement("button");
    burger.type = "button";
    burger.className = "burger-btn";
    burger.setAttribute("aria-label", "Меню");
    burger.innerHTML = `<span></span><span></span><span></span>`;

    const panel = document.createElement("div");
    panel.className = "burger-panel";
    panel.id = "burgerPanel";
    panel.innerHTML = `
      <div class="burger-panel-inner">
        <a href="index.html" data-i18n="nav_home">Главная</a>
        <a href="universities.html" data-i18n="nav_universities">Университеты</a>
        <a href="profile.html" data-i18n="nav_profile">Профиль</a>
        <a href="fanzone.html" data-i18n="nav_fanzone">🤡 Fun Zone</a>
      </div>
    `;

    nav.appendChild(burger);
    document.body.appendChild(panel);

    burger.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.classList.toggle("open");
      burger.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
      if (!panel.contains(e.target) && !burger.contains(e.target)) {
        panel.classList.remove("open");
        burger.classList.remove("open");
      }
    });

    panel.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => {
        panel.classList.remove("open");
        burger.classList.remove("open");
      });
    });
  }

  function injectStyles() {
    if (document.getElementById("burger-styles")) return;
    const style = document.createElement("style");
    style.id = "burger-styles";
    style.textContent = `
      .burger-btn {
        display: none;
        width: 38px; height: 38px;
        border-radius: 8px; padding: 0;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 5px;
        background: transparent;
        transition: background .2s;
      }
      .burger-btn:hover { background: var(--cream-deep, #EFE1C6); }
      .burger-btn span {
        display: block; width: 20px; height: 2px;
        background: #2B1B10; border-radius: 2px;
        transition: transform .3s, opacity .3s;
      }
      .burger-btn.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
      .burger-btn.open span:nth-child(2) { opacity: 0; }
      .burger-btn.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

      .burger-panel {
        position: fixed; top: 84px; left: 0; right: 0;
        background: #FBF6EC;
        border-bottom: 1px solid rgba(43,27,16,0.14);
        box-shadow: 0 20px 40px -20px rgba(43,27,16,0.25);
        z-index: 99;
        max-height: 0; overflow: hidden; opacity: 0;
        transform: translateY(-10px);
        transition: max-height .35s cubic-bezier(0.22,1,0.36,1), opacity .25s, transform .25s;
      }
      .burger-panel.open { max-height: 360px; opacity: 1; transform: translateY(0); }
      .burger-panel-inner { display: flex; flex-direction: column; padding: 16px 24px; }
      .burger-panel-inner a {
        font-family: 'Work Sans', sans-serif; font-size: 17px;
        color: #2B1B10; padding: 14px 0;
        border-bottom: 1px solid rgba(43,27,16,0.08);
      }
      .burger-panel-inner a:last-child { border-bottom: none; }
      .burger-panel-inner a:hover { color: #8C5A34; }

      @media (max-width: 900px) {
        .burger-btn { display: flex; }
        .nav-links { display: none !important; }
      }
      @media (min-width: 901px) {
        .burger-panel { display: none; }
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================================
  // ГЛОБУС
  // ============================================================

  function bindLangSwitcher() {
    const langBtn = document.getElementById("langBtn");
    const langMenu = document.getElementById("langMenu");
    if (!langBtn || !langMenu) return;

    langBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = langMenu.classList.toggle("open");
      langBtn.setAttribute("aria-expanded", isOpen);
    });

    langMenu.addEventListener("click", (e) => {
      const option = e.target.closest(".lang-option");
      if (!option) return;
      setLang(option.dataset.lang);
      langMenu.classList.remove("open");
      langBtn.setAttribute("aria-expanded", "false");
    });

    document.addEventListener("click", () => {
      langMenu.classList.remove("open");
      langBtn.setAttribute("aria-expanded", "false");
    });
  }

  // ============================================================
  // ИНИЦИАЛИЗАЦИЯ
  // ============================================================

  function init() {
    injectStyles();
    buildBurgerMenu();
    bindLangSwitcher();
    applyAll();
    document.documentElement.lang = getLang();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ЭКСПОРТ
  window.I18N = {
    t: t,
    getLang: getLang,
    setLang: setLang,
    applyAll: applyAll
  };

})();
