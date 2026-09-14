import json

def serialize_geojson(result):
    return {
        "type": "SahiNakshaAnalysis",
        "analysis_id": result.get("analysis_id"),
        "analysis_mode": result.get("analysis_mode"),
        "buildings": result.get("buildings"),
        "roads": result.get("roads"),
        "parcels": result.get("parcels"),
        "validation": result.get("validation"),
    }

def to_json_bytes(result):
    return json.dumps(serialize_geojson(result), indent=2).encode("utf-8")
