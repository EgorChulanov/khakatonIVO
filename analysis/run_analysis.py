"""Анализ: что связано с желанием бросить аспирантуру.

Запуск:  ASP_SAV=/path/to/Аспиранты_массив.sav python3 analysis/run_analysis.py
Результат: output/results.json и output/figures/*.png (только агрегаты).
"""
import itertools
import json
import os
import warnings

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

from prep import load, cronbach, clean

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "output")
FIG = os.path.join(OUT, "figures")
os.makedirs(FIG, exist_ok=True)

# Палитра (light): серия 1 / акцент / нейтральный
BLUE, ORANGE, GRAY, INK, INK2, GRID = "#2a78d6", "#eb6834", "#b9b8b2", "#0b0b0b", "#52514e", "#e6e5e0"
plt.rcParams.update({
    "font.family": "Inter", "font.size": 13, "axes.edgecolor": GRID,
    "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
    "axes.spines.top": False, "axes.spines.right": False, "axes.grid": False,
    "figure.dpi": 200, "savefig.bbox": "tight", "savefig.facecolor": "white",
})

d, raw, meta = load()
R = {"n_total": int(len(d)), "n_valid_dv": int(d.quit.notna().sum())}
R["quit_share"] = float(d.quit.mean())
R["quit_dist"] = d.drop_ord.value_counts(normalize=True).sort_index().round(4).to_dict()
R["alpha_belong"] = float(cronbach(raw[[f"Qatm_r{i}" for i in range(1, 7)]].apply(clean)))
R["alpha_phq"] = float(cronbach(raw[[f"Q19_r{i}" for i in range(1, 9)]]))
R["phq_mod_share"] = float(d.phq_mod.mean())
R["n_unis"] = int(d.uni.nunique())

# ---------- Модельная выборка ----------
d["z_sup"] = d.sup_sat
d["z_belong"] = d.belong
WORK_LEVELS = ["Не работает", "Подработки", "Неполный день", "ПД в своём вузе", "ПД вне вуза"]
GROUPS = {
    "Соцдем и программа": "female + year + extramural + paid + children + married + honors + gap"
                          " + moscow_spb + C(field, Treatment('Инженерия'))",
    "Мотивация": "goal_army + goal_degree + topic_int",
    "Занятость": "C(work, Treatment('Не работает')) + work_unrel",
    "Научный руководитель": "sup_sat + sup_rare",
    "Академическая среда": "belong",
    "Ментальное здоровье": "phq",
    "Публикации": "no_pubs",
}
need = ["quit", "drop_ord", "female", "year", "extramural", "paid", "children", "married",
        "honors", "gap", "moscow_spb", "field", "goal_army", "goal_degree", "topic_int",
        "work", "work_unrel", "sup_sat", "sup_rare", "belong", "phq", "no_pubs", "uni"]
m = d[need].dropna().copy()
R["n_model"] = int(len(m))

R["quit_share_model"] = float(m.quit.mean())

# Стандартизуем непрерывные предикторы (OR на 1 SD)
SD = {}
for c in ["sup_sat", "belong", "phq", "topic_int", "year"]:
    SD[c] = (m[c].mean(), m[c].std())
    m[c] = (m[c] - m[c].mean()) / m[c].std()


def fit(rhs, data=m, y="quit"):
    return smf.logit(f"{y} ~ {rhs}", data).fit(
        disp=0, cov_type="cluster", cov_kwds={"groups": data.uni.astype(int)})


def mcfadden(rhs):
    if not rhs:
        return 0.0
    return smf.logit(f"quit ~ {rhs}", m).fit(disp=0).prsquared


# Иерархические модели
blocks = list(GROUPS)
steps = [blocks[:1], blocks[:3], blocks[:5], blocks[:7]]
R["models"] = []
for i, s in enumerate(steps, 1):
    res = fit(" + ".join(GROUPS[g] for g in s))
    R["models"].append({"name": f"M{i}", "blocks": s, "pseudo_r2": res.prsquared,
                        "aic": res.aic, "n": int(res.nobs)})
