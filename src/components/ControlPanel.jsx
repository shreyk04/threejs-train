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

export function ControlPanel({
  timeVal, rainVal, fogVal, windVal,
  handleTime, handleRain, handleFog, handleWind,
  lightningOn, handleLightning,
  btnTrainText, handleTrain,
  handleHorn,
}) {
  const sliders = [
    { label: "Time of Day", val: timeVal, onChange: handleTime, display: TL[Math.min(3, Math.floor(timeVal / 25))] },
    { label: "Rain",        val: rainVal, onChange: handleRain, display: RL[Math.min(5, Math.floor((rainVal / 100) * 6))] },
    { label: "Fog",         val: fogVal,  onChange: handleFog,  display: FL[Math.min(4, Math.floor(fogVal / 25))] },
    { label: "Wind",        val: windVal, onChange: handleWind, display: Math.round((windVal / 100) * 60) + " km/h" },
  ];

  return (
    <div style={{
      position: "fixed", bottom: "4rem", left: "50%",
      transform: "translateX(-50%)", zIndex: 40,
      background: "rgba(4,10,18,.92)",
      border: "1px solid rgba(100,150,200,.16)",
      backdropFilter: "blur(14px)", borderRadius: 12,
      padding: "1rem 1.4rem",
      display: "flex", gap: "1.2rem",
      alignItems: "flex-end", flexWrap: "wrap", justifyContent: "center",
    }}>
      {sliders.map(({ label, val, onChange, display }, idx) => (
        <>
          {idx === 1 && <Divider key="div1" />}
          <SliderGroup key={label} label={label} val={val} onChange={onChange} display={display} />
        </>
      ))}

      <Divider />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.55rem" }}>
        <button onClick={handleLightning} style={btnStyle(lightningOn)}>⚡ Lightning</button>
        <button onClick={handleTrain}     style={btnStyle(false)}>{btnTrainText}</button>
        <button onClick={handleHorn}      style={btnStyle(false)}>📢 Horn</button>
      </div>
    </div>
  );
}
