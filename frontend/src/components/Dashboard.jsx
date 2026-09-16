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

function featureId(feature) {
  return feature?.properties?.parcel_id || feature?.properties?.building_id || feature?.properties?.road_id || feature?.id;
}

export default function Dashboard({ result, onReset }) {
  const hasParcels = (result.parcels?.features?.length || 0) > 0;
  const [layers, setLayers] = useState({ parcels: hasParcels, buildings: true, roads: true });
  const [selected, setSelected] = useState(null);
  const [review, setReview] = useState({});
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
  const status = selectedId ? review[selectedId] : null;
  const evaluation = result.evaluation?.available ? result.evaluation : null;
  const totalWindows = result.ai_engine?.windows || 0;
  const threshold = result.ai_engine?.threshold;
  const provider = result.ai_engine?.provider || "not reported";
  const totalFeatures = c.parcels + c.buildings + c.roads;
  const reviewComplete = totalFeatures > 0 && stats.pending === 0;

  const toggle = (key) => setLayers((current) => ({ ...current, [key]: !current[key] }));

  const mark = (decision) => {
    if (!selectedId) return;
    setReview((current) => ({ ...current, [selectedId]: decision }));
    setFinalized(false);
  };

  const reviewedCollection = (collection, onlyApproved = false) => ({
    type: "FeatureCollection",
    features: (collection?.features || []).filter((feature) => {
      const decision = review[featureId(feature)];
      return onlyApproved ? decision === "Approved" : decision && decision !== "Rejected";
    }).map((feature) => ({
      ...feature,
      properties: { ...(feature.properties || {}), review_status: review[featureId(feature)] },
    })),
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
        source: "AI extraction + human review",
        approved_feature_count: features.length,
        legal_status: "prototype_output_requires_authoritative_cadastral_and_survey_validation",
      },
    };
  }, [result, review]);

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
        <div className="presentation-note"><b>Presentation line:</b> “The AI extracts building footprints, road/access evidence and preliminary parcel blocks. Each feature can then be reviewed, validated and exported as GIS data. Legal parcel boundaries require authoritative cadastral data and survey verification.”</div>
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
          {selected ? <><div className="details">{Object.entries(selected.properties || {}).map(([key, value]) => <div key={key}><span>{key.replaceAll("_", " ")}</span><b>{String(value)}</b></div>)}</div><div className="review-buttons"><button onClick={() => mark("Approved")}>Approve</button><button onClick={() => mark("Needs Review")}>Review</button><button onClick={() => mark("Rejected")}>Reject</button></div>{status && <p className={"review-status " + status.toLowerCase().replaceAll(" ", "-")}>{status}</p>}</> : <p className="muted">Click a building, road or parcel block to inspect its properties and record a review decision.</p>}
          <hr />
          <h3>Validation status</h3>
          <p className="muted">{c.issues ? `${c.issues} issue(s) require review.` : "No parcel topology issues detected."}</p>
        </aside>

        <div className="map-wrap">
          <MapContainer crs={CRS.Simple} bounds={BOUNDS} boundsOptions={{ padding: [20, 20] }} minZoom={-2} maxZoom={4} zoom={0} style={{ height: "100%", width: "100%", background: "#111827" }}>
            {result.original_image_url && <ImageOverlay url={result.original_image_url} bounds={BOUNDS} opacity={0.90} />}
            {!finalMap && layers.parcels && <GeoJSON data={result.parcels} style={{ color: "#22c55e", weight: 2.5, fillOpacity: 0.10 }} onEachFeature={(f, l) => l.on({ click: () => setSelected(f) })} />}
            {!finalMap && layers.buildings && <GeoJSON data={result.buildings} style={{ color: "#38bdf8", weight: 2, fillOpacity: 0.08 }} onEachFeature={(f, l) => l.on({ click: () => setSelected(f) })} />}
            {!finalMap && layers.roads && <GeoJSON data={result.roads} style={{ color: "#f59e0b", weight: 3, fillOpacity: 0.06 }} onEachFeature={(f, l) => l.on({ click: () => setSelected(f) })} />}
            {finalMap && <GeoJSON data={finalGIS} style={{ color: "#72d89b", weight: 3, fillOpacity: 0.16 }} onEachFeature={(f, l) => l.on({ click: () => setSelected(f) })} />}
          </MapContainer>
          <div className="map-note">{finalMap ? "Final reviewed map: approved features only." : "Green: preliminary parcels. Blue: building footprints. Orange: road/access evidence. Click a feature to review it."}</div>
        </div>
      </section>
    </main>
  );
}
