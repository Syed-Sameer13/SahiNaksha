from .opencv_analysis import extract_features
from .validation import validate_parcels
from .cadastral_engine import load_reference_parcels, classify_parcel_landuse


def analyze_image(image_path: str, reference_parcels_path: str | None = None):
    result = extract_features(image_path)

    if reference_parcels_path:
        parcels = load_reference_parcels(reference_parcels_path, image_path)
        parcels = classify_parcel_landuse(parcels, image_path)
        result["parcels"] = parcels
        result["analysis_mode"] = "reference_guided_cadastral"
        result["cadastral_mode"] = "drone_refined_existing_gis"
    else:
        # Image-only mode intentionally does not invent legal parcel boundaries.
        # The user can still inspect extracted feature evidence, but no cadastral parcel map is claimed.
        result["analysis_mode"] = "image_only_feature_extraction"
        result["cadastral_mode"] = "no_reference_layer"

    result["validation"] = validate_parcels(result["parcels"])
    return result
