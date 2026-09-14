import { useState } from "react";
import { MapContainer, ImageOverlay, GeoJSON } from "react-leaflet";
import { CRS } from "leaflet";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const BOUNDS = [[0, 0], [100, 100]];

export default function Dashboard({ result, onReset }) {
  const [layers, setLayers] = useState({ parcels: true, buildings: true, roads: true });
  const [selected, setSelected] = useState(null);
  const [review, setReview] = useState({});

  const c = {
    parcels: result.parcels?.features?.length || 0,
    buildings: result.buildings?.features?.length || 0,
    roads: result.roads?.features?.length || 0,
    issues: result.validation?.issues?.length || 0
  };

  const toggle = (key) => setLayers((current) => ({ ...current, [key]: !current[key] }));

  const mark = (status) => {
    if (!selected) return;
    const id = selected.properties.parcel_id || selected.properties.building_id || selected.properties.road_id || selected.id;
    setReview((current) => ({ ...current, [id]: status }));
  };

  const exportFile = () => window.open(API + "/analysis/" + result.analysis_id + "/export", "_blank");
  const selectedId = selected && (selected.properties.parcel_id || selected.properties.building_id || selected.properties.road_id || selected.id);
  const status = selectedId ? review[selectedId] : null;

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <div className="brand">Sahi<span>Naksha</span></div>
          <small>{result.analysis_mode === "opencv" ? "AI feature extraction completed" : "Demo fallback used — verify results"}</small>
        </div>
        <div className="actions">
          <button className="secondary-button" onClick={exportFile}>Export GeoJSON</button>
          <button className="secondary-button" onClick={onReset}>New Analysis</button>
        </div>
      </header>

      <section className="summary-grid">
        <div><b>{c.parcels}</b><span>Parcel Candidates</span></div>
        <div><b>{c.buildings}</b><span>Buildings</span></div>
        <div><b>{c.roads}</b><span>Road Features</span></div>
        <div><b>{c.issues}</b><span>Validation Issues</span></div>
      </section>

      <section className="workspace">
        <aside className="sidebar">
          <h3>Layers</h3>
          {Object.keys(layers).map((key) => (
            <label key={key} className="toggle">
              <input type="checkbox" checked={layers[key]} onChange={() => toggle(key)} />
              {key}
            </label>
          ))}

          <hr />
          <h3>Human Review</h3>
          {selected ? (
            <>
              <div className="details">
                {Object.entries(selected.properties || {}).map(([key, value]) => (
                  <div key={key}><span>{key.replaceAll("_", " ")}</span><b>{String(value)}</b></div>
                ))}
              </div>
              <div className="review-buttons">
                <button onClick={() => mark("Approved")}>Approve</button>
                <button onClick={() => mark("Needs Review")}>Review</button>
                <button onClick={() => mark("Rejected")}>Reject</button>
              </div>
              {status && <p className={"review-status " + status.toLowerCase().replaceAll(" ", "-")}>{status}</p>}
            </>
          ) : <p className="muted">Click a feature, inspect it, then record a review decision.</p>}

          <hr />
          <h3>Validation</h3>
          <p className="muted">{c.issues ? c.issues + " issue(s) require review." : "No geometry issues detected."}</p>
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
            {result.original_image_url && <ImageOverlay url={result.original_image_url} bounds={BOUNDS} opacity={0.8} />}
            {layers.parcels && <GeoJSON data={result.parcels} style={{ color: "#34d399", weight: 2, fillOpacity: 0.18 }} onEachFeature={(f, l) => l.on({ click: () => setSelected(f) })} />}
            {layers.buildings && <GeoJSON data={result.buildings} style={{ color: "#60a5fa", weight: 2, fillOpacity: 0.35 }} onEachFeature={(f, l) => l.on({ click: () => setSelected(f) })} />}
            {layers.roads && <GeoJSON data={result.roads} style={{ color: "#f59e0b", weight: 5 }} onEachFeature={(f, l) => l.on({ click: () => setSelected(f) })} />}
          </MapContainer>
          <div className="map-note">AI-generated candidates require human verification.</div>
        </div>
      </section>
    </main>
  );
}
