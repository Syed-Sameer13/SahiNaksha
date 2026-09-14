import json
from shapely.geometry import shape


def _features(path):
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    return data.get("features", []) if data.get("type") == "FeatureCollection" else [data]


def evaluate_against_ground_truth(predicted, ground_truth_path):
    truth = [shape(f["geometry"]) for f in _features(ground_truth_path) if f.get("geometry")]
    pred = [shape(f["geometry"]) for f in predicted.get("features", []) if f.get("geometry")]
    if not truth or not pred:
        return {"available": False}

    matches = []
    used = set()
    for p in pred:
        best_iou = 0.0
        best = None
        for i, t in enumerate(truth):
            if i in used:
                continue
            union = p.union(t).area
            iou = p.intersection(t).area / union if union else 0.0
            if iou > best_iou:
                best_iou, best = iou, i
        if best is not None and best_iou >= 0.10:
            used.add(best)
            matches.append(best_iou)

    precision = len(matches) / max(1, len(pred))
    recall = len(matches) / max(1, len(truth))
    return {
        "available": True,
        "predicted_count": len(pred),
        "ground_truth_count": len(truth),
        "matched_count": len(matches),
        "mean_iou": round(sum(matches) / max(1, len(matches)), 3),
        "precision_at_iou_0_10": round(precision, 3),
        "recall_at_iou_0_10": round(recall, 3),
    }
