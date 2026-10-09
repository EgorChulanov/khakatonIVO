"""Подготовка переменных: Всероссийский опрос аспирантов (2021).

Сырые данные в репозиторий не кладутся (условия использования хакатона).
Путь к .sav передаётся через переменную окружения ASP_SAV.
"""
import os

import numpy as np
import pandas as pd
import pyreadstat

SAV = os.environ.get("ASP_SAV", "data/asp/data.sav")

FIELDS = {
    1: "Естеств. науки", 2: "Инженерия", 3: "Медицина", 4: "Социальные",
    5: "Педагогика", 6: "Гуманитарные", 7: "Сельхоз", 8: "Другое",
}


def clean(s, bad=(99,)):
    return s.where(~s.isin(bad))


def load():
    df, meta = pyreadstat.read_sav(SAV)
    d = pd.DataFrame(index=df.index)

    # Зависимая: Q13_r3 «Я часто хочу бросить обучение в аспирантуре» (1–4)
    d["drop_ord"] = clean(df.Q13_r3)
    d["quit"] = (d.drop_ord >= 3).astype(float).where(d.drop_ord.notna())

    # Научный руководитель
    d["sup_sat"] = clean(df.Q11)                       # 1–4
    d.loc[df.Q6 == 2, "sup_sat"] = 1                   # нет руководителя = минимум
    d["sup_rare"] = df.Q50.isin([4, 5, 7]).astype(float)  # раз в месяц и реже
    d.loc[df.Q6 == 2, "sup_rare"] = 1

    # Академическая среда / принадлежность: среднее Qatm_r1..r6
    atm = df[[f"Qatm_r{i}" for i in range(1, 7)]].apply(clean)
    d["belong"] = atm.mean(axis=1).where(atm.notna().sum(axis=1) >= 4)
    d["topic_int"] = clean(df.Q12_r3)                  # интерес к теме 1–4

    # Психологическое благополучие: PHQ-8 (0–24)
    phq = df[[f"Q19_r{i}" for i in range(1, 9)]] - 1
    d["phq"] = phq.sum(axis=1, min_count=8)
    d["phq_mod"] = (d.phq >= 10).astype(float).where(d.phq.notna())

    # Занятость (иерархия от самой «тяжёлой»)
    w = df[[f"Q20_{i}" for i in range(2, 9)]].fillna(0)
    work = np.select(
        [w.Q20_3 == 1, w.Q20_2 == 1, (w.Q20_4 == 1) | (w.Q20_5 == 1),
         (w.Q20_6 == 1) | (w.Q20_7 == 1)],
        ["ПД вне вуза", "ПД в своём вузе", "Неполный день", "Подработки"],
        default="Не работает",
    )
    d["work"] = pd.Series(work, index=df.index).where(df.Q20_2.notna())
    d["work_rel"] = clean(df.Q23)                      # связь внешней работы с диссертацией 1–7
    d["work_unrel"] = ((d.work == "ПД вне вуза") & (d.work_rel <= 3)).astype(float)

    # Контроли
    d["female"] = (df.Qdem1 == 2).astype(float)
    d["year"] = df.QPre2.where(df.QPre2 <= 5)
    d["extramural"] = (df.QPre3 >= 2).astype(float).where(df.QPre3.notna())
    d["paid"] = (df.QPre4 == 2).astype(float)
    d["children"] = (df.Qdem4 == 2).astype(float)
    d["married"] = (df.Qdem30 == 1).astype(float)
    d["honors"] = (df.Qdem5 == 2).astype(float).where(df.Qdem5.notna())
    d["gap"] = (df.QPre5_1 == 0).astype(float)
    d["goal_army"] = df.Q14_6
    d["goal_degree"] = df.Q14_1
    d["no_pubs"] = df.Qpubl_1
    d["field"] = df.field.map(FIELDS)
    d["moscow_spb"] = df.QRegion.isin([1, 2]).astype(float)
    d["uni"] = df.QVuz

    # Трудности (Q16): серьёзная трудность = 3
    for i, name in [(2, "dif_sup"), (3, "dif_interest"), (5, "dif_pub"),
                    (6, "dif_fund"), (7, "dif_work"), (8, "dif_health"),
                    (9, "dif_skills"), (11, "dif_time")]:
        v = clean(df[f"Q16_r{i}"])
        d[name] = (v == 3).astype(float).where(v.notna())

    return d, df, meta


def cronbach(items):
    items = items.dropna()
    k = items.shape[1]
    return k / (k - 1) * (1 - items.var(ddof=1).sum() / items.sum(axis=1).var(ddof=1))
