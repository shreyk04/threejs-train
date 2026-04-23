import { useRef, useState, useEffect, useCallback } from "react";

import "./utils/injectStyles";
import { useClock }      from "./hooks/useClock";
import { useToast }      from "./hooks/useToast";
import { useThreeScene } from "./hooks/useThreeScene";
import { mono, serif }   from "./styles/shared";

import { Overlays }        from "./components/Overlays";
import { Loader }          from "./components/Loader";
import { Toast }           from "./components/Toast";
import { AnnouncementBar } from "./components/AnnouncementBar";
import { HUDTop }          from "./components/HUDTop";
import { HUDBottom }       from "./components/HUDBottom";
import { StatusPanel }     from "./components/StatusPanel";
import { CameraPresets }   from "./components/CameraPresets";
import { ControlPanel }    from "./components/ControlPanel";
import { DepartureBoard }  from "./components/DepartureBoard";
import { AIAssistant }     from "./components/AIAssistant";

import { ANNOUNCEMENTS, CAMS, CLABELS, RL } from "./constants";

export default function LastTrainOut() {
  const mountRef     = useRef(null);
  const rainCanvasRef = useRef(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [timeVal,          setTimeVal]          = useState(80);
  const [rainVal,          setRainVal]          = useState(30);
  const [fogVal,           setFogVal]           = useState(15);
  const [windVal,          setWindVal]          = useState(40);
  const [lightningOn,      setLightningOn]      = useState(true);
  const [activeCam,        setActiveCam]        = useState(0);
  const [annText,          setAnnText]          = useState("");
  const [annVisible,       setAnnVisible]       = useState(false);
  const [trainStatusText,  setTrainStatusText]  = useState("● Train Arriving");
  const [trainStatusColor, setTrainStatusColor] = useState("rgba(100,220,140,.7)");
  const [doorStatus,       setDoorStatus]       = useState("Doors — Closed");
  const [lamp1Status,      setLamp1Status]      = useState("Lamp A — On");
  const [lamp2Status,      setLamp2Status]      = useState("Lamp B — On");
  const [fps,              setFps]              = useState("—");
  const [loaded,           setLoaded]           = useState(false);
  const [rainLabel,        setRainLabel]        = useState("Rain — Light");
  const [btnTrainText,     setBtnTrainText]     = useState("🚂 Depart");
  const [boardVisible,     setBoardVisible]     = useState(false);
  const [cinematicMode,    setCinematicMode]    = useState(false);
  const [autoCycle,        setAutoCycle]        = useState(false);
  const [snowOn,           setSnowOn]           = useState(false);
  const [showWelcome,      setShowWelcome]      = useState(false);

  const clock             = useClock();
  const { toast, showToast } = useToast();

  const S = useThreeScene(mountRef, rainCanvasRef, {
    setLoaded, setTrainStatusText, setTrainStatusColor,
    setDoorStatus, setLamp1Status, setLamp2Status,
    setFps, setAnnText, setAnnVisible, setBtnTrainText, showToast,
  });

  // ── Welcome overlay ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    setShowWelcome(true);
    const id = setTimeout(() => setShowWelcome(false), 8000);
    return () => clearTimeout(id);
  }, [loaded]);

  // ── Refs for cinematic (avoids stale closure on lightningOn) ──────────────
  const lightningOnRef   = useRef(lightningOn);
  const cinematicTimers  = useRef([]);
  useEffect(() => { lightningOnRef.current = lightningOn; }, [lightningOn]);

  // ── Control handlers ──────────────────────────────────────────────────────
  const handleTime = (v) => {
    setTimeVal(v); S.current.tod = v / 100;
    if (S.current.updateTOD) S.current.updateTOD(v / 100);
  };

  const handleRain = (v) => {
    setRainVal(v); S.current.rainI = v / 100;
    setRainLabel("Rain — " + RL[Math.min(5, Math.floor((v / 100) * 6))]);
    if (S.current.rain) {
      S.current.rain.rMesh.visible   = v > 2;
      S.current.rain.streaks.visible = v > 2;
    }
  };

  const handleFog = (v) => {
    setFogVal(v);
    if (S.current.scene) S.current.scene.fog.density = 0.003 + (v / 100) * 0.04;
  };

  const handleWind = (v) => { setWindVal(v); S.current.windS = v / 100; };

  const handleLightning = () => {
    const next = !lightningOn; setLightningOn(next); S.current.ltOn = next;
    showToast(next ? "⚡ Lightning On" : "Lightning Off");
  };

  const handleHorn = () => { if (S.current.horn) S.current.horn(); };

  const handleSnow = () => {
    const next = !snowOn;
    setSnowOn(next);
    S.current.snowOn = next;
    if (S.current.snow) S.current.snow.sfMesh.visible = next;
    if (S.current.snowCaps) S.current.snowCaps.forEach((c) => (c.visible = next));
    showToast(next ? "❄ Snow falling across the station…" : "Snow stopped");
  };

  const handleCam = (i) => {
    setActiveCam(i); S.current.ts = { ...CAMS[i] }; showToast(CLABELS[i]);
  };

  const handleAutoCycle = () => {
    const s = S.current;
    const next = !autoCycle;
    setAutoCycle(next);
    s.autoCycle = next;
    if (next) {
      showToast("🔄 Auto cycle on");
      // Kick off cycle from current state
      if (s.tState === "stopped")  s.autoCycleTimer = setTimeout(s.autoDepart, 30000);
      if (s.tState === "idle")     s.autoCycleTimer = setTimeout(s.autoArrive, 5000);
    } else {
      showToast("Auto cycle off");
      clearTimeout(s.autoCycleTimer);
    }
  };

  const handleTrain = () => {
    const s = S.current;
    if (!s.tState) return;
    // Manual override — cancel any pending auto/arrival timers
    clearTimeout(s.autoCycleTimer); clearTimeout(s.pendingAnnTimer);

    if (s.tState === "stopped") {
      const boarding  = s.passengers?.some((p) => ["walkToTrain", "queuing", "boarding"].includes(p.userData.state));
      const alighting = s.alighters?.some((a) => ["waiting", "exiting"].includes(a.userData.state));
      if (boarding || alighting) { showToast("⏳ Awaiting passengers…"); return; }

      s.tState = "departing"; s.tTargX = -90; s.tVel = 0;
      setBtnTrainText("🚂 Arrive"); setTrainStatusText("● Departing"); setTrainStatusColor("rgba(255,160,80,.8)");
      s.playDoorChime();
      setTimeout(() => s.horn(), 600);
      setTimeout(() => s.setEngVol(0.16, 1.5), 1000);
      s.triggerAnn(ANNOUNCEMENTS[5]);
      showToast("Train departing…");
    } else {
      s.tState = "arriving"; s.tTargX = 0; s.tVel = 0;
      s.trainG.position.set(90, 0, -4);
      s.startEngine(); s.setEngVol(0.14, 2); s.resetAlighters();
      s.passengers?.forEach((p) => {
        p.visible = true; p.position.set(p.userData.ox, 0.42, p.userData.oz);
        Object.assign(p.userData, { state: "idle", boardDelay: 0, waitT: 0, boardT: 0 });
      });
      s.doorMeshes.forEach((dm) => (dm.userData.open = false));
      setDoorStatus("Doors — Closed"); setBtnTrainText("🚂 Depart");
      setTrainStatusText("● Train Arriving"); setTrainStatusColor("rgba(100,220,140,.7)");
      showToast("Train arriving at Platform 03…");
    }
  };

  // ── Cinema Mode ───────────────────────────────────────────────────────────
  const stopCinematic = useCallback(() => {
    cinematicTimers.current.forEach((id) => { clearTimeout(id); clearInterval(id); });
    cinematicTimers.current = [];
    setCinematicMode(false);
  }, []);

  const playCinematic = useCallback(() => {
    if (cinematicMode) { stopCinematic(); return; }
    setCinematicMode(true);

    const tmrs = cinematicTimers.current;
    const after = (ms, fn) => { const id = setTimeout(fn, ms); tmrs.push(id); };

    // Smooth interpolation between two values over durMs
    const slide = (setter, from, to, startMs, durMs = 7000) => {
      after(startMs, () => {
        const t0 = Date.now();
        const id = setInterval(() => {
          const p = Math.min(1, (Date.now() - t0) / durMs);
          setter(Math.round(from + (to - from) * p));
          if (p >= 1) clearInterval(id);
        }, 80);
        tmrs.push(id);
      });
    };

    const setLt = (want, delayMs = 0) => after(delayMs, () => {
      if (lightningOnRef.current !== want) handleLightning();
    });

    // ── Act 1: Misty dawn (0–14 s) ──────────────────────────────────────────
    handleTime(10); handleRain(12); handleFog(55); handleWind(18);
    handleCam(0);
    showToast("🎬 Cinema: Dawn at Central Station…");
    slide(handleTime, 10, 30, 500,  12000);
    slide(handleFog,  55, 38, 500,  10000);

    // ── Act 2: Golden hour (14–26 s) ────────────────────────────────────────
    after(14000, () => { handleCam(1); showToast("🌅 Golden hour…"); });
    slide(handleTime, 30, 65, 14000, 11000);
    slide(handleFog,  38,  8, 14000,  9000);
    slide(handleRain, 12,  0, 14000,  7000);

    // ── Act 3: Train arrives (24 s) ──────────────────────────────────────────
    after(24000, () => {
      const s = S.current;
      if (s.tState && s.tState !== "stopped") {
        s.tState = "arriving"; s.tTargX = 0; s.tVel = 0;
        s.trainG?.position.set(90, 0, -4);
        s.startEngine?.(); s.setEngVol?.(0.14, 2); s.resetAlighters?.();
        s.passengers?.forEach((p) => {
          p.visible = true; p.position.set(p.userData.ox, 0.42, p.userData.oz);
          Object.assign(p.userData, { state: "idle", boardDelay: 0, waitT: 0, boardT: 0 });
        });
        s.doorMeshes?.forEach((dm) => (dm.userData.open = false));
        setDoorStatus("Doors — Closed"); setBtnTrainText("🚂 Depart");
        setTrainStatusText("● Train Arriving"); setTrainStatusColor("rgba(100,220,140,.7)");
      }
      showToast("🚂 Train arriving at Platform 03…");
    });

    // ── Act 4: Storm builds (36–52 s) ────────────────────────────────────────
    after(36000, () => { handleCam(3); showToast("⛈ Storm approaching…"); });
    setLt(true, 36000);
    slide(handleTime, 65, 18, 36000, 13000);
    slide(handleRain,  0, 83, 36000, 12000);
    slide(handleFog,   8, 65, 38000, 11000);
    slide(handleWind, 18, 82, 38000,  9000);

    // ── Act 5: Peak storm (52–64 s) ──────────────────────────────────────────
    after(52000, () => { handleCam(0); showToast("⚡ Full storm — all services suspended"); });
    slide(handleTime, 18, 5, 52000, 8000);

    // ── Act 6: Train departs into storm (62 s) ───────────────────────────────
    after(62000, () => {
      const s = S.current;
      if (s.tState === "stopped") {
        s.tState = "departing"; s.tTargX = -90; s.tVel = 0;
        setBtnTrainText("🚂 Arrive");
        setTrainStatusText("● Departing"); setTrainStatusColor("rgba(255,160,80,.8)");
        s.playDoorChime?.();
        setTimeout(() => s.horn?.(), 600);
        setTimeout(() => s.setEngVol?.(0.16, 1.5), 1000);
      }
      showToast("🚂 Last train departing into the storm…");
    });

    // ── Act 7: Storm clears, quiet night (72–86 s) ───────────────────────────
    after(72000, () => { handleCam(3); showToast("🌙 Storm passing…"); });
    setLt(false, 74000);
    slide(handleRain, 83, 8,  72000, 12000);
    slide(handleFog,  65, 18, 74000, 10000);
    slide(handleWind, 82, 22, 74000, 10000);
    slide(handleTime,  5,  2, 76000,  8000);

    // ── End ──────────────────────────────────────────────────────────────────
    after(88000, () => {
      showToast("🎬 Cinema ended — controls restored");
      stopCinematic();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cinematicMode, stopCinematic]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#000" }}>
      <canvas ref={mountRef}      style={{ position: "fixed", inset: 0, width: "100%", height: "100%" }} />
      <canvas ref={rainCanvasRef} style={{ position: "fixed", inset: 0, zIndex: 8, pointerEvents: "none", opacity: 0.5 }} />

      <Overlays />
      <Loader loaded={loaded} />

      {showWelcome && (
        <div
          onClick={() => setShowWelcome(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 55,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.5)", cursor: "pointer",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(4,10,24,0.96)",
              border: "1px solid rgba(100,160,255,0.2)",
              borderRadius: 14, padding: "1.8rem 2.4rem",
              maxWidth: 400, width: "90vw",
              fontFamily: mono, backdropFilter: "blur(24px)",
              cursor: "default",
            }}
          >
            <div style={{
              fontSize: "0.46rem", letterSpacing: "0.3em", textTransform: "uppercase",
              color: "rgba(120,170,255,0.5)", marginBottom: "0.3rem",
            }}>
              Welcome to
            </div>
            <div style={{
              fontFamily: serif, fontSize: "1.6rem",
              color: "rgba(220,235,255,0.92)", marginBottom: "1.4rem",
            }}>
              Last Train Out
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1.3rem" }}>
              {[
                { icon: "🎬", label: "Cinema Demo",      desc: "Hit Cinema in the panel below for a 90-second guided tour of all features" },
                { icon: "⬡",  label: "AI Assistant",     desc: "Use the AI button on the right — describe any change in plain language" },
                { icon: "🖱",  label: "Click to Interact", desc: "Passengers wave back · Lamps toggle · Doors open and close" },
                { icon: "↔",  label: "Explore the Scene", desc: "Drag to orbit · Scroll to zoom · Camera presets on the left" },
              ].map(({ icon, label, desc }) => (
                <div key={label} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "0.9rem", lineHeight: 1, flexShrink: 0, marginTop: "0.1rem" }}>{icon}</span>
                  <div>
                    <div style={{
                      fontSize: "0.44rem", letterSpacing: "0.16em", textTransform: "uppercase",
                      color: "rgba(140,195,255,0.8)", marginBottom: "0.15rem",
                    }}>
                      {label}
                    </div>
                    <div style={{
                      fontSize: "0.48rem", letterSpacing: "0.07em",
                      color: "rgba(165,195,235,0.6)", lineHeight: 1.65,
                    }}>
                      {desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              onClick={() => setShowWelcome(false)}
              style={{
                textAlign: "center", fontSize: "0.38rem", letterSpacing: "0.2em",
                color: "rgba(100,140,200,0.4)", cursor: "pointer",
                paddingTop: "0.8rem", borderTop: "1px solid rgba(100,150,220,0.1)",
                textTransform: "uppercase",
              }}
            >
              Click anywhere to dismiss · Auto-hides in 8 seconds
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
      <AnnouncementBar annVisible={annVisible} annText={annText} />

      <DepartureBoard visible={boardVisible} onToggle={() => setBoardVisible((v) => !v)} />

      <HUDTop clock={clock} rainLabel={rainLabel} />
      <StatusPanel
        trainStatusText={trainStatusText}
        trainStatusColor={trainStatusColor}
        doorStatus={doorStatus}
        lamp1Status={lamp1Status}
        lamp2Status={lamp2Status}
      />
      <CameraPresets activeCam={activeCam} onCamChange={handleCam} />
      <ControlPanel
        timeVal={timeVal}       rainVal={rainVal}     fogVal={fogVal}       windVal={windVal}
        handleTime={handleTime} handleRain={handleRain} handleFog={handleFog} handleWind={handleWind}
        lightningOn={lightningOn} handleLightning={handleLightning}
        btnTrainText={btnTrainText} handleTrain={handleTrain}
        handleHorn={handleHorn}
        playCinematic={playCinematic} cinematicMode={cinematicMode}
        autoCycle={autoCycle} handleAutoCycle={handleAutoCycle}
        snowOn={snowOn} handleSnow={handleSnow}
      />
      <HUDBottom fps={fps} />

      <AIAssistant
        S={S}
        handleTime={handleTime} handleRain={handleRain}
        handleFog={handleFog}   handleWind={handleWind}
        lightningOn={lightningOn} handleLightning={handleLightning}
        handleCam={handleCam}   handleTrain={handleTrain}
        playCinematic={playCinematic} handleSnow={handleSnow}
      />
    </div>
  );
}
