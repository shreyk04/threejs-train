import { useState, useRef, useEffect, useCallback } from "react";

const MONO = "'Share Tech Mono', 'Courier New', monospace";

// ── NLP pattern table ────────────────────────────────────────────────────────
// Each entry: { test: RegExp, apply?: {...}, action?: string, answer?: string, say: string }
// apply keys: tod(0-100), rain(0-100), fog(0-100), wind(0-100), ltOn(bool)
// action: 'train' | 'horn' | 'cam0'–'cam3' | 'cinematic'
// answer: string  →  only reply, no scene change

const PATTERNS = [
  // ── Weather ────────────────────────────────────────────────────
  { test: /storm|thunder|apocalyps/i,
    apply: { tod: 8, rain: 88, fog: 65, wind: 80, ltOn: true },
    say: "Initiating storm sequence. Lightning enabled. All passengers take shelter immediately." },
  { test: /heavy rain|downpour|torrential|pour/i,
    apply: { rain: 82, fog: 35, wind: 58 },
    say: "Heavy rainfall commencing on all platforms. Umbrellas strongly advised." },
  { test: /drizzle|light rain|sprinkl/i,
    apply: { rain: 28, fog: 18 },
    say: "Light drizzle registered. Conditions manageable." },
  { test: /no rain|clear sky|stop rain|sunny|dry/i,
    apply: { rain: 0, fog: 0 },
    say: "Precipitation cleared. All platforms under clear skies." },
  { test: /thick fog|dense fog|pea.?soup/i,
    apply: { fog: 90, rain: 12, wind: 20 },
    say: "Dense fog warning active. Visibility severely reduced. Services may be delayed." },
  { test: /fog/i,
    apply: { fog: 55, rain: 8 },
    say: "Fog advisory issued over Central Station." },
  { test: /wind|gale|breezy/i,
    apply: { wind: 78 },
    say: "Wind speed increased. Hold onto your hat." },

  // ── Time of day ────────────────────────────────────────────────
  { test: /midnight|3 ?am|dead of night/i,
    apply: { tod: 0, rain: 5, fog: 18 },
    say: "Station switching to midnight mode. Last service departs Platform 3 shortly." },
  { test: /dawn|sunrise|early morning|4 ?am|5 ?am/i,
    apply: { tod: 22, fog: 38, rain: 8 },
    say: "Dawn breaking over Central Station. First services of the day approaching." },
  { test: /golden hour|sunset|dusk/i,
    apply: { tod: 62, rain: 0, fog: 10 },
    say: "Golden hour lighting engaged. Beautiful conditions over the platforms." },
  { test: /midday|noon|bright day|full sun/i,
    apply: { tod: 88, rain: 0, fog: 0 },
    say: "Full daylight mode. Skies clear. All 5 platforms fully operational." },
  { test: /night/i,
    apply: { tod: 5, rain: 10, fog: 25 },
    say: "Switching to night operations. Reduced staff on platforms." },

  // ── Mood presets ────────────────────────────────────────────────
  { test: /spooky|ghost|eerie|horror|halloween/i,
    apply: { tod: 5, rain: 42, fog: 88, wind: 55, ltOn: true },
    say: "Atmospheric conditions: deeply unsettling. Visibility poor. You've been warned." },
  { test: /romantic|moody|atmospheric/i,
    apply: { tod: 60, rain: 20, fog: 35, wind: 15 },
    say: "Ambient lighting adjusted. Warm, atmospheric evening conditions." },
  { test: /cosy|cozy|warm evening/i,
    apply: { tod: 55, rain: 8, fog: 18 },
    say: "Warm evening mode engaged. Perfect travelling weather." },
  { test: /disaster|chaos|end of world/i,
    apply: { tod: 3, rain: 100, fog: 90, wind: 95, ltOn: true },
    say: "Emergency protocols engaged. All services suspended. Evacuate the station." },
  { test: /clear|reset scene|normal/i,
    apply: { tod: 80, rain: 0, fog: 5, wind: 30, ltOn: false },
    say: "Conditions reset to standard daytime operations." },

  // ── Train events ────────────────────────────────────────────────
  { test: /depart|leave.*station|train.*go|send.*train|dispatch/i,
    action: "train",
    say: "Departure signal given. Platform 3 — doors closing. Stand clear of the doors." },
  { test: /arriv|bring.*train|train.*come|incoming service/i,
    action: "train",
    say: "Incoming service approaching Platform 3. Stand behind the yellow line, please." },
  { test: /horn|whistle|toot|honk/i,
    action: "horn",
    say: "Horn activated. Attention all passengers on Platform 3." },

  // ── Camera ────────────────────────────────────────────────────
  { test: /platform view|station cam|default cam|platform cam/i,
    action: "cam0",
    say: "Switching to platform surveillance camera." },
  { test: /front.*train|train.*front|cab|cockpit|driver/i,
    action: "cam2",
    say: "Front cab camera. Driver's perspective from Platform 3." },
  { test: /aerial|bird.?s?.?eye|from above|top.*view|overhead/i,
    action: "cam3",
    say: "Aerial surveillance active. Full overview of Central Station." },

  // ── Cinema / demo ────────────────────────────────────────────────
  { test: /cinema|demo|auto.*play|tour|showcase|show me|impress/i,
    action: "cinematic",
    say: "Starting cinematic demonstration. Sit back — this takes about 90 seconds." },

  // ── Snow ─────────────────────────────────────────────────────────
  { test: /snow|blizzard|winter|frost|snowing/i,
    action: "snow",
    say: "Snow falling across Central Station. Tree caps dusted white. Mind the icy platforms." },

  // ── Q&A (no scene change) ─────────────────────────────────────
  { test: /next train|when.*train|train.*time|departure/i,
    answer: "The next departure from Platform 3 is in approximately 4 minutes. Manchester Piccadilly. Check the departures board above for all services." },
  { test: /how many|platform|how.*platform/i,
    answer: "Central Station has 5 active platforms. Platform 3 is our main northbound line, currently serving the Manchester Piccadilly service." },
  { test: /what.*you|who are you|are you (an )?ai/i,
    answer: "I'm the Central Station AI — your intelligent control interface. I manage weather, time of day, trains, cameras, and atmospheric conditions across the entire station simulation." },
  { test: /help|what.*can|how.*work|command/i,
    answer: "Try: \"stormy midnight\" · \"golden hour\" · \"heavy rain\" · \"train depart\" · \"aerial view\" · \"start cinema demo\"\n\nI understand natural language — just describe what you want." },
  { test: /hello|hi there|hey |good (morning|evening|afternoon)/i,
    answer: "Hello. Central Station AI online. Weather, trains, lighting, cameras — I control it all. What would you like to change?" },
  { test: /thank/i,
    answer: "You're welcome. Anything else you'd like to adjust at Central Station?" },
  { test: /cool|wow|amazing|impressive|great|nice/i,
    answer: "Thank you. The simulation uses real-time 3D rendering with dynamic weather, AI-controlled passengers, and full atmospheric lighting. Try the cinema demo for the full experience." },
];

