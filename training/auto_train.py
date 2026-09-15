"""
SahiNaksha: one-command building-footprint adaptation pipeline.

Goal: take 10-20 aerial images, create initial building masks automatically,
convert them to YOLO segmentation labels, augment/split the dataset, and
fine-tune a small pretrained segmentation model.

Usage:
  python training/auto_train.py --images ./training/raw_images --epochs 45

For better labels, set SAHINAKSHA_SAM_CHECKPOINT to a local SAM checkpoint.
If SAM is unavailable, the script uses a conservative OpenCV roof proposal
as a fallback. Pseudo-labels should be visually reviewed before serious use.
"""
from __future__ import annotations

import argparse
import os
import random
import shutil
from pathlib import Path

import cv2
import numpy as np

SEED = 42
random.seed(SEED)


def load_sam():
    checkpoint = os.getenv("SAHINAKSHA_SAM_CHECKPOINT", "")
    model_type = os.getenv("SAHINAKSHA_SAM_MODEL_TYPE", "vit_b")
    if not checkpoint or not Path(checkpoint).exists():
        return None
    try:
        from segment_anything import SamAutomaticMaskGenerator, sam_model_registry
        model = sam_model_registry[model_type](checkpoint=checkpoint)
        return SamAutomaticMaskGenerator(
            model=model,
            points_per_side=24,
            pred_iou_thresh=0.86,
            stability_score_thresh=0.90,
            box_nms_thresh=0.55,
            crop_n_layers=1,
            min_mask_region_area=150,
        )
    except Exception as exc:
        print(f"[WARN] SAM unavailable: {exc}")
        return None


def vegetation_mask(image):
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    b, g, r = cv2.split(image.astype(np.float32))
    exg = 2 * g - r - b
    hue = cv2.inRange(hsv, np.array([28, 30, 15]), np.array([100, 255, 255]))
    return cv2.bitwise_and(hue, (exg > 5).astype(np.uint8) * 255)


def geometry_ok(contour, image_area):
    area = cv2.contourArea(contour)
    if area < max(180, image_area * 0.00018) or area > image_area * 0.20:
        return False
    x, y, w, h = cv2.boundingRect(contour)
    aspect = max(w, h) / max(1, min(w, h))
    hull = cv2.convexHull(contour)
    solidity = area / max(cv2.contourArea(hull), 1.0)
    rectangularity = area / max(w * h, 1.0)
    return aspect < 5.5 and solidity > 0.52 and rectangularity > 0.28


def sam_masks(generator, image):
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    vegetation = vegetation_mask(image)
    result = []
    for item in generator.generate(rgb):
        mask = item["segmentation"].astype(np.uint8)
        area = int(mask.sum())
        image_area = image.shape[0] * image.shape[1]
        if area < max(180, image_area * 0.00018) or area > image_area * 0.18:
            continue
        m = mask * 255
        veg = cv2.countNonZero(cv2.bitwise_and(m, vegetation)) / max(area, 1)
        if veg > 0.35:
            continue
        contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        contour = max(contours, key=cv2.contourArea)
        if geometry_ok(contour, image_area):
            clean = np.zeros_like(mask)
            cv2.drawContours(clean, [contour], -1, 1, -1)
            result.append(clean)
    return dedupe_masks(result)


