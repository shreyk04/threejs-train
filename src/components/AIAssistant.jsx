import { useState, useRef, useEffect, useCallback } from "react";
import { chatWithOpenAI, hasOpenAIKey } from "../services/openai.js";

const MONO = "'Share Tech Mono', 'Courier New', monospace";
const USE_LLM = hasOpenAIKey();
const HISTORY_LIMIT = 12; // last N user/assistant turns sent to the LLM

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number(n) || 0));

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

const INTRO = `Central Station AI · Online${USE_LLM ? " · LLM" : ""}\n\nI control the entire simulation — weather, lighting, trains & cameras.\n\nTry: "stormy midnight" · "golden hour" · "start cinema demo"`;

// ── Component ────────────────────────────────────────────────────────────────

export function AIAssistant({
  S, handleTime, handleRain, handleFog, handleWind,
  lightningOn, handleLightning, handleCam, handleTrain, playCinematic, handleSnow,
}) {
  const [open,    setOpen]    = useState(false);
  const [msgs,    setMsgs]    = useState([{ role: "ai", text: INTRO }]);
  const [input,   setInput]   = useState("");
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking,  setSpeaking]  = useState(false);
  const [voiceOut,  setVoiceOut]  = useState(true);
  const [voiceSupported] = useState(() =>
    typeof window !== "undefined"
    && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    && "speechSynthesis" in window
  );

  const endRef         = useRef(null);
  const inputRef       = useRef(null);
  const ltRef          = useRef(lightningOn);
  const recognitionRef = useRef(null);
  const ttsVoiceRef    = useRef(null);

  useEffect(() => { ltRef.current = lightningOn; }, [lightningOn]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  // Pick a pleasant English voice for TTS once the voice list is ready.
  useEffect(() => {
    if (!voiceSupported) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const preferred =
        voices.find(v => /en[-_](GB|US)/i.test(v.lang) && /Google|Samantha|Daniel|Karen|Serena/i.test(v.name))
        || voices.find(v => /en[-_](GB|US)/i.test(v.lang))
        || voices.find(v => v.lang?.startsWith("en"))
        || voices[0];
      ttsVoiceRef.current = preferred;
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pick);
  }, [voiceSupported]);

  // Cancel any ongoing speech / mic when the panel closes or component unmounts.
  useEffect(() => {
    if (!open) {
      try { recognitionRef.current?.stop(); } catch {}
      if (voiceSupported) window.speechSynthesis.cancel();
      setListening(false);
      setSpeaking(false);
    }
  }, [open, voiceSupported]);

  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch {}
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback((text) => {
    if (!voiceSupported || !voiceOut || !text) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    // Strip decorative bullets/separators that read awkwardly aloud.
    const clean = text.replace(/[·•]/g, ",").replace(/\s+/g, " ").trim();
    const u = new SpeechSynthesisUtterance(clean);
    if (ttsVoiceRef.current) u.voice = ttsVoiceRef.current;
    u.rate = 1.0;
    u.pitch = 1.0;
    u.volume = 1.0;
    u.onstart = () => setSpeaking(true);
    u.onend   = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.speak(u);
  }, [voiceSupported, voiceOut]);

  const stopSpeaking = useCallback(() => {
    if (!voiceSupported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [voiceSupported]);

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
    if (p.action === "cam2")      handleCam(1);
    if (p.action === "cam3")      handleCam(1);
    if (p.action === "cinematic") playCinematic?.();
    if (p.action === "snow")      handleSnow?.();
  }, [handleTime, handleRain, handleFog, handleWind, handleLightning, handleCam, handleTrain, playCinematic, handleSnow, S]);

  // Maps an OpenAI tool call onto the existing handler set.
  const dispatchTool = useCallback((name, args = {}) => {
    switch (name) {
      case "apply_atmosphere": {
        if (typeof args.time_of_day === "number") handleTime(clamp(args.time_of_day));
        if (typeof args.rain        === "number") handleRain(clamp(args.rain));
        if (typeof args.fog         === "number") handleFog(clamp(args.fog));
        if (typeof args.wind        === "number") handleWind(clamp(args.wind));
        if (typeof args.lightning_on === "boolean" && args.lightning_on !== ltRef.current) handleLightning();
        return;
      }
      case "dispatch_train": handleTrain(); return;
      case "sound_horn":     S.current?.horn?.(); return;
      case "switch_camera": {
        const map = { platform: 0, aerial: 1, side: 1, front: 1 };
        const idx = map[args.view];
        if (idx !== undefined) handleCam(idx);
        return;
      }
      case "play_cinematic": playCinematic?.(); return;
      case "toggle_snow":    handleSnow?.(); return;
      default: return;
    }
  }, [handleTime, handleRain, handleFog, handleWind, handleLightning, handleCam, handleTrain, playCinematic, handleSnow, S]);

  // Local pattern fallback — used when no OpenAI key is configured.
  const replyFromPatterns = (text) => {
    let reply = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
    for (const p of PATTERNS) {
      if (p.test.test(text)) {
        if (!p.answer) execute(p);
        reply = p.answer ?? p.say;
        break;
      }
    }
    return reply;
  };

  const send = async (override) => {
    const text = (typeof override === "string" ? override : input).trim();
    if (!text || thinking) return;
    stopSpeaking();
    setInput("");
    const nextMsgs = [...msgs, { role: "user", text }];
    setMsgs(nextMsgs);
    setThinking(true);

    if (!USE_LLM) {
      // Offline / no-key path: keep the original PATTERNS behaviour.
      setTimeout(() => {
        const reply = replyFromPatterns(text);
        setMsgs((m) => [...m, { role: "ai", text: reply }]);
        setThinking(false);
        speak(reply);
      }, 380 + Math.random() * 320);
      return;
    }

    // LLM path — send recent history and let the model call tools.
    const history = nextMsgs
      .slice(-HISTORY_LIMIT)
      .filter((m) => m.role === "user" || m.role === "ai")
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

    try {
      const { content, toolCalls } = await chatWithOpenAI({ history });
      for (const tc of toolCalls) dispatchTool(tc.name, tc.args);
      const reply = content || (toolCalls.length
        ? "Adjusting station conditions now."
        : "Standing by, Central Station ready.");
      setMsgs((m) => [...m, { role: "ai", text: reply }]);
      speak(reply);
    } catch (err) {
      const fallback = replyFromPatterns(text);
      setMsgs((m) => [...m, {
        role: "ai",
        text: `${fallback}\n\n(LLM unavailable: ${err.message || err})`,
      }]);
      speak(fallback);
    } finally {
      setThinking(false);
    }
  };

  const toggleListening = () => {
    if (!voiceSupported) {
      setMsgs((m) => [...m, { role: "ai", text: "Voice input is not supported in this browser. Try Chrome, Edge or Safari." }]);
      return;
    }
    if (listening) {
      try { recognitionRef.current?.stop(); } catch {}
      setListening(false);
      return;
    }
    stopSpeaking();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let finalText = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (finalText) {
        setInput("");
        send(finalText);
      } else if (interim) {
        setInput(interim);
      }
    };
    rec.onerror = (e) => {
      setListening(false);
      const msg = e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "Microphone access denied. Please grant permission to use voice input."
        : `Voice input error: ${e.error}`;
      setMsgs((m) => [...m, { role: "ai", text: msg }]);
    };
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const toggleVoiceOut = () => {
    setVoiceOut((v) => {
      const next = !v;
      if (!next) stopSpeaking();
      return next;
    });
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating button + label */}
      <div style={{
        position: "fixed", bottom: "13rem", left: "1.6rem", zIndex: 60,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
      }}>
        <button
          onClick={() => setOpen((o) => !o)}
          title="Station AI — describe any change in plain language"
          style={{
            width: open ? 38 : 64, height: open ? 38 : 64, borderRadius: "50%",
            background: open
              ? "radial-gradient(circle at 30% 30%, rgba(120,180,255,0.35), rgba(40,90,200,0.45))"
              : "radial-gradient(circle at 30% 30%, rgba(120,180,255,0.55), rgba(20,50,140,0.92))",
            border: `${open ? 1 : 2}px solid ${open ? "rgba(160,210,255,0.7)" : "rgba(140,200,255,0.75)"}`,
            color: "#ffffff", fontSize: open ? 14 : 26, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.22s",
            boxShadow: open
              ? "0 0 14px rgba(120,180,255,0.35)"
              : "0 0 32px rgba(100,170,255,0.65), 0 0 0 6px rgba(100,170,255,0.10), 0 6px 18px rgba(0,0,0,0.55)",
            animation: open ? "none" : "aiPulse 2.4s ease-in-out infinite",
            textShadow: open ? "none" : "0 0 8px rgba(180,220,255,0.85)",
          }}
        >
          {open ? "✕" : "⬡"}
        </button>
        <div style={{
          fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "0.32em",
          color: open ? "rgba(160,200,255,0.75)" : "#9fcaff",
          textTransform: "uppercase", textAlign: "center", fontWeight: 700,
          textShadow: open ? "none" : "0 0 10px rgba(120,180,255,0.6)",
          transition: "color 0.22s",
        }}>
          {open ? "close" : "AI"}
        </div>
      </div>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: "18rem", left: "1.6rem", zIndex: 59,
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
              background: speaking ? "#7ab8ff" : "#4caf50",
              boxShadow: speaking ? "0 0 8px #7ab8ff" : "0 0 6px #4caf50",
              display: "inline-block", flexShrink: 0,
              animation: speaking ? "aiPulse 1.1s ease-in-out infinite" : "none",
            }} />
            <span style={{ flex: 1 }}>STATION AI · CENTRAL</span>
            {voiceSupported && (
              <button
                onClick={toggleVoiceOut}
                title={voiceOut ? "Mute voice replies" : "Enable voice replies"}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(100,150,220,0.18)",
                  borderRadius: 4, padding: "2px 6px",
                  color: voiceOut ? "rgba(110,175,255,0.85)" : "rgba(110,175,255,0.35)",
                  fontFamily: MONO, fontSize: "0.55rem", cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                {voiceOut ? "♪" : "✕"}
              </button>
            )}
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
            {voiceSupported && (
              <button
                onClick={toggleListening}
                disabled={thinking}
                title={listening ? "Stop listening" : "Speak to the station"}
                style={{
                  background: listening ? "rgba(220,80,80,0.28)" : "rgba(70,120,220,0.18)",
                  border: `1px solid ${listening ? "rgba(255,120,120,0.55)" : "rgba(80,130,220,0.32)"}`,
                  borderRadius: 6,
                  color: listening ? "#ff9a9a" : "#7ab8ff",
                  padding: "6px 9px", cursor: thinking ? "not-allowed" : "pointer",
                  fontFamily: MONO, fontSize: "0.62rem",
                  opacity: thinking ? 0.4 : 1,
                  transition: "all 0.15s",
                  boxShadow: listening ? "0 0 12px rgba(255,120,120,0.4)" : "none",
                  animation: listening ? "aiPulse 1.1s ease-in-out infinite" : "none",
                  lineHeight: 1,
                }}
              >
                {listening ? "■" : "🎙"}
              </button>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={listening ? "Listening…" : "Type or speak a command…"}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${listening ? "rgba(255,120,120,0.35)" : "rgba(100,150,220,0.18)"}`,
                borderRadius: 6, padding: "6px 10px",
                color: "rgba(195,215,245,0.9)",
                fontFamily: MONO, fontSize: "0.54rem",
                outline: "none",
                transition: "border-color 0.15s",
              }}
            />
            <button
              onClick={() => send()}
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
