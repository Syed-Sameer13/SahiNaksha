def feature_collection(features):
    return {"type": "FeatureCollection", "features": features}


def polygon_feature(feature_id, coordinates, properties=None):
    props = {"id": feature_id, **(properties or {})}
    return {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [coordinates]}, "properties": props}


def line_feature(feature_id, coordinates, properties=None):
    props = {"id": feature_id, **(properties or {})}
    return {"type": "Feature", "geometry": {"type": "LineString", "coordinates": coordinates}, "properties": props}
