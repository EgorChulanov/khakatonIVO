// Сборка презентации (ровно 10 слайдов) из output/results.json и output/figures.
// Запуск: node deck/build_deck.js
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

const ROOT = path.resolve(__dirname, "..");
const R = JSON.parse(fs.readFileSync(path.join(ROOT, "output/results.json"), "utf8"));
const A = JSON.parse(fs.readFileSync(path.join(ROOT, "output/results_adv.json"), "utf8"));
const ST = JSON.parse(fs.readFileSync(path.join(ROOT, "output/results_students.json"), "utf8"));
const AUTHOR = process.env.AUTHOR || "Егор Чуланов";
const FIG = (f) => path.join(ROOT, "output/figures", f);
const OUTFILE = path.join(ROOT, "output/IVO2026_aspiranty_dropout.pptx");

const HEX = {
  ink: "14213D", ink2: "52514E", bg: "FFFFFF", soft: "F1F4F9",
  blue: "2A78D6", orange: "EB6834", gray: "B9B8B2", grid: "E6E5E0",
};
const THEME = {
  name: "IVO Hackathon",
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  colors: {
    dk1: "0B0B0B", lt1: "FFFFFF", dk2: HEX.ink, lt2: HEX.soft,
    accent1: HEX.blue, accent2: HEX.orange, accent3: HEX.gray, accent4: "1BAF7A",
    accent5: "4A3AA7", accent6: "E34948", hlink: HEX.blue, folHlink: "4A3AA7",
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Что толкает аспирантов к мысли об отчислении";
const C = pres.SchemeColor;
const W = 13.333;
const M = 0.6;

const pct = (v, d = 0) => `${(v * 100).toFixed(d)}%`;
const SRC = "Данные: опрос аспирантов 2021 (HSE-BR-2025-009); Мониторинг эффективности вузов 2022; лонгитюд студентов 2024–2026 (HSE-BR-2025-009)";

// ---------- Layouts ----------
pres.defineSlideMaster({
  title: "DARK",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.1, w: W - 2 * M, h: 2.0,
      fontSize: 40, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 4.3, w: W - 2 * M, h: 1.4,
      fontSize: 18, color: C.background2, valign: "top", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.35, w: W - 2 * M, h: 0.95,
      fontSize: 26, bold: true, color: C.text2, valign: "top", align: "left", margin: 0 }, text: "" } },
    { text: { text: SRC, options: { x: M, y: 7.0, w: 11, h: 0.3, fontSize: 10, color: C.text2,
      transparency: 30, margin: 0 } } },
  ],
  slideNumber: { x: W - M - 0.6, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: C.text2, align: "right" },
});

pres.defineSlideMaster({
  title: "DARKCONTENT",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.35, w: W - 2 * M, h: 0.95,
      fontSize: 26, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: W - M - 0.6, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: C.background2, align: "right" },
});

function content(title, section) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  return s;
}

function lead(s, text, y = 1.25) {
  s.addText(text, { x: M, y, w: W - 2 * M, h: 0.5, fontSize: 16, color: C.text1, isTextBox: true,
    margin: 0, objectName: "lead" });
}

function card(s, x, y, w, h, opts = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08,
    fill: { color: opts.fill || C.background2 }, line: { color: opts.fill || C.background2 },
    objectName: opts.name || "card" });
}

function stat(s, x, y, w, big, label, color) {
  s.addText(big, { x, y, w, h: 0.9, fontSize: 44, bold: true, color: color || C.accent1, margin: 0,
    isTextBox: true, valign: "bottom" });
  s.addText(label, { x, y: y + 0.95, w, h: 0.7, fontSize: 14, color: C.text1, margin: 0,
    isTextBox: true, valign: "top" });
}

const chartBase = () => ({
  catAxisLabelColor: HEX.ink2, valAxisLabelColor: HEX.ink2,
  catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt",
  titleFontFace: "+mn-lt", catAxisLabelFontSize: 11, dataLabelFontSize: 12, dataLabelColor: HEX.ink,
  valGridLine: { style: "none" }, catGridLine: { style: "none" }, valAxisHidden: true,
  catAxisLineShow: true, catAxisLineColor: HEX.grid, showLegend: false, showValue: true,
  dataLabelPosition: "outEnd", dataLabelFormatCode: "0%", valAxisMinVal: 0, barGapWidthPct: 45,
  showTitle: true, titleFontSize: 13, titleColor: HEX.ink, titleBold: true,
});

