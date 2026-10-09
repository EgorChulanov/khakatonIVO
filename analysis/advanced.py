"""Продвинутый блок: многоуровневая модель (опрос + МЭВ), ML, профили риска,
симуляция мер политики, устойчивость (E-value, PSM).

Запуск: ASP_SAV=... MEV_XLSX=... python3 analysis/advanced.py
"""
import json
import os
import warnings

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance, partial_dependence
from sklearn.linear_model import LogisticRegression
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.metrics import roc_auc_score
from sklearn.neighbors import NearestNeighbors
from statsmodels.genmod.bayes_mixed_glm import BinomialBayesMixedGLM

from prep import load
from link_mev import build as build_link, IND

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT, FIG = os.path.join(ROOT, "output"), os.path.join(ROOT, "output", "figures")
BLUE, ORANGE, GRAY, INK, INK2, GRID = "#2a78d6", "#eb6834", "#b9b8b2", "#0b0b0b", "#52514e", "#e6e5e0"
AQUA, VIOLET = "#1baf7a", "#4a3aa7"
plt.rcParams.update({
    "font.family": "Inter", "font.size": 13, "axes.edgecolor": GRID, "axes.labelcolor": INK2,
    "xtick.color": INK2, "ytick.color": INK2, "axes.spines.top": False, "axes.spines.right": False,
    "figure.dpi": 200, "savefig.bbox": "tight", "savefig.facecolor": "white",
})
rng = np.random.default_rng(7)
A = {}

d, raw, meta = load()
CTRL = ("female + year + extramural + paid + children + married + honors + gap + moscow_spb"
        " + C(field, Treatment('Инженерия')) + goal_army + goal_degree + topic_int"
        " + C(work, Treatment('Не работает')) + work_unrel + no_pubs")
CORE = "sup_sat + sup_rare + belong + phq"
need = ["quit", "female", "year", "extramural", "paid", "children", "married", "honors", "gap",
        "moscow_spb", "field", "goal_army", "goal_degree", "topic_int", "work", "work_unrel",
        "no_pubs", "sup_sat", "sup_rare", "belong", "phq", "uni"]
m = d[need].dropna().copy()
RAW = m.copy()  # нестандартизованные значения для сценариев
SD = {}
for c in ["sup_sat", "belong", "phq", "topic_int", "year"]:
    SD[c] = (m[c].mean(), m[c].std())
    m[c] = (m[c] - SD[c][0]) / SD[c][1]
A["n"] = int(len(m))

# ======================= 1. Многоуровневая модель =======================
link = build_link()
link = link[link.score >= 0.95].set_index("QVuz")
uni_n = m.uni.value_counts()
m["uni_code"] = m.uni.where(m.uni.map(uni_n) >= 10, -1)  # мелкие вузы и «другой» в одну группу
mm = m[m.uni_code != -1].copy()
A["ml_n"], A["ml_unis"] = int(len(mm)), int(mm.uni_code.nunique())


def glmm(formula, data):
    md = BinomialBayesMixedGLM.from_formula(formula, {"u": "0 + C(uni_code)"}, data)
    r = md.fit_vb()
    sd_u = float(np.exp(r.vcp_mean[0]))
    return r, sd_u, sd_u ** 2 / (sd_u ** 2 + np.pi ** 2 / 3)


r0, sd0, icc0 = glmm("quit ~ 1", mm)
r1, sd1, icc1 = glmm(f"quit ~ {CTRL}", mm)
r2, sd2, icc2 = glmm(f"quit ~ {CTRL} + {CORE}", mm)
A["icc"] = {"null": icc0, "controls": icc1, "full": icc2}
A["mor"] = {"null": float(np.exp(np.sqrt(2) * sd0 * 0.6745)), "full": float(np.exp(np.sqrt(2) * sd2 * 0.6745))}

# Эмпирические эффекты вузов (нулевая модель) для вузов с n>=30, обезличенно
re_names = r0.model.vc_names
re_mean = pd.Series(r0.vc_mean, index=re_names)
re_sd = pd.Series(r0.vc_sd, index=re_names)
base = float(r0.fe_mean[0])
big = uni_n[uni_n >= 30].index
cat = []
for u in big:
    key = f"C(uni_code)[{u}]"
    if key in re_mean:
        lo, mid, hi = (base + re_mean[key] + z * re_sd[key] for z in (-1.96, 0, 1.96))
        obs = mm[mm.uni_code == u].quit.mean()
        cat.append({"mid": 1 / (1 + np.exp(-mid)), "lo": 1 / (1 + np.exp(-lo)), "hi": 1 / (1 + np.exp(-hi)),
                    "obs": obs, "n": int(uni_n[u])})
