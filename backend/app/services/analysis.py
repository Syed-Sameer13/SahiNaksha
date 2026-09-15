from .opencv_analysis import extract_features
from .model_router import run_ai_segmentation
from .validation import validate_parcels
from .topology_engine import repair_and_validate_parcels
from .metrics import evaluate_against_ground_truth
from .cadastral_engine import (
    load_reference_parcels,
    classify_parcel_landuse,
    classify_parcel_height,
)


def analyze_image(
    image_path: str,
    reference_parcels_path: str | None = None,
    ground_truth_path: str | None = None,
    dsm_path: str | None = None,
):
    ai_result, ai_info = run_ai_segmentation(image_path)

    if ai_result is not None:
        result = ai_result
        provider = ai_info.get("provider", "ai")
        extraction_mode = "trained_segmentation" if provider == "sahinaksha_trained_pixel_model" else "ai_segmentation"
    else:
        result = extract_features(image_path)
        extraction_mode = "opencv_fallback"

    if reference_parcels_path:
        parcels = load_reference_parcels(reference_parcels_path, image_path)
        result["parcels"] = parcels
        result["cadastral_mode"] = "drone_refined_existing_gis"
    else:
        # Never infer authoritative ownership parcels from RGB imagery alone.
        result["cadastral_mode"] = "feature_evidence_only" if ai_result is None else "preliminary_feature_extraction"

    result["parcels"], topology_stats = repair_and_validate_parcels(result["parcels"])
    result["parcels"] = classify_parcel_landuse(result["parcels"], image_path)

    if dsm_path:
        result["parcels"] = classify_parcel_height(result["parcels"], dsm_path)

    result["validation"] = validate_parcels(result["parcels"])
    result["analysis_mode"] = extraction_mode
    result["ai_engine"] = ai_info
    result["topology_stats"] = topology_stats

    if ground_truth_path:
        result["evaluation"] = evaluate_against_ground_truth(result["parcels"], ground_truth_path)
    else:
        result["evaluation"] = {"available": False}

    return result
