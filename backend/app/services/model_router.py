"""Select the best available SahiNaksha vision model at runtime."""
from .hotosm_building_segmentation import run_hotosm_building_segmentation
from .yolo_segmentation import run_yolo_segmentation
from .trained_segmentation import run_trained_segmentation
from .ai_segmentation import run_ai_segmentation as run_sam_segmentation


def run_ai_segmentation(image_path: str):
    """Prefer building-specific HOTOSM model, then custom YOLO, pixel model, and SAM."""
    hotosm_result, hotosm_info = run_hotosm_building_segmentation(image_path)
    if hotosm_result is not None:
        return hotosm_result, hotosm_info

    yolo_result, yolo_info = run_yolo_segmentation(image_path)
    if yolo_result is not None:
        yolo_info = {**yolo_info, "fallback_after_hotosm": hotosm_info["status"]}
        return yolo_result, yolo_info

    trained_result, trained_info = run_trained_segmentation(image_path)
    if trained_result is not None:
        trained_info = {
            **trained_info,
            "fallback_after_hotosm": hotosm_info["status"],
            "fallback_after_yolo": yolo_info["status"],
        }
        return trained_result, trained_info

    sam_result, sam_info = run_sam_segmentation(image_path)
    if sam_result is not None:
        sam_info = {
            **sam_info,
            "fallback_after_hotosm": hotosm_info["status"],
            "fallback_after_yolo": yolo_info["status"],
            "fallback_after_trained_model": trained_info["status"],
        }
        return sam_result, sam_info

    return None, {
        "provider": "none",
        "status": "HOTOSM building model, custom YOLO, trained model and SAM unavailable",
        "hotosm": hotosm_info["status"],
        "yolo": yolo_info["status"],
        "trained_model": trained_info["status"],
        "sam": sam_info["status"],
    }
