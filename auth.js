
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

  document.addEventListener("DOMContentLoaded", () => {
  setTimeout(updateHeaderUI, 0);
  if (isLoggedIn()) {
    getSaved().catch(e => console.warn("preload saved failed:", e));
    getTests().catch(e => console.warn("preload tests failed:", e));
  }
});

// Реакция на смену языка — обновить шапку
window.addEventListener("edupath-lang-change", () => {
  updateHeaderUI();
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



