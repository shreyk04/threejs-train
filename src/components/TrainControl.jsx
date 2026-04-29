import { mono } from "../styles/shared";

export function TrainControl({ btnTrainText, handleTrain, trainStatusText, trainStatusColor }) {
  const isDepart = btnTrainText.includes("Depart");

  return (
    <div style={{
      position: "fixed", top: "5.5rem", left: "1.4rem", zIndex: 45,
      display: "flex", flexDirection: "column", gap: "0.45rem", alignItems: "flex-start",
    }}>
      <div style={{
        fontFamily: mono, fontSize: "0.42rem", letterSpacing: "0.22em",
        color: "rgba(180,205,230,.45)", textTransform: "uppercase",
      }}>
        Train Control
      </div>

      <button
        onClick={handleTrain}
        style={{
          fontFamily: mono, fontSize: "0.72rem", letterSpacing: "0.18em",
          textTransform: "uppercase", fontWeight: 600,
          background: isDepart
            ? "linear-gradient(135deg, rgba(255,140,60,0.28), rgba(255,90,40,0.18))"
            : "linear-gradient(135deg, rgba(80,200,140,0.28), rgba(40,170,110,0.18))",
          border: `1.5px solid ${isDepart ? "rgba(255,160,80,0.7)" : "rgba(100,220,160,0.7)"}`,
          color: isDepart ? "rgba(255,200,140,1)" : "rgba(180,255,210,1)",
          padding: "0.85rem 1.5rem",
          borderRadius: 8, cursor: "pointer", transition: "all .2s",
          boxShadow: isDepart
            ? "0 0 18px rgba(255,140,60,0.25), inset 0 1px 0 rgba(255,200,140,0.15)"
            : "0 0 18px rgba(80,200,140,0.25), inset 0 1px 0 rgba(180,255,210,0.15)",
          minWidth: 160,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = isDepart
            ? "0 4px 24px rgba(255,140,60,0.4), inset 0 1px 0 rgba(255,200,140,0.2)"
            : "0 4px 24px rgba(80,200,140,0.4), inset 0 1px 0 rgba(180,255,210,0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = isDepart
            ? "0 0 18px rgba(255,140,60,0.25), inset 0 1px 0 rgba(255,200,140,0.15)"
            : "0 0 18px rgba(80,200,140,0.25), inset 0 1px 0 rgba(180,255,210,0.15)";
        }}
      >
        {btnTrainText}
      </button>

      {trainStatusText && (
        <div style={{
          fontFamily: mono, fontSize: "0.48rem", letterSpacing: "0.14em",
          color: trainStatusColor || "rgba(180,210,240,.65)",
          paddingLeft: "0.2rem",
        }}>
          {trainStatusText}
        </div>
      )}
    </div>
  );
}
