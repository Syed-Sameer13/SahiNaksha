# Trained model artifact

The runtime expects the trained lightweight segmentation artifact at:

```text
backend/models/sahinaksha_pixel_model.joblib
```

For repository size/safety, the binary artifact is distributed separately in the SIH training package. Copy it into this directory before deployment, or set:

```text
SAHINAKSHA_PIXEL_MODEL_PATH=/absolute/path/to/sahinaksha_pixel_model.joblib
```

Classes:

```text
0 background
1 building
2 road
```

The model is a rapid SIH prototype trained on three supplied aerial scenes. It extracts physical feature evidence and must not be used as an authoritative legal cadastral boundary generator.
