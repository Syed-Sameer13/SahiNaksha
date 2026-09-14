from .geojson_service import feature_collection, polygon_feature, line_feature


def generate_demo_result():
    buildings = feature_collection([
        polygon_feature("B-001", [[18,18],[34,18],[34,32],[18,32],[18,18]], {"building_id":"B-001","area":224,"extraction_method":"demo"})
    ])
    roads = feature_collection([
        line_feature("R-001", [[0,50],[100,50]], {"road_id":"R-001","extraction_method":"demo"})
    ])
    parcels = feature_collection([
        polygon_feature("P-001", [[8,8],[48,8],[48,44],[8,44],[8,8]], {"parcel_id":"P-001","area":1440,"quality_score":95,"status":"Preliminary","review_required":False}),
        polygon_feature("P-002", [[52,8],[92,8],[92,44],[52,44],[52,8]], {"parcel_id":"P-002","area":1440,"quality_score":91,"status":"Preliminary","review_required":False}),
        polygon_feature("P-003", [[8,56],[92,56],[92,92],[8,92],[8,56]], {"parcel_id":"P-003","area":3024,"quality_score":82,"status":"Needs Review","review_required":True}),
    ])
    validation = {"valid_count":3,"invalid_count":0,"overlap_count":0,"noise_count":0,"issues":[]}
    return {"buildings":buildings,"roads":roads,"parcels":parcels,"validation":validation}
