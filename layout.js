/* ============================================================
   EduPath — layout.js (v2)
   Шапка, меню и подвал для ВСЕХ страниц. Два варианта интерфейса:
     A — верхнее меню + бургер на телефоне
     B — «как приложение»: нижние вкладки на телефоне,
         рейка с иконками на планшете, боковое меню на ноутбуке/ПК
     C — «новый»: плавающая панель внизу на телефоне, панель-пилюля сверху на ПК
     D — 60/30/10: белый, чёрный, синий; меню сверху, на телефоне — чёрное меню на весь экран
   Переключить: ?ui=a / ?ui=b / ?ui=c в адресе, или кнопка «Вид» внизу экрана.
   Когда выберете вариант — поставь DEFAULT_UI и SHOW_SWITCH = false.

   На странице нужно:
     <header class="ep-header" id="siteHeader" data-variant="app"></header>   (в начале <body>)
     <script src="layout.js"></script>   (СРАЗУ после этого header)
   data-variant: "app" — внутренние страницы, "landing" — главная для гостей,
                 "auto" — документы (сам выбирает по тому, вошёл ли человек).
   ============================================================ */
(function () {
  "use strict";

  const CONTACT_EMAIL = "edupath.our.team@gmail.com";
  const HOME = "app.html";
  const DEFAULT_UI = "a";     // какой вариант видят все по умолчанию
  const SHOW_SWITCH = true;   // показывать кнопку «Вид A/B» (на время выбора)

  // пункты меню: [файл, ключ текста, иконка]
  const NAV = [
    [HOME, "nav_home", "home"],
    ["universities.html", "nav_universities", "uni"],
    ["resources.html", "nav_resources", "link"],
    ["content.html", "nav_content", "play"],
    ["focus.html", "nav_focus", "timer"],
    ["profile.html", "nav_profile", "user"]
  ];
  // нижние вкладки на телефоне (вариант B): 4 раздела + «Ещё»
  const TABS = [[HOME, "nav_home", "home"], ["universities.html", "tab_uni", "uni"], ["focus.html", "nav_focus", "timer"], ["profile.html", "nav_profile", "user"]];

  const LANGS = [["ru", "Русский"], ["en", "English"], ["zh", "中文"], ["kk", "Қазақша"], ["ky", "Кыргызча"]];

  const TX = {
    ru: { nav_home: "Главная", nav_universities: "Университеты", nav_resources: "Полезное", nav_content: "Контент", nav_focus: "Фокус", nav_profile: "Профиль",
      tab_uni: "Вузы", more: "Ещё", menu: "Меню", lang: "Сменить язык", login: "Войти", test: "ИИ-тест", test_sub: "12 вузов под тебя", close: "Закрыть",
      tag: "Помогаем выбрать университет за рубежом: условия, дедлайны, стоимость жизни — в одном месте.",
      sections: "Разделы", project: "Проект", docs: "Документы", team: "О команде", write: "Написать нам",
      privacy: "Политика конфиденциальности", terms: "Условия использования", view: "Вид", show_all: "Показать все", show_less: "Свернуть",
      ai: "<b>ИИ рекомендует, но не гарантирует.</b> Подборки и справки EduPath собраны автоматически и могут содержать ошибки. Перед подачей проверяй условия на официальных сайтах вузов.",
      copy: "© 2026 EduPath. Учебный проект." },
    en: { nav_home: "Home", nav_universities: "Universities", nav_resources: "Resources", nav_content: "Content", nav_focus: "Focus", nav_profile: "Profile",
      tab_uni: "Unis", more: "More", menu: "Menu", lang: "Change language", login: "Log in", test: "AI test", test_sub: "12 universities for you", close: "Close",
      tag: "We help you choose a university abroad: requirements, deadlines and cost of living in one place.",
      sections: "Sections", project: "Project", docs: "Legal", team: "Our team", write: "Contact us",
      privacy: "Privacy Policy", terms: "Terms of Use", view: "View", show_all: "Show all", show_less: "Show less",
      ai: "<b>AI recommends, it does not guarantee.</b> EduPath selections and summaries are generated automatically and may contain mistakes. Always check the requirements on official university websites before applying.",
      copy: "© 2026 EduPath. Student project." },
    kk: { nav_home: "Басты бет", nav_universities: "Университеттер", nav_resources: "Пайдалы", nav_content: "Контент", nav_focus: "Фокус", nav_profile: "Профиль",
      tab_uni: "ЖОО", more: "Тағы", menu: "Мәзір", lang: "Тілді ауыстыру", login: "Кіру", test: "ЖИ-тест", test_sub: "Саған 12 университет", close: "Жабу",
      tag: "Шетелдегі университетті таңдауға көмектесеміз: талаптар, мерзімдер, өмір сүру құны — бір жерде.",
      sections: "Бөлімдер", project: "Жоба", docs: "Құжаттар", team: "Біздің команда", write: "Бізге жазу",
      privacy: "Құпиялылық саясаты", terms: "Пайдалану шарттары", view: "Көрініс", show_all: "Барлығын көрсету", show_less: "Жасыру",
      ai: "<b>ЖИ ұсынады, бірақ кепілдік бермейді.</b> EduPath іріктемелері мен анықтамалары автоматты түрде жиналады және қате болуы мүмкін. Құжат тапсырмас бұрын шарттарды университеттің ресми сайтынан тексер.",
      copy: "© 2026 EduPath. Оқу жобасы." },
    ky: { nav_home: "Башкы бет", nav_universities: "Университеттер", nav_resources: "Пайдалуу", nav_content: "Контент", nav_focus: "Фокус", nav_profile: "Профиль",
      tab_uni: "ЖОЖ", more: "Дагы", menu: "Меню", lang: "Тилди алмаштыруу", login: "Кирүү", test: "ЖИ-тест", test_sub: "Сага 12 университет", close: "Жабуу",
      tag: "Чет өлкөдөгү университетти тандоого жардам беребиз: талаптар, мөөнөттөр, жашоо наркы — бир жерде.",
      sections: "Бөлүмдөр", project: "Долбоор", docs: "Документтер", team: "Биздин команда", write: "Бизге жазуу",
      privacy: "Купуялык саясаты", terms: "Колдонуу шарттары", view: "Көрүнүш", show_all: "Баарын көрсөтүү", show_less: "Жыйноо",
      ai: "<b>ЖИ сунуштайт, бирок кепилдик бербейт.</b> EduPath тандоолору жана маалыматтары автоматтык түрдө чогултулат жана ката болушу мүмкүн. Тапшыруудан мурун шарттарды университеттин расмий сайтынан текшер.",
      copy: "© 2026 EduPath. Окуу долбоору." },
    zh: { nav_home: "首页", nav_universities: "大学", nav_resources: "实用资源", nav_content: "内容", nav_focus: "专注", nav_profile: "个人资料",
      tab_uni: "大学", more: "更多", menu: "菜单", lang: "切换语言", login: "登录", test: "AI 测试", test_sub: "为你推荐 12 所大学", close: "关闭",
      tag: "帮你选择海外大学：申请要求、截止日期和生活成本，一站查看。",
      sections: "栏目", project: "项目", docs: "法律文件", team: "我们的团队", write: "联系我们",
      privacy: "隐私政策", terms: "使用条款", view: "界面", show_all: "显示全部", show_less: "收起",
      ai: "<b>AI 只提供建议，不作保证。</b>EduPath 的推荐和资料为自动生成，可能有误。申请前请务必在大学官网核实要求。",
      copy: "© 2026 EduPath。学生项目。" }
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };
  const lang = () => store.get("edupath_lang") || "ru";
  const tx = (k) => (TX[lang()] || TX.ru)[k] || TX.ru[k] || k;
  const loggedIn = () => !!store.get("edupath_token");
  const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  // ---------- какой вариант интерфейса ----------
  const UI = (function () {
    const q = new URLSearchParams(location.search).get("ui");
    const OK = ["a", "b", "c", "d"];
    if (OK.includes(q)) store.set("edupath_ui", q);
    const v = store.get("edupath_ui");
    return OK.includes(v) ? v : DEFAULT_UI;
  })();
  document.documentElement.classList.add("ui-" + UI);
  // у вариантов C и D свои шрифты
  if (UI === "d" && !document.getElementById("epFontsD")) {
    const l = document.createElement("link");
    l.id = "epFontsD"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  }
  if (UI === "c" && !document.getElementById("epFontsC")) {
    const l = document.createElement("link");
    l.id = "epFontsC"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Unbounded:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(l);
  }

  const ICONS = {
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    uni: '<path d="M3 10 12 5l9 5-9 5-9-5Z"/><path d="M7 12v5c3 2 7 2 10 0v-5"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    play: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3V9Z"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    team: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.8-3.2 3.2-5 6-5s5.2 1.8 6 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2c2.6.2 4.5 2 5 4.8"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'
  };
  const ico = (n) => `<svg class="ep-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;

  const LOGO_SVG = `<svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#0F2A4A"/>
      <circle cx="20" cy="20" r="14.5" stroke="#F2B233" stroke-width="1.4" opacity=".55"/>
      <path d="M27.5 12.5 L18 18 L12.5 27.5 L22 22 Z" fill="#F2B233"/>
      <circle cx="20" cy="20" r="2.2" fill="#fff"/></svg>`;
  const GLOBE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.6 2.7 4 6 4 9.5s-1.4 6.8-4 9.5c-2.6-2.7-4-6-4-9.5s1.4-6.8 4-9.5z"/></svg>`;

  function variant(h) {
    const v = (h && h.dataset.variant) || "app";
    if (v === "auto") return loggedIn() ? "app" : "landing";
    return v;
  }

  function navLinksHtml(cls, withIcons) {
    return NAV.map(([href, key, icon]) => {
      const active = href === file ? " active" : "";
      const aria = active ? ' aria-current="page"' : "";
      return `<a href="${href}" class="${cls}${active}"${aria}>${withIcons ? ico(icon) : ""}<span data-ep="${key}">${tx(key)}</span></a>`;
    }).join("");
  }

  function langMenuHtml() {
    const cur = lang();
    return `<div class="ep-lang">
        <button type="button" class="ep-icon-btn" id="langBtn" aria-haspopup="true" aria-expanded="false" data-ep-label="lang" aria-label="${tx("lang")}">${GLOBE_SVG}</button>
        <div class="ep-lang-menu lang-menu" id="langMenu" role="menu">
          ${LANGS.map(([c, n]) => `<button type="button" class="lang-option${c === cur ? " active" : ""}" data-lang="${c}" role="menuitem" lang="${c}">${n}</button>`).join("")}
        </div></div>`;
  }

  const smallLinks = () => `
      <a href="team.html" data-ep="team">${tx("team")}</a>
      <a href="mailto:${CONTACT_EMAIL}" data-ep="write">${tx("write")}</a>
      <a href="privacy.html" data-ep="privacy">${tx("privacy")}</a>
      <a href="terms.html" data-ep="terms">${tx("terms")}</a>`;

  // =========================================================
  // ВАРИАНТ A: верхнее меню + бургер
  // =========================================================
  function buildHeaderA(h, v) {
    const logoHref = v === "app" ? HOME : "index.html";
    if (v === "landing") {
      h.innerHTML = `<nav class="ep-nav" aria-label="EduPath">
          <a href="${logoHref}" class="ep-logo">${LOGO_SVG}<span>EduPath</span></a>
          <div class="ep-right">${langMenuHtml()}
            <a href="#" class="btn-login" data-auth-open="login" data-ep="login">${tx("login")}</a></div>
        </nav>`;
      return;
    }
    h.innerHTML = `<nav class="ep-nav" aria-label="EduPath">
        <a href="${logoHref}" class="ep-logo">${LOGO_SVG}<span>EduPath</span></a>
        <div class="ep-links">${navLinksHtml("", false)}</div>
        <div class="ep-right">${langMenuHtml()}
          ${UI === "d" ? `<a href="test.html" class="d-test-btn"><span data-ep="test">${tx("test")}</span></a>` : ""}
          <button type="button" class="ep-icon-btn ep-burger" id="epBurger" aria-expanded="false" aria-controls="epDrawer" data-ep-label="menu" aria-label="${tx("menu")}"><span></span><span></span><span></span></button>
        </div>
      </nav>`;

    const drawer = document.createElement("div");
    drawer.className = "ep-drawer";
    drawer.id = "epDrawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.innerHTML = `${navLinksHtml("ep-drawer-link", false)}${UI === "d" ? `<a href="test.html" class="ep-drawer-link d-drawer-test"><span data-ep="test">${tx("test")}</span></a>` : ""}<div class="ep-drawer-small">${smallLinks()}</div>`;
    h.insertAdjacentElement("afterend", drawer);

    const burger = h.querySelector("#epBurger");
    const setOpen = (open) => {
      drawer.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("ep-lock", open);
    };
    burger.addEventListener("click", (e) => { e.stopPropagation(); setOpen(!drawer.classList.contains("open")); });
    drawer.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
    window.addEventListener("resize", () => { if (window.innerWidth >= 1000) setOpen(false); });
  }

  // =========================================================
  // ВАРИАНТ B: приложение (вкладки / рейка / боковое меню)
  // =========================================================
  function buildHeaderB(h, v) {
    if (v === "landing") { buildHeaderA(h, v); return; }   // у гостей своя шапка лендинга
    h.classList.add("b-header");
    h.innerHTML = `<div class="b-top">
        <a href="${HOME}" class="ep-logo">${LOGO_SVG}<span>EduPath</span></a>
        <div class="b-top-right">
          <a href="test.html" class="b-test-pill">${ico("spark")}<span data-ep="test">${tx("test")}</span></a>
          ${langMenuHtml()}
        </div></div>`;

    // боковое меню (планшет — рейка с иконками, ноутбук/ПК — с подписями)
    const side = document.createElement("nav");
    side.className = "b-side";
    side.setAttribute("aria-label", "EduPath");
    side.innerHTML = `
      <a href="${HOME}" class="ep-logo b-side-logo">${LOGO_SVG}<span>EduPath</span></a>
      <a href="test.html" class="b-side-test${file === "test.html" ? " active" : ""}">
        <span class="b-side-test-ico">${ico("spark")}</span>
        <span class="b-side-test-txt"><b data-ep="test">${tx("test")}</b><small data-ep="test_sub">${tx("test_sub")}</small></span>
      </a>
      <div class="b-side-links">${navLinksHtml("b-side-link", true)}</div>
      <div class="b-side-extra">
        <a href="team.html" class="b-side-link${file === "team.html" ? " active" : ""}">${ico("team")}<span data-ep="team">${tx("team")}</span></a>
        <a href="mailto:${CONTACT_EMAIL}" class="b-side-link">${ico("mail")}<span data-ep="write">${tx("write")}</span></a>
      </div>
      <div class="b-side-docs"><a href="privacy.html" data-ep="privacy">${tx("privacy")}</a><a href="terms.html" data-ep="terms">${tx("terms")}</a></div>`;
    h.insertAdjacentElement("afterend", side);

    // кнопка языка одна: на телефоне — в верхней строке, на планшете и ПК — внизу бокового меню
    const langEl = h.querySelector(".ep-lang");
    const slot = document.createElement("div");
    slot.className = "b-side-lang";
    side.appendChild(slot);
    const mq = window.matchMedia("(min-width: 700px)");
    const placeLang = () => (mq.matches ? slot : h.querySelector(".b-top-right")).appendChild(langEl);
    placeLang();
    if (mq.addEventListener) mq.addEventListener("change", placeLang); else mq.addListener(placeLang);

    // нижние вкладки (телефон)
    const tabs = document.createElement("nav");
    tabs.className = "b-tabs";
    tabs.setAttribute("aria-label", "EduPath");
    const moreActive = ["resources.html", "content.html", "team.html", "privacy.html", "terms.html"].includes(file);
    tabs.innerHTML = TABS.map(([href, key, icon]) => {
      const a = href === file ? " active" : "";
      return `<a href="${href}" class="b-tab${a}"${a ? ' aria-current="page"' : ""}>${ico(icon)}<span data-ep="${key}">${tx(key)}</span></a>`;
    }).join("") + `<button type="button" class="b-tab${moreActive ? " active" : ""}" id="bMoreBtn" aria-expanded="false" aria-controls="bSheet">${ico("more")}<span data-ep="more">${tx("more")}</span></button>`;
    side.insertAdjacentElement("afterend", tabs);

    // лист «Ещё»
    const sheet = document.createElement("div");
    sheet.className = "b-sheet";
    sheet.id = "bSheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.innerHTML = `<div class="b-sheet-panel">
        <div class="b-sheet-grip"></div>
        <div class="b-sheet-tiles">
          <a href="resources.html" class="b-sheet-tile">${ico("link")}<span data-ep="nav_resources">${tx("nav_resources")}</span></a>
          <a href="content.html" class="b-sheet-tile">${ico("play")}<span data-ep="nav_content">${tx("nav_content")}</span></a>
          <a href="test.html" class="b-sheet-tile gold">${ico("spark")}<span data-ep="test">${tx("test")}</span></a>
          <a href="team.html" class="b-sheet-tile">${ico("team")}<span data-ep="team">${tx("team")}</span></a>
        </div>
        <div class="ep-drawer-small"><a href="mailto:${CONTACT_EMAIL}" data-ep="write">${tx("write")}</a><a href="privacy.html" data-ep="privacy">${tx("privacy")}</a><a href="terms.html" data-ep="terms">${tx("terms")}</a></div>
        <button type="button" class="b-sheet-close" data-ep="close">${tx("close")}</button>
      </div>`;
    tabs.insertAdjacentElement("afterend", sheet);

    const moreBtn = tabs.querySelector("#bMoreBtn");
    const setOpen = (open) => {
      sheet.classList.toggle("open", open);
      moreBtn.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("ep-lock", open);
    };
    moreBtn.addEventListener("click", () => setOpen(!sheet.classList.contains("open")));
    sheet.addEventListener("click", (e) => {
      if (e.target === sheet || e.target.closest(".b-sheet-close") || e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  }

  // =========================================================
  // ВАРИАНТ C: панель-пилюля сверху (ПК) + плавающий док снизу (телефон)
  // =========================================================
  function buildHeaderC(h, v) {
    if (v === "landing") { buildHeaderA(h, v); return; }
    h.classList.add("c-header");
    const prof = file === "profile.html" ? " active" : "";
    h.innerHTML = `<div class="c-bar">
        <a href="${HOME}" class="ep-logo c-logo">${LOGO_SVG}<span>EduPath</span></a>
        <nav class="c-nav" aria-label="EduPath">${navLinksHtml("c-nav-link", true)}</nav>
        <div class="c-right">
          ${langMenuHtml()}
          <a href="test.html" class="c-test${file === "test.html" ? " active" : ""}">${ico("spark")}<span data-ep="test">${tx("test")}</span></a>
          <a href="profile.html" class="c-me${prof}" data-ep-label="nav_profile" aria-label="${tx("nav_profile")}">${ico("user")}</a>
        </div></div>`;

    const dockItems = [[HOME, "nav_home", "home"], ["universities.html", "tab_uni", "uni"], null, ["focus.html", "nav_focus", "timer"]];
    const moreActive = ["resources.html", "content.html", "team.html", "privacy.html", "terms.html"].includes(file);
    const dock = document.createElement("nav");
    dock.className = "c-dock";
    dock.setAttribute("aria-label", "EduPath");
    dock.innerHTML = dockItems.map((it) => {
      if (!it) return `<a href="test.html" class="c-dock-ai${file === "test.html" ? " active" : ""}" data-ep-label="test" aria-label="${tx("test")}">${ico("spark")}<span>AI</span></a>`;
      const [href, key, icon] = it; const a = href === file ? " active" : "";
      return `<a href="${href}" class="c-dock-item${a}"${a ? ' aria-current="page"' : ""}>${ico(icon)}<span data-ep="${key}">${tx(key)}</span></a>`;
    }).join("") + `<button type="button" class="c-dock-item${moreActive ? " active" : ""}" id="cMoreBtn" aria-expanded="false" aria-controls="cSheet">${ico("more")}<span data-ep="more">${tx("more")}</span></button>`;
    h.insertAdjacentElement("afterend", dock);

    const sheet = document.createElement("div");
    sheet.className = "c-sheet"; sheet.id = "cSheet";
    sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true");
    sheet.innerHTML = `<div class="c-sheet-panel">
        <div class="c-sheet-list">
          <a href="resources.html">${ico("link")}<span data-ep="nav_resources">${tx("nav_resources")}</span></a>
          <a href="content.html">${ico("play")}<span data-ep="nav_content">${tx("nav_content")}</span></a>
          <a href="profile.html">${ico("user")}<span data-ep="nav_profile">${tx("nav_profile")}</span></a>
          <a href="team.html">${ico("team")}<span data-ep="team">${tx("team")}</span></a>
          <a href="mailto:${CONTACT_EMAIL}">${ico("mail")}<span data-ep="write">${tx("write")}</span></a>
        </div>
        <div class="c-sheet-docs"><a href="privacy.html" data-ep="privacy">${tx("privacy")}</a><a href="terms.html" data-ep="terms">${tx("terms")}</a></div>
        <button type="button" class="c-sheet-close" data-ep="close">${tx("close")}</button>
      </div>`;
    dock.insertAdjacentElement("afterend", sheet);
    const btn = dock.querySelector("#cMoreBtn");
    const setOpen = (open) => { sheet.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); document.body.classList.toggle("ep-lock", open); };
    btn.addEventListener("click", () => setOpen(!sheet.classList.contains("open")));
    sheet.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest(".c-sheet-close") || e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  }

  function buildHeader() {
    const h = document.getElementById("siteHeader");
    if (!h) return;
    const v = variant(h);
    h.classList.add("ep-header");
    h.dataset.mode = v;
    document.documentElement.classList.add(v === "landing" ? "is-landing" : "is-app");
    if (UI === "b") buildHeaderB(h, v); else if (UI === "c") buildHeaderC(h, v); else buildHeaderA(h, v);
  }

  function buildFooter() {
    if (document.body.hasAttribute("data-no-footer") || document.querySelector(".ep-footer")) return;
    const f = document.createElement("footer");
    f.className = "ep-footer";
    const sections = loggedIn() ? `<div><h4 data-ep="sections">${tx("sections")}</h4><ul>
        ${NAV.slice(1, 5).map(([href, key]) => `<li><a href="${href}" data-ep="${key}">${tx(key)}</a></li>`).join("")}</ul></div>` : "<div></div>";
    f.innerHTML = `<div class="ep-footer-in">
        <div><a href="${loggedIn() ? HOME : "index.html"}" class="ep-logo">${LOGO_SVG}<span>EduPath</span></a>
          <p class="ep-footer-tag" data-ep="tag">${tx("tag")}</p></div>
        ${sections}
        <div><h4 data-ep="project">${tx("project")}</h4><ul>
          <li><a href="team.html" data-ep="team">${tx("team")}</a></li>
          <li><a href="mailto:${CONTACT_EMAIL}" data-ep="write">${tx("write")}</a></li>
          <li><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></li></ul></div>
        <div><h4 data-ep="docs">${tx("docs")}</h4><ul>
          <li><a href="privacy.html" data-ep="privacy">${tx("privacy")}</a></li>
          <li><a href="terms.html" data-ep="terms">${tx("terms")}</a></li></ul></div>
        <p class="ep-footer-ai" data-ep-html="ai">${tx("ai")}</p>
        <p class="ep-footer-copy" data-ep="copy">${tx("copy")}</p>
      </div>`;
    document.body.appendChild(f);
  }

  // переключатель вариантов «Вид: A | B»
  function buildSwitch() {
    if (!SHOW_SWITCH) return;
    const s = document.createElement("div");
    s.className = "ui-switch";
    s.innerHTML = `<span data-ep="view">${tx("view")}</span><a href="?ui=a" data-ui="a" class="${UI === "a" ? "on" : ""}">A</a><a href="?ui=b" data-ui="b" class="${UI === "b" ? "on" : ""}">B</a><a href="?ui=c" data-ui="c" class="${UI === "c" ? "on" : ""}">C</a><a href="?ui=d" data-ui="d" class="${UI === "d" ? "on" : ""}">D</a>`;
    s.addEventListener("click", (e) => {
      const a = e.target.closest("[data-ui]"); if (!a) return;
      e.preventDefault();
      store.set("edupath_ui", a.dataset.ui);
      const u = new URL(location.href); u.searchParams.delete("ui"); location.replace(u.toString());
    });
    document.body.appendChild(s);
  }

  // B: на широких экранах панель фильтров встаёт слева от списка
  function splitPanels() {
    const aside = document.querySelector("[data-b-aside]"), main = document.querySelector("[data-b-main]");
    if (!aside || !main || aside.parentNode.classList.contains("b-split")) return;
    const wrap = document.createElement("div");
    wrap.className = "b-split";
    aside.parentNode.insertBefore(wrap, aside);
    wrap.appendChild(aside);
    wrap.appendChild(main);
  }

  // B: каталог вузов — сначала часть карточек, по кнопке все
  function catalogToggle() {
    const track = document.getElementById("cardsTrack");
    if (!track || document.getElementById("bShowAll")) return;
    track.classList.add("b-limited");
    const btn = document.createElement("button");
    btn.type = "button"; btn.id = "bShowAll"; btn.className = "b-show-all";
    btn.innerHTML = `<span data-ep="show_all">${tx("show_all")}</span>`;
    btn.addEventListener("click", () => {
      const lim = track.classList.toggle("b-limited");
      const span = btn.querySelector("span");
      span.dataset.ep = lim ? "show_all" : "show_less";
      span.textContent = tx(span.dataset.ep);
      if (lim) track.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    track.insertAdjacentElement("afterend", btn);
  }

  // перевод при смене языка
  function retranslate() {
    document.querySelectorAll("[data-ep]").forEach((el) => { el.textContent = tx(el.dataset.ep); });
    document.querySelectorAll("[data-ep-html]").forEach((el) => { el.innerHTML = tx(el.dataset.epHtml); });
    document.querySelectorAll("[data-ep-label]").forEach((el) => { el.setAttribute("aria-label", tx(el.dataset.epLabel)); });
  }
  window.addEventListener("edupath-lang-change", retranslate);

  // если на странице нет i18n.js — переключатель языка работает сам
  function fallbackLang() {
    if (window.I18N) return;
    const btn = document.getElementById("langBtn"), menu = document.getElementById("langMenu");
    if (!btn || !menu) return;
    btn.addEventListener("click", (e) => { e.stopPropagation(); btn.setAttribute("aria-expanded", String(menu.classList.toggle("open"))); });
    menu.addEventListener("click", (e) => {
      const o = e.target.closest(".lang-option"); if (!o) return;
      store.set("edupath_lang", o.dataset.lang);
      menu.querySelectorAll(".lang-option").forEach((b) => b.classList.toggle("active", b === o));
      menu.classList.remove("open");
      document.documentElement.lang = o.dataset.lang;
      window.dispatchEvent(new Event("edupath-lang-change"));
    });
    document.addEventListener("click", () => menu.classList.remove("open"));
  }

  buildHeader();
  document.documentElement.lang = lang();
  const onReady = () => {
    buildFooter();
    buildSwitch();
    if (UI === "b") { splitPanels(); catalogToggle(); }
    fallbackLang();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady);
  else onReady();

  window.EduLayout = { t: tx, lang, ui: UI, CONTACT_EMAIL };
})();
