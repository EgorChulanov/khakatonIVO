// Сборка презентации (ровно 10 слайдов) из output/results.json и output/figures.
// Запуск: node deck/build_deck.js
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

const ROOT = path.resolve(__dirname, "..");
const R = JSON.parse(fs.readFileSync(path.join(ROOT, "output/results.json"), "utf8"));
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
const SRC = "Данные: Всероссийский опрос аспирантов, 2021 (НИУ ВШЭ, HSE-BR-2025-009)";

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
    { text: { text: SRC, options: { x: M, y: 7.0, w: 9, h: 0.3, fontSize: 10, color: C.text2,
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

// ===== 1. Титул =====
pres.addSection({ title: "Вступление" });
let s = pres.addSlide({ masterName: "DARK", sectionTitle: "Вступление" });
s.addText("Не работа, а среда: что толкает аспирантов к мысли об отчислении", { placeholder: "title" });
s.addText([
  { text: "Научный руководитель, академическая принадлежность и ментальное здоровье против внешней занятости", options: { breakLine: true } },
  { text: "Хакатон исследователей высшего образования · Конференция ИВО 2026 · номинация «Анализ данных»", options: { fontSize: 14 } },
], { placeholder: "body" });
s.addNotes("Титульный слайд. Название команды и участников добавить перед отправкой.");

// ===== 2. Проблема и вопрос =====
pres.addSection({ title: "Вопрос и данные" });
s = content("Почему важно понять, кто хочет уйти из аспирантуры", "Вопрос и данные");
card(s, M, 1.45, 5.6, 5.2);
s.addText("Контекст", { x: M + 0.35, y: 1.65, w: 5, h: 0.4, fontSize: 18, bold: true, color: C.text2, margin: 0, isTextBox: true });
s.addText([
  { text: "Меньше 1 из 5 выпускников аспирантуры защищается в срок (ИСИЭЗ НИУ ВШЭ, Росстат)", options: { bullet: true, breakLine: true } },
  { text: "Намерение уйти предшествует отчислению: это ранний сигнал, который вуз может заметить", options: { bullet: true, breakLine: true } },
  { text: "Частое объяснение «аспиранты уходят, потому что работают». Мы проверяем, так ли это", options: { bullet: true } },
], { x: M + 0.35, y: 2.15, w: 5.0, h: 3.4, fontSize: 15, color: C.text1, margin: 0, paraSpaceAfter: 10, valign: "top", isTextBox: true });

s.addText("Исследовательский вопрос", { x: 6.75, y: 1.5, w: 6, h: 0.4, fontSize: 18, bold: true, color: C.text2, margin: 0, isTextBox: true });
s.addText("Что сильнее связано с желанием бросить аспирантуру: внешняя нагрузка (работа, семья, финансы) или качество академической среды и научного руководства? И через что действует эта связь?",
  { x: 6.75, y: 1.95, w: 6.0, h: 1.5, fontSize: 16, italic: true, color: C.text1, margin: 0, isTextBox: true, valign: "top" });
const H = [
  ["H1", "Полная занятость вне вуза повышает риск"],
  ["H2", "Руководитель и среда снижают риск сильнее, чем работа повышает"],
  ["H3", "Связь среды с намерением частично идёт через ментальное здоровье"],
  ["H4", "Принадлежность к кафедре особенно защищает работающих"],
];
H.forEach(([h, t], i) => {
  const y = 3.6 + i * 0.75;
  s.addShape(pres.shapes.OVAL, { x: 6.75, y, w: 0.55, h: 0.55, fill: { color: C.accent1 }, line: { color: C.accent1 } });
  s.addText(h, { x: 6.75, y, w: 0.55, h: 0.55, fontSize: 13, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText(t, { x: 7.45, y, w: 5.3, h: 0.55, fontSize: 14, color: C.text1, valign: "middle", margin: 0, isTextBox: true });
});
s.addNotes("Зависимая переменная предложена организаторами: Q13_r3 «Я часто хочу бросить обучение в аспирантуре».");

// ===== 3. Данные =====
s = content("Данные: 5 007 аспирантов из 249 вузов", "Вопрос и данные");
const stats = [
  [R.n_total.toLocaleString("ru-RU").replace(/ /g, " "), "респондентов, онлайн-опрос, май–июль 2021"],
  [String(R.n_unis), "вузов (используем для кластерных ошибок)"],
  [pct(R.quit_share), "согласны: «Я часто хочу бросить аспирантуру»"],
  [pct(R.phq_mod_share), "с умеренными и выше депрессивными симптомами (PHQ-8 ≥ 10)"],
];
stats.forEach(([b, l], i) => {
  const x = M + i * 3.05;
  card(s, x, 1.5, 2.8, 2.15);
  stat(s, x + 0.25, 1.6, 2.4, b, l, i >= 2 ? C.accent2 : C.accent1);
});
s.addText("Ключевые переменные", { x: M, y: 4.0, w: 6, h: 0.4, fontSize: 18, bold: true, color: C.text2, margin: 0, isTextBox: true });
const vars = [
  ["Зависимая", "Q13_r3, шкала 1–4; бинарно «скорее/полностью согласен» (основная), порядковая (проверка)"],
  ["Руководитель", "удовлетворённость взаимодействием (Q11), частота общения (Q50)"],
  ["Академическая среда", `индекс принадлежности из 6 пунктов Qatm, α = ${R.alpha_belong.toFixed(2)}`],
  ["Ментальное здоровье", `PHQ-8, 0–24 балла, α = ${R.alpha_phq.toFixed(2)}`],
  ["Занятость", "5 типов (Q20) + связь работы с диссертацией (Q23)"],
  ["Контроли", "пол, год и форма обучения, платное место, дети, брак, направление, регион, цели, публикации"],
];
s.addTable(vars.map(([a, b]) => [
  { text: a, options: { bold: true, color: C.text2 } }, { text: b, options: { color: C.text1 } },
]), { x: M, y: 4.45, w: W - 2 * M, colW: [2.6, W - 2 * M - 2.6], fontSize: 13, rowH: 0.36,
  border: { type: "solid", pt: 0.75, color: HEX.grid }, margin: [2, 6, 2, 6] });

// ===== 4. Методы =====
pres.addSection({ title: "Методы" });
s = content("Методы: от описательных срезов к механизмам", "Методы");
const steps = [
  ["1", "Логит-регрессия", "4 вложенные модели, блоки предикторов, ошибки кластеризованы по вузу. Проверка: порядковый логит"],
  ["2", "Важность блоков", "Декомпозиция Шепли псевдо-R² Макфаддена по 7 блокам (128 моделей)"],
  ["3", "Медиация", "Руководитель / среда → PHQ-8 → намерение уйти. Бутстрэп 500 повторов, 95% ДИ"],
  ["4", "Модерация", "Принадлежность × полная занятость вне вуза"],
];
steps.forEach(([n, h, t], i) => {
  const x = M + i * 3.05;
  card(s, x, 1.55, 2.8, 3.4);
  s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 1.8, w: 0.7, h: 0.7, fill: { color: C.accent1 }, line: { color: C.accent1 } });
  s.addText(n, { x: x + 0.25, y: 1.8, w: 0.7, h: 0.7, fontSize: 22, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText(h, { x: x + 0.25, y: 2.7, w: 2.35, h: 0.45, fontSize: 17, bold: true, color: C.text2, margin: 0, isTextBox: true });
  s.addText(t, { x: x + 0.25, y: 3.2, w: 2.35, h: 1.6, fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true });
});
card(s, M, 5.25, W - 2 * M, 1.45, { fill: C.background1 });
s.addText([
  { text: "Выборка для моделей: ", options: { bold: true } },
  { text: `${R.n_model.toLocaleString("ru-RU").replace(/ /g, " ")} аспирантов с полными ответами (${pct(R.n_model / R.n_total)} от массива). ` },
  { text: "Предсказательная проверка: ", options: { bold: true } },
  { text: `5-кратная кросс-валидация, ROC AUC. Непрерывные предикторы стандартизованы (эффект на 1 SD). Python: statsmodels, scikit-learn; код воспроизводим.` },
], { x: M + 0.1, y: 5.3, w: W - 2 * M - 0.2, h: 1.3, fontSize: 14, color: C.text1, margin: 0, valign: "middle", isTextBox: true });

// ===== 5. Главный контраст =====
pres.addSection({ title: "Результаты" });
s = content("Работа почти не меняет риск, а руководитель, среда и здоровье меняют его в 4–6 раз", "Результаты");
lead(s, `Доля согласных с «Я часто хочу бросить аспирантуру», среднее по выборке ${pct(R.quit_share)}. ПД = полный день`, 1.4);
const panels = [
  ["Тип занятости", ["Не работает", "Подработки", "Неполный день", "ПД в своём вузе", "ПД вне вуза"],
    ["Нет", "Подраб.", "Неполн.", "ПД вуз", "ПД вне"], R.by_work, HEX.gray],
  ["Удовл. руководителем", ["1.0", "2.0", "3.0", "4.0"], ["Совсем нет", "Скорее нет", "Скорее да", "Полн."], R.by_sup, HEX.blue],
  ["Принадлежность (1–4)", ["≤2.5", "2.5–3", "3–3.5", "3.5–4"], ["≤2.5", "2.5–3", "3–3.5", "3.5–4"], R.by_belong, HEX.blue],
  ["Депр. симптомы PHQ-8", ["Минимальные", "Лёгкие", "Умеренные", "Выраженные"], ["0–4", "5–9", "10–14", "15+"], R.by_phq, HEX.orange],
];
panels.forEach(([t, keys, labs, src, col], i) => {
  const x = M + i * 3.05;
  s.addChart(pres.charts.BAR, [{ name: t, labels: labs, values: keys.map((k) => src[k].mean) }], {
    ...chartBase(), x, y: 1.95, w: 2.95, h: 4.1, barDir: "col", title: t, chartColors: [col],
    valAxisMaxVal: 0.7, catAxisLabelFontSize: 10, catAxisLabelRotate: 0,
  });
});
s.addText([
  { text: "Разброс по типу занятости: ", options: { bold: true } },
  { text: "20–24%. По руководителю: 13–61%, по принадлежности: 10–55%, по PHQ-8: 9–52%." },
], { x: M, y: 6.2, w: W - 2 * M, h: 0.5, fontSize: 15, color: C.text1, margin: 0, isTextBox: true });

// ===== 6. Воспринимаемое vs реальное =====
s = content("Работу чаще всего называют трудностью, но сильнее «сигналят» тема и руководитель", "Результаты");
const pf = [...R.perceived].sort((a, b) => b.rr - a.rr);
const labs6 = pf.map((p) => p.label);
s.addChart(pres.charts.BAR, [{ name: "Серьёзная трудность", labels: labs6, values: pf.map((p) => p.prev) }], {
  ...chartBase(), x: M, y: 1.45, w: 6.2, h: 4.6, barDir: "bar", title: "Называют серьёзной трудностью, % аспирантов",
  chartColors: [HEX.gray], catAxisOrientation: "maxMin", catAxisLabelFontSize: 12, valAxisMaxVal: 0.6,
});
s.addChart(pres.charts.BAR, [{ name: "Отн. риск", labels: labs6, values: pf.map((p) => +p.rr.toFixed(1)) }], {
  ...chartBase(), x: 6.95, y: 1.45, w: 5.8, h: 4.6, barDir: "bar", title: "Во сколько раз чаще хотят бросить",
  chartColors: [HEX.blue], catAxisOrientation: "maxMin", catAxisHidden: true, dataLabelFormatCode: '"×"0.0', valAxisMaxVal: 6,
});
const work = R.perceived.find((p) => p.key === "dif_work");
const intr = R.perceived.find((p) => p.key === "dif_interest");
s.addText([
  { text: "Вывод: ", options: { bold: true } },
  { text: `совмещение с работой отмечают ${pct(work.prev)}, но сам факт работы риск не повышает (слайд 5). Опасна не работа, а её восприятие как конфликта. Потеря интереса к теме встречается у ${pct(intr.prev)}, но среди них хотят уйти ${pct(intr.q1)}.` },
], { x: M, y: 6.15, w: W - 2 * M, h: 0.75, fontSize: 14, color: C.text1, margin: 0, isTextBox: true, valign: "top" });

// ===== 7. Регрессия =====
s = content("При прочих равных: руководитель, среда и здоровье значимы, тип работы нет", "Результаты");
s.addImage({ path: FIG("03_forest.png"), x: M, y: 1.4, w: 7.6, h: 7.6 * 1112 / 2300 });
card(s, 8.55, 1.45, 4.2, 5.25);
const OR = R.full_or;
const ptsOR = [
  ["×" + OR.phq.OR.toFixed(2), "шансы на +1 SD депрессивных симптомов", C.accent2],
  ["×" + OR.belong.OR.toFixed(2), "шансы на +1 SD принадлежности к кафедре", C.accent1],
  ["×" + OR.sup_sat.OR.toFixed(2), "шансы на +1 SD удовлетворённости руководителем", C.accent1],
  ["×" + OR["C(work, Treatment('Не работает'))[T.ПД вне вуза]"].OR.toFixed(2), "полный день вне вуза, p = " + OR["C(work, Treatment('Не работает'))[T.ПД вне вуза]"].p.toFixed(2) + " (H1 не подтверждена)", C.text2],
];
ptsOR.forEach(([b, l, col], i) => {
  const y = 1.6 + i * 1.25;
  s.addText(b, { x: 8.8, y, w: 1.5, h: 0.6, fontSize: 26, bold: true, color: col, margin: 0, isTextBox: true, valign: "middle" });
  s.addText(l, { x: 10.3, y, w: 2.3, h: 0.9, fontSize: 13, color: C.text1, margin: 0, isTextBox: true, valign: "top" });
});
s.addText(`Логит, N = ${R.n_model}, псевдо-R² = ${R.full_r2.toFixed(2)}. Порядковый логит даёт те же знаки и значимость.`,
  { x: M, y: 6.35, w: 7.6, h: 0.4, fontSize: 12, color: C.text2, margin: 0, isTextBox: true });

// ===== 8. Важность =====
s = content("Три фактора среды объясняют две трети объяснённого, занятость менее 2%", "Результаты");
const sh = Object.entries(R.shapley).sort((a, b) => b[1].share - a[1].share);
s.addChart(pres.charts.BAR, [{ name: "Доля", labels: sh.map((e) => e[0]), values: sh.map((e) => e[1].share) }], {
  ...chartBase(), x: M, y: 1.45, w: 7.4, h: 5.2, barDir: "bar", title: "Вклад блока в псевдо-R² (декомпозиция Шепли)",
  chartColors: [HEX.blue], catAxisOrientation: "maxMin", catAxisLabelFontSize: 13, valAxisMaxVal: 0.32,
});
card(s, 8.4, 1.45, 4.35, 2.45);
stat(s, 8.65, 1.55, 3.9, R.cv_auc_full.toFixed(2), "ROC AUC полной модели (5-fold CV)", C.accent1);
card(s, 8.4, 4.2, 4.35, 2.45);
stat(s, 8.65, 4.3, 3.9, R.cv_auc_external.toFixed(2), "AUC только по внешним факторам: соцдем, программа, занятость", C.text2);
s.addNotes("Здоровье, среда и руководитель вместе дают около 67% объяснённой вариации; мотивация (интерес к теме, цель получить степень) около 22%.");

// ===== 9. Механизмы =====
s = content("Механизмы: часть эффекта идёт через здоровье, а принадлежность защищает работающих", "Результаты");
s.addText("Медиация через PHQ-8 (LPM, бутстрэп)", { x: M, y: 1.45, w: 6.2, h: 0.4, fontSize: 15, bold: true, color: C.text2, margin: 0, isTextBox: true });
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
  [{ text: "", options: {} }, { text: "Руководитель", options: { bold: true } }, { text: "Принадлежность", options: { bold: true } }],
  ["Общий эффект, п.п. на 1 SD", (med.sup_sat.total * 100).toFixed(1), (med.belong.total * 100).toFixed(1)],
  ["Косвенный через PHQ-8", (med.sup_sat.indirect * 100).toFixed(1), (med.belong.indirect * 100).toFixed(1)],
  ["95% ДИ косвенного", med.sup_sat.ci.map((v) => (v * 100).toFixed(1)).join("…"), med.belong.ci.map((v) => (v * 100).toFixed(1)).join("…")],
  ["Доля медиации", pct(med.sup_sat.prop), pct(med.belong.prop)],
], { x: M, y: 4.55, w: 6.1, colW: [2.7, 1.6, 1.8], fontSize: 13, color: HEX.ink, rowH: 0.36,
  border: { type: "solid", pt: 0.75, color: HEX.grid }, margin: [2, 6, 2, 6] });
s.addText("Модерация: принадлежность × полный день вне вуза", { x: 7.0, y: 1.45, w: 5.8, h: 0.4, fontSize: 15, bold: true, color: C.text2, margin: 0, isTextBox: true });
s.addImage({ path: FIG("05_interaction.png"), x: 7.0, y: 1.9, w: 5.75, h: 5.75 * 1035 / 1660 });
s.addText(`Взаимодействие β = ${R.interaction.coef.toFixed(2)}, p = ${R.interaction.p.toFixed(3)}: при слабой принадлежности работающие полный день вне вуза в зоне наибольшего риска (H4).`,
  { x: 7.0, y: 5.6, w: 5.75, h: 1.1, fontSize: 13, color: C.text1, margin: 0, isTextBox: true, valign: "top" });

// ===== 10. Выводы =====
pres.addSection({ title: "Выводы" });
s = pres.addSlide({ masterName: "DARKCONTENT", sectionTitle: "Выводы" });
s.addText("Выводы и что может сделать вуз", { placeholder: "title" });
const concl = [
  ["Что нашли", [
    "H1 нет: тип занятости не связан с намерением уйти",
    "H2 да: руководитель, среда и здоровье дают ~2/3 объяснённого",
    `H3 частично: ${pct(med.belong.prop)} эффекта среды идёт через здоровье`,
    "H4 да: принадлежность сильнее защищает работающих",
  ]],
  ["Что делать вузу", [
    "Скрининг благополучия (PHQ-8) на ежегодной аттестации",
    "Стандарт: встреча с руководителем не реже 2 раз в месяц",
    "Аспирантские семинары и сообщество, особенно для работающих",
    "Не ограничивать работу, а связывать её с темой диссертации",
  ]],
  ["Ограничения", [
    "Кросс-секционные данные: связи, не причинность",
    "Намерение, а не факт отчисления",
    "Самоотбор в онлайн-опросе, весна 2021 (пандемия)",
    "Дальше: связать с данными МЭВ по выпуску аспирантов",
  ]],
];
concl.forEach(([h, items], i) => {
  const x = M + i * 4.1;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.5, w: 3.85, h: 4.85, rectRadius: 0.08, fill: { color: "22335A" }, line: { color: "22335A" } });
  s.addText(h, { x: x + 0.3, y: 1.7, w: 3.3, h: 0.45, fontSize: 19, bold: true, color: i === 1 ? C.accent2 : C.background1, margin: 0, isTextBox: true });
  s.addText(items.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < items.length - 1 } })),
    { x: x + 0.3, y: 2.3, w: 3.3, h: 3.9, fontSize: 14, color: C.background1, margin: 0, paraSpaceAfter: 10, valign: "top", isTextBox: true });
});
s.addText("Исследование осуществлено с использованием данных Программы фундаментальных исследований НИУ ВШЭ (HSE-BR-2025-009). Контекст о защитах: ИСИЭЗ НИУ ВШЭ.",
  { x: M, y: 6.55, w: W - 2 * M - 1, h: 0.4, fontSize: 10, color: C.background2, margin: 0, isTextBox: true });

(async () => {
  await pres.writeFile({ fileName: OUTFILE });
  await applyTheme(OUTFILE, THEME);
  console.log("written", OUTFILE);
})();