const num = (v) => Math.round(v).toLocaleString("ru-RU").replace(/ /g, " ");
const pp = (v, d = 1) => `${v > 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(d)} п.п.`;
const WORK_KEY = "C(work, Treatment('Не работает'))[T.ПД вне вуза]";

function h3(s, text, x, y, w, color) {
  s.addText(text, { x, y, w, h: 0.4, fontSize: 17, bold: true, color: color || C.text2, margin: 0, isTextBox: true });
}
function para(s, runs, x, y, w, h, size = 14, color) {
  s.addText(runs, { x, y, w, h, fontSize: size, color: color || C.text1, margin: 0, valign: "top", isTextBox: true, paraSpaceAfter: 6 });
}
function bullets(s, items, x, y, w, h, size = 14, color) {
  s.addText(items.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < items.length - 1 } })),
    { x, y, w, h, fontSize: size, color: color || C.text1, margin: 0, paraSpaceAfter: 8, valign: "top", isTextBox: true });
}
function chip(s, x, y, w, label, fill) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.5, rectRadius: 0.25, fill: { color: fill }, line: { color: fill } });
  s.addText(label, { x, y, w, h: 0.5, fontSize: 13, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
}

// ===== 1. Титул =====
pres.addSection({ title: "Вступление" });
let s = pres.addSlide({ masterName: "DARK", sectionTitle: "Вступление" });
s.addText("Не работа, а среда: кто и почему хочет бросить аспирантуру", { placeholder: "title" });
s.addText([
  { text: "Все три массива хакатона: опрос 5 007 аспирантов × Мониторинг вузов + репликация на лонгитюде студентов", options: { breakLine: true } },
  { text: `${AUTHOR} · Хакатон исследователей высшего образования, Конференция ИВО 2026 · номинация «Анализ данных»`, options: { fontSize: 14 } },
], { placeholder: "body" });

// ===== 2. Вопрос =====
pres.addSection({ title: "Вопрос и данные" });
s = content("Вопрос: что на самом деле толкает аспирантов к мысли об уходе", "Вопрос и данные");
card(s, M, 1.45, 5.55, 5.25);
h3(s, "Почему это важно", M + 0.3, 1.65, 5);
bullets(s, [
  "Меньше 1 из 5 выпускников аспирантуры защищается в срок (ИСИЭЗ НИУ ВШЭ, Росстат)",
  "Намерение уйти опережает отчисление: это сигнал, который вуз может поймать заранее",
  "Расхожее объяснение: «уходят, потому что работают». Политика часто строится на нём",
  "Если оно неверно, вузы тратят ресурс не туда",
], M + 0.3, 2.15, 5.0, 4.4, 15);
h3(s, "Исследовательский вопрос", 6.55, 1.5, 6.2);
para(s, "Что сильнее связано с желанием бросить аспирантуру: внешняя нагрузка или академическая среда, научное руководство и ментальное здоровье, и есть ли эффект самого вуза?",
  6.55, 1.95, 6.2, 1.3, 16);
const HY = [
  ["H1", "Полная занятость вне вуза повышает риск"],
  ["H2", "Руководитель и среда весят больше, чем работа"],
  ["H3", "Часть эффекта среды идёт через ментальное здоровье"],
  ["H4", "Принадлежность к кафедре защищает работающих"],
  ["H5", "Характеристики вуза (МЭВ) меняют риск сверх индивидуальных"],
];
HY.forEach(([h, t], i) => {
  const y = 3.4 + i * 0.66;
  s.addShape(pres.shapes.OVAL, { x: 6.55, y, w: 0.5, h: 0.5, fill: { color: C.accent1 }, line: { color: C.accent1 } });
  s.addText(h, { x: 6.55, y, w: 0.5, h: 0.5, fontSize: 12, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText(t, { x: 7.2, y, w: 5.55, h: 0.5, fontSize: 14, color: C.text1, valign: "middle", margin: 0, isTextBox: true });
});

// ===== 3. Данные =====
s = content("Данные: все три массива хакатона, связанные на уровне вуза", "Вопрос и данные");
const boxes = [
  [M, "Опрос аспирантов, 2021", [`${num(R.n_total)} респондентов`, `${R.n_unis} вузов`, "намерение уйти, руководитель, среда, PHQ-8, работа"], C.accent1],
  [4.75, "Мониторинг эффективности вузов", ["МЭВ-2022 (данные за 2021 год)", "698 головных вузов, 400+ показателей", "защиты НПР, аспиранты на 100 студентов, НИОКР, ЕГЭ"], C.accent5],
  [8.9, "Связанный массив", [`${num(A.cl_n)} аспирантов`, `${A.cl_unis} вузов с показателями МЭВ`, "нечёткое сопоставление названий + ручная проверка"], C.accent2],
];
boxes.forEach(([x, t, items, col], i) => {
  card(s, x, 1.5, 3.85, 2.75);
  s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 1.7, w: 0.42, h: 0.42, fill: { color: col }, line: { color: col } });
  s.addText(String(i + 1), { x: x + 0.25, y: 1.7, w: 0.42, h: 0.42, fontSize: 13, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText(t, { x: x + 0.8, y: 1.7, w: 2.9, h: 0.45, fontSize: 15, bold: true, color: C.text2, margin: 0, valign: "middle", isTextBox: true });
  bullets(s, items, x + 0.25, 2.35, 3.4, 1.8, 13);
  if (i < 2) s.addText(i === 0 ? "+" : "=", { x: x + 3.85, y: 2.55, w: 0.3, h: 0.5, fontSize: 26, bold: true, color: C.text2, align: "center", margin: 0, isTextBox: true });
});
const st = [
  [pct(R.quit_share), "согласны: «Я часто хочу бросить аспирантуру»", C.accent2],
  [pct(R.phq_mod_share), "с умеренными и выше депрессивными симптомами (PHQ-8 ≥ 10)", C.accent2],
  [`α = ${R.alpha_belong.toFixed(2)}`, "надёжность индекса академической принадлежности (6 пунктов)", C.accent1],
  ["3 из 3", "массивов хакатона: опрос, МЭВ и лонгитюд студентов (для репликации)", C.accent1],
];
st.forEach(([b, l, col], i) => stat(s, M + i * 3.05, 4.55, 2.8, b, l, col));

// ===== 4. Методы =====
pres.addSection({ title: "Методы" });
s = content("Методы: семь инструментов, каждый отвечает на свой вопрос", "Методы");
const MT = [
  ["Логит-регрессия", "кластерные ошибки по вузу; порядковый логит для проверки", "Что связано?"],
  ["Декомпозиция Шепли", "вклад 7 блоков в псевдо-R² (128 моделей)", "Что важнее?"],
  ["Градиентный бустинг", "5-fold CV AUC, перестановочная важность, нелинейности", "Предсказуемо ли?"],
  ["Кластеризация k-means", "типы аспирантов по руководителю, среде, PHQ-8, интересу", "Кто в группе риска?"],
  ["Медиация и модерация", "бутстрэп косвенного эффекта; принадлежность × работа", "Как действует?"],
  ["Многоуровневая модель", "вузы как уровень 2 + показатели МЭВ", "Важен ли вуз?"],
  ["G-computation", "контрфактические сценарии мер с бутстрэп-ДИ", "Что даст политика?"],
];
MT.forEach(([h, t, q], i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = M + col * 6.15, y = 1.45 + row * 1.32;
  const w = i === 6 ? W - 2 * M : 5.95;
  card(s, x, y, w, 1.17);
  s.addText(h, { x: x + 0.25, y: y + 0.13, w: 3.4, h: 0.4, fontSize: 15, bold: true, color: C.text2, margin: 0, isTextBox: true });
  s.addText(t, { x: x + 0.25, y: y + 0.55, w: w - 2.3, h: 0.55, fontSize: 12, color: C.text1, margin: 0, valign: "top", isTextBox: true });
  s.addText(q, { x: x + w - 2.0, y: y + 0.13, w: 1.8, h: 0.9, fontSize: 13, italic: true, bold: true, color: C.accent1, align: "right", valign: "middle", margin: 0, isTextBox: true });
});

// ===== 5. Главный контраст =====
pres.addSection({ title: "Результаты" });
s = content("Работа почти не меняет риск, а руководитель, среда и здоровье меняют его в 4–6 раз", "Результаты");
lead(s, `Доля согласных с «Я часто хочу бросить аспирантуру» (в среднем ${pct(R.quit_share)}). ПД = полный день`, 1.4);
const panels = [
  ["Тип занятости", ["Не работает", "Подработки", "Неполный день", "ПД в своём вузе", "ПД вне вуза"],
    ["Нет", "Подраб.", "Неполн.", "ПД вуз", "ПД вне"], R.by_work, HEX.gray],
  ["Удовл. руководителем", ["1.0", "2.0", "3.0", "4.0"], ["Совсем нет", "Скорее нет", "Скорее да", "Полн."], R.by_sup, HEX.blue],
  ["Принадлежность (1–4)", ["≤2.5", "2.5–3", "3–3.5", "3.5–4"], ["≤2.5", "2.5–3", "3–3.5", "3.5–4"], R.by_belong, HEX.blue],
  ["Депр. симптомы PHQ-8", ["Минимальные", "Лёгкие", "Умеренные", "Выраженные"], ["0–4", "5–9", "10–14", "15+"], R.by_phq, HEX.orange],
];
panels.forEach(([t, keys, labs, src, col], i) => {
  s.addChart(pres.charts.BAR, [{ name: t, labels: labs, values: keys.map((k) => src[k].mean) }], {
    ...chartBase(), x: M + i * 3.05, y: 1.9, w: 2.95, h: 3.65, barDir: "col", title: t, chartColors: [col],
    valAxisMaxVal: 0.7, catAxisLabelFontSize: 10, catAxisLabelRotate: 0,
  });
});
const wk = R.perceived.find((p) => p.key === "dif_work");
const halfW = (W - 2 * M - 0.3) / 2;
card(s, M, 5.65, halfW, 1.2);
para(s, [
  { text: "Парадокс. ", options: { bold: true } },
  { text: `${pct(wk.prev)} называют работу серьёзной трудностью, но сам факт работы риск не меняет. PSM (${num(A.psm.n_matched)} пар): ${pp(A.psm.att)} [${(A.psm.ci[0] * 100).toFixed(1)}; ${(A.psm.ci[1] * 100).toFixed(1)}]. H1 отвергнута.` },
], M + 0.2, 5.75, halfW - 0.4, 1.05, 13);
card(s, M + halfW + 0.3, 5.65, halfW, 1.2);
para(s, [
  { text: "Репликация на студентах (лонгитюд, 3-й массив). ", options: { bold: true } },
  { text: `Начало работы между волнами не повышает мысли об уходе (ОШ ${ST.panel_start_work_or.toFixed(2)}, p = ${ST.panel_start_work_p.toFixed(2)}, n = ${ST.n_panel}). Решает переживание конфликта: ${pct(ST.drop_by_conflict["1.0"])} против ${pct(ST.drop_by_conflict["0.0"])}.` },
], M + halfW + 0.5, 5.75, halfW - 0.4, 1.05, 13);

// ===== 6. Что важнее =====
s = content("Три фактора среды дают две трети объяснённого, занятость менее 2%", "Результаты");
const sh = Object.entries(R.shapley).sort((a, b) => b[1].share - a[1].share);
s.addChart(pres.charts.BAR, [{ name: "Доля", labels: sh.map((e) => e[0]), values: sh.map((e) => e[1].share) }], {
  ...chartBase(), x: M, y: 1.4, w: 6.3, h: 4.3, barDir: "bar", title: "Вклад блока в псевдо-R² (декомпозиция Шепли)",
  chartColors: [HEX.blue], catAxisOrientation: "maxMin", catAxisLabelFontSize: 12, valAxisMaxVal: 0.32,
});
const OR = R.full_or;
const tiles = [
  [`×${OR.phq.OR.toFixed(2)}`, "шансы на +1 SD депрессивных симптомов", C.accent2],
  [`×${OR.belong.OR.toFixed(2)}`, "на +1 SD принадлежности к кафедре", C.accent1],
  [`×${OR.sup_sat.OR.toFixed(2)}`, "на +1 SD удовлетворённости руководителем", C.accent1],
  [`×${OR[WORK_KEY].OR.toFixed(2)}`, `полный день вне вуза, p = ${OR[WORK_KEY].p.toFixed(2)}`, C.text2],
];
tiles.forEach(([b, l, col], i) => {
  const x = 7.2 + (i % 2) * 2.8, y = 1.45 + Math.floor(i / 2) * 2.0;
  card(s, x, y, 2.6, 1.8);
  s.addText(b, { x: x + 0.2, y: y + 0.15, w: 2.2, h: 0.7, fontSize: 30, bold: true, color: col, margin: 0, isTextBox: true });
  s.addText(l, { x: x + 0.2, y: y + 0.9, w: 2.25, h: 0.8, fontSize: 12, color: C.text1, margin: 0, valign: "top", isTextBox: true });
});
para(s, [
  { text: "Предсказательная сила: ", options: { bold: true } },
  { text: `логит AUC ${A.auc_lr.toFixed(2)}, бустинг ${A.auc_gb.toFixed(2)} (5-fold CV) против ${R.cv_auc_external.toFixed(2)} только на внешних факторах. ` },
  { text: "Скрининг: ", options: { bold: true } },
  { text: `20% аспирантов с наибольшим риском покрывают ${pct(A.screen_top20_capture)} всех, кто хочет уйти. ` },
  { text: "Устойчивость: ", options: { bold: true } },
  { text: `E-value для PHQ-8 ${A.evalue.phq.toFixed(1)}, для принадлежности ${A.evalue.belong.toFixed(1)}: скрытый конфаундер должен быть сильным, чтобы обнулить связь.` },
], M, 5.85, W - 2 * M, 1.0, 13);

// ===== 7. Профили =====
s = content("Четыре типа аспирантов: риск различается в 11 раз, а доля работающих почти одинакова", "Результаты");
s.addImage({ path: FIG("08_profiles.png"), x: M, y: 1.4, w: 7.2, h: 7.2 * 0.6 });
const PR = A.profiles;
const pcol = ["1BAF7A", HEX.blue, "4A3AA7", HEX.orange];
const pdesc = [
  "довольны руководителем, свои на кафедре, симптомов почти нет",
  "руководитель в порядке, но нет чувства принадлежности",
  "хорошая среда, но выраженные депрессивные симптомы",
  "конфликт или отсутствие поддержки руководителя, слабая среда",
];
PR.forEach((p, i) => {
  const y = 1.45 + i * 1.32;
  card(s, 8.1, y, 4.65, 1.17);
  s.addShape(pres.shapes.OVAL, { x: 8.3, y: y + 0.3, w: 0.55, h: 0.55, fill: { color: pcol[i] }, line: { color: pcol[i] } });
  s.addText(`${p.name} · ${pct(p.share)}`, { x: 9.05, y: y + 0.1, w: 3.6, h: 0.35, fontSize: 14, bold: true, color: C.text2, margin: 0, isTextBox: true });
  s.addText(`${pdesc[i]}. Хотят уйти ${pct(p.quit)}, работают ПД вне вуза ${pct(p.ft_out)}`, { x: 9.05, y: y + 0.45, w: 3.6, h: 0.7, fontSize: 11, color: C.text1, margin: 0, valign: "top", isTextBox: true });
});
para(s, "Кластеризация k-means по 4 стандартизованным признакам. Размер пузыря = доля аспирантов, число внутри = доля желающих уйти.",
  M, 5.95, 7.2, 0.6, 12, C.text2);

// ===== 8. Механизмы =====
s = content("Механизмы: часть эффекта идёт через здоровье, а принадлежность защищает работающих", "Результаты");
h3(s, "Медиация через PHQ-8 (бутстрэп)", M, 1.45, 6.2);
const med = R.mediation;
const box = (x, y, w, t, fill) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.8, rectRadius: 0.08, fill: { color: fill }, line: { color: fill } });
  s.addText(t, { x, y, w, h: 0.8, fontSize: 13, bold: true, color: C.background1, align: "center", valign: "middle", margin: 2, isTextBox: true });
};
box(M, 3.35, 2.0, "Руководитель / принадлежность", C.accent1);
box(2.65, 2.0, 1.9, "Депрессивные симптомы", C.accent2);
box(4.75, 3.35, 1.95, "Хочу бросить", C.text2);
s.addShape(pres.shapes.LINE, { x: 1.6, y: 2.4, w: 1.05, h: 0.95, flipV: true, line: { color: HEX.ink2, width: 1.5, endArrowType: "triangle" } });
s.addShape(pres.shapes.LINE, { x: 4.55, y: 2.4, w: 1.15, h: 0.95, line: { color: HEX.ink2, width: 1.5, endArrowType: "triangle" } });
s.addShape(pres.shapes.LINE, { x: 2.6, y: 3.75, w: 2.15, h: 0, line: { color: HEX.ink2, width: 1.5, endArrowType: "triangle" } });
s.addText("прямой эффект", { x: 2.75, y: 3.8, w: 1.9, h: 0.3, fontSize: 11, color: C.text2, align: "center", margin: 0, isTextBox: true });
s.addTable([
  [{ text: "" }, { text: "Руководитель", options: { bold: true } }, { text: "Принадлежность", options: { bold: true } }],
  ["Общий эффект, п.п. на 1 SD", (med.sup_sat.total * 100).toFixed(1), (med.belong.total * 100).toFixed(1)],
  ["Косвенный через PHQ-8", (med.sup_sat.indirect * 100).toFixed(1), (med.belong.indirect * 100).toFixed(1)],
  ["95% ДИ косвенного", med.sup_sat.ci.map((v) => (v * 100).toFixed(1)).join("…"), med.belong.ci.map((v) => (v * 100).toFixed(1)).join("…")],
  ["Доля медиации", pct(med.sup_sat.prop), pct(med.belong.prop)],
], { x: M, y: 4.55, w: 6.1, colW: [2.7, 1.6, 1.8], fontSize: 13, color: HEX.ink, rowH: 0.36,
  border: { type: "solid", pt: 0.75, color: HEX.grid }, margin: [2, 6, 2, 6] });
