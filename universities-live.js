(() => {
  "use strict";
  const SEARCH_API = "https://edupath-university-search.muqiyatalkar.workers.dev";
  const $ = id => document.getElementById(id);
  let visibleUniversities = [], selectedMode = "name", selectedUniversity = null, controller = null;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const safeUrl = value => { try { const u = new URL(value); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
  const nameOf = u => u?.name || "University";
  const status = (message, error = false) => { $("statusLine").textContent = message || ""; $("statusLine").classList.toggle("error-text", error); };
  const busy = value => { $("searchBtn").disabled = value; $("searchBtn").setAttribute("aria-busy", String(value)); };

  async function api(path, options = {}) {
    const res = await fetch(SEARCH_API + path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Ошибка сервера: ${res.status}`);
    return data;
  }

  function parseDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
    const d = new Date(date + "T23:59:59");
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function deadlineClass(deadlines) {
    const upcoming = (deadlines || []).map(x => parseDate(x.date)).filter(d => d && d >= new Date()).sort((a,b) => a-b)[0];
    if (!upcoming) return "";
    const days = Math.ceil((upcoming - new Date()) / 86400000);
    return days <= 30 ? "red" : days <= 90 ? "yellow" : "green";
  }
  function cardDeadline(uni) {
    const dates = uni?.application?.deadlines || uni?.deadlines || [];
    const d = dates.find(x => x.date);
    return d?.display || d?.date || "Дедлайн уточняется";
  }

  function renderCards(items) {
    const track = $("cardsTrack"); track.innerHTML = "";
    if (!items.length) { track.innerHTML = '<div class="empty-state">Не удалось получить подтверждённые университеты. Попробуй обновить каталог или изменить запрос.</div>'; return; }
    for (const uni of items) {
      const card = document.createElement("button"); card.type = "button";
      card.className = "uni-card" + (selectedUniversity && nameOf(selectedUniversity).toLowerCase() === nameOf(uni).toLowerCase() ? " selected" : "");
      const country = uni.country || "Страна уточняется", city = uni.city || "Город уточняется";
      card.innerHTML = `<div class="card-top"><span class="country-pill">${esc(country)}</span><span class="deadline-dot ${deadlineClass(uni.application?.deadlines || uni.deadlines)}" title="Цвет показывает только подтверждённую дату"></span></div><h3>${esc(nameOf(uni))}</h3><div class="card-location">📍 ${esc(city)}</div><div class="card-reason">${esc(uni.reason || "Открой досье, чтобы изучить университет")}</div><div class="card-foot"><span>${esc(uni.matchType === "seed" ? "Исходный университет" : uni.rankLabel || "Рекомендация EduPath")}</span><span>Открыть ↗</span></div>`;
      card.addEventListener("click", () => openUniversity(uni)); track.appendChild(card);
    }
  }

  function valueText(value) {
    if (value === null || value === undefined || value === "") return "Нет подтверждённых данных";
    if (typeof value === "object") return value.display || value.value || JSON.stringify(value);
    return String(value);
  }
  function box(label, value) {
    const text = valueText(value), missing = text === "Нет подтверждённых данных";
    return `<div class="info-box"><small>${esc(label)}</small><strong class="${missing ? "unknown" : ""}">${esc(text)}</strong></div>`;
  }
  function list(items, empty = "Нет подтверждённых сведений.") {
    if (!Array.isArray(items) || !items.length) return `<p class="muted">${esc(empty)}</p>`;
    return `<ul class="plain-list">${items.map(item => {
      if (typeof item === "string") return `<li>${esc(item)}</li>`;
      if (!item) return "";
      const label = [item.name, item.value, item.program ? `(${item.program})` : "", item.notes].filter(Boolean).join(" — ");
      return `<li>${esc(label || item.text || "")}${safeUrl(item.sourceUrl) ? ` · <a class="source-link" href="${esc(safeUrl(item.sourceUrl))}" target="_blank" rel="noopener noreferrer">Источник</a>` : ""}</li>`;
    }).join("")}</ul>`;
  }
  function subCards(items, render) {
    if (!Array.isArray(items) || !items.length) return '<p class="muted">Нет подтверждённых сведений.</p>';
    return `<div class="sub-list">${items.map(render).join("")}</div>`;
  }
  function linkButton(label, url) {
    const href = safeUrl(url); return href ? `<a class="action-btn" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : "";
  }

  async function openUniversity(uni) {
    selectedUniversity = uni; renderCards(visibleUniversities);
    $("emptyState").style.display = "none";
    $("detailContent").innerHTML = '<div class="loading-panel">Собираем досье из актуальных источников: поступление, финансы, город и страна…</div>';
    $("detailShell").scrollIntoView({ behavior: "smooth", block: "start" });
    if (controller) controller.abort(); controller = new AbortController();
    try {
      const data = await api("/details", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ name: nameOf(uni), city: uni.city || "", country: uni.country || "", sourceUrl: uni.sourceUrl || "", refresh: true })
      });
      renderDetails(data.university || {}, uni);
    } catch (error) {
      if (error.name !== "AbortError") $("detailContent").innerHTML = `<div class="loading-panel error-text">${esc(error.message)}</div>`;
    }
  }

  function renderDetails(d, fallback) {
    const n = d.name || nameOf(fallback), city = d.location?.city || d.city || fallback.city || "", country = d.location?.country || d.country || fallback.country || "";
    const loc = d.location || {}, app = d.application || {}, fin = d.financial || {}, cityFacts = d.cityFacts || {}, countryFacts = d.countryFacts || {}, links = d.links || {}, academic = d.academic || {};
    const mapQuery = encodeURIComponent([loc.campusAddress, n, city, country].filter(Boolean).join(", "));
    const mapSrc = `https://www.google.com/maps?q=${mapQuery}&output=embed`;
    const photos = (d.photos || []).map(safeUrl).filter(Boolean).slice(0, 6);
    const sources = (d.sources || []).filter(s => safeUrl(s.url));
    const checked = d.lastChecked ? new Date(d.lastChecked).toLocaleString() : "Неизвестно";
    const req = d.admissionRequirements || [];
    const deadlines = app.deadlines || [];
    const linksHtml = [
      linkButton("Официальный сайт", links.officialWebsite), linkButton("Приёмная комиссия", links.admissions),
      linkButton("Подача заявления", links.application || app.portalUrl), linkButton("Стипендии", links.scholarships),
      linkButton("Финансовая помощь", links.financialAid || fin.financialAidUrl), linkButton("Общежитие", links.accommodation),
      linkButton("Иностранным студентам", links.internationalStudents || app.internationalAdmissionsUrl)
    ].filter(Boolean).join("");
    $("detailContent").innerHTML = `<article class="detail-card">
      <header class="detail-head"><div class="eyebrow">University dossier · проверено ${esc(checked)}</div><h2>${esc(n)}</h2><div class="detail-location">📍 ${esc([loc.campusAddress, city, country].filter(Boolean).join(" · ") || "Местоположение уточняется")}</div>
      <div class="detail-meta"><span class="meta-chip">Требований найдено: ${req.length}</span><span class="meta-chip">Дедлайнов: ${deadlines.length}</span><span class="meta-chip">Источников: ${sources.length}</span></div>
      <div class="detail-actions">${linksHtml}<button class="action-btn" id="saveUniBtn" type="button">☆ Сохранить в избранное</button></div></header>
      <div class="detail-grid"><div>
        <section class="detail-section"><h3>1. Условия поступления</h3>${req.length ? subCards(req, x => `<div class="sub-card"><strong>${esc(x.name || "Требование")}: ${esc(x.value || "Уточняется")}</strong>${x.program ? `Программа: ${esc(x.program)}. ` : ""}${x.applicantType ? `Абитуриент: ${esc(x.applicantType)}. ` : ""}${x.notes ? esc(x.notes) : ""}${safeUrl(x.sourceUrl) ? `<div><a class="source-link" href="${esc(safeUrl(x.sourceUrl))}" target="_blank" rel="noopener noreferrer">Открыть источник ↗</a></div>` : ""}</div>`) : '<p class="muted">Требования пока не удалось подтвердить. Это не означает, что экзамены не требуются.</p>'}</section>
        <section class="detail-section"><h3>2. Тип подачи и дедлайны</h3><div class="info-grid">${box("Тип подачи", app.type)}${box("Стоимость заявки", app.applicationFee)}</div>${subCards(deadlines, x => `<div class="sub-card"><strong>${esc(x.label || "Дедлайн")}: ${esc(x.display || x.date || "Дата не подтверждена")}</strong>${[x.program, x.intake, x.applicantType].filter(Boolean).map(esc).join(" · ")}${safeUrl(x.sourceUrl) ? `<div><a class="source-link" href="${esc(safeUrl(x.sourceUrl))}" target="_blank" rel="noopener noreferrer">Источник ↗</a></div>` : ""}</div>`)}</section>
        <section class="detail-section"><h3>3. Финансы и стипендии</h3><div class="info-grid">${box("Обучение", fin.tuition)}${box("Валюта", fin.currency)}${box("Проживание", fin.accommodation)}${box("Расходы на жизнь", fin.livingExpenses)}</div>${subCards(fin.scholarships, x => `<div class="sub-card"><strong>${esc(x.name || "Стипендия")}</strong>${[x.value, x.eligibility, x.deadline].filter(Boolean).map(esc).join(" · ")}${safeUrl(x.sourceUrl) ? `<div><a class="source-link" href="${esc(safeUrl(x.sourceUrl))}" target="_blank" rel="noopener noreferrer">Источник ↗</a></div>` : ""}</div>`)}</section>
        <section class="detail-section"><h3>4. Жизнь в городе</h3><div class="info-grid">${box("Климат", cityFacts.climate)}${box("Стоимость жизни", cityFacts.livingCost)}${box("Безопасность", cityFacts.safety)}${box("Статистика преступности", cityFacts.crimeStatistics)}${box("Транспорт", cityFacts.transport)}${box("Студенческая жизнь", cityFacts.studentLife)}</div></section>
        <section class="detail-section"><h3>5. Жизнь в стране</h3><div class="info-grid">${box("Климат", countryFacts.climate)}${box("Безопасность", countryFacts.safety)}${box("Здравоохранение", countryFacts.healthcare)}${box("Работа студентов", countryFacts.studentWork)}${box("Визовые особенности", countryFacts.visaNotes)}</div></section>
        <section class="detail-section"><h3>6. Академическая среда</h3><strong>Сильные направления</strong>${list(academic.strongFields)}<strong>Особенности университета</strong>${list(academic.highlights)}</section>
      </div><aside>
        <section class="detail-section"><h3>7. Местоположение и Google Maps</h3><iframe class="map-frame" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${mapSrc}" title="Карта университета"></iframe>${loc.campusAddress ? `<p class="muted">${esc(loc.campusAddress)}</p>` : ""}</section>
        <section class="detail-section"><h3>8. Изображения</h3>${photos.length ? `<div class="photo-grid">${photos.map((url,i)=>`<img src="${esc(url)}" alt="Изображение кампуса ${i+1}" loading="lazy" referrerpolicy="no-referrer">`).join("")}</div>` : '<p class="muted">Изображения не найдены в результатах источников.</p>'}</section>
        <section class="detail-section"><h3>9. Источники</h3><div class="sources">${sources.length ? sources.map((s,i)=>`<a class="source-link" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">[${i+1}] ${esc(s.title || s.url)} ↗</a>`).join("") : '<span class="muted">Источники не получены.</span>'}</div></section>
      </aside></div><div class="disclaimer">${esc(d.disclaimer || "Справка собрана автоматически. Все требования и даты перепроверяй на официальном сайте выбранной программы.")}${d.notes ? ` Примечание: ${esc(d.notes)}` : ""}</div></article>`;
    const save = $("saveUniBtn");
    if (save) {
      const auth = window.EduAuth;
      let saved = !!auth?.isSaved?.(n); save.textContent = saved ? "★ В избранном" : "☆ Сохранить в избранное";
      save.addEventListener("click", async () => {
        if (!auth?.isLoggedIn?.()) { auth?.showToast?.("Войди в аккаунт, чтобы сохранять университеты", "info"); auth?.openModal?.("login"); return; }
        const result = await auth.toggleSave({ name: n, country, city });
        if (result?.ok) { saved = result.added ?? !saved; save.textContent = saved ? "★ В избранном" : "☆ Сохранить в избранное"; auth.showToast?.(saved ? "Университет сохранён" : "Университет удалён из избранного", "success"); }
        else auth?.showToast?.(result?.error || "Не удалось сохранить", "error");
      });
    }
  }

  function collectFilters() {
    const split = id => $(id).value.split(",").map(x => x.trim()).filter(Boolean);
    return {
      field: $("filterField").value.trim(), countries: split("filterCountries"), degree: $("filterDegree").value,
      budgetMax: $("filterBudget").value ? Number($("filterBudget").value) : null, currency: $("filterCurrency").value,
      intake: $("filterIntake").value.trim(), language: $("filterLanguage").value.trim(), funding: $("filterFunding").value,
      exams: split("filterExams"), extra: $("filterExtra").value.trim()
    };
  }
  function clearFilters() { ["filterField","filterCountries","filterBudget","filterIntake","filterLanguage","filterExams","filterExtra"].forEach(id => $(id).value = ""); ["filterDegree","filterFunding"].forEach(id => $(id).value = ""); $("filterCurrency").value = "USD"; }

  async function search(useFilters = selectedMode === "criteria") {
    const query = $("searchInput").value.trim(), filters = useFilters ? collectFilters() : {};
    if (useFilters && !Object.entries(filters).some(([key, v]) => key !== "currency" && (Array.isArray(v) ? v.length > 0 : v !== null && v !== ""))) { status("Заполни хотя бы одно поле фильтра.", true); return; }
    if (!useFilters && query.length < 3) { status("Введи не менее трёх символов.", true); return; }
    if (controller) controller.abort(); controller = new AbortController(); busy(true);
    status(useFilters ? "Подбираем университеты по структурированным условиям…" : "Изучаем университет и ищем гибкие альтернативы…");
    try {
      const payload = await api("/search", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ query, mode: useFilters ? "criteria" : "name", filters, limit: 20, refresh: true }) });
      visibleUniversities = (payload.candidates || []).map(x => ({ ...x })); selectedUniversity = null;
      $("cardsHeading").textContent = useFilters ? "Подборка по твоим условиям" : "Похожие университеты";
      $("cardsSubheading").textContent = `Получено ${payload.actualCount || visibleUniversities.length} из 20 возможных · ${payload.sourcesCount || 0} веб-источников · ${new Date(payload.lastChecked || Date.now()).toLocaleString()}`;
      renderCards(visibleUniversities); $("detailContent").innerHTML = ""; $("emptyState").style.display = "block";
      status(visibleUniversities.length ? `Найдено университетов: ${visibleUniversities.length}.` : "Не удалось подтвердить подходящие университеты. Попробуй изменить условия.", !visibleUniversities.length);
    } catch (error) { if (error.name !== "AbortError") status(error.message, true); }
    finally { busy(false); }
  }

  async function loadCatalog(refresh = false) {
    $("cardsTrack").innerHTML = '<div class="loading-panel">Ищем актуальные университеты в мировых рейтингах и официальных источниках…</div>';
    try {
      const data = await api("/catalog" + (refresh ? "?refresh=1" : ""));
      visibleUniversities = data.universities || []; selectedUniversity = null; renderCards(visibleUniversities);
      $("cardsHeading").textContent = "50 университетов для изучения";
      $("cardsSubheading").textContent = `Динамическая подборка · ${data.count || visibleUniversities.length} подтверждённых записей · проверено ${new Date(data.lastChecked || Date.now()).toLocaleString()}`;
      status(data.disclaimer || "Каталог загружен.");
    } catch (error) {
      $("cardsTrack").innerHTML = `<div class="loading-panel error-text">${esc(error.message)}<p class="muted">Проверь Worker, AI, Tavily и KV bindings.</p></div>`;
    }
  }

  function setMode(mode) {
    selectedMode = mode === "criteria" ? "criteria" : "name";
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === selectedMode));
    $("filterPanel").classList.toggle("open", selectedMode === "criteria");
    $("searchInput").style.display = selectedMode === "criteria" ? "none" : "block";
    $("searchBtn").style.display = selectedMode === "criteria" ? "none" : "block";
    $("searchHint").textContent = selectedMode === "name" ? "Введи название университета. EduPath изучит его профиль и подберёт до 19 гибких альтернатив." : "Заполни настоящие поля фильтра. Можно указать только те условия, которые для тебя важны.";
  }
  function init() {
    if (!$("cardsTrack") || !$("searchBtn")) return;
    window.EduAuth?.getSaved?.().catch?.(() => {});
    document.querySelectorAll(".mode-btn").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
    $("searchBtn").addEventListener("click", () => search(false));
    $("searchInput").addEventListener("keydown", e => { if (e.key === "Enter") search(false); });
    $("applyFiltersBtn").addEventListener("click", () => search(true));
    $("clearFiltersBtn").addEventListener("click", clearFilters);
    $("refreshCatalogBtn").addEventListener("click", () => loadCatalog(true));
    setMode("name"); loadCatalog(false);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
