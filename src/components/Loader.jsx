import { serif, mono } from "../styles/shared";

export function Loader({ loaded }) {
  if (loaded) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999, background: "#030710",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.1rem",
    }}>
      <h2 style={{
        fontFamily: serif, fontStyle: "italic", fontSize: "1.5rem",
        color: "rgba(180,205,230,.6)", letterSpacing: "0.1em",
      }}>
        Last Train Out
      </h2>
      <div style={{ width: 130, height: 1, background: "rgba(180,205,230,.12)" }}>
        <div style={{ height: "100%", width: "80%", background: "rgba(180,205,230,.55)" }} />
      </div>
      <div style={{
        fontFamily: mono, fontSize: "0.44rem", letterSpacing: "0.28em",
        color: "rgba(180,205,230,.28)", textTransform: "uppercase",
      }}>
        Building the scene…
      </div>
    </div>
  );
}