def cv_masks(image):
    """Fallback roof proposal generator when SAM is not installed."""
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l = cv2.createCLAHE(2.0, (8, 8)).apply(lab[:, :, 0])
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    vegetation = vegetation_mask(image)
    roof = cv2.inRange(l, 105, 255)
    roof = cv2.bitwise_and(roof, (hsv[:, :, 1] < 155).astype(np.uint8) * 255)
    roof[vegetation > 0] = 0
    roof = cv2.morphologyEx(roof, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    roof = cv2.morphologyEx(roof, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8), iterations=2)
    contours, _ = cv2.findContours(roof, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    masks = []
    for c in contours:
        if not geometry_ok(c, image.shape[0] * image.shape[1]):
            continue
        m = np.zeros(roof.shape, np.uint8)
        cv2.drawContours(m, [c], -1, 1, -1)
        masks.append(m)
    return dedupe_masks(masks)


def dedupe_masks(masks):
    kept = []
    for mask in sorted(masks, key=lambda m: int(m.sum()), reverse=True):
        duplicate = False
        for old in kept:
            inter = np.logical_and(mask, old).sum()
            union = np.logical_or(mask, old).sum()
            if inter / max(union, 1) > 0.55:
                duplicate = True
                break
        if not duplicate:
            kept.append(mask)
    return kept[:80]


def mask_to_yolo(mask):
    contours, _ = cv2.findContours((mask * 255).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    h, w = mask.shape
    rows = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < 40:
            continue
        eps = max(1.0, 0.006 * cv2.arcLength(contour, True))
        poly = cv2.approxPolyDP(contour, eps, True).reshape(-1, 2)
        if len(poly) < 3:
            continue
        values = []
        for x, y in poly:
            values.extend([x / w, y / h])
        rows.append("0 " + " ".join(f"{v:.6f}" for v in values))
    return rows


def save_augmented(image, masks, out_images, out_labels, stem, index):
    variants = [(image, masks, "")]
    variants.append((cv2.flip(image, 1), [np.fliplr(m) for m in masks], "_flip"))
    variants.append((cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE), [np.rot90(m, -1) for m in masks], "_r90"))
    for img, ms, suffix in variants:
        name = f"{stem}{suffix}"
        cv2.imwrite(str(out_images / f"{name}.jpg"), img, [cv2.IMWRITE_JPEG_QUALITY, 94])
        rows = []
        for m in ms:
            rows.extend(mask_to_yolo(m))
        (out_labels / f"{name}.txt").write_text("\n".join(rows) + ("\n" if rows else ""), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", required=True, help="Folder containing 10-20 aerial images")
    parser.add_argument("--out", default="training/workspace")
    parser.add_argument("--epochs", type=int, default=45)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--model", default="yolo26n-seg.pt")
    args = parser.parse_args()

    source = Path(args.images)
    root = Path(args.out)
    if root.exists():
        shutil.rmtree(root)
    for split in ("train", "val"):
        (root / "images" / split).mkdir(parents=True, exist_ok=True)
        (root / "labels" / split).mkdir(parents=True, exist_ok=True)

    files = [p for p in source.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"}]
    if len(files) < 10:
        raise SystemExit(f"Need at least 10 images; found {len(files)}")
    if len(files) > 20:
        print(f"[INFO] Using first 20 of {len(files)} images")
        files = files[:20]
    random.shuffle(files)
    val_count = max(2, round(len(files) * 0.2))
    val_sources = set(files[:val_count])

    sam = load_sam()
    print(f"[INFO] Images: {len(files)} | validation source images: {val_count} | labeler: {'SAM' if sam else 'OpenCV fallback'}")

    generated = 0
    for idx, path in enumerate(files):
        image = cv2.imread(str(path))
        if image is None:
            print(f"[WARN] Skipping unreadable {path}")
            continue
        masks = sam_masks(sam, image) if sam else cv_masks(image)
        if not masks:
            print(f"[WARN] No building proposals: {path.name}")
            continue
        split = "val" if path in val_sources else "train"
        save_augmented(image, masks, root / "images" / split, root / "labels" / split, path.stem, idx)
        generated += 1
        print(f"[{idx+1}/{len(files)}] {path.name}: {len(masks)} building masks -> {split}")

    if generated < 6:
        raise SystemExit("Too few usable images after auto-labeling. Add clearer aerial images or configure SAM.")

    yaml = root / "dataset.yaml"
    yaml.write_text(
        f"path: {root.resolve().as_posix()}\n"
        "train: images/train\n"
        "val: images/val\n"
        "names:\n  0: building\n",
        encoding="utf-8",
    )

    try:
        from ultralytics import YOLO
    except ImportError:
        raise SystemExit("Install training dependencies first: pip install -r training/requirements.txt")

    device = 0 if __import__("torch").cuda.is_available() else "cpu"
    workers = 2 if device != "cpu" else 0
    batch = 8 if device != "cpu" else 2
    print(f"[INFO] Training {args.model} | device={device} | epochs={args.epochs} | imgsz={args.imgsz}")
    model = YOLO(args.model)
    model.train(
        data=str(yaml),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=batch,
        device=device,
        workers=workers,
        patience=12,
        cache=False,
        amp=device != "cpu",
        degrees=20,
        translate=0.08,
        scale=0.35,
        fliplr=0.5,
        flipud=0.5,
        mosaic=0.6,
        mixup=0.05,
        project=str(root / "runs"),
        name="building_adaptation",
        exist_ok=True,
    )
    best = root / "runs" / "building_adaptation" / "weights" / "best.pt"
    final = root / "sahinaksha_building.pt"
    if best.exists():
        shutil.copy2(best, final)
        print(f"\n[DONE] Trained model: {final.resolve()}")
        print("Set SAHINAKSHA_MODEL_PATH to this file to use it in SahiNaksha.")
    else:
        print("[WARN] Training finished but best.pt was not found; inspect the run directory.")


if __name__ == "__main__":
    main()
