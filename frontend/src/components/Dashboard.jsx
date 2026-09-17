import { useMemo, useState } from "react";

const EMPTY = { type: "FeatureCollection", features: [] };

function featureCount(data) { return data?.features?.length || 0; }
function pretty(value) { return value === undefined || value === null || value === "" ? "—" : String(value).replaceAll("_", " "); }
function formatMetric(value) {
  if (value === undefined || value === null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) && n <= 1 ? `${(n * 100).toFixed(1)}%` : String(value);
}

const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18, boxShadow: "0 2px 8px rgba(15,23,42,.04)" };
const button = { border: "1px solid #cbd5e1", background: "#fff", borderRadius: 9, padding: "9px 13px", cursor: "pointer", fontWeight: 700 };
const colors = { buildings: "#22c55e", roads: "#f59e0b", parcels: "#38bdf8" };

function Metric({ label, value, note }) {
  return <div style={card}><div style={{ color: "#64748b", fontSize: 12 }}>{label}</div><div style={{ fontSize: 29, fontWeight: 800, marginTop: 4 }}>{value}</div><div style={{ color: "#94a3b8", fontSize: 11 }}>{note}</div></div>;
}

function geometryPoints(feature) {
  const g = feature?.geometry;
  if (!g) return [];
  if (g.type === "Polygon") return g.coordinates?.[0] || [];
  if (g.type === "MultiPolygon") return g.coordinates?.[0]?.[0] || [];
  if (g.type === "LineString") return g.coordinates || [];
  return [];
}

function featureKey(type, index) { return `${type}-${index}`; }

function cloneCollections(result) {
  return {
    buildings: JSON.parse(JSON.stringify(result?.buildings || EMPTY)),
    roads: JSON.parse(JSON.stringify(result?.roads || EMPTY)),
    parcels: JSON.parse(JSON.stringify(result?.parcels || EMPTY)),
  };
}

