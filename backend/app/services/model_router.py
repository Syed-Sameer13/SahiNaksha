"""Select the best available SahiNaksha vision model at runtime."""
from .trained_segmentation import run_trained_segmentation
from .ai_segmentation import run_ai_segmentation as run_sam_segmentation


def run_ai_segmentation(image_path: str):
    """Prefer the trained building+road model, then SAM, then OpenCV fallback."""
    trained_result, trained_info = run_trained_segmentation(image_path)
    if trained_result is not None:
        return trained_result, trained_info

    sam_result, sam_info = run_sam_segmentation(image_path)
    if sam_result is not None:
        sam_info = {**sam_info, "fallback_after_trained_model": trained_info["status"]}
        return sam_result, sam_info

    return None, {
        "provider": "none",
        "status": "trained model and SAM unavailable",
        "trained_model": trained_info["status"],
        "sam": sam_info["status"],
    }
