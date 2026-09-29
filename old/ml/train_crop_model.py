"""Train and evaluate a CatBoost model on the project's historical crop maps.

The target is the dominant mapped crop for a contour and year. This predicts
historical crop choice; it is not a yield or profitability model.
"""

from __future__ import annotations

import argparse
import json
import math
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from catboost import CatBoostClassifier, Pool, __version__ as CATBOOST_VERSION
from sklearn.metrics import accuracy_score, f1_score

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ARTIFACTS = Path(__file__).resolve().parent / "artifacts"
CAT_FEATURES = [
    "land_use",
    "irrigation",
    "soil_mechanics",
    "salinity_class",
    "soil_age_class",
    "humus_class",
    "phosphorus_class",
    "potassium_class",
    "soil_data_quality",
    "previous_crop",
]
VALUE_COLUMNS = ["area", "bonitet", "humus", "phosphorus", "potassium", "elevation", "slope"]
CLIMATE_SCALARS = [
    "fah",
    "gdd10",
    "frost_free_days",
    "late_spring_frost_years",
    "hot_days",
    "winter_min_c",
    "climate_dT",
]
MONTHLY_CLIMATE = [
    *(f"temperature_{m:02d}" for m in range(1, 13)),
    *(f"rain_{m:02d}" for m in range(1, 13)),
    *(f"et0_{m:02d}" for m in range(1, 13)),
]
NUMERIC_FEATURES = [
    *VALUE_COLUMNS,
    "aspect_sin",
    "aspect_cos",
    *CLIMATE_SCALARS,
    "annual_rain",
    "annual_et0",
    "annual_water_deficit",
    *MONTHLY_CLIMATE,
    "previous_crop_share",
]
FEATURES = [*CAT_FEATURES, *NUMERIC_FEATURES]


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def safe_number(value: Any) -> float:
    if value is None:
        return math.nan
    try:
        number = float(value)
    except (TypeError, ValueError):
        return math.nan
    return number if math.isfinite(number) and number >= 0 else math.nan


def finite_number(value: Any) -> float:
    if value is None:
        return math.nan
    try:
        number = float(value)
    except (TypeError, ValueError):
        return math.nan
    return number if math.isfinite(number) else math.nan


def category(value: Any) -> str:
    return "noma'lum" if value is None or value == "" else str(value)


def make_climate_lookup(climate: dict[str, Any]) -> dict[int, dict[str, Any]]:
    contour = climate.get("kontur", {})
    ids = contour.get("id", [])
    zone_ids = contour.get("zona", [])
    dts = contour.get("dT", [])
    lookup: dict[int, dict[str, Any]] = {}

    for j, contour_id in enumerate(ids):
        if j >= len(zone_ids) or zone_ids[j] < 0 or zone_ids[j] >= len(climate.get("zona", [])):
            continue
        zone = climate["zona"][zone_ids[j]]
        dt = float(dts[j]) if j < len(dts) else 0.0
        monthly: dict[str, list[float]] = {}
        for source, prefix, offset in (("harorat", "temperature", dt), ("yogin", "rain", 0.0), ("et0", "et0", 0.0)):
            values = zone.get(source, [])
            month_means = []
            for month in range(12):
                samples = [float(year[month]) for year in values if len(year) > month and year[month] is not None]
                month_means.append((sum(samples) / len(samples) + offset) if samples else math.nan)
            monthly[prefix] = month_means

        def mean(key: str) -> float:
            vals = [float(v) for v in zone.get(key, []) if v is not None]
            return sum(vals) / len(vals) if vals else math.nan

        rain = monthly["rain"]
        et0 = monthly["et0"]
        lookup[int(contour_id)] = {
            "fah": safe_number(contour.get("fah", [None] * len(ids))[j]),
            "gdd10": safe_number(contour.get("gdd10", [None] * len(ids))[j]),
            "frost_free_days": safe_number(contour.get("sovuqsiz", [None] * len(ids))[j]),
            "late_spring_frost_years": safe_number(contour.get("kechSovuqYil", [None] * len(ids))[j]),
            "hot_days": safe_number(contour.get("issiqKun", [None] * len(ids))[j]),
            "winter_min_c": finite_number(contour.get("minT", [None] * len(ids))[j]),
            "climate_dT": finite_number(dt),
            **{f"temperature_{m + 1:02d}": v for m, v in enumerate(monthly["temperature"])},
            **{f"rain_{m + 1:02d}": v for m, v in enumerate(rain)},
            **{f"et0_{m + 1:02d}": v for m, v in enumerate(et0)},
            "annual_rain": sum(rain) if all(math.isfinite(v) for v in rain) else math.nan,
            "annual_et0": sum(et0) if all(math.isfinite(v) for v in et0) else math.nan,
            "annual_water_deficit": sum(et0) - sum(rain) if all(math.isfinite(v) for v in [*et0, *rain]) else math.nan,
            "soil_temperature_mean": mean("tuproqT"),
            "soil_moisture_mean": mean("namlik"),
        }
    return lookup


