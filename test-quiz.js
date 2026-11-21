/* EduPath — ИИ-тест на подбор университета, v2
   Анкета (≈23 вопроса, ветвление по уровню обучения) → Worker /match (ИИ + реестр ROR, без Tavily)
   → 4 категории × 3 университета → сохранение в профиль → клик открывает полную карточку в «Университетах». */
(() => {
  "use strict";

  const SEARCH_API = "https://edupath-university-search.muqiyatalkar.workers.dev";
  const DRAFT_KEY = "ep_test_draft_v2";
  const TOKEN_KEY = "edupath_token";
  const DAY = 86400000;

  // Гражданство — тот же список, что на странице «Университеты»
  const CITIZENSHIPS = [["KZ", "Казахстан"], ["UZ", "Узбекистан"], ["KG", "Кыргызстан"], ["TJ", "Таджикистан"], ["TM", "Туркменистан"],
    ["RU", "Россия"], ["BY", "Беларусь"], ["UA", "Украина"], ["AZ", "Азербайджан"], ["GE", "Грузия"], ["AM", "Армения"],
    ["MN", "Монголия"], ["TR", "Турция"], ["CN", "Китай"], ["KR", "Южная Корея"], ["JP", "Япония"], ["IN", "Индия"],
    ["US", "США"], ["CA", "Канада"], ["GB", "Великобритания"], ["DE", "Германия"], ["FR", "Франция"], ["IT", "Италия"],
    ["ES", "Испания"], ["NL", "Нидерланды"], ["PL", "Польша"], ["CZ", "Чехия"], ["AU", "Австралия"], ["SG", "Сингапур"],
    ["AE", "ОАЭ"], ["XX", ""]];
  const EU = new Set(["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO","CH"]);

  const EXAMS = {
    foundation: ["ent", "attestat", "none"],
    bachelor: ["ent", "sat", "act", "alevel", "ib", "ap", "hsk", "topik", "jlpt", "testdaf", "delf", "none"],
    master: ["gre", "gmat", "hsk", "topik", "jlpt", "testdaf", "delf", "none"],
    phd: ["gre", "hsk", "topik", "jlpt", "testdaf", "delf", "none"]
  };
  const EXAM_HINT = { ent: "0–140", attestat: "5.0", sat: "400–1600", act: "1–36", alevel: "A*AA", ib: "0–45", ap: "1–5", hsk: "1–6", topik: "1–6",
    jlpt: "N5–N1", testdaf: "B2 / C1", delf: "A1–C2", gre: "260–340", gmat: "205–805" };
  const CERT_HINT = { ielts: "0–9", toefl: "0–120", duolingo: "10–160", cambridge: "B2 / C1 / 160–230" };

  const notPhd = d => d !== "phd";
  // Вопросы. show(уровень, ответы) — показывать ли; optional — можно пропустить
  const QUESTIONS = [
    { id: "cit", type: "cit" },
    { id: "degree", type: "single", opts: ["foundation", "bachelor", "master", "phd"] },
    { id: "intake", type: "single", opts: ["this_year", "next_year", "later"] },
    { id: "field", type: "single", opts: ["it", "eng", "med", "biz", "arch", "sci", "hum", "law"] },
    { id: "spec", type: "text", optional: d => d !== "phd" },
    { id: "gpa", type: "gpa", opts: ["s4", "s5", "s10", "s100"] },
    { id: "school", type: "single", opts: ["regular", "elite", "intl", "college"], show: d => d === "foundation" || d === "bachelor" },
    { id: "grade", type: "single", opts: ["g10", "g11", "g12", "done"], show: d => d === "foundation" },
    { id: "prev_degree", type: "text", show: d => d === "master" || d === "phd" },
    { id: "eng_cert", type: "cert", opts: ["ielts", "toefl", "duolingo", "cambridge", "none"] },
    { id: "eng_plan", type: "single", opts: ["low", "mid", "high", "no"], show: (d, a) => a.eng_cert && a.eng_cert.v === "none" },
    { id: "exams", type: "exams" },
    { id: "budget", type: "single", opts: ["b0", "b5", "b15", "b30", "b30p"], show: notPhd },
    { id: "grant", type: "single", opts: ["full", "partial", "self"], show: notPhd },
    { id: "phd_funding", type: "single", opts: ["funded", "partial", "self"], show: d => d === "phd" },
    { id: "living", type: "single", opts: ["l500", "l1000", "l1500", "l1500p"] },
    { id: "work", type: "single", opts: ["yes", "no"] },
    { id: "free_public", type: "single", opts: ["yes", "no"] },
    { id: "regions", type: "multi", opts: ["europe", "namerica", "asia", "mideast", "oceania", "any"], exclusive: "any" },
    { id: "want_countries", type: "text", optional: () => true },
    { id: "avoid_countries", type: "text", optional: () => true },
    { id: "climate", type: "single", opts: ["warm", "moderate", "cold", "any"] },
    { id: "city", type: "single", opts: ["mega", "mid", "small", "any"] },
    { id: "lang", type: "lang", opts: ["only_en", "en_other"], langs: ["de", "fr", "es", "it", "zh", "ja", "ko", "tr", "ru"] },
    { id: "distance", type: "single", opts: ["d2500", "d5000", "any"] },
    { id: "extra", type: "text", optional: () => true }
  ];

  const state = { answers: {}, cur: null, error: "", result: null, saveStatus: null, saveError: "", remaining: null, loadingTimer: null, groups: {} };
  const $ = id => document.getElementById(id);

  /* ---------- утилиты ---------- */
  const esc = v => String(v ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const norm = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/^the /, "").trim();
  const safeUrl = v => { try { const u = new URL(v); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  const lang = () => (window.I18N && window.I18N.getLang && window.I18N.getLang()) || "ru";
  const T = () => window.TEST_TEXTS[lang()] || window.TEST_TEXTS.ru;
  const UI = () => T().ui;
  const qText = id => T().q[id] || window.TEST_TEXTS.ru.q[id] || {};
  const degree = () => (state.answers.degree && state.answers.degree.v) || "bachelor";
  const ans = id => (state.answers[id] = state.answers[id] || {});
  function title(id) {
    const t = qText(id).t;
    if (!t || typeof t === "string") return t || "";
    return t[degree()] || t.all || t.bachelor || "";
  }
  function countryName(code) {
    if (code === "XX") return UI().otherCountry;
    try { const dn = new Intl.DisplayNames([lang() === "kk" ? "kk" : lang(), "ru"], { type: "region" }); const n = dn.of(code); if (n && n !== code) return n; } catch { /* старый браузер */ }
    return (CITIZENSHIPS.find(c => c[0] === code) || [code, code])[1];
  }

  function lsGet(k) { try { const v = JSON.parse(localStorage.getItem("ep6:" + k)); return v && Date.now() < v.e ? v.d : null; } catch { return null; } }
  function lsSet(k, d, ttl) { try { localStorage.setItem("ep6:" + k, JSON.stringify({ e: Date.now() + ttl, d })); } catch { /* нет места — не страшно */ } }
  function saveDraft() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers: state.answers, cur: state.cur, at: Date.now() })); } catch { /* ignore */ } }
  function loadDraft() {
    try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY)); return d && d.answers && Date.now() - d.at < 14 * DAY ? d : null; } catch { return null; }
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- порядок вопросов ---------- */
  function flow() { return QUESTIONS.filter(q => !q.show || q.show(degree(), state.answers)); }
  const qById = id => QUESTIONS.find(q => q.id === id);

  /* ---------- вступление ---------- */
  function renderIntro() {
    const ui = UI(), draft = loadDraft();
    $("introEyebrow").textContent = ui.eyebrow;
    $("introTitle").innerHTML = ui.title;
    $("introSub").textContent = ui.sub;
    $("introNote").textContent = ui.note;
    let html = "";
    if (draft && draft.cur) {
      const saved = state.answers; state.answers = draft.answers;
      const n = flow().findIndex(q => q.id === draft.cur) + 1; state.answers = saved;
      html += `<button type="button" class="btn-start" data-act="resume"><span>${esc(fill(ui.resume, { n: Math.max(1, n) }))}</span>${arrow()}</button>
        <button type="button" class="btn-ghost" data-act="start">${esc(ui.startOver)}</button>`;
    } else html += `<button type="button" class="btn-start" data-act="start"><span>${esc(ui.start)}</span>${arrow()}</button>`;
    $("introActions").innerHTML = html;
  }
  const arrow = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

  function start(resume) {
    const draft = resume ? loadDraft() : null;
    state.answers = draft ? draft.answers : { cit: { v: "KZ" } };
    state.cur = draft && draft.cur && qById(draft.cur) ? draft.cur : QUESTIONS[0].id;
    state.error = "";
    showScreen("screenQuiz");
    renderQuestion();
  }

  /* ---------- вопрос ---------- */
  function optBtn(code, label, selected, extra = "") {
    return `<button type="button" class="opt${selected ? " selected" : ""}" data-opt="${esc(code)}" ${extra} aria-pressed="${selected}">${esc(label)}</button>`;
  }
  function otherField(id) {
    const ui = UI();
    return `<label class="other-wrap"><span class="other-label">${esc(ui.otherLabel)}</span>
      <input type="text" class="text-input" data-other="${esc(id)}" maxlength="160" placeholder="${esc(ui.otherPh)}" value="${esc(ans(id).o || "")}"></label>`;
  }

  function renderQuestion() {
    const ui = UI(), list = flow();
    let i = list.findIndex(q => q.id === state.cur);
    if (i < 0) { i = 0; state.cur = list[0].id; }
    const q = list[i], qt = qText(q.id), a = ans(q.id), deg = degree();
    const optional = q.optional && q.optional(deg);
    $("progressText").textContent = fill(ui.progress, { n: i + 1, t: list.length });
    $("progressBar").style.width = Math.round(((i + 1) / list.length) * 100) + "%";

    let body = "";
    if (q.type === "cit") {
      body = `<select class="text-input select-input" data-cit>${CITIZENSHIPS.map(([c]) => `<option value="${c}"${a.v === c ? " selected" : ""}>${esc(countryName(c))}</option>`).join("")}</select>` + otherField(q.id);
    } else if (q.type === "single" || q.type === "cert" || q.type === "lang") {
      body = `<div class="opts">${q.opts.map(o => optBtn(o, qt.o[o], a.v === o)).join("")}</div>`;
      if (q.type === "cert" && a.v && a.v !== "none") {
        body += `<label class="score-row"><span>${esc(qt.o[a.v])}</span><input type="text" inputmode="decimal" class="text-input score-input" data-score="score" maxlength="20" placeholder="${esc(ui.scorePh + " · " + (CERT_HINT[a.v] || ""))}" value="${esc(a.s && a.s.score || "")}"></label>`;
      }
      if (q.type === "lang" && a.v === "en_other") {
        const l = ans("langs"), sel = Array.isArray(l.v) ? l.v : [];
        body += `<div class="sub-q">${esc(qt.sub)}</div><div class="opts opts-small">${q.langs.map(o => optBtn(o, qt.langs[o], sel.includes(o), 'data-lang-opt="1"')).join("")}</div>`;
      }
      body += otherField(q.id);
    } else if (q.type === "multi") {
      const sel = Array.isArray(a.v) ? a.v : [];
      body = `<div class="opts">${q.opts.map(o => optBtn(o, qt.o[o], sel.includes(o))).join("")}</div>` + otherField(q.id);
    } else if (q.type === "exams") {
      const opts = EXAMS[deg], sel = Array.isArray(a.v) ? a.v.filter(x => opts.includes(x)) : [];
      body = `<div class="opts opts-small">${opts.map(o => optBtn(o, qt.o[o], sel.includes(o))).join("")}</div>`;
      const scored = sel.filter(x => x !== "none");
      if (scored.length) body += `<div class="score-list">${scored.map(x => `<label class="score-row"><span>${esc(qt.o[x])}</span><input type="text" class="text-input score-input" data-score="${x}" maxlength="30" placeholder="${esc(ui.scorePh + (EXAM_HINT[x] ? " · " + EXAM_HINT[x] : ""))}" value="${esc(a.s && a.s[x] || "")}"></label>`).join("")}</div>`;
      body += otherField(q.id);
    } else if (q.type === "gpa") {
      body = `<div class="opts opts-small">${q.opts.map(o => optBtn(o, qt.o[o], a.v === o)).join("")}</div>
        <label class="score-row"><span>GPA</span><input type="text" inputmode="decimal" class="text-input score-input" data-score="score" maxlength="10" placeholder="${esc(ui.gpaPh)}" value="${esc(a.s && a.s.score || "")}"></label>` + otherField(q.id);
    } else if (q.type === "text") {
      body = `<textarea class="text-input text-area" data-text="${esc(q.id)}" maxlength="300" rows="3" placeholder="${esc(ui.textPh)}">${esc(a.o || "")}</textarea>`;
    }

    $("questionBox").innerHTML = `
      <div class="question-label">${esc(fill(ui.progress, { n: i + 1, t: list.length }))}${optional ? ` · <span class="opt-tag">${esc(ui.optional)}</span>` : ""}</div>
      <h2 class="question-text">${esc(title(q.id))}</h2>
      ${qt.h ? `<p class="question-hint">${esc(qt.h)}</p>` : ""}
      ${body}
      <div class="form-error" id="formError" role="alert">${esc(state.error)}</div>
      <div class="dialog-actions">
        ${i > 0 ? `<button type="button" class="btn-back" data-act="back">${esc(ui.back)}</button>` : "<span></span>"}
        <button type="button" class="btn-send" data-act="next"><span>${esc(i === list.length - 1 ? ui.finish : ui.next)}</span>${arrow()}</button>
      </div>`;
  }

  function validate(q) {
    const ui = UI(), a = ans(q.id), o = (a.o || "").trim();
    if (q.optional && q.optional(degree())) return "";
    switch (q.type) {
      case "text": return o ? "" : ui.required;
      case "cit": return a.v || o ? "" : ui.required;
      case "gpa": return (a.v && a.s && String(a.s.score || "").trim()) || o ? "" : ui.gpaMissing;
      case "cert":
        if (!a.v && !o) return ui.required;
        if (a.v && a.v !== "none" && !String(a.s && a.s.score || "").trim()) return ui.scoreMissing;
        return "";
      case "exams": {
        const sel = (Array.isArray(a.v) ? a.v : []).filter(x => EXAMS[degree()].includes(x));
        if (!sel.length && !o) return ui.required;
        if (sel.some(x => x !== "none" && !String(a.s && a.s[x] || "").trim())) return ui.scoreMissing;
        return "";
      }
      case "multi": return (Array.isArray(a.v) && a.v.length) || o ? "" : ui.required;
      default: return a.v || o ? "" : ui.required;
    }
  }

  function go(dir) {
    const list = flow(), i = list.findIndex(q => q.id === state.cur);
    if (dir > 0) {
      const err = validate(list[i]);
      if (err) { state.error = err; const el = $("formError"); if (el) el.textContent = err; return; }
    }
    state.error = "";
    const next = flow()[i + dir];   // порядок мог измениться (например, сменился уровень)
    if (dir > 0 && !next) { saveDraft(); submit(); return; }
    if (next) state.cur = next.id;
    saveDraft();
    renderQuestion();
    $("questionBox").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onOption(btn) {
    const list = flow(), q = list.find(x => x.id === state.cur); if (!q) return;
    const code = btn.dataset.opt, a = ans(q.id);
    if (btn.dataset.langOpt) {
      const l = ans("langs"), sel = new Set(Array.isArray(l.v) ? l.v : []);
      sel.has(code) ? sel.delete(code) : sel.add(code); l.v = [...sel];
    } else if (q.type === "multi" || q.type === "exams") {
      const sel = new Set(Array.isArray(a.v) ? a.v : []);
      const excl = q.type === "exams" ? "none" : q.exclusive;
      if (sel.has(code)) sel.delete(code);
      else { if (code === excl) sel.clear(); else sel.delete(excl); sel.add(code); }
      a.v = [...sel];
    } else {
      a.v = a.v === code ? null : code;
      if (q.id === "degree") { delete state.answers.exams; }   // экзамены зависят от уровня
    }
    state.error = "";
    saveDraft();
    renderQuestion();
  }

  /* ---------- отправка ---------- */
  function tokenExpiry(token) {
    try { const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(atob(p + "=".repeat((4 - p.length % 4) % 4))).exp * 1000; } catch { return null; }
  }
  async function freshToken(force) {
    let token = localStorage.getItem(TOKEN_KEY);
    const exp = token ? tokenExpiry(token) : null;
    if ((force || (exp && exp - Date.now() < 60000)) && window.EduAuth && window.EduAuth.refreshSession) {
      await window.EduAuth.refreshSession();
      token = localStorage.getItem(TOKEN_KEY);
    }
    return token;
  }
  function payload() {
    const ids = new Set(flow().map(q => q.id));
    if (ids.has("lang") && state.answers.lang && state.answers.lang.v === "en_other") ids.add("langs");
    const answers = {};
    for (const id of ids) {
      const a = state.answers[id]; if (!a) continue;
      const out = {};
      if (a.v !== undefined && a.v !== null) out.v = id === "exams" ? a.v.filter(x => EXAMS[degree()].includes(x)) : a.v;
      if (a.o) out.o = String(a.o).slice(0, 300);
      if (a.s) out.s = a.s;
      answers[id] = out;
    }
    return { degree: degree(), citizenship: (state.answers.cit && state.answers.cit.v) || "XX", lang: lang(), answers };
  }
  async function callMatch(body, retried) {
    const token = await freshToken(retried);
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 150000);
    try {
      const res = await fetch(SEARCH_API + "/match", { method: "POST", signal: ctl.signal,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + (token || ""),
          "X-Device-Id": (window.EduAuth && window.EduAuth.getDeviceId && window.EduAuth.getDeviceId()) || "" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && !retried) return callMatch(body, true);
      if (!res.ok) { const e = new Error(data.error || "HTTP " + res.status); e.status = res.status; e.code = data.code || ""; throw e; }
      return data;
    } finally { clearTimeout(timer); }
  }

  function startLoading() {
    const ui = UI();
    $("loadingTitle").textContent = ui.loadingTitle;
    $("loadingNote").textContent = ui.loadingNote;
    let step = 0;
    const paint = () => {
      $("loadingSteps").innerHTML = ui.loadingSteps.map((s, i) => `<li class="${i < step ? "done" : i === step ? "current" : ""}">${esc(s)}</li>`).join("");
    };
    paint();
    clearInterval(state.loadingTimer);
    state.loadingTimer = setInterval(() => { if (step < ui.loadingSteps.length - 1) { step++; paint(); } }, 7000);
  }

  async function submit() {
    showScreen("screenLoading");
    $("loadingError").innerHTML = "";
    startLoading();
    try {
      const data = await callMatch(payload());
      clearInterval(state.loadingTimer);
      state.result = { categories: data.categories || {}, degree: data.degree || degree(), cit: data.citizenship || payload().citizenship };
      state.remaining = typeof data.remainingToday === "number" ? data.remainingToday : null;
      clearDraft();
      renderFinal();
      saveResult();
      loadFacts();
    } catch (e) {
      clearInterval(state.loadingTimer);
      const ui = UI();
      const limit = e.code === "daily_limit";
      const msg = limit ? ui.errLimit : e.status === 401 ? ui.errAuth : (e.name === "AbortError" || lang() !== "ru" || !e.message ? ui.errGeneric : e.message);
      $("loadingSteps").innerHTML = "";
      $("loadingError").innerHTML = `<p class="load-error">${esc(msg)}</p>
        <div class="load-actions">
          ${limit ? "" : `<button type="button" class="btn-send" data-act="retry-submit">${esc(ui.tryAgain)}</button>`}
          <button type="button" class="btn-back" data-act="to-answers">${esc(ui.toAnswers)}</button>
        </div>`;
    }
  }

  /* ---------- результат ---------- */
  function groupOf(cc) {
    const c = String(state.result && state.result.cit || "").toUpperCase(), u = String(cc || "").toUpperCase();
    if (!u || !c || c === "XX") return "international";
    if (c === u) return "domestic";
    return EU.has(c) && EU.has(u) ? "eu" : "international";
  }
  function summaryFor(u) { const g = state.groups[groupOf(u.countryCode)] || {}; return g[norm(u.name)] || (u.id && g[u.id]) || null; }
  function dotClass(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return "";
    const days = Math.ceil((new Date(date + "T23:59:59") - new Date()) / DAY);
    return days < 0 ? "" : days <= 30 ? "red" : days <= 90 ? "yellow" : "green";
  }
  function factsHtml(u) {
    const ui = UI(), s = summaryFor(u);
    if (!s) return `<div class="facts-later">${esc(ui.factsLater)}</div>`;
    const short = v => v && v.length > 42 ? v.slice(0, 40) + "…" : v;
    const row = (label, v) => `<div><dt>${esc(label)}</dt><dd class="${v ? "" : "none"}">${esc(v || "—")}</dd></div>`;
    return `<dl class="card-facts">${row(ui.fApply, short(s.type))}${row(ui.fDeadline, s.nextDeadline && (s.nextDeadline.display || s.nextDeadline.date))}${row(ui.fTuition, short(s.tuition))}${row(ui.fAccept, s.acceptanceRate)}</dl>`;
  }
  function dossierUrl(u, deg, cit) {
    const q = new URLSearchParams({ uni: u.name });
    if (u.id) q.set("id", u.id);
    if (u.country) q.set("country", u.country);
    if (u.city) q.set("city", u.city);
    if (deg) q.set("degree", deg);
    if (cit && cit !== "XX") q.set("cit", cit);
    return "universities.html?" + q.toString() + "#detailShell";
  }
  function cardHtml(u) {
    const ui = UI(), s = summaryFor(u), site = safeUrl(u.website);
    return `<article class="uni-card" tabindex="0" role="link" data-href="${esc(dossierUrl(u, state.result.degree, state.result.cit))}">
      <div class="card-top"><span class="country-pill">${esc(u.country || ui.countryUnknown)}</span><span class="deadline-dot ${dotClass(s && s.nextDeadline && s.nextDeadline.date)}"></span></div>
      <h3>${esc(u.name)}</h3>
      <div class="card-location">📍 ${esc(u.city || ui.cityUnknown)}${u.distanceKm ? ` · ${esc(fill(ui.km, { n: new Intl.NumberFormat(lang() === "kk" || lang() === "ky" ? "ru" : lang()).format(u.distanceKm) }))}` : ""}</div>
      <div class="card-facts-wrap">${factsHtml(u)}</div>
      <div class="card-foot">${site ? `<a class="result-link" href="${esc(site)}" target="_blank" rel="noopener noreferrer">${esc(ui.site)}: ${esc(u.domain || hostOf(site))} ↗</a>` : `<span>${esc(ui.siteMissing)}</span>`}<span class="dossier">${esc(ui.dossier)}</span></div>
    </article>`;
  }
  function renderFinal() {
    const ui = UI(), r = state.result;
    showScreen("screenFinal");
    $("finalTitle").innerHTML = ui.finalTitle;
    $("finalSub").textContent = ui.finalSub;
    $("categoriesContainer").innerHTML = ["academic", "lifestyle", "safe", "reach"].map((k, i) => {
      const [icon, name, sub] = ui.cats[k], list = r.categories[k] || [];
      return `<section class="category" style="animation-delay:${0.1 + i * 0.12}s">
        <div class="category-title">${icon} ${esc(name)}</div><div class="category-sub">${esc(sub)}</div>
        ${list.length ? `<div class="cards-track">${list.map(cardHtml).join("")}</div>` : `<div class="empty-note">${esc(ui.emptyCat)}</div>`}
      </section>`;
    }).join("");
    $("cvNote").innerHTML = `<p>${esc(ui.cvText)}</p><p class="disclaimer">${esc(ui.disclaimer)}</p>`;
    $("remainingNote").textContent = state.remaining !== null ? fill(ui.remaining, { n: state.remaining }) : "";
    $("restartBtn").textContent = ui.restart;
    renderSaveBanner();
  }
  async function loadFacts() {
    const deg = state.result.degree, cached = lsGet("sum:" + deg);
    if (cached) { state.groups = cached; refreshFacts(); return; }
    try {
      const res = await fetch(SEARCH_API + "/catalog-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ degree: deg }) });
      if (!res.ok) return;
      const data = await res.json();
      state.groups = data.groups || {};
      lsSet("sum:" + deg, state.groups, 6 * 3600000);
      refreshFacts();
    } catch (e) { console.warn("catalog-status", e.message); }
  }
  function refreshFacts() { if (state.result && $("screenFinal").classList.contains("active")) renderFinal(); }

  /* ---------- сохранение в профиль ---------- */
  function renderSaveBanner() {
    const ui = UI(), b = $("saveBanner"), st = state.saveStatus;
    if (!st) { b.innerHTML = ""; return; }
    const icon = st === "saved" ? "✓" : st === "saving" ? "⏳" : "⚠️";
    const text = st === "saved" ? ui.saved : st === "saving" ? ui.saving : ui.saveFailed;
    const action = st === "saved" ? `<a href="profile.html" class="save-banner-btn">${esc(ui.savedLink)}</a>`
      : st === "failed" ? `<button type="button" class="save-banner-btn" data-act="retry-save">${esc(ui.retry)}</button>` : "";
    b.innerHTML = `<div class="save-banner"><div class="save-banner-icon">${icon}</div><div class="save-banner-text"><div class="save-banner-title">${esc(text)}</div>
      ${st === "failed" && state.saveError ? `<div class="save-banner-desc">${esc(state.saveError)}</div>` : ""}</div><div class="save-banner-actions">${action}</div></div>`;
  }
  async function saveResult() {
    if (!state.result || !window.EduAuth) return;
    state.saveStatus = "saving"; state.saveError = ""; renderSaveBanner();
    const r = state.result, cats = {};
    for (const k of ["academic", "lifestyle", "safe", "reach"]) {
      cats[k] = (r.categories[k] || []).map(u => ({ id: u.id || null, name: u.name, city: u.city || null, country: u.country || null, countryCode: u.countryCode || null }));
    }
    cats.meta = { v: 2, degree: r.degree, cit: r.cit };
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        const res = await window.EduAuth.saveTestResult({ categories: cats, summary: UI().cvText });
        ok = res && typeof res === "object" ? res.ok !== false : res !== false;
        if (!ok) state.saveError = (res && res.error) || "";
      } catch (e) { state.saveError = e.message || ""; }
      if (!ok && attempt < 2) await new Promise(res => setTimeout(res, 8000));
    }
    state.saveStatus = ok ? "saved" : "failed";
    renderSaveBanner();
  }

  /* ---------- события ---------- */
  document.addEventListener("click", e => {
    const opt = e.target.closest(".opt");
    if (opt && $("questionBox").contains(opt)) { onOption(opt); return; }
    const act = e.target.closest("[data-act]");
    if (act) {
      const a = act.dataset.act;
      if (a === "start") { clearDraft(); start(false); }
      else if (a === "resume") start(true);
      else if (a === "next") go(1);
      else if (a === "back") go(-1);
      else if (a === "retry-submit") submit();
      else if (a === "to-answers") { showScreen("screenQuiz"); renderQuestion(); }
      else if (a === "retry-save") saveResult();
      else if (a === "restart") { state.result = null; state.saveStatus = null; clearDraft(); showScreen("screenIntro"); renderIntro(); }
      return;
    }
    if (e.target.closest("a")) return;
    const card = e.target.closest(".uni-card[data-href]");
    if (card) location.href = card.dataset.href;
  });
  document.addEventListener("keydown", e => {
    const card = e.target.closest && e.target.closest(".uni-card[data-href]");
    if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); location.href = card.dataset.href; return; }
    if (e.key === "Enter" && e.target.matches && e.target.matches("#questionBox input")) { e.preventDefault(); go(1); }
  });
  document.addEventListener("input", e => {
    const t = e.target, q = state.cur && qById(state.cur);
    if (!q || !$("questionBox").contains(t)) return;
    const a = ans(q.id);
    if (t.dataset.other !== undefined || t.dataset.text !== undefined) a.o = t.value;
    else if (t.dataset.score) { a.s = a.s || {}; a.s[t.dataset.score] = t.value; }
    saveDraft();
  });
  document.addEventListener("change", e => {
    if (e.target.matches && e.target.matches("[data-cit]")) { ans("cit").v = e.target.value; saveDraft(); }
  });
  window.addEventListener("edupath-lang-change", () => {
    if ($("screenQuiz").classList.contains("active")) renderQuestion();
    else if ($("screenFinal").classList.contains("active") && state.result) renderFinal();
    else if ($("screenLoading").classList.contains("active")) { /* шаги обновятся сами */ }
    else renderIntro();
  });

  function init() {
    if (!localStorage.getItem(TOKEN_KEY)) { location.replace("index.html"); return; }
    renderIntro();
    $("restartBtn").dataset.act = "restart";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
