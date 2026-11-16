// ============================================================
// EduPath — auth.js (v3.0: 修复全新进入时数据加载丢失)
// ============================================================

(function() {
  "use strict";

  const API_URL = "https://edupath1-github-io.onrender.com";
  const TOKEN_KEY = "edupath_token";
  const USER_KEY = "edupath_user";
  const REFRESH_KEY = "edupath_refresh";
  // Публичный адрес проекта Supabase (нужен для входа через Google / Apple)
  const SUPABASE_URL = "https://upqvqqotslqubqdhvjkc.supabase.co";
  const FLASH_KEY = "edupath_flash";

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

  // Данные пользователя из самого токена (для Google/Apple имя приходит оттуда)
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
  // Признаки: нет ответа (0), 502, 503, 504. Обычная ошибка 500 — это НЕ сон.
  function isServerSleeping(status) {
    return status === 0 || status === 502 || status === 503 || status === 504;
  }

  // Будим сервер сразу при открытии любой страницы, не дожидаясь действий пользователя.
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
  let _refreshTransientFail = false; // обновление не удалось из-за сети/сна сервера, а не из-за плохого токена
  let _expiredToastAt = 0;

  function expireSession() {
    const hadSession = !!getToken() || !!getCurrentUser();
    clearToken();
    _savedCache = null;
    _testsCache = null;
    if (!hadSession) return;

    updateHeaderUI();
    if (Date.now() - _expiredToastAt > 5000) {
      _expiredToastAt = Date.now();
      showToast(t("modal_session_expired", "Сессия истекла. Войди снова."), "error");
      // Внутри сайта кнопки «Войти» больше нет — возвращаем на лендинг
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

        // сервер спит или нет сети — подождём и попробуем снова
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

    // Таймаут: «спящий» Render может молчать до минуты — не висим вечно
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
        // Токен не принят и обновить его не вышло -> сессия мертва.
        // Тогда сразу показываем «Войти», а не вечное «Привет, имя» с пустым профилем.
        // (Если причина лишь в спящем сервере — сессию не трогаем.)
        if (!_refreshTransientFail) expireSession();
      }

      return { ok: res.ok, status: res.status, data, sessionExpired: res.status === 401 && !!token && !isAuthPath };
    } catch (networkError) {
      clearTimeout(timer);
      return { ok: false, status: 0, data: null, networkError: true };
    }
  }

  // Повторяет запрос, пока сервер просыпается (холодный старт Render = 30–60 секунд).
  // Пауза растёт: 2, 4, 6, 8, 10 сек.
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

  async function register(name, email, password) {
    if (!name || !email || !password) {
      return { ok: false, error: t("modal_fill_all", "Заполните все поля") };
    }

    const res = await apiFetchWithRetry("/api/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password })
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

    const res = await apiFetchWithRetry("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
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
    const res = await apiFetchWithRetry("/api/resend-confirmation", {
      method: "POST",
      body: JSON.stringify({ email })
    });

    if (!res.ok) {
      return { ok: false, error: humanError(res, "modal_error_generic", "Что-то пошло не так") };
    }

    return { ok: true };
  }

  function logout() {
    clearToken();
    _savedCache = null;
    _testsCache = null;
    if (_readyResolve) _readyResolve();
  }

  // Вход через Google / Apple (через Supabase). После входа Supabase вернёт
  // человека на лендинг с токенами в адресе, а handleAuthRedirect() пустит его в сайт.
  function signInWithProvider(provider) {
    const back = window.location.origin + window.location.pathname.replace(/[^\/]*$/, "");
    let url = SUPABASE_URL + "/auth/v1/authorize?provider=" + encodeURIComponent(provider) +
              "&redirect_to=" + encodeURIComponent(back);
    if (provider === "google") url += "&prompt=select_account";
    window.location.href = url;
  }

  // ============================================================
  // READY PROMISE (关键修复！)
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
    // 关键：如果处于登录状态，这里会一直等待，直到 auth.js 获取到最新 token
    await _readyPromise;
  }

  // ============================================================
  // SAVED UNIVERSITIES
  // ============================================================

  let _savedCache = null;

  // opts.strict = true: при ошибке НЕ возвращать тихо пустой список, а бросить исключение
  // (профиль использует это, чтобы показать «не удалось загрузить» вместо пустоты).
  async function getSaved(opts) {
    // 关键：先等待 auth.js 初始化完毕，再发请求！
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
    // Если сервер прислал ошибку, покажем её текст. Если нет — покажем код (400, 500 и т.д.)
    const serverMsg = (res.data && res.data.error) ? res.data.error : ("Код ошибки: " + res.status);
    return { ok: false, error: serverMsg };
  }

  _testsCache = null;
  return { ok: true };
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

    overlay.innerHTML = `
      <div class="edupath-modal">
        <button class="edupath-modal-close" type="button" aria-label="Close">×</button>

        <h2 class="edupath-modal-title"></h2>
        <p class="edupath-modal-sub" id="edupathModalSub"></p>

        <div id="edupathSocialBlock">
          <button type="button" class="edupath-btn-social" data-oauth="google">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            <span id="edupathGoogleLabel">Продолжить с Google</span>
          </button>
          <button type="button" class="edupath-btn-social" data-oauth="apple">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>
            <span id="edupathAppleLabel">Продолжить с Apple</span>
          </button>
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
            <input type="password" id="edupathPassword" data-i18n-placeholder="modal_password_ph" placeholder="Минимум 6 символов">
          </div>

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

        <div class="edupath-switch" id="edupathSwitchWrap">
          <span id="edupathSwitchText">Уже есть аккаунт?</span>
          <button type="button" id="edupathSwitchBtn">Войти</button>
        </div>
      </div>
    `;

    if (!document.getElementById("edupath-modal-style")) {
      const style = document.createElement("style");
      style.id = "edupath-modal-style";
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

        .edupath-btn-social {
          width: 100%; padding: 13px 16px; margin-bottom: 10px;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          background: #FBF6EC; color: #2B1B10;
          border: 1.5px solid rgba(43,27,16,0.18) !important;
          border-radius: 10px; font-size: 15px; font-weight: 600;
          transition: background .2s, border-color .2s, transform .2s;
        }
        .edupath-btn-social:hover { background: #F7EFE1; border-color: #8C5A34 !important; transform: translateY(-1px); }
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
    document.getElementById("edupathGoogleLabel").textContent = t("modal_google", "Продолжить с Google");
    document.getElementById("edupathAppleLabel").textContent  = t("modal_apple", "Продолжить с Apple");
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
      submitBtn.textContent = t("modal_submit_register", "Создать аккаунт");
      switchText.textContent = t("modal_switch_register", "Уже есть аккаунт?");
      switchBtn.textContent  = t("modal_switch_register_btn", "Войти");
    } else {
      title.textContent = t("modal_welcome_back", "С возвращением");
      sub.textContent   = t("modal_welcome_back_sub", "Войди в свой аккаунт");
      nameField.style.display = "none";
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
      // Запоминаем, чтобы лендинг показал «Вы вышли из аккаунта», и уходим на лендинг
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
      result = await register(name, email, password);
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
    if (_readyResolve) _readyResolve(); // Разблокируем ожидание данных

    // Вошёл или зарегистрировался на лендинге — сразу пускаем внутрь сайта
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

    // Ошибка от Google / Apple / письма (человек отменил вход, ссылка устарела и т.п.)
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

        // Имя и почту берём прямо из токена — так работает и для Google, и для Apple
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

        // Пришёл на лендинг уже вошедшим (Google, Apple или письмо) — пускаем внутрь
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
      // С лендинга кнопка ведёт внутрь сайта
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

    // После «Выйти» лендинг сообщает, что выход прошёл
    try {
      if (sessionStorage.getItem(FLASH_KEY) === "logout") {
        sessionStorage.removeItem(FLASH_KEY);
        showToast(t("modal_logout_success", "Вы вышли из аккаунта"), "info");
      }
    } catch (err) {}
    wakeServer(); // будим сервер в фоне, пока пользователь читает страницу

    if (isLoggedIn()) {
      // При загрузке страницы начинаем фоновую проверку токена
      ensureFreshSession().then(() => {
        if (_readyResolve) _readyResolve(); // Проверка завершена — снимаем блокировку
      }).catch(e => {
        console.warn("Auth ready failed:", e);
        if (_readyResolve) _readyResolve();
      });
    } else {
      // Если не залогинен, сразу разрешаем загрузку
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
    showToast,
    openModal,
    updateHeaderUI,
    refreshSession,
    signInWithProvider
  };

})();
