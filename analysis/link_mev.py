"""Связка опроса аспирантов с Мониторингом эффективности вузов (МЭВ).

Опрос проведён весной 2021, поэтому берём МЭВ-2022 (данные за 2021 год), головные вузы.
Сопоставление по названию: нормализация + нечёткое сравнение токенов.
Запуск: ASP_SAV=... MEV_XLSX=... python3 analysis/link_mev.py
"""
import os
import re
import math
from collections import Counter

import pandas as pd
import pyreadstat

SAV = os.environ.get("ASP_SAV", "data/asp/data.sav")
MEV = os.environ.get("MEV_XLSX", "data/mon/MEV.xlsx")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output")

STOP = {"федеральное", "государственное", "бюджетное", "автономное", "образовательное", "учреждение",
        "высшего", "образования", "фгбоу", "фгаоу", "во", "рф", "российской", "федерации",
        "министерства", "здравоохранения", "имени", "им", "и"}

# Индикаторы МЭВ уровня вуза (короткое имя -> префикс столбца)
IND = {
    "phd_per100": "1.13_",          # аспиранты и др. на 100 студентов
    "ege": "1.1_",                  # средний балл ЕГЭ (бюджет)
    "young_staff": "2.10_",         # доля молодых НПР
    "staff_defended": "2.11_",      # доля НПР, защитивших диссертации за год
    "grants_per100": "2.13_",       # гранты на 100 НПР
    "rinc_cit_per100": "2.1_Колич",  # цитирования РИНЦ на 100 НПР
    "rd_share": "2.5_Удельный",     # доля доходов от НИОКР
    "income_per_student": "4.3_Доходы",
    "salary_ratio": "4.3_2015_2024",
}


def norm(s):
    s = str(s).lower().replace("ё", "е")
    # убираем организационно-правовую форму: всё до слова «образования»
    if "образования" in s:
        s = s.split("образования", 1)[1]
    s = re.split(r"министерства|при правительстве|в г\.", s)[0]
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"[^а-яa-z0-9 ]", " ", s)
    words = s.split()
    for stop_at in ("имени", "им"):
        if stop_at in words:
            words = words[:words.index(stop_at)]
    return [t[:5] for t in words if t not in STOP]  # грубая основа слова


# Ручные исправления для вузов, переименованных к 2022 году или с неоднозначным названием
MANUAL = {
    "Высшая школа экономики": "Высшая школа экономики",
    "Национальный минерально-сырьевой университет Горный": "Санкт-Петербургский горный университет",
    "Мордовский государственный университет им. Н.П. Огарёва": "Национальный исследовательский Мордовский государственный",
    "Государственный университет Дубна": "Университет \"Дубна\"",
    "Омская государственная медицинская академия": "Омский государственный медицинский университет",
    "Воронежская государственная медицинская академия имени Н.Н. Бурденко": "Воронежский государственный медицинский университет",
    "Байкальский государственный университет экономики и права": "«Байкальский государственный университет»",
    "Орловский государственный университет": "Орловский государственный университет имени И.С.Тургенева",
    "Иркутская государственная сельскохозяйственная академия": "Иркутский государственный аграрный университет",
    "Орловский государственный аграрный Университет": "Орловский государственный аграрный университет",
    "Санкт-Петербургский национальный исследовательский университет информационных технологий, механики и оптики (ИТМО)": "университет ИТМО",
}


def build():
    df, meta = pyreadstat.read_sav(SAV, usecols=["QVuz"])
    lab = meta.variable_value_labels["QVuz"]
    mev = pd.read_excel(MEV)
    h = mev[(mev.year == 2022) & (mev.id_parent.isna())].copy()
    h["key"] = h["Наименование_образовательной_организации_table1"].map(norm)
    dfreq = Counter(t for k in h.key for t in set(k))
    idf = lambda t: math.log(len(h) / (1 + dfreq.get(t, 0))) + 1
    cols = {}
    for k, pref in IND.items():
        cols[k] = [c for c in mev.columns if c.startswith(pref)][0]
    keys = h.key.tolist()
    names = h["Наименование_образовательной_организации_table1"].astype(str).tolist()

    rows = []
    for code, n in df.QVuz.value_counts().items():
        if code == 9999:
            continue
        name = lab.get(code, "")
        # филиал «X (филиал) - Головной вуз»: берём головной вуз
        base = name.split(" - ", 1)[1] if " - " in name else name
        k = set(norm(base))
        best, score = None, 0
        manual = next((v for kk_, v in MANUAL.items() if name.startswith(kk_)), None)
        if manual:
            hit = [i for i, nm in enumerate(names) if manual.lower() in nm.lower()]
            best, score = (hit[0], 1.0) if hit else (None, 0)
            if not hit:
                print("manual miss:", name)
        else:
            for i, kk in enumerate(keys):
                kk = set(kk)
                # recall по редким словам названия из опроса + штраф за лишние слова
                rec = sum(idf(t) for t in k & kk) / max(sum(idf(t) for t in k), 1e-9)
                prec = sum(idf(t) for t in k & kk) / max(sum(idf(t) for t in kk), 1e-9)
                sc = rec * 0.8 + prec * 0.2
                if sc > score:
                    best, score = i, sc
        if best is None:
            continue
        rows.append({"QVuz": code, "survey_name": name, "n": int(n), "score": score,
                     "mev_name": h.iloc[best]["Наименование_образовательной_организации_table1"],
                     **{c: h.iloc[best][cols[c]] for c in IND}})
    link = pd.DataFrame(rows)
    return link


if __name__ == "__main__":
    link = build()
    link.to_csv(os.path.join(OUT, "_link_debug.csv"), index=False)  # gitignored ниже
    ok = link[link.score >= 0.95]
    print("вузов:", len(link), "сопоставлено:", len(ok), "респондентов:", ok.n.sum(), "из", link.n.sum())
    print(link.sort_values("score")[["score", "survey_name", "mev_name"]].head(40).to_string())
