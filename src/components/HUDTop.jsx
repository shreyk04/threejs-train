import { mono, serif } from "../styles/shared";

export function HUDTop({ clock, rainLabel }) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
      pointerEvents: "none", display: "flex",
      justifyContent: "space-between", alignItems: "flex-start",
      padding: "1.8rem 2.2rem",
    }}>
      {/* Title block */}
      <div>
        <div style={{
          fontFamily: mono, fontSize: "0.5rem", letterSpacing: "0.3em",
          color: "rgba(180,205,230,.4)", textTransform: "uppercase", marginBottom: "0.4rem",
        }}>
          React Port · Challenge #023 · Train
        </div>
        <h1 style={{
          fontFamily: serif, fontSize: "clamp(1.4rem,3vw,2.4rem)",
          fontWeight: 400, fontStyle: "italic",
          color: "rgba(200,220,245,.9)", letterSpacing: "0.05em",
        }}>
          Last Train Out
        </h1>
      </div>

      {/* Clock / platform block */}
      <div style={{
        textAlign: "right", fontFamily: mono, fontSize: "0.5rem",
        letterSpacing: "0.18em", color: "rgba(180,205,230,.4)", lineHeight: 2.1,
      }}>
        <div style={{ fontSize: "1.5rem", color: "rgba(200,220,245,.75)", letterSpacing: "0.12em" }}>
          {clock}
        </div>
        <div>Platform 03 · Northbound</div>
        <div>{rainLabel}</div>
      </div>
    </div>
  );
}