h3(s, "Модерация: принадлежность × работа", 7.0, 1.45, 5.8);
s.addImage({ path: FIG("05_interaction.png"), x: 7.0, y: 1.9, w: 5.75, h: 5.75 * 1035 / 1660 });
para(s, `β = ${R.interaction.coef.toFixed(2)}, p = ${R.interaction.p.toFixed(3)}: работа опасна только без академической опоры. При высокой принадлежности работающие по модели рискуют даже меньше.`,
  7.0, 5.6, 5.75, 1.1, 13);

// ===== 9. Вуз =====
s = content("Вуз тоже важен: в «конвейерах защит» аспиранты чаще хотят уйти", "Результаты");
s.addImage({ path: FIG("06_universities.png"), x: M, y: 1.45, w: 6.6, h: 6.6 * 0.485 });
para(s, `Оценки многоуровневой модели для ${A.uni_range.k} вузов с 30+ ответами, обезличено.`, M, 4.7, 6.6, 0.35, 12, C.text2);
[[`${pct(A.uni_range.min)}–${pct(A.uni_range.max)}`, "разброс доли «хочу бросить» между вузами"],
 [pct(A.icc.null, 1), "дисперсии на уровне вуза (ICC): главное внутри вуза"],
 [A.mor.null.toFixed(2), "медианное отношение шансов между вузами"]].forEach(([b, l], i) => {
  const x = M + i * 2.25;
  s.addText(b, { x, y: 5.15, w: 2.1, h: 0.6, fontSize: 26, bold: true, color: i === 0 ? C.accent2 : C.accent1, margin: 0, isTextBox: true });
  s.addText(l, { x, y: 5.8, w: 2.05, h: 0.8, fontSize: 12, color: C.text1, margin: 0, valign: "top", isTextBox: true });
});
const cxl = A.cross_level;
const LBL = { staff_defended: "Доля НПР, защитивших диссертации за год", phd_per100: "Аспиранты на 100 студентов", ege: "Средний балл ЕГЭ", income_per_student: "Доходы на 1 студента", grants_per100: "Гранты на 100 НПР", rd_share: "Доля доходов от НИОКР" };
const order = ["staff_defended", "phd_per100", "ege", "income_per_student", "grants_per100", "rd_share"];
s.addTable([
  [{ text: "Показатель МЭВ (+1 SD)", options: { bold: true } }, { text: "ОШ", options: { bold: true } }, { text: "p", options: { bold: true } }],
  ...order.map((k) => [LBL[k], { text: cxl[k].OR.toFixed(2), options: { bold: cxl[k].p < 0.05, color: cxl[k].p < 0.05 ? HEX.orange : HEX.ink } }, cxl[k].p < 0.001 ? "<0.001" : cxl[k].p.toFixed(3)]),
], { x: 7.55, y: 1.45, w: 5.2, colW: [3.5, 0.8, 0.9], fontSize: 12, color: HEX.ink, rowH: 0.36,
  border: { type: "solid", pt: 0.75, color: HEX.grid }, margin: [2, 6, 2, 6] });
