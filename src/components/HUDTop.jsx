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
      <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
        <div>
          <h1 style={{
            fontFamily: serif, fontSize: "clamp(1.4rem,3vw,2.4rem)",
            fontWeight: 400, fontStyle: "italic",
            color: "rgba(200,220,245,.9)", letterSpacing: "0.05em",
          }}>
            Last Train Out
          </h1>
        </div>
        <img
          src="/train.svg"
          alt=""
          aria-hidden="true"
          style={{
            width: "clamp(2.2rem, 4vw, 3rem)",
            height: "clamp(2.2rem, 4vw, 3rem)",
            opacity: 0.85,
            filter: "drop-shadow(0 0 12px rgba(120,170,230,.25))",
          }}
        />
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
