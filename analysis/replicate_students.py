"""Репликация на третьем массиве: лонгитюд студентов селективных вузов (волны 3 и 4).

Проверяем, повторяется ли паттерн аспирантов у бакалавров:
сам факт работы vs переживание конфликта учёбы и работы vs удовлетворённость обучением.
Запуск: LONG_SAV=... python3 analysis/replicate_students.py
"""
import json
import os
import warnings

import numpy as np
import pandas as pd
import pyreadstat
import statsmodels.formula.api as smf

warnings.filterwarnings("ignore")
SAV = os.environ.get("LONG_SAV", "data/long/data.sav")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output")

df, meta = pyreadstat.read_sav(SAV)
num = lambda s: pd.to_numeric(s.astype(str).str.strip().replace("", np.nan), errors="coerce")
W = {}

# Волна 4 (2025/26): самые полные данные о работе
d4 = pd.DataFrame({
    "quit": num(df.dropout1_4w).map({1: 0, 2: 1, 3: 1}),
    "work": num(df.work1_4w).map({1: "Полный день", 2: "Неполный день", 3: "Подработки", 4: "Не работает"}),
    "conflict": num(df.intern5_4w_3).where(lambda s: s < 99),        # «трудно совмещать»
    "grades_hurt": num(df.intern5_4w_2).where(lambda s: s < 99),     # «страдает успеваемость»
    "helps": num(df.intern5_4w_1).where(lambda s: s < 99),           # «работа помогает учиться»
    "match": num(df.Work_major_4w).where(lambda s: s < 5),           # соответствие специальности
    "sat": num(df.satisfaction_4w).where(lambda s: s < 5),
    "female": (num(df.sex) == 2).astype(float).where(num(df.sex).notna()),
    "paid": (num(df.funding) == 2).astype(float).where(num(df.funding).notna()),
    "major": num(df.bigmajor),
})
d4 = d4[d4.quit.notna() & d4.work.notna()]
W["n_w4"] = int(len(d4))
W["drop_share_w4"] = float(d4.quit.mean())
W["by_work_w4"] = d4.groupby("work").quit.agg(["mean", "count"]).round(4).to_dict(orient="index")

# Логит: тип работы vs удовлетворённость
m1 = smf.logit("quit ~ C(work, Treatment('Не работает')) + sat + female + paid + C(major)", d4.dropna(subset=["sat", "female", "paid", "major"])).fit(disp=0)
W["logit_work_p"] = {k: float(v) for k, v in m1.pvalues.items() if k.startswith("C(work")}
W["logit_work_or"] = {k: float(np.exp(v)) for k, v in m1.params.items() if k.startswith("C(work")}
W["logit_sat_or"] = float(np.exp(m1.params["sat"]))

# Среди работающих: переживание конфликта и связь работы со специальностью
wk = d4[d4.work != "Не работает"].dropna(subset=["conflict"])
W["n_workers"] = int(len(wk))
wk["conflict_hi"] = (wk.conflict >= 3).astype(float)
W["workers_conflict_share"] = float(wk.conflict_hi.mean())
W["drop_by_conflict"] = wk.groupby("conflict_hi").quit.mean().round(4).to_dict()
m2 = smf.logit("quit ~ conflict + C(work) + female + paid", wk.dropna(subset=["female", "paid"])).fit(disp=0)
W["conflict_or"] = float(np.exp(m2.params["conflict"]))
W["conflict_p"] = float(m2.pvalues["conflict"])
mm = wk.dropna(subset=["match"])
mm["match_hi"] = (mm.match >= 3).astype(float)
W["drop_by_match"] = mm.groupby("match_hi").quit.mean().round(4).to_dict()
W["conflict_by_match"] = mm.groupby("match_hi").conflict_hi.mean().round(4).to_dict()

# Панель: те, кто прошёл обе волны. Изменение статуса работы и мысли об уходе
w3 = num(df.wave3) == 1
w4 = num(df.wave4) == 1
p = pd.DataFrame({
    "work3": num(df.work1).map({1: 1, 2: 1, 3: 1, 4: 0}),
    "work4": num(df.work1_4w).map({1: 1, 2: 1, 3: 1, 4: 0}),
    "drop3": num(df.dropout1_3w).map({1: 0, 2: 1, 3: 1}),
    "drop4": num(df.dropout1_4w).map({1: 0, 2: 1, 3: 1}),
})[w3 & w4].dropna()
W["n_panel"] = int(len(p))
if len(p) > 50:
    p["start_work"] = ((p.work3 == 0) & (p.work4 == 1)).astype(float)
    base = p[p.work3 == 0]
    W["panel_new_workers"] = int(base.start_work.sum())
    m3 = smf.logit("drop4 ~ start_work + drop3", base).fit(disp=0)
    W["panel_start_work_or"] = float(np.exp(m3.params["start_work"]))
    W["panel_start_work_p"] = float(m3.pvalues["start_work"])

with open(os.path.join(OUT, "results_students.json"), "w") as f:
    json.dump(W, f, ensure_ascii=False, indent=1, default=float)
print(json.dumps(W, ensure_ascii=False, indent=1, default=float))