export default function Dashboard({ result, onReset }) {
  const [layers, setLayers] = useState(() => cloneCollections(result));
  const [visible, setVisible] = useState({ buildings: true, roads: true, parcels: true });
  const [selected, setSelected] = useState(null);
  const [review, setReview] = useState({});
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");

  const counts = useMemo(() => ({ buildings: featureCount(layers.buildings), roads: featureCount(layers.roads), parcels: featureCount(layers.parcels) }), [layers]);
  const total = counts.buildings + counts.roads + counts.parcels;
  const ai = result?.ai_engine || result?.ai_info || {};
  const evaluation = result?.evaluation || {};
  const imageUrl = result?.original_image_url;

  const selectedFeature = selected ? layers[selected.type]?.features?.[selected.index] : null;
  const selectedStatus = selected ? review[featureKey(selected.type, selected.index)] || "needs_review" : "needs_review";

  function selectFeature(type, index) { setSelected({ type, index }); setMessage(""); }

  function setReviewStatus(status) {
    if (!selected) return;
    setReview((current) => ({ ...current, [featureKey(selected.type, selected.index)]: status }));
    setMessage(`Feature marked ${status.replace("_", " ")}.`);
  }

  function updatePoint(pointIndex, event) {
    if (!editing || !selected) return;
    const rect = event.currentTarget.ownerSVGElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setLayers((current) => {
      const next = JSON.parse(JSON.stringify(current));
      const feature = next[selected.type].features[selected.index];
      const coords = feature.geometry.type === "Polygon" ? feature.geometry.coordinates[0] : feature.geometry.coordinates;
      coords[pointIndex] = [Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y))];
      if (feature.geometry.type === "Polygon" && pointIndex === 0 && coords.length > 1) coords[coords.length - 1] = [...coords[0]];
      return next;
    });
  }

  function downloadReviewed() {
    const output = cloneCollections({ ...result, ...layers });
    Object.entries(output).forEach(([type, collection]) => collection.features.forEach((f, i) => { f.properties = { ...(f.properties || {}), review_status: review[featureKey(type, i)] || "needs_review" }; }));
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `sahinaksha-${result?.analysis_id || "reviewed"}.geojson`; a.click(); URL.revokeObjectURL(url);
    setMessage("Reviewed GeoJSON exported.");
  }

  function featureSvg(type, feature, index) {
    const points = geometryPoints(feature);
    if (!points.length || !visible[type]) return null;
    const key = featureKey(type, index);
    const isSelected = selected?.type === type && selected?.index === index;
    const stroke = isSelected ? "#ffffff" : colors[type];
    const status = review[key];
    const opacity = status === "rejected" ? 0.12 : 0.28;
    const pointString = points.map(([x, y]) => `${x},${y}`).join(" ");
    const common = { key, onClick: (e) => { e.stopPropagation(); selectFeature(type, index); }, style: { cursor: "pointer" } };
    if (feature.geometry.type === "LineString") return <polyline {...common} points={pointString} fill="none" stroke={stroke} strokeWidth={isSelected ? 0.9 : 0.55} opacity={status === "rejected" ? 0.25 : 0.9} />;
    return <polygon {...common} points={pointString} fill={colors[type]} fillOpacity={opacity} stroke={stroke} strokeWidth={isSelected ? 0.65 : 0.35} />;
  }

  function selectedVertices() {
    if (!editing || !selectedFeature) return null;
    const points = geometryPoints(selectedFeature);
    if (!points.length || selectedFeature.geometry.type === "LineString" || selectedFeature.geometry.type === "MultiPolygon") return null;
    return points.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0.9} fill="#fff" stroke="#111827" strokeWidth="0.35" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const move = (ev) => updatePoint(i, ev); e.currentTarget.addEventListener("pointermove", move); e.currentTarget.addEventListener("pointerup", () => e.currentTarget.removeEventListener("pointermove", move), { once: true }); }} style={{ cursor: "grab" }} />);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f6f8fb", color: "#172033", padding: 18 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div><div style={{ fontSize: 28, fontWeight: 800 }}>Sahi<span style={{ color: "#2563eb" }}>Naksha</span></div><div style={{ color: "#64748b", marginTop: 3 }}>AI cadastral extraction • image review workspace</div></div>
          <button onClick={onReset} style={button}>New Analysis</button>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 12 }}>
          <Metric label="Buildings" value={counts.buildings} note="AI footprints" /><Metric label="Roads" value={counts.roads} note="AI road evidence" /><Metric label="Parcels" value={counts.parcels} note="Preliminary blocks" /><Metric label="Review queue" value={Object.values(review).filter((v) => v === "needs_review").length} note="Needs human review" />
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 310px", gap: 12 }}>
          <div style={{ ...card, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <div><b>Original image + AI overlays</b><div style={{ color: "#64748b", fontSize: 11, marginTop: 3 }}>Click a feature to review it. Use Edit Geometry to adjust polygon vertices.</div></div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{Object.keys(visible).map((key) => <button key={key} onClick={() => setVisible((v) => ({ ...v, [key]: !v[key] }))} style={{ ...button, padding: "6px 9px", fontSize: 11, opacity: visible[key] ? 1 : 0.45 }}>{key}</button>)}<button onClick={() => setEditing((v) => !v)} style={{ ...button, padding: "6px 9px", fontSize: 11 }}>{editing ? "Finish Editing" : "Edit Geometry"}</button></div>
            </div>
            <div style={{ position: "relative", width: "100%", minHeight: 560, background: "#111827", borderRadius: 10, overflow: "hidden", border: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {imageUrl ? <img src={imageUrl} alt="Original orthomosaic" style={{ width: "100%", height: "560px", objectFit: "fill", display: "block" }} /> : <div style={{ color: "#cbd5e1" }}>Original image is not available for this analysis.</div>}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "560px" }} onClick={() => setSelected(null)}>
                {Object.entries(layers).flatMap(([type, collection]) => collection.features.map((feature, index) => featureSvg(type, feature, index)))}
                {selectedVertices()}
              </svg>
              <div style={{ position: "absolute", left: 10, bottom: 10, display: "flex", gap: 8, padding: "7px 9px", borderRadius: 8, background: "rgba(17,24,39,.85)", color: "white", fontSize: 10 }}><span>● Building</span><span>━ Road</span><span>□ Parcel</span></div>
            </div>
          </div>

          <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <div style={card}><div style={{ color: "#64748b", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>REVIEW</div><h3 style={{ margin: "4px 0 10px" }}>{selectedFeature ? `${pretty(selected.type)} #${selected.index + 1}` : "Select a feature"}</h3>{selectedFeature ? <><Info label="Confidence" value={pretty(selectedFeature.properties?.confidence ?? selectedFeature.properties?.score)} /><Info label="Current status" value={pretty(selectedStatus)} /><div style={{ display: "grid", gap: 7, marginTop: 10 }}><button onClick={() => setReviewStatus("approved")} style={{ ...button, background: "#dcfce7", borderColor: "#86efac" }}>✓ Approve</button><button onClick={() => setReviewStatus("needs_review")} style={{ ...button, background: "#fef3c7", borderColor: "#fcd34d" }}>Review Again</button><button onClick={() => setReviewStatus("rejected")} style={{ ...button, background: "#fee2e2", borderColor: "#fca5a5" }}>✕ Reject</button></div>{message && <div style={{ marginTop: 9, padding: 8, borderRadius: 8, background: "#ecfdf5", color: "#166534", fontSize: 11 }}>{message}</div>}</> : <div style={{ color: "#64748b", fontSize: 12 }}>Click any detected building, road, or parcel overlay.</div>}</div>

            <div style={card}><div style={{ color: "#64748b", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>DASHBOARD</div><h3 style={{ margin: "4px 0 8px" }}>Analysis summary</h3><Info label="AI engine" value={pretty(ai.provider || ai.model || ai.engine)} /><Info label="Status" value={pretty(ai.status || "ready")} /><Info label="Total features" value={total} />{evaluation.available === true && <Info label="Validation" value={`Precision ${formatMetric(evaluation.precision)}`} />}<button onClick={downloadReviewed} style={{ ...button, width: "100%", marginTop: 10, background: "#172033", color: "#fff", borderColor: "#172033" }}>Export Reviewed GeoJSON</button></div>

            <div style={card}><div style={{ color: "#64748b", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>WORKFLOW</div><h3 style={{ margin: "4px 0 8px" }}>Human-in-the-loop</h3><div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>AI extraction → visual review → geometry edit → approve/reject → GIS-ready export.</div></div>
          </aside>
        </section>
        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 9, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: 11.5 }}>Prototype note: building/road extraction is visual AI output. Parcel boundaries remain preliminary and require authoritative cadastral/survey validation.</div>
      </div>
    </main>
  );
}

function Info({ label, value }) { return <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid #edf0f4", fontSize: 12 }}><span style={{ color: "#64748b" }}>{label}</span><strong style={{ textAlign: "right", textTransform: "capitalize" }}>{value}</strong></div>; }
