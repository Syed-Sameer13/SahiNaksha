import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function UploadPanel({ onComplete }) {
  const [file, setFile] = useState(null);
  const [reference, setReference] = useState(null);
  const [groundTruth, setGroundTruth] = useState(null);
  const [dsm, setDsm] = useState(null);
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

  function chooseGeoJson(f, setter, label) {
    if (!f) return;
    if (!/\.(json|geojson)$/i.test(f.name)) {
      setError(label + " must be a .json or .geojson file.");
      return;
    }
    setError("");
    setter(f);
  }

  function chooseDsm(f) {
    if (!f) return;
    if (!/\.(jpg|jpeg|png)$/i.test(f.name)) {
      setError("DSM prototype input must currently be an aligned PNG/JPG grayscale raster.");
      return;
    }
    setError("");
    setDsm(f);
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
      if (groundTruth) body.append("ground_truth", groundTruth);
      if (dsm) body.append("dsm", dsm);

      const response = await fetch(API + "/analyze", { method: "POST", body });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { detail: await response.text() };

      if (!response.ok) {
        throw new Error(
          data.detail ||
          data.message ||
          "Backend returned HTTP " + response.status
        );
      }

      onComplete({ ...data, original_image_url: API + data.original_image_url });
    } catch (e) {
      if (e instanceof TypeError && /fetch/i.test(e.message)) {
        setError("Cannot reach the SahiNaksha backend. The server may be waking up or temporarily unavailable. Please wait 30–60 seconds and try again.");
      } else {
        setError(e.message || "Unable to analyze image.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="badge">SAHINAKSHA • AI CADASTRAL ENGINE</div>
        <h1>Sahi<span>Naksha</span></h1>
        <p>AI segmentation • GIS fusion • topology repair • survey validation</p>

        <div className="upload-card">
          <h2>Generate a preliminary cadastral map</h2>
          <p>Minimum input is a high-resolution drone/orthomosaic image. Add GIS, DSM and ground-truth layers to improve and measure the result.</p>

          <label className="file-picker">
            <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={(e) => chooseImage(e.target.files?.[0])}/>
            <span>{file ? file.name : "1. Required — Drone / Orthomosaic Image"}</span>
          </label>

          <label className="file-picker">
            <input type="file" accept=".json,.geojson" onChange={(e) => chooseGeoJson(e.target.files?.[0], setReference, "Existing parcel layer")}/>
            <span>{reference ? reference.name : "2. Recommended — Existing Parcel GIS (.geojson)"}</span>
          </label>

          <label className="file-picker">
            <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={(e) => chooseDsm(e.target.files?.[0])}/>
            <span>{dsm ? dsm.name : "3. Optional — Aligned DSM / Height Raster"}</span>
          </label>

          <label className="file-picker">
            <input type="file" accept=".json,.geojson" onChange={(e) => chooseGeoJson(e.target.files?.[0], setGroundTruth, "Ground truth layer")}/>
            <span>{groundTruth ? groundTruth.name : "4. Optional — Ground Truth for Accuracy Metrics"}</span>
          </label>

          {preview && <img className="preview" src={preview} alt="Selected aerial preview"/>}

          <div className="muted">
            API: {API}
          </div>

          {error && <p className="error">{error}</p>}

          <button className="primary-button" onClick={analyze} disabled={loading}>
            {loading ? "Running AI cadastral pipeline…" : "Generate Preliminary Cadastral Map"}
          </button>
        </div>
      </section>
    </main>
  );
}
