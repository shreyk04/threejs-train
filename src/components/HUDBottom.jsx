import { mono } from "../styles/shared";

export function HUDBottom({ fps }) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
      pointerEvents: "none", display: "flex",
      justifyContent: "space-between", alignItems: "flex-end",
      padding: "1.6rem 2.2rem",
    }}>
      {/* Interaction hints */}
      <div style={{
        fontFamily: mono, fontSize: "0.43rem", letterSpacing: "0.17em",
        color: "rgba(180,205,230,.26)", lineHeight: 2.3, textTransform: "uppercase",
      }}>
        Drag — Orbit · Scroll — Zoom<br />
        Click lamp — Toggle · Click door — Open<br />
        Click passenger — Wave back
      </div>

      {/* Performance stats */}
      <div style={{
        fontFamily: mono, fontSize: "0.44rem", letterSpacing: "0.14em",
        color: "rgba(180,205,230,.26)", textAlign: "right", lineHeight: 2,
      }}>
        <div>{fps} fps</div>
        <div>4,800 particles</div>
      </div>
    </div>
  );
}
