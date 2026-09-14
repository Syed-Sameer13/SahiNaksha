import { useState } from "react";
import UploadPanel from "./components/UploadPanel";
import Dashboard from "./components/Dashboard";
export default function App(){const [result,setResult]=useState(null);return result?<Dashboard result={result} onReset={()=>setResult(null)}/>:<UploadPanel onComplete={setResult}/>;}
