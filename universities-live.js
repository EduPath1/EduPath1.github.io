(() => {
  "use strict";

  // Если адрес Worker отличается, измени только эту строку.
  const SEARCH_API = "https://edupath-university-search.muqiyatalkar.workers.dev";
  const $ = id => document.getElementById(id);
  let visibleUniversities = [];
  let selectedMode = "name";
  let selectedUniversity = null;
  let controller = null;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const safeUrl = value => {
    try { const u = new URL(value); return ["https:","http:"].includes(u.protocol) ? u.href : ""; }
    catch { return ""; }
  };
  const getName = u => u?.name || "University";
  const getCity = u => u?.city || "";
  const getCountry = u => u?.country || "";
  const setStatus = (message, error=false) => {
    if (!$("statusLine")) return;
    $("statusLine").textContent = message || "";
    $("statusLine").classList.toggle("error-text", !!error);
  };
  const setBusy = busy => {
    if ($("searchBtn")) $("searchBtn").disabled = busy;
    if ($("searchBtn")) $("searchBtn").setAttribute("aria-busy", String(busy));
  };

  function deadlineClass(deadline) {
    const value = deadline?.date;
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
    const date = new Date(value + "T23:59:59");
    if (Number.isNaN(date.getTime()) || date < new Date()) return "";
    const days = Math.ceil((date - new Date()) / 86400000);
    return days <= 30 ? "red" : days <= 90 ? "yellow" : "green";
  }

  function renderCards(items) {
    const track = $("cardsTrack");
    if (!track) return;
    track.innerHTML = "";
    if (!items.length) {
      track.innerHTML = '<div class="empty-state">Ничего не найдено. Попробуй уточнить запрос.</div>';
      return;
    }
    for (const uni of items) {
      const name = getName(uni), city = getCity(uni), country = getCountry(uni);
      const acceptance = uni.acceptanceRate?.value || uni.acceptanceRate || "Не подтверждён";
      const deadline = uni.deadline?.value || uni.deadline || "Не подтверждён";
      const card = document.createElement("button");
      card.type = "button";
      card.className = "uni-card" + (selectedUniversity && getName(selectedUniversity).toLowerCase() === name.toLowerCase() ? " selected" : "");
      card.innerHTML = `
        <div class="card-top">
          <span class="country-pill">🌐 ${escapeHtml(country || "Страна уточняется")}</span>
          <span class="deadline-dot ${deadlineClass(uni.deadline)}" title="Цвет отражает только подтверждённую дату"></span>
        </div>
        <h3>${escapeHtml(name)}</h3>
        <div class="card-location">📍 ${escapeHtml(city || "Город уточняется")}</div>
        <div class="card-stats">
          <div class="stat"><small>Процент приёма</small><strong>${escapeHtml(acceptance)}</strong></div>
          <div class="stat"><small>Дедлайн</small><strong>${escapeHtml(deadline)}</strong></div>
        </div>
        <div class="card-foot"><span>${escapeHtml(uni.applicationType || "Тип подачи уточняется")}</span><span>Открыть досье ↗</span></div>`;
      card.addEventListener("click", () => openUniversity(uni));
      track.appendChild(card);
    }
  }

  function fieldBox(label, value) {
    let text = "Не удалось подтвердить";
    if (value && typeof value === "object") text = value.value || "Не удалось подтвердить";
    else if (value !== null && value !== undefined && value !== "") text = String(value);
    return `<div class="info-box"><small>${escapeHtml(label)}</small><strong class="${text === "Не удалось подтвердить" ? "unknown" : ""}">${escapeHtml(text)}</strong></div>`;
  }

  function listHtml(items) {
    if (!Array.isArray(items) || !items.length) return '<p class="source-note">Пока нет подтверждённых сведений.</p>';
    return `<ul class="plain-list">${items.map(x => {
      const item = typeof x === "string" ? x : x?.text;
      return item ? `<li>${escapeHtml(item)}</li>` : "";
    }).join("")}</ul>`;
  }

  async function openUniversity(uni) {
    selectedUniversity = uni;
    renderCards(visibleUniversities);
    if ($("emptyState")) $("emptyState").style.display = "none";
    if ($("detailContent")) $("detailContent").innerHTML = '<div class="loading-panel">Ищем свежие сведения и проверяем источники…</div>';
    $("detailShell")?.scrollIntoView({behavior:"smooth", block:"start"});
    if (controller) controller.abort();
    controller = new AbortController();
    try {
      const response = await fetch(SEARCH_API + "/details", {
        method:"POST", headers:{"Content-Type":"application/json"},
        signal:controller.signal,
        body:JSON.stringify({name:getName(uni), city:getCity(uni), country:getCountry(uni), refresh:true})
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Ошибка поиска (${response.status})`);
      renderDetails(payload.university || {}, uni);
    } catch (error) {
      if (error.name === "AbortError") return;
      $("detailContent").innerHTML = `<div class="loading-panel error-text">${escapeHtml(error.message)}<p class="source-note">Проверь Worker и адрес SEARCH_API.</p></div>`;
    }
  }

  function renderDetails(data, fallback) {
    const name = data.name || getName(fallback);
    const city = data.city || getCity(fallback);
    const country = data.country || getCountry(fallback);
    const query = encodeURIComponent([name, city, country].filter(Boolean).join(" "));
    const mapUrl = `https://www.google.com/maps?q=${query}&output=embed`;
    const sources = Array.isArray(data.sources) ? data.sources : [];
    const photos = Array.isArray(data.photos) ? data.photos.filter(safeUrl).slice(0, 4) : [];
    const sourceMarkup = sources.length ? sources.map((s, i) => {
      const url = safeUrl(s.url);
      return url ? `<a class="source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">[${i+1}] ${escapeHtml(s.title || url)}</a>` : "";
    }).join("") : '<span class="source-note">Источники не вернулись из поискового сервиса.</span>';
    const deadline = data.deadline || {};
    const acceptance = data.acceptanceRate?.value || data.acceptanceRate || null;
    const lastChecked = data.lastChecked ? new Date(data.lastChecked).toLocaleString() : "Дата проверки неизвестна";

    $("detailContent").innerHTML = `
      <article class="detail-card">
        <header class="detail-head">
          <div class="eyebrow">University dossier · ${escapeHtml(lastChecked)}</div>
          <h2>${escapeHtml(name)}</h2>
          <div class="detail-location">📍 ${escapeHtml([city,country].filter(Boolean).join(", ") || "Местоположение уточняется")}</div>
          <div class="detail-meta">
            <span class="meta-chip">Приём: ${escapeHtml(acceptance || "нет подтверждённых данных")}</span>
            <span class="meta-chip">Дедлайн: ${escapeHtml(deadline.value || "Не подтверждён")}</span>
            <span class="meta-chip">Подача: ${escapeHtml(data.applicationType || "уточняется")}</span>
          </div>
          <div class="detail-actions">
            <button class="action-btn" id="saveUniBtn" type="button">☆ Сохранить в избранное</button>
            ${safeUrl(data.officialWebsite) ? `<a class="action-btn" href="${escapeHtml(safeUrl(data.officialWebsite))}" target="_blank" rel="noopener noreferrer">Официальный сайт ↗</a>` : ""}
          </div>
        </header>
        <div class="detail-grid">
          <div>
            <section class="detail-section">
              <h3>Поступление и требования</h3>
              <div class="info-grid">
                ${fieldBox("Процент приёма", data.acceptanceRate)}
                ${fieldBox("Тип подачи", data.applicationType)}
                ${fieldBox("Основной дедлайн", deadline)}
                ${fieldBox("Дата дедлайна", deadline.date)}
              </div>
              <div style="margin-top:12px">${listHtml(data.admissionRequirements)}</div>
            </section>
            <section class="detail-section">
              <h3>Стоимость и финансовая помощь</h3>
              <div class="info-grid">
                ${fieldBox("Обучение", data.tuition)}
                ${fieldBox("Средняя стоимость жизни", data.costOfLiving)}
                ${fieldBox("Стипендии и financial aid", data.financialAid)}
              </div>
            </section>
            <section class="detail-section"><h3>Сильные направления</h3>${listHtml(data.strongFields)}</section>
            <section class="detail-section"><h3>Чем известен университет</h3>${listHtml(data.highlights)}</section>
          </div>
          <aside>
            <section class="detail-section"><h3>Расположение</h3>
              <iframe class="map-frame" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${mapUrl}" title="Карта университета"></iframe>
            </section>
            <section class="detail-section"><h3>Фото кампуса</h3>
              ${photos.length ? `<div class="photo-grid">${photos.map((url,i)=>`<img src="${escapeHtml(url)}" alt="Фото университета ${i+1}" loading="lazy" referrerpolicy="no-referrer">`).join("")}</div>` : '<p class="source-note">Фото не найдены. Открой официальный сайт университета.</p>'}
            </section>
            <section class="detail-section"><h3>Источники</h3>
              <div class="sources">${sourceMarkup}</div>
              <p class="source-note">Дата проверки: ${escapeHtml(lastChecked)}.</p>
            </section>
          </aside>
        </div>
        <div class="disclaimer">${escapeHtml(data.disclaimer || "Автоматическая справка. Требования зависят от программы, степени, гражданства, типа абитуриента и года поступления. Перепроверь их на официальной странице.")}</div>
      </article>`;

    // Сохраняем совместимость с существующим профилем и EduAuth.
    const saveButton = $("saveUniBtn");
    if (saveButton) {
      const saved = !!window.EduAuth?.isSaved?.(name);
      saveButton.textContent = saved ? "★ В избранном" : "☆ Сохранить в избранное";
      saveButton.addEventListener("click", async () => {
        if (!window.EduAuth?.isLoggedIn?.()) {
          window.EduAuth?.showToast?.("Войди в аккаунт, чтобы сохранять университеты", "info");
          window.EduAuth?.openModal?.("register");
          return;
        }
        const result = await window.EduAuth.toggleSave({name, country, city});
        if (result?.ok) {
          saveButton.textContent = result.added ? "★ В избранном" : "☆ Сохранить в избранное";
          window.EduAuth?.showToast?.(result.added ? "Университет сохранён" : "Университет удалён из избранного", "success");
        } else {
          window.EduAuth?.showToast?.(result?.error || "Не удалось сохранить", "error");
        }
      });
    }
  }

  async function search() {
    const query = $("searchInput")?.value.trim() || "";
    if (query.length < 3) { setStatus("Введи не менее трёх символов.", true); return; }
    if (controller) controller.abort();
    controller = new AbortController();
    setBusy(true);
    setStatus("Ищем университеты в актуальных веб-источниках…");
    if ($("detailContent")) $("detailContent").innerHTML = "";
    if ($("emptyState")) $("emptyState").style.display = "block";
    try {
      const response = await fetch(SEARCH_API + "/search", {
        method:"POST", headers:{"Content-Type":"application/json"},
        signal:controller.signal,
        body:JSON.stringify({query, mode:selectedMode, limit:12, refresh:true})
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Ошибка поиска (${response.status})`);
      visibleUniversities = (payload.candidates || []).map(x => ({
        name:x.name, city:x.city || "", country:x.country || "",
        acceptanceRate:null, deadline:null, applicationType:null
      }));
      selectedUniversity = null;
      $("cardsHeading").textContent = selectedMode === "name" ? "Найденные университеты" : "Университеты по твоим условиям";
      $("cardsSubheading").textContent = "Результаты получены из интернета. Открой карточку для подробного досье.";
      renderCards(visibleUniversities);
      setStatus(visibleUniversities.length
        ? `Найдено университетов: ${visibleUniversities.length}. Источников: ${payload.sourcesCount || 0}. Проверено: ${new Date(payload.lastChecked || Date.now()).toLocaleString()}.`
        : "Не удалось выделить университеты из результатов. Уточни запрос.", !visibleUniversities.length);
    } catch (error) {
      if (error.name !== "AbortError") setStatus(error.message, true);
    } finally { setBusy(false); }
  }

  function setMode(mode) {
    selectedMode = mode === "criteria" ? "criteria" : "name";
    document.querySelectorAll(".mode-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.mode === selectedMode));
    $("searchHint").textContent = selectedMode === "name"
      ? "Введи название любого университета. Поиск выполняется в интернете, даже если его раньше не было на EduPath."
      : "Опиши направление, страны, бюджет, язык обучения, стипендию и другие критерии. Поиск идёт по веб-источникам.";
    $("searchInput").placeholder = selectedMode === "name"
      ? "Например: Nazarbayev University"
      : "Например: Computer Science в Европе, бюджет до 12 000 USD, нужна стипендия";
    $("searchBtn").textContent = selectedMode === "name" ? "Найти университет" : "Подобрать варианты";
  }

  function init() {
    if (!$("searchInput") || !$("searchBtn") || !$("cardsTrack")) {
      console.error("EduPath live search: required page elements are missing.");
      return;
    }
    if (window.EduAuth?.getSaved) window.EduAuth.getSaved().catch(() => {});
    document.querySelectorAll(".mode-btn").forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
    $("searchBtn").addEventListener("click", search);
    $("searchInput").addEventListener("keydown", e => { if (e.key === "Enter") search(); });
    setMode("name");
    visibleUniversities = [];
    renderCards([]);
    $("cardsHeading").textContent = "Результаты поиска";
    $("cardsSubheading").textContent = "Здесь нет фиксированного каталога. Университеты ищутся в интернете по запросу.";
    setStatus("Введи название университета или опиши условия и нажми кнопку поиска.");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