cat = pd.DataFrame(cat).sort_values("mid").reset_index(drop=True)
A["uni_range"] = {"min": float(cat.mid.min()), "max": float(cat.mid.max()), "k": int(len(cat))}

# Межуровневые предикторы из МЭВ
for c in IND:
    mm[c] = mm.uni.map(link[c])
uni_vars = ["phd_per100", "staff_defended", "grants_per100", "rd_share", "income_per_student", "ege"]
cl = mm.dropna(subset=uni_vars).copy()
for c in uni_vars:
    cl[c] = np.log1p(cl[c].clip(lower=0))
    cl[c] = (cl[c] - cl[c].mean()) / cl[c].std()
A["cl_n"], A["cl_unis"] = int(len(cl)), int(cl.uni_code.nunique())
cross = {}
for c in uni_vars:  # по одному, иначе мультиколлинеарность (вузы мало)
    res = smf.logit(f"quit ~ {CTRL} + {CORE} + {c}", cl).fit(
        disp=0, cov_type="cluster", cov_kwds={"groups": cl.uni_code.astype(int)})
    cross[c] = {"OR": float(np.exp(res.params[c])), "p": float(res.pvalues[c]),
                "lo": float(np.exp(res.conf_int().loc[c, 0])), "hi": float(np.exp(res.conf_int().loc[c, 1]))}
A["cross_level"] = cross
# Модерация: научная интенсивность вуза × поддержка руководителя
res = smf.logit(f"quit ~ {CTRL} + {CORE} + staff_defended * sup_sat", cl).fit(
    disp=0, cov_type="cluster", cov_kwds={"groups": cl.uni_code.astype(int)})
A["cross_inter"] = {"coef": float(res.params["staff_defended:sup_sat"]), "p": float(res.pvalues["staff_defended:sup_sat"])}

# ======================= 2. ML: бустинг =======================
X = pd.get_dummies(m.drop(columns=["quit", "uni", "uni_code"]), columns=["work", "field"], dtype=float)
y = m.quit.values
cv = StratifiedKFold(5, shuffle=True, random_state=1)
gb = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_leaf_nodes=15,
                                    l2_regularization=1.0, random_state=1)
p_gb = cross_val_predict(gb, X, y, cv=cv, method="predict_proba")[:, 1]
p_lr = cross_val_predict(LogisticRegression(max_iter=3000), (X - X.mean()) / X.std(), y, cv=cv,
                         method="predict_proba")[:, 1]
A["auc_gb"], A["auc_lr"] = float(roc_auc_score(y, p_gb)), float(roc_auc_score(y, p_lr))
gb.fit(X, y)
pi = permutation_importance(gb, X, y, scoring="roc_auc", n_repeats=10, random_state=1)
imp = pd.Series(pi.importances_mean, index=X.columns).sort_values(ascending=False)
A["gb_importance"] = imp.head(12).round(4).to_dict()
# Ранний скрининг: топ-20% по риску
thr = np.quantile(p_gb, 0.8)
A["screen_top20_capture"] = float(y[p_gb >= thr].sum() / y.sum())
A["screen_top20_rate"] = float(y[p_gb >= thr].mean())
pdp = {}
for c in ["phq", "belong", "sup_sat"]:
    r = partial_dependence(gb, X, [c], grid_resolution=25, kind="average", response_method="predict_proba", method="brute")
    pdp[c] = {"x": (r["grid_values"][0] * SD[c][1] + SD[c][0]).tolist(), "y": r["average"][0].tolist()}
A["pdp"] = pdp

# ======================= 3. Профили риска (GMM) =======================
F = ["sup_sat", "belong", "phq", "topic_int"]
Z = m[F].values
sil = {}
for k in range(3, 7):
    lab_k = KMeans(k, n_init=20, random_state=1).fit_predict(Z)
    sil[k] = float(silhouette_score(Z, lab_k, sample_size=3000, random_state=1))
