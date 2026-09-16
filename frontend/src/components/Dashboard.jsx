import { useMemo, useState, useEffect } from "react";
import { MapContainer, ImageOverlay, GeoJSON, Marker } from "react-leaflet";
import { CRS, divIcon } from "leaflet";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const BOUNDS = [[0, 0], [100, 100]];
const STORAGE_PREFIX = "sahinaksha:review:";

function polygonArea(geometry) {
  if (!geometry) return 0;
  const ringArea = (ring = []) => {
    let area = 0;
    for (let i = 0; i < ring.length; i += 1) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % ring.length];
      area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area) / 2;
  };
  if (geometry.type === "Polygon") return (geometry.coordinates || []).reduce((sum, ring, i) => sum + (i === 0 ? ringArea(ring) : -ringArea(ring)), 0);
  if (geometry.type === "MultiPolygon") return (geometry.coordinates || []).reduce((sum, polygon) => sum + polygonArea({ type: "Polygon", coordinates: polygon }), 0);
  return 0;
}

function collectionArea(collection) {
  return (collection?.features || []).reduce((sum, feature) => sum + polygonArea(feature.geometry), 0);
}

function pct(value) {
  return `${Math.min(100, Math.max(0, value)).toFixed(1)}%`;
}

function featureType(feature) {
  const p = feature?.properties || {};
  if (p.building_id != null || p.feature_type === "building") return "building";
  if (p.road_id != null || p.feature_type === "road_evidence" || p.feature_type === "road") return "road";
  return "parcel";
}

function featureId(feature) {
  const p = feature?.properties || {};
  const raw = p.parcel_id || p.building_id || p.road_id || feature?.id || "unknown";
  return `${featureType(feature)}:${raw}`;
}

const FIELD_CONFIG = {
  building: [
    { key: "building_id", label: "Building ID", type: "text" },
    { key: "building_use", label: "Building Use", type: "select", options: ["Residential", "Commercial", "Industrial", "Institutional", "Mixed Use", "Other"] },
    { key: "floors", label: "Number of Floors", type: "number", min: 0 },
    { key: "condition", label: "Building Condition", type: "select", options: ["Good", "Fair", "Poor", "Unknown"] },
    { key: "occupancy", label: "Occupancy", type: "select", options: ["Occupied", "Vacant", "Under Construction", "Unknown"] },
    { key: "roof_type", label: "Roof Type", type: "select", options: ["Flat", "Pitched", "Metal", "Tile", "Concrete", "Other", "Unknown"] },
    { key: "address", label: "Address / Locality", type: "text" },
    { key: "survey_status", label: "Survey Status", type: "select", options: ["AI Detected", "Human Verified", "Needs Field Survey", "Unknown"] },
    { key: "reviewer_notes", label: "Reviewer Notes", type: "textarea" },
  ],
  road: [
    { key: "road_id", label: "Road ID", type: "text" },
    { key: "road_type", label: "Road Type", type: "select", options: ["Highway", "Main Road", "Street", "Lane", "Path", "Access Road", "Unknown"] },
    { key: "surface", label: "Surface", type: "select", options: ["Asphalt", "Concrete", "Gravel", "Dirt", "Paved", "Unknown"] },
    { key: "access", label: "Access", type: "select", options: ["Public", "Private", "Restricted", "Unknown"] },
    { key: "condition", label: "Road Condition", type: "select", options: ["Good", "Fair", "Poor", "Unknown"] },
    { key: "name", label: "Road Name", type: "text" },
    { key: "reviewer_notes", label: "Reviewer Notes", type: "textarea" },
  ],
  parcel: [
    { key: "parcel_id", label: "Parcel ID", type: "text" },
    { key: "land_use", label: "Land Use", type: "select", options: ["Residential", "Commercial", "Agricultural", "Industrial", "Institutional", "Vacant", "Mixed Use", "Unknown"] },
    { key: "parcel_status", label: "Parcel Status", type: "select", options: ["Preliminary Block", "Reference Parcel", "Human Verified", "Needs Survey"] },
    { key: "area", label: "Area", type: "number", min: 0, step: "any" },
    { key: "ownership_ref", label: "Ownership Reference", type: "text" },
    { key: "survey_status", label: "Survey Status", type: "select", options: ["AI Derived", "Reference GIS", "Human Verified", "Needs Field Survey", "Unknown"] },
    { key: "reviewer_notes", label: "Reviewer Notes", type: "textarea" },
  ],
};

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function editableVertices(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    return geometry.coordinates.flatMap((ring, ringIndex) => ring.slice(0, -1).map((point, pointIndex) => ({ ringIndex, pointIndex, point })));
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flatMap((polygon, polygonIndex) => polygon.flatMap((ring, ringIndex) => ring.slice(0, -1).map((point, pointIndex) => ({ polygonIndex, ringIndex, pointIndex, point }))));
  }
  return [];
}

