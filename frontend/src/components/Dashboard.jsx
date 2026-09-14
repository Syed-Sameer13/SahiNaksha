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
  const cadastralReady = result.cadastral_mode === "drone_refined_existing_gis";

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <div className="brand">Sahi<span>Naksha</span></div>
          <small>{cadastralReady ? "Preliminary cadastral map generated from GIS parcels + drone-edge evidence" : "Image-only feature evidence — upload a parcel GIS layer for cadastral map generation"}</small>
        </div>
        <div className="actions">
          <button className="secondary-button" onClick={exportFile}>Export GeoJSON</button>
          <button className="secondary-button" onClick={onReset}>New Analysis</button>
        </div>
      </header>

      <section className="summary-grid">
        <div><b>{c.parcels}</b><span>Preliminary Cadastral Parcels</span></div>
        <div><b>{c.buildings}</b><span>Building Evidence</span></div>
        <div><b>{c.roads}</b><span>Road Candidates</span></div>
        <div><b>{c.issues}</b><span>Topology Issues</span></div>
      </section>

      {!cadastralReady && (
        <section className="cadastral-warning">
          <b>No cadastral parcel layer was generated from this image alone.</b>
          Parcel boundaries are often not visible in RGB imagery. For the SIH26012 prototype workflow, upload an aligned existing parcel GeoJSON so SahiNaksha can refine boundaries using drone evidence, classify land use, and run topology validation.
        </section>
      )}

      <section className="workspace">
        <aside className="sidebar">
          <h3>GIS Layers</h3>
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
          ) : <p className="muted">Click a cadastral or feature polygon to inspect its GIS properties and review status.</p>}

          <hr />
          <h3>Topology Validation</h3>
          <p className="muted">{c.issues ? c.issues + " issue(s) require review." : "No parcel topology issues detected."}</p>
        </aside>

        <div className="map-wrap">
          <MapContainer crs={CRS.Simple} bounds={BOUNDS} boundsOptions={{ padding: [20, 20] }} minZoom={-2} maxZoom={4} zoom={0} style={{ height: "100%", width: "100%", background: "#111827" }}>
            {result.original_image_url && <ImageOverlay url={result.original_image_url} bounds={BOUNDS} opacity={0.90} />}
            {layers.parcels && <GeoJSON data={result.parcels} style={{ color: "#22c55e", weight: 2.5, fillOpacity: 0.10 }} onEachFeature={(f, l) => l.on({ click: () => setSelected(f) })} />}
            {layers.buildings && <GeoJSON data={result.buildings} style={{ color: "#38bdf8", weight: 2, fillOpacity: 0.08 }} onEachFeature={(f, l) => l.on({ click: () => setSelected(f) })} />}
            {layers.roads && <GeoJSON data={result.roads} style={{ color: "#f59e0b", weight: 3 }} onEachFeature={(f, l) => l.on({ click: () => setSelected(f) })} />}
          </MapContainer>
          <div className="map-note">{cadastralReady ? "Green polygons: topology-validated preliminary cadastral parcels. Blue: building evidence. Human verification remains required." : "Upload a reference parcel layer to produce the preliminary cadastral polygon layer."}</div>
        </div>
      </section>
    </main>
  );
}
