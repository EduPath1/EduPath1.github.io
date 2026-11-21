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
  const TURNSTILE_SITE_KEY = "0x4AAAAAAGLst_cuHSX_PzUF";

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

  let _tsLoading = null, _tsWidget = null, _tsWaiter = null;

  function loadTurnstile() {
    if (!TURNSTILE_SITE_KEY) return Promise.resolve(null);
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (_tsLoading) return _tsLoading;
    _tsLoading = new Promise((resolve, reject) => {
      const sc = document.createElement("script");
      sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      sc.async = true;
      sc.onload = () => resolve(window.turnstile);
      sc.onerror = () => { _tsLoading = null; reject(new Error("captcha script")); };
      document.head.appendChild(sc);
    });
    return _tsLoading;
  }

  async function getCaptchaToken() {
    if (!TURNSTILE_SITE_KEY) return null;
    const ts = await loadTurnstile();
    const box = document.getElementById("edupathCaptcha");
    if (!ts || !box) return null;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { _tsWaiter = null; reject(new Error(t("modal_captcha_fail", "Проверка «я не робот» не загрузилась. Обнови страницу."))); }, 45000);
      _tsWaiter = {
        ok: tok => { clearTimeout(timer); _tsWaiter = null; resolve(tok); },
        fail: () => { clearTimeout(timer); _tsWaiter = null; reject(new Error(t("modal_captcha_fail", "Проверка «я не робот» не прошла. Обнови страницу."))); }
      };
      if (_tsWidget === null) {
        _tsWidget = ts.render(box, {
          sitekey: TURNSTILE_SITE_KEY,
          execution: "execute",
          appearance: "interaction-only",
          language: (window.I18N && window.I18N.getLang && window.I18N.getLang()) || "auto",
          callback: tok => _tsWaiter && _tsWaiter.ok(tok),
          "error-callback": () => { if (_tsWaiter) _tsWaiter.fail(); return true; },
          "expired-callback": () => {}
        });
      } else {
        ts.reset(_tsWidget);
      }
      ts.execute(_tsWidget);
    });
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

  const NO_REFRESH_PATHS = ["/api/login", "/api/register", "/api/refresh", "/api/resend-confirmation"];

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

  async function register(name, email, password, consent) {
    if (!name || !email || !password) {
      return { ok: false, error: t("modal_fill_all", "Заполните все поля") };
    }
    if (password.length < 8) {
      return { ok: false, error: t("modal_password_short", "Пароль должен быть не короче 8 символов") };
    }
    if (!consent) {
      return { ok: false, error: t("modal_consent_need", "Отметь согласие, чтобы создать аккаунт") };
    }

    let captcha_token = null;
    try { captcha_token = await getCaptchaToken(); }
    catch (e) { return { ok: false, error: e.message }; }

    const res = await apiFetchWithRetry("/api/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, consent: true, captcha_token })
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
          background: #2B1B10; color: #F7EFE1;
          padding: 14px 24px; border-radius: 10px;
          font-family: 'Work Sans', sans-serif; font-size: 14px; font-weight: 500;
          box-shadow: 0 12px 28px -10px rgba(43,27,16,0.5);
          z-index: 9999; opacity: 0;
          animation: toastIn .3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          pointer-events: none; max-width: 90vw; text-align: center; line-height: 1.4;
        }
        .edupath-toast-success { background: #2B1B10; color: #F7EFE1; }
        .edupath-toast-error   { background: #B84A3A; color: #FBF6EC; }
        .edupath-toast-info    { background: #8C5A34; color: #FBF6EC; }
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

          <div class="edupath-field">
            <label data-i18n="modal_email">Email</label>
            <input type="email" id="edupathEmail" placeholder="you@mail.com">
          </div>

          <div class="edupath-field">
            <label data-i18n="modal_password">Пароль</label>
            <input type="password" id="edupathPassword" data-i18n-placeholder="modal_password_ph" placeholder="Минимум 8 символов" autocomplete="new-password">
          </div>

          <label class="edupath-consent" id="edupathConsentField">
            <input type="checkbox" id="edupathConsent">
            <span data-i18n="modal_consent">Я согласен(на), что EduPath хранит мои данные, чтобы сайт работал</span>
          </label>

          <div class="edupath-error" id="edupathAuthError"></div>

          <button type="submit" class="edupath-btn-submit" id="edupathSubmitBtn">Создать аккаунт</button>
        </form>

        <div id="edupathConfirmBlock" style="display:none;">
          <div class="edupath-confirm-icon">📧</div>
          <p class="edupath-confirm-sub" id="edupathConfirmSub"></p>
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
          background: rgba(43,27,16,0.55);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 9998; opacity: 0; visibility: hidden;
          transition: opacity .3s cubic-bezier(0.22,1,0.36,1), visibility .3s;
          padding: 20px;
        }
        .edupath-modal-overlay.open { opacity: 1; visibility: visible; }

        .edupath-modal, .edupath-modal input, .edupath-modal button {
          font-family: 'Work Sans', 'Inter', sans-serif;
        }
        .edupath-modal button { border: 0; cursor: pointer; }
        .edupath-modal { max-height: 94vh; overflow-y: auto; }
        .edupath-consent { display: flex; gap: 10px; align-items: flex-start; margin: 4px 0 14px; font-size: 13px; line-height: 1.45; color: #5B4636; cursor: pointer; }
        .edupath-consent input { width: 18px; height: 18px; margin: 1px 0 0; flex-shrink: 0; accent-color: #8C5A34; }
        .edupath-captcha:empty { display: none; }
        .edupath-captcha { display: flex; justify-content: center; margin: 10px 0 0; }

        .edupath-btn-social {
          width: 100%; padding: 12px 10px;
          display: flex; align-items: center; justify-content: center; gap: 9px;
          background: #FBF6EC; color: #2B1B10;
          border: 1.5px solid rgba(43,27,16,0.18) !important;
          border-radius: 10px; font-size: 15px; font-weight: 600;
          transition: background .2s, border-color .2s, transform .2s;
        }
        .edupath-btn-social:hover { background: #F7EFE1; border-color: #8C5A34 !important; transform: translateY(-1px); }
        .edupath-social-grid {
          display: grid; grid-template-columns: 1fr; gap: 10px;
        }
        .edupath-btn-social svg { flex-shrink: 0; }
        .edupath-divider {
          display: flex; align-items: center; gap: 12px;
          margin: 18px 0 20px; color: #7A6552; font-size: 13px;
        }
        .edupath-divider::before, .edupath-divider::after {
          content: ""; flex: 1; height: 1px; background: rgba(43,27,16,0.14);
        }

        .edupath-modal {
          background: #FBF6EC; border-radius: 20px;
          padding: 40px 36px 32px;
          width: 100%; max-width: 440px; position: relative;
          box-shadow: 0 30px 60px -20px rgba(43,27,16,0.4);
          transform: translateY(20px);
          transition: transform .35s cubic-bezier(0.22,1,0.36,1);
        }
        .edupath-modal-overlay.open .edupath-modal { transform: translateY(0); }

        .edupath-modal-close {
          position: absolute; top: 16px; right: 16px;
          width: 36px; height: 36px; border-radius: 50%;
          background: transparent; color: #7A6552;
          font-size: 24px; line-height: 1;
          display: flex; align-items: center; justify-content: center;
          transition: background .2s;
        }
        .edupath-modal-close:hover { background: #EFE1C6; color: #2B1B10; }

        .edupath-modal-title {
          font-family: 'Fraunces', serif; font-size: 28px;
          color: #2B1B10; margin-bottom: 8px;
        }
        .edupath-modal-sub {
          font-size: 14px; color: #7A6552;
          margin-bottom: 28px; line-height: 1.5;
        }

        .edupath-field { margin-bottom: 16px; }
        .edupath-field label {
          display: block; font-size: 13px; color: #7A6552;
          margin-bottom: 6px; font-weight: 500;
        }
        .edupath-field input {
          width: 100%; padding: 13px 16px;
          font-family: inherit; font-size: 15px;
          background: #F7EFE1; color: #2B1B10;
          border: 1.5px solid rgba(43,27,16,0.14);
          border-radius: 10px;
          transition: border-color .2s, background .2s;
        }
        .edupath-field input:focus {
          outline: none; border-color: #8C5A34; background: #FBF6EC;
        }

        .edupath-error {
          font-size: 13px; color: #B84A3A;
          min-height: 18px; margin-bottom: 12px; line-height: 1.4;
        }

        .edupath-btn-submit {
          width: 100%; padding: 15px;
          background: #2B1B10; color: #F7EFE1;
          border-radius: 10px; font-size: 15px; font-weight: 600;
          transition: background .2s, transform .2s;
        }
        .edupath-btn-submit:hover { background: #5A3B26; transform: translateY(-1px); }
        .edupath-btn-submit:disabled { opacity: 0.6; cursor: wait; }

        .edupath-btn-ghost {
          width: 100%; padding: 13px; margin-top: 10px;
          background: #EFE1C6; color: #2B1B10;
          border-radius: 10px; font-size: 14px; font-weight: 600;
          transition: background .2s;
        }
        .edupath-btn-ghost:hover { background: #D9BD93; }

        .edupath-btn-link {
          display: block; width: 100%; margin-top: 14px;
          background: transparent; color: #8C5A34;
          font-size: 14px; font-weight: 600;
          text-decoration: underline; text-underline-offset: 3px;
        }
        .edupath-btn-link:hover { color: #5A3B26; }

        .edupath-confirm-icon {
          font-size: 48px; text-align: center; margin-bottom: 16px;
        }
        .edupath-confirm-sub {
          font-size: 14px; color: #7A6552;
          line-height: 1.6; margin-bottom: 24px; text-align: center;
        }
        .edupath-confirm-sub b { color: #2B1B10; }

        .edupath-switch {
          text-align: center; margin-top: 20px;
          font-size: 14px; color: #7A6552;
        }
        .edupath-switch button {
          color: #8C5A34; font-weight: 600;
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

      document.getElementById("edupathResendBtn").textContent       = t("modal_confirm_resend", "Отправить письмо заново");
      document.getElementById("edupathOpenMailBtn").textContent     = t("modal_confirm_open_mail", "Открыть Gmail");
      document.getElementById("edupathAlreadyConfirmedBtn").textContent = t("modal_confirm_already", "Я подтвердил — войти");
      return;
    }

    form.style.display = "block";
    confirmBox.style.display = "none";
    switchWrap.style.display = "block";

    if (mode === "register") {
      title.textContent = t("modal_hello", "Добро пожаловать");
      sub.textContent   = t("modal_hello_sub", "Создай аккаунт, чтобы сохранять университеты");
      nameField.style.display = "block";
      document.getElementById("edupathConsentField").style.display = "flex";
      document.getElementById("edupathPassword").setAttribute("autocomplete", "new-password");
      submitBtn.textContent = t("modal_submit_register", "Создать аккаунт");
      switchText.textContent = t("modal_switch_register", "Уже есть аккаунт?");
      switchBtn.textContent  = t("modal_switch_register_btn", "Войти");
    } else {
      title.textContent = t("modal_welcome_back", "С возвращением");
      sub.textContent   = t("modal_welcome_back_sub", "Войди в свой аккаунт");
      nameField.style.display = "none";
      document.getElementById("edupathConsentField").style.display = "none";
      document.getElementById("edupathPassword").setAttribute("autocomplete", "current-password");
      submitBtn.textContent = t("modal_submit_login", "Войти");
      switchText.textContent = t("modal_switch_login", "Нет аккаунта?");
      switchBtn.textContent  = t("modal_switch_login_btn", "Создать");
    }

    setTimeout(() => {
      const firstInput = mode === "register"
        ? document.getElementById("edupathName")
        : document.getElementById("edupathEmail");
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
      openModal(modalMode === "register" ? "login" : "register");
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

    if (modalMode === "register") {
      result = await register(name, email, password, document.getElementById("edupathConsent").checked);
    } else {
      result = await login(email, password);
    }

    submitBtn.disabled = false;
    submitBtn.textContent = oldText;

    if (!result.ok) {
      errEl.textContent = result.error;
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