card(s, 7.55, 4.2, 5.2, 2.55);
para(s, [
  { text: "H5 подтверждена частично. ", options: { bold: true } },
  { text: `Там, где за год защищается больше сотрудников, шансы хотеть уйти выше на ${((cxl.staff_defended.OR - 1) * 100).toFixed(0)}% при равных индивидуальных факторах (устойчиво без двух крупнейших вузов). Поддержка руководителя там важнее: взаимодействие β = ${A.cross_inter.coef.toFixed(2)}, p = ${A.cross_inter.p.toFixed(2)}. ` },
  { text: "Вероятная причина: давление «защищайся быстрее» без ресурсов." , options: { italic: true } },
], 7.75, 4.35, 4.85, 2.3, 13);

// ===== 10. Что делать =====
pres.addSection({ title: "Выводы" });
s = pres.addSlide({ masterName: "DARKCONTENT", sectionTitle: "Выводы" });
s.addText("Что даст вузу каждая мера: симуляция на модели", { placeholder: "title" });
const sims = Object.entries(A.sim).sort((a, b) => a[1].delta - b[1].delta);
s.addChart(pres.charts.BAR, [{ name: "Δ", labels: sims.map((e) => e[0]), values: sims.map((e) => +(Math.abs(e[1].delta) * 100).toFixed(1)) }], {
  ...chartBase(), x: M, y: 1.35, w: 7.4, h: 4.3, barDir: "bar",
  title: `Снижение доли «хочу бросить», п.п. (база ${pct(A.sim_base)})`, titleColor: "FFFFFF",
  chartColors: [HEX.orange], catAxisOrientation: "maxMin", catAxisLabelFontSize: 11, catAxisLabelColor: "FFFFFF",
  dataLabelColor: "FFFFFF", dataLabelFormatCode: "0.0", valAxisMaxVal: 9, catAxisLineColor: "52627F",
});
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.25, y: 1.35, w: 4.5, h: 4.3, rectRadius: 0.08, fill: { color: "22335A" }, line: { color: "22335A" } });
h3(s, "Рекомендации", 8.5, 1.55, 4.0, C.accent2);
bullets(s, [
  "Ежегодный скрининг PHQ-8 и путь к психологу",
  "Стандарт: встреча с руководителем ≥ 2 раз в месяц",
  "Аспирантские семинары и сообщество кафедры",
  "Короткий скрининг (8 показателей, AUC 0.83) находит группу риска заранее",
  "Не запрещать работу: это не помогает",
], 8.5, 2.05, 4.05, 3.5, 14, C.background1);
s.addText([
  { text: "Ограничения: ", options: { bold: true } },
  { text: "кросс-секционные данные (связи, не причинность), намерение вместо факта отчисления, онлайн-опрос весны 2021 года. Далее: лонгитюд и данные о фактических отчислениях." },
], { x: M, y: 5.85, w: W - 2 * M, h: 0.6, fontSize: 12, color: C.background1, margin: 0, isTextBox: true, valign: "top" });
s.addText("Исследование осуществлено в рамках Программы фундаментальных исследований НИУ ВШЭ (HSE-BR-2025-009). Авторы благодарят лабораторию «Развитие университетов» ИО НИУ ВШЭ за сводную базу МЭВ.",
  { x: M, y: 6.55, w: W - 2 * M - 1, h: 0.4, fontSize: 10, color: C.background2, margin: 0, isTextBox: true });

