// ============================================================
// EduPath — auth.js (v3.2: метка устройства, капча, профиль на сервере, удаление данных)
// ============================================================

(function() {
  "use strict";

  const API_URL = "https://edupath1-github-io.onrender.com";
  const TOKEN_KEY = "edupath_token";
  const USER_KEY = "edupath_user";
  const REFRESH_KEY = "edupath_refresh";
  // Публичный адрес проекта Supabase (нужен для входа через Discord)
  const SUPABASE_URL = "https://upqvqqotslqubqdhvjkc.supabase.co";
  const FLASH_KEY = "edupath_flash";
  const DEVICE_KEY = "edupath_device";

  // Cloudflare Turnstile («я не робот»). Пусто = капча выключена.
  // Сюда вставляется Site Key из Cloudflare (он публичный, это не секрет).
  // ВАЖНО: сначала ключ на сайт, и только потом включать капчу в Supabase (см. INSTALL.md).
  // Капча выключена (2026-11-22): Cloudflare не пускал живых людей из Samsung Internet.
  // Вместо неё: подтверждение почты + невидимая ловушка для ботов + проверка времени заполнения.
  // Чтобы вернуть капчу — вставь ключ "0x4AAAAAAGMHlKH4YyzY4bk-" и включи CAPTCHA в Supabase.
  const TURNSTILE_SITE_KEY = "";

  // ============================================================
  // МЕТКА УСТРОЙСТВА
  // Случайная строка, а не «отпечаток» браузера: лимиты ИИ-теста считаются
  // и по ней тоже, поэтому несколько аккаунтов на одном устройстве делят один лимит.
  // Хранится в двух местах (localStorage + cookie): если стереть одно, вернётся из другого.
  // ============================================================

  function readCookie(name) {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([A-Za-z0-9_-]+)"));
    return m ? m[1] : null;
  }

  function getDeviceId() {
    const ok = v => typeof v === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(v);
    let id = null;
    try { id = localStorage.getItem(DEVICE_KEY); } catch (e) {}
    if (!ok(id)) id = readCookie("ep_did");
    if (!ok(id)) {
      try {
        const a = new Uint8Array(18); crypto.getRandomValues(a);
        id = btoa(String.fromCharCode.apply(null, a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      } catch (e) {
        id = (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 24);
      }
    }
    try { localStorage.setItem(DEVICE_KEY, id); } catch (e) {}
    try { document.cookie = "ep_did=" + id + "; max-age=" + (400 * 86400) + "; path=/; SameSite=Lax; Secure"; } catch (e) {}
    return id;
  }

  // ============================================================
  // КАПЧА (Turnstile): невидимая, окно «я не робот» появляется только при подозрении
  // ============================================================

  // Капча работает в обычном режиме: виджет создаётся, как только открылось окно входа,
  // и сам получает токен в фоне, пока человек вводит почту и пароль.
  // Если капча не загрузилась (блокировщик, сеть) — запрос уходит без токена:
  // пока капча не включена в Supabase, вход работает; если включена — Supabase сам откажет.
  const _ts = { loading: null, id: null, token: null, waiters: [], interactive: false, log: [] };

  function tsLog(ev) {
    _ts.log.push(Math.round(performance.now() / 100) / 10 + "s " + ev);
    if (_ts.log.length > 40) _ts.log.shift();
    try { console.info("[EduPath captcha]", ev); } catch (e) {}
  }

  function loadTurnstile() {
    if (!TURNSTILE_SITE_KEY) return Promise.resolve(null);
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (_ts.loading) return _ts.loading;
    _ts.loading = new Promise((resolve, reject) => {
      const sc = document.createElement("script");
      sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      sc.async = true;
      sc.onload = () => resolve(window.turnstile);
      sc.onerror = () => { _ts.loading = null; reject(new Error("script")); };
      document.head.appendChild(sc);
    });
    return _ts.loading;
  }

  // Язык окна капчи: kk/ky Turnstile не знает — показываем по-русски
  function captchaLang() {
    const l = (window.I18N && window.I18N.getLang && window.I18N.getLang()) || "ru";
    return ({ ru: "ru", en: "en", zh: "zh-cn", kk: "ru", ky: "ru" })[l] || "auto";
  }

  function tsFlush(tok) {
    const w = _ts.waiters; _ts.waiters = [];
    w.forEach(f => f(tok));
  }

  function initCaptcha() {
    if (!TURNSTILE_SITE_KEY || _ts.id !== null) return;
    const box = document.getElementById("edupathCaptcha");
    if (!box) return;
    loadTurnstile().then(ts => {
      if (!ts || _ts.id !== null) return;
      tsLog("script loaded");
      try {
        _ts.id = ts.render(box, {
          sitekey: TURNSTILE_SITE_KEY,
          appearance: "interaction-only",
          language: captchaLang(),
          retry: "auto",
          "refresh-expired": "auto",
          callback: tok => { tsLog("token ok"); _ts.token = tok; _ts.interactive = false; box.classList.remove("show"); tsFlush(tok); },
          "error-callback": code => { tsLog("error " + code); _ts.lastError = String(code || ""); return true; },
          "expired-callback": () => { tsLog("token expired"); _ts.token = null; },
          "timeout-callback": () => tsLog("interactive timeout"),
          "unsupported-callback": () => { tsLog("browser unsupported"); tsFlush(null); },
          // Cloudflare просит нажать «Я не робот» — показываем блок и прокручиваем к нему
          "before-interactive-callback": () => {
            tsLog("needs click");
            _ts.interactive = true;
            box.classList.add("show");
            try { box.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
          },
          "after-interactive-callback": () => tsLog("click done")
        });
        tsLog("rendered " + _ts.id);
      } catch (e) {
        tsLog("render failed: " + (e && e.message));
      }
    }).catch(() => tsLog("script blocked or failed"));
  }

  function consumeToken() {
    _ts.token = null;
    try { if (window.turnstile && _ts.id !== null) window.turnstile.reset(_ts.id); } catch (e) {}
  }

  // Ждёт токен до 15 с (или до 3 минут, если Cloudflare попросил нажать галочку).
  // Никогда не блокирует вход навсегда: без токена возвращает null.
  async function getCaptchaToken() {
    if (!TURNSTILE_SITE_KEY) return null;
    initCaptcha();
    if (_ts.token) { const tok = _ts.token; consumeToken(); return tok; }
    const tok = await new Promise(resolve => {
      _ts.waiters.push(resolve);
      const start = Date.now();
      const tick = () => {
        if (_ts.waiters.indexOf(resolve) === -1) return;
        if (Date.now() - start > (_ts.interactive ? 180000 : 15000)) {
          _ts.waiters = _ts.waiters.filter(f => f !== resolve);
          tsLog("no token. Log: " + _ts.log.join(" | "));
          resolve(null);
        } else setTimeout(tick, 500);
      };
      setTimeout(tick, 500);
    });
    if (tok) { consumeToken(); return tok; }
    // Без токена Supabase всё равно откажет («no captcha_token found») — не шлём запрос зря,
    // а показываем понятную причину с кодом ошибки Cloudflare
    const code = _ts.lastError || "";
    let why = "Проверка «я не робот» не загрузилась.";
    if (code.startsWith("1102")) why = "Капча не настроена для этого сайта (домен не добавлен в Cloudflare Turnstile).";
    else if (code.startsWith("1101") || code.startsWith("1100")) why = "Неверный ключ капчи (Site Key).";
    else if (code.startsWith("300") || code.startsWith("600")) why = "Cloudflare не смог проверить этот браузер. Открой сайт в Chrome или войди через Discord.";
    else if (!window.turnstile) why = "Скрипт капчи Cloudflare заблокирован браузером или сетью. Отключи блокировщик рекламы / VPN.";
    throw new Error(why + (code ? " Код: " + code : "") + " Обнови страницу и попробуй ещё раз");
  }



  // Лендинг = главная страница (index.html или корень сайта)
  function isLandingPage() {
    const p = window.location.pathname;
    return p === "" || p === "/" || /\/index\.html$/.test(p) || /\/$/.test(p);
  }

  function goToLanding() {
    window.location.replace("index.html");
  }

  function goToApp() {
    window.location.href = "app.html";
  }


  // ============================================================
  // ТЕКСТЫ ДЛЯ ВОССТАНОВЛЕНИЯ ПАРОЛЯ И ПОДСКАЗОК (5 языков).
  // Лежат здесь, а не в i18n.js: на главной странице i18n.js не подключён.
  // ============================================================
  const TX = {
    ru: {
      forgot_link: "Забыли пароль?",
      forgot_title: "Восстановление пароля",
      forgot_sub: "Введи почту — пришлём ссылку для нового пароля",
      forgot_btn: "Отправить ссылку",
      forgot_sent: "Если аккаунт с почтой {email} есть, мы отправили на неё ссылку. Письмо может прийти через минуту — проверь папку «Спам».",
      back_q: "Вспомнил(а) пароль?",
      back_btn: "Войти",
      newpass_title: "Новый пароль",
      newpass_sub: "Придумай новый пароль для своего аккаунта",
      newpass_btn: "Сохранить пароль",
      newpass_done: "Пароль изменён. Ты в аккаунте ✓",
      pw_hint: "Минимум 8 символов, буквы и цифры",
      spam_hint: "Письмо может прийти через минуту. Не видишь его — проверь папку «Спам».",
      link_expired: "Ссылка устарела или уже использована. Запроси новую.",
      need_email: "Введи почту"
    },
    en: {
      forgot_link: "Forgot password?",
      forgot_title: "Reset password",
      forgot_sub: "Enter your email and we'll send you a link to set a new password",
      forgot_btn: "Send link",
      forgot_sent: "If an account with {email} exists, we've sent a link to it. It may take a minute — check your Spam folder too.",
      back_q: "Remembered it?",
      back_btn: "Sign in",
      newpass_title: "New password",
      newpass_sub: "Choose a new password for your account",
      newpass_btn: "Save password",
      newpass_done: "Password changed. You're signed in ✓",
      pw_hint: "At least 8 characters, letters and numbers",
      spam_hint: "The email may take a minute. Can't find it? Check your Spam folder.",
      link_expired: "This link has expired or was already used. Request a new one.",
      need_email: "Enter your email"
    },
    zh: {
      forgot_link: "忘记密码？",
      forgot_title: "找回密码",
      forgot_sub: "输入邮箱，我们会发送设置新密码的链接",
      forgot_btn: "发送链接",
      forgot_sent: "如果 {email} 已注册，我们已向其发送链接。邮件可能需要一分钟，也请检查垃圾邮件文件夹。",
      back_q: "想起密码了？",
      back_btn: "登录",
      newpass_title: "新密码",
      newpass_sub: "为你的账号设置新密码",
      newpass_btn: "保存密码",
      newpass_done: "密码已修改，你已登录 ✓",
      pw_hint: "至少 8 个字符，包含字母和数字",
      spam_hint: "邮件可能需要一分钟。找不到？请检查垃圾邮件文件夹。",
      link_expired: "链接已过期或已被使用，请重新申请。",
      need_email: "请输入邮箱"
    },
    kk: {
      forgot_link: "Құпия сөзді ұмыттың ба?",
      forgot_title: "Құпия сөзді қалпына келтіру",
      forgot_sub: "Поштаңды жаз — жаңа құпия сөз үшін сілтеме жібереміз",
      forgot_btn: "Сілтеме жіберу",
      forgot_sent: "Егер {email} поштасымен аккаунт болса, оған сілтеме жібердік. Хат бір минуттан кейін келуі мүмкін — «Спам» бумасын да тексер.",
      back_q: "Есіңе түсті ме?",
      back_btn: "Кіру",
      newpass_title: "Жаңа құпия сөз",
      newpass_sub: "Аккаунтыңа жаңа құпия сөз ойлап тап",
      newpass_btn: "Құпия сөзді сақтау",
      newpass_done: "Құпия сөз өзгертілді. Сен аккаунттасың ✓",
      pw_hint: "Кемінде 8 таңба, әріптер мен сандар",
      spam_hint: "Хат бір минуттан кейін келуі мүмкін. Көрмесең — «Спам» бумасын тексер.",
      link_expired: "Сілтеме ескірген немесе қолданылған. Жаңасын сұра.",
      need_email: "Поштаңды жаз"
    },
    ky: {
      forgot_link: "Сырсөздү унуттуңбу?",
      forgot_title: "Сырсөздү калыбына келтирүү",
      forgot_sub: "Почтаңды жаз — жаңы сырсөз үчүн шилтеме жөнөтөбүз",
      forgot_btn: "Шилтеме жөнөтүү",
      forgot_sent: "Эгер {email} почтасы менен аккаунт болсо, ага шилтеме жөнөттүк. Кат бир мүнөттөн кийин келиши мүмкүн — «Спам» папкасын да текшер.",
      back_q: "Эсиңе түштүбү?",
      back_btn: "Кирүү",
      newpass_title: "Жаңы сырсөз",
      newpass_sub: "Аккаунтуңа жаңы сырсөз ойлоп тап",
      newpass_btn: "Сырсөздү сактоо",
      newpass_done: "Сырсөз өзгөртүлдү. Сен аккаунттасың ✓",
      pw_hint: "Кеминде 8 белги, тамгалар жана сандар",
      spam_hint: "Кат бир мүнөттөн кийин келиши мүмкүн. Көрбөсөң — «Спам» папкасын текшер.",
      link_expired: "Шилтеме эскирген же колдонулган. Жаңысын сура.",
      need_email: "Почтаңды жаз"
    }
  };

  function uiLang() {
    let l = null;
    try { l = (window.I18N && window.I18N.getLang && window.I18N.getLang()) || localStorage.getItem("edupath_lang"); } catch (e) {}
    return TX[l] ? l : "ru";
  }

  function tx(key) {
    return (TX[uiLang()] || TX.ru)[key] || TX.ru[key] || key;
  }

  function t(key, fallback) {
    const v = window.I18N && window.I18N.t(key);
    return (v && v !== key) ? v : (fallback || key);
  }

  // ============================================================
  // TOKEN / USER
  // ============================================================

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
  }

  function getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY);
  }

  function setSession(session) {
    if (!session) return;
    if (session.access_token) localStorage.setItem(TOKEN_KEY, session.access_token);
    if (session.refresh_token) localStorage.setItem(REFRESH_KEY, session.refresh_token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function tokenExpiry(token) {
    try {
      const part = String(token).split(".")[1];
      const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      const json = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
      const exp = JSON.parse(json).exp;
      return typeof exp === "number" ? exp * 1000 : null;
    } catch (e) {
      return null;
    }
  }

  // Данные пользователя из самого токена (для Google, Discord и др. имя приходит оттуда)
  function userFromToken(token) {
    try {
      const part = String(token).split(".")[1];
      const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(escape(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))));
      const p = JSON.parse(json);
      const meta = p.user_metadata || {};
      const email = p.email || meta.email || "";
      const name = meta.name || meta.full_name || (email ? email.split("@")[0] : "");
      return { id: p.sub, email: email, name: name };
    } catch (e) {
      return null;
    }
  }

  function setCachedUser(user) {
    if (!user) return;
    if (!user.name) {
      const fb = userFromToken(getToken());
      if (fb && fb.name) user = Object.assign({}, user, { name: fb.name });
    }
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function getCachedUser() {
    try {
      const s = localStorage.getItem(USER_KEY);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function getCurrentUser() {
    return getCachedUser();
  }

  // ============================================================
  // NETWORK
  // ============================================================

  // Сервер на Render (бесплатный тариф) засыпает после ~15 минут простоя.
  function isServerSleeping(status) {
    return status === 0 || status === 502 || status === 503 || status === 504;
  }

  let _wakePromise = null;
  function wakeServer() {
    if (_wakePromise) return _wakePromise;
    _wakePromise = (async () => {
      for (let i = 0; i < 6; i++) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 20000);
          const r = await fetch(API_URL + "/", { signal: ctrl.signal });
          clearTimeout(timer);
          if (r.ok) return true;
        } catch (e) {}
        await new Promise(r => setTimeout(r, 3000));
      }
      return false;
    })();
    return _wakePromise;
  }

  const NO_REFRESH_PATHS = ["/api/login", "/api/register", "/api/refresh", "/api/resend-confirmation", "/api/forgot"];

  let _refreshPromise = null;
  let _refreshTransientFail = false;
  let _expiredToastAt = 0;

  function expireSession() {
    const hadSession = !!getToken() || !!getCurrentUser();
    clearToken();
    _savedCache = null;
    _testsCache = null;
    _quotesCache = null;
    if (!hadSession) return;

    updateHeaderUI();
    if (Date.now() - _expiredToastAt > 5000) {
      _expiredToastAt = Date.now();
      showToast(t("modal_session_expired", "Сессия истекла. Войди снова."), "error");
      if (!isLandingPage()) {
        setTimeout(goToLanding, 1500);
      }
    }
  }

  function refreshSession() {
    if (_refreshPromise) return _refreshPromise;

    _refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;

      _refreshTransientFail = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        let res = null;
        try {
          const r = await fetch(API_URL + "/api/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken })
          });
          let data = null;
          try { data = await r.json(); } catch (e) {}
          res = { ok: r.ok, status: r.status, data };
        } catch (e) {
          res = { ok: false, status: 0, data: null };
        }

        if (res.ok && res.data && res.data.session && res.data.session.access_token) {
          setSession(res.data.session);
          if (res.data.user) setCachedUser(res.data.user);
          return true;
        }

        if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
          expireSession();
          return false;
        }

        await new Promise(r => setTimeout(r, 4000));
      }
      _refreshTransientFail = true;
      return false;
    })().finally(() => { _refreshPromise = null; });

    return _refreshPromise;
  }

  async function ensureFreshSession() {
    const token = getToken();
    if (!token) return false;

    const exp = tokenExpiry(token);
    if (exp === null || exp - Date.now() > 60 * 1000) return true;

    if (getRefreshToken()) return refreshSession();

    if (exp - Date.now() <= 0) {
      expireSession();
      return false;
    }
    return true;
  }

  async function apiFetch(path, options, _retried) {
    options = options || {};

    const isAuthPath = NO_REFRESH_PATHS.indexOf(path) !== -1;
    if (!isAuthPath && !_retried) await ensureFreshSession();

    const headers = Object.assign({
      "Content-Type": "application/json"
    }, options.headers || {});

    const token = getToken();
    if (token && !isAuthPath) headers["Authorization"] = "Bearer " + token;
    try { headers["X-Device-Id"] = getDeviceId(); } catch (e) {}

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);

    try {
      const res = await fetch(API_URL + path, Object.assign({}, options, { headers, signal: ctrl.signal }));
      clearTimeout(timer);

      let data = null;
      try { data = await res.json(); } catch (e) {}

      if (res.status === 401 && token && !isAuthPath) {
        if (!_retried && getRefreshToken() && await refreshSession()) {
          return apiFetch(path, options, true);
        }
        if (!_refreshTransientFail) expireSession();
      }

      return { ok: res.ok, status: res.status, data, sessionExpired: res.status === 401 && !!token && !isAuthPath };
    } catch (networkError) {
      clearTimeout(timer);
      return { ok: false, status: 0, data: null, networkError: true };
    }
  }

  async function apiFetchWithRetry(path, options, baseDelayMs, maxAttempts) {
    baseDelayMs = baseDelayMs || 2000;
    maxAttempts = maxAttempts || 6;

    let res = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      res = await apiFetch(path, options);
      if (res.ok || !isServerSleeping(res.status)) return res;
      if (attempt < maxAttempts) {
        console.warn("Server seems asleep, retry", attempt, "of", maxAttempts - 1);
        await new Promise(r => setTimeout(r, baseDelayMs * attempt));
      }
    }
    return res;
  }

  function humanError(res, fallbackKey, fallbackText) {
    if (res && res.sessionExpired) {
      return t("modal_session_expired", "Сессия истекла. Войди снова.");
    }
    if (res && isServerSleeping(res.status)) {
      return t("modal_server_waking", "Сервер просыпается. Подожди 30 секунд и попробуй снова.");
    }
    if (res && res.data && res.data.error) {
      return res.data.error;
    }
    return t(fallbackKey, fallbackText) || fallbackText;
  }

 // ============================================================
  // AUTH: REGISTER / LOGIN / LOGOUT
  // ============================================================

  let formOpenedAt = 0;

  async function register(name, email, password, consent) {
    if (!name || !email || !password) {
      return { ok: false, error: t("modal_fill_all", "Заполните все поля") };
    }
    if (password.length < 8) {
      return { ok: false, error: t("modal_password_short", "Пароль должен быть не короче 8 символов") };
    }
    if (!/\d/.test(password) || !/\p{L}/u.test(password)) {
      return { ok: false, error: tx("pw_hint") };
    }
    if (!consent) {
      return { ok: false, error: t("modal_consent_need", "Отметь согласие, чтобы создать аккаунт") };
    }

    let captcha_token = null;
    try { captcha_token = await getCaptchaToken(); }
    catch (e) { return { ok: false, error: e.message }; }

    const res = await apiFetchWithRetry("/api/register", {
      method: "POST",
      body: JSON.stringify({
        name, email, password, consent: true, captcha_token,
        lang: uiLang(),   // на этом языке Supabase будет присылать письма
        // Ловушка: поле невидимо для людей, боты заполняют его сами
        website: ((document.getElementById("edupathWebsite") || {}).value || ""),
        // Сколько миллисекунд форма была открыта (боты отправляют мгновенно)
        form_ms: formOpenedAt ? Date.now() - formOpenedAt : null
      })
    });

    if (!res.ok) {
      return { ok: false, error: humanError(res, "modal_error_register", "Ошибка регистрации") };
    }

    const session = res.data && res.data.session;
    const user = res.data && res.data.user;

    if (session && session.access_token) {
      setSession(session);
      setCachedUser({
        name: (user && user.name) || name,
        email: (user && user.email) || email,
        id: user && user.id
      });
      return { ok: true, user: user, needsConfirmation: false };
    }

    return {
      ok: true,
      user: user,
      needsConfirmation: true,
      email: (user && user.email) || email
    };
  }

  async function login(email, password) {
    if (!email || !password) {
      return { ok: false, error: t("modal_fill_all", "Заполните все поля") };
    }

    let captcha_token = null;
    try { captcha_token = await getCaptchaToken(); }
    catch (e) { return { ok: false, error: e.message }; }

    const res = await apiFetchWithRetry("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password, captcha_token })
    });

    if (!res.ok) {
      return { ok: false, error: humanError(res, "modal_error_login", "Неверный email или пароль") };
    }

    const session = res.data && res.data.session;
    const user = res.data && res.data.user;

    if (session && session.access_token) {
      setSession(session);
      setCachedUser({
        name: (user && user.name) || "",
        email: user && user.email,
        id: user && user.id
      });
    }

    return { ok: true, user: user };
  }

  async function resendConfirmation(email) {
    let captcha_token = null;
    try { captcha_token = await getCaptchaToken(); }
    catch (e) { return { ok: false, error: e.message }; }

    const res = await apiFetchWithRetry("/api/resend-confirmation", {
      method: "POST",
      body: JSON.stringify({ email, captcha_token })
    });

    if (!res.ok) {
      return { ok: false, error: humanError(res, "modal_error_generic", "Что-то пошло не так") };
    }

    return { ok: true };
  }

  async function requestPasswordReset(email) {
    if (!email) return { ok: false, error: tx("need_email") };
    const res = await apiFetchWithRetry("/api/forgot", {
      method: "POST",
      body: JSON.stringify({ email, website: ((document.getElementById("edupathWebsite") || {}).value || "") })
    });
    if (!res.ok) return { ok: false, error: humanError(res, "modal_error_generic", "Что-то пошло не так") };
    return { ok: true };
  }

  async function updatePassword(password) {
    if (!password || password.length < 8 || !/\d/.test(password) || !/\p{L}/u.test(password)) return { ok: false, error: tx("pw_hint") };
    const res = await apiFetch("/api/update-password", {
      method: "POST",
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      if (res.sessionExpired) return { ok: false, error: tx("link_expired") };
      return { ok: false, error: humanError(res, "modal_error_generic", "Что-то пошло не так") };
    }
    return { ok: true };
  }

  function logout() {
    const tok = getToken();
    if (tok) {
      // завершаем сессию и на сервере (не ждём ответа)
      try {
        fetch(API_URL + "/api/logout", { method: "POST", keepalive: true,
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok } }).catch(() => {});
      } catch (e) {}
    }
    clearToken();
    _savedCache = null;
    _testsCache = null;
    _quotesCache = null;
    if (_readyResolve) _readyResolve();
  }

  function signInWithProvider(provider) {
    const back = window.location.origin + window.location.pathname.replace(/[^\/]*$/, "");
    let url = SUPABASE_URL + "/auth/v1/authorize?provider=" + encodeURIComponent(provider) +
              "&redirect_to=" + encodeURIComponent(back);
    window.location.href = url;
  }

  // ============================================================
  // ПРОФИЛЬ: гражданство и уровень обучения — общие для всех устройств
  // На странице «Университеты» они по-прежнему лежат в ep6:cit / ep6:degree,
  // а здесь синхронизируются с аккаунтом.
  // ============================================================

  const PREF_KEYS = { citizenship: "ep6:cit", degree: "ep6:degree" };
  let _prefTimer = null, _prefPending = {};

  function readLocalPrefs() {
    const out = {};
    try {
      const c = localStorage.getItem(PREF_KEYS.citizenship), d = localStorage.getItem(PREF_KEYS.degree);
      if (c && /^[A-Z]{2}$/.test(c)) out.citizenship = c;
      if (d && /^(foundation|bachelor|master|phd)$/.test(d)) out.degree = d;
    } catch (e) {}
    return out;
  }

  async function getProfile() {
    await waitForAuthReady();
    if (!isLoggedIn()) return null;
    const res = await apiFetchWithRetry("/api/profile", { method: "GET" }, 2000, 3);
    return res.ok && res.data ? res.data.profile : null;
  }

  // вызывается страницей «Университеты» при смене фильтра
  function saveProfilePrefs(patch) {
    if (!isLoggedIn() || !patch) return;
    Object.assign(_prefPending, patch);
    clearTimeout(_prefTimer);
    _prefTimer = setTimeout(() => {
      const body = _prefPending; _prefPending = {};
      apiFetchWithRetry("/api/profile", { method: "PUT", body: JSON.stringify(body) }, 3000, 4)
        .catch(() => {});
    }, 800);
  }

  // после входа: значения из аккаунта важнее; если в аккаунте пусто — отправляем то, что выбрано на устройстве
  async function syncProfilePrefs() {
    if (!isLoggedIn()) return;
    let prof = null;
    try { prof = await getProfile(); } catch (e) { return; }
    if (!prof) return;
    const local = readLocalPrefs(), push = {}, changed = {};
    for (const k of ["citizenship", "degree"]) {
      if (prof[k]) {
        if (local[k] !== prof[k]) {
          try { localStorage.setItem(PREF_KEYS[k], prof[k]); changed[k] = prof[k]; } catch (e) {}
        }
      } else if (local[k]) {
        push[k] = local[k];
      }
    }
    if (Object.keys(push).length) saveProfilePrefs(push);
    if (Object.keys(changed).length) {
      window.dispatchEvent(new CustomEvent("edupath-prefs-sync", { detail: changed }));
    }
  }

  // ============================================================
  // УДАЛЕНИЕ ДАННЫХ ПО ВЫБОРУ / АККАУНТА
  // parts: saved, tests, study, quotes, profile, account
  // Метка устройства и язык при этом не стираются.
  // ============================================================

  function clearLocalKeys(test) {
    try {
      Object.keys(localStorage).filter(test).forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }

  async function deleteMyData(parts, confirmWord) {
    if (!isLoggedIn()) return { ok: false, error: t("modal_session_expired", "Сессия истекла. Войди снова.") };
    const res = await apiFetchWithRetry("/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ parts, confirm: confirmWord || "" })
    });
    if (!res.ok) return { ok: false, error: humanError(res, "modal_error_generic", "Не удалось удалить") };

    if (parts.indexOf("account") !== -1) {
      clearToken();
      clearLocalKeys(k => k.indexOf("ep6:") === 0 || k.indexOf("ep_test_draft") === 0 ||
                          k.indexOf("edupath_focus") === 0 || k === USER_KEY);
      try { sessionStorage.clear(); } catch (e) {}
      _savedCache = null; _testsCache = null; _quotesCache = null;
      return { ok: true, account: true };
    }
    if (parts.indexOf("saved") !== -1) _savedCache = null;
    if (parts.indexOf("tests") !== -1) _testsCache = null;
    if (parts.indexOf("quotes") !== -1) _quotesCache = null;
    if (parts.indexOf("study") !== -1) clearLocalKeys(k => k.indexOf("edupath_focus") === 0);
    if (parts.indexOf("profile") !== -1) clearLocalKeys(k => k === PREF_KEYS.citizenship || k === PREF_KEYS.degree);
    return { ok: true, deleted: (res.data && res.data.deleted) || {} };
  }

  // ============================================================
  // READY PROMISE
  // ============================================================

  let _readyPromise;
  let _readyResolve;
  
  function initReadyPromise() {
    if (!_readyPromise) {
      _readyPromise = new Promise(resolve => {
        _readyResolve = resolve;
      });
    }
  }
  initReadyPromise();

  async function waitForAuthReady() {
    if (!isLoggedIn()) return;
    await _readyPromise;
  }

  // ============================================================
  // SAVED UNIVERSITIES
  // ============================================================

  let _savedCache = null;

  async function getSaved(opts) {
    await waitForAuthReady();

    if (!isLoggedIn()) {
      _savedCache = [];
      return [];
    }

    const res = await apiFetchWithRetry("/api/saved", { method: "GET" });
    if (!res.ok) {
      if (opts && opts.strict) {
        const err = new Error(humanError(res, "modal_error_generic", "Не удалось загрузить"));
        err.res = res;
        throw err;
      }
      return _savedCache || [];
    }

    const list = (res.data && res.data.saved) || [];

    _savedCache = list.map(s => ({
      name: s.university_name,
      country: s.country || "",
      city: s.city || ""
    }));

    return _savedCache;
  }

  function isSaved(name) {
    if (!_savedCache) return false;
    return _savedCache.some(u => u.name === name);
  }

  async function toggleSave(uni) {
    if (!isLoggedIn()) {
      return { ok: false, error: "Не вошёл" };
    }

    await getSaved();

    const currentlySaved = isSaved(uni.name);

    if (currentlySaved) {
      const res = await apiFetchWithRetry(
        "/api/saved/" + encodeURIComponent(uni.name),
        { method: "DELETE" }
      );

      if (!res.ok) {
        return { ok: false, error: humanError(res, "modal_error_generic", "Не удалось удалить") };
      }

      if (_savedCache) {
        _savedCache = _savedCache.filter(u => u.name !== uni.name);
      }

      return { ok: true, removed: true };
    } else {
      const res = await apiFetchWithRetry("/api/saved", {
        method: "POST",
        body: JSON.stringify({
          name: uni.name,
          country: uni.country || "",
          city: uni.city || ""
        })
      });

      if (!res.ok) {
        return { ok: false, error: humanError(res, "modal_error_generic", "Не удалось сохранить") };
      }

      if (!_savedCache) _savedCache = [];
      _savedCache.unshift({
        name: uni.name,
        country: uni.country || "",
        city: uni.city || ""
      });

      return { ok: true, added: true };
    }
  }

  // ============================================================
  // TEST RESULTS
  // ============================================================

  let _testsCache = null;

  async function getTests(opts) {
    await waitForAuthReady();

    if (!isLoggedIn()) {
      _testsCache = [];
      return [];
    }

    const res = await apiFetchWithRetry("/api/tests", { method: "GET" });
    if (!res.ok) {
      if (opts && opts.strict) {
        const err = new Error(humanError(res, "modal_error_generic", "Не удалось загрузить"));
        err.res = res;
        throw err;
      }
      return _testsCache || [];
    }

    const list = (res.data && res.data.tests) || [];

    _testsCache = list.map(t => ({
      date: t.created_at,
      categories: t.categories || {},
      summary: t.summary || ""
    }));

    return _testsCache;
  }

  async function saveTestResult(finalData) {
  await waitForAuthReady();

  if (!isLoggedIn()) {
    return { ok: false, error: "Не вошёл" };
  }

  const res = await apiFetchWithRetry("/api/tests", {
    method: "POST",
    body: JSON.stringify({
      categories: finalData.categories || {},
      summary: finalData.summary || ""
    })
  });

  if (!res.ok) {
    const serverMsg = (res.data && res.data.error) ? res.data.error : ("Код ошибки: " + res.status);
    return { ok: false, error: serverMsg };
  }

  _testsCache = null;
  return { ok: true };
}

  // ============================================================
  // ФОКУС: ТАЙМЕР УЧЁБЫ И ЦИТАТЫ
  // ============================================================

  // Сегодняшняя дата по часам пользователя (YYYY-MM-DD)
  function localDateStr(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  async function getStudySummary(opts) {
    await waitForAuthReady();
    if (!isLoggedIn()) return null;
    const days = (opts && opts.days) || 30;
    const res = await apiFetchWithRetry("/api/study/summary?today=" + localDateStr() + "&days=" + days, { method: "GET" });
    if (!res.ok) {
      if (opts && opts.strict) {
        const err = new Error(humanError(res, "modal_error_generic", "Не удалось загрузить"));
        err.res = res;
        throw err;
      }
      return null;
    }
    return res.data || null;
  }

  // session: { label, duration_sec, started_at, ended_at, local_date, client_id }
  async function saveStudySession(session) {
    await waitForAuthReady();
    if (!isLoggedIn()) return { ok: false, error: "Не вошёл", offline: false };
    const res = await apiFetchWithRetry("/api/study/sessions", {
      method: "POST",
      body: JSON.stringify(session)
    }, 2000, 3);
    if (res.ok) return { ok: true, data: res.data };
    // сервер спит или нет сети — сессию можно отправить позже
    const retryable = res.networkError || isServerSleeping(res.status) || res.status >= 500;
    return { ok: false, retryable, status: res.status, error: humanError(res, "modal_error_generic", "Не удалось сохранить") };
  }

  let _quotesCache = null;

  async function getSavedQuotes(opts) {
    await waitForAuthReady();
    if (!isLoggedIn()) { _quotesCache = []; return []; }
    const res = await apiFetchWithRetry("/api/quotes/saved", { method: "GET" });
    if (!res.ok) {
      if (opts && opts.strict) {
        const err = new Error(humanError(res, "modal_error_generic", "Не удалось загрузить"));
        err.res = res;
        throw err;
      }
      return _quotesCache || [];
    }
    _quotesCache = ((res.data && res.data.saved) || []).map(Number);
    return _quotesCache;
  }

  function isQuoteSaved(id) {
    return !!_quotesCache && _quotesCache.indexOf(Number(id)) !== -1;
  }

  async function toggleQuote(id) {
    id = Number(id);
    if (!isLoggedIn()) return { ok: false, error: "Не вошёл" };
    if (!_quotesCache) await getSavedQuotes();
    if (isQuoteSaved(id)) {
      const res = await apiFetchWithRetry("/api/quotes/saved/" + id, { method: "DELETE" });
      if (!res.ok) return { ok: false, error: humanError(res, "modal_error_generic", "Не удалось удалить") };
      _quotesCache = _quotesCache.filter(x => x !== id);
      return { ok: true, removed: true };
    }
    const res = await apiFetchWithRetry("/api/quotes/saved", { method: "POST", body: JSON.stringify({ quote_id: id }) });
    if (!res.ok) return { ok: false, error: humanError(res, "modal_error_generic", "Не удалось сохранить") };
    _quotesCache = [id].concat(_quotesCache || []);
    return { ok: true, added: true };
  }

  // ============================================================
  // TOAST
  // ============================================================

  function showToast(message, type) {
    const existing = document.querySelector(".edupath-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "edupath-toast edupath-toast-" + (type || "success");
    toast.textContent = message;

    if (!document.getElementById("edupath-toast-style")) {
      const style = document.createElement("style");
      style.id = "edupath-toast-style";
      style.textContent = `
        .edupath-toast {
          position: fixed;
          bottom: 32px; left: 50%;
          transform: translateX(-50%) translateY(20px);
          background: #17263C; color: #F6F8FC;
          padding: 14px 24px; border-radius: 10px;
          font-family: 'Manrope', sans-serif; font-size: 14px; font-weight: 500;
          box-shadow: 0 12px 28px -10px rgba(23,38,60,0.5);
          z-index: 9999; opacity: 0;
          animation: toastIn .3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          pointer-events: none; max-width: 90vw; text-align: center; line-height: 1.4;
        }
        .edupath-toast-success { background: #17263C; color: #F6F8FC; }
        .edupath-toast-error   { background: #B84A3A; color: #FFFFFF; }
        .edupath-toast-info    { background: #1E4E8C; color: #FFFFFF; }
        @keyframes toastIn {
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = "opacity .3s ease, transform .3s ease";
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(20px)";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // ============================================================
  // MODAL
  // ============================================================

  let modalEl = null;
  let modalMode = "register";
  let pendingEmail = "";

  function buildModal() {
    if (modalEl) return modalEl;

    const overlay = document.createElement("div");
    overlay.className = "edupath-modal-overlay";
    overlay.id = "edupathAuthModal";

    // ИЗМЕНЕНО ЗДЕСЬ: Удалена кнопка LinkedIn
    overlay.innerHTML = `
      <div class="edupath-modal">
        <button class="edupath-modal-close" type="button" aria-label="Close">×</button>

        <h2 class="edupath-modal-title"></h2>
        <p class="edupath-modal-sub" id="edupathModalSub"></p>

        <div id="edupathSocialBlock">
          <div class="edupath-social-grid">
            <button type="button" class="edupath-btn-social" data-oauth="discord">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
              <span>Войти через Discord</span>
            </button>
          </div>
          <div class="edupath-divider"><span id="edupathOrLabel">или</span></div>
        </div>

        <form id="edupathAuthForm" autocomplete="off">
          <div class="edupath-field" id="edupathNameField">
            <label data-i18n="modal_name">Имя</label>
            <input type="text" id="edupathName" data-i18n-placeholder="modal_name_ph" placeholder="Например, Айсана">
          </div>

          <div class="edupath-field" id="edupathEmailField">
            <label data-i18n="modal_email">Email</label>
            <input type="email" id="edupathEmail" placeholder="you@mail.com">
          </div>

          <div class="edupath-field" id="edupathPasswordField">
            <label data-i18n="modal_password">Пароль</label>
            <input type="password" id="edupathPassword" data-i18n-placeholder="modal_password_ph" placeholder="Минимум 8 символов" autocomplete="new-password">
            <div class="edupath-hint" id="edupathPwHint"></div>
            <button type="button" class="edupath-forgot" id="edupathForgotBtn"></button>
          </div>

          <!-- Ловушка для ботов: человек это поле не видит и не заполняет -->
          <div class="edupath-hp" aria-hidden="true">
            <label for="edupathWebsite">Website</label>
            <input type="text" id="edupathWebsite" name="website" tabindex="-1" autocomplete="off">
          </div>

          <label class="edupath-consent" id="edupathConsentField">
            <input type="checkbox" id="edupathConsent">
            <span><span data-i18n="modal_consent">Принимаю условия и даю согласие на обработку моих данных:</span> <a href="privacy.html" target="_blank" rel="noopener" data-i18n="modal_privacy_link">Политика конфиденциальности</a>, <a href="terms.html" target="_blank" rel="noopener" data-i18n="modal_terms_link">Условия использования</a></span>
          </label>

          <div class="edupath-error" id="edupathAuthError"></div>

          <button type="submit" class="edupath-btn-submit" id="edupathSubmitBtn">Создать аккаунт</button>
        </form>

        <div id="edupathConfirmBlock" style="display:none;">
          <div class="edupath-confirm-icon">📧</div>
          <p class="edupath-confirm-sub" id="edupathConfirmSub"></p>
          <p class="edupath-hint edupath-hint-center" id="edupathSpamHint"></p>
          <button type="button" class="edupath-btn-submit" id="edupathResendBtn">Отправить письмо заново</button>
          <button type="button" class="edupath-btn-ghost" id="edupathOpenMailBtn">Открыть Gmail</button>
          <button type="button" class="edupath-btn-link" id="edupathAlreadyConfirmedBtn">Я подтвердил — войти</button>
        </div>

        <div id="edupathCaptcha" class="edupath-captcha"></div>

        <div class="edupath-switch" id="edupathSwitchWrap">
          <span id="edupathSwitchText">Уже есть аккаунт?</span>
          <button type="button" id="edupathSwitchBtn">Войти</button>
        </div>
      </div>
    `;

    if (!document.getElementById("edupath-modal-style")) {
      const style = document.createElement("style");
      style.id = "edupath-modal-style";
      // ИЗМЕНЕНО ЗДЕСЬ: .edupath-social-grid теперь 1fr вместо 1fr 1fr
      style.textContent = `
        .edupath-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(23,38,60,0.55);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 9998; opacity: 0; visibility: hidden;
          transition: opacity .3s cubic-bezier(0.22,1,0.36,1), visibility .3s;
          padding: 20px;
        }
        .edupath-modal-overlay.open { opacity: 1; visibility: visible; }

        .edupath-modal, .edupath-modal input, .edupath-modal button {
          font-family: 'Manrope', 'Inter', sans-serif;
        }
        .edupath-modal button { border: 0; cursor: pointer; }
        .edupath-modal { max-height: 94vh; overflow-y: auto; }
        .edupath-consent { display: flex; gap: 10px; align-items: flex-start; margin: 4px 0 14px; font-size: 13px; line-height: 1.45; color: #33445C; cursor: pointer; }
        .edupath-consent a { color: #1E4E8C; text-decoration: underline; }
        .edupath-consent input { width: 18px; height: 18px; margin: 1px 0 0; flex-shrink: 0; accent-color: #1E4E8C; }
        /* Контейнер капчи НЕЛЬЗЯ прятать через display:none — иначе галочка «я не робот» не видна и проверка зависает */
        .edupath-hint { font-size: 12.5px; line-height: 1.4; color: #5B6B82; margin-top: 6px; }
        .edupath-hint-center { text-align: center; margin: -4px 0 14px; }
        .edupath-forgot { display: block; margin: 8px 0 0 auto; padding: 0; background: none !important; color: #1E4E8C; font-size: 13px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
        .edupath-sent { font-size: 14.5px; line-height: 1.55; color: #17263C; background: #F6F8FC; border-radius: 10px; padding: 14px 16px; margin: 6px 0 4px; }
        .edupath-hp { position: absolute !important; left: -10000px !important; top: auto; width: 1px; height: 1px; overflow: hidden; }
        .edupath-captcha { display: flex; justify-content: center; margin: 0; min-height: 0; }
        .edupath-captcha.show { margin: 12px 0 4px; }

        .edupath-btn-social {
          width: 100%; padding: 12px 10px;
          display: flex; align-items: center; justify-content: center; gap: 9px;
          background: #FFFFFF; color: #17263C;
          border: 1.5px solid rgba(23,38,60,0.18) !important;
          border-radius: 10px; font-size: 15px; font-weight: 600;
          transition: background .2s, border-color .2s, transform .2s;
        }
        .edupath-btn-social:hover { background: #F6F8FC; border-color: #1E4E8C !important; transform: translateY(-1px); }
        .edupath-social-grid {
          display: grid; grid-template-columns: 1fr; gap: 10px;
        }
        .edupath-btn-social svg { flex-shrink: 0; }
        .edupath-divider {
          display: flex; align-items: center; gap: 12px;
          margin: 18px 0 20px; color: #5B6B82; font-size: 13px;
        }
        .edupath-divider::before, .edupath-divider::after {
          content: ""; flex: 1; height: 1px; background: rgba(23,38,60,0.14);
        }

        .edupath-modal {
          background: #FFFFFF; border-radius: 20px;
          padding: 40px 36px 32px;
          width: 100%; max-width: 440px; position: relative;
          box-shadow: 0 30px 60px -20px rgba(23,38,60,0.4);
          transform: translateY(20px);
          transition: transform .35s cubic-bezier(0.22,1,0.36,1);
        }
        .edupath-modal-overlay.open .edupath-modal { transform: translateY(0); }

        .edupath-modal-close {
          position: absolute; top: 16px; right: 16px;
          width: 36px; height: 36px; border-radius: 50%;
          background: transparent; color: #5B6B82;
          font-size: 24px; line-height: 1;
          display: flex; align-items: center; justify-content: center;
          transition: background .2s;
        }
        .edupath-modal-close:hover { background: #E6EDF7; color: #17263C; }

        .edupath-modal-title {
          font-family: 'Lora', serif; font-size: 28px;
          color: #17263C; margin-bottom: 8px;
        }
        .edupath-modal-sub {
          font-size: 14px; color: #5B6B82;
          margin-bottom: 28px; line-height: 1.5;
        }

        .edupath-field { margin-bottom: 16px; }
        .edupath-field label {
          display: block; font-size: 13px; color: #5B6B82;
          margin-bottom: 6px; font-weight: 500;
        }
        .edupath-field input {
          width: 100%; padding: 13px 16px;
          font-family: inherit; font-size: 15px;
          background: #F6F8FC; color: #17263C;
          border: 1.5px solid rgba(23,38,60,0.14);
          border-radius: 10px;
          transition: border-color .2s, background .2s;
        }
        .edupath-field input:focus {
          outline: none; border-color: #1E4E8C; background: #FFFFFF;
        }

        .edupath-error {
          font-size: 13px; color: #B84A3A;
          min-height: 18px; margin-bottom: 12px; line-height: 1.4;
        }

        .edupath-btn-submit {
          width: 100%; padding: 15px;
          background: #17263C; color: #F6F8FC;
          border-radius: 10px; font-size: 15px; font-weight: 600;
          transition: background .2s, transform .2s;
        }
        .edupath-btn-submit:hover { background: #0F2A4A; transform: translateY(-1px); }
        .edupath-btn-submit:disabled { opacity: 0.6; cursor: wait; }

        .edupath-btn-ghost {
          width: 100%; padding: 13px; margin-top: 10px;
          background: #E6EDF7; color: #17263C;
          border-radius: 10px; font-size: 14px; font-weight: 600;
          transition: background .2s;
        }
        .edupath-btn-ghost:hover { background: #C9D5E6; }

        .edupath-btn-link {
          display: block; width: 100%; margin-top: 14px;
          background: transparent; color: #1E4E8C;
          font-size: 14px; font-weight: 600;
          text-decoration: underline; text-underline-offset: 3px;
        }
        .edupath-btn-link:hover { color: #0F2A4A; }

        .edupath-confirm-icon {
          font-size: 48px; text-align: center; margin-bottom: 16px;
        }
        .edupath-confirm-sub {
          font-size: 14px; color: #5B6B82;
          line-height: 1.6; margin-bottom: 24px; text-align: center;
        }
        .edupath-confirm-sub b { color: #17263C; }

        .edupath-switch {
          text-align: center; margin-top: 20px;
          font-size: 14px; color: #5B6B82;
        }
        .edupath-switch button {
          color: #1E4E8C; font-weight: 600;
          text-decoration: underline; text-underline-offset: 3px;
          padding: 0 4px;
        }

        @media (max-width: 480px) {
          .edupath-modal { padding: 32px 24px 24px; }
          .edupath-modal-title { font-size: 24px; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
    modalEl = overlay;
    return overlay;
  }

  function openModal(mode) {
    mode = mode || "register";
    modalMode = mode;

    const overlay = buildModal();
    if (mode === "register" || mode === "login") formOpenedAt = Date.now();
    initCaptcha();   // капча начинает проверку в фоне, пока человек заполняет форму
    overlay.classList.add("open");

    const title       = overlay.querySelector(".edupath-modal-title");
    const sub         = document.getElementById("edupathModalSub");
    const form        = document.getElementById("edupathAuthForm");
    const confirmBox  = document.getElementById("edupathConfirmBlock");
    const nameField   = document.getElementById("edupathNameField");
    const submitBtn   = document.getElementById("edupathSubmitBtn");
    const switchWrap  = document.getElementById("edupathSwitchWrap");
    const switchText  = document.getElementById("edupathSwitchText");
    const switchBtn   = document.getElementById("edupathSwitchBtn");
    const errEl       = document.getElementById("edupathAuthError");

    errEl.textContent = "";

    if (window.I18N) window.I18N.applyAll();

    const socialBlock = document.getElementById("edupathSocialBlock");
    document.getElementById("edupathOrLabel").textContent     = t("modal_or", "или");
    socialBlock.style.display = (mode === "confirm") ? "none" : "block";

    if (mode === "confirm") {
      form.style.display = "none";
      confirmBox.style.display = "block";
      switchWrap.style.display = "none";

      title.textContent = t("modal_confirm_title", "Подтверди почту");
      sub.textContent = "";

      const confirmSub = document.getElementById("edupathConfirmSub");
      confirmSub.innerHTML = t(
        "modal_confirm_sub",
        "Мы отправили письмо на {email}. Открой Gmail и нажми на ссылку подтверждения."
      ).replace("{email}", "<b>" + (pendingEmail || "") + "</b>");

      document.getElementById("edupathSpamHint").textContent = tx("spam_hint");
      document.getElementById("edupathResendBtn").textContent       = t("modal_confirm_resend", "Отправить письмо заново");
      document.getElementById("edupathOpenMailBtn").textContent     = t("modal_confirm_open_mail", "Открыть Gmail");
      document.getElementById("edupathAlreadyConfirmedBtn").textContent = t("modal_confirm_already", "Я подтвердил — войти");
      return;
    }

    form.style.display = "block";
    confirmBox.style.display = "none";
    switchWrap.style.display = "block";

    const emailField = document.getElementById("edupathEmailField");
    const passField  = document.getElementById("edupathPasswordField");
    const pwHint     = document.getElementById("edupathPwHint");
    const forgotBtn  = document.getElementById("edupathForgotBtn");
    const consentFld = document.getElementById("edupathConsentField");
    const sentEl     = document.getElementById("edupathSentMsg");
    if (sentEl) sentEl.remove();

    emailField.style.display = "block";
    passField.style.display  = "block";
    pwHint.textContent = tx("pw_hint");
    forgotBtn.textContent = tx("forgot_link");

    if (mode === "register") {
      title.textContent = t("modal_hello", "Добро пожаловать");
      sub.textContent   = t("modal_hello_sub", "Создай аккаунт, чтобы сохранять университеты");
      nameField.style.display = "block";
      consentFld.style.display = "flex";
      pwHint.style.display = "block";
      forgotBtn.style.display = "none";
      document.getElementById("edupathPassword").setAttribute("autocomplete", "new-password");
      submitBtn.textContent = t("modal_submit_register", "Создать аккаунт");
      switchText.textContent = t("modal_switch_register", "Уже есть аккаунт?");
      switchBtn.textContent  = t("modal_switch_register_btn", "Войти");
    } else if (mode === "forgot") {
      socialBlock.style.display = "none";
      title.textContent = tx("forgot_title");
      sub.textContent   = tx("forgot_sub");
      nameField.style.display = "none";
      consentFld.style.display = "none";
      passField.style.display = "none";
      submitBtn.textContent = tx("forgot_btn");
      switchText.textContent = tx("back_q");
      switchBtn.textContent  = tx("back_btn");
    } else if (mode === "newpass") {
      socialBlock.style.display = "none";
      switchWrap.style.display = "none";
      title.textContent = tx("newpass_title");
      sub.textContent   = tx("newpass_sub");
      nameField.style.display = "none";
      consentFld.style.display = "none";
      emailField.style.display = "none";
      pwHint.style.display = "block";
      forgotBtn.style.display = "none";
      document.getElementById("edupathPassword").value = "";
      document.getElementById("edupathPassword").setAttribute("autocomplete", "new-password");
      submitBtn.textContent = tx("newpass_btn");
    } else {
      title.textContent = t("modal_welcome_back", "С возвращением");
      sub.textContent   = t("modal_welcome_back_sub", "Войди в свой аккаунт");
      nameField.style.display = "none";
      consentFld.style.display = "none";
      pwHint.style.display = "none";
      forgotBtn.style.display = "block";
      document.getElementById("edupathPassword").setAttribute("autocomplete", "current-password");
      submitBtn.textContent = t("modal_submit_login", "Войти");
      switchText.textContent = t("modal_switch_login", "Нет аккаунта?");
      switchBtn.textContent  = t("modal_switch_login_btn", "Создать");
    }

    setTimeout(() => {
      const firstInput = mode === "register"
        ? document.getElementById("edupathName")
        : (mode === "newpass" ? document.getElementById("edupathPassword") : document.getElementById("edupathEmail"));
      if (firstInput) firstInput.focus();
    }, 250);
  }

  function closeModal() {
    if (modalEl) modalEl.classList.remove("open");
  }

  document.addEventListener("click", (e) => {
    const oauthBtn = e.target.closest("[data-oauth]");
    if (oauthBtn) {
      e.preventDefault();
      oauthBtn.disabled = true;
      signInWithProvider(oauthBtn.dataset.oauth);
      return;
    }

    const openBtn = e.target.closest("[data-auth-open]");
    if (openBtn) {
      e.preventDefault();
      openModal(openBtn.dataset.authOpen || "register");
      return;
    }

    if (e.target.closest(".edupath-modal-close")) {
      closeModal();
      return;
    }

    if (e.target.classList && e.target.classList.contains("edupath-modal-overlay")) {
      closeModal();
      return;
    }

    if (e.target.id === "edupathSwitchBtn") {
      openModal(modalMode === "login" ? "register" : "login");
      return;
    }

    if (e.target.id === "edupathForgotBtn") {
      e.preventDefault();
      openModal("forgot");
      return;
    }

    if (e.target.id === "edupathResendBtn") {
      e.preventDefault();
      const btn = e.target;
      const oldText = btn.textContent;
      btn.disabled = true;
      btn.textContent = t("modal_wait", "Подождите...");

      resendConfirmation(pendingEmail).then(res => {
        btn.disabled = false;
        btn.textContent = oldText;
        if (res.ok) {
          showToast(t("modal_confirm_resent", "Письмо отправлено снова"), "success");
        } else {
          showToast(res.error || t("modal_error_generic", "Что-то пошло не так"), "error");
        }
      });
      return;
    }

    if (e.target.id === "edupathOpenMailBtn") {
      e.preventDefault();
      window.open("https://mail.google.com", "_blank");
      return;
    }

    if (e.target.id === "edupathAlreadyConfirmedBtn") {
      e.preventDefault();
      openModal("login");
      return;
    }

    if (e.target.closest("[data-auth-logout]")) {
      e.preventDefault();
      logout();
      try { sessionStorage.setItem(FLASH_KEY, "logout"); } catch (err) {}
      goToLanding();
      return;
    }
  });

  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "edupathAuthForm") return;
    e.preventDefault();

    const errEl     = document.getElementById("edupathAuthError");
    const submitBtn = document.getElementById("edupathSubmitBtn");

    errEl.textContent = "";
    submitBtn.disabled = true;

    const oldText = submitBtn.textContent;
    submitBtn.textContent = t("modal_wait", "Подождите...");

    const name     = document.getElementById("edupathName").value.trim();
    const email    = document.getElementById("edupathEmail").value.trim();
    const password = document.getElementById("edupathPassword").value;

    let result;

    const mode = modalMode;
    if (mode === "register") {
      result = await register(name, email, password, document.getElementById("edupathConsent").checked);
    } else if (mode === "forgot") {
      result = await requestPasswordReset(email);
    } else if (mode === "newpass") {
      result = await updatePassword(password);
    } else {
      result = await login(email, password);
    }

    submitBtn.disabled = false;
    submitBtn.textContent = oldText;

    if (!result.ok) {
      errEl.textContent = result.error;
      return;
    }

    if (mode === "forgot") {
      // Показываем одинаковый ответ — существует аккаунт или нет
      const form = document.getElementById("edupathAuthForm");
      form.style.display = "none";
      const msg = document.createElement("p");
      msg.className = "edupath-sent";
      msg.id = "edupathSentMsg";
      msg.textContent = tx("forgot_sent").replace("{email}", email);
      form.parentNode.insertBefore(msg, form);
      return;
    }

    if (mode === "newpass") {
      document.getElementById("edupathPassword").value = "";
      closeModal();
      showToast(tx("newpass_done"), "success");
      updateHeaderUI();
      if (_readyResolve) _readyResolve();
      if (isLandingPage()) setTimeout(goToApp, 1200);
      return;
    }

    if (result.needsConfirmation) {
      pendingEmail = result.email || email;
      openModal("confirm");
      return;
    }

    closeModal();
    showToast(
      modalMode === "register"
        ? t("modal_register_success", "Аккаунт создан. Привет!")
        : t("modal_login_success", "С возвращением!"),
      "success"
    );

    updateHeaderUI();
    if (_readyResolve) _readyResolve();
    syncProfilePrefs().catch(() => {});

    if (isLandingPage()) {
      setTimeout(goToApp, 700);
      return;
    }

    if (window.location.pathname.includes("profile")) {
      window.location.reload();
    }
  });

  function handleAuthRedirect() {
    const hash = window.location.hash || "";
    const search = window.location.search || "";

    const errSource = hash.includes("error") ? hash.replace(/^#/, "") : (search.includes("error") ? search.replace(/^\?/, "") : "");
    if (errSource) {
      const ep = new URLSearchParams(errSource);
      const desc = ep.get("error_description");
      if (ep.get("error") || desc) {
        history.replaceState(null, "", window.location.pathname);
        if (ep.get("error_code") === "otp_expired") {
          showToast(tx("link_expired"), "error");
          setTimeout(() => openModal("forgot"), 300);
          return true;
        }
        showToast((desc || t("modal_error_generic", "Что-то пошло не так")).replace(/\+/g, " "), "error");
        return true;
      }
    }

    if (hash.includes("access_token=")) {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const access = params.get("access_token");
      const refresh = params.get("refresh_token");

      if (access) {
        setSession({ access_token: access, refresh_token: refresh });
        history.replaceState(null, "", window.location.pathname + window.location.search);

        const fromToken = userFromToken(access);
        if (fromToken) setCachedUser(fromToken);
        updateHeaderUI();

        apiFetch("/api/me", { method: "GET" }).then(res => {
          if (res.ok && res.data && res.data.user) {
            setCachedUser(res.data.user);
            updateHeaderUI();
          }
          if (_readyResolve) _readyResolve();
        });

        if (params.get("type") === "recovery") {
          // Ссылка из письма «Сброс пароля»: человек уже вошёл, просим новый пароль
          setTimeout(() => openModal("newpass"), 300);
          return true;
        }

        if (params.get("type") === "signup") {
          showToast(t("modal_after_confirm_title", "Почта подтверждена ✓"), "success");
        } else {
          showToast(t("modal_login_success", "С возвращением!"), "success");
        }

        if (isLandingPage()) {
          setTimeout(goToApp, 900);
        }
        return true;
      }
    }

    if (search.includes("code=")) {
      history.replaceState(null, "", window.location.pathname);
      setTimeout(() => {
        openModal("login");
        showToast(t("modal_after_confirm_sub", "Теперь войди со своим паролем"), "info");
      }, 300);
      return true;
    }

    return false;
  }

 function updateHeaderUI() {
    const user = getCurrentUser();
    const loginBtn = document.querySelector(".btn-login");
    if (!loginBtn) return;

    if (user) {
      loginBtn.textContent =
        t("nav_hello", "Привет") + ", " + (user.name || "друг").split(" ")[0];
      loginBtn.href = isLandingPage() ? "app.html" : "profile.html";
      loginBtn.setAttribute("data-auth-user", "1");
      loginBtn.removeAttribute("data-auth-open");
    } else {
      loginBtn.textContent = t("nav_login", "Войти");
      loginBtn.href = "#";
      loginBtn.removeAttribute("data-auth-user");
      loginBtn.setAttribute("data-auth-open", "login");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    handleAuthRedirect();
    updateHeaderUI();

    try {
      if (sessionStorage.getItem(FLASH_KEY) === "logout") {
        sessionStorage.removeItem(FLASH_KEY);
        showToast(t("modal_logout_success", "Вы вышли из аккаунта"), "info");
      }
    } catch (err) {}
    wakeServer();

    if (isLoggedIn()) {
      ensureFreshSession().then(() => {
        if (_readyResolve) _readyResolve();
        syncProfilePrefs().catch(() => {});
      }).catch(e => {
        console.warn("Auth ready failed:", e);
        if (_readyResolve) _readyResolve();
      });
    } else {
      if (_readyResolve) _readyResolve();
    }
  });

  window.addEventListener("edupath-lang-change", () => {
    updateHeaderUI();
    if (modalEl && modalEl.classList.contains("open")) {
      openModal(modalMode);
    }
  });

  window.EduAuth = {
    getToken,
    getCurrentUser,
    isLoggedIn,
    register,
    login,
    logout,
    resendConfirmation,
    getSaved,
    isSaved,
    toggleSave,
    getTests,
    saveTestResult,
    getStudySummary,
    saveStudySession,
    getSavedQuotes,
    isQuoteSaved,
    toggleQuote,
    localDateStr,
    getDeviceId,
    captchaLog: () => _ts.log.slice(),
    getProfile,
    saveProfilePrefs,
    syncProfilePrefs,
    deleteMyData,
    showToast,
    openModal,
    updateHeaderUI,
    refreshSession,
    signInWithProvider
  };

})();
