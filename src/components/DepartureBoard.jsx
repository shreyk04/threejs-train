import { useState, useEffect, useRef } from "react";

const MONO = "'Share Tech Mono', 'Courier New', monospace";
const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·: ";

const TRAINS = [
  { dest: "MANCHESTER PIC ", plt: "03", offset: 4  },
  { dest: "LONDON EUSTON  ", plt: "01", offset: 17 },
  { dest: "BIRMINGHAM N.ST", plt: "05", offset: 30 },
  { dest: "EDINBURGH WAV. ", plt: "02", offset: 47 },
  { dest: "BRISTOL T.MEADS", plt: "04", offset: 63 },
];

function pad2(n) { return String(n).padStart(2, "0"); }

function depTime(offsetMins) {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + offsetMins);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function FlipCell({ value, color = "#ffb800" }) {
  const [display, setDisplay] = useState(value);
  const prevRef  = useRef(value);
  const rafRef   = useRef(null);

  useEffect(() => {
    if (prevRef.current === value) return;
    prevRef.current = value;
    cancelAnimationFrame(rafRef.current);

    let frame = 0;
    const frames = 16;
    const len = value.length;

    const tick = () => {
      frame++;
      const p = frame / frames;
      let s = "";
      for (let i = 0; i < len; i++) {
        s += i < len * p
          ? value[i]
          : SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
      }
      setDisplay(s);
      if (frame < frames) rafRef.current = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return (
    <span style={{ color, fontFamily: MONO, display: "inline-block" }}>
      {display}
    </span>
  );
}

const STATUS_COLOR = {
  "BOARDING ": "#00e676",
  "DEPARTING": "#ff9800",
  "ON TIME  ": "#9ab0d0",
  "DELAYED  ": "#ff4545",
  "DEPARTED ": "#2a2a3a",
};

export function DepartureBoard({ visible, onToggle }) {
  const [rows, setRows] = useState(() =>
    TRAINS.map((t) => ({
      ...t,
      time:      depTime(t.offset),
      countdown: t.offset * 60,
      status:    t.offset <= 5 ? "BOARDING " : "ON TIME  ",
    }))
  );
  // live clock in header
  const [hdrTime, setHdrTime] = useState(() =>
    new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );

  useEffect(() => {
    const id = setInterval(() => {
      setHdrTime(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setRows((prev) =>
        prev.map((r) => {
          const cd = Math.max(0, r.countdown - 1);
          let status = r.status;
          if      (cd === 0)   status = "DEPARTED ";
          else if (cd <= 60)   status = "DEPARTING";
          else if (cd <= 240)  status = "BOARDING ";
          else if (r.status !== "DELAYED  " && Math.random() < 0.003) status = "DELAYED  ";
          else if (r.status === "DELAYED  " && Math.random() < 0.002) status = "ON TIME  ";
          else                 status = r.status === "DELAYED  " ? "DELAYED  " : "ON TIME  ";
          return { ...r, countdown: cd, status };
        })
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const cdLabel = (r) => {
    if (r.status === "DEPARTED ") return "— — —";
    if (r.status === "DEPARTING") return "NOW";
    const m = Math.ceil(r.countdown / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  return (
    <>
      {/* Toggle pill */}
      <button
        onClick={onToggle}
        style={{
          position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
          zIndex: 50,
          background: visible ? "rgba(255,184,0,0.13)" : "rgba(4,10,18,0.82)",
          border: `1px solid ${visible ? "rgba(255,184,0,0.55)" : "rgba(255,184,0,0.22)"}`,
          color: "#ffb800",
          fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "0.2em",
          padding: "4px 18px", borderRadius: 3,
          cursor: "pointer", transition: "all 0.2s",
        }}
      >
        ≡ DEPARTURES
      </button>

      {/* Board panel */}
      {visible && (
        <div style={{
          position: "fixed", top: 42, left: "50%", transform: "translateX(-50%)",
          zIndex: 49,
          background: "rgba(3,5,11,0.97)",
          border: "1px solid rgba(255,184,0,0.16)",
          borderRadius: 6,
          padding: "10px 18px 14px",
          minWidth: 520,
          boxShadow: "0 12px 50px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,184,0,0.07)",
          backdropFilter: "blur(24px)",
        }}>
          {/* Header row */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderBottom: "1px solid rgba(255,184,0,0.1)",
            paddingBottom: 7, marginBottom: 8,
            fontFamily: MONO, fontSize: "0.48rem", letterSpacing: "0.22em",
            color: "rgba(255,184,0,0.5)",
          }}>
            <span>▶ CENTRAL STATION — DEPARTURES</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{hdrTime}</span>
          </div>

          {/* Column labels */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "54px 160px 44px 84px 60px",
            gap: 8, marginBottom: 4,
            fontFamily: MONO, fontSize: "0.41rem", letterSpacing: "0.18em",
            color: "rgba(255,184,0,0.25)",
          }}>
            <span>TIME</span><span>DESTINATION</span><span>PLT</span><span>STATUS</span>
            <span style={{ textAlign: "right" }}>ETA</span>
          </div>

          {/* Train rows */}
          {rows.map((r, i) => (
            <div key={i} style={{
              display: "grid",
              gridTemplateColumns: "54px 160px 44px 84px 60px",
              gap: 8, padding: "6px 0",
              borderTop: "1px solid rgba(255,255,255,0.035)",
              fontFamily: MONO, fontSize: "0.62rem",
              opacity: r.status === "DEPARTED " ? 0.28 : 1,
              transition: "opacity 0.6s",
            }}>
              <span style={{ color: "#ffb800", fontVariantNumeric: "tabular-nums" }}>
                {r.time}
              </span>
              <span style={{ color: "#ccd8ee" }}>{r.dest}</span>
              <span style={{ color: "rgba(255,184,0,0.55)" }}>{r.plt}</span>
              <span>
                <FlipCell value={r.status} color={STATUS_COLOR[r.status] ?? "#9ab0d0"} />
              </span>
              <span style={{
                color: r.status === "DEPARTING" ? "#ff9800" : "#505870",
                textAlign: "right", fontSize: "0.58rem",
                fontVariantNumeric: "tabular-nums",
              }}>
                {cdLabel(r)}
              </span>
            </div>
          ))}

          <div style={{
            marginTop: 9, paddingTop: 7,
            borderTop: "1px solid rgba(255,184,0,0.07)",
            fontFamily: MONO, fontSize: "0.4rem", letterSpacing: "0.15em",
            color: "rgba(255,184,0,0.2)", textAlign: "center",
          }}>
            FOR ASSISTANCE PLEASE SPEAK TO STATION STAFF · PLATFORM 03 NORTHBOUND
          </div>
        </div>
      )}
    </>
  );
}
