import { useMemo, useState } from "react";
import { GeoJSON, MapContainer } from "react-leaflet";
import { CRS } from "leaflet";

const EMPTY = { type: "FeatureCollection", features: [] };
const BOUNDS = [[0, 0], [100, 100]];

function featureCount(data) {
  return data?.features?.length || 0;
}

function formatMetric(value) {
  if (value === undefined || value === null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) && n <= 1 ? `${(n * 100).toFixed(1)}%` : String(value);
}

function pretty(value) {
  if (value === undefined || value === null || value === "") return "—";
  return String(value).replaceAll("_", " ");
}

const card = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 20,
  boxShadow: "0 2px 8px rgba(15,23,42,.04)",
};

const button = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  borderRadius: 9,
  padding: "9px 14px",
  cursor: "pointer",
  fontWeight: 600,
};

function Metric({ label, value, note }) {
  return (
    <div style={card}>
      <div style={{ color: "#64748b", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, marginTop: 5 }}>{value}</div>
      {note && <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 3 }}>{note}</div>}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid #edf0f4", fontSize: 13 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <strong style={{ textAlign: "right", textTransform: "capitalize" }}>{value}</strong>
    </div>
  );
}

function layerStyle(type) {
  if (type === "buildings") return { weight: 2, fillOpacity: 0.35 };
  if (type === "roads") return { weight: 3, opacity: 0.9 };
  return { weight: 2, fillOpacity: 0.12 };
}

export default function Dashboard({ result, onReset }) {
  const [visible, setVisible] = useState({ buildings: true, roads: true, parcels: true });

  const buildings = result?.buildings || EMPTY;
  const roads = result?.roads || EMPTY;
  const parcels = result?.parcels || EMPTY;
  const ai = result?.ai_engine || result?.ai_info || {};
  const evaluation = result?.evaluation || {};

  const counts = useMemo(() => ({
    buildings: featureCount(buildings),
    roads: featureCount(roads),
    parcels: featureCount(parcels),
  }), [buildings, roads, parcels]);

  const total = counts.buildings + counts.roads + counts.parcels;
  const provider = ai.provider || ai.model || ai.engine || "AI segmentation pipeline";
  const status = ai.status || "ready";
  const parcelMode = ai.parcel_mode || result?.cadastral_mode || "Preliminary parcel blocks";
  const hasEvaluation = evaluation.available === true;

  return (
    <main style={{ minHeight: "100vh", background: "#f6f8fb", color: "#172033", padding: 24 }}>
      <div style={{ maxWidth: 1250, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>Sahi<span style={{ color: "#2563eb" }}>Naksha</span></div>
            <div style={{ color: "#64748b", marginTop: 4 }}>AI cadastral extraction dashboard</div>
          </div>
          <button onClick={onReset} style={button}>New Analysis</button>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14, marginBottom: 16 }}>
          <Metric label="Buildings" value={counts.buildings} note="AI-detected footprints" />
          <Metric label="Roads" value={counts.roads} note="Detected road evidence" />
          <Metric label="Parcel blocks" value={counts.parcels} note="Preliminary boundaries" />
          <Metric label="Total features" value={total} note="Returned by analysis" />
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1.65fr) minmax(300px,.85fr)", gap: 16 }}>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#64748b" }}>AI OUTPUT</div>
                <h2 style={{ margin: "4px 0 0", fontSize: 19 }}>Detected map features</h2>
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {Object.keys(visible).map((key) => (
                  <button
                    key={key}
                    onClick={() => setVisible((v) => ({ ...v, [key]: !v[key] }))}
                    style={{ ...button, padding: "6px 10px", fontSize: 12, opacity: visible[key] ? 1 : .45 }}
                  >
                    {key[0].toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: 510, borderRadius: 12, overflow: "hidden", border: "1px solid #dbe2ea" }}>
              <MapContainer crs={CRS.Simple} bounds={BOUNDS} style={{ height: "100%", width: "100%", background: "#eef2f7" }} scrollWheelZoom>
                {visible.parcels && <GeoJSON data={parcels} style={() => layerStyle("parcels")} />}
                {visible.buildings && <GeoJSON data={buildings} style={() => layerStyle("buildings")} />}
                {visible.roads && <GeoJSON data={roads} style={() => layerStyle("roads")} />}
              </MapContainer>
            </div>
          </div>

          <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#64748b" }}>MODEL</div>
              <h2 style={{ margin: "4px 0 8px", fontSize: 19 }}>AI processing</h2>
              <Info label="Provider" value={pretty(provider)} />
              <Info label="Status" value={pretty(status)} />
              <Info label="Analysis ID" value={pretty(result?.analysis_id)} />
            </div>

            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#64748b" }}>OUTPUT SUMMARY</div>
              <h2 style={{ margin: "4px 0 8px", fontSize: 19 }}>What the AI produced</h2>
              <Info label="Building footprints" value={`${counts.buildings} detected`} />
              <Info label="Road evidence" value={`${counts.roads} detected`} />
              <Info label="Parcel blocks" value={`${counts.parcels} generated`} />
              <Info label="Parcel mode" value={pretty(parcelMode)} />
            </div>

            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#64748b" }}>VALIDATION</div>
              <h2 style={{ margin: "4px 0 8px", fontSize: 19 }}>Model evaluation</h2>
              {hasEvaluation ? (
                <>
                  <Info label="Precision" value={formatMetric(evaluation.precision)} />
                  <Info label="Recall" value={formatMetric(evaluation.recall)} />
                  <Info label="IoU / F1" value={formatMetric(evaluation.iou ?? evaluation.f1)} />
                </>
              ) : (
                <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
                  Ground-truth metrics are not available for this run. Accuracy should be reported only after validation data is supplied.
                </div>
              )}
            </div>
          </aside>
        </section>

        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: 12.5, lineHeight: 1.45 }}>
          <strong>Prototype note:</strong> parcel blocks are AI-derived preliminary boundaries. They require authoritative cadastral/GIS and survey validation before legal use.
        </div>
      </div>
    </main>
  );
}
