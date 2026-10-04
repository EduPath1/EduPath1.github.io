// ============================================================
// EduPath — auth.js (настоящий бэкенд, v2)
// ============================================================

(function() {
  "use strict";

  const API_URL = "https://edupath1-github-io.onrender.com";
  const TOKEN_KEY = "edupath_token";
  const USER_KEY = "edupath_user";

  // ============================================================
  // РАБОТА С ТОКЕНОМ / ЮЗЕРОМ
  // ============================================================

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
  }
  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  function setCachedUser(user) {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function getCachedUser() {
    try {
      const s = localStorage.getItem(USER_KEY);
      return s ? JSON.parse(s) : null;
    } catch(e) { return null; }
  }

  function isLoggedIn() {
    return !!getToken();
  }
  function getCurrentUser() {
    return getCachedUser();
  }

  // ============================================================
  // СЕТЕВОЙ СЛОЙ — с обработкой «спящего сервера»
  // ============================================================

  // Проверяет: сервер вернул ошибку «спит»?
  function isServerSleeping(status) {
    return status === 0 || status === 502 || status === 503 || status === 504 || status >= 500;
  }

  async function apiFetch(path, options) {
    options = options || {};
    const headers = Object.assign({
      "Content-Type": "application/json"
    }, options.headers || {});
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    try {
      const res = await fetch(API_URL + path, Object.assign({}, options, { headers }));
      let data = null;
      try { data = await res.json(); } catch(e) {}
      return { ok: res.ok, status: res.status, data };
    } catch(networkError) {
      // fetch не смог дозвониться — сервер точно спит или нет интернета
      return { ok: false, status: 0, data: null, networkError: true };
    }
  }

  // Универсальная обёртка: повторяет запрос один раз, если сервер спал
  async function apiFetchWithRetry(path, options, retryDelayMs) {
    retryDelayMs = retryDelayMs || 2000;
    let res = await apiFetch(path, options);

    // Если сервер спал или вернул 5xx — ждём и пробуем ещё раз
    if (!res.ok && isServerSleeping(res.status)) {
      console.warn("Server seems asleep, retrying in", retryDelayMs, "ms");
      await new Promise(r => setTimeout(r, retryDelayMs));
      res = await apiFetch(path, options);
    }

    return res;
  }

  // Человеческое сообщение об ошибке
  function humanError(res, fallback) {
    if (res && isServerSleeping(res.status)) {
      return "Сервер просыпается. Подожди 30 секунд и попробуй снова.";
    }
    if (res && res.data && res.data.error) {
      return res.data.error;
    }
    return fallback || "Что-то пошло не так. Попробуй ещё раз.";
  }

  // ============================================================
  // РЕГИСТРАЦИЯ / ВХОД / ВЫХОД
  // ============================================================

  async function register(name, email, password) {
    if (!name || !email || !password) {
      return { ok: false, error: "Заполните все поля" };
    }
    const res = await apiFetchWithRetry("/api/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password })
    });

    if (!res.ok) {
      return { ok: false, error: humanError(res, "Ошибка регистрации") };
    }

    const session = res.data && res.data.session;
    const user = res.data && res.data.user;
    if (session && session.access_token) {
      setToken(session.access_token);
      setCachedUser({
        name: (user && user.name) || name,
        email: (user && user.email) || email,
        id: user && user.id
      });
    }
    return { ok: true, user: user };
  }

  async function login(email, password) {
    if (!email || !password) {
      return { ok: false, error: "Заполните все поля" };
    }
    const res = await apiFetchWithRetry("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      return { ok: false, error: humanError(res, "Неверный email или пароль") };
    }

    const session = res.data && res.data.session;
    const user = res.data && res.data.user;
    if (session && session.access_token) {
      setToken(session.access_token);
      setCachedUser({
        name: (user && user.name) || "",
        email: user && user.email,
        id: user && user.id
      });
    }
    return { ok: true, user: user };
  }

  function logout() {
    clearToken();
    _savedCache = null;
    _testsCache = null;
  }

  // ============================================================
  // СОХРАНЁННЫЕ УНИВЕРСИТЕТЫ
  // ============================================================

  let _savedCache = null;

  async function getSaved() {
    if (!isLoggedIn()) {
      _savedCache = [];
      return [];
    }

    const res = await apiFetch("/api/saved", { method: "GET" });
    if (!res.ok) {
      // Не ломаем интерфейс — возвращаем прошлый кэш или пустой массив
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
    if (!isLoggedIn()) return { ok: false, error: "Не вошёл" };

    // 1) Подгружаем актуальный список
    await getSaved();

    const currentlySaved = isSaved(uni.name);

    // 2) Отправляем запрос (с retry при спящем сервере)
    if (currentlySaved) {
      const res = await apiFetchWithRetry(
        "/api/saved/" + encodeURIComponent(uni.name),
        { method: "DELETE" }
      );
      if (!res.ok) {
        return { ok: false, error: humanError(res, "Не удалось удалить") };
      }
      if (_savedCache) _savedCache = _savedCache.filter(u => u.name !== uni.name);
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
        return { ok: false, error: humanError(res, "Не удалось сохранить") };
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
  // РЕЗУЛЬТАТЫ ТЕСТОВ
  // ============================================================

  let _testsCache = null;

  async function getTests() {
    if (!isLoggedIn()) {
      _testsCache = [];
      return [];
    }

    const res = await apiFetch("/api/tests", { method: "GET" });
    if (!res.ok) {
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
    if (!isLoggedIn()) return { ok: false, error: "Не вошёл" };

    const res = await apiFetchWithRetry("/api/tests", {
      method: "POST",
      body: JSON.stringify({
        categories: finalData.categories || {},
        summary: finalData.summary || ""
      })
    });

    if (!res.ok) {
      return { ok: false, error: humanError(res, "Не удалось сохранить тест") };
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
          position: fixed; bottom: 32px; left: 50%;
          transform: translateX(-50%) translateY(20px);
          background: #2B1B10; color: #F7EFE1;
          padding: 14px 24px; border-radius: 10px;
          font-family: 'Work Sans', sans-serif;
          font-size: 14px; font-weight: 500;
          box-shadow: 0 12px 28px -10px rgba(43,27,16,0.5);
          z-index: 9999; opacity: 0;
          animation: toastIn .3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          pointer-events: none;
          max-width: 90vw;
          text-align: center;
          line-height: 1.4;
        }
        .edupath-toast-success { background: #2B1B10; color: #F7EFE1; }
        .edupath-toast-error { background: #B84A3A; color: #FBF6EC; }
        .edupath-toast-info { background: #8C5A34; color: #FBF6EC; }
        @keyframes toastIn { to { opacity: 1; transform: translateX(-50%) translateY(0); } }
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
  // МОДАЛКА
  // ============================================================

  let modalEl = null;
  let modalMode = "register";

  function buildModal() {
    if (modalEl) return modalEl;

    const overlay = document.createElement("div");
    overlay.className = "edupath-modal-overlay";
    overlay.id = "edupathAuthModal";
    overlay.innerHTML = `
      <div class="edupath-modal">
        <button class="edupath-modal-close" type="button" aria-label="Закрыть">×</button>
        <h2 class="edupath-modal-title">Добро пожаловать</h2>
        <p class="edupath-modal-sub" id="edupathModalSub">Создай аккаунт, чтобы сохранять университеты</p>
        <form id="edupathAuthForm" autocomplete="off">
          <div class="edupath-field" id="edupathNameField">
            <label>Имя</label>
            <input type="text" id="edupathName" placeholder="Например, Айсана">
          </div>
          <div class="edupath-field">
            <label>Email</label>
            <input type="email" id="edupathEmail" placeholder="you@mail.com">
          </div>
          <div class="edupath-field">
            <label>Пароль</label>
            <input type="password" id="edupathPassword" placeholder="Минимум 6 символов">
          </div>
          <div class="edupath-error" id="edupathAuthError"></div>
          <button type="submit" class="edupath-btn-submit" id="edupathSubmitBtn">Создать аккаунт</button>
        </form>
        <div class="edupath-switch">
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
          z-index: 9998;
          opacity: 0; visibility: hidden;
          transition: opacity .3s cubic-bezier(0.22,1,0.36,1), visibility .3s;
          padding: 20px;
        }
        .edupath-modal-overlay.open { opacity: 1; visibility: visible; }
        .edupath-modal {
          background: #FBF6EC; border-radius: 20px;
          padding: 40px 36px 32px;
          width: 100%; max-width: 440px;
          position: relative;
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
        .edupath-modal-title { font-family: 'Fraunces', serif; font-size: 28px; color: #2B1B10; margin-bottom: 8px; }
        .edupath-modal-sub { font-size: 14px; color: #7A6552; margin-bottom: 28px; line-height: 1.5; }
        .edupath-field { margin-bottom: 16px; }
        .edupath-field label { display: block; font-size: 13px; color: #7A6552; margin-bottom: 6px; font-weight: 500; }
        .edupath-field input {
          width: 100%; padding: 13px 16px;
          font-family: inherit; font-size: 15px;
          background: #F7EFE1; color: #2B1B10;
          border: 1.5px solid rgba(43,27,16,0.14);
          border-radius: 10px;
          transition: border-color .2s, background .2s;
        }
        .edupath-field input:focus { outline: none; border-color: #8C5A34; background: #FBF6EC; }
        .edupath-error { font-size: 13px; color: #B84A3A; min-height: 18px; margin-bottom: 12px; line-height: 1.4; }
        .edupath-btn-submit {
          width: 100%; padding: 15px;
          background: #2B1B10; color: #F7EFE1;
          border-radius: 10px;
          font-size: 15px; font-weight: 600;
          transition: background .2s, transform .2s;
        }
        .edupath-btn-submit:hover { background: #5A3B26; transform: translateY(-1px); }
        .edupath-btn-submit:disabled { opacity: 0.6; cursor: wait; }
        .edupath-switch { text-align: center; margin-top: 20px; font-size: 14px; color: #7A6552; }
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

    const nameField = document.getElementById("edupathNameField");
    const submitBtn = document.getElementById("edupathSubmitBtn");
    const switchText = document.getElementById("edupathSwitchText");
    const switchBtn = document.getElementById("edupathSwitchBtn");
    const sub = document.getElementById("edupathModalSub");
    const errEl = document.getElementById("edupathAuthError");
    const title = overlay.querySelector(".edupath-modal-title");

    errEl.textContent = "";

    if (mode === "register") {
      title.textContent = "Добро пожаловать";
      sub.textContent = "Создай аккаунт, чтобы сохранять университеты";
      nameField.style.display = "block";
      submitBtn.textContent = "Создать аккаунт";
      switchText.textContent = "Уже есть аккаунт?";
      switchBtn.textContent = "Войти";
    } else {
      title.textContent = "С возвращением";
      sub.textContent = "Войди в свой аккаунт";
      nameField.style.display = "none";
      submitBtn.textContent = "Войти";
      switchText.textContent = "Нет аккаунта?";
      switchBtn.textContent = "Создать";
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
    const openBtn = e.target.closest("[data-auth-open]");
    if (openBtn) {
      e.preventDefault();
      openModal(openBtn.dataset.authOpen || "register");
      return;
    }
    if (e.target.closest(".edupath-modal-close")) { closeModal(); return; }
    if (e.target.classList && e.target.classList.contains("edupath-modal-overlay")) { closeModal(); return; }
    if (e.target.id === "edupathSwitchBtn") {
      openModal(modalMode === "register" ? "login" : "register");
      return;
    }
    if (e.target.closest("[data-auth-logout]")) {
      e.preventDefault();
      logout();
      showToast("Вы вышли из аккаунта", "info");
      updateHeaderUI();
      if (window.location.pathname.includes("profile")) {
        window.location.href = "index.html";
      }
      return;
    }
  });

  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "edupathAuthForm") return;
    e.preventDefault();

    const errEl = document.getElementById("edupathAuthError");
    const submitBtn = document.getElementById("edupathSubmitBtn");
    errEl.textContent = "";
    submitBtn.disabled = true;
    const oldText = submitBtn.textContent;
    submitBtn.textContent = "Подождите...";

    const name = document.getElementById("edupathName").value.trim();
    const email = document.getElementById("edupathEmail").value.trim();
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

    closeModal();
    showToast(
      modalMode === "register" ? "Аккаунт создан. Привет!" :
      "С возвращением!", "success"
    );
    updateHeaderUI();
    
    function updateHeaderUI() {
  const user = getCurrentUser();
  const loginBtn = document.querySelector(".btn-login");
  if (!loginBtn) return;

  const hello = (window.I18N && window.I18N.t("nav_hello")) || "Привет";
  const loginText = (window.I18N && window.I18N.t("nav_login")) || "Войти";

  if (user) {
    loginBtn.textContent = hello + ", " + (user.name || "друг").split(" ")[0];
    loginBtn.href = "profile.html";
    loginBtn.setAttribute("data-auth-user", "1");
    loginBtn.removeAttribute("data-auth-open");
  } else {
    loginBtn.textContent = loginText;
    loginBtn.href = "#";
    loginBtn.removeAttribute("data-auth-user");
    loginBtn.setAttribute("data-auth-open", "register");
  }
    }
    if (window.location.pathname.includes("profile")) {
      window.location.reload();
    }
  });

  // ============================================================
  // ШАПКА
  // ============================================================

  function updateHeaderUI() {
    const user = getCurrentUser();
    const loginBtn = document.querySelector(".btn-login");
    if (!loginBtn) return;
    if (user) {
      loginBtn.textContent = "Привет, " + (user.name || "друг").split(" ")[0];
      loginBtn.href = "profile.html";
      loginBtn.setAttribute("data-auth-user", "1");
      loginBtn.removeAttribute("data-auth-open");
    } else {
      loginBtn.textContent = "Войти";
      loginBtn.href = "#";
      loginBtn.removeAttribute("data-auth-user");
      loginBtn.setAttribute("data-auth-open", "register");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateHeaderUI();
    if (isLoggedIn()) {
      getSaved().catch(e => console.warn("preload saved failed:", e));
      getTests().catch(e => console.warn("preload tests failed:", e));
    }
  });

  // ============================================================
  // ЭКСПОРТ
  // ============================================================

  window.EduAuth = {
    getToken,
    getCurrentUser,
    isLoggedIn,
    register,
    login,
    logout,
    getSaved,
    isSaved,
    toggleSave,
    getTests,
    saveTestResult,
    showToast,
    openModal,
    updateHeaderUI
  };

})();
