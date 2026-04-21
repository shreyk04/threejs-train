import { useRef, useState } from "react";

import "./utils/injectStyles"; // side-effect: fonts + keyframes
import { useClock }      from "./hooks/useClock";
import { useToast }      from "./hooks/useToast";
import { useThreeScene } from "./hooks/useThreeScene";

import { Overlays }         from "./components/Overlays";
import { Loader }           from "./components/Loader";
import { Toast }            from "./components/Toast";
import { AnnouncementBar }  from "./components/AnnouncementBar";
import { HUDTop }           from "./components/HUDTop";
import { HUDBottom }        from "./components/HUDBottom";
import { StatusPanel }      from "./components/StatusPanel";
import { CameraPresets }    from "./components/CameraPresets";
import { ControlPanel }     from "./components/ControlPanel";

import { ANNOUNCEMENTS, CAMS, CLABELS, RL } from "./constants";

export default function LastTrainOut() {
  const mountRef    = useRef(null);
  const rainCanvasRef = useRef(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [timeVal,          setTimeVal]          = useState(80);
  const [rainVal,          setRainVal]           = useState(30);
  const [fogVal,           setFogVal]            = useState(15);
  const [windVal,          setWindVal]           = useState(40);
  const [lightningOn,      setLightningOn]       = useState(true);
  const [activeCam,        setActiveCam]         = useState(0);
  const [annText,          setAnnText]           = useState("");
  const [annVisible,       setAnnVisible]        = useState(false);
  const [trainStatusText,  setTrainStatusText]   = useState("● Train Arriving");
  const [trainStatusColor, setTrainStatusColor]  = useState("rgba(100,220,140,.7)");
  const [doorStatus,       setDoorStatus]        = useState("Doors — Closed");
  const [lamp1Status,      setLamp1Status]       = useState("Lamp A — On");
  const [lamp2Status,      setLamp2Status]       = useState("Lamp B — On");
  const [fps,              setFps]               = useState("—");
  const [loaded,           setLoaded]            = useState(false);
  const [rainLabel,        setRainLabel]         = useState("Rain — Light");
  const [btnTrainText,     setBtnTrainText]      = useState("🚂 Depart");

  const clock             = useClock();
  const { toast, showToast } = useToast();

  // ── Three.js scene (all mutable state lives in S.current) ─────────────────
  const S = useThreeScene(mountRef, rainCanvasRef, {
    setLoaded, setTrainStatusText, setTrainStatusColor,
    setDoorStatus, setLamp1Status, setLamp2Status,
    setFps, setAnnText, setAnnVisible, setBtnTrainText, showToast,
  });

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

  const handleCam = (i) => {
    setActiveCam(i); S.current.ts = { ...CAMS[i] }; showToast(CLABELS[i]);
  };

  const handleTrain = () => {
    const s = S.current;
    if (!s.tState) return;

    if (s.tState === "stopped") {
      const boarding  = s.passengers?.some((p) => ["walkToTrain", "queuing", "boarding"].includes(p.userData.state));
      const alighting = s.alighters?.some((a) => ["waiting", "exiting"].includes(a.userData.state));
      if (boarding || alighting) { showToast("⏳ Awaiting passengers…"); return; }

      s.tState = "departing"; s.tTargX = -90;
      setBtnTrainText("🚂 Arrive"); setTrainStatusText("● Departing"); setTrainStatusColor("rgba(255,160,80,.8)");
      s.playDoorChime();
      setTimeout(() => s.horn(), 600);
      setTimeout(() => s.setEngVol(0.16, 1.5), 1000);
      s.triggerAnn(ANNOUNCEMENTS[5]);
      showToast("Train departing into the night…");
    } else {
      s.tState = "arriving"; s.tTargX = 0;
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#000" }}>
      {/* Three.js canvas */}
      <canvas ref={mountRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%" }} />

      {/* 2-D rain ripples */}
      <canvas ref={rainCanvasRef} style={{ position: "fixed", inset: 0, zIndex: 8, pointerEvents: "none", opacity: 0.5 }} />

      <Overlays />
      <Loader loaded={loaded} />
      <Toast toast={toast} />
      <AnnouncementBar annVisible={annVisible} annText={annText} />

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
        timeVal={timeVal}     rainVal={rainVal}   fogVal={fogVal}     windVal={windVal}
        handleTime={handleTime} handleRain={handleRain} handleFog={handleFog} handleWind={handleWind}
        lightningOn={lightningOn} handleLightning={handleLightning}
        btnTrainText={btnTrainText} handleTrain={handleTrain}
        handleHorn={handleHorn}
      />
      <HUDBottom fps={fps} />
    </div>
  );
}
