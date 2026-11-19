(() => {
  "use strict";
  const SEARCH_API = "https://edupath-university-search.muqiyatalkar.workers.dev";
  const $ = id => document.getElementById(id);
  const MATCH_LABEL = { close: "Близкий аналог", accessible: "Доступнее", value: "Выгодно по цене", funding: "Сильные стипендии", academic: "Академически близок" };
  const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const nf = new Intl.NumberFormat("ru-RU");

  let visibleUniversities = [], selectedMode = "name", selectedUniversity = null;
  let detailCtl = null, similarCtl = null, suggestCtl = null, suggestTimer = null, suggestItems = [], activeIdx = -1;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const safeUrl = value => { try { const u = new URL(value); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
  const nameOf = u => u?.name || "University";
  const keyOf = u => (u?.id || nameOf(u)).toLowerCase();
  const place = u => [u?.city, u?.country].filter(Boolean).join(", ");
  const status = (message, error = false) => { $("statusLine").textContent = message || ""; $("statusLine").classList.toggle("error-text", error); };
  const busy = value => { $("searchBtn").disabled = value; $("searchBtn").setAttribute("aria-busy", String(value)); };

  async function api(path, options = {}) {
    const res = await fetch(SEARCH_API + path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Ошибка сервера: ${res.status}`);
    return data;
  }

  /* ---------- дедлайны (цветная точка) ---------- */
  function parseDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
    const d = new Date(date + "T23:59:59");
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function deadlineClass(deadlines) {
    const upcoming = (deadlines || []).map(x => parseDate(x.date)).filter(d => d && d >= new Date()).sort((a, b) => a - b)[0];
    if (!upcoming) return "";
    const days = Math.ceil((upcoming - new Date()) / 86400000);
    return days <= 30 ? "red" : days <= 90 ? "yellow" : "green";
  }

  /* ---------- карточки (каталог, результаты поиска, похожие) ---------- */
  function renderCards(items, track = $("cardsTrack"), opts = {}) {
    track.innerHTML = "";
    if (!items.length) { track.innerHTML = `<div class="empty-state">${esc(opts.empty || "Ничего не найдено. Попробуй изменить запрос.")}</div>`; return; }
    for (const uni of items) {
      const card = document.createElement("article");
      card.tabIndex = 0; card.setAttribute("role", "button"); card.dataset.key = keyOf(uni);
      card.className = "uni-card result-card" + (selectedUniversity && keyOf(selectedUniversity) === keyOf(uni) ? " selected" : "");
      const site = safeUrl(uni.website);
      const siteHtml = site
        ? `<a class="result-link" href="${esc(site)}" target="_blank" rel="noopener noreferrer">Официальный сайт: ${esc(uni.domain || new URL(site).hostname)} ↗</a>`
        : '<span class="result-link missing">Официальный сайт не найден</span>';
      const reason = opts.showSite ? siteHtml : esc(uni.reason || "Открой досье, чтобы изучить университет");
      const foot = opts.showSite ? "" : `<span>${site ? siteHtml : esc(uni.rankLabel || "")}</span>`;
      card.innerHTML = `<div class="card-top"><span class="country-pill">${esc(uni.country || "Страна уточняется")}</span><span class="deadline-dot ${deadlineClass(uni.application?.deadlines || uni.deadlines)}" title="Цвет показывает только подтверждённую дату"></span></div>
        <h3>${esc(nameOf(uni))}</h3><div class="card-location">📍 ${esc(uni.city || "Город уточняется")}</div>
        <div class="card-reason">${reason}</div>
        ${opts.showMatch && uni.matchType ? `<span class="match-chip">${esc(MATCH_LABEL[uni.matchType] || "Рекомендация")}</span>` : ""}
        <div class="card-foot">${foot || "<span></span>"}<span>Открыть досье ↗</span></div>`;
      card.querySelectorAll("a").forEach(a => a.addEventListener("click", e => e.stopPropagation()));
      const open = () => openUniversity(uni, { keepSimilar: !!opts.keepSimilar });
      card.addEventListener("click", open);
      card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      track.appendChild(card);
    }
  }
  function highlightSelected() {
    document.querySelectorAll(".uni-card").forEach(c => c.classList.toggle("selected", !!selectedUniversity && c.dataset.key === keyOf(selectedUniversity)));
  }

  /* ---------- подсказки поиска ---------- */
  function closeSuggest() { $("suggestBox").hidden = true; $("searchInput").setAttribute("aria-expanded", "false"); activeIdx = -1; }
  function renderSuggest(items, query) {
    const box = $("suggestBox"); suggestItems = items; activeIdx = -1;
    if (!items.length) { box.innerHTML = `<div class="suggest-empty">Не нашли «${esc(query)}». Попробуй официальное английское название.</div>`; }
    else {
      box.innerHTML = items.map((u, i) => `<div class="suggest-item" role="option" data-i="${i}"><strong>${esc(nameOf(u))}</strong><span>${esc(place(u) || "место не указано")}${u.domain ? " · " + esc(u.domain) : ""}</span></div>`).join("");
      box.querySelectorAll(".suggest-item").forEach(el => el.addEventListener("mousedown", e => { e.preventDefault(); chooseUniversity(suggestItems[Number(el.dataset.i)]); }));
    }
    box.hidden = false; $("searchInput").setAttribute("aria-expanded", "true");
  }
  function moveActive(delta) {
    const els = [...$("suggestBox").querySelectorAll(".suggest-item")]; if (!els.length) return;
    activeIdx = (activeIdx + delta + els.length) % els.length;
    els.forEach((el, i) => el.classList.toggle("active", i === activeIdx));
    els[activeIdx].scrollIntoView({ block: "nearest" });
  }
  function onType() {
    clearTimeout(suggestTimer);
    const q = $("searchInput").value.trim();
    if (selectedMode !== "name" || q.length < 2) { closeSuggest(); return; }
    suggestTimer = setTimeout(async () => {
      if (suggestCtl) suggestCtl.abort(); suggestCtl = new AbortController();
      try {
        const data = await api("/suggest?q=" + encodeURIComponent(q), { signal: suggestCtl.signal });
        if ($("searchInput").value.trim() === q) renderSuggest(data.results || [], q);
      } catch (e) { if (e.name !== "AbortError") closeSuggest(); }
    }, 280);
  }

  /* ---------- поиск: только университет и его официальная ссылка ---------- */
  function showResults(results, query) {
    selectedUniversity = null; visibleUniversities = results;
    $("cardsHeading").textContent = results.length === 1 ? "Результат поиска" : "Результаты поиска";
    $("cardsSubheading").textContent = `По запросу «${query}» · только университеты и их официальные сайты · источник: реестр ROR`;
    renderCards(results, $("cardsTrack"), { showSite: true, empty: "Такой университет не найден. Попробуй официальное английское название." });
  }
  function resetView() {
    $("detailContent").innerHTML = ""; $("emptyState").style.display = "block";
    $("similarSection").hidden = true; $("similarTrack").innerHTML = "";
  }
  async function chooseUniversity(uni) {
    if (!uni) return;
    clearTimeout(suggestTimer); closeSuggest();
    $("searchInput").value = nameOf(uni);
    showResults([uni], nameOf(uni)); status("");
    await openUniversity(uni);
  }
  async function searchByName(autoOpenFirst = false) {
    clearTimeout(suggestTimer); closeSuggest();
    const query = $("searchInput").value.trim();
    if (query.length < 2) { status("Введи не менее двух символов.", true); return; }
    if (suggestCtl) suggestCtl.abort(); suggestCtl = new AbortController(); busy(true); status("Ищем университет…");
    try {
      const data = await api("/suggest?q=" + encodeURIComponent(query), { signal: suggestCtl.signal });
      const results = data.results || [];
      resetView(); showResults(results, query);
      status(results.length ? `Найдено: ${results.length}.` : "Университет не найден.", !results.length);
      if (results.length && (autoOpenFirst || results.length === 1)) await openUniversity(results[0]);
    } catch (e) { if (e.name !== "AbortError") status(e.message, true); }
    finally { busy(false); }
  }

  /* ---------- 19 похожих ---------- */
  async function loadSimilar(uni) {
    const section = $("similarSection"), track = $("similarTrack");
    section.hidden = false;
    $("similarHeading").textContent = `Похожие на «${nameOf(uni)}»`;
    $("similarSub").textContent = "Подбираем 19 университетов и проверяем каждый по реестру. Это занимает до минуты…";
    track.innerHTML = '<div class="loading-panel">Ищем похожие университеты…</div>';
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    if (similarCtl) similarCtl.abort(); similarCtl = new AbortController();
    try {
      const data = await api("/similar", { method: "POST", headers: { "Content-Type": "application/json" }, signal: similarCtl.signal,
        body: JSON.stringify({ id: uni.id || "", name: nameOf(uni), city: uni.city || "", country: uni.country || "" }) });
      const list = data.candidates || [];
      $("similarSub").textContent = `Найдено ${list.length} из 19 · каждый вуз подтверждён реестром ROR · ${new Date(data.lastChecked || Date.now()).toLocaleString()}`;
      renderCards(list, track, { showMatch: true, keepSimilar: true, empty: "Не удалось подобрать подтверждённые университеты. Попробуй позже." });
    } catch (e) { if (e.name !== "AbortError") { track.innerHTML = `<div class="loading-panel error-text">${esc(e.message)}</div>`; $("similarSub").textContent = ""; } }
  }

  /* ---------- досье ---------- */
  const valueText = value => {
    if (value === null || value === undefined || value === "") return "Нет подтверждённых данных";
    if (typeof value === "object") return value.display || value.value || JSON.stringify(value);
    return String(value);
  };
  function box(label, value) {
    const text = valueText(value), missing = text === "Нет подтверждённых данных";
    return `<div class="info-box"><small>${esc(label)}</small><strong class="${missing ? "unknown" : ""}">${esc(text)}</strong></div>`;
  }
  function list(items, empty = "Нет подтверждённых сведений.") {
    if (!Array.isArray(items) || !items.length) return `<p class="muted">${esc(empty)}</p>`;
    return `<ul class="plain-list">${items.map(item => `<li>${esc(typeof item === "string" ? item : (item?.text || ""))}</li>`).join("")}</ul>`;
  }
  const subCards = (items, render) => (!Array.isArray(items) || !items.length) ? '<p class="muted">Нет подтверждённых сведений.</p>' : `<div class="sub-list">${items.map(render).join("")}</div>`;
  const srcLink = (url, label = "Источник") => safeUrl(url) ? `<div><a class="source-link" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a></div>` : "";
  const linkButton = (label, url) => { const h = safeUrl(url); return h ? `<a class="action-btn" href="${esc(h)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : ""; };
  const num = (v, suffix = "") => v && Number.isFinite(v.value) ? `${nf.format(v.value)}${suffix} (${v.year})` : null;

  function climateHtml(c) {
    if (!c?.months?.length) return "";
    const temps = c.months.map(m => m.t), lo = Math.min(...temps), hi = Math.max(...temps), span = Math.max(hi - lo, 1);
    const bars = c.months.map(m => {
      const h = 18 + Math.round(((m.t - lo) / span) * 82);
      return `<div class="mbar ${m.t < 5 ? "cold" : ""}" title="${MONTHS[m.m - 1]}: ${m.t} °C, осадки ${m.p} мм"><small>${Math.round(m.t)}°</small><i style="height:${h}%"></i><b>${MONTHS[m.m - 1]}</b></div>`;
    }).join("");
    return `<div class="month-bars" aria-label="Средняя температура по месяцам">${bars}</div><p class="muted">Средняя температура по месяцам, ${esc(c.year)} г. Источник: <a class="source-link" href="${esc(safeUrl(c.source?.url))}" target="_blank" rel="noopener noreferrer">${esc(c.source?.name || "Open-Meteo")}</a>.</p>`;
  }

  async function openUniversity(uni, { keepSimilar = false, refresh = false } = {}) {
    selectedUniversity = uni; highlightSelected();
    if (!keepSimilar) { $("similarSection").hidden = true; $("similarTrack").innerHTML = ""; }
    $("emptyState").style.display = "none";
    $("detailContent").innerHTML = '<div class="loading-panel">Собираем досье: официальный сайт вуза, город, страна, карта, фото… Это занимает до минуты.</div>';
    $("detailShell").scrollIntoView({ behavior: "smooth", block: "start" });
    if (detailCtl) detailCtl.abort(); detailCtl = new AbortController();
    try {
      const data = await api("/details", { method: "POST", headers: { "Content-Type": "application/json" }, signal: detailCtl.signal,
        body: JSON.stringify({ id: uni.id || "", name: nameOf(uni), city: uni.city || "", country: uni.country || "", refresh }) });
      renderDetails(data.university || {}, uni);
    } catch (error) {
      if (error.name !== "AbortError") $("detailContent").innerHTML = `<div class="loading-panel error-text">${esc(error.message)}</div>`;
    }
  }

  function renderDetails(d, fallback) {
    const n = d.name || nameOf(fallback), city = d.city || fallback.city || "", country = d.country || fallback.country || "";
    const loc = d.location || {}, app = d.application || {}, fin = d.financial || {}, cityFacts = d.cityFacts || {}, countryFacts = d.countryFacts || {};
    const stats = d.countryStats || {}, links = d.links || {}, academic = d.academic || {};
    const hasCoords = Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude);
    const mapQuery = hasCoords ? `${loc.latitude},${loc.longitude}` : encodeURIComponent([loc.campusAddress, n, city, country].filter(Boolean).join(", "));
    const mapSrc = hasCoords ? `https://www.google.com/maps?q=${mapQuery}&z=14&output=embed` : `https://www.google.com/maps?q=${mapQuery}&output=embed`;
    const mapLink = hasCoords ? `https://www.google.com/maps/search/?api=1&query=${mapQuery}` : `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
    const photos = (d.photos || []).filter(p => safeUrl(p.url)).slice(0, 8);
    const sources = (d.sources || []).filter(s => safeUrl(s.url));
    const checked = d.lastChecked ? new Date(d.lastChecked).toLocaleString() : "Неизвестно";
    const req = d.admissionRequirements || [], deadlines = app.deadlines || [];
    const linksHtml = [
      linkButton("Официальный сайт", links.officialWebsite), linkButton("Приёмная комиссия", links.admissions),
      linkButton("Подача заявления", links.application), linkButton("Иностранным студентам", links.internationalStudents),
      linkButton("Финансовая помощь", links.financialAid), linkButton("Стипендии", links.scholarships), linkButton("Общежитие", links.accommodation)
    ].filter(Boolean).join("");
    const statBoxes = [
      box("Столица", stats.capital), box("Регион", stats.region), box("Языки", (stats.languages || []).join(", ")), box("Валюта", (stats.currencies || []).join(", ")),
      box("Население", stats.population ? nf.format(stats.population) : null), box("Убийств на 100 тыс. человек", num(stats.homicideRate)),
      box("ВВП на душу (по ППС, $)", num(stats.gdpPpp)), box("Ожидаемая продолжительность жизни", num(stats.lifeExpectancy, " лет")), box("Инфляция за год", num(stats.inflation, " %"))
    ].join("");

    $("detailContent").innerHTML = `<article class="detail-card">
      <header class="detail-head"><div class="eyebrow">University dossier · проверено ${esc(checked)}</div><h2>${esc(n)}</h2>
      <div class="detail-location">📍 ${esc([loc.campusAddress, city, country].filter(Boolean).join(" · ") || "Местоположение уточняется")}</div>
      <div class="detail-meta"><span class="meta-chip">Требований найдено: ${req.length}</span><span class="meta-chip">Дедлайнов: ${deadlines.length}</span><span class="meta-chip">Источников: ${sources.length}</span><span class="meta-chip">Фото: ${photos.length}</span></div>
      <div class="detail-actions">${linksHtml}<button class="action-btn accent" id="similarBtn" type="button">Найти 19 похожих ↓</button><button class="action-btn" id="saveUniBtn" type="button">☆ Сохранить в избранное</button><button class="action-btn" id="refreshUniBtn" type="button" title="Заново прочитать официальный сайт">↻ Обновить данные</button></div></header>
      <div class="detail-grid"><div>
        ${d.about?.text ? `<p class="about-text">${esc(d.about.text)} ${safeUrl(d.about.url) ? `<a class="source-link" href="${esc(safeUrl(d.about.url))}" target="_blank" rel="noopener noreferrer">Википедия ↗</a>` : ""}</p>` : ""}
        <section class="detail-section"><h3>1. Условия поступления</h3>${req.length ? subCards(req, x => `<div class="sub-card"><strong>${esc(x.name || "Требование")}: ${esc(x.value || "Уточняется")}</strong>${x.program ? `Программа: ${esc(x.program)}. ` : ""}${x.applicantType ? `Абитуриент: ${esc(x.applicantType)}. ` : ""}${x.notes ? esc(x.notes) : ""}${srcLink(x.sourceUrl, "Открыть источник")}</div>`) : '<p class="muted">Требования пока не удалось подтвердить на официальном сайте. Это не означает, что экзамены не требуются.</p>'}</section>
        <section class="detail-section"><h3>2. Тип подачи и дедлайны</h3><div class="info-grid">${box("Тип подачи", app.type)}${box("Стоимость заявки", app.applicationFee)}</div>${subCards(deadlines, x => `<div class="sub-card"><strong>${esc(x.label || "Дедлайн")}: ${esc(x.display || x.date || "Дата не подтверждена")}</strong>${[x.program, x.intake, x.applicantType].filter(Boolean).map(esc).join(" · ")}${srcLink(x.sourceUrl)}</div>`)}</section>
        <section class="detail-section"><h3>3. Финансы и стипендии</h3><div class="info-grid">${box("Обучение", fin.tuition)}${box("Валюта", fin.currency)}${box("Проживание", fin.accommodation)}${box("Расходы на жизнь", fin.livingExpenses)}</div>${subCards(fin.scholarships, x => `<div class="sub-card"><strong>${esc(x.name || "Стипендия")}</strong>${[x.value, x.eligibility, x.deadline].filter(Boolean).map(esc).join(" · ")}${srcLink(x.sourceUrl)}</div>`)}</section>
        <section class="detail-section"><h3>4. Жизнь в городе${city ? ": " + esc(city) : ""}</h3>${climateHtml(d.climate)}<div class="info-grid">${box("Климат", cityFacts.climate)}${box("Стоимость жизни", cityFacts.livingCost)}${box("Безопасность", cityFacts.safety)}${box("Статистика преступности", cityFacts.crimeStatistics)}${box("Транспорт", cityFacts.transport)}${box("Студенческая жизнь", cityFacts.studentLife)}</div>${(cityFacts.sources || []).map((u, i) => srcLink(u, `Источник ${i + 1}`)).join("")}</section>
        <section class="detail-section"><h3>5. Жизнь в стране${country ? ": " + esc(country) : ""}</h3><div class="stat-grid">${statBoxes}</div><p class="muted">Источник цифр: ${esc(stats.source || "Всемирный банк")}. Самое свежее доступное значение, год указан в скобках.</p><div class="info-grid">${box("Безопасность", countryFacts.safety)}${box("Здравоохранение", countryFacts.healthcare)}${box("Работа студентов", countryFacts.studentWork)}${box("Визовые особенности", countryFacts.visaNotes)}</div>${(countryFacts.sources || []).map((u, i) => srcLink(u, `Источник ${i + 1}`)).join("")}</section>
        <section class="detail-section"><h3>6. Академическая среда</h3><strong>Сильные направления</strong>${list(academic.strongFields)}<strong>Чем известен</strong>${list(academic.highlights)}</section>
      </div><aside>
        <section class="detail-section"><h3>7. Местоположение и Google Maps</h3><iframe class="map-frame" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(mapSrc)}" title="Карта университета"></iframe><p class="muted">${esc([loc.campusAddress, city, country].filter(Boolean).join(", "))} · <a class="source-link" href="${esc(mapLink)}" target="_blank" rel="noopener noreferrer">Открыть в Google Maps ↗</a></p></section>
        <section class="detail-section"><h3>8. Изображения</h3>${photos.length ? `<div class="photo-grid">${photos.map((p, i) => `<figure class="photo-fig"><img src="${esc(safeUrl(p.url))}" alt="${esc(p.title || "Изображение кампуса " + (i + 1))}" loading="lazy" referrerpolicy="no-referrer"><figcaption>${esc([p.author, p.license].filter(Boolean).join(" · "))}${safeUrl(p.page) ? ` <a href="${esc(safeUrl(p.page))}" target="_blank" rel="noopener noreferrer">Commons ↗</a>` : ""}</figcaption></figure>`).join("")}</div><p class="muted">Фото — Wikimedia Commons, авторы и лицензии указаны под снимками.</p>` : '<p class="muted">Подходящие свободные изображения не найдены.</p>'}</section>
        <section class="detail-section"><h3>9. Источники</h3><div class="sources">${sources.length ? sources.map((s, i) => `<a class="source-link" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">[${i + 1}] ${esc(s.title || s.url)} ↗</a>`).join("") : '<span class="muted">Источники не получены.</span>'}</div></section>
      </aside></div><div class="disclaimer">${esc(d.disclaimer || "Справка собрана автоматически. Перепроверяй требования на официальном сайте программы.")}${d.notes ? ` Примечание: ${esc(d.notes)}` : ""}</div></article>`;

    $("similarBtn").addEventListener("click", () => loadSimilar({ id: d.id || fallback.id, name: n, city, country }));
    $("refreshUniBtn").addEventListener("click", () => openUniversity({ ...fallback, id: d.id || fallback.id, name: n, city, country }, { keepSimilar: !$("similarSection").hidden, refresh: true }));
    const save = $("saveUniBtn"), auth = window.EduAuth;
    let saved = !!auth?.isSaved?.(n); save.textContent = saved ? "★ В избранном" : "☆ Сохранить в избранное";
    save.addEventListener("click", async () => {
      if (!auth?.isLoggedIn?.()) { auth?.showToast?.("Войди в аккаунт, чтобы сохранять университеты", "info"); auth?.openModal?.("login"); return; }
      const result = await auth.toggleSave({ name: n, country, city });
      if (result?.ok) { saved = result.added ?? !saved; save.textContent = saved ? "★ В избранном" : "☆ Сохранить в избранное"; auth.showToast?.(saved ? "Университет сохранён" : "Университет удалён из избранного", "success"); }
      else auth?.showToast?.(result?.error || "Не удалось сохранить", "error");
    });
  }

  /* ---------- режим «по моим условиям» ---------- */
  function collectFilters() {
    const split = id => $(id).value.split(",").map(x => x.trim()).filter(Boolean);
    return { field: $("filterField").value.trim(), countries: split("filterCountries"), degree: $("filterDegree").value,
      budgetMax: $("filterBudget").value ? Number($("filterBudget").value) : null, currency: $("filterCurrency").value,
      intake: $("filterIntake").value.trim(), language: $("filterLanguage").value.trim(), funding: $("filterFunding").value,
      exams: split("filterExams"), extra: $("filterExtra").value.trim() };
  }
  function clearFilters() {
    ["filterField", "filterCountries", "filterBudget", "filterIntake", "filterLanguage", "filterExams", "filterExtra"].forEach(id => $(id).value = "");
    ["filterDegree", "filterFunding"].forEach(id => $(id).value = ""); $("filterCurrency").value = "USD";
  }
  async function searchByCriteria() {
    const filters = collectFilters();
    if (!Object.entries(filters).some(([key, v]) => key !== "currency" && (Array.isArray(v) ? v.length > 0 : v !== null && v !== ""))) { status("Заполни хотя бы одно поле фильтра.", true); return; }
    if (similarCtl) similarCtl.abort(); similarCtl = new AbortController(); $("applyFiltersBtn").disabled = true;
    status("Подбираем университеты по твоим условиям и проверяем их по реестру…");
    try {
      const payload = await api("/search", { method: "POST", headers: { "Content-Type": "application/json" }, signal: similarCtl.signal, body: JSON.stringify({ mode: "criteria", filters, limit: 20 }) });
      selectedUniversity = null; visibleUniversities = payload.candidates || []; resetView();
      $("cardsHeading").textContent = "Подборка по твоим условиям";
      $("cardsSubheading").textContent = `Найдено ${visibleUniversities.length} · каждый вуз подтверждён реестром ROR · ${new Date(payload.lastChecked || Date.now()).toLocaleString()}`;
      renderCards(visibleUniversities, $("cardsTrack"), { showMatch: true, empty: "Не удалось подобрать подтверждённые университеты. Попробуй изменить условия." });
      status(visibleUniversities.length ? `Найдено университетов: ${visibleUniversities.length}.` : "Ничего не найдено.", !visibleUniversities.length);
    } catch (e) { if (e.name !== "AbortError") status(e.message, true); }
    finally { $("applyFiltersBtn").disabled = false; }
  }

  /* ---------- каталог ---------- */
  async function loadCatalog(refresh = false) {
    $("cardsTrack").innerHTML = '<div class="loading-panel">Загружаем подборку университетов…</div>';
    try {
      const data = await api("/catalog" + (refresh ? "?refresh=1" : ""));
      visibleUniversities = data.universities || []; selectedUniversity = null;
      $("cardsHeading").textContent = "50 университетов для изучения";
      $("cardsSubheading").textContent = `Динамическая подборка · ${data.count || visibleUniversities.length} записей · проверено ${new Date(data.lastChecked || Date.now()).toLocaleString()}`;
      renderCards(visibleUniversities, $("cardsTrack"), { empty: "Каталог пока пуст. Нажми «Обновить каталог»." });
      status(data.disclaimer || "Каталог загружен.");
    } catch (error) {
      $("cardsTrack").innerHTML = `<div class="loading-panel error-text">${esc(error.message)}<p class="muted">Проверь Worker: открой /health и убедись, что AI, Tavily и KV подключены.</p></div>`;
    }
  }

  function setMode(mode) {
    selectedMode = mode === "criteria" ? "criteria" : "name";
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === selectedMode));
    $("filterPanel").classList.toggle("open", selectedMode === "criteria");
    $("searchInput").parentElement.style.display = selectedMode === "criteria" ? "none" : "block";
    $("searchBtn").style.display = selectedMode === "criteria" ? "none" : "block";
    closeSuggest();
    $("searchHint").textContent = selectedMode === "name"
      ? "Начни вводить название — появятся подсказки. Поиск показывает только университеты и их официальные сайты."
      : "Заполни настоящие поля фильтра. Можно указать только те условия, которые для тебя важны.";
  }

  function init() {
    if (!$("cardsTrack") || !$("searchBtn")) return;
    window.EduAuth?.getSaved?.().catch?.(() => {});
    document.querySelectorAll(".mode-btn").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
    $("searchBtn").addEventListener("click", () => searchByName(false));
    $("searchInput").addEventListener("input", onType);
    $("searchInput").addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); if ($("suggestBox").hidden) onType(); else moveActive(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
      else if (e.key === "Escape") closeSuggest();
      else if (e.key === "Enter") { e.preventDefault(); if (activeIdx >= 0 && suggestItems[activeIdx]) chooseUniversity(suggestItems[activeIdx]); else searchByName(false); }
    });
    document.addEventListener("click", e => { if (!e.target.closest(".search-box")) closeSuggest(); });
    $("applyFiltersBtn").addEventListener("click", searchByCriteria);
    $("clearFiltersBtn").addEventListener("click", clearFilters);
    $("refreshCatalogBtn").addEventListener("click", () => loadCatalog(true));
    setMode("name");
    const wanted = new URLSearchParams(location.search).get("uni");
    if (wanted) { $("searchInput").value = wanted; searchByName(true); }
    else loadCatalog(false);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
