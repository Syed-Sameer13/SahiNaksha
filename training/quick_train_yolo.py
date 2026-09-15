"""Fast custom segmentation training for the SahiNaksha prototype.

Dataset layout:
  training/dataset/images/train/*.jpg
  training/dataset/images/val/*.jpg
  training/dataset/labels/train/*.txt
  training/dataset/labels/val/*.txt

YOLO segmentation label format per line:
  class_id x1 y1 x2 y2 ...
Coordinates are normalized to 0..1 and polygons are closed implicitly.

For the SIH demo use a SMALL, visually consistent dataset of 10-20 images.
Do not split near-duplicate crops across train/val; reserve whole images for val.
"""
from __future__ import annotations

import argparse
from pathlib import Path


def write_data_yaml(root: Path, names: list[str]) -> Path:
    p = root / "sahinaksha.yaml"
    p.write_text(
        "path: " + root.resolve().as_posix() + "\n"
        "train: images/train\n"
        "val: images/val\n"
        "names:\n"
        + "\n".join(f"  {i}: {name}" for i, name in enumerate(names))
        + "\n",
        encoding="utf-8",
    )
    return p


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="training/dataset")
    ap.add_argument("--model", default="yolo26n-seg.pt")
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--imgsz", type=int, default=768)
    ap.add_argument("--batch", type=int, default=4)
    ap.add_argument("--device", default="0", help="0 for NVIDIA GPU, cpu for CPU")
    ap.add_argument("--name", default="sahinaksha_proto")
    args = ap.parse_args()

    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise SystemExit("Install training dependencies first: pip install -r training/requirements-yolo.txt") from exc

    root = Path(args.dataset)
    required = [root / "images/train", root / "images/val", root / "labels/train", root / "labels/val"]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        raise SystemExit("Missing dataset directories:\n" + "\n".join(missing))

    yaml_path = write_data_yaml(root, ["building", "road"])
    model = YOLO(args.model)
    model.train(
        data=str(yaml_path),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        project="backend/models/yolo_runs",
        name=args.name,
        pretrained=True,
        patience=15,
        cos_lr=True,
        degrees=5,
        translate=0.05,
        scale=0.20,
        fliplr=0.5,
        mosaic=0.5,
        workers=2,
        cache=False,
        plots=True,
    )
    print("Training finished. Copy the best.pt path printed by Ultralytics into backend/models/sahinaksha_seg.pt")


if __name__ == "__main__":
    main()
