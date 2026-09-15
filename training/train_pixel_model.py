"""Train SahiNaksha's CPU-friendly building/road segmentation model.

Input:
  --images  folder of original RGB aerial images
  --masks   folder of grayscale masks with values 0=background, 1=building, 2=road

The model uses RandomForest over RGB/HSV/LAB/edge/vegetation/position features.
This is deliberately lightweight for the SIH prototype and can run on CPU.
For a production-grade model, replace it later with a larger aerial segmentation model.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import cv2
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report


def features(image: np.ndarray) -> np.ndarray:
    h, w = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32) / 255.0
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float32) / 255.0
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    blur = cv2.GaussianBlur(gray, (0, 0), 1.2)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, 3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, 3)
    edge = np.sqrt(gx * gx + gy * gy)
    exg = 2.0 * rgb[:, :, 1] - rgb[:, :, 0] - rgb[:, :, 2]
    yy, xx = np.mgrid[0:h, 0:w]
    xx = xx.astype(np.float32) / max(w - 1, 1)
    yy = yy.astype(np.float32) / max(h - 1, 1)
    return np.stack([
        rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2],
        hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2],
        lab[:, :, 0], lab[:, :, 1], lab[:, :, 2],
        gray, blur, edge, exg, xx, yy,
    ], axis=-1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--images', required=True)
    ap.add_argument('--masks', required=True)
    ap.add_argument('--output', default='backend/models/sahinaksha_pixel_model.joblib')
    ap.add_argument('--samples-per-class', type=int, default=12000)
    ap.add_argument('--trees', type=int, default=40)
    ap.add_argument('--depth', type=int, default=12)
    args = ap.parse_args()

    image_dir, mask_dir = Path(args.images), Path(args.masks)
    pairs = []
    for mask_path in sorted(mask_dir.glob('*.png')):
        stem = mask_path.stem.replace('_mask', '')
        matches = list(image_dir.glob(stem + '.*'))
        if matches:
            pairs.append((matches[0], mask_path))
    if len(pairs) < 3:
        raise SystemExit(f'Need at least 3 image/mask pairs; found {len(pairs)}')

    rng = np.random.default_rng(42)
    X, y = [], []
    for image_path, mask_path in pairs:
        image = cv2.imread(str(image_path))
        mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
        if image is None or mask is None or image.shape[:2] != mask.shape[:2]:
            raise SystemExit(f'Image/mask mismatch: {image_path.name}')
        f = features(image).reshape(-1, 15)
        labels = mask.reshape(-1)
        for cls in (0, 1, 2):
            ids = np.where(labels == cls)[0]
            if not len(ids):
                continue
            take = min(args.samples_per_class, len(ids))
            ids = rng.choice(ids, take, replace=False)
            X.append(f[ids]); y.append(np.full(take, cls, dtype=np.uint8))

    X = np.concatenate(X); y = np.concatenate(y)
    print(f'Training samples: {len(y):,} | classes={np.bincount(y).tolist()}')
    model = RandomForestClassifier(
        n_estimators=args.trees,
        max_depth=args.depth,
        min_samples_leaf=4,
        max_features='sqrt',
        class_weight='balanced_subsample',
        n_jobs=-1,
        random_state=42,
    )
    model.fit(X, y)

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({
        'model': model,
        'classes': ['background', 'building', 'road'],
        'feature_count': 15,
        'training_images': [p.name for p, _ in pairs],
    }, out, compress=3)
    print(f'Saved: {out.resolve()}')

    for image_path, mask_path in pairs:
        image = cv2.imread(str(image_path))
        mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
        pred = model.predict(features(image).reshape(-1, 15))
        print(f'\n{image_path.name}')
        print(classification_report(mask.reshape(-1), pred, labels=[0, 1, 2], target_names=['background', 'building', 'road'], zero_division=0, digits=3))


if __name__ == '__main__':
    main()
