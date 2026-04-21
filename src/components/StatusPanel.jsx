import { mono } from "../styles/shared";

export function StatusPanel({ trainStatusText, trainStatusColor, doorStatus, lamp1Status, lamp2Status }) {
  return (
    <div style={{
      position: "fixed", top: "50%", right: "2rem",
      transform: "translateY(-50%)", zIndex: 30,
      pointerEvents: "none", fontFamily: mono,
      fontSize: "0.46rem", letterSpacing: "0.18em",
      lineHeight: 2.6, textAlign: "right",
    }}>
      <div style={{ color: trainStatusColor }}>{trainStatusText}</div>
      <div style={{ color: "rgba(180,205,230,.35)" }}>{doorStatus}</div>
      <div style={{ color: "rgba(180,205,230,.35)" }}>{lamp1Status}</div>
      <div style={{ color: "rgba(180,205,230,.35)" }}>{lamp2Status}</div>
    </div>
  );
}