def crop_at(pack: dict[str, Any], row_index: int, year: int, min_share: int) -> tuple[str, int] | None:
    values = pack["col"].get(f"ekin{year % 100}") or []
    if row_index >= len(values) or not values[row_index]:
        return None
    crop_index, share = max(values[row_index], key=lambda pair: pair[1])
    if share < min_share:
        return None
    labels = pack["lug"].get("ekin", [])
    if crop_index >= len(labels):
        return None
    label = str(labels[crop_index]).strip()
    if not label or label.lower().startswith("noma'lum"):
        return None
    return label, int(share)


def make_feature_row(
    pack: dict[str, Any], climate_by_id: dict[int, dict[str, Any]], row_index: int,
    previous_crop: tuple[str, int] | None,
) -> dict[str, Any]:
    col = pack["col"]
    lug = pack["lug"]

    def raw(key: str) -> Any:
        values = col.get(key, [])
        return values[row_index] if row_index < len(values) else None

    def decoded(key: str, dictionary: str) -> str | None:
        ix = raw(key)
        labels = lug.get(dictionary, [])
        if ix is None or ix < 0 or ix >= len(labels):
            return None
        return str(labels[ix])

    def code(key: str) -> str | None:
        value = raw(key)
        return str(value) if value is not None and value >= 0 else None

    aspect = safe_number(raw("yonalish"))
    row: dict[str, Any] = {
        "land_use": category(decoded("foyd", "foyd")),
        "irrigation": category(code("sug")),
        "soil_mechanics": category(code("mex")),
        "salinity_class": category(code("shor")),
        "soil_age_class": category(decoded("yos", "grad")),
        "humus_class": category(decoded("gumusg", "grad")),
        "phosphorus_class": category(decoded("fosforg", "grad")),
        "potassium_class": category(decoded("kaliyg", "grad")),
        "soil_data_quality": category(code("sifat")),
        "area": safe_number(raw("maydon")),
        "bonitet": safe_number(raw("bonitet")),
        "humus": safe_number(raw("gumus")),
        "phosphorus": safe_number(raw("fosfor")),
        "potassium": safe_number(raw("kaliy")),
        "elevation": safe_number(raw("balandlik")),
        "slope": safe_number(raw("qiyalik")),
        "aspect_sin": math.sin(math.radians(aspect)) if math.isfinite(aspect) else math.nan,
        "aspect_cos": math.cos(math.radians(aspect)) if math.isfinite(aspect) else math.nan,
        "previous_crop": category(previous_crop[0] if previous_crop else None),
        "previous_crop_share": (previous_crop[1] / 100.0) if previous_crop else math.nan,
    }
    row.update(climate_by_id.get(int(raw("id")), {}))
    row.setdefault("soil_temperature_mean", math.nan)
    row.setdefault("soil_moisture_mean", math.nan)
    return row


def build_rows(pack: dict[str, Any], climate_by_id: dict[int, dict[str, Any]], min_share: int):
    years = [2022, 2023, 2024, 2025, 2026]
    rows: list[dict[str, Any]] = []
    targets: list[str] = []
    weights: list[float] = []
    sample_years: list[int] = []
    excluded = Counter()

    for year in years:
        for row_index in range(pack["n"]):
            target = crop_at(pack, row_index, year, min_share)
            if target is None:
                excluded[year] += 1
                continue
            previous = crop_at(pack, row_index, year - 1, min_share) if year > years[0] else None
            rows.append(make_feature_row(pack, climate_by_id, row_index, previous))
            targets.append(target[0])
            weights.append(target[1] / 100.0)
            sample_years.append(year)
    return pd.DataFrame(rows, columns=FEATURES), np.asarray(targets), np.asarray(weights), np.asarray(sample_years), excluded


def make_model(iterations: int, seed: int = 42) -> CatBoostClassifier:
    return CatBoostClassifier(
        iterations=iterations,
        depth=5,
        learning_rate=0.05,
        loss_function="MultiClass",
        l2_leaf_reg=5.0,
        random_seed=seed,
        thread_count=8,
        allow_writing_files=False,
        verbose=False,
    )