A["kmeans_silhouette"] = sil
K = 4
m["prof"] = KMeans(K, n_init=50, random_state=1).fit_predict(Z)
prof = RAW.assign(prof=m.prof.values, ft_out=(m.work == "ПД вне вуза").astype(float).values).groupby("prof").agg(
    share=("quit", "size"), quit=("quit", "mean"), sup_sat=("sup_sat", "mean"), belong=("belong", "mean"),
    phq=("phq", "mean"), topic_int=("topic_int", "mean"), ft_out=("ft_out", "mean"))
prof["share"] = prof.share / prof.share.sum()
prof = prof.sort_values("quit")
# Имена по характеристикам (проверяются на выводе ниже)
NAMES = ["Вовлечённые", "Отстранённые", "Выгорающие", "Без опоры на руководителя"]
prof["name"] = NAMES
A["profiles"] = prof.round(3).reset_index().to_dict(orient="records")

# ======================= 4. Симуляция мер (g-computation) =======================
full = smf.logit(f"quit ~ {CTRL} + {CORE}", m).fit(disp=0)


def predict_raw(df_raw):
    t = df_raw.copy()
    for c in SD:
        t[c] = (t[c] - SD[c][0]) / SD[c][1]
    return full.predict(t).mean()


base_p = predict_raw(RAW)
q25, med = RAW.belong.quantile(0.25), RAW.belong.median()
scen = {
    "Встречи с руководителем ≥2 раз в месяц": RAW.assign(sup_rare=0.0),
    "Неудовлетворённые руководителем → «скорее удовлетворены»": RAW.assign(sup_sat=RAW.sup_sat.clip(lower=3)),
    "Принадлежность ниже медианы → медиана": RAW.assign(belong=np.where(RAW.belong < med, np.maximum(RAW.belong, med), RAW.belong)),
    "Психологическая помощь: −5 баллов PHQ-8 при PHQ ≥ 10": RAW.assign(phq=np.where(RAW.phq >= 10, RAW.phq - 5, RAW.phq)),
    "Все работающие полный день уходят с работы": RAW.assign(work=np.where(RAW.work == "ПД вне вуза", "Не работает", RAW.work), work_unrel=0.0),
}
scen["Комплекс: встречи + принадлежность + помощь"] = RAW.assign(
    sup_rare=0.0, belong=np.where(RAW.belong < med, med, RAW.belong),
    phq=np.where(RAW.phq >= 10, RAW.phq - 5, RAW.phq))
sim = {}
for k, df_s in scen.items():
    boots = []
    for _ in range(200):
        idx = rng.integers(0, len(m), len(m))
        b = smf.logit(f"quit ~ {CTRL} + {CORE}", m.iloc[idx]).fit(disp=0)
        def pr(t):
            t = t.iloc[idx].copy()
            for c in SD:
                t[c] = (t[c] - SD[c][0]) / SD[c][1]
            return b.predict(t).mean()
        boots.append(pr(df_s) - pr(RAW))
    sim[k] = {"p": float(predict_raw(df_s)), "delta": float(predict_raw(df_s) - base_p),
              "ci": [float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))]}
A["sim_base"] = float(base_p)
A["sim"] = sim

# ======================= 5. Устойчивость =======================
def evalue(or_):
    rr = np.sqrt(or_) if or_ >= 1 else 1 / np.sqrt(or_)  # частый исход: RR ≈ √OR
    return float(rr + np.sqrt(rr * (rr - 1)))


A["evalue"] = {k: evalue(float(np.exp(full.params[k]))) for k in ["phq", "belong", "sup_sat", "sup_rare"]}
A["evalue_ci"] = {}
for k in ["phq", "belong", "sup_sat", "sup_rare"]:
    lo, hi = np.exp(full.conf_int().loc[k])
    near = lo if np.exp(full.params[k]) > 1 else hi
    A["evalue_ci"][k] = evalue(float(near)) if (near - 1) * (np.exp(full.params[k]) - 1) > 0 else 1.0

# PSM: полный день вне вуза vs не работает/подработки
ps_df = m[m.work.isin(["ПД вне вуза", "Не работает", "Подработки"])].copy()
ps_df["T"] = (ps_df.work == "ПД вне вуза").astype(int)
cov = ("female + year + extramural + paid + children + married + honors + gap + moscow_spb"
       " + C(field) + goal_army + goal_degree + topic_int + no_pubs")
