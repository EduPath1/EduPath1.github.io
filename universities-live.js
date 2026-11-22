(() => {
  "use strict";
  /* EduPath — страница «Университеты», v7 (тексты на 5 языках: universities-i18n.js) */
  const T = (k, v) => (window.UT ? window.UT(k, v) : k);
  const LANG = () => (window.UT ? window.UT.lang() : "ru");
  const SEARCH_API = "https://edupath-university-search.muqiyatalkar.workers.dev";
  const CATALOG_URL = "catalog.json";
  const DEG_KEYS = ["foundation", "bachelor", "master", "phd"];
  // DEGREES[k] — название уровня на текущем языке
  const DEGREES = new Proxy({}, { get: (o, k) => (DEG_KEYS.includes(k) ? T("deg_" + k) : undefined), has: (o, k) => DEG_KEYS.includes(k), ownKeys: () => DEG_KEYS, getOwnPropertyDescriptor: (o, k) => (DEG_KEYS.includes(k) ? { enumerable: true, configurable: true, value: T("deg_" + k) } : undefined) });
  const MATCH_KEYS = ["close", "accessible", "value", "funding", "academic"];
  const matchLabel = k => (MATCH_KEYS.includes(k) ? T("match_" + k) : T("match_default"));
  const monthName = m => { try { return new Intl.DateTimeFormat(window.UT ? window.UT.locale() : "ru-RU", { month: "short" }).format(new Date(2026, m - 1, 15)); } catch { return String(m); } };
  const DAY = 86400000;
  const LS_TTL = { base: 14 * DAY, adm: 7 * DAY, life: 14 * DAY, sum: 6 * 3600000, rates: 12 * 3600000 };
  // Гражданство абитуриента: [код ISO, название, валюта для пересчёта бюджета]
  const CITIZENSHIPS = [["KZ", "Казахстан", "KZT"], ["UZ", "Узбекистан", "UZS"], ["KG", "Кыргызстан", "KGS"], ["TJ", "Таджикистан", "TJS"], ["TM", "Туркменистан", "TMT"],
    ["RU", "Россия", "RUB"], ["BY", "Беларусь", "BYN"], ["UA", "Украина", "UAH"], ["AZ", "Азербайджан", "AZN"], ["GE", "Грузия", "GEL"], ["AM", "Армения", "AMD"],
    ["MN", "Монголия", "MNT"], ["TR", "Турция", "TRY"], ["CN", "Китай", "CNY"], ["KR", "Южная Корея", "KRW"], ["JP", "Япония", "JPY"], ["IN", "Индия", "INR"],
    ["US", "США", "USD"], ["CA", "Канада", "CAD"], ["GB", "Великобритания", "GBP"], ["DE", "Германия", "EUR"], ["FR", "Франция", "EUR"], ["IT", "Италия", "EUR"],
    ["ES", "Испания", "EUR"], ["NL", "Нидерланды", "EUR"], ["PL", "Польша", "PLN"], ["CZ", "Чехия", "CZK"], ["AU", "Австралия", "AUD"], ["SG", "Сингапур", "SGD"],
    ["AE", "ОАЭ", "AED"], ["XX", "Другая страна", "USD"]];
  // name — название страны на языке интерфейса
  const CIT = Object.fromEntries(CITIZENSHIPS.map(([c, n, cur]) => [c, { get name() { return window.UT ? window.UT.country(c, n) : n; }, cur }]));
  const EU = new Set(["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO","CH"]);
  const GROUP_LABEL = { get domestic() { return T("grp_domestic"); }, get eu() { return T("grp_eu"); }, get international() { return T("grp_international"); } };
  const nf = { format: v => new Intl.NumberFormat(window.UT ? window.UT.locale() : "ru-RU").format(v) };
  const fmtDate = d => new Date(d).toLocaleDateString(window.UT ? window.UT.locale() : "ru-RU");
  const countryName = u => (u?.countryCode ? (window.UT ? window.UT.country(u.countryCode, u.country) : u.country) : u?.country);
  const $ = id => document.getElementById(id);

  const state = { degree: "bachelor", cit: "KZ", mode: "name", catalog: [], groups: {}, selected: null, openToken: 0, ctl: {}, rates: null };
  let suggestTimer = null, suggestItems = [], activeIdx = -1;
  const suggestMemo = new Map();

  /* ---------- утилиты ---------- */
  const esc = v => String(v ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const safeUrl = v => { try { const u = new URL(v); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
  const norm = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/^the /, "").trim();
  const uniKey = u => u?.id || norm(u?.name) + "|" + norm(u?.country);
  const place = u => [u?.city, countryName(u)].filter(Boolean).join(", ");
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
      if (!res.ok) throw new Error(data.error || T("server_error", { s: res.status }));
      return data;
    } catch (e) {
      if (ctl.signal.aborted && ctl.signal.reason === "timeout") throw new Error(T("timeout"));
      if (e instanceof TypeError) throw new Error(T("network_error"));
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
      if (!sel.options.length || sel.dataset.lang !== LANG()) { sel.innerHTML = CITIZENSHIPS.map(([c]) => `<option value="${c}">${esc(CIT[c].name)}</option>`).join(""); sel.dataset.lang = LANG(); }
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
    if (s && s.offered === false) return `<div class="not-offered">${esc(T("not_offered", { d: DEGREES[state.degree] }))}</div>`;
    const row = (label, v, title = "") => `<div${title ? ` title="${esc(title)}"` : ""}><dt>${label}</dt><dd class="${v ? "" : "none"}">${esc(v || "—")}</dd></div>`;
    const grp = u.countryCode ? GROUP_LABEL[groupOf(u.countryCode)] : null;
    const short = v => v && v.length > 42 ? v.slice(0, 40) + "…" : v;
    return `<dl class="card-facts">${row(T("f_conditions"), grp, T("cit_title", { c: CIT[state.cit]?.name || "" }))}${row(T("f_apply"), short(s?.type), s?.type || "")}${row(T("f_deadline"), s?.nextDeadline?.display || s?.nextDeadline?.date)}${row(T("f_tuition"), short(s?.tuition), s?.tuition || "")}${row(T("f_accept"), s?.acceptanceRate)}</dl>`;
  }
  function renderCards(items, track, opts = {}) {
    track.innerHTML = "";
    if (!items.length) { track.innerHTML = `<div class="empty-state">${esc(opts.empty || T("nothing_found"))}</div>`; return; }
    for (const uni of items) {
      const card = document.createElement("article");
      card.tabIndex = 0; card.setAttribute("role", "button"); card.dataset.key = uniKey(uni); card.dataset.name = norm(uni.name); card.dataset.cc = uni.countryCode || "";
      card.className = "uni-card result-card" + (state.selected && uniKey(state.selected) === uniKey(uni) ? " selected" : "");
      const site = safeUrl(uni.website);
      const siteHtml = site ? `<a class="result-link" href="${esc(site)}" target="_blank" rel="noopener noreferrer">${esc(T("official_site", { d: uni.domain || hostOf(site) }))}</a>`
        : `<span class="result-link missing">${esc(T("site_not_found"))}</span>`;
      const s = summaryFor(uni);
      card.innerHTML = `<div class="card-top"><span class="country-pill">${esc(countryName(uni) || T("country_tbd"))}</span><span class="deadline-dot ${dotClass(s?.nextDeadline?.date)}" title="${esc(T("dot_title"))}"></span></div>
        <h3>${esc(uni.name)}</h3><div class="card-location">📍 ${esc(uni.city || T("city_tbd"))}</div>
        ${opts.reason && uni.reason ? `<div class="card-reason">${esc(uni.reason)}</div>` : ""}
        ${opts.showMatch && uni.matchType ? `<span class="match-chip">${esc(matchLabel(uni.matchType))}</span>` : ""}
        <div class="card-facts-wrap">${factsHtml(uni)}</div>
        <div class="card-foot">${siteHtml}<span>${esc(T("dossier"))}</span></div>`;
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
      $("cardsTrack").innerHTML = `<div class="loading-panel error-text">${esc(T("catalog_load_error", { e: e.message }))}</div>`;
      return;
    }
    showCatalog();
    loadSummary(false);
  }
  function showCatalog() {
    state.view = "catalog";
    $("cardsHeading").textContent = T("catalog_heading", { n: state.catalog.length });
    $("cardsSubheading").textContent = T("catalog_sub");
    renderCards(state.catalog, $("cardsTrack"), { empty: T("catalog_empty") });
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
      ? items.map((u, i) => `<div class="suggest-item" role="option" data-i="${i}"><strong>${esc(u.name)}</strong><span>${esc(place(u) || T("place_unknown"))}${u.domain ? " · " + esc(u.domain) : ""}</span></div>`).join("")
      : `<div class="suggest-empty">${esc(T("suggest_none", { q: query }))}</div>`;
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
    state.view = "results"; state.lastResults = { results, query };
    $("cardsHeading").textContent = results.length === 1 ? T("results_one") : T("results_many");
    $("cardsSubheading").innerHTML = `${esc(T("results_sub", { q: query }))}<a href="#" id="backToCatalog" class="source-link">${esc(T("back_to_catalog"))}</a>`;
    $("backToCatalog").addEventListener("click", e => { e.preventDefault(); showCatalog(); });
    renderCards(results, $("cardsTrack"), { empty: T("results_empty") });
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
    if (q.length < 2) { status(T("min2"), true); return; }
    $("searchBtn").disabled = true; status(T("searching"));
    try {
      const results = await fetchSuggest(q, newCtl("suggest"));
      showResults(results, q);
      status(results.length ? T("found", { n: results.length }) : T("uni_not_found"), !results.length);
      if (results.length === 1) openUniversity(results[0]);
    } catch (e) { if (!isCancel(e)) status(e.message, true); }
    finally { $("searchBtn").disabled = false; }
  }

  /* ---------- досье ---------- */
  function box(label, value) {
    const NO = T("no_data");
    const text = value === null || value === undefined || value === "" ? NO : String(value);
    return `<div class="info-box"><small>${esc(label)}</small><strong class="${text === NO ? "unknown" : ""}">${esc(text)}</strong></div>`;
  }
  const badge = off => off === false ? `<span class="badge-unofficial">${esc(T("badge_unofficial"))}</span>` : off === true ? `<span class="badge-official">${esc(T("badge_official"))}</span>` : "";
  const srcLink = (url, label = T("source")) => safeUrl(url) ? `<div><a class="source-link" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a></div>` : "";
  const linkBtn = (label, url) => safeUrl(url) ? `<a class="action-btn" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : "";
  const list = (items, empty = T("no_info")) => Array.isArray(items) && items.length ? `<ul class="plain-list">${items.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="muted">${esc(empty)}</p>`;
  const subCards = (items, render, empty = T("no_info")) => Array.isArray(items) && items.length ? `<div class="sub-list">${items.map(render).join("")}</div>` : `<p class="muted">${esc(empty)}</p>`;
  const num = (v, suffix = "") => v && Number.isFinite(v.value) ? `${nf.format(v.value)}${suffix} (${v.year})` : null;
  const loadingHtml = text => `<div class="sec-loading">${esc(text)}</div>`;
  function errorHtml(msg, retryId, hint) {
    return `<div class="sec-error"><span>${esc(msg)}</span>${hint ? `<span class="muted">${esc(hint)}</span>` : ""}<button class="secondary-btn" type="button" id="${retryId}">${esc(T("retry"))}</button></div>`;
  }
  const set = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };

  function mapHtml(u) {
    const has = Number.isFinite(u.lat) && Number.isFinite(u.lng);
    const q = has ? `${u.lat},${u.lng}` : encodeURIComponent([u.name, u.city, u.country].filter(Boolean).join(", "));
    return `<iframe class="map-frame" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${q}${has ? "&z=14" : ""}&output=embed" title="${esc(T("map_title"))}"></iframe>
      <p class="muted">${esc(place(u))} · <a class="source-link" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener noreferrer">${esc(T("open_maps"))}</a></p>`;
  }
  // описание климата собираем на языке интерфейса из помесячных данных
  function climateSummary(c) {
    if (LANG() === "ru" || !c.months?.length) return c.summary || "";
    const ms = c.months, avg = ms.reduce((s, x) => s + x.t, 0) / ms.length;
    const warm = ms.reduce((a, b) => b.t > a.t ? b : a), cold = ms.reduce((a, b) => b.t < a.t ? b : a), rain = ms.reduce((s, x) => s + x.p, 0);
    const long = m => { try { return new Intl.DateTimeFormat(window.UT.locale(), { month: "long" }).format(new Date(2026, m - 1, 15)); } catch { return String(m); } };
    return T("climate_sum", { y: c.year || "", a: avg.toFixed(1), w: long(warm.m), wt: warm.t, c: long(cold.m), ct: cold.t, r: nf.format(rain) });
  }
  function climateHtml(c) {
    if (!c?.months?.length) return "";
    const temps = c.months.map(m => m.t), lo = Math.min(...temps), span = Math.max(Math.max(...temps) - lo, 1);
    return `<div class="month-bars" aria-label="${esc(T("temp_aria"))}">${c.months.map(m => `<div class="mbar ${m.t < 5 ? "cold" : ""}" title="${esc(monthName(m.m))}: ${m.t} °C, ${esc(T("precip", { p: m.p }))}"><small>${Math.round(m.t)}°</small><i style="height:${18 + Math.round(((m.t - lo) / span) * 82)}%"></i><b>${esc(monthName(m.m))}</b></div>`).join("")}</div>
      <p class="muted">${esc(climateSummary(c))} ${esc(T("source_colon"))} <a class="source-link" href="${esc(safeUrl(c.source?.url))}" target="_blank" rel="noopener noreferrer">${esc(c.source?.name || "Open-Meteo")}</a>.</p>`;
  }

  function renderShell(u) {
    $("emptyState").style.display = "none";
    $("detailContent").innerHTML = `<article class="detail-card">
      <header class="detail-head"><div class="eyebrow" id="dEyebrow">${esc(T("eyebrow"))}</div><h2 id="dName">${esc(u.name)}</h2>
        <div class="detail-location" id="dLocation">📍 ${esc(place(u) || T("location_tbd"))}</div>
        <div class="degree-switch" data-degree-switch role="radiogroup" aria-label="${esc(T("degree_label"))}">${DEG_KEYS.map(k => `<button type="button" role="radio" data-degree="${k}">${esc(DEGREES[k])}</button>`).join("")}</div>
        <div class="detail-actions" id="dActions">${linkBtn(T("official_btn"), u.website)}<span id="dLinks"></span><button class="action-btn accent" id="similarBtn" type="button">${esc(T("similar_btn"))}</button><button class="action-btn" id="saveUniBtn" type="button">${esc(T("save_btn"))}</button><button class="action-btn" id="refreshUniBtn" type="button" title="${esc(T("refresh_title"))}">${esc(T("refresh_data"))}</button></div></header>
      <div class="detail-grid"><div>
        <div id="dAbout"></div>
        <section class="detail-section"><h3>${esc(T("sec1"))}<span class="dDegreeName"></span></h3><span class="group-chip" id="dGroup"></span><div id="admReq">${loadingHtml(T("ld_reading"))}</div></section>
        <section class="detail-section"><h3>${esc(T("sec2"))}</h3><div id="admApp">${loadingHtml(T("ld_deadlines"))}</div></section>
        <section class="detail-section"><h3>${esc(T("sec3"))}</h3><div id="admFin">${loadingHtml(T("ld_cost"))}</div></section>
        <section class="detail-section"><h3>${esc(T("sec4"))}${u.city ? ": " + esc(u.city) : ""}</h3><div id="lifeCity">${loadingHtml(T("ld_life"))}</div><div id="cityClimate"></div></section>
        <section class="detail-section"><h3>${esc(T("sec5"))}${countryName(u) ? ": " + esc(countryName(u)) : ""}</h3><div id="countryStats">${loadingHtml("…")}</div><div id="lifeCountry"></div></section>
        <section class="detail-section"><h3>${esc(T("sec6"))}</h3><div id="admAcademic">${loadingHtml("…")}</div></section>
      </div><aside>
        <section class="detail-section"><h3>${esc(T("sec7"))}</h3><div id="dMap">${mapHtml(u)}</div></section>
        <section class="detail-section"><h3>${esc(T("sec8"))}</h3><div id="dPhotos">${loadingHtml(T("ld_photos"))}</div></section>
        <section class="detail-section"><h3>${esc(T("sec9"))}</h3><div id="dSources" class="sources">${loadingHtml("…")}</div></section>
      </aside></div>
      <div class="disclaimer">${esc(T("disclaimer"))}${LANG() !== "ru" ? " " + esc(T("server_lang_note")) : ""}</div></article>`;
    syncDegreeUI(); paintGroup();
    document.querySelectorAll(".dDegreeName").forEach(el => el.textContent = DEGREES[state.degree]);
    $("detailContent").querySelectorAll("[data-degree-switch] button").forEach(b => b.addEventListener("click", () => setDegree(b.dataset.degree)));
    $("similarBtn").addEventListener("click", () => loadSimilar(state.selected));
    $("refreshUniBtn").addEventListener("click", () => openUniversity(state.selected, { refresh: true, keepSimilar: !$("similarSection").hidden }));
    setupSave(u);
  }

  function setupSave(u) {
    const btn = $("saveUniBtn"), auth = window.EduAuth;
    const paint = s => { btn.textContent = s ? T("saved_btn") : T("save_btn"); };
    paint(!!auth?.isSaved?.(u.name));
    auth?.getSaved?.().then(() => paint(!!auth.isSaved(state.selected?.name))).catch?.(() => {});
    btn.onclick = async () => {
      if (!auth?.isLoggedIn?.()) { auth?.showToast?.(T("login_to_save"), "info"); auth?.openModal?.("login"); return; }
      const cur = state.selected;
      const r = await auth.toggleSave({ name: cur.name, country: cur.country || "", city: cur.city || "" });
      if (r?.ok) { paint(!!r.added); auth.showToast?.(r.added ? T("saved_toast") : T("removed_toast"), "success"); }
      else auth?.showToast?.(r?.error || T("save_fail"), "error");
    };
  }

  function fillBase(d) {
    const u = state.selected;
    Object.assign(u, { id: d.id || u.id, name: d.name || u.name, city: d.city || u.city, country: d.country || u.country,
      website: d.website || u.website, domain: d.domain || u.domain, countryCode: d.countryCode || u.countryCode, lat: d.location?.latitude ?? u.lat, lng: d.location?.longitude ?? u.lng });
    state.countryInfo = d.countryInfo || null;
    paintGroup();
    $("dName").textContent = u.name;
    $("dLocation").textContent = "📍 " + (place(u) || T("location_tbd")) + (d.established ? " · " + T("founded", { y: d.established }) : "");
    $("dEyebrow").textContent = `${T("eyebrow")} · ${u.domain || T("site_missing")}`;
    if (!$("dActions").querySelector('a[href="' + safeUrl(u.website) + '"]') && safeUrl(u.website)) $("dLinks").insertAdjacentHTML("beforebegin", linkBtn(T("official_btn"), u.website));
    set("dAbout", d.about?.text ? `<p class="about-text">${esc(d.about.text)} ${safeUrl(d.about.url) ? `<a class="source-link" href="${esc(safeUrl(d.about.url))}" target="_blank" rel="noopener noreferrer">${esc(T("wiki"))}</a>` : ""}</p>` : "");
    set("dMap", mapHtml(u));
    const photos = (d.photos || []).filter(p => safeUrl(p.url));
    set("dPhotos", photos.length ? `<div class="photo-grid">${photos.map((p, i) => `<figure class="photo-fig"><img src="${esc(safeUrl(p.url))}" alt="${esc(p.title || T("campus", { n: i + 1 }))}" loading="lazy" referrerpolicy="no-referrer"><figcaption>${esc([p.author, p.license].filter(Boolean).join(" · "))}${safeUrl(p.page) ? ` <a href="${esc(safeUrl(p.page))}" target="_blank" rel="noopener noreferrer">Commons ↗</a>` : ""}</figcaption></figure>`).join("")}</div><p class="muted">${esc(T("photos_note"))}</p>` : `<p class="muted">${esc(T("no_photos"))}</p>`);
    set("cityClimate", climateHtml(d.climate));
    const c = d.countryInfo || {};
    set("countryStats", c.currencies?.length || c.languages?.length
      ? `<div class="stat-grid">${box(T("currency"), (c.currencies || []).join(", ") + (c.currencyCode ? ` (${c.currencyCode})` : ""))}${box(T("languages_off"), (c.languages || []).join(", "))}${box(T("capital"), c.capital)}</div><p class="muted">${esc(T("source_wikidata"))}</p>`
      : `<p class="muted">${esc(T("country_na"))}</p>`);
    setupSave(u);
  }

  function fillAdmissions(data) {
    const a = data.admissions || {}, m = data.meta || {};
    document.querySelectorAll(".dDegreeName").forEach(el => el.textContent = DEGREES[state.degree]);
    const offered = a.offered === false ? `<div class="offer-warning">${esc(T("not_offered_long", { d: DEGREES[state.degree] }))}${a.offeredNote ? ": " + esc(a.offeredNote) : ""}. ${esc(T("check_site"))}</div>` : "";
    const fallback = m.fallbackUsed ? `<div class="offer-warning">${esc(T("fallback_used"))}</div>` : "";
    const nothing = !m.ai?.requirements && !m.ai?.finance;
    const diag = `<p class="diag-line">${esc(T("diag", { a: m.officialSources ?? 0, b: m.otherSources ?? 0 }))}${m.cached ? esc(T("from_cache")) : ""}${a.checkedAt ? esc(T("checked", { d: fmtDate(a.checkedAt) })) : ""}</p>`;
    if (nothing) {
      const why = (m.officialSources || 0) + (m.otherSources || 0) === 0 ? T("why_none") : T("why_ai");
      const hint = (m.officialSources || 0) + (m.otherSources || 0) ? T("hint_saved") : "";
      set("admReq", errorHtml(why, "retryAdm", hint) + diag); set("admApp", ""); set("admFin", ""); set("admAcademic", '<p class="muted">—</p>');
      $("retryAdm").addEventListener("click", () => loadAdmissions(state.selected, true));
      return;
    }
    set("admReq", offered + fallback + subCards(a.requirements, x => `<div class="sub-card"><strong>${esc(x.name)}: ${esc(x.value)}</strong>${badge(x.official)}<br>${x.program ? esc(T("program", { p: x.program })) : ""}${x.notes ? esc(x.notes) : ""}${srcLink(x.sourceUrl)}</div>`,
      T("req_none")) + (a.acceptanceRate ? box(T("accept_rate"), a.acceptanceRate) : "") + diag);
    const app = a.application || {};
    set("admApp", `<div class="info-grid">${box(T("app_type"), app.type)}${box(T("app_fee"), app.applicationFee)}</div>` +
      subCards(app.deadlines, x => `<div class="sub-card"><span class="deadline-dot ${dotClass(x.date)}"></span> <strong>${esc(x.label)}: ${esc(x.display || x.date)}</strong>${badge(x.official)}<br>${[x.program, x.intake].filter(Boolean).map(esc).join(" · ")}${srcLink(x.sourceUrl)}</div>`, T("deadlines_none")));
    const f = a.financial || {};
    set("admFin", `<div class="info-grid">${box(T("tuition_for", { g: a.group ? GROUP_LABEL[a.group] || "" : (a.groupLabel || "") }), f.tuition)}${box(T("housing"), f.accommodation)}${box(T("living_uni"), f.livingExpenses)}${box(T("total_cost"), f.totalCostOfAttendance)}</div>` +
      subCards(f.scholarships, x => `<div class="sub-card"><strong>${esc(x.name)}</strong>${badge(x.official)}<br>${[x.value, x.eligibility, x.deadline].filter(Boolean).map(esc).join(" · ")}${srcLink(x.sourceUrl)}</div>`, T("scholarships_none")));
    set("admAcademic", `<strong>${esc(T("strong_fields"))}</strong>${list(a.academic?.strongFields)}<strong>${esc(T("famous_for"))}</strong>${list(a.academic?.highlights)}`);
    const l = a.links || {};
    set("dLinks", [linkBtn(T("l_admissions"), l.admissions), linkBtn(T("l_application"), l.application), linkBtn(T("l_intl"), l.internationalStudents),
      linkBtn(T("l_aid"), l.financialAid), linkBtn(T("l_schol"), l.scholarships), linkBtn(T("l_housing"), l.accommodation)].join(""));
    const src = (a.sources || []).filter(s => safeUrl(s.url));
    set("dSources", src.length ? src.map((s, i) => `<a class="source-link" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">[${i + 1}] ${esc(s.title || s.url)} ↗</a>${badge(s.official)}`).join("") : `<span class="muted">${esc(T("sources_none"))}</span>`);
    rememberSummary(state.selected, a);
  }

  function paintGroup() {
    const u = state.selected; if (!u || !$("dGroup")) return;
    const g = u.countryCode ? groupOf(u.countryCode) : null;
    $("dGroup").textContent = g ? T("group_line", { c: CIT[state.cit]?.name, g: GROUP_LABEL[g] }) : T("group_line_short", { c: CIT[state.cit]?.name });
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
    if (!l) { set("lifeCity", `<p class="muted">${esc(T("life_unknown"))}</p>`); return; }
    if (l.rates) state.rates = l.rates;
    const c = l.cost, srcs = arr => (arr || []).filter(safeUrl).map(u => `<a class="source-link" href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer">${esc(hostOf(u))} ↗</a>`).join(" · ");
    if (!c) set("lifeCity", `<p class="muted">${esc(T("life_no_numbers"))}</p>`);
    else {
      const cur = c.currency, row = (label, r, note) => r ? `<tr><td>${label}${note ? `<small>${esc(note)}</small>` : ""}</td><td>${esc(moneyRange(r, cur))}${convert(r, cur) ? `<small>${esc(convert(r, cur))}</small>` : ""}</td></tr>` : "";
      const lvl = c.level ? `<span class="level-badge level-${esc(c.level.split(" ")[0])}">${esc(T("price_level", { l: ({ "низкий": T("lvl_low"), "средний": T("lvl_mid"), "высокий": T("lvl_high"), "очень высокий": T("lvl_vhigh") })[c.level] || c.level }))}</span>` : "";
      set("lifeCity", `<div class="cost-head">${c.monthlyTotal ? `<span class="cost-total">${esc(T("per_month", { v: moneyRange(c.monthlyTotal, cur) }))}</span>${convert(c.monthlyTotal, cur) ? `<span class="cost-conv">${esc(convert(c.monthlyTotal, cur))}</span>` : ""}` : ""}${lvl}</div>
        <table class="cost-table">${row(esc(T("rent")), c.rent, c.rentNote)}${row(esc(T("food")), c.food)}${row(esc(T("transport")), c.transport)}${row(esc(T("utilities")), c.utilities)}</table>
        <p class="muted">${esc(T("budget_note"))}${c.monthlyTotal?.summed ? esc(T("summed")) : ""}. ${esc(c.note || "")}${c.usdPerMonth ? esc(T("level_explain", { n: nf.format(c.usdPerMonth) })) : ""}</p>
        <p class="diag-line">${esc(T("sources_label"))} ${srcs(c.sources) || "—"}${l.rates?.updated ? esc(T("rate_from", { d: fmtDate(l.rates.updated) })) : ""}</p>`);
    }
    if (l.group === "domestic") set("lifeCountry", `<div class="domestic-note">${esc(T("domestic_note"))}</div>`);
    else if (l.visa) set("lifeCountry", `<h4>${esc(T("visa_title"))}</h4><div class="info-grid">${box(T("visa"), l.visa.visa)}${box(T("work"), l.visa.work)}${box(T("insurance"), l.visa.insurance)}</div>
        <p class="diag-line">${esc(T("visa_general"))}${l.group === "eu" ? esc(T("eu_easier")) : ""}${esc(T("visa_check", { c: CIT[state.cit]?.name }))} ${esc(T("sources_label"))} ${srcs(l.visa.sources) || "—"}</p>`);
    else set("lifeCountry", `<p class="muted">${esc(T("visa_none"))}</p>`);
  }

  async function loadBase(u, refresh) {
    const key = "base:" + uniKey(u), token = state.openToken;
    const cached = !refresh && lsGet(key);
    if (cached) { fillBase(cached); return cached; }
    try {
      const data = await api("/details/base", { body: { id: u.id || "", name: u.name, city: u.city || "", country: u.country || "", website: u.website || "", refresh, lang: LANG() }, signal: newCtl("base"), timeout: 40000 });
      if (token !== state.openToken) return null;
      const d = data.university || {};
      if (d.id) { lsSet(key, d, LS_TTL.base); lsSet("base:" + d.id, d, LS_TTL.base); }
      fillBase(d);
      return d;
    } catch (e) {
      if (isCancel(e) || token !== state.openToken) return null;
      set("countryStats", errorHtml(T("base_error", { e: e.message }), "retryBase"));
      set("dPhotos", '<p class="muted">—</p>');
      $("retryBase")?.addEventListener("click", () => loadBase(state.selected, false));
      return null;
    }
  }
  async function loadAdmissions(u, refresh) {
    const deg = state.degree, grp = groupOf(u.countryCode), key = `adm:${deg}:${grp}:` + uniKey(u), token = state.openToken;
    paintGroup();
    ["admReq", "admApp", "admFin"].forEach(id => set(id, loadingHtml(id === "admReq" ? T("adm_loading", { d: DEGREES[deg] }) : "…")));
    set("admAcademic", loadingHtml("…")); set("dLinks", ""); set("dSources", loadingHtml("…"));
    document.querySelectorAll(".dDegreeName").forEach(el => el.textContent = DEGREES[deg]);
    const cached = !refresh && lsGet(key);
    if (cached) { fillAdmissions(cached); return; }
    try {
      const data = await api("/details/admissions", { body: { id: u.id || "", name: u.name, city: u.city || "", country: u.country || "", countryCode: u.countryCode || "", website: u.website || "", degree: deg, citizenship: state.cit, refresh, lang: LANG() }, signal: newCtl("adm"), timeout: 110000 });
      if (token !== state.openToken || deg !== state.degree || grp !== groupOf(u.countryCode)) return;
      if (data.meta?.ai?.requirements || data.meta?.ai?.finance) lsSet(key, data, LS_TTL.adm);
      fillAdmissions(data);
    } catch (e) {
      if (isCancel(e) || token !== state.openToken || deg !== state.degree) return;
      set("admReq", errorHtml(e.message, "retryAdm", T("adm_retry_hint")));
      ["admApp", "admFin", "admAcademic", "dSources"].forEach(id => set(id, ""));
      $("retryAdm").addEventListener("click", () => loadAdmissions(state.selected, false));
    }
  }
  async function loadLife(u, refresh) {
    const grp = groupOf(u.countryCode), key = "life:" + norm(u.city) + "|" + norm(u.country) + "|" + grp, token = state.openToken, cit = state.cit;
    const cached = !refresh && (u.city || u.country) && lsGet(key);
    if (cached) { fillLife(cached); return; }
    try {
      const data = await api("/details/life", { body: { id: u.id || "", name: u.name, city: u.city || "", country: u.country || "", countryCode: u.countryCode || "", citizenship: cit, refresh, lang: LANG() }, signal: newCtl("life"), timeout: 90000 });
      if (token !== state.openToken || cit !== state.cit) return;
      if (data.meta?.ai && data.life) lsSet(key, data, LS_TTL.life);
      if (data.life && !data.meta?.ai && !data.life.cost) { set("lifeCity", errorHtml(T("life_error"), "retryLife", T("retry_free"))); $("retryLife").addEventListener("click", () => loadLife(state.selected, false)); return; }
      fillLife(data);
    } catch (e) {
      if (isCancel(e) || token !== state.openToken) return;
      set("lifeCity", errorHtml(e.message, "retryLife")); $("retryLife").addEventListener("click", () => loadLife(state.selected, false));
    }
  }

  async function openUniversity(uni, opts2 = {}) {
    const { keepSimilar = false, refresh = false, instant = false } = opts2;
    if (!uni?.name) return;
    const token = ++state.openToken;
    state.selected = { ...uni };
    highlightSelected();
    if (!keepSimilar) { $("similarSection").hidden = true; $("similarTrack").innerHTML = ""; }
    renderShell(state.selected);
    if (!opts2.noScroll) $("detailShell").scrollIntoView({ behavior: instant ? "instant" : "smooth", block: "start" });
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
    $("similarHeading").textContent = T("similar_heading", { n: u.name });
    $("similarSub").textContent = T("similar_loading_sub", { d: DEGREES[state.degree] });
    track.innerHTML = `<div class="loading-panel">${esc(T("similar_loading"))}</div>`;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    const key = `sim:${state.degree}:` + uniKey(u);
    let data = lsGet(key);
    try {
      if (!data) {
        data = await api("/similar", { body: { id: u.id || "", name: u.name, city: u.city || "", country: u.country || "", degree: state.degree, lang: LANG() }, signal: newCtl("similar"), timeout: 110000 });
        if ((data.candidates || []).length >= 10) lsSet(key, data, LS_TTL.base);
      }
      const items = data.candidates || [];
      $("similarSub").textContent = T("similar_found", { n: items.length, d: DEGREES[state.degree] });
      renderCards(items, track, { showMatch: true, reason: true, keepSimilar: true, empty: T("similar_empty") });
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
    if (!Object.entries(filters).some(([k, v]) => k !== "currency" && (Array.isArray(v) ? v.length : v !== null && v !== ""))) { status(T("fill_one"), true); return; }
    $("applyFiltersBtn").disabled = true; status(T("criteria_loading", { d: DEGREES[state.degree] }));
    try {
      const data = await api("/search", { body: { mode: "criteria", degree: state.degree, citizenship: state.cit, filters, limit: 20, lang: LANG() }, signal: newCtl("criteria"), timeout: 110000 });
      const items = data.candidates || [];
      state.view = "criteria"; state.lastCriteria = items;
      $("cardsHeading").textContent = T("criteria_heading");
      $("cardsSubheading").textContent = T("criteria_sub", { n: items.length, d: DEGREES[state.degree], c: CIT[state.cit]?.name });
      renderCards(items, $("cardsTrack"), { showMatch: true, reason: true, empty: T("criteria_empty") });
      status(items.length ? T("found", { n: items.length }) : T("nothing_found"), !items.length);
    } catch (e) { if (!isCancel(e)) status(e.message, true); }
    finally { $("applyFiltersBtn").disabled = false; }
  }

  function setMode(mode) {
    state.mode = mode === "criteria" ? "criteria" : "name";
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === state.mode));
    $("filterPanel").classList.toggle("open", state.mode === "criteria");
    $("searchInput").closest(".search-row").style.display = state.mode === "criteria" ? "none" : "";
    closeSuggest();
    $("searchHint").textContent = state.mode === "name" ? T("hint_name") : T("hint_criteria");
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
    window.UT?.applyStatic();
    // смена языка: перерисовываем надписи, карточки и открытое досье (из кэша — без новых запросов)
    window.addEventListener("edupath-lang-change", () => {
      window.UT?.applyStatic(); syncCitUI(); syncDegreeUI(); setMode(state.mode);
      if (state.view === "results" && state.lastResults) showResults(state.lastResults.results, state.lastResults.query);
      else if (state.view === "criteria" && state.lastCriteria) { $("cardsHeading").textContent = T("criteria_heading"); renderCards(state.lastCriteria, $("cardsTrack"), { showMatch: true, reason: true, empty: T("criteria_empty") }); }
      else if (state.catalog.length) showCatalog();
      if (state.selected) openUniversity(state.selected, { keepSimilar: !$("similarSection").hidden, noScroll: true });
    });
    // переход из профиля: universities.html?uni=Название&country=…&city=… — сразу открываем досье
    const wanted = params.get("uni"), wantedId = params.get("id");
    if (wanted || wantedId) {
      openUniversity({ id: wantedId || null, name: wanted || "", country: params.get("country") || "", city: params.get("city") || "" }, { instant: true });
      loadCatalog().then(() => requestAnimationFrame(() => $("detailShell").scrollIntoView({ behavior: "instant", block: "start" })));
    } else loadCatalog();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
