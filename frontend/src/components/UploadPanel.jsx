import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function UploadPanel({ onComplete }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function choose(f) {
    if (!f) return;
    if (!["image/jpeg", "image/png"].includes(f.type)) {
      setError("Please choose a JPG, JPEG or PNG image.");
      return;
    }
    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function analyze() {
    if (!file) {
      setError("Choose an aerial image before analysis.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
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

  return <main className="app-shell"><section className="hero"><div className="badge">SIH PROTOTYPE</div><h1>Sahi<span>Naksha</span></h1><p>AI-Assisted Urban Parcel Mapping</p><div className="upload-card"><h2>Upload aerial imagery</h2><p>JPG, JPEG or PNG · Generate preliminary GIS features.</p><label className="file-picker"><input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={(e) => choose(e.target.files?.[0])}/><span>{file ? file.name : "Choose Image"}</span></label>{preview && <img className="preview" src={preview} alt="Selected aerial preview"/>}{error && <p className="error">{error}</p>}<button className="primary-button" onClick={analyze} disabled={loading}>{loading ? "Analyzing imagery…" : "Analyze Image"}</button></div></section></main>;
}
