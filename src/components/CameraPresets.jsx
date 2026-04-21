import { mono } from "../styles/shared";

const LABELS = ["Platform", "Front", "Cockpit", "Aerial"];

export function CameraPresets({ activeCam, onCamChange }) {
  return (
    <div style={{
      position: "fixed", top: "50%", left: "1.4rem",
      transform: "translateY(-50%)", zIndex: 40,
      display: "flex", flexDirection: "column", gap: "0.55rem",
    }}>
      {LABELS.map((label, i) => (
        <button
          key={i}
          onClick={() => onCamChange(i)}
          style={{
            fontFamily: mono, fontSize: "0.42rem", letterSpacing: "0.14em",
            textTransform: "uppercase",
            background: activeCam === i ? "rgba(100,180,240,.18)" : "rgba(6,12,20,.82)",
            border: `1px solid ${activeCam === i ? "rgba(100,180,240,.42)" : "rgba(100,150,200,.18)"}`,
            color: activeCam === i ? "rgba(200,230,255,.85)" : "rgba(180,205,230,.4)",
            padding: "0.38rem 0.7rem", borderRadius: 6, cursor: "pointer", transition: "all .2s",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
