from .mock_analysis import generate_demo_result


def analyze_image(image_path: str):
    # Initial vertical slice: deterministic GIS-shaped output.
    # CV modules will replace these demo features without changing the API contract.
    return generate_demo_result()
