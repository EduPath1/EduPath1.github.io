/* ============================================================
   EduPath — layout.js (v5)
   Одна шапка + меню + подвал для ВСЕХ страниц.
   Меняешь меню здесь — оно меняется везде.

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

  // пункты меню: [файл, ключ текста, иконка]
  const NAV = [
    [HOME, "nav_home", "home"],
    ["universities.html", "nav_universities", "uni"],
    ["resources.html", "nav_resources", "link"],
    ["content.html", "nav_content", "play"],
    ["focus.html", "nav_focus", "timer"],
    ["profile.html", "nav_profile", "user"]
  ];

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

  // дизайн один (бывший вариант D); класс ui-d нужен стилям edupath-d.css
  document.documentElement.classList.add("ui-d");
  try { localStorage.removeItem("edupath_ui"); } catch (e) { /* ignore */ }

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
      <circle cx="20" cy="20" r="18" fill="#0A0A0B"/>
      <circle cx="20" cy="20" r="14.5" stroke="#1F4FE0" stroke-width="1.4" opacity=".55"/>
      <path d="M27.5 12.5 L18 18 L12.5 27.5 L22 22 Z" fill="#1F4FE0"/>
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

  // шапка: логотип, меню разделов, язык; на телефоне — бургер с чёрным меню на весь экран
  function buildHeaderMain(h, v) {
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
          <button type="button" class="ep-icon-btn ep-burger" id="epBurger" aria-expanded="false" aria-controls="epDrawer" data-ep-label="menu" aria-label="${tx("menu")}"><span></span><span></span><span></span></button>
        </div>
      </nav>`;

    const drawer = document.createElement("div");
    drawer.className = "ep-drawer";
    drawer.id = "epDrawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.innerHTML = `${navLinksHtml("ep-drawer-link", false)}<div class="ep-drawer-small">${smallLinks()}</div>`;
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

  function buildHeader() {
    const h = document.getElementById("siteHeader");
    if (!h) return;
    const v = variant(h);
    h.classList.add("ep-header");
    h.dataset.mode = v;
    document.documentElement.classList.add(v === "landing" ? "is-landing" : "is-app");
    buildHeaderMain(h, v);
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
    fallbackLang();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady);
  else onReady();

  window.EduLayout = { t: tx, lang, CONTACT_EMAIL };
})();
