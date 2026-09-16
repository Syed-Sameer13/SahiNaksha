import { useMemo, useState } from "react";
import { MapContainer, ImageOverlay, GeoJSON } from "react-leaflet";
import { CRS } from "leaflet";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const BOUNDS = [[0, 0], [100, 100]];

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

export default function Dashboard({ result, onReset }) {
  const hasParcels = (result.parcels?.features?.length || 0) > 0;
  const [layers, setLayers] = useState({ parcels: hasParcels, buildings: true, roads: true });
  const [selected, setSelected] = useState(null);
  const [review, setReview] = useState({});
  const [edits, setEdits] = useState({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [reviewerName, setReviewerName] = useState("");
  const [finalMap, setFinalMap] = useState(false);
  const [finalized, setFinalized] = useState(false);

  const c = {
    parcels: result.parcels?.features?.length || 0,
    buildings: result.buildings?.features?.length || 0,
    roads: result.roads?.features?.length || 0,
    issues: result.validation?.issues?.length || 0,
  };

  const stats = useMemo(() => {
    const buildingArea = collectionArea(result.buildings);
    const roadArea = collectionArea(result.roads);
    const parcelArea = collectionArea(result.parcels);
    const reviewed = Object.values(review);
    const approved = reviewed.filter((v) => v === "Approved").length;
    const needsReview = reviewed.filter((v) => v === "Needs Review").length;
    const rejected = reviewed.filter((v) => v === "Rejected").length;
    const totalFeatures = c.parcels + c.buildings + c.roads;
    return { buildingArea, roadArea, parcelArea, reviewed: reviewed.length, approved, needsReview, rejected, pending: Math.max(0, totalFeatures - reviewed.length), buildingCoverage: buildingArea, roadCoverage: roadArea };
  }, [result, review, c.parcels, c.buildings, c.roads]);

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

  const toggle = (key) => setLayers((current) => ({ ...current, [key]: !current[key] }));

  const selectFeature = (feature) => {
    const id = featureId(feature);
    setSelected(feature);
    setEditing(false);
    setDraft({ ...(feature.properties || {}), ...(edits[id] || {}) });
    setFinalized(false);
  };

  const startEditing = () => {
    if (!selected) return;
    setDraft(currentProperties);
    setEditing(true);
    setFinalized(false);
  };

  const cancelEditing = () => {
    setDraft(currentProperties);
    setEditing(false);
  };

  const saveEdits = () => {
    if (!selectedId) return;
    const cleaned = { ...draft };
    Object.keys(cleaned).forEach((key) => {
      if (cleaned[key] === "") delete cleaned[key];
    });
    setEdits((current) => ({ ...current, [selectedId]: cleaned }));
    setSelected((current) => current ? { ...current, properties: { ...(current.properties || {}), ...cleaned } } : current);
    setEditing(false);
    setFinalized(false);
  };

  const mark = (decision) => {
    if (!selectedId) return;
    setReview((current) => ({ ...current, [selectedId]: decision }));
    setFinalized(false);
  };

  const featureWithEdits = (feature) => {
    const id = featureId(feature);
    const saved = edits[id] || {};
    return {
      ...feature,
      properties: {
        ...(feature.properties || {}),
        ...saved,
        ...(review[id] ? { review_status: review[id] } : {}),
        ...(reviewerName.trim() ? { reviewed_by: reviewerName.trim() } : {}),
        ...(review[id] ? { reviewed_at: new Date().toISOString() } : {}),
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
        source: "AI extraction + human review + attribute correction",
        approved_feature_count: features.length,
        edited_feature_count: Object.keys(edits).length,
        reviewed_by: reviewerName.trim() || "not specified",
        legal_status: "prototype_output_requires_authoritative_cadastral_and_survey_validation",
      },
    };
  }, [result, review, edits, reviewerName]);

  const exportFile = () => window.open(API + "/analysis/" + result.analysis_id + "/export", "_blank");

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

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <div className="brand">Sahi<span>Naksha</span></div>
          <small>{aiReady ? "AI analysis complete · human review enabled" : "AI analysis unavailable · fallback processing active"}</small>
        </div>
        <div className="actions">
          <button className="secondary-button" onClick={exportFile}>Export Raw GeoJSON</button>
          <button className="secondary-button" onClick={onReset}>New Analysis</button>
        </div>
      </header>

      <section className="summary-grid">
        <div><b>{c.parcels}</b><span>Preliminary Parcel Blocks</span></div>
        <div><b>{c.buildings}</b><span>Building Footprints</span></div>
        <div><b>{c.roads}</b><span>Road / Access Evidence</span></div>
        <div><b>{c.issues}</b><span>Topology Issues</span></div>
      </section>

      <section className="review-report">
        <div className="report-heading">
          <div>
            <span className="report-kicker">AI REVIEW REPORT</span>
            <h2>Model findings & quality summary</h2>
            <p>Numbers below are calculated from this analysis result. Accuracy metrics appear only when ground-truth data is supplied.</p>
          </div>
          <div className={"engine-pill " + (aiReady ? "ready" : "fallback")}>{aiReady ? "● Model ready" : "● Fallback"}</div>
        </div>
        <div className="report-grid">
          <div className="report-card"><span>AI model</span><strong>{provider.replaceAll("_", " ")}</strong><small>{totalWindows ? `${totalWindows} image windows analysed` : "Model metadata not reported"}</small></div>
          <div className="report-card"><span>Detection threshold</span><strong>{threshold != null ? threshold : "—"}</strong><small>Configured inference threshold</small></div>
          <div className="report-card"><span>Feature coverage</span><strong>{pct((stats.buildingCoverage + stats.roadCoverage) / 100)}</strong><small>Relative mapped area; not ground area</small></div>
          <div className="report-card"><span>Review progress</span><strong>{stats.reviewed}/{totalFeatures}</strong><small>{stats.pending} feature(s) still pending</small></div>
        </div>
        <div className="report-columns">
          <div className="report-section"><h3>Detected data</h3><div className="metric-row"><span>Buildings</span><b>{c.buildings}</b></div><div className="metric-row"><span>Road/access segments</span><b>{c.roads}</b></div><div className="metric-row"><span>Preliminary land blocks</span><b>{c.parcels}</b></div><div className="metric-row"><span>Topology issues</span><b>{c.issues}</b></div></div>
          <div className="report-section"><h3>Mapped area (relative image units²)</h3><div className="metric-row"><span>Building footprint area</span><b>{stats.buildingArea.toFixed(1)}</b></div><div className="metric-row"><span>Road evidence area</span><b>{stats.roadArea.toFixed(1)}</b></div><div className="metric-row"><span>Parcel block area</span><b>{stats.parcelArea.toFixed(1)}</b></div><div className="metric-row"><span>Topology repairs</span><b>{result.topology_stats?.repaired_geometries || 0}</b></div></div>
          <div className="report-section"><h3>Human review</h3><div className="review-counts"><span><b>{stats.approved}</b> Approved</span><span><b>{stats.needsReview}</b> Needs review</span><span><b>{stats.rejected}</b> Rejected</span></div><div className="review-progress"><i style={{ width: `${(stats.reviewed / Math.max(1, totalFeatures)) * 100}%` }} /></div><small>{stats.reviewed} of {totalFeatures} mapped features reviewed in this session.</small></div>
          <div className="report-section"><h3>Validation</h3>{evaluation ? <><div className="metric-row"><span>Mean IoU</span><b>{evaluation.mean_iou}</b></div><div className="metric-row"><span>Precision @ IoU 0.10</span><b>{pct(evaluation.precision_at_iou_0_10 * 100)}</b></div><div className="metric-row"><span>Recall @ IoU 0.10</span><b>{pct(evaluation.recall_at_iou_0_10 * 100)}</b></div><small>Measured against the uploaded ground-truth layer.</small></> : <div className="validation-note"><b>Ground truth not supplied</b><span>Use a reference/ground-truth GIS layer to show measured precision, recall and IoU. The dashboard will not invent an accuracy score.</span></div>}</div>
        </div>
        <div className="presentation-note"><b>Presentation line:</b> “The AI extracts building footprints, road/access evidence and preliminary parcel blocks. Each feature can then be reviewed, corrected, validated and exported as GIS data. Legal parcel boundaries require authoritative cadastral data and survey verification.”</div>
      </section>

      <section className="next-steps">
        <div className="next-steps-heading"><div><span className="report-kicker">POST-REVIEW WORKFLOW</span><h2>From reviewed AI output to final GIS</h2><p>Only approved features are included in the final prototype GIS package.</p></div><div className={"workflow-status " + (finalized ? "complete" : "active")}>{finalized ? "✓ GIS output ready" : "Review → Map → GIS"}</div></div>
        <div className="workflow-grid">
          <div className={"workflow-step " + (stats.reviewed ? "done" : "") }><div className="step-number">1</div><div><b>Human review</b><span>{stats.reviewed}/{totalFeatures} features reviewed</span></div></div>
          <div className={"workflow-step " + (finalMap ? "done" : "") }><div className="step-number">2</div><div><b>Final map validation</b><span>{finalMap ? "Approved features displayed" : "Compare reviewed features on map"}</span></div></div>
          <div className={"workflow-step " + (finalized ? "done" : "") }><div className="step-number">3</div><div><b>Final GIS output</b><span>{finalGIS.features.length} approved features prepared</span></div></div>
        </div>
        <div className="next-actions">
          <button className="secondary-button" onClick={() => setFinalMap((value) => !value)}>{finalMap ? "Show AI Map" : "Open Final Reviewed Map"}</button>
          <button className="primary-button inline-button" disabled={!stats.approved} onClick={downloadFinalGIS}>Generate & Download Final GIS</button>
        </div>
        {!stats.approved && <p className="workflow-note">Approve at least one feature to generate the final GIS output. Features marked “Needs Review” or “Rejected” are not included.</p>}
        {stats.needsReview > 0 && <p className="workflow-warning">{stats.needsReview} feature(s) are still marked “Needs Review”. Resolve them before treating the dataset as final.</p>}
        {finalized && <div className="final-output"><b>Final GIS package generated</b><span>{finalGIS.features.length} approved features · {Object.keys(edits).length} feature(s) with attribute edits · GeoJSON</span></div>}
      </section>

      <section className="cadastral-warning"><b>Pipeline:</b> {result.analysis_mode} · <b>AI:</b> {result.ai_engine?.status || "not reported"} · <b>Topology fixes:</b> {result.topology_stats?.repaired_geometries || 0} · <b>Overlaps resolved:</b> {result.topology_stats?.overlap_conflicts_resolved || 0}</section>
      {!hasParcels && <section className="cadastral-warning"><b>No parcel polygons were produced for this image.</b> Configure the AI segmentation engine or provide an aligned parcel GIS layer.</section>}

      <section className="workspace">
        <aside className="sidebar">
          <h3>{finalMap ? "Final Reviewed Map" : "GIS Layers"}</h3>
          {!finalMap ? Object.keys(layers).map((key) => <label key={key} className="toggle"><input type="checkbox" checked={layers[key]} onChange={() => toggle(key)} />{key}</label>) : <p className="final-map-hint">Showing only features that were approved during human review.</p>}
          <hr />
          <h3>Human Review & Attribute Correction</h3>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Reviewer name</label>
            <input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} placeholder="Enter reviewer name" style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", border: "1px solid #334155", borderRadius: 8, background: "#0f172a", color: "inherit" }} />
          </div>
          {selected ? <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{selectedType} attributes</span>
              {!editing ? <button className="secondary-button" onClick={startEditing}>Edit Attributes</button> : <div style={{ display: "flex", gap: 6 }}><button className="primary-button" onClick={saveEdits}>Save Changes</button><button className="secondary-button" onClick={cancelEditing}>Cancel</button></div>}
            </div>
            {editing ? <div className="details" style={{ display: "grid", gap: 10 }}>
              {fields.map((field) => {
                const value = draft[field.key] ?? "";
                return <label key={field.key} style={{ display: "grid", gap: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{field.label}</span>
                  {field.type === "select" ? <select value={value} onChange={(e) => setDraft((current) => ({ ...current, [field.key]: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "8px 9px", border: "1px solid #334155", borderRadius: 7, background: "#0f172a", color: "inherit" }}><option value="">Select...</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea value={value} onChange={(e) => setDraft((current) => ({ ...current, [field.key]: e.target.value }))} rows={3} placeholder="Add reviewer notes" style={{ width: "100%", boxSizing: "border-box", padding: "8px 9px", border: "1px solid #334155", borderRadius: 7, background: "#0f172a", color: "inherit", resize: "vertical" }} /> : <input type={field.type} min={field.min} step={field.step} value={value} onChange={(e) => setDraft((current) => ({ ...current, [field.key]: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "8px 9px", border: "1px solid #334155", borderRadius: 7, background: "#0f172a", color: "inherit" }} />}
                </label>;
              })}
            </div> : <div className="details">{fields.map((field) => <div key={field.key}><span>{field.label}</span><b>{currentProperties[field.key] != null && currentProperties[field.key] !== "" ? String(currentProperties[field.key]) : "—"}</b></div>)}{Object.entries(currentProperties).filter(([key]) => !fields.some((field) => field.key === key)).map(([key, value]) => <div key={key}><span>{key.replaceAll("_", " ")}</span><b>{String(value)}</b></div>)}</div>}
            <div className="review-buttons"><button onClick={() => mark("Approved")}>Approve</button><button onClick={() => mark("Needs Review")}>Needs Review</button><button onClick={() => mark("Rejected")}>Reject</button></div>
            {status && <p className={"review-status " + status.toLowerCase().replaceAll(" ", "-")}>{status}</p>}
            {Object.keys(edits[selectedId] || {}).length > 0 && <p className="muted" style={{ marginTop: 8 }}>✓ Attribute corrections saved for this feature and included in the final GIS export.</p>}
          </> : <p className="muted">Click a building, road or parcel block to inspect its attributes. Use <b>Edit Attributes</b> to correct values, save them, then approve the feature.</p>}
          <hr />
          <h3>Validation status</h3>
          <p className="muted">{c.issues ? `${c.issues} issue(s) require review.` : "No parcel topology issues detected."}</p>
          <p className="muted">Attribute edits are session-based in this prototype and are written into the downloaded final GeoJSON.</p>
        </aside>

        <div className="map-wrap">
          <MapContainer crs={CRS.Simple} bounds={BOUNDS} boundsOptions={{ padding: [20, 20] }} minZoom={-2} maxZoom={4} zoom={0} style={{ height: "100%", width: "100%", background: "#111827" }}>
            {result.original_image_url && <ImageOverlay url={result.original_image_url} bounds={BOUNDS} opacity={0.90} />}
            {!finalMap && layers.parcels && <GeoJSON data={result.parcels} style={{ color: "#22c55e", weight: 2.5, fillOpacity: 0.10 }} onEachFeature={(f, l) => l.on({ click: () => selectFeature(f) })} />}
            {!finalMap && layers.buildings && <GeoJSON data={result.buildings} style={{ color: "#38bdf8", weight: 2, fillOpacity: 0.08 }} onEachFeature={(f, l) => l.on({ click: () => selectFeature(f) })} />}
            {!finalMap && layers.roads && <GeoJSON data={result.roads} style={{ color: "#f59e0b", weight: 3, fillOpacity: 0.06 }} onEachFeature={(f, l) => l.on({ click: () => selectFeature(f) })} />}
            {finalMap && <GeoJSON data={finalGIS} style={{ color: "#72d89b", weight: 3, fillOpacity: 0.16 }} onEachFeature={(f, l) => l.on({ click: () => selectFeature(f) })} />}
          </MapContainer>
          <div className="map-note">{finalMap ? "Final reviewed map: approved features only, including saved attribute corrections." : "Green: preliminary parcels. Blue: building footprints. Orange: road/access evidence. Click a feature to review and correct its attributes."}</div>
        </div>
      </section>
    </main>
  );
}
