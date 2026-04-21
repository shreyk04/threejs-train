import { mono, serif } from "../styles/shared";

export function AnnouncementBar({ annVisible, annText }) {
  return (
    <div style={{
      position: "fixed", bottom: "8rem", left: "50%",
      transform: `translateX(-50%) scaleX(${annVisible ? 1 : 0})`,
      zIndex: 50, pointerEvents: "none", textAlign: "center",
      maxWidth: 560, width: "92%",
      transition: "transform 0.4s cubic-bezier(.34,1.56,.64,1), opacity 0.4s ease",
      opacity: annVisible ? 1 : 0,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "0.6rem",
        background: "rgba(4,12,22,0.88)",
        border: "1px solid rgba(100,160,220,0.25)",
        borderRadius: 10, padding: "0.65rem 1.1rem",
        backdropFilter: "blur(10px)",
      }}>
        <div style={{ fontSize: "1rem" }}>📢</div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{
            fontFamily: mono, fontSize: "0.42rem", letterSpacing: "0.28em",
            color: "rgba(150,190,230,.55)", textTransform: "uppercase", marginBottom: "0.2rem",
          }}>
            Platform Announcement
          </div>
          <div style={{
            fontFamily: serif, fontStyle: "italic",
            fontSize: "clamp(0.72rem,1.7vw,0.95rem)",
            color: "rgba(215,232,255,.9)", letterSpacing: "0.03em", lineHeight: 1.55,
          }}>
            {annText}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: 3, background: "rgba(100,180,255,.6)", borderRadius: 2,
                animation: `wave ${0.6 + i * 0.1}s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.08}s`, height: 8,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
