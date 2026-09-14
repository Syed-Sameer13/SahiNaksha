import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function UploadPanel({ onComplete }) {
  const [file, setFile] = useState(null);
  const [reference, setReference] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function chooseImage(f) {
    if (!f) return;
    if (!["image/jpeg", "image/png"].includes(f.type)) {
      setError("Please choose a JPG, JPEG or PNG image.");
      return;
    }
    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function chooseReference(f) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".json") && !f.name.toLowerCase().endsWith(".geojson")) {
      setError("Reference parcel layer must be a .json or .geojson file.");
      return;
    }
    setError("");
    setReference(f);
  }

  async function analyze() {
    if (!file) {
      setError("Choose a drone or orthomosaic image before analysis.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      if (reference) body.append("reference_parcels", reference);

      const response = await fetch(API + "/analyze", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Analysis failed.");
      onComplete({ ...data, original_image_url: API + data.original_image_url });
    } catch (e) {
      setError(e.message || "Unable to analyze image.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="badge">SIH26012 CADASTRAL MVP</div>
        <h1>Sahi<span>Naksha</span></h1>
        <p>AI-Assisted Urban Parcel Mapping and Cadastral Feature Extraction</p>

        <div className="upload-card">
          <h2>Build a preliminary cadastral map</h2>
          <p>Upload the drone/orthomosaic image. For actual parcel-map generation, also upload an existing parcel GeoJSON layer aligned to the image.</p>

          <label className="file-picker">
            <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={(e) => chooseImage(e.target.files?.[0])}/>
            <span>{file ? file.name : "1. Choose Drone / Orthomosaic Image"}</span>
          </label>

          <label className="file-picker">
            <input type="file" accept=".json,.geojson,application/geo+json,application/json" onChange={(e) => chooseReference(e.target.files?.[0])}/>
            <span>{reference ? reference.name : "2. Optional: Existing Parcel Layer (.geojson)"}</span>
          </label>

          {preview && <img className="preview" src={preview} alt="Selected aerial preview"/>}

          <div className="muted">
            Image only = feature evidence. Image + parcel GIS layer = topology-validated preliminary cadastral map with drone-edge refinement.
          </div>

          {error && <p className="error">{error}</p>}

          <button className="primary-button" onClick={analyze} disabled={loading}>
            {loading ? "Generating cadastral map…" : "Generate Preliminary Cadastral Map"}
          </button>
        </div>
      </section>
    </main>
  );
}
