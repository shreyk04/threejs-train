import { mono, sliderStyle, btnStyle } from "../styles/shared";
import { TL, RL, FL } from "../constants";

function Divider() {
  return <div style={{ width: 1, height: 55, background: "rgba(100,150,200,.14)", alignSelf: "center" }} />;
}

function SliderGroup({ label, val, onChange, display }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.38rem", minWidth: 90 }}>
      <div style={{
        fontFamily: mono, fontSize: "0.41rem", letterSpacing: "0.22em",
        color: "rgba(180,205,230,.42)", textTransform: "uppercase",
      }}>
        {label}
      </div>
      <input
        type="range" min="0" max="100" value={val}
        onChange={(e) => onChange(+e.target.value)}
        style={sliderStyle}
      />
      <div style={{
        fontFamily: mono, fontSize: "0.52rem",
        color: "rgba(200,220,245,.65)", letterSpacing: "0.12em", textAlign: "center",
      }}>
        {display}
      </div>
    </div>
  );
}

const PRESETS = [
  { label: "☀ Day",     tod: 88, rain: 0,  fog: 0,  wind: 25 },
  { label: "🌅 Sunset", tod: 62, rain: 0,  fog: 10, wind: 22 },
  { label: "🌙 Night",  tod: 2,  rain: 5,  fog: 22, wind: 18 },
  { label: "⛈ Storm",  tod: 12, rain: 85, fog: 62, wind: 82 },
];

const VIEWS = [
  { label: "Platform", idx: 0 },
  { label: "Aerial",   idx: 1 },
];

export function ControlPanel({
  timeVal, rainVal, fogVal, windVal,
  handleTime, handleRain, handleFog, handleWind,
  lightningOn, handleLightning,
  handleHorn,
  playCinematic, cinematicMode,
  autoCycle, handleAutoCycle,
  snowOn, handleSnow,
  activeCam, handleCam,
}) {
  const sliders = [
    { label: "Time of Day", val: timeVal, onChange: handleTime, display: TL[Math.min(3, Math.floor(timeVal / 25))] },
    { label: "Rain",        val: rainVal, onChange: handleRain, display: RL[Math.min(5, Math.floor((rainVal / 100) * 6))] },
    { label: "Fog",         val: fogVal,  onChange: handleFog,  display: FL[Math.min(4, Math.floor(fogVal / 25))] },
    { label: "Wind",        val: windVal, onChange: handleWind, display: Math.round((windVal / 100) * 60) + " km/h" },
  ];

  const presetBase = {
    fontFamily: mono, fontSize: "0.48rem", letterSpacing: "0.1em",
    padding: "3px 10px", borderRadius: 4, cursor: "pointer",
    border: "1px solid rgba(100,150,200,.2)",
    background: "rgba(255,255,255,0.05)", color: "rgba(200,220,245,.7)",
    transition: "all 0.15s", whiteSpace: "nowrap",
  };

  const groupLabel = {
    fontFamily: mono, fontSize: "0.41rem", letterSpacing: "0.22em",
    color: "rgba(180,205,230,.42)", textTransform: "uppercase",
  };

  return (
    <div style={{
      position: "fixed", bottom: 0, left: "1rem", right: "1rem",
      zIndex: 40,
      background: "rgba(4,10,18,.92)",
      border: "1px solid rgba(100,150,200,.16)",
      backdropFilter: "blur(14px)", borderRadius: "12px 12px 0 0",
      padding: "0.45rem 1.2rem 0.55rem",
      display: "flex", gap: "0.9rem",
      alignItems: "flex-end", flexWrap: "nowrap", justifyContent: "space-between",
    }}>
      {/* Scene presets group */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.38rem" }}>
        <div style={groupLabel}>Scene</div>
        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => { handleTime(p.tod); handleRain(p.rain); handleFog(p.fog); handleWind(p.wind); }}
              style={presetBase}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={playCinematic}
            style={{
              ...presetBase,
              background: cinematicMode ? "rgba(255,140,60,0.25)" : "rgba(255,120,30,0.1)",
              border: `1px solid ${cinematicMode ? "rgba(255,140,60,0.6)" : "rgba(255,130,50,0.4)"}`,
              color: cinematicMode ? "rgba(255,185,100,1)" : "rgba(255,165,80,0.85)",
              fontWeight: 600,
            }}
            title="90-second guided tour of all features"
          >
            {cinematicMode ? "⏹ Stop" : "🎬 Cinema"}
          </button>
        </div>
      </div>

      <Divider />

      {sliders.map(({ label, val, onChange, display }) => (
        <SliderGroup key={label} label={label} val={val} onChange={onChange} display={display} />
      ))}

      <Divider />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.38rem" }}>
        <div style={groupLabel}>View</div>
        <div style={{ display: "flex", gap: "0.35rem" }}>
          {VIEWS.map(({ label, idx }) => {
            const active = activeCam === idx;
            return (
              <button
                key={idx}
                onClick={() => handleCam(idx)}
                style={{
                  fontFamily: mono, fontSize: "0.44rem", letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  padding: "5px 12px", borderRadius: 5, cursor: "pointer",
                  border: `1px solid ${active ? "rgba(100,180,240,.5)" : "rgba(100,150,200,.2)"}`,
                  background: active ? "rgba(100,180,240,.18)" : "rgba(255,255,255,0.05)",
                  color: active ? "rgba(210,235,255,.9)" : "rgba(200,220,245,.6)",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <Divider />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.38rem" }}>
        <div style={groupLabel}>Effects</div>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <button onClick={handleLightning}  style={btnStyle(lightningOn)}>⚡ Lightning</button>
          <button onClick={handleAutoCycle}  style={btnStyle(autoCycle)}>🔄 Auto</button>
          <button onClick={handleHorn}       style={btnStyle(false)}>📢 Horn</button>
          <button onClick={handleSnow}       style={btnStyle(snowOn)}>❄ Snow</button>
        </div>
      </div>
    </div>
  );
}
