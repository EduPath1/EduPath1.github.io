/* ============================================================
   EduPath — дедлайны подачи (бакалавриат, иностранные абитуриенты)
   Данные: deadlines.json (собраны с официальных сайтов, повторяются ежегодно).
   window.EduDeadlines.load() → Promise; .next(name) → ближайший дедлайн или null
   ============================================================ */
(function () {
  "use strict";
  const KIND = {
    ru: { ea: "Early Action", ed: "Early Decision", rea: "Restrictive Early Action", scea: "Single-Choice Early Action", rd: "Regular Decision", uc: "Заявка UC", ucas: "UCAS (основной срок)", oxbridge: "UCAS — Оксфорд/Кембридж", main: "Основной срок подачи", nf: "Программы с конкурсом (numerus fixus)", visa: "Срок для тех, кому нужна виза", round1: "1-й раунд", round2: "2-й раунд", early: "Ранняя подача", regular: "Основная подача", spring: "Набор на весну", final: "Последний срок", s1: "Набор на 1-й семестр", s2: "Набор на 2-й семестр", phases: "Приём идёт этапами — смотри сайт" },
    en: { ea: "Early Action", ed: "Early Decision", rea: "Restrictive Early Action", scea: "Single-Choice Early Action", rd: "Regular Decision", uc: "UC application", ucas: "UCAS (main deadline)", oxbridge: "UCAS — Oxford/Cambridge", main: "Main deadline", nf: "Numerus fixus programmes", visa: "Deadline if you need a visa", round1: "Round 1", round2: "Round 2", early: "Early round", regular: "Regular round", spring: "Spring intake", final: "Final deadline", s1: "Semester 1 intake", s2: "Semester 2 intake", phases: "Admission runs in phases — see the website" },
    kk: { ea: "Early Action", ed: "Early Decision", rea: "Restrictive Early Action", scea: "Single-Choice Early Action", rd: "Regular Decision", uc: "UC өтінімі", ucas: "UCAS (негізгі мерзім)", oxbridge: "UCAS — Оксфорд/Кембридж", main: "Негізгі тапсыру мерзімі", nf: "Конкурсты бағдарламалар (numerus fixus)", visa: "Виза керек болса — мерзім", round1: "1-раунд", round2: "2-раунд", early: "Ерте тапсыру", regular: "Негізгі тапсыру", spring: "Көктемгі қабылдау", final: "Соңғы мерзім", s1: "1-семестрге қабылдау", s2: "2-семестрге қабылдау", phases: "Қабылдау кезең-кезеңімен — сайтты қара" },
    ky: { ea: "Early Action", ed: "Early Decision", rea: "Restrictive Early Action", scea: "Single-Choice Early Action", rd: "Regular Decision", uc: "UC арызы", ucas: "UCAS (негизги мөөнөт)", oxbridge: "UCAS — Оксфорд/Кембридж", main: "Негизги тапшыруу мөөнөтү", nf: "Конкурстук программалар (numerus fixus)", visa: "Виза керек болсо — мөөнөт", round1: "1-раунд", round2: "2-раунд", early: "Эрте тапшыруу", regular: "Негизги тапшыруу", spring: "Жазгы кабыл алуу", final: "Акыркы мөөнөт", s1: "1-семестрге кабыл алуу", s2: "2-семестрге кабыл алуу", phases: "Кабыл алуу этаптар менен — сайтты кара" },
    zh: { ea: "Early Action（提前行动）", ed: "Early Decision（提前决定）", rea: "限制性提前行动", scea: "单一选择提前行动", rd: "Regular Decision（常规申请）", uc: "UC 申请", ucas: "UCAS（主要截止）", oxbridge: "UCAS——牛津/剑桥", main: "主要截止日期", nf: "限额专业（numerus fixus）", visa: "需要签证者的截止日期", round1: "第一轮", round2: "第二轮", early: "提前轮", regular: "常规轮", spring: "春季入学", final: "最终截止", s1: "第一学期入学", s2: "第二学期入学", phases: "分阶段招生——请看官网" }
  };
  const lang = () => { try { const l = localStorage.getItem("edupath_lang"); return KIND[l] ? l : "ru"; } catch (e) { return "ru"; } };
  const LOC = { ru: "ru-RU", en: "en-GB", kk: "kk-KZ", ky: "ky-KG", zh: "zh-CN" };
  const norm = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/^the\s+/, "").replace(/[^a-z0-9а-яё]+/g, " ").trim();
  let DATA = null, INDEX = null, loading = null;

  function load() {
    if (DATA) return Promise.resolve(DATA);
    if (loading) return loading;
    loading = fetch("deadlines.json?v=1").then(r => r.json()).then(d => {
      DATA = d; INDEX = {};
      Object.entries(d.universities || {}).forEach(([name, u]) => {
        const rec = Object.assign({ name }, u);
        [name].concat(u.aliases || []).forEach(n => { INDEX[norm(n)] = rec; });
      });
      return DATA;
    }).catch(() => { DATA = { universities: {} }; INDEX = {}; return DATA; });
    return loading;
  }
  const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  function nextDate(item, today) {
    if (item.date && item.date >= today) return { date: item.date, exact: true };
    if (!item.md) return null;
    const y = Number(today.slice(0, 4));
    for (const yy of [y, y + 1, y + 2]) {
      const d = yy + "-" + item.md;
      if (d >= today && (!item.date || d > item.date)) return { date: d, exact: false };
    }
    return null;
  }
  function find(name) { return INDEX ? INDEX[norm(name)] || null : null; }
  /* ближайший дедлайн вуза: { date, kind, label, display, approx, url, days } */
  function next(name, from) {
    const rec = find(name);
    if (!rec) return null;
    const today = from || iso(new Date());
    let best = null;
    (rec.d || []).forEach(it => {
      const n = nextDate(it, today);
      if (n && (!best || n.date < best.date)) best = { date: n.date, kind: it.k, exact: n.exact };
    });
    if (!best) return { date: null, kind: "phases", label: KIND[lang()].phases, display: KIND[lang()].phases, approx: true, url: rec.url, days: null, name: rec.name };
    const label = KIND[lang()][best.kind] || best.kind;
    const days = Math.ceil((new Date(best.date + "T23:59:59") - new Date()) / 86400000);
    return { date: best.date, kind: best.kind, label, display: fmt(best.date) + " · " + label, approx: !!rec.approx, url: rec.url, days, name: rec.name };
  }
  function fmt(date, opts) {
    try { return new Intl.DateTimeFormat(LOC[lang()], opts || { day: "numeric", month: "long", year: "numeric" }).format(new Date(date + "T12:00:00")); } catch (e) { return date; }
  }
  window.EduDeadlines = { load, next, find, fmt, norm };
})();
