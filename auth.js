// ============================================================
// EduPath — авторизация и хранение данных (localStorage)
// ============================================================

(function() {
  "use strict";

  const STORAGE_KEYS = {
    USERS: "edupath_users",
    CURRENT: "edupath_current_user",
    SAVED: "edupath_saved_",
    TESTS: "edupath_tests_"
  };

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || "[]"); }
    catch(e) { return []; }
  }
  function saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }
  function getCurrentEmail() {
    return localStorage.getItem(STORAGE_KEYS.CURRENT);
  }
  function getCurrentUser() {
    const email = getCurrentEmail();
    if (!email) return null;
    return getUsers().find(u => u.email === email) || null;
  }
  function isLoggedIn() {
    return !!getCurrentEmail();
  }
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return "h_" + Math.abs(hash).toString(36);
  }

  // ============================================================
  // РЕГИСТРАЦИЯ / ВХОД / ВЫХОД
  // ============================================================

  function register(name, email, password) {
    if (!name || !email || !password) return { ok: false, error: "Заполните все поля" };
    if (!email.includes("@") || !email.includes(".")) return { ok: false, error: "Введите корректный email" };
    if (password.length < 4) return { ok: false, error: "Пароль слишком короткий (минимум 4 символа)" };

    const users = getUsers();
    if (users.find(u => u.email === email.trim().toLowerCase())) {
      return { ok: false, error: "Пользователь с таким email уже существует" };
    }

    const newUser = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passHash: simpleHash(password),
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    saveUsers(users);
    localStorage.setItem(STORAGE_KEYS.CURRENT, newUser.email);
    return { ok: true, user: newUser };
  }

  function login(email, password) {
    if (!email || !password) return { ok: false, error: "Заполните все поля" };
    const users = getUsers();
    const user = users.find(u => u.email === email.trim().toLowerCase());
    if (!user) return { ok: false, error: "Пользователь не найден" };
    if (user.passHash !== simpleHash(password)) return { ok: false, error: "Неверный пароль" };
    localStorage.setItem(STORAGE_KEYS.CURRENT, user.email);
    return { ok: true, user };
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT);
  }

  // ============================================================
  // СОХРАНЁННЫЕ УНИВЕРСИТЕТЫ
  // ============================================================

  function getSavedKey() {
    const email = getCurrentEmail();
    return email ? STORAGE_KEYS.SAVED + email : null;
  }
  function getSaved() {
    const key = getSavedKey();
    if (!key) return [];
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch(e) { return []; }
  }
  function isSaved(uniName) {
    return getSaved().some(u => u.name === uniName);
  }
  function toggleSave(uni) {
    if (!getCurrentEmail()) return { ok: false, error: "Не вошёл" };
    const key = getSavedKey();
    const saved = getSaved();
    const idx = saved.findIndex(u => u.name === uni.name);
    if (idx >= 0) {
      saved.splice(idx, 1);
      localStorage.setItem(key, JSON.stringify(saved));
      return { ok: true, removed: true };
    } else {
      saved.push({
        name: uni.name,
        country: uni.country || "",
        city: uni.city || "",
        savedAt: new Date().toISOString()
      });
      localStorage.setItem(key, JSON.stringify(saved));
      return { ok: true, added: true };
    }
  }

  // ============================================================
  // РЕЗУЛЬТАТЫ ТЕСТА
  // ============================================================

  function getTestsKey() {
    const email = getCurrentEmail();
    return email ? STORAGE_KEYS.TESTS + email : null;
  }
  function getTests() {
    const key = getTestsKey();
    if (!key) return [];
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch(e) { return []; }
  }
  function saveTestResult(finalData) {
    if (!getCurrentEmail()) return { ok: false, error: "Не вошёл" };
    const key = getTestsKey();
    const tests = getTests();
    tests.unshift({
      date: new Date().toISOString(),
      categories: finalData.categories || {},
      summary: finalData.summary || ""
    });
    localStorage.setItem(key, JSON.stringify(tests));
    return { ok: true };
  }

  // ============================================================
  // TOAST-УВЕДОМЛЕНИЯ
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
    }, 2200);
  }

  // ============================================================
  // МОДАЛЬНОЕ ОКНО ВХОДА/РЕГИСТРАЦИИ
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
            <input type="password" id="edupathPassword" placeholder="Минимум 4 символа">
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
        .edupath-error { font-size: 13px; color: #B84A3A; min-height: 18px; margin-bottom: 12px; }
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

  // Обработчики модалки
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

  // Отправка формы
  document.addEventListener("submit", (e) => {
    if (e.target.id !== "edupathAuthForm") return;
    e.preventDefault();
    const errEl = document.getElementById("edupathAuthError");
    const submitBtn = document.getElementById("edupathSubmitBtn");
    errEl.textContent = "";
    submitBtn.disabled = true;

    const name = document.getElementById("edupathName").value.trim();
    const email = document.getElementById("edupathEmail").value.trim();
    const password = document.getElementById("edupathPassword").value;

    let result;
    if (modalMode === "register") {
      result = register(name, email, password);
    } else {
      result = login(email, password);
    }
    submitBtn.disabled = false;

    if (!result.ok) { errEl.textContent = result.error; return; }

    closeModal();
    showToast(
      modalMode === "register" ? "Аккаунт создан. Привет, " + result.user.name + "!" :
      "С возвращением, " + result.user.name + "!", "success"
    );
    updateHeaderUI();
    if (window.location.pathname.includes("profile")) {
      window.location.reload();
    }
  });

  // ============================================================
  // ОБНОВЛЕНИЕ ШАПКИ
  // ============================================================

  function updateHeaderUI() {
    const user = getCurrentUser();
    const loginBtn = document.querySelector(".btn-login");
    if (!loginBtn) return;
    if (user) {
      loginBtn.textContent = "Привет, " + user.name.split(" ")[0];
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

  document.addEventListener("DOMContentLoaded", updateHeaderUI);

  // ЭКСПОРТ
  window.EduAuth = {
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
