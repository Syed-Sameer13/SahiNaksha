# Limitations and Future Scope

## Current limitations
1. AI outputs are preliminary.
2. Invisible legal parcel boundaries cannot be reliably inferred from pixels alone.
3. Small prototype datasets do not establish nationwide accuracy.
4. Synthetic/reference parcel data is not an official land record.
5. CORS/GNSS integration may remain an architectural integration point unless a live service is connected.
6. Large-area inference may require tiling, queues and GPU workers.
7. Different cities, sensors, seasons and image resolutions can change performance.

## Future scope
- Indian urban training dataset
- multi-temporal change detection
- DSM/DTM fusion
- GNSS/CORS integration
- authoritative cadastral database connectors
- audit trails
- offline field survey app
- advanced parcel-boundary models
- calibrated uncertainty estimation
- large-scale asynchronous GPU processing
