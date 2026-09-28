import React from "react";
import ReactDOM from "react-dom/client";
import "./globals.css";

function App() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--cu-bg)] text-[var(--cu-text)]">
      <h1 className="text-2xl font-bold">Open ClickUp (Vite)</h1>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
