"""Компактная модель для интерактивного калькулятора риска.

Сохраняет только коэффициенты (без микроданных) в output/calculator_model.json.
Запуск: ASP_SAV=... python3 analysis/calculator_model.py
"""
import json
import os

import numpy as np
import statsmodels.formula.api as smf
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold

from prep import load

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output")
d, _, _ = load()
d["ft_out"] = (d.work == "ПД вне вуза").astype(float).where(d.work.notna())
F = "sup_sat + sup_rare + belong + phq + topic_int + ft_out + goal_degree + year"
cols = ["quit", "sup_sat", "sup_rare", "belong", "phq", "topic_int", "ft_out", "goal_degree", "year"]
m = d[cols].dropna()
fit = smf.logit(f"quit ~ {F}", m).fit(disp=0)

aucs = []
for tr, te in StratifiedKFold(5, shuffle=True, random_state=3).split(m, m.quit):
    f = smf.logit(f"quit ~ {F}", m.iloc[tr]).fit(disp=0)
    aucs.append(roc_auc_score(m.quit.iloc[te], f.predict(m.iloc[te])))

out = {
    "coef": {k: float(v) for k, v in fit.params.items()},
    "n": int(len(m)),
    "cv_auc": float(np.mean(aucs)),
    "base_rate": float(m.quit.mean()),
    "medians": {c: float(m[c].median()) for c in cols[1:]},
}
with open(os.path.join(OUT, "calculator_model.json"), "w") as fh:
    json.dump(out, fh, ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False, indent=1))
