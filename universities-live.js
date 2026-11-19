(() => {
  "use strict";
  /* EduPath — страница «Университеты», v5 */
  const SEARCH_API = "https://edupath-university-search.muqiyatalkar.workers.dev";
  const CATALOG_URL = "catalog.json";
  const DEGREES = { foundation: "Foundation", bachelor: "Бакалавриат", master: "Магистратура", phd: "Докторантура" };
  const MATCH_LABEL = { close: "Близкий аналог", accessible: "Доступнее", value: "Выгодно по цене", funding: "Сильные стипендии", academic: "Академически близок" };
  const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const DAY = 86400000;
  const LS_TTL = { base: 14 * DAY, adm: 7 * DAY, life: 14 * DAY, sum: 6 * 3600000 };
  const nf = new Intl.NumberFormat("ru-RU");
  const $ = id => document.getElementById(id);

  const state = { degree: "bachelor", mode: "name", catalog: [], summary: {}, selected: null, openToken: 0, ctl: {}, lastBase: null };
  let suggestTimer = null, suggestItems = [], activeIdx = -1;
  const suggestMemo = new Map();

  /* ---------- утилиты ---------- */
  const esc = v => String(v ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const safeUrl = v => { try { const u = new URL(v); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
  const norm = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/^the /, "").trim();
  const uniKey = u => u?.id || norm(u?.name) + "|" + norm(u?.country);
  const place = u => [u?.city, u?.country].filter(Boolean).join(", ");
  const status = (msg, err = false) => { $("statusLine").textContent = msg || ""; $("statusLine").classList.toggle("error-text", err); };
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

  function lsGet(k) {
    try { const v = JSON.parse(localStorage.getItem("ep5:" + k)); return v && Date.now() < v.e ? v.d : null; } catch { return null; }
  }
  function lsSet(k, d, ttl) {
    const put = () => localStorage.setItem("ep5:" + k, JSON.stringify({ e: Date.now() + ttl, d }));
    try { put(); } catch {
      try { // память браузера переполнена — удаляем самые старые записи EduPath
        const keys = Object.keys(localStorage).filter(x => x.startsWith("ep5:"));
        keys.slice(0, Math.ceil(keys.length / 2)).forEach(x => localStorage.removeItem(x)); put();
      } catch { /* браузер без хранилища — работаем без него */ }
    }
  }

  async function api(path, { body, method, signal, timeout = 100000 } = {}) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort("timeout"), timeout);
    const onAbort = () => ctl.abort("cancel");
    signal?.addEventListener("abort", onAbort);
    try {
      const res = await fetch(SEARCH_API + path, { method: method || (body ? "POST" : "GET"), signal: ctl.signal,
        headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Ошибка сервера: ${res.status}`);
      return data;
    } catch (e) {
      if (ctl.signal.aborted && ctl.signal.reason === "timeout") throw new Error("Сервер не ответил вовремя.");
      throw e;
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); }
  }
  const isCancel = e => e?.name === "AbortError" || (e?.message || "").includes("aborted");
  function newCtl(name) { state.ctl[name]?.abort(); state.ctl[name] = new AbortController(); return state.ctl[name].signal; }

  /* ---------- уровень обучения ---------- */
  function syncDegreeUI() {
    document.querySelectorAll("[data-degree-switch] button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.degree === state.degree)));
    if ($("filterDegree")) $("filterDegree").value = state.degree;
  }
  function setDegree(deg, { silent = false } = {}) {
    if (!DEGREES[deg] || (deg === state.degree && !silent)) { syncDegreeUI(); return; }
    state.degree = deg;
    try { localStorage.setItem("ep5:degree", deg); } catch { /* ignore */ }
    const u = new URL(location.href); u.searchParams.set("degree", deg); history.replaceState(null, "", u);
    syncDegreeUI();
    if (silent) return;
    loadSummary(false);
    if (state.selected) loadAdmissions(state.selected, false);
    if (!$("similarSection").hidden && state.selected) loadSimilar(state.selected);
  }

  /* ---------- дедлайны и карточки ---------- */
  function dotClass(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return "";
    const days = Math.ceil((new Date(date + "T23:59:59") - new Date()) / DAY);
    return days < 0 ? "" : days <= 30 ? "red" : days <= 90 ? "yellow" : "green";
  }
  const summaryFor = u => state.summary[norm(u.name)] || (u.id && state.summary[u.id]) || null;

  function factsHtml(u) {
    const s = summaryFor(u);
    if (s && s.offered === false) return `<div class="not-offered">По данным сайта, уровня «${esc(DEGREES[state.degree])}» нет</div>`;
    const row = (label, v) => `<div><dt>${label}</dt><dd class="${v ? "" : "none"}">${esc(v || "—")}</dd></div>`;
    return `<dl class="card-facts">${row("Подача", s?.type)}${row("Дедлайн", s?.nextDeadline?.display || s?.nextDeadline?.date)}${row("Приём", s?.acceptanceRate)}</dl>`;
  }
  function renderCards(items, track, opts = {}) {
    track.innerHTML = "";
    if (!items.length) { track.innerHTML = `<div class="empty-state">${esc(opts.empty || "Ничего не найдено.")}</div>`; return; }
    for (const uni of items) {
      const card = document.createElement("article");
      card.tabIndex = 0; card.setAttribute("role", "button"); card.dataset.key = uniKey(uni); card.dataset.name = norm(uni.name);
      card.className = "uni-card result-card" + (state.selected && uniKey(state.selected) === uniKey(uni) ? " selected" : "");
      const site = safeUrl(uni.website);
      const siteHtml = site ? `<a class="result-link" href="${esc(site)}" target="_blank" rel="noopener noreferrer">Официальный сайт: ${esc(uni.domain || hostOf(site))} ↗</a>`
        : '<span class="result-link missing">Официальный сайт не найден</span>';
      const s = summaryFor(uni);
      card.innerHTML = `<div class="card-top"><span class="country-pill">${esc(uni.country || "Страна уточняется")}</span><span class="deadline-dot ${dotClass(s?.nextDeadline?.date)}" title="Цвет — по ближайшему подтверждённому дедлайну"></span></div>
        <h3>${esc(uni.name)}</h3><div class="card-location">📍 ${esc(uni.city || "Город уточняется")}</div>
        ${opts.reason && uni.reason ? `<div class="card-reason">${esc(uni.reason)}</div>` : ""}
        ${opts.showMatch && uni.matchType ? `<span class="match-chip">${esc(MATCH_LABEL[uni.matchType] || "Рекомендация")}</span>` : ""}
        <div class="card-facts-wrap">${factsHtml(uni)}</div>
        <div class="card-foot">${siteHtml}<span>Досье ↗</span></div>`;
      card.querySelectorAll("a").forEach(a => a.addEventListener("click", e => e.stopPropagation()));
      const open = () => openUniversity(uni, { keepSimilar: !!opts.keepSimilar });
      card.addEventListener("click", open);
      card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      track.appendChild(card);
    }
  }
  function refreshCardFacts() {
    document.querySelectorAll(".uni-card").forEach(card => {
      const fake = { name: card.querySelector("h3")?.textContent || "", id: card.dataset.key.startsWith("https://") ? card.dataset.key : null };
      const s = summaryFor(fake);
      const wrap = card.querySelector(".card-facts-wrap"); if (wrap) wrap.innerHTML = factsHtml(fake);
      const dot = card.querySelector(".deadline-dot"); if (dot) dot.className = "deadline-dot " + dotClass(s?.nextDeadline?.date);
    });
  }
  function highlightSelected() {
    document.querySelectorAll(".uni-card").forEach(c => c.classList.toggle("selected", !!state.selected && c.dataset.key === uniKey(state.selected)));
  }

  /* ---------- каталог ---------- */
  async function loadCatalog() {
    try {
      const res = await fetch(CATALOG_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error("catalog.json: " + res.status);
      const data = await res.json();
      state.catalog = Array.isArray(data.universities) ? data.universities : [];
    } catch (e) {
      $("cardsTrack").innerHTML = `<div class="loading-panel error-text">Не удалось загрузить catalog.json (${esc(e.message)}). Проверь, что файл лежит рядом со страницей.</div>`;
      return;
    }
    showCatalog();
    loadSummary(false);
  }
  function showCatalog() {
    $("cardsHeading").textContent = `${state.catalog.length} университетов для изучения`;
    $("cardsSubheading").textContent = "Тип подачи, ближайший дедлайн и процент приёма — для выбранного уровня обучения";
    renderCards(state.catalog, $("cardsTrack"), { empty: "Каталог пуст." });
  }
  async function loadSummary(force) {
    const deg = state.degree, cached = !force && lsGet("sum:" + deg);
    if (cached) { state.summary = cached; refreshCardFacts(); return; }
    try {
      const data = await api("/catalog-status", { body: { degree: deg }, timeout: 20000 });
      if (deg !== state.degree) return;
      state.summary = data.summary || {};
      lsSet("sum:" + deg, state.summary, LS_TTL.sum);
      refreshCardFacts();
    } catch (e) { console.warn("catalog-status", e.message); }
  }
  function rememberSummary(u, adm) {
    const entry = { name: u.name, type: adm.application?.type || null, nextDeadline: adm.application?.nextDeadline || null,
      acceptanceRate: adm.acceptanceRate || null, offered: adm.offered };
    state.summary[norm(u.name)] = entry; if (u.id) state.summary[u.id] = entry;
    if (adm.degree === state.degree) { lsSet("sum:" + state.degree, state.summary, LS_TTL.sum); refreshCardFacts(); }
  }

  /* ---------- подсказки поиска ---------- */
  function closeSuggest() { $("suggestBox").hidden = true; $("searchInput").setAttribute("aria-expanded", "false"); activeIdx = -1; }
  function renderSuggest(items, query) {
    const box = $("suggestBox"); suggestItems = items; activeIdx = -1;
    box.innerHTML = items.length
      ? items.map((u, i) => `<div class="suggest-item" role="option" data-i="${i}"><strong>${esc(u.name)}</strong><span>${esc(place(u) || "место не указано")}${u.domain ? " · " + esc(u.domain) : ""}</span></div>`).join("")
      : `<div class="suggest-empty">Не нашли «${esc(query)}». Попробуй официальное английское название или аббревиатуру.</div>`;
    box.querySelectorAll(".suggest-item").forEach(el => el.addEventListener("mousedown", e => { e.preventDefault(); chooseUniversity(suggestItems[Number(el.dataset.i)]); }));
    box.hidden = false; $("searchInput").setAttribute("aria-expanded", "true");
  }
  function moveActive(delta) {
    const els = [...$("suggestBox").querySelectorAll(".suggest-item")]; if (!els.length) return;
    activeIdx = (activeIdx + delta + els.length) % els.length;
    els.forEach((el, i) => el.classList.toggle("active", i === activeIdx)); els[activeIdx].scrollIntoView({ block: "nearest" });
  }
  async function fetchSuggest(q, signal) {
    const k = norm(q);
    if (suggestMemo.has(k)) return suggestMemo.get(k);
    const data = await api("/suggest?q=" + encodeURIComponent(q), { signal, timeout: 15000 });
    const results = data.results || [];
    suggestMemo.set(k, results);
    return results;
  }
  function onType() {
    clearTimeout(suggestTimer);
    const q = $("searchInput").value.trim();
    if (state.mode !== "name" || q.length < 3) { closeSuggest(); return; }
    suggestTimer = setTimeout(async () => {
      try { const r = await fetchSuggest(q, newCtl("suggest")); if ($("searchInput").value.trim() === q) renderSuggest(r, q); }
      catch (e) { if (!isCancel(e)) closeSuggest(); }
    }, 350);
  }
  function showResults(results, query) {
    $("cardsHeading").textContent = results.length === 1 ? "Результат поиска" : "Результаты поиска";
    $("cardsSubheading").innerHTML = `По запросу «${esc(query)}» · только университеты и их официальные сайты · <a href="#" id="backToCatalog" class="source-link">вернуться к каталогу</a>`;
    $("backToCatalog").addEventListener("click", e => { e.preventDefault(); showCatalog(); });
    renderCards(results, $("cardsTrack"), { empty: "Такой университет не найден. Попробуй официальное английское название." });
  }
  async function chooseUniversity(uni) {
    if (!uni) return;
    clearTimeout(suggestTimer); closeSuggest();
    $("searchInput").value = uni.name; showResults([uni], uni.name); status("");
    openUniversity(uni);
  }
  async function searchByName() {
    clearTimeout(suggestTimer); closeSuggest();
    const q = $("searchInput").value.trim();
    if (q.length < 2) { status("Введи не менее двух символов.", true); return; }
    $("searchBtn").disabled = true; status("Ищем университет…");
    try {
      const results = await fetchSuggest(q, newCtl("suggest"));
      showResults(results, q);
      status(results.length ? `Найдено: ${results.length}.` : "Университет не найден.", !results.length);
      if (results.length === 1) openUniversity(results[0]);
    } catch (e) { if (!isCancel(e)) status(e.message, true); }
    finally { $("searchBtn").disabled = false; }
  }

  /* ---------- досье ---------- */
  const NO = "Нет подтверждённых данных";
  function box(label, value) {
    const text = value === null || value === undefined || value === "" ? NO : String(value);
    return `<div class="info-box"><small>${esc(label)}</small><strong class="${text === NO ? "unknown" : ""}">${esc(text)}</strong></div>`;
  }
  const badge = off => off === false ? '<span class="badge-unofficial">не с сайта вуза — проверь</span>' : off === true ? '<span class="badge-official">сайт вуза</span>' : "";
  const srcLink = (url, label = "Источник") => safeUrl(url) ? `<div><a class="source-link" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a></div>` : "";
  const linkBtn = (label, url) => safeUrl(url) ? `<a class="action-btn" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : "";
  const list = (items, empty = "Нет подтверждённых сведений.") => Array.isArray(items) && items.length ? `<ul class="plain-list">${items.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="muted">${esc(empty)}</p>`;
  const subCards = (items, render, empty = "Нет подтверждённых сведений.") => Array.isArray(items) && items.length ? `<div class="sub-list">${items.map(render).join("")}</div>` : `<p class="muted">${esc(empty)}</p>`;
  const num = (v, suffix = "") => v && Number.isFinite(v.value) ? `${nf.format(v.value)}${suffix} (${v.year})` : null;
  const loadingHtml = text => `<div class="sec-loading">${esc(text)}</div>`;
  function errorHtml(msg, retryId, hint) {
    return `<div class="sec-error"><span>${esc(msg)}</span>${hint ? `<span class="muted">${esc(hint)}</span>` : ""}<button class="secondary-btn" type="button" id="${retryId}">Повторить</button></div>`;
  }
  const set = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };

  function mapHtml(u) {
    const has = Number.isFinite(u.lat) && Number.isFinite(u.lng);
    const q = has ? `${u.lat},${u.lng}` : encodeURIComponent([u.name, u.city, u.country].filter(Boolean).join(", "));
    return `<iframe class="map-frame" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${q}${has ? "&z=14" : ""}&output=embed" title="Карта университета"></iframe>
      <p class="muted">${esc(place(u))} · <a class="source-link" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener noreferrer">Открыть в Google Maps ↗</a></p>`;
  }
  function climateHtml(c) {
    if (!c?.months?.length) return "";
    const temps = c.months.map(m => m.t), lo = Math.min(...temps), span = Math.max(Math.max(...temps) - lo, 1);
    return `<div class="month-bars" aria-label="Средняя температура по месяцам">${c.months.map(m => `<div class="mbar ${m.t < 5 ? "cold" : ""}" title="${MONTHS[m.m - 1]}: ${m.t} °C, осадки ${m.p} мм"><small>${Math.round(m.t)}°</small><i style="height:${18 + Math.round(((m.t - lo) / span) * 82)}%"></i><b>${MONTHS[m.m - 1]}</b></div>`).join("")}</div>
      <p class="muted">${esc(c.summary || "")} Источник: <a class="source-link" href="${esc(safeUrl(c.source?.url))}" target="_blank" rel="noopener noreferrer">${esc(c.source?.name || "Open-Meteo")}</a>.</p>`;
  }

  function renderShell(u) {
    $("emptyState").style.display = "none";
    $("detailContent").innerHTML = `<article class="detail-card">
      <header class="detail-head"><div class="eyebrow" id="dEyebrow">University dossier</div><h2 id="dName">${esc(u.name)}</h2>
        <div class="detail-location" id="dLocation">📍 ${esc(place(u) || "Местоположение уточняется")}</div>
        <div class="degree-switch" data-degree-switch role="radiogroup" aria-label="Уровень обучения">${Object.entries(DEGREES).map(([k, v]) => `<button type="button" role="radio" data-degree="${k}">${v}</button>`).join("")}</div>
        <div class="detail-actions" id="dActions">${linkBtn("Официальный сайт", u.website)}<span id="dLinks"></span><button class="action-btn accent" id="similarBtn" type="button">Найти 19 похожих ↓</button><button class="action-btn" id="saveUniBtn" type="button">☆ Сохранить в избранное</button><button class="action-btn" id="refreshUniBtn" type="button" title="Собрать данные заново (тратит лимиты поиска)">↻ Обновить данные</button></div></header>
      <div class="detail-grid"><div>
        <div id="dAbout"></div>
        <section class="detail-section"><h3>1. Условия поступления — <span class="dDegreeName"></span></h3><div id="admReq">${loadingHtml("Читаем официальный сайт вуза…")}</div></section>
        <section class="detail-section"><h3>2. Тип подачи и дедлайны</h3><div id="admApp">${loadingHtml("Ищем дедлайны…")}</div></section>
        <section class="detail-section"><h3>3. Стоимость и финансовая помощь</h3><div id="admFin">${loadingHtml("Ищем стоимость и стипендии…")}</div></section>
        <section class="detail-section"><h3>4. Жизнь в городе${u.city ? ": " + esc(u.city) : ""}</h3><div id="cityClimate"></div><div id="lifeCity">${loadingHtml("Собираем данные о городе…")}</div></section>
        <section class="detail-section"><h3>5. Жизнь в стране${u.country ? ": " + esc(u.country) : ""}</h3><div id="countryStats">${loadingHtml("Загружаем статистику страны…")}</div><div id="lifeCountry"></div></section>
        <section class="detail-section"><h3>6. Академическая среда</h3><div id="admAcademic">${loadingHtml("…")}</div></section>
      </div><aside>
        <section class="detail-section"><h3>7. Местоположение и Google Maps</h3><div id="dMap">${mapHtml(u)}</div></section>
        <section class="detail-section"><h3>8. Изображения</h3><div id="dPhotos">${loadingHtml("Ищем фотографии кампуса…")}</div></section>
        <section class="detail-section"><h3>9. Источники</h3><div id="dSources" class="sources">${loadingHtml("…")}</div></section>
      </aside></div>
      <div class="disclaimer">Справка собрана автоматически. Требования и дедлайны зависят от программы, гражданства и года набора. «Нет подтверждённых данных» значит «не нашли», а не «не требуется». Перед подачей проверь на официальном сайте.</div></article>`;
    syncDegreeUI();
    document.querySelectorAll(".dDegreeName").forEach(el => el.textContent = DEGREES[state.degree]);
    $("detailContent").querySelectorAll("[data-degree-switch] button").forEach(b => b.addEventListener("click", () => setDegree(b.dataset.degree)));
    $("similarBtn").addEventListener("click", () => loadSimilar(state.selected));
    $("refreshUniBtn").addEventListener("click", () => openUniversity(state.selected, { refresh: true, keepSimilar: !$("similarSection").hidden }));
    setupSave(u);
  }

  function setupSave(u) {
    const btn = $("saveUniBtn"), auth = window.EduAuth;
    const paint = s => { btn.textContent = s ? "★ В избранном" : "☆ Сохранить в избранное"; };
    paint(!!auth?.isSaved?.(u.name));
    auth?.getSaved?.().then(() => paint(!!auth.isSaved(state.selected?.name))).catch?.(() => {});
    btn.onclick = async () => {
      if (!auth?.isLoggedIn?.()) { auth?.showToast?.("Войди в аккаунт, чтобы сохранять университеты", "info"); auth?.openModal?.("login"); return; }
      const cur = state.selected;
      const r = await auth.toggleSave({ name: cur.name, country: cur.country || "", city: cur.city || "" });
      if (r?.ok) { paint(!!r.added); auth.showToast?.(r.added ? "Сохранено — откроется из профиля одним нажатием" : "Убрано из избранного", "success"); }
      else auth?.showToast?.(r?.error || "Не удалось сохранить", "error");
    };
  }

  function fillBase(d) {
    const u = state.selected;
    Object.assign(u, { id: d.id || u.id, name: d.name || u.name, city: d.city || u.city, country: d.country || u.country,
      website: d.website || u.website, domain: d.domain || u.domain, lat: d.location?.latitude ?? u.lat, lng: d.location?.longitude ?? u.lng });
    $("dName").textContent = u.name;
    $("dLocation").textContent = "📍 " + (place(u) || "Местоположение уточняется") + (d.established ? ` · основан в ${d.established}` : "");
    $("dEyebrow").textContent = `University dossier · ${u.domain || "сайт не найден"}`;
    if (!$("dActions").querySelector('a[href="' + safeUrl(u.website) + '"]') && safeUrl(u.website)) $("dLinks").insertAdjacentHTML("beforebegin", linkBtn("Официальный сайт", u.website));
    set("dAbout", d.about?.text ? `<p class="about-text">${esc(d.about.text)} ${safeUrl(d.about.url) ? `<a class="source-link" href="${esc(safeUrl(d.about.url))}" target="_blank" rel="noopener noreferrer">Википедия ↗</a>` : ""}</p>` : "");
    set("dMap", mapHtml(u));
    const photos = (d.photos || []).filter(p => safeUrl(p.url));
    set("dPhotos", photos.length ? `<div class="photo-grid">${photos.map((p, i) => `<figure class="photo-fig"><img src="${esc(safeUrl(p.url))}" alt="${esc(p.title || "Кампус " + (i + 1))}" loading="lazy" referrerpolicy="no-referrer"><figcaption>${esc([p.author, p.license].filter(Boolean).join(" · "))}${safeUrl(p.page) ? ` <a href="${esc(safeUrl(p.page))}" target="_blank" rel="noopener noreferrer">Commons ↗</a>` : ""}</figcaption></figure>`).join("")}</div><p class="muted">Фото — Wikimedia Commons, авторы и лицензии под снимками.</p>` : '<p class="muted">Свободных фотографий кампуса не нашлось.</p>');
    set("cityClimate", climateHtml(d.climate));
    const s = d.countryStats || {};
    set("countryStats", `<div class="stat-grid">${[box("Столица", s.capital), box("Регион", s.region), box("Языки", (s.languages || []).join(", ")), box("Валюта", (s.currencies || []).join(", ")),
      box("Население", s.population ? nf.format(s.population) : null), box("Убийств на 100 тыс. человек", num(s.homicideRate)), box("ВВП на душу (по ППС, $)", num(s.gdpPpp)),
      box("Продолжительность жизни", num(s.lifeExpectancy, " лет")), box("Инфляция за год", num(s.inflation, " %"))].join("")}</div><p class="muted">Источник: ${esc(s.source || "Всемирный банк")}. Последнее доступное значение, год в скобках.</p>`);
    setupSave(u);
  }

  function fillAdmissions(data) {
    const a = data.admissions || {}, m = data.meta || {};
    document.querySelectorAll(".dDegreeName").forEach(el => el.textContent = a.degreeLabel || DEGREES[state.degree]);
    const offered = a.offered === false ? `<div class="offer-warning">По данным найденных страниц, уровень «${esc(a.degreeLabel)}» здесь не предлагается${a.offeredNote ? ": " + esc(a.offeredNote) : ""}. Проверь на сайте вуза.</div>` : "";
    const fallback = m.fallbackUsed ? `<div class="offer-warning">На официальном сайте нашлось мало страниц, поэтому добавлены сторонние источники — они помечены «не с сайта вуза».</div>` : "";
    const nothing = !m.ai?.requirements && !m.ai?.finance;
    const diag = `<p class="diag-line">Страниц с сайта вуза: ${m.officialSources ?? 0}, сторонних: ${m.otherSources ?? 0}${m.cached ? " · из кэша" : ""}${a.checkedAt ? " · проверено " + new Date(a.checkedAt).toLocaleDateString() : ""}</p>`;
    if (nothing) {
      const why = (m.officialSources || 0) + (m.otherSources || 0) === 0 ? "Поиск не нашёл страниц о поступлении." : "ИИ не успел разобрать найденные страницы.";
      const hint = (m.officialSources || 0) + (m.otherSources || 0) ? "Найденные страницы сохранены — повтор не тратит лимиты поиска." : "";
      set("admReq", errorHtml(why, "retryAdm", hint) + diag); set("admApp", ""); set("admFin", ""); set("admAcademic", '<p class="muted">—</p>');
      $("retryAdm").addEventListener("click", () => loadAdmissions(state.selected, true));
      return;
    }
    set("admReq", offered + fallback + subCards(a.requirements, x => `<div class="sub-card"><strong>${esc(x.name)}: ${esc(x.value)}</strong>${badge(x.official)}<br>${x.program ? `Программа: ${esc(x.program)}. ` : ""}${x.applicantType ? `Абитуриент: ${esc(x.applicantType)}. ` : ""}${x.notes ? esc(x.notes) : ""}${srcLink(x.sourceUrl)}</div>`,
      "Требования не найдены на страницах вуза. Это не значит, что экзамены не нужны.") + (a.acceptanceRate ? box("Процент приёма", a.acceptanceRate) : "") + diag);
    const app = a.application || {};
    set("admApp", `<div class="info-grid">${box("Тип подачи", app.type)}${box("Стоимость заявки", app.applicationFee)}</div>` +
      subCards(app.deadlines, x => `<div class="sub-card"><span class="deadline-dot ${dotClass(x.date)}"></span> <strong>${esc(x.label)}: ${esc(x.display || x.date)}</strong>${badge(x.official)}<br>${[x.program, x.intake, x.applicantType].filter(Boolean).map(esc).join(" · ")}${srcLink(x.sourceUrl)}</div>`, "Дедлайны не найдены."));
    const f = a.financial || {};
    set("admFin", `<div class="info-grid">${box("Обучение", f.tuition)}${box("Валюта", f.currency)}${box("Проживание", f.accommodation)}${box("Расходы на жизнь", f.livingExpenses)}</div>` +
      subCards(f.scholarships, x => `<div class="sub-card"><strong>${esc(x.name)}</strong>${badge(x.official)}<br>${[x.value, x.eligibility, x.deadline].filter(Boolean).map(esc).join(" · ")}${srcLink(x.sourceUrl)}</div>`, "Стипендии не найдены."));
    set("admAcademic", `<strong>Сильные направления</strong>${list(a.academic?.strongFields)}<strong>Чем известен</strong>${list(a.academic?.highlights)}`);
    const l = a.links || {};
    set("dLinks", [linkBtn("Приёмная комиссия", l.admissions), linkBtn("Подача заявления", l.application), linkBtn("Иностранным студентам", l.internationalStudents),
      linkBtn("Финансовая помощь", l.financialAid), linkBtn("Стипендии", l.scholarships), linkBtn("Общежитие", l.accommodation)].join(""));
    const src = (a.sources || []).filter(s => safeUrl(s.url));
    set("dSources", src.length ? src.map((s, i) => `<a class="source-link" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">[${i + 1}] ${esc(s.title || s.url)} ↗</a>${badge(s.official)}`).join("") : '<span class="muted">Источники не получены.</span>');
    rememberSummary(state.selected, a);
  }

  function fillLife(data) {
    const l = data?.life;
    if (!l) { set("lifeCity", '<p class="muted">Город и страна неизвестны.</p>'); return; }
    const c = l.cityFacts || {}, k = l.countryFacts || {};
    const links = arr => (arr || []).map((u, i) => srcLink(u, `Источник ${i + 1}`)).join("");
    set("lifeCity", `<div class="info-grid">${box("Стоимость жизни", c.livingCost)}${box("Аренда", c.rent)}${box("Безопасность", c.safety)}${box("Статистика преступности", c.crimeStatistics)}${box("Транспорт", c.transport)}${box("Студенческая жизнь", c.studentLife)}</div>${links(c.sources)}`);
    set("lifeCountry", `<div class="info-grid">${box("Безопасность", k.safety)}${box("Здравоохранение", k.healthcare)}${box("Работа студентов", k.studentWork)}${box("Визовые особенности", k.visaNotes)}</div>${links(k.sources)}`);
  }

  async function loadBase(u, refresh) {
    const key = "base:" + uniKey(u), token = state.openToken;
    const cached = !refresh && lsGet(key);
    if (cached) { fillBase(cached); return cached; }
    try {
      const data = await api("/details/base", { body: { id: u.id || "", name: u.name, city: u.city || "", country: u.country || "", website: u.website || "", refresh }, signal: newCtl("base"), timeout: 40000 });
      if (token !== state.openToken) return null;
      const d = data.university || {};
      if (d.id) { lsSet(key, d, LS_TTL.base); lsSet("base:" + d.id, d, LS_TTL.base); }
      fillBase(d);
      return d;
    } catch (e) {
      if (isCancel(e) || token !== state.openToken) return null;
      set("countryStats", errorHtml("Не удалось загрузить общие данные: " + e.message, "retryBase"));
      set("dPhotos", '<p class="muted">—</p>');
      $("retryBase")?.addEventListener("click", () => loadBase(state.selected, false));
      return null;
    }
  }
  async function loadAdmissions(u, refresh) {
    const deg = state.degree, key = `adm:${deg}:` + uniKey(u), token = state.openToken;
    ["admReq", "admApp", "admFin"].forEach(id => set(id, loadingHtml(id === "admReq" ? `Читаем официальный сайт вуза (${DEGREES[deg]})… обычно 10–40 секунд, повторно — мгновенно` : "…")));
    set("admAcademic", loadingHtml("…")); set("dLinks", ""); set("dSources", loadingHtml("…"));
    document.querySelectorAll(".dDegreeName").forEach(el => el.textContent = DEGREES[deg]);
    const cached = !refresh && lsGet(key);
    if (cached) { fillAdmissions(cached); return; }
    try {
      const data = await api("/details/admissions", { body: { id: u.id || "", name: u.name, city: u.city || "", country: u.country || "", website: u.website || "", degree: deg, refresh }, signal: newCtl("adm"), timeout: 110000 });
      if (token !== state.openToken || deg !== state.degree) return;
      if (data.meta?.ai?.requirements || data.meta?.ai?.finance) lsSet(key, data, LS_TTL.adm);
      fillAdmissions(data);
    } catch (e) {
      if (isCancel(e) || token !== state.openToken || deg !== state.degree) return;
      set("admReq", errorHtml(e.message, "retryAdm", "Если найденные страницы уже сохранены, повтор не потратит лимиты поиска."));
      ["admApp", "admFin", "admAcademic", "dSources"].forEach(id => set(id, ""));
      $("retryAdm").addEventListener("click", () => loadAdmissions(state.selected, false));
    }
  }
  async function loadLife(u, refresh) {
    const key = "life:" + norm(u.city) + "|" + norm(u.country), token = state.openToken;
    const cached = !refresh && (u.city || u.country) && lsGet(key);
    if (cached) { fillLife(cached); return; }
    try {
      const data = await api("/details/life", { body: { id: u.id || "", name: u.name, city: u.city || "", country: u.country || "", refresh }, signal: newCtl("life"), timeout: 90000 });
      if (token !== state.openToken) return;
      if (data.meta?.ai && data.life) lsSet(key, data, LS_TTL.life);
      if (data.life && !data.meta?.ai) { set("lifeCity", errorHtml("ИИ не успел разобрать данные о городе.", "retryLife", "Повтор не тратит лимиты поиска.")); $("retryLife").addEventListener("click", () => loadLife(state.selected, false)); return; }
      fillLife(data);
    } catch (e) {
      if (isCancel(e) || token !== state.openToken) return;
      set("lifeCity", errorHtml(e.message, "retryLife")); $("retryLife").addEventListener("click", () => loadLife(state.selected, false));
    }
  }

  async function openUniversity(uni, { keepSimilar = false, refresh = false, instant = false } = {}) {
    if (!uni?.name) return;
    const token = ++state.openToken;
    state.selected = { ...uni };
    highlightSelected();
    if (!keepSimilar) { $("similarSection").hidden = true; $("similarTrack").innerHTML = ""; }
    renderShell(state.selected);
    $("detailShell").scrollIntoView({ behavior: instant ? "instant" : "smooth", block: "start" });
    // если id из реестра уже известен — всё грузим параллельно; иначе сначала узнаём id (так быстрее и экономнее)
    const basePromise = loadBase(state.selected, refresh);
    if (!state.selected.id) await basePromise;
    if (token !== state.openToken) return;
    loadAdmissions(state.selected, refresh);
    loadLife(state.selected, refresh);
  }

  /* ---------- 19 похожих ---------- */
  async function loadSimilar(u) {
    if (!u) return;
    const section = $("similarSection"), track = $("similarTrack");
    section.hidden = false;
    $("similarHeading").textContent = `Похожие на «${u.name}»`;
    $("similarSub").textContent = `Подбираем 19 университетов (${DEGREES[state.degree]}) и проверяем каждый по реестру — до минуты. Повторно — мгновенно.`;
    track.innerHTML = '<div class="loading-panel">Ищем похожие университеты…</div>';
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    const key = `sim:${state.degree}:` + uniKey(u);
    let data = lsGet(key);
    try {
      if (!data) {
        data = await api("/similar", { body: { id: u.id || "", name: u.name, city: u.city || "", country: u.country || "", degree: state.degree }, signal: newCtl("similar"), timeout: 110000 });
        if ((data.candidates || []).length >= 10) lsSet(key, data, LS_TTL.base);
      }
      const items = data.candidates || [];
      $("similarSub").textContent = `Найдено ${items.length} из 19 · каждый вуз подтверждён реестром ROR · уровень: ${DEGREES[state.degree]}`;
      renderCards(items, track, { showMatch: true, reason: true, keepSimilar: true, empty: "Не удалось подобрать подтверждённые университеты. Попробуй позже." });
    } catch (e) {
      if (isCancel(e)) return;
      track.innerHTML = `<div class="loading-panel error-text">${esc(e.message)}</div>`; $("similarSub").textContent = "";
    }
  }

  /* ---------- подбор по условиям ---------- */
  function collectFilters() {
    const split = id => $(id).value.split(",").map(x => x.trim()).filter(Boolean);
    return { field: $("filterField").value.trim(), countries: split("filterCountries"), budgetMax: $("filterBudget").value ? Number($("filterBudget").value) : null,
      currency: $("filterCurrency").value, intake: $("filterIntake").value.trim(), language: $("filterLanguage").value.trim(), funding: $("filterFunding").value,
      exams: split("filterExams"), extra: $("filterExtra").value.trim() };
  }
  function clearFilters() {
    ["filterField", "filterCountries", "filterBudget", "filterIntake", "filterLanguage", "filterExams", "filterExtra"].forEach(id => $(id).value = "");
    $("filterFunding").value = ""; $("filterCurrency").value = "USD";
  }
  async function searchByCriteria() {
    const filters = collectFilters();
    if (!Object.entries(filters).some(([k, v]) => k !== "currency" && (Array.isArray(v) ? v.length : v !== null && v !== ""))) { status("Заполни хотя бы одно поле фильтра.", true); return; }
    $("applyFiltersBtn").disabled = true; status(`Подбираем университеты (${DEGREES[state.degree]}) и проверяем по реестру…`);
    try {
      const data = await api("/search", { body: { mode: "criteria", degree: state.degree, filters, limit: 20 }, signal: newCtl("criteria"), timeout: 110000 });
      const items = data.candidates || [];
      $("cardsHeading").textContent = "Подборка по твоим условиям";
      $("cardsSubheading").textContent = `Найдено ${items.length} · уровень: ${DEGREES[state.degree]} · каждый вуз подтверждён реестром ROR`;
      renderCards(items, $("cardsTrack"), { showMatch: true, reason: true, empty: "Не удалось подобрать. Попробуй изменить условия." });
      status(items.length ? `Найдено: ${items.length}.` : "Ничего не найдено.", !items.length);
    } catch (e) { if (!isCancel(e)) status(e.message, true); }
    finally { $("applyFiltersBtn").disabled = false; }
  }

  function setMode(mode) {
    state.mode = mode === "criteria" ? "criteria" : "name";
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === state.mode));
    $("filterPanel").classList.toggle("open", state.mode === "criteria");
    $("searchInput").closest(".search-row").style.display = state.mode === "criteria" ? "none" : "";
    closeSuggest();
    $("searchHint").textContent = state.mode === "name"
      ? "Начни вводить название — появятся подсказки. Поиск показывает только университеты и их официальные сайты."
      : "Заполни только важные для тебя поля. Уровень обучения берётся из переключателя вверху.";
  }

  function init() {
    if (!$("cardsTrack")) return;
    const params = new URLSearchParams(location.search);
    let deg = params.get("degree"); try { deg = deg || localStorage.getItem("ep5:degree"); } catch { /* ignore */ }
    state.degree = DEGREES[deg] ? deg : "bachelor";
    syncDegreeUI();
    document.querySelectorAll(".search-panel [data-degree-switch] button").forEach(b => b.addEventListener("click", () => setDegree(b.dataset.degree)));
    $("filterDegree")?.addEventListener("change", e => setDegree(e.target.value));
    document.querySelectorAll(".mode-btn").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
    $("searchBtn").addEventListener("click", searchByName);
    $("searchInput").addEventListener("input", onType);
    $("searchInput").addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); if ($("suggestBox").hidden) onType(); else moveActive(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
      else if (e.key === "Escape") closeSuggest();
      else if (e.key === "Enter") { e.preventDefault(); if (activeIdx >= 0 && suggestItems[activeIdx]) chooseUniversity(suggestItems[activeIdx]); else searchByName(); }
    });
    document.addEventListener("click", e => { if (!e.target.closest(".search-box")) closeSuggest(); });
    $("applyFiltersBtn").addEventListener("click", searchByCriteria);
    $("clearFiltersBtn").addEventListener("click", clearFilters);
    $("refreshCatalogBtn").addEventListener("click", () => { showCatalog(); loadSummary(true); });
    setMode("name");
    // переход из профиля: universities.html?uni=Название&country=…&city=… — сразу открываем досье
    const wanted = params.get("uni"), wantedId = params.get("id");
    if (wanted || wantedId) {
      openUniversity({ id: wantedId || null, name: wanted || "", country: params.get("country") || "", city: params.get("city") || "" }, { instant: true });
      loadCatalog().then(() => requestAnimationFrame(() => $("detailShell").scrollIntoView({ behavior: "instant", block: "start" })));
    } else loadCatalog();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
