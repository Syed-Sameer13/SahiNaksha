import { useEffect, useState } from "react";
import UploadPanel from "./components/UploadPanel";
import Dashboard from "./components/Dashboard";

const HISTORY_KEY = "sahinaksha:analysis-history";

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(items) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    // Browser storage may be unavailable or full.
  }
}

export default function App() {
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(() => readHistory());

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const completeAnalysis = (analysis) => {
    setResult(analysis);
    setHistory((current) => {
      const item = {
        ...analysis,
        saved_at: new Date().toISOString(),
      };
      const withoutDuplicate = current.filter((entry) => entry.analysis_id !== analysis.analysis_id);
      return [item, ...withoutDuplicate].slice(0, 20);
    });
  };

  const openPrevious = (analysis) => {
    setResult(analysis);
  };

  const removePrevious = (analysisId) => {
    setHistory((current) => current.filter((entry) => entry.analysis_id !== analysisId));
  };

  return result ? (
    <Dashboard result={result} onReset={() => setResult(null)} />
  ) : (
    <UploadPanel
      onComplete={completeAnalysis}
      history={history}
      onOpenPrevious={openPrevious}
      onRemovePrevious={removePrevious}
    />
  );
}
