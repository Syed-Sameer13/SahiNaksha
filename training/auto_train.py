"""One-command entry point for the SahiNaksha fast training workflow.

Preferred workflow: use manually reviewed masks and train the lightweight
building+road model. The old SAM/YOLO pseudo-label pipeline remains available
as `legacy_sam_train.py` in the repository history, but is not the default.

Example:
  python training/auto_train.py \
    --images training/dataset/images \
    --masks training/dataset/masks \
    --output backend/models/sahinaksha_pixel_model.joblib
"""
from __future__ import annotations

import argparse

from train_pixel_model import main as train_main


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train SahiNaksha building + road model")
    parser.add_argument("--images", required=True)
    parser.add_argument("--masks", required=True)
    parser.add_argument("--output", default="backend/models/sahinaksha_pixel_model.joblib")
    parser.add_argument("--samples-per-class", type=int, default=12000)
    parser.add_argument("--trees", type=int, default=40)
    parser.add_argument("--depth", type=int, default=12)
    args = parser.parse_args()

    # train_pixel_model.main reads argv; keep this wrapper intentionally tiny.
    import sys
    sys.argv = [sys.argv[0], "--images", args.images, "--masks", args.masks,
                "--output", args.output, "--samples-per-class", str(args.samples_per_class),
                "--trees", str(args.trees), "--depth", str(args.depth)]
    train_main()