def score_holdout(x_train, y_train, w_train, x_test, y_test, test_year: int, iterations: int, min_class_samples: int):
    if len(set(y_train)) < 2 or len(y_test) == 0:
        return {"year": test_year, "status": "skipped", "reason": "yetarli sinf yoki test yozuvi yo'q"}
    counts = Counter(y_train)
    keep = np.asarray([counts[label] >= min_class_samples for label in y_train])
    x_train = x_train.loc[keep]
    y_train = y_train[keep]
    w_train = w_train[keep]
    if len(set(y_train)) < 2:
        return {"year": test_year, "status": "skipped", "reason": "kamida ikki yetarli sinf qolmadi"}
    model = make_model(iterations)
    train_pool = Pool(x_train, label=y_train, cat_features=CAT_FEATURES, weight=w_train)
    model.fit(train_pool)
    probabilities = model.predict_proba(x_test)
    classes = list(model.classes_)
    known = np.asarray([label in classes for label in y_test])
    if not known.any():
        return {"year": test_year, "status": "skipped", "reason": "test sinflari train ma'lumotida yo'q"}
    y_known = y_test[known]
    p_known = probabilities[known]
    predicted = np.asarray(classes)[np.argmax(p_known, axis=1)]
    top_k = min(3, len(classes))
    top3_ix = np.argsort(p_known, axis=1)[:, -top_k:]
    top3 = np.asarray(classes)[top3_ix]
    labels = sorted(set(y_train))
    train_counts = Counter(y_train)
    majority_order = [label for label, _ in train_counts.most_common(top_k)]
    return {
        "year": int(test_year),
        "status": "evaluated",
        "train_rows": int(len(y_train)),
        "test_rows": int(len(y_test)),
        "train_rows_after_rare_class_filter": int(len(y_train)),
        "known_class_test_rows": int(known.sum()),
        "known_class_coverage": round(float(known.mean()), 4),
        "top1_accuracy_known_classes": round(float(accuracy_score(y_known, predicted)), 4),
        "top3_accuracy_known_classes": round(float(np.mean([actual in options for actual, options in zip(y_known, top3)])), 4),
        "majority_baseline_top1_known_classes": round(float(np.mean(y_known == majority_order[0])), 4),
        "majority_baseline_top3_known_classes": round(float(np.mean([actual in majority_order for actual in y_known])), 4),
        "macro_f1_known_classes": round(float(f1_score(y_known, predicted, labels=labels, average="macro", zero_division=0)), 4),
        "weighted_f1_known_classes": round(float(f1_score(y_known, predicted, average="weighted", zero_division=0)), 4),
    }


