(() => {
  "use strict";
  /* EduPath — страница «Университеты», v6 */
  const SEARCH_API = "https://edupath-university-search.muqiyatalkar.workers.dev";
  const CATALOG_URL = "catalog.json";
  const DEGREES = { foundation: "Foundation", bachelor: "Бакалавриат", master: "Магистратура", phd: "Докторантура" };
  const MATCH_LABEL = { close: "Близкий аналог", accessible: "Доступнее", value: "Выгодно по цене", funding: "Сильные стипендии", academic: "Академически близок" };
  const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const DAY = 86400000;
  const LS_TTL = { base: 14 * DAY, adm: 7 * DAY, life: 14 * DAY, sum: 6 * 3600000, rates: 12 * 3600000 };
  // Гражданство абитуриента: [код ISO, название, валюта для пересчёта бюджета]
  const CITIZENSHIPS = [["KZ", "Казахстан", "KZT"], ["UZ", "Узбекистан", "UZS"], ["KG", "Кыргызстан", "KGS"], ["TJ", "Таджикистан", "TJS"], ["TM", "Туркменистан", "TMT"],
    ["RU", "Россия", "RUB"], ["BY", "Беларусь", "BYN"], ["UA", "Украина", "UAH"], ["AZ", "Азербайджан", "AZN"], ["GE", "Грузия", "GEL"], ["AM", "Армения", "AMD"],
    ["MN", "Монголия", "MNT"], ["TR", "Турция", "TRY"], ["CN", "Китай", "CNY"], ["KR", "Южная Корея", "KRW"], ["JP", "Япония", "JPY"], ["IN", "Индия", "INR"],
    ["US", "США", "USD"], ["CA", "Канада", "CAD"], ["GB", "Великобритания", "GBP"], ["DE", "Германия", "EUR"], ["FR", "Франция", "EUR"], ["IT", "Италия", "EUR"],
    ["ES", "Испания", "EUR"], ["NL", "Нидерланды", "EUR"], ["PL", "Польша", "PLN"], ["CZ", "Чехия", "CZK"], ["AU", "Австралия", "AUD"], ["SG", "Сингапур", "SGD"],
    ["AE", "ОАЭ", "AED"], ["XX", "Другая страна", "USD"]];
  const CIT = Object.fromEntries(CITIZENSHIPS.map(([c, n, cur]) => [c, { name: n, cur }]));
  const EU = new Set(["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO","CH"]);
  const GROUP_LABEL = { domestic: "для граждан страны", eu: "для граждан ЕС", international: "для иностранцев" };
  const nf = new Intl.NumberFormat("ru-RU");
  const $ = id => document.getElementById(id);

  const state = { degree: "bachelor", cit: "KZ", mode: "name", catalog: [], groups: {}, selected: null, openToken: 0, ctl: {}, rates: null };
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
    try { const v = JSON.parse(localStorage.getItem("ep6:" + k)); return v && Date.now() < v.e ? v.d : null; } catch { return null; }
  }
  function lsSet(k, d, ttl) {
    const put = () => localStorage.setItem("ep6:" + k, JSON.stringify({ e: Date.now() + ttl, d }));
    try { put(); } catch {
      try { // память браузера переполнена — удаляем самые старые записи EduPath
        const keys = Object.keys(localStorage).filter(x => x.startsWith("ep6:"));
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

  /* ---------- гражданство ---------- */
  function groupOf(cc) {
    const c = state.cit, u = String(cc || "").toUpperCase();
    if (!u || c === "XX") return "international";
    if (c === u) return "domestic";
    return EU.has(c) && EU.has(u) ? "eu" : "international";
  }
  function syncCitUI() {
    document.querySelectorAll("[data-cit-select]").forEach(sel => {
      if (!sel.options.length) sel.innerHTML = CITIZENSHIPS.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join("");
      sel.value = state.cit;
    });
  }
  function setCitizenship(cc, opts) {
    if (!CIT[cc] || cc === state.cit) { syncCitUI(); return; }
    const before = state.selected ? groupOf(state.selected.countryCode) : null;
    state.cit = cc;
    try { localStorage.setItem("ep6:cit", cc); } catch { /* ignore */ }
    if (!opts?.fromSync) window.EduAuth?.saveProfilePrefs?.({ citizenship: cc });
    const u = new URL(location.href); u.searchParams.set("cit", cc); history.replaceState(null, "", u);
    syncCitUI(); refreshCardFacts();
    if (state.selected) {
      // поиск не повторяется: Worker берёт уже найденные страницы и разбирает их для другой группы
      if (groupOf(state.selected.countryCode) !== before) loadAdmissions(state.selected, false);
      loadLife(state.selected, false);
    }
  }

  /* ---------- уровень обучения ---------- */
  function syncDegreeUI() {
    document.querySelectorAll("[data-degree-switch] button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.degree === state.degree)));
    if ($("filterDegree")) $("filterDegree").value = state.degree;
  }
  function setDegree(deg, { silent = false, fromSync = false } = {}) {
    const opts = { fromSync };
    if (!DEGREES[deg] || (deg === state.degree && !silent)) { syncDegreeUI(); return; }
    state.degree = deg;
    try { localStorage.setItem("ep6:degree", deg); } catch { /* ignore */ }
    if (!opts?.fromSync) window.EduAuth?.saveProfilePrefs?.({ degree: deg });
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
  const summaryFor = u => { const g = state.groups[groupOf(u.countryCode)] || {}; return g[norm(u.name)] || (u.id && g[u.id]) || null; };

  function factsHtml(u) {
    const s = summaryFor(u);
    if (s && s.offered === false) return `<div class="not-offered">По данным сайта, уровня «${esc(DEGREES[state.degree])}» нет</div>`;
    const row = (label, v, title = "") => `<div${title ? ` title="${esc(title)}"` : ""}><dt>${label}</dt><dd class="${v ? "" : "none"}">${esc(v || "—")}</dd></div>`;
    const grp = u.countryCode ? GROUP_LABEL[groupOf(u.countryCode)] : null;
    const short = v => v && v.length > 42 ? v.slice(0, 40) + "…" : v;
    return `<dl class="card-facts">${row("Условия", grp, `Гражданство: ${CIT[state.cit]?.name || ""}`)}${row("Подача", short(s?.type), s?.type || "")}${row("Дедлайн", s?.nextDeadline?.display || s?.nextDeadline?.date)}${row("Обучение", short(s?.tuition), s?.tuition || "")}${row("Приём", s?.acceptanceRate)}</dl>`;
  }
  function renderCards(items, track, opts = {}) {
    track.innerHTML = "";
    if (!items.length) { track.innerHTML = `<div class="empty-state">${esc(opts.empty || "Ничего не найдено.")}</div>`; return; }
    for (const uni of items) {
      const card = document.createElement("article");
      card.tabIndex = 0; card.setAttribute("role", "button"); card.dataset.key = uniKey(uni); card.dataset.name = norm(uni.name); card.dataset.cc = uni.countryCode || "";
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
      const fake = { name: card.querySelector("h3")?.textContent || "", id: card.dataset.key.startsWith("https://") ? card.dataset.key : null, countryCode: card.dataset.cc || "" };
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
    $("cardsSubheading").textContent = "Условия, подача, дедлайн, цена обучения и процент приёма — для выбранного уровня и гражданства";
    renderCards(state.catalog, $("cardsTrack"), { empty: "Каталог пуст." });
  }
  async function loadSummary(force) {
    const deg = state.degree, cached = !force && lsGet("sum:" + deg);
    if (cached) { state.groups = cached; refreshCardFacts(); return; }
    try {
      const data = await api("/catalog-status", { body: { degree: deg }, timeout: 20000 });
      if (deg !== state.degree) return;
      state.groups = data.groups || {};
      lsSet("sum:" + deg, state.groups, LS_TTL.sum);
      refreshCardFacts();
    } catch (e) { console.warn("catalog-status", e.message); }
  }
  function rememberSummary(u, adm) {
    if (adm.degree !== state.degree) return;
    const entry = { name: u.name, type: adm.application?.type || null, nextDeadline: adm.application?.nextDeadline || null,
      acceptanceRate: adm.acceptanceRate || null, tuition: adm.financial?.tuition || null, offered: adm.offered };
    const g = state.groups[adm.group] = state.groups[adm.group] || {};
    g[norm(u.name)] = entry; if (u.id) g[u.id] = entry;
    lsSet("sum:" + state.degree, state.groups, LS_TTL.sum); refreshCardFacts();
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
        <section class="detail-section"><h3>1. Условия поступления — <span class="dDegreeName"></span></h3><span class="group-chip" id="dGroup"></span><div id="admReq">${loadingHtml("Читаем официальный сайт вуза…")}</div></section>
        <section class="detail-section"><h3>2. Тип подачи и дедлайны</h3><div id="admApp">${loadingHtml("Ищем дедлайны…")}</div></section>
        <section class="detail-section"><h3>3. Стоимость и финансовая помощь</h3><div id="admFin">${loadingHtml("Ищем стоимость и стипендии…")}</div></section>
        <section class="detail-section"><h3>4. Сколько стоит жизнь${u.city ? ": " + esc(u.city) : ""}</h3><div id="lifeCity">${loadingHtml("Считаем бюджет студента в месяц…")}</div><div id="cityClimate"></div></section>
        <section class="detail-section"><h3>5. Страна${u.country ? ": " + esc(u.country) : ""}</h3><div id="countryStats">${loadingHtml("…")}</div><div id="lifeCountry"></div></section>
        <section class="detail-section"><h3>6. Академическая среда</h3><div id="admAcademic">${loadingHtml("…")}</div></section>
      </div><aside>
        <section class="detail-section"><h3>7. Местоположение и Google Maps</h3><div id="dMap">${mapHtml(u)}</div></section>
        <section class="detail-section"><h3>8. Изображения</h3><div id="dPhotos">${loadingHtml("Ищем фотографии кампуса…")}</div></section>
        <section class="detail-section"><h3>9. Источники</h3><div id="dSources" class="sources">${loadingHtml("…")}</div></section>
      </aside></div>
      <div class="disclaimer">Справка собрана автоматически. Требования и дедлайны зависят от программы, гражданства и года набора. «Нет подтверждённых данных» значит «не нашли», а не «не требуется». Перед подачей проверь на официальном сайте.</div></article>`;
    syncDegreeUI(); paintGroup();
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
      website: d.website || u.website, domain: d.domain || u.domain, countryCode: d.countryCode || u.countryCode, lat: d.location?.latitude ?? u.lat, lng: d.location?.longitude ?? u.lng });
    state.countryInfo = d.countryInfo || null;
    paintGroup();
    $("dName").textContent = u.name;
    $("dLocation").textContent = "📍 " + (place(u) || "Местоположение уточняется") + (d.established ? ` · основан в ${d.established}` : "");
    $("dEyebrow").textContent = `University dossier · ${u.domain || "сайт не найден"}`;
    if (!$("dActions").querySelector('a[href="' + safeUrl(u.website) + '"]') && safeUrl(u.website)) $("dLinks").insertAdjacentHTML("beforebegin", linkBtn("Официальный сайт", u.website));
    set("dAbout", d.about?.text ? `<p class="about-text">${esc(d.about.text)} ${safeUrl(d.about.url) ? `<a class="source-link" href="${esc(safeUrl(d.about.url))}" target="_blank" rel="noopener noreferrer">Википедия ↗</a>` : ""}</p>` : "");
    set("dMap", mapHtml(u));
    const photos = (d.photos || []).filter(p => safeUrl(p.url));
    set("dPhotos", photos.length ? `<div class="photo-grid">${photos.map((p, i) => `<figure class="photo-fig"><img src="${esc(safeUrl(p.url))}" alt="${esc(p.title || "Кампус " + (i + 1))}" loading="lazy" referrerpolicy="no-referrer"><figcaption>${esc([p.author, p.license].filter(Boolean).join(" · "))}${safeUrl(p.page) ? ` <a href="${esc(safeUrl(p.page))}" target="_blank" rel="noopener noreferrer">Commons ↗</a>` : ""}</figcaption></figure>`).join("")}</div><p class="muted">Фото — Wikimedia Commons, авторы и лицензии под снимками.</p>` : '<p class="muted">Свободных фотографий кампуса не нашлось.</p>');
    set("cityClimate", climateHtml(d.climate));
    const c = d.countryInfo || {};
    set("countryStats", c.currencies?.length || c.languages?.length
      ? `<div class="stat-grid">${box("Валюта", (c.currencies || []).join(", ") + (c.currencyCode ? ` (${c.currencyCode})` : ""))}${box("Официальные языки", (c.languages || []).join(", "))}${box("Столица", c.capital)}</div><p class="muted">Источник: Wikidata.</p>`
      : '<p class="muted">Данные о стране временно недоступны.</p>');
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
    set("admReq", offered + fallback + subCards(a.requirements, x => `<div class="sub-card"><strong>${esc(x.name)}: ${esc(x.value)}</strong>${badge(x.official)}<br>${x.program ? `Программа: ${esc(x.program)}. ` : ""}${x.notes ? esc(x.notes) : ""}${srcLink(x.sourceUrl)}</div>`,
      "Требования не найдены на страницах вуза. Это не значит, что экзамены не нужны.") + (a.acceptanceRate ? box("Процент приёма", a.acceptanceRate) : "") + diag);
    const app = a.application || {};
    set("admApp", `<div class="info-grid">${box("Тип подачи", app.type)}${box("Стоимость заявки", app.applicationFee)}</div>` +
      subCards(app.deadlines, x => `<div class="sub-card"><span class="deadline-dot ${dotClass(x.date)}"></span> <strong>${esc(x.label)}: ${esc(x.display || x.date)}</strong>${badge(x.official)}<br>${[x.program, x.intake].filter(Boolean).map(esc).join(" · ")}${srcLink(x.sourceUrl)}</div>`, "Дедлайны не найдены."));
    const f = a.financial || {};
    set("admFin", `<div class="info-grid">${box("Обучение — " + (a.groupLabel || ""), f.tuition)}${box("Проживание (от вуза)", f.accommodation)}${box("Расходы на жизнь (по данным вуза)", f.livingExpenses)}${box("Полная стоимость года", f.totalCostOfAttendance)}</div>` +
      subCards(f.scholarships, x => `<div class="sub-card"><strong>${esc(x.name)}</strong>${badge(x.official)}<br>${[x.value, x.eligibility, x.deadline].filter(Boolean).map(esc).join(" · ")}${srcLink(x.sourceUrl)}</div>`, "Стипендии не найдены."));
    set("admAcademic", `<strong>Сильные направления</strong>${list(a.academic?.strongFields)}<strong>Чем известен</strong>${list(a.academic?.highlights)}`);
    const l = a.links || {};
    set("dLinks", [linkBtn("Приёмная комиссия", l.admissions), linkBtn("Подача заявления", l.application), linkBtn("Иностранным студентам", l.internationalStudents),
      linkBtn("Финансовая помощь", l.financialAid), linkBtn("Стипендии", l.scholarships), linkBtn("Общежитие", l.accommodation)].join(""));
    const src = (a.sources || []).filter(s => safeUrl(s.url));
    set("dSources", src.length ? src.map((s, i) => `<a class="source-link" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">[${i + 1}] ${esc(s.title || s.url)} ↗</a>${badge(s.official)}`).join("") : '<span class="muted">Источники не получены.</span>');
    rememberSummary(state.selected, a);
  }

  function paintGroup() {
    const u = state.selected; if (!u || !$("dGroup")) return;
    const g = u.countryCode ? groupOf(u.countryCode) : null;
    $("dGroup").textContent = g ? `Гражданство: ${CIT[state.cit]?.name} → условия ${GROUP_LABEL[g]}` : `Гражданство: ${CIT[state.cit]?.name}`;
  }
  const SYM = { KZT: "₸", RUB: "₽", USD: "$", EUR: "€", GBP: "£", UZS: "сум", KGS: "сом", TRY: "₺", CNY: "¥", JPY: "¥", KRW: "₩", INR: "₹", UAH: "₴", AZN: "₼", GEL: "₾", PLN: "zł" };
  const money = (n, cur) => `${nf.format(Math.round(n))} ${SYM[cur] || cur}`;
  function moneyRange(r, cur) { return !r ? null : r.min === r.max ? money(r.min, cur) : `${money(r.min, cur)} – ${money(r.max, cur)}`; }
  // пересчёт в валюту гражданства пользователя (тенге для Казахстана)
  function convert(r, from) {
    const to = CIT[state.cit]?.cur || "USD", rates = state.rates?.rates;
    if (!r || !rates || from === to || !rates[from] || !rates[to]) return null;
    const k = rates[to] / rates[from], round = v => { const x = v * k; const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(x)) - 1)); return Math.round(x / p) * p; };
    return "≈ " + moneyRange({ min: round(r.min), max: round(r.max) }, to);
  }
  function fillLife(data) {
    const l = data?.life;
    if (!l) { set("lifeCity", '<p class="muted">Город и страна неизвестны.</p>'); return; }
    if (l.rates) state.rates = l.rates;
    const c = l.cost, srcs = arr => (arr || []).filter(safeUrl).map(u => `<a class="source-link" href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer">${esc(hostOf(u))} ↗</a>`).join(" · ");
    if (!c) set("lifeCity", '<p class="muted">Не нашли надёжных цифр о стоимости жизни в этом городе.</p>');
    else {
      const cur = c.currency, row = (label, r, note) => r ? `<tr><td>${label}${note ? `<small>${esc(note)}</small>` : ""}</td><td>${esc(moneyRange(r, cur))}${convert(r, cur) ? `<small>${esc(convert(r, cur))}</small>` : ""}</td></tr>` : "";
      const lvl = c.level ? `<span class="level-badge level-${esc(c.level.split(" ")[0])}">Уровень цен: ${esc(c.level)}</span>` : "";
      set("lifeCity", `<div class="cost-head">${c.monthlyTotal ? `<span class="cost-total">${esc(moneyRange(c.monthlyTotal, cur))} в месяц</span>${convert(c.monthlyTotal, cur) ? `<span class="cost-conv">${esc(convert(c.monthlyTotal, cur))}</span>` : ""}` : ""}${lvl}</div>
        <table class="cost-table">${row("Аренда жилья", c.rent, c.rentNote)}${row("Еда и продукты", c.food)}${row("Транспорт", c.transport)}${row("Коммунальные услуги и связь", c.utilities)}</table>
        <p class="muted">Бюджет одного студента, живущего отдельно${c.monthlyTotal?.summed ? " (сумма найденных статей)" : ""}. ${esc(c.note || "")}${c.usdPerMonth ? ` Уровень считается по сумме ≈ ${nf.format(c.usdPerMonth)} USD в месяц: до 450 — низкий, до 900 — средний, до 1500 — высокий, выше — очень высокий.` : ""}</p>
        <p class="diag-line">Источники: ${srcs(c.sources) || "—"}${l.rates?.updated ? ` · курс от ${new Date(l.rates.updated).toLocaleDateString()}` : ""}</p>`);
    }
    if (l.group === "domestic") set("lifeCountry", `<div class="domestic-note">Ты гражданин этой страны: студенческая виза и разрешение на работу не нужны.</div>`);
    else if (l.visa) set("lifeCountry", `<h4>Виза и работа для иностранных студентов</h4><div class="info-grid">${box("Виза", l.visa.visa)}${box("Работа во время учёбы", l.visa.work)}${box("Медицинская страховка", l.visa.insurance)}</div>
        <p class="diag-line">Общие правила для иностранцев${l.group === "eu" ? " (для граждан ЕС обычно проще)" : ""} — для гражданства «${esc(CIT[state.cit]?.name)}» уточни на сайте посольства. Источники: ${srcs(l.visa.sources) || "—"}</p>`);
    else set("lifeCountry", '<p class="muted">Правила о визе и работе не найдены.</p>');
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
    const deg = state.degree, grp = groupOf(u.countryCode), key = `adm:${deg}:${grp}:` + uniKey(u), token = state.openToken;
    paintGroup();
    ["admReq", "admApp", "admFin"].forEach(id => set(id, loadingHtml(id === "admReq" ? `Читаем официальный сайт вуза (${DEGREES[deg]})… обычно 10–40 секунд, повторно — мгновенно` : "…")));
    set("admAcademic", loadingHtml("…")); set("dLinks", ""); set("dSources", loadingHtml("…"));
    document.querySelectorAll(".dDegreeName").forEach(el => el.textContent = DEGREES[deg]);
    const cached = !refresh && lsGet(key);
    if (cached) { fillAdmissions(cached); return; }
    try {
      const data = await api("/details/admissions", { body: { id: u.id || "", name: u.name, city: u.city || "", country: u.country || "", countryCode: u.countryCode || "", website: u.website || "", degree: deg, citizenship: state.cit, refresh }, signal: newCtl("adm"), timeout: 110000 });
      if (token !== state.openToken || deg !== state.degree || grp !== groupOf(u.countryCode)) return;
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
    const grp = groupOf(u.countryCode), key = "life:" + norm(u.city) + "|" + norm(u.country) + "|" + grp, token = state.openToken, cit = state.cit;
    const cached = !refresh && (u.city || u.country) && lsGet(key);
    if (cached) { fillLife(cached); return; }
    try {
      const data = await api("/details/life", { body: { id: u.id || "", name: u.name, city: u.city || "", country: u.country || "", countryCode: u.countryCode || "", citizenship: cit, refresh }, signal: newCtl("life"), timeout: 90000 });
      if (token !== state.openToken || cit !== state.cit) return;
      if (data.meta?.ai && data.life) lsSet(key, data, LS_TTL.life);
      if (data.life && !data.meta?.ai && !data.life.cost) { set("lifeCity", errorHtml("Не удалось посчитать стоимость жизни.", "retryLife", "Повтор не тратит лимиты поиска.")); $("retryLife").addEventListener("click", () => loadLife(state.selected, false)); return; }
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
      const data = await api("/search", { body: { mode: "criteria", degree: state.degree, citizenship: state.cit, filters, limit: 20 }, signal: newCtl("criteria"), timeout: 110000 });
      const items = data.candidates || [];
      $("cardsHeading").textContent = "Подборка по твоим условиям";
      $("cardsSubheading").textContent = `Найдено ${items.length} · уровень: ${DEGREES[state.degree]} · гражданство: ${CIT[state.cit]?.name} · каждый вуз подтверждён реестром ROR`;
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
      : "Заполни только важные для тебя поля. Уровень обучения и гражданство берутся из выбора вверху.";
  }

  function init() {
    if (!$("cardsTrack")) return;
    const params = new URLSearchParams(location.search);
    let deg = params.get("degree"), cit = (params.get("cit") || "").toUpperCase();
    try { deg = deg || localStorage.getItem("ep6:degree"); cit = cit || localStorage.getItem("ep6:cit") || ""; } catch { /* ignore */ }
    state.degree = DEGREES[deg] ? deg : "bachelor";
    state.cit = CIT[cit] ? cit : "KZ";
    syncDegreeUI(); syncCitUI();
    document.querySelectorAll("[data-cit-select]").forEach(sel => sel.addEventListener("change", e => setCitizenship(e.target.value)));
    document.querySelectorAll(".search-panel [data-degree-switch] button").forEach(b => b.addEventListener("click", () => setDegree(b.dataset.degree)));
    $("filterDegree")?.addEventListener("change", e => setDegree(e.target.value));
    // после входа значения из аккаунта могут отличаться от сохранённых на этом устройстве
    window.addEventListener("edupath-prefs-sync", e => {
      const d = e.detail || {};
      if (d.citizenship && CIT[d.citizenship] && d.citizenship !== state.cit) setCitizenship(d.citizenship, { fromSync: true });
      if (d.degree && DEGREES[d.degree] && d.degree !== state.degree) setDegree(d.degree, { fromSync: true });
    });
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