full = fit(" + ".join(GROUPS.values()))
or_tab = pd.DataFrame({"OR": np.exp(full.params), "lo": np.exp(full.conf_int()[0]),
                       "hi": np.exp(full.conf_int()[1]), "p": full.pvalues}).drop("Intercept")
R["full_or"] = or_tab.round(4).to_dict(orient="index")

# Ординальная модель как проверка устойчивости
from statsmodels.miscmodels.ordinal_model import OrderedModel
X = pd.get_dummies(m[["female", "year", "extramural", "paid", "children", "married", "honors",
                      "gap", "moscow_spb", "goal_army", "goal_degree", "topic_int", "work_unrel",
                      "sup_sat", "sup_rare", "belong", "phq", "no_pubs", "work", "field"]],
                   columns=["work", "field"], drop_first=True, dtype=float)
ordm = OrderedModel(m.drop_ord.astype(int), X, distr="logit").fit(method="bfgs", disp=0, maxiter=500)
R["ordinal_or"] = {k: float(np.exp(ordm.params[k])) for k in ["sup_sat", "belong", "phq", "topic_int",
                                                              "goal_army", "work_unrel"]}
R["ordinal_p"] = {k: float(ordm.pvalues[k]) for k in R["ordinal_or"]}

# ---------- Шепли-декомпозиция псевдо-R² по блокам ----------
cache = {}
for k in range(len(blocks) + 1):
    for comb in itertools.combinations(blocks, k):
        cache[frozenset(comb)] = mcfadden(" + ".join(GROUPS[g] for g in comb))
from math import factorial
n = len(blocks)
shap = {}
for g in blocks:
    v = 0.0
    for S, r2 in cache.items():
        if g in S:
            continue
        w = factorial(len(S)) * factorial(n - len(S) - 1) / factorial(n)
        v += w * (cache[S | {g}] - r2)
    shap[g] = v
tot = sum(shap.values())
R["shapley"] = {g: {"r2": shap[g], "share": shap[g] / tot} for g in blocks}
R["full_r2"] = tot

# ---------- Предсказательная проверка: 5-fold CV AUC ----------
Xc = pd.get_dummies(m.drop(columns=["quit", "drop_ord", "uni"]), columns=["work", "field"],
                    drop_first=True, dtype=float)
Xs = (Xc - Xc.mean()) / Xc.std()
lr = LogisticRegression(max_iter=2000)
R["cv_auc_full"] = float(cross_val_score(lr, Xs, m.quit, cv=5, scoring="roc_auc").mean())
ext = [c for c in Xs.columns if c.startswith("work") or c in
       ("female", "year", "extramural", "paid", "children", "married", "honors", "gap",
        "moscow_spb") or c.startswith("field")]
R["cv_auc_external"] = float(cross_val_score(lr, Xs[ext], m.quit, cv=5, scoring="roc_auc").mean())

# ---------- Медиация через PHQ-8 (бутстрэп, LPM) ----------
ctrl = GROUPS["Соцдем и программа"] + " + " + GROUPS["Мотивация"] + " + " + GROUPS["Занятость"]


def med(x, data):
    a = smf.ols(f"phq ~ {x} + {ctrl}", data).fit().params[x]
    mdl = smf.ols(f"quit ~ {x} + phq + {ctrl}", data).fit()
    tot_ = smf.ols(f"quit ~ {x} + {ctrl}", data).fit().params[x]
    return a, mdl.params["phq"], mdl.params[x], tot_