def save_shap_summary(model: CatBoostClassifier, x: pd.DataFrame, output: Path, sample_size: int = 256) -> None:
    sample = x.sample(n=min(sample_size, len(x)), random_state=42)
    pool = Pool(sample, cat_features=CAT_FEATURES)
    shap_values = np.asarray(model.get_feature_importance(pool, type="ShapValues"))
    if shap_values.ndim == 3:
        # CatBoost multiclass SHAP layout: object × class × (feature + bias).
        if shap_values.shape[0] == len(sample):
            values = shap_values[..., :-1]
        else:
            values = np.moveaxis(shap_values, 1, 0)[..., :-1]
        importance = np.abs(values).mean(axis=(0, 1))
    elif shap_values.ndim == 2:
        importance = np.abs(shap_values[:, :-1]).mean(axis=0)
    else:
        raise ValueError(f"SHAP natijasi kutilmagan shaklda: {shap_values.shape}")
    pd.DataFrame({"feature": x.columns, "mean_abs_shap": importance}).sort_values(
        "mean_abs_shap", ascending=False
    ).to_csv(output, index=False, encoding="utf-8-sig")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--district", choices=("bulungur", "fargona"), default="bulungur")
    parser.add_argument("--min-share", type=int, default=20, help="Dominant crop minimum area share, percent")
    parser.add_argument("--iterations", type=int, default=180)
    parser.add_argument("--min-class-samples", type=int, default=50)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_ARTIFACTS)
    args = parser.parse_args()

    data_dir = ROOT / "public" / "data" / args.district
    pack = load_json(data_dir / "attrs.json")
    climate = load_json(data_dir / "iqlim.json")
    climate_by_id = make_climate_lookup(climate)
    x, y, weights, years, excluded = build_rows(pack, climate_by_id, args.min_share)
    if len(y) < 100 or len(set(y)) < 2:
        raise SystemExit(f"O'qitish uchun yozuv yetarli emas: {len(y)} ta yozuv, {len(set(y))} sinf")

    output = args.output_dir / args.district
    output.mkdir(parents=True, exist_ok=True)
    evaluations = []
    for year in sorted(set(years)):
        if year < 2025:
            continue
        train_mask = years < year
        test_mask = years == year
        print(f"Vaqtli tekshiruv: {year}-yil ({int(train_mask.sum())} train, {int(test_mask.sum())} test)", flush=True)
        evaluation = score_holdout(
            x.loc[train_mask], y[train_mask], weights[train_mask], x.loc[test_mask], y[test_mask],
            year, args.iterations, args.min_class_samples,
        )
        evaluations.append(evaluation)
        print(json.dumps(evaluation, ensure_ascii=False), flush=True)

    all_class_counts = Counter(y)
    keep = np.asarray([all_class_counts[label] >= args.min_class_samples for label in y])
    train_x, train_y, train_weights = x.loc[keep], y[keep], weights[keep]
    if len(set(train_y)) < 2:
        raise SystemExit("Kam sinflar filtrlangandan keyin o'qitish uchun ikki sinf ham qolmadi")
    print(f"Yakuniy model: {len(train_y)} yozuv, {len(set(train_y))} sinf", flush=True)
    model = make_model(args.iterations)
    model.fit(Pool(train_x, label=train_y, cat_features=CAT_FEATURES, weight=train_weights))
    model.save_model(str(output / "catboost_crop_history.cbm"))

    importance = pd.DataFrame({"feature": FEATURES, "importance": model.feature_importances_}).sort_values(
        "importance", ascending=False
    )
    importance.to_csv(output / "feature_importance.csv", index=False, encoding="utf-8-sig")
    save_shap_summary(model, x, output / "shap_importance.csv")

    latest_year = int(max(years))
    prediction_rows = [
        make_feature_row(pack, climate_by_id, i, crop_at(pack, i, latest_year, args.min_share))
        for i in range(pack["n"])
    ]
    prediction_x = pd.DataFrame(prediction_rows, columns=FEATURES)
    probabilities = model.predict_proba(prediction_x)
    classes = list(model.classes_)
    top_k = min(3, len(classes))
    prediction_data = []
    for i, row_probabilities in enumerate(probabilities):
        top_indices = np.argsort(row_probabilities)[-top_k:][::-1]
        land_use = str(pack["lug"]["foyd"][pack["col"]["foyd"][i]])
        eligible = land_use in {"haydalma", "lalmi", "bosh"}
        prediction_data.append({
            "contour_id": int(pack["col"]["id"][i]),
            "prediction_year": latest_year + 1,
            "top_crops": [
                {"crop_class": classes[j], "probability": round(float(row_probabilities[j]), 4)}
                for j in top_indices
            ] if eligible else [],
            "eligible": eligible,
        })
    predictions = {
        "model": "CatBoostClassifier / MultiClass",
        "district": args.district,
        "target": "historical dominant mapped crop class",
        "prediction_year": latest_year + 1,
        "training_years": sorted(int(v) for v in set(years)),
        "minimum_crop_share_percent": args.min_share,
        "warning": "Bu tarixiy ekin tanloviga o'xshashlik bashorati; hosildorlik yoki foyda prognozi emas.",
        "contours": prediction_data,
    }
    (output / f"predictions_{latest_year + 1}.json").write_text(
        json.dumps(predictions, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )

    summary = {
        "model": "CatBoostClassifier",
        "model_version": CATBOOST_VERSION,
        "objective": "MultiClass",
        "model_parameters": {"iterations": args.iterations, "depth": 5, "learning_rate": 0.05, "random_seed": 42},
        "district": args.district,
        "target": "har bir kontur-yil juftligidagi eng katta ulushli ekin sinfi",
        "training_years": sorted(int(v) for v in set(years)),
        "training_rows": int(len(train_y)),
        "usable_rows_before_rare_class_filter": int(len(y)),
        "contours": int(pack["n"]),
        "classes": len(set(train_y)),
        "minimum_class_samples": args.min_class_samples,
        "class_counts": dict(sorted(Counter(train_y).items(), key=lambda item: item[0])),
        "excluded_rare_class_counts": dict(sorted(
            ((label, count) for label, count in all_class_counts.items() if count < args.min_class_samples),
            key=lambda item: item[0],
        )),
        "excluded_rows_by_year": {str(k): int(v) for k, v in excluded.items()},
        "minimum_crop_share_percent": args.min_share,
        "feature_count": len(FEATURES),
        "categorical_features": CAT_FEATURES,
        "evaluation": "yil bo'yicha oldinga siljitilgan holdout; har test yili faqat undan oldingi yillar bilan o'qitildi",
        "temporal_evaluation": evaluations,
        "prediction_file": f"predictions_{latest_year + 1}.json",
        "generated_at_utc": datetime.now(UTC).isoformat(),
        "limitations": [
            "Nishon hosildorlik yoki daromad emas, xaritada qayd etilgan tarixiy asosiy ekin turidir.",
            "Qamrovi va sinflar soni tuman hamda yil bo'yicha farq qiladi; kam uchragan ekinlarning natijasi beqaror bo'lishi mumkin.",
            "Ehtimollar kalibrlanmagan; top-3 ro'yxat agronomik tasdiq o'rnini bosmaydi.",
        ],
    }
    (output / "metrics.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"artifact_dir": str(output), "rows": len(train_y), "classes": len(set(train_y)), "evaluation": evaluations}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