ps = smf.logit(f"T ~ {cov}", ps_df).fit(disp=0).predict(ps_df)
ps_df["lps"] = np.log(ps / (1 - ps))
tr, co = ps_df[ps_df["T"] == 1], ps_df[ps_df["T"] == 0]
cal = 0.2 * ps_df.lps.std()
nn = NearestNeighbors(n_neighbors=1).fit(co[["lps"]])
dist, ix = nn.kneighbors(tr[["lps"]])
keep = dist[:, 0] <= cal
att = tr.quit.values[keep] - co.quit.values[ix[keep, 0]]
bt = [rng.choice(att, len(att)).mean() for _ in range(1000)]
A["psm"] = {"att": float(att.mean()), "ci": [float(np.percentile(bt, 2.5)), float(np.percentile(bt, 97.5))],
            "n_matched": int(keep.sum())}

with open(os.path.join(OUT, "results_adv.json"), "w") as f:
    json.dump(A, f, ensure_ascii=False, indent=1, default=float)
print(json.dumps({k: v for k, v in A.items() if k not in ("pdp",)}, ensure_ascii=False, indent=1, default=float))

# ======================= ГРАФИКИ =======================
pct = lambda v: f"{v*100:.0f}%"

# 06. Вузы различаются (обезличенно)
fig, ax = plt.subplots(figsize=(10, 4.8))
x = np.arange(len(cat))
ax.vlines(x, cat.lo, cat.hi, color=GRAY, lw=2)
ax.scatter(x, cat.mid, color=[ORANGE if v > 0.3 else BLUE for v in cat.mid], s=40, zorder=3,
           edgecolor="white", linewidth=1)
ax.axhline(d.quit.mean(), color=INK2, lw=1, ls=(0, (3, 3)))
ax.set_xticks([])
ax.set_xlabel(f"{len(cat)} вузов с 30+ ответами (обезличено), по возрастанию")
ax.set_ylabel("Оценка доли «хочу бросить»")
ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1, decimals=0))
ax.set_ylim(0, max(0.6, cat.hi.max() + 0.02))
fig.savefig(os.path.join(FIG, "06_universities.png"))
plt.close(fig)

# 07. Нелинейность (PDP бустинга)
fig, axs = plt.subplots(1, 3, figsize=(15, 4.2), sharey=True)
ttl = {"phq": "Депрессивные симптомы PHQ-8", "belong": "Академическая принадлежность", "sup_sat": "Удовл. руководителем"}
for ax, c in zip(axs, ["phq", "belong", "sup_sat"]):
    ax.plot(pdp[c]["x"], pdp[c]["y"], color=ORANGE if c == "phq" else BLUE, lw=2.5)
    ax.set_title(ttl[c], loc="left", color=INK, fontsize=14, weight="bold")
    ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1, decimals=0))
axs[0].axvline(10, color=INK2, lw=1, ls=(0, (3, 3)))
axs[0].text(10.3, max(pdp["phq"]["y"]) * 0.97, "клинический\nпорог 10", color=INK2, fontsize=11, va="top")
axs[0].set_ylabel("Прогноз. вероятность")
fig.tight_layout()
fig.savefig(os.path.join(FIG, "07_pdp.png"))
plt.close(fig)

# 08. Профили риска (пузыри)
fig, ax = plt.subplots(figsize=(9, 5.2))
cols = [AQUA, BLUE, VIOLET, ORANGE]
for i, (k, r) in enumerate(prof.iterrows()):
    ax.scatter(r.belong, r.phq, s=max(r.share * 9000, 2200), color=cols[i], alpha=0.85, edgecolor="white", linewidth=2)
    ax.text(r.belong, r.phq, pct(r.quit), ha="center", va="center", color="white", fontsize=14, weight="bold")
    off = 0.07 + r.share * 0.25
    left = r.belong > 3.6
    ax.text(r.belong + (-off if left else off), r.phq, f"{r['name']}\n{pct(r.share)} аспирантов",
            ha="right" if left else "left", va="center", color=INK, fontsize=12)
ax.set_xlabel("Средняя академическая принадлежность (1–4)")
ax.set_ylabel("Средний балл PHQ-8")
ax.set_xlim(2.4, 4.1)
ax.set_ylim(0, 19)
fig.savefig(os.path.join(FIG, "08_profiles.png"))
plt.close(fig)
print(prof)