rng = np.random.default_rng(42)
R["mediation"] = {}
for x in ["sup_sat", "belong"]:
    a, b, c1, c = med(x, m)
    boots = []
    for _ in range(500):
        s = m.sample(len(m), replace=True, random_state=int(rng.integers(1e9)))
        aa, bb, _, _ = med(x, s)
        boots.append(aa * bb)
    R["mediation"][x] = {"a": a, "b": b, "direct": c1, "total": c, "indirect": a * b,
                         "ci": list(np.percentile(boots, [2.5, 97.5])), "prop": a * b / c}

# ---------- Взаимодействие: среда × работа вне вуза ----------
m["ft_out"] = (m.work == "ПД вне вуза").astype(float)
inter = fit(GROUPS["Соцдем и программа"] + " + " + GROUPS["Мотивация"] +
            " + sup_sat + sup_rare + phq + no_pubs + work_unrel + ft_out * belong")
R["interaction"] = {"coef": float(inter.params["ft_out:belong"]),
                    "p": float(inter.pvalues["ft_out:belong"])}

# ---------- «Воспринимаемые» трудности vs реальная связь ----------
DIF = {"dif_work": "Совмещение с работой", "dif_fund": "Нехватка финансирования",
       "dif_pub": "Публикации", "dif_time": "Тайм-менеджмент", "dif_skills": "Нехватка навыков",
       "dif_interest": "Потеря интереса к теме", "dif_health": "Здоровье",
       "dif_sup": "Отношения с руководителем"}
perc = []
for k, lab in DIF.items():
    sub = d[[k, "quit"]].dropna()
    p1, p0 = sub[sub[k] == 1].quit.mean(), sub[sub[k] == 0].quit.mean()
    perc.append({"key": k, "label": lab, "prev": sub[k].mean(), "q1": p1, "q0": p0,
                 "rr": p1 / p0})
R["perceived"] = perc

# ---------- Описательные срезы для графиков ----------
def share(col, order=None):
    g = d.groupby(col).quit.agg(["mean", "count"])
    return g.reindex(order) if order else g


R["by_work"] = share("work", WORK_LEVELS).round(4).to_dict(orient="index")
R["by_sup"] = share("sup_sat").round(4).to_dict(orient="index")
d["belong_g"] = pd.cut(d.belong, [0, 2.5, 3.0, 3.5, 4.01], labels=["≤2.5", "2.5–3", "3–3.5", "3.5–4"])
R["by_belong"] = {str(k): v for k, v in share("belong_g").round(4).to_dict(orient="index").items()}
d["phq_g"] = pd.cut(d.phq, [-1, 4, 9, 14, 24], labels=["Минимальные", "Лёгкие", "Умеренные", "Выраженные"])
R["by_phq"] = {str(k): v for k, v in share("phq_g").round(4).to_dict(orient="index").items()}
R["by_army"] = share("goal_army").round(4).to_dict(orient="index")

with open(os.path.join(OUT, "results.json"), "w") as f:
    json.dump(R, f, ensure_ascii=False, indent=1, default=float)

# =================== ГРАФИКИ ===================
pct = lambda v: f"{v*100:.0f}%"


def bars(ax, labels, vals, ns, title, hi=None):
    cols = [ORANGE if (hi is not None and i in hi) else BLUE for i in range(len(vals))]
    ax.bar(labels, vals, color=cols, width=0.62, edgecolor="white", linewidth=1.5)
    for i, (v, nn) in enumerate(zip(vals, ns)):
        ax.text(i, v + 0.015, pct(v), ha="center", va="bottom", color=INK, fontsize=13, weight="bold")
    ax.axhline(R["quit_share"], color=INK2, lw=1, ls=(0, (3, 3)))
    ax.set_ylim(0, 0.72)
    ax.set_yticks([])
    ax.spines["left"].set_visible(False)
    ax.set_title(title, loc="left", color=INK, fontsize=14, weight="bold", pad=10)
    ax.tick_params(axis="x", length=0, labelsize=11)


