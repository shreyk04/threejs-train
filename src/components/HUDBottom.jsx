import { mono } from "../styles/shared";

export function HUDBottom({ fps }) {
  return (
    <div style={{
      position: "fixed", bottom: 0, right: 0, zIndex: 30,
      pointerEvents: "none", padding: "1.4rem 2.2rem",
    }}>
      <div style={{
        fontFamily: mono, fontSize: "0.44rem", letterSpacing: "0.14em",
        color: "rgba(180,205,230,.32)", textAlign: "right", lineHeight: 2,
      }}>
        <div>{fps} fps</div>
        <div>4,800 particles</div>
      </div>
    </div>
  );
}