const FALLBACKS = [
  "Command not understood. Try: \"stormy night\", \"golden hour\", \"train depart\", or \"start cinema\".",
  "I didn't catch that. I respond to weather, time, train, and camera commands. Type \"help\" for examples.",
  "Outside my station protocols. Try \"heavy rain\", \"midnight\", \"depart\", or \"aerial view\".",
];

const INTRO = `Central Station AI · Online\n\nI control the entire simulation — weather, lighting, trains & cameras.\n\nTry: "stormy midnight" · "golden hour" · "start cinema demo"`;

// ── Component ────────────────────────────────────────────────────────────────

export function AIAssistant({
  S, handleTime, handleRain, handleFog, handleWind,
  lightningOn, handleLightning, handleCam, handleTrain, playCinematic, handleSnow,
}) {
  const [open,    setOpen]    = useState(false);
  const [msgs,    setMsgs]    = useState([{ role: "ai", text: INTRO }]);
  const [input,   setInput]   = useState("");
  const [thinking, setThinking] = useState(false);

  const endRef   = useRef(null);
  const inputRef = useRef(null);
  const ltRef    = useRef(lightningOn);

  useEffect(() => { ltRef.current = lightningOn; }, [lightningOn]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  const execute = useCallback((p) => {
    if (p.apply) {
      const a = p.apply;
      if (a.tod  !== undefined) handleTime(a.tod);
      if (a.rain !== undefined) handleRain(a.rain);
      if (a.fog  !== undefined) handleFog(a.fog);
      if (a.wind !== undefined) handleWind(a.wind);
      if (a.ltOn !== undefined && a.ltOn !== ltRef.current) handleLightning();
    }
    if (p.action === "train")     handleTrain();
    if (p.action === "horn")      S.current?.horn?.();
    if (p.action === "cam0")      handleCam(0);
    if (p.action === "cam1")      handleCam(1);
    if (p.action === "cam2")      handleCam(2);
    if (p.action === "cam3")      handleCam(3);
    if (p.action === "cinematic") playCinematic?.();
    if (p.action === "snow")      handleSnow?.();
  }, [handleTime, handleRain, handleFog, handleWind, handleLightning, handleCam, handleTrain, playCinematic, handleSnow, S]);

  const send = () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text }]);
    setThinking(true);

    // Simulate AI thinking delay
    setTimeout(() => {
      let reply = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
      for (const p of PATTERNS) {
        if (p.test.test(text)) {
          if (!p.answer) execute(p);
          reply = p.answer ?? p.say;
          break;
        }
      }
      setMsgs((m) => [...m, { role: "ai", text: reply }]);
      setThinking(false);
    }, 480 + Math.random() * 380);
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating button + label */}
      <div style={{
        position: "fixed", bottom: "13rem", right: "1.6rem", zIndex: 60,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
      }}>
        <button
          onClick={() => setOpen((o) => !o)}
          title="Station AI — describe any change in plain language"
          style={{
            width: 46, height: 46, borderRadius: "50%",
            background: open ? "rgba(80,140,255,0.2)" : "rgba(4,10,24,0.88)",
            border: `2px solid ${open ? "rgba(100,170,255,0.65)" : "rgba(100,150,200,0.38)"}`,
            color: "#7ab8ff", fontSize: 20, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.22s",
            boxShadow: open ? "0 0 22px rgba(100,170,255,0.22)" : "0 0 12px rgba(80,140,255,0.15)",
            animation: open ? "none" : "aiPulse 2.8s ease-in-out infinite",
          }}
        >
          {open ? "✕" : "⬡"}
        </button>
        <div style={{
          fontFamily: MONO, fontSize: "0.38rem", letterSpacing: "0.2em",
          color: open ? "rgba(100,160,255,0.45)" : "rgba(100,160,255,0.65)",
          textTransform: "uppercase", textAlign: "center",
          transition: "color 0.22s",
        }}>
          {open ? "close" : "AI"}
        </div>
      </div>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: "17.2rem", right: "1.6rem", zIndex: 59,
          width: 320, height: 390,
          background: "rgba(3,7,17,0.97)",
          border: "1px solid rgba(100,150,220,0.2)",
          borderRadius: 10,
          display: "flex", flexDirection: "column",
          boxShadow: "0 10px 50px rgba(0,0,0,0.75)",
          backdropFilter: "blur(24px)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "9px 14px 8px",
            borderBottom: "1px solid rgba(100,150,220,0.1)",
            fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.18em",
            color: "rgba(110,175,255,0.65)",
            display: "flex", alignItems: "center", gap: 8,
            flexShrink: 0,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#4caf50", boxShadow: "0 0 6px #4caf50",
              display: "inline-block", flexShrink: 0,
            }} />
            STATION AI · CENTRAL
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "10px 12px",
            display: "flex", flexDirection: "column", gap: 8,
            scrollbarWidth: "none",
          }}>
            {msgs.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "90%",
                background: m.role === "user"
                  ? "rgba(70,120,220,0.17)"
                  : "rgba(255,255,255,0.045)",
                border: `1px solid ${m.role === "user"
                  ? "rgba(80,130,220,0.22)"
                  : "rgba(255,255,255,0.055)"}`,
                borderRadius: m.role === "user"
                  ? "10px 10px 2px 10px"
                  : "10px 10px 10px 2px",
                padding: "7px 11px",
                fontFamily: MONO, fontSize: "0.56rem", lineHeight: 1.6,
                color: m.role === "user"
                  ? "rgba(170,205,255,0.9)"
                  : "rgba(195,215,245,0.85)",
                whiteSpace: "pre-wrap",
              }}>
                {m.text}
              </div>
            ))}

            {thinking && (
              <div style={{
                alignSelf: "flex-start",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: "10px 10px 10px 2px",
                padding: "8px 16px",
                fontFamily: MONO, fontSize: "0.56rem",
                color: "rgba(110,160,220,0.55)",
                letterSpacing: "0.3em",
              }}>
                · · ·
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Suggestion chips */}
          <div style={{
            padding: "4px 10px",
            display: "flex", gap: 5, flexWrap: "wrap",
            borderTop: "1px solid rgba(100,150,220,0.08)",
            flexShrink: 0,
          }}>
            {["stormy night", "golden hour", "cinema demo", "aerial view"].map((chip) => (
              <button
                key={chip}
                onClick={() => { setInput(chip); setTimeout(() => inputRef.current?.focus(), 50); }}
                style={{
                  background: "rgba(80,130,220,0.1)",
                  border: "1px solid rgba(80,130,220,0.2)",
                  borderRadius: 12, color: "rgba(140,185,255,0.7)",
                  fontFamily: MONO, fontSize: "0.44rem", letterSpacing: "0.1em",
                  padding: "3px 8px", cursor: "pointer",
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div style={{
            padding: "8px 10px",
            borderTop: "1px solid rgba(100,150,220,0.08)",
            display: "flex", gap: 6, flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Type a command or question…"
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(100,150,220,0.18)",
                borderRadius: 6, padding: "6px 10px",
                color: "rgba(195,215,245,0.9)",
                fontFamily: MONO, fontSize: "0.54rem",
                outline: "none",
              }}
            />
            <button
              onClick={send}
              disabled={thinking || !input.trim()}
              style={{
                background: "rgba(70,120,220,0.22)",
                border: "1px solid rgba(80,130,220,0.38)",
                borderRadius: 6, color: "#7ab8ff",
                padding: "6px 11px", cursor: "pointer",
                fontFamily: MONO, fontSize: "0.54rem",
                opacity: (thinking || !input.trim()) ? 0.38 : 1,
                transition: "opacity 0.15s",
              }}
            >
              ↵
            </button>
          </div>
        </div>
      )}
    </>
  );
}
