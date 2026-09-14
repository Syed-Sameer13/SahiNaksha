from .mock_analysis import generate_demo_result
from .opencv_analysis import extract_features
from .validation import validate_parcels

def analyze_image(image_path: str):
    try:
        result = extract_features(image_path)
        result["validation"] = validate_parcels(result["parcels"])
        result["analysis_mode"] = "opencv"
        if result["buildings"]["features"] or result["roads"]["features"]:
            return result
    except Exception:
        pass
    result = generate_demo_result()
    result["analysis_mode"] = "demo_fallback"
    return result