# 1. Контраст: работа vs руководитель vs среда vs PHQ
fig, axs = plt.subplots(1, 4, figsize=(17, 4.6), sharey=True)
w = share("work", WORK_LEVELS)
bars(axs[0], ["Не\nработает", "Подра-\nботки", "Неполн.\nдень", "ПД\nв вузе", "ПД\nвне вуза"],
     w["mean"], w["count"], "Тип занятости")
s = share("sup_sat")
bars(axs[1], ["Совсем\nне удовл.", "Скорее\nне удовл.", "Скорее\nудовл.", "Полностью\nудовл."],
     s["mean"], s["count"], "Удовлетворённость\nнаучным руководителем", hi=[0, 1])
b = share("belong_g")
bars(axs[2], ["≤2.5", "2.5–3", "3–3.5", "3.5–4"], b["mean"], b["count"],
     "Индекс академической\nпринадлежности (1–4)", hi=[0])
p = share("phq_g")
bars(axs[3], ["Минимал.\n0–4", "Лёгкие\n5–9", "Умерен.\n10–14", "Выраж.\n15+"], p["mean"], p["count"],
     "Депрессивные симптомы\n(PHQ-8)", hi=[2, 3])
axs[0].set_title("Тип занятости\n", loc="left", color=INK, fontsize=14, weight="bold", pad=10)
fig.text(0.0, -0.04, f"Доля согласных с «Я часто хочу бросить аспирантуру». Пунктир: среднее по выборке "
         f"({pct(R['quit_share'])}). N = {R['n_valid_dv']}.", color=INK2, fontsize=11)
fig.tight_layout()
fig.savefig(os.path.join(FIG, "01_contrast.png"))
plt.close(fig)

# 2. Воспринимаемое vs реальное: два панели, общая сортировка по относительному риску
pf = pd.DataFrame(perc).sort_values("rr")
fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 5.2), sharey=True,
                             gridspec_kw={"width_ratios": [1, 1], "wspace": 0.08})
y = np.arange(len(pf))
a1.barh(y, pf.prev, color=GRAY, height=0.6, edgecolor="white", linewidth=1.5)
a2.barh(y, pf.rr, color=[ORANGE if r >= 3 else BLUE for r in pf.rr], height=0.6,
        edgecolor="white", linewidth=1.5)
for yi, (pv, rr) in enumerate(zip(pf.prev, pf.rr)):
    a1.text(pv + 0.008, yi, pct(pv), va="center", color=INK2, fontsize=12)
    a2.text(rr + 0.06, yi, f"×{rr:.1f}", va="center", color=INK, fontsize=12, weight="bold")
a2.axvline(1, color=INK2, lw=1)
a1.set_title("Называют серьёзной трудностью", loc="left", color=INK, fontsize=13, weight="bold")
a2.set_title("Во сколько раз чаще хотят бросить", loc="left", color=INK, fontsize=13, weight="bold")
a1.set_yticks(y)
a1.set_yticklabels(pf.label, fontsize=12, color=INK)
a1.set_xlim(0, 0.55)
a2.set_xlim(0, 5.6)
for ax in (a1, a2):
    ax.set_xticks([])
    ax.spines["bottom"].set_visible(False)
    ax.spines["left"].set_visible(False)
    ax.tick_params(axis="y", length=0)
fig.savefig(os.path.join(FIG, "02_perceived_vs_real.png"))
plt.close(fig)

# 3. Forest plot ключевых OR
keys = [("sup_sat", "Удовл. руководителем (+1 SD)"), ("sup_rare", "Общение с рук. раз в месяц и реже"),
        ("belong", "Академическая принадлежность (+1 SD)"), ("phq", "Депрессивные симптомы PHQ-8 (+1 SD)"),
        ("topic_int", "Интерес к теме (+1 SD)"), ("goal_army", "Цель: отсрочка от армии"),
        ("no_pubs", "Нет публикаций за год"),
        ("C(work, Treatment('Не работает'))[T.ПД вне вуза]", "Полный день вне вуза"),
        ("work_unrel", "…и работа не связана с диссертацией"),
        ("C(work, Treatment('Не работает'))[T.ПД в своём вузе]", "Полный день в своём вузе"),
        ("children", "Есть дети"), ("paid", "Платное обучение"), ("year", "Год обучения (+1 SD)")]