const NOTES = [
  "Добрый вечер. Я Егор, участвую один. Мой вопрос: почему аспиранты хотят бросить аспирантуру. Короткий ответ на 10 секунд: не из-за работы. Решают научный руководитель, чувство своей кафедры и ментальное здоровье. А ещё сам вуз: в «конвейерах защит» риск выше. Я связал все три массива хакатона.",
  "Меньше пятой части аспирантов защищается в срок. Намерение уйти появляется раньше отчисления, значит, его можно поймать. Самое частое объяснение отсева: «они работают». Я проверил пять гипотез: от работы до эффекта самого вуза.",
  "Основа: опрос 5 007 аспирантов из 249 вузов, 2021 год. Я сопоставил названия вузов с Мониторингом эффективности за тот же год и получил связанный массив: 85 вузов и 3 570 человек. Лонгитюд студентов использую для репликации. Каждый пятый аспирант часто хочет уйти, у каждого четвёртого умеренные и выше депрессивные симптомы.",
  "Методов семь, и у каждого свой вопрос. Логит отвечает, что связано. Шепли показывает, что важнее. Бустинг проверяет предсказуемость и нелинейности. Кластеры показывают, кто в группе риска. Медиация объясняет, как это работает. Многоуровневая модель проверяет роль вуза. G-computation считает, что дадут меры.",
  "Главный слайд. Слева тип занятости: от 20 до 24 процентов, разницы почти нет. Справа руководитель, кафедра и симптомы: разброс в четыре–шесть раз. Сопоставление похожих аспирантов даёт эффект работы около нуля. На студентах начало работы тоже не повышает мысли об уходе. Важна не работа, а переживание конфликта.",
  "Разложение Шепли: здоровье, среда и руководитель дают две трети объяснённого, занятость меньше двух процентов. Модель хорошо различает группы: AUC 0.83, а только на внешних факторах 0.61. Пятая часть аспирантов с самым высоким прогнозом риска покрывает больше половины желающих уйти. E-value около двух: связь не объяснить слабым скрытым фактором.",
  "Четыре типа аспирантов. Почти половина вовлечены, и уйти хотят всего 5%. Отстранённые: с руководителем всё нормально, но нет своей кафедры. Выгорающие: среда хорошая, но выраженные симптомы. И 10% без опоры на руководителя: там уйти хотят 59%. Доля работающих во всех четырёх группах около 45%.",
  "Механизм. Около 15% эффекта руководителя и среды идёт через депрессивные симптомы. И модерация: работа опасна только без академической опоры. При сильной принадлежности к кафедре работающие по модели рискуют даже меньше.",
  "Вуз тоже важен, хотя на уровне вузов лежит лишь около 4% различий. Самая сильная связь с Мониторингом: где за год защищается больше сотрудников, аспиранты на 30% чаще хотят уйти. Это устойчиво без двух крупнейших вузов. И именно там руководитель важнее всего. Моя интерпретация: давление «защищайся быстрее» без ресурсов.",
  "Что делать. Я посчитал меры на модели. Комплекс из встреч с руководителем, сообщества кафедры и психологической помощи снижает долю желающих уйти с 20 до 13 процентов. Уход с работы не даёт ничего. Для защиты я сделал интерактивный калькулятор риска: могу показать его вживую. Спасибо!",
];
pres._slides.forEach((sl, i) => sl.addNotes(NOTES[i]));

(async () => {
  await pres.writeFile({ fileName: OUTFILE });
  await applyTheme(OUTFILE, THEME);
  console.log("written", OUTFILE);
})();