function updateGeometryPoint(geometry, vertex, lat, lng) {
  const next = JSON.parse(JSON.stringify(geometry));
  const point = [lng, lat];
  if (next.type === "Polygon") {
    next.coordinates[vertex.ringIndex][vertex.pointIndex] = point;
    const ring = next.coordinates[vertex.ringIndex];
    if (vertex.pointIndex === 0 || vertex.pointIndex === ring.length - 1) ring[ring.length - 1] = [...point];
  } else if (next.type === "MultiPolygon") {
    const ring = next.coordinates[vertex.polygonIndex][vertex.ringIndex];
    ring[vertex.pointIndex] = point;
    if (vertex.pointIndex === 0 || vertex.pointIndex === ring.length - 1) ring[ring.length - 1] = [...point];
  }
  return next;
}

const vertexIcon = divIcon({
  className: "geometry-vertex",
  html: "<span></span>",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function GeometryEditor({ feature, onChange }) {
  const vertices = editableVertices(feature?.geometry);
  if (!feature || !vertices.length) return null;
  return <>{vertices.map((vertex) => (
    <Marker
      key={`${vertex.polygonIndex ?? "p"}-${vertex.ringIndex}-${vertex.pointIndex}`}
      position={[vertex.point[1], vertex.point[0]]}
      icon={vertexIcon}
      draggable
      eventHandlers={{ dragend: (event) => {
        const { lat, lng } = event.target.getLatLng();
        onChange(updateGeometryPoint(feature.geometry, vertex, lat, lng));
      } }}
    />
  ))}</>;
}

export default function Dashboard({ result, onReset }) {
  const hasParcels = (result.parcels?.features?.length || 0) > 0;
  const storageKey = `${STORAGE_PREFIX}${result.analysis_id || "current"}`;
  const [layers, setLayers] = useState({ parcels: hasParcels, buildings: true, roads: true });
  const [selected, setSelected] = useState(null);
  const [review, setReview] = useState(() => readStorage(`${storageKey}:decisions`, {}));
  const [edits, setEdits] = useState(() => readStorage(`${storageKey}:edits`, {}));
  const [geometryEdits, setGeometryEdits] = useState(() => readStorage(`${storageKey}:geometry`, {}));
  const [editing, setEditing] = useState(false);
  const [geometryEditing, setGeometryEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [reviewerName, setReviewerName] = useState(() => localStorage.getItem(`${storageKey}:reviewer`) || "");
  const [finalMap, setFinalMap] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => { try { localStorage.setItem(`${storageKey}:decisions`, JSON.stringify(review)); } catch {} }, [storageKey, review]);
  useEffect(() => { try { localStorage.setItem(`${storageKey}:edits`, JSON.stringify(edits)); } catch {} }, [storageKey, edits]);
  useEffect(() => { try { localStorage.setItem(`${storageKey}:geometry`, JSON.stringify(geometryEdits)); } catch {} }, [storageKey, geometryEdits]);
  useEffect(() => { try { localStorage.setItem(`${storageKey}:reviewer`, reviewerName); } catch {} }, [storageKey, reviewerName]);

  const c = {
    parcels: result.parcels?.features?.length || 0,
    buildings: result.buildings?.features?.length || 0,
    roads: result.roads?.features?.length || 0,
    issues: result.validation?.issues?.length || 0,
  };

  const geometryOf = (feature) => geometryEdits[featureId(feature)] || feature.geometry;
  const displayFeature = (feature) => ({ ...feature, geometry: geometryOf(feature) });

  const stats = useMemo(() => {
    const areaFor = (collection) => (collection?.features || []).reduce((sum, f) => sum + polygonArea(geometryOf(f)), 0);
    const buildingArea = areaFor(result.buildings);
    const roadArea = areaFor(result.roads);
    const parcelArea = areaFor(result.parcels);
    const reviewed = Object.values(review);
    const approved = reviewed.filter((v) => v === "Approved").length;
    const needsReview = reviewed.filter((v) => v === "Needs Review").length;
    const rejected = reviewed.filter((v) => v === "Rejected").length;
    const totalFeatures = c.parcels + c.buildings + c.roads;
    return { buildingArea, roadArea, parcelArea, reviewed: reviewed.length, approved, needsReview, rejected, pending: Math.max(0, totalFeatures - reviewed.length), buildingCoverage: buildingArea, roadCoverage: roadArea };
  }, [result, review, geometryEdits, c.parcels, c.buildings, c.roads]);

  const aiReady = result.ai_engine?.status === "ready";
  const selectedId = featureId(selected);
  const selectedType = selected ? featureType(selected) : "building";
  const status = selectedId ? review[selectedId] : null;
  const evaluation = result.evaluation?.available ? result.evaluation : null;
  const totalWindows = result.ai_engine?.windows || 0;
  const threshold = result.ai_engine?.threshold;
  const provider = result.ai_engine?.provider || "not reported";
  const totalFeatures = c.parcels + c.buildings + c.roads;
  const currentProperties = selected ? { ...(selected.properties || {}), ...(edits[selectedId] || {}) } : {};
  const fields = FIELD_CONFIG[selectedType] || FIELD_CONFIG.building;
  const selectedGeometryFeature = selected ? displayFeature(selected) : null;

  const toggle = (key) => setLayers((current) => ({ ...current, [key]: !current[key] }));

  const selectFeature = (feature) => {
    const id = featureId(feature);
    const merged = displayFeature(feature);
    setSelected(merged);
    setEditing(false);
    setGeometryEditing(false);
    setDraft({ ...(feature.properties || {}), ...(edits[id] || {}) });
    setSaveMessage("");
    setFinalized(false);
  };

  const startEditing = () => {
    if (!selected) return;
    setDraft(currentProperties);
    setEditing(true);
    setGeometryEditing(false);
    setSaveMessage("");
    setFinalized(false);
  };

  const startGeometryEditing = () => {
    if (!selected) return;
    setEditing(false);
    setGeometryEditing(true);
    setFinalized(false);
    setSaveMessage("Drag the white vertices on the map to correct the boundary. Changes save automatically.");
  };

  const finishGeometryEditing = () => {
    setGeometryEditing(false);
    setSaveMessage("Geometry saved locally ✓");
    window.setTimeout(() => setSaveMessage(""), 2200);
  };

  const handleGeometryChange = (geometry) => {
    if (!selectedId) return;
    setGeometryEdits((current) => ({ ...current, [selectedId]: geometry }));
    setSelected((current) => current ? { ...current, geometry } : current);
    setFinalized(false);
  };

  const cancelEditing = () => { setDraft(currentProperties); setEditing(false); };

  const saveEdits = () => {
    if (!selectedId) return;
    const cleaned = { ...draft };
    Object.keys(cleaned).forEach((key) => { if (cleaned[key] === "") delete cleaned[key]; });
    setEdits((current) => ({ ...current, [selectedId]: cleaned }));
    setSelected((current) => current ? { ...current, properties: { ...(current.properties || {}), ...cleaned } } : current);
    setEditing(false);
    setFinalized(false);
    setSaveMessage("Saved locally ✓");
    window.setTimeout(() => setSaveMessage(""), 2200);
  };

  const mark = (decision) => {
    if (!selectedId) return;
    setReview((current) => ({ ...current, [selectedId]: decision }));
    setFinalized(false);
  };

  const featureWithEdits = (feature) => {
    const id = featureId(feature);
    const saved = edits[id] || {};
    const decision = review[id];
    return {
      ...feature,
      geometry: geometryOf(feature),
      properties: {
        ...(feature.properties || {}),
        ...saved,
        ...(decision ? { review_status: decision, reviewed_at: new Date().toISOString() } : {}),
        ...(reviewerName.trim() ? { reviewed_by: reviewerName.trim() } : {}),
      },
    };
  };

  const reviewedCollection = (collection, onlyApproved = false) => ({
    type: "FeatureCollection",
    features: (collection?.features || []).filter((feature) => {
      const decision = review[featureId(feature)];
      return onlyApproved ? decision === "Approved" : decision && decision !== "Rejected";
    }).map(featureWithEdits),
  });

  const finalGIS = useMemo(() => {
    const collections = [result.parcels, result.buildings, result.roads];
    const features = collections.flatMap((collection) => reviewedCollection(collection, true).features);
    return {
      type: "FeatureCollection",
      features,
      metadata: {
        project: "SahiNaksha",
        stage: "human_reviewed_final_gis",
        analysis_id: result.analysis_id,
        source: "AI extraction + human review + attribute and geometry correction",
        approved_feature_count: features.length,
        edited_feature_count: Object.keys(edits).length,
        geometry_edited_feature_count: Object.keys(geometryEdits).length,
        reviewed_by: reviewerName.trim() || "not specified",
        persistence: "browser_local_storage",
        legal_status: "prototype_output_requires_authoritative_cadastral_and_survey_validation",
      },
    };
  }, [result, review, edits, geometryEdits, reviewerName]);

  const exportFile = () => window.open(API + "/analysis/" + result.analysis_id + "/export", "_blank");

  const clearSavedReview = () => {
    if (!window.confirm("Clear saved review decisions, attribute edits and geometry edits for this analysis?")) return;
    try {
      localStorage.removeItem(`${storageKey}:decisions`);
      localStorage.removeItem(`${storageKey}:edits`);
      localStorage.removeItem(`${storageKey}:geometry`);
      setReview({}); setEdits({}); setGeometryEdits({}); setSelected(null); setEditing(false); setGeometryEditing(false); setFinalized(false);
      setSaveMessage("Saved review cleared");
      window.setTimeout(() => setSaveMessage(""), 2200);
    } catch { setSaveMessage("Could not clear local storage"); }
  };

  const downloadFinalGIS = () => {
    if (!finalGIS.features.length) return;
    const blob = new Blob([JSON.stringify(finalGIS, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sahinaksha_final_reviewed_${result.analysis_id || "output"}.geojson`;
    anchor.click();
    URL.revokeObjectURL(url);
    setFinalized(true);
  };

  const renderCollection = (collection) => ({ ...collection, features: (collection?.features || []).map(displayFeature) });

  return (
    <main className="dashboard">
      <header className="topbar">
        <div><div className="brand">Sahi<span>Naksha</span></div><small>{aiReady ? "AI analysis complete · human review enabled" : "AI analysis unavailable · fallback processing active"}</small></div>
        <div className="actions"><button className="secondary-button" onClick={exportFile}>Export Raw GeoJSON</button><button className="secondary-button" onClick={onReset}>New Analysis</button></div>
      </header>

      <section className="summary-grid"><div><b>{c.parcels}</b><span>Preliminary Parcel Blocks</span></div><div><b>{c.buildings}</b><span>Building Footprints</span></div><div><b>{c.roads}</b><span>Road / Access Evidence</span></div><div><b>{c.issues}</b><span>Topology Issues</span></div></section>

      <section className="review-report">
        <div className="report-heading"><div><span className="report-kicker">AI REVIEW REPORT</span><h2>Model findings & quality summary</h2><p>Numbers below are calculated from this analysis result. Accuracy metrics appear only when ground-truth data is supplied.</p></div><div className={"engine-pill " + (aiReady ? "ready" : "fallback")}>{aiReady ? "● Model ready" : "● Fallback"}</div></div>
        <div className="report-grid"><div className="report-card"><span>AI model</span><strong>{provider.replaceAll("_", " ")}</strong><small>{totalWindows ? `${totalWindows} image windows analysed` : "Model metadata not reported"}</small></div><div className="report-card"><span>Detection threshold</span><strong>{threshold != null ? threshold : "—"}</strong><small>Configured inference threshold</small></div><div className="report-card"><span>Feature coverage</span><strong>{pct((stats.buildingCoverage + stats.roadCoverage) / 100)}</strong><small>Relative mapped area; not ground area</small></div><div className="report-card"><span>Review progress</span><strong>{stats.reviewed}/{totalFeatures}</strong><small>{stats.pending} feature(s) still pending</small></div></div>
        <div className="report-columns">
          <div className="report-section"><h3>Detected data</h3><div className="metric-row"><span>Buildings</span><b>{c.buildings}</b></div><div className="metric-row"><span>Road/access segments</span><b>{c.roads}</b></div><div className="metric-row"><span>Preliminary land blocks</span><b>{c.parcels}</b></div><div className="metric-row"><span>Topology issues</span><b>{c.issues}</b></div></div>
          <div className="report-section"><h3>Mapped area (relative image units²)</h3><div className="metric-row"><span>Building footprint area</span><b>{stats.buildingArea.toFixed(1)}</b></div><div className="metric-row"><span>Road evidence area</span><b>{stats.roadArea.toFixed(1)}</b></div><div className="metric-row"><span>Parcel block area</span><b>{stats.parcelArea.toFixed(1)}</b></div><div className="metric-row"><span>Topology repairs</span><b>{result.topology_stats?.repaired_geometries || 0}</b></div></div>
          <div className="report-section"><h3>Human review</h3><div className="review-counts"><span><b>{stats.approved}</b> Approved</span><span><b>{stats.needsReview}</b> Needs review</span><span><b>{stats.rejected}</b> Rejected</span></div><div className="review-progress"><i style={{ width: `${(stats.reviewed / Math.max(1, totalFeatures)) * 100}%` }} /></div><small>{stats.reviewed} of {totalFeatures} mapped features reviewed in this session.</small></div>
          <div className="report-section"><h3>Validation</h3>{evaluation ? <><div className="metric-row"><span>Mean IoU</span><b>{evaluation.mean_iou}</b></div><div className="metric-row"><span>Precision @ IoU 0.10</span><b>{pct(evaluation.precision_at_iou_0_10 * 100)}</b></div><div className="metric-row"><span>Recall @ IoU 0.10</span><b>{pct(evaluation.recall_at_iou_0_10 * 100)}</b></div><small>Measured against the uploaded ground-truth layer.</small></> : <div className="validation-note"><b>Ground truth not supplied</b><span>Use a reference/ground-truth GIS layer to show measured precision, recall and IoU. The dashboard will not invent an accuracy score.</span></div>}</div>
        </div>
        <div className="presentation-note"><b>Presentation line:</b> “The AI extracts building footprints, road/access evidence and preliminary parcel blocks. Each feature can then be reviewed, validated and exported as GIS data. Legal parcel boundaries require authoritative cadastral data and survey verification.”</div>
      </section>

      <section className="next-steps">
        <div className="next-steps-heading"><div><span className="report-kicker">POST-REVIEW WORKFLOW</span><h2>From reviewed AI output to final GIS</h2><p>Only approved features are included in the final prototype GIS package.</p></div><div className={"workflow-status " + (finalized ? "complete" : "active")}>{finalized ? "✓ GIS output ready" : "Review → Map → GIS"}</div></div>
        <div className="workflow-grid"><div className={"workflow-step " + (stats.reviewed ? "done" : "") }><div className="step-number">1</div><div><b>Human review</b><span>{stats.reviewed}/{totalFeatures} features reviewed</span></div></div><div className={"workflow-step " + (finalMap ? "done" : "") }><div className="step-number">2</div><div><b>Final map validation</b><span>{finalMap ? "Approved features displayed" : "Compare reviewed features on map"}</span></div></div><div className={"workflow-step " + (finalized ? "done" : "") }><div className="step-number">3</div><div><b>Final GIS output</b><span>{finalGIS.features.length} approved features prepared</span></div></div></div>
        <div className="next-actions"><button className="secondary-button" onClick={() => setFinalMap((value) => !value)}>{finalMap ? "Show AI Map" : "Open Final Reviewed Map"}</button><button className="primary-button inline-button" disabled={!stats.approved} onClick={downloadFinalGIS}>Generate & Download Final GIS</button></div>
        {!stats.approved && <p className="workflow-note">Approve at least one feature to generate the final GIS output. Features marked “Needs Review” or “Rejected” are not included.</p>}
        {stats.needsReview > 0 && <p className="workflow-warning">{stats.needsReview} feature(s) are still marked “Needs Review”. Resolve them before treating the dataset as final.</p>}
        {finalized && <div className="final-output"><b>Final GIS package generated</b><span>{finalGIS.features.length} approved features · GeoJSON · human-reviewed prototype output</span></div>}
      </section>

      <section className="cadastral-warning"><b>Pipeline:</b> {result.analysis_mode} · <b>AI:</b> {result.ai_engine?.status || "not reported"} · <b>Topology fixes:</b> {result.topology_stats?.repaired_geometries || 0} · <b>Overlaps resolved:</b> {result.topology_stats?.overlap_conflicts_resolved || 0}</section>
      {!hasParcels && <section className="cadastral-warning"><b>No parcel polygons were produced for this image.</b> Configure the AI segmentation engine or provide an aligned parcel GIS layer.</section>}

      <section className="workspace">
        <aside className="sidebar">
          <h3>{finalMap ? "Final Reviewed Map" : "GIS Layers"}</h3>
          {!finalMap ? Object.keys(layers).map((key) => <label key={key} className="toggle"><input type="checkbox" checked={layers[key]} onChange={() => toggle(key)} />{key}</label>) : <p className="final-map-hint">Showing only features that were approved during human review.</p>}
          <hr />
          <h3>Human Review</h3>
          {selected ? <>
            <div className="review-editor-header"><div><span className="feature-type-badge">{selectedType}</span><small>{selectedId}</small></div><div className="geometry-tools">{!editing && !geometryEditing && <button className="secondary-button edit-button" onClick={startEditing}>Edit Attributes</button>}{!editing && !geometryEditing && <button className="secondary-button edit-button geometry-edit-button" onClick={startGeometryEditing}>Edit Boundary</button>}</div></div>
            {geometryEditing && <div className="geometry-help"><b>Boundary editing active</b><span>Drag the white vertex handles directly on the map. Move each corner until it matches the image. Your changes are saved automatically.</span><button className="primary-button" onClick={finishGeometryEditing}>Finish Boundary Edit</button></div>}
            {editing ? <div className="edit-form">{fields.map((field) => <label key={field.key} className="edit-field"><span>{field.label}</span>{field.type === "select" ? <select value={draft[field.key] ?? ""} onChange={(e) => setDraft((current) => ({ ...current, [field.key]: e.target.value }))}><option value="">Select...</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea rows={3} value={draft[field.key] ?? ""} onChange={(e) => setDraft((current) => ({ ...current, [field.key]: e.target.value }))} /> : <input type={field.type} min={field.min} step={field.step} value={draft[field.key] ?? ""} onChange={(e) => setDraft((current) => ({ ...current, [field.key]: e.target.value }))} />}</label>)}<div className="editor-actions"><button className="primary-button" onClick={saveEdits}>Save Changes</button><button className="secondary-button" onClick={cancelEditing}>Cancel</button></div></div> : !geometryEditing && <div className="details">{Object.entries(currentProperties).map(([key, value]) => <div key={key}><span>{key.replaceAll("_", " ")}</span><b>{String(value)}</b></div>)}</div>}
            {saveMessage && <p className="save-message">{saveMessage}</p>}
            <label className="reviewer-field"><span>Reviewer name</span><input value={reviewerName} placeholder="Enter reviewer name" onChange={(e) => setReviewerName(e.target.value)} /></label>
            <div className="review-buttons"><button onClick={() => mark("Approved")}>Approve</button><button onClick={() => mark("Needs Review")}>Review</button><button onClick={() => mark("Rejected")}>Reject</button></div>
            {status && <p className={"review-status " + status.toLowerCase().replaceAll(" ", "-")}>{status} · saved locally</p>}
          </> : <p className="muted">Click a building, road or parcel block to inspect it. Use <b>Edit Boundary</b> to move its vertices directly on the image map for precise correction.</p>}
          <hr />
          <div className="storage-header"><h3>Local persistence</h3><span>Browser storage</span></div>
          <p className="muted">Attribute edits, boundary edits, review decisions and reviewer name are saved automatically in this browser for this analysis.</p>
          <button className="secondary-button" onClick={clearSavedReview}>Clear Saved Review</button>
          <hr />
          <h3>Validation status</h3><p className="muted">{c.issues ? `${c.issues} issue(s) require review.` : "No parcel topology issues detected."}</p>
        </aside>

        <div className="map-wrap">
          <MapContainer crs={CRS.Simple} bounds={BOUNDS} boundsOptions={{ padding: [20, 20] }} minZoom={-2} maxZoom={4} zoom={0} style={{ height: "100%", width: "100%", background: "#111827" }}>
            {result.original_image_url && <ImageOverlay url={result.original_image_url} bounds={BOUNDS} opacity={0.90} />}
            {!finalMap && layers.parcels && <GeoJSON data={renderCollection(result.parcels)} style={{ color: "#22c55e", weight: geometryEditing && selectedType === "parcel" ? 4 : 2.5, fillOpacity: 0.10 }} onEachFeature={(f, l) => l.on({ click: () => !geometryEditing && selectFeature(f) })} />}
            {!finalMap && layers.buildings && <GeoJSON data={renderCollection(result.buildings)} style={{ color: "#38bdf8", weight: geometryEditing && selectedType === "building" ? 4 : 2, fillOpacity: 0.08 }} onEachFeature={(f, l) => l.on({ click: () => !geometryEditing && selectFeature(f) })} />}
            {!finalMap && layers.roads && <GeoJSON data={renderCollection(result.roads)} style={{ color: "#f59e0b", weight: geometryEditing && selectedType === "road" ? 4 : 3, fillOpacity: 0.06 }} onEachFeature={(f, l) => l.on({ click: () => !geometryEditing && selectFeature(f) })} />}
            {finalMap && <GeoJSON data={finalGIS} style={{ color: "#72d89b", weight: 3, fillOpacity: 0.16 }} onEachFeature={(f, l) => l.on({ click: () => selectFeature(f) })} />}
            {geometryEditing && selectedGeometryFeature && <GeometryEditor feature={selectedGeometryFeature} onChange={handleGeometryChange} />}
          </MapContainer>
          <div className="map-note">{geometryEditing ? "✦ Boundary edit mode: drag the white handles to align the line with the aerial image." : finalMap ? "Final reviewed map: approved features only." : "Green: preliminary parcels. Blue: building footprints. Orange: road/access evidence. Click a feature to review it."}</div>
        </div>
      </section>
    </main>
  );
}