ft = or_tab.loc[[k for k, _ in keys]]
fig, ax = plt.subplots(figsize=(10, 6.2))
yy = np.arange(len(keys))[::-1]
sig = ft.p < 0.05
col = [ORANGE if (s_ and o > 1) else BLUE if s_ else GRAY for s_, o in zip(sig, ft.OR)]
ax.hlines(yy, ft.lo, ft.hi, color=col, lw=2)
ax.scatter(ft.OR, yy, color=col, s=70, zorder=3, edgecolor="white", linewidth=1.5)
ax.axvline(1, color=INK2, lw=1)
ax.set_xscale("log")
ax.set_xticks([0.3, 0.5, 1, 2, 3])
ax.set_xticklabels(["0.3", "0.5", "1", "2", "3"])
ax.xaxis.set_minor_formatter(matplotlib.ticker.NullFormatter())
ax.set_yticks(yy)
ax.set_yticklabels([l for _, l in keys], color=INK, fontsize=12)
for yi, o in zip(yy, ft.OR):
    ax.text(3.6, yi, f"{o:.2f}", va="center", color=INK, fontsize=11)
ax.set_xlim(0.25, 4.2)
ax.tick_params(axis="y", length=0)
ax.spines["left"].set_visible(False)
ax.set_xlabel("Отношение шансов (95% ДИ, кластер по вузу)")
fig.savefig(os.path.join(FIG, "03_forest.png"))
plt.close(fig)

# 4. Шепли
sh = pd.Series({g: v["share"] for g, v in R["shapley"].items()}).sort_values()
fig, ax = plt.subplots(figsize=(9, 4.8))
top = sh.index[-3:]
ax.barh(sh.index, sh.values, color=[ORANGE if g in top else BLUE for g in sh.index], height=0.6,
        edgecolor="white", linewidth=1.5)
for i, v in enumerate(sh.values):
    ax.text(v + 0.005, i, pct(v), va="center", color=INK, fontsize=12, weight="bold")
ax.set_xticks([])
ax.spines["bottom"].set_visible(False)
ax.spines["left"].set_visible(False)
ax.tick_params(axis="y", length=0, labelsize=12, labelcolor=INK)
fig.savefig(os.path.join(FIG, "04_shapley.png"))
plt.close(fig)

# 5. Взаимодействие: предсказанные вероятности
grid = np.linspace(m.belong.quantile(0.05), m.belong.quantile(0.95), 30)
fig, ax = plt.subplots(figsize=(8, 4.8))
for ft_v, colr, lab in [(0, BLUE, "Остальные"), (1, ORANGE, "Полный день вне вуза")]:
    preds = []
    for gv in grid:
        t = m.copy()
        t["belong"], t["ft_out"] = gv, ft_v
        if ft_v == 0:
            t["work_unrel"] = 0
        preds.append(inter.predict(t).mean())
    ax.plot(grid * SD["belong"][1] + SD["belong"][0], preds, color=colr, lw=2.5, label=lab)
ax.set_xlabel("Индекс академической принадлежности (1–4)")
ax.set_ylabel("Прогноз. вероятность хотеть бросить")
ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1, decimals=0))
ax.legend(frameon=False)
fig.savefig(os.path.join(FIG, "05_interaction.png"))
plt.close(fig)

print(json.dumps({k: R[k] for k in ["n_model", "quit_share", "full_r2", "cv_auc_full",
                                    "cv_auc_external", "shapley", "mediation", "interaction",
                                    "models", "ordinal_or", "ordinal_p"]},
                 ensure_ascii=False, indent=1, default=float))
print(or_tab.round(3).to_string())
for x in perc:
    print(x)
