import { useState } from "react";
import { MapContainer, ImageOverlay, GeoJSON } from "react-leaflet";
import { CRS } from "leaflet";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const BOUNDS = [[0, 0], [100, 100]];

export default function Dashboard({ result, onReset }) {
  const hasParcels = (result.parcels?.features?.length || 0) > 0;
  const [layers, setLayers] = useState({ parcels: hasParcels, buildings: true, roads: false });
  const [selected, setSelected] = useState(null);
  const [review, setReview] = useState({});

  const c = {
    parcels: result.parcels?.features?.length || 0,
    buildings: result.buildings?.features?.length || 0,
    roads: result.roads?.features?.length || 0,
    issues: result.validation?.issues?.length || 0,
  };

  const aiReady = result.ai_engine?.provider === "segment_anything";
  const selectedId = selected && (
    selected.properties.parcel_id ||
    selected.properties.building_id ||
    selected.properties.road_id ||
    selected.id
  );
  const status = selectedId ? review[selectedId] : null;

  const toggle = (key) => setLayers((current) => ({ ...current, [key]: !current[key] }));

  const mark = (decision) => {
    if (!selected || !selectedId) return;
    setReview((current) => ({ ...current, [selectedId]: decision }));
  };

  const exportFile = () => window.open(
    API + "/analysis/" + result.analysis_id + "/export",
    "_blank"
  );

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <div className="brand">Sahi<span>Naksha</span></div>
          <small>
            {aiReady
              ? "AI segmentation engine active"
              : "AI segmentation not configured — conservative CV fallback active"}
          </small>
        </div>
        <div className="actions">
          <button className="secondary-button" onClick={exportFile}>Export GeoJSON</button>
          <button className="secondary-button" onClick={onReset}>New Analysis</button>
        </div>
      </header>

      <section className="summary-grid">
        <div><b>{c.parcels}</b><span>Preliminary Parcels</span></div>
        <div><b>{c.buildings}</b><span>Building Footprints</span></div>
        <div><b>{c.roads}</b><span>Road / Access Evidence</span></div>
        <div><b>{c.issues}</b><span>Topology Issues</span></div>
      </section>

      <section className="cadastral-warning">
        <b>Pipeline:</b> {result.analysis_mode} ·{" "}
        <b>AI:</b> {result.ai_engine?.status || "not reported"} ·{" "}
        <b>Topology fixes:</b> {result.topology_stats?.repaired_geometries || 0} ·{" "}
        <b>Overlaps resolved:</b> {result.topology_stats?.overlap_conflicts_resolved || 0}
        {result.evaluation?.available && (
          <>
            {" "}· <b>Mean IoU:</b> {result.evaluation.mean_iou} ·{" "}
            <b>Recall:</b> {result.evaluation.recall_at_iou_0_10}
          </>
        )}
      </section>

      {!hasParcels && (
        <section className="cadastral-warning">
          <b>No reliable parcel polygons were produced for this image.</b>{" "}
          Configure the AI segmentation engine or provide an aligned parcel GIS layer.
        </section>
      )}

      <section className="workspace">
        <aside className="sidebar">
          <h3>GIS Layers</h3>
          {Object.keys(layers).map((key) => (
            <label key={key} className="toggle">
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={() => toggle(key)}
              />
              {key}
            </label>
          ))}

          <hr />
          <h3>Human Review</h3>
          {selected ? (
            <>
              <div className="details">
                {Object.entries(selected.properties || {}).map(([key, value]) => (
                  <div key={key}>
                    <span>{key.replaceAll("_", " ")}</span>
                    <b>{String(value)}</b>
                  </div>
                ))}
              </div>
              <div className="review-buttons">
                <button onClick={() => mark("Approved")}>Approve</button>
                <button onClick={() => mark("Needs Review")}>Review</button>
                <button onClick={() => mark("Rejected")}>Reject</button>
              </div>
              {status && (
                <p className={"review-status " + status.toLowerCase().replaceAll(" ", "-")}>
                  {status}
                </p>
              )}
            </>
          ) : (
            <p className="muted">
              Click a cadastral or feature polygon to inspect its properties and review it.
            </p>
          )}

          <hr />
          <h3>Topology Validation</h3>
          <p className="muted">
            {c.issues ? c.issues + " issue(s) require review." : "No parcel topology issues detected."}
          </p>
        </aside>

        <div className="map-wrap">
          <MapContainer
            crs={CRS.Simple}
            bounds={BOUNDS}
            boundsOptions={{ padding: [20, 20] }}
            minZoom={-2}
            maxZoom={4}
            zoom={0}
            style={{ height: "100%", width: "100%", background: "#111827" }}
          >
            {result.original_image_url && (
              <ImageOverlay url={result.original_image_url} bounds={BOUNDS} opacity={0.90} />
            )}
            {layers.parcels && (
              <GeoJSON
                data={result.parcels}
                style={{ color: "#22c55e", weight: 2.5, fillOpacity: 0.10 }}
                onEachFeature={(f, l) => l.on({ click: () => setSelected(f) })}
              />
            )}
            {layers.buildings && (
              <GeoJSON
                data={result.buildings}
                style={{ color: "#38bdf8", weight: 2, fillOpacity: 0.08 }}
                onEachFeature={(f, l) => l.on({ click: () => setSelected(f) })}
              />
            )}
            {layers.roads && (
              <GeoJSON
                data={result.roads}
                style={{ color: "#f59e0b", weight: 3, fillOpacity: 0.06 }}
                onEachFeature={(f, l) => l.on({ click: () => setSelected(f) })}
              />
            )}
          </MapContainer>
          <div className="map-note">
            Green: preliminary parcels. Blue: building footprints. Orange: road/access evidence.
            All AI-generated cadastral output requires survey review.
          </div>
        </div>
      </section>
    </main>
  );
}
