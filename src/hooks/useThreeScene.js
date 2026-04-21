import { useRef, useEffect } from "react";
import { ANNOUNCEMENTS } from "../constants";

/**
 * Initialises the Three.js scene and animation loop.
 *
 * @param {React.RefObject} mountRef      - ref attached to the WebGL <canvas>
 * @param {React.RefObject} rainCanvasRef - ref attached to the 2-D rain <canvas>
 * @param {object}          callbacks     - stable React state-setters / callbacks
 *   { setLoaded, setTrainStatusText, setTrainStatusColor, setDoorStatus,
 *     setLamp1Status, setLamp2Status, setFps, setAnnText, setAnnVisible,
 *     setBtnTrainText, showToast }
 *
 * Returns a ref (S) whose .current holds all mutable scene state and the
 * control functions that React event-handlers call (e.g. S.current.horn()).
 */
export function useThreeScene(mountRef, rainCanvasRef, callbacks) {
  const S = useRef({});

  useEffect(() => {
    if (!mountRef.current || !rainCanvasRef.current) return;
    const s = S.current;

    if (window.THREE) {
      boot();
    } else {
      const scr = document.createElement("script");
      scr.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      scr.onload = boot;
      document.head.appendChild(scr);
    }

    function boot() {
      const {
        setLoaded, setTrainStatusText, setTrainStatusColor,
        setDoorStatus, setLamp1Status, setLamp2Status,
        setFps, setAnnText, setAnnVisible, setBtnTrainText, showToast,
      } = callbacks;

      const THREE = window.THREE;
      const canvas = mountRef.current;

      // ── Renderer ────────────────────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(innerWidth, innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(0x030710, 1);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.55;
      s.renderer = renderer;

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x030710, 0.018);
      const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
      s.scene = scene;
      s.camera = camera;

      // ── Orbit state ─────────────────────────────────────────────────────────
      s.isDrag = false; s.pmx = 0; s.pmy = 0;
      s.sph = { t: 0.85, p: 1.12, r: 30 };
      s.ts  = { t: 0.85, p: 1.12, r: 30 };
      s.tod = 0.8; s.rainI = 0.3; s.windS = 0.2;
      s.l1on = true; s.l2on = true; s.ltOn = true;
      s.nextLt = 4 + Math.random() * 8;
      s.tState = "arriving"; s.tTargX = 0;

      // Mouse / wheel orbit
      const onDown  = (e) => { s.isDrag = true; s.pmx = e.clientX; s.pmy = e.clientY; };
      const onUp    = () => (s.isDrag = false);
      const onMove  = (e) => {
        if (!s.isDrag) return;
        s.ts.t -= (e.clientX - s.pmx) * 0.005;
        s.ts.p  = Math.max(0.22, Math.min(1.55, s.ts.p + (e.clientY - s.pmy) * 0.005));
        s.pmx = e.clientX; s.pmy = e.clientY;
      };
      const onWheel = (e) => (s.ts.r = Math.max(8, Math.min(72, s.ts.r + e.deltaY * 0.05)));
      canvas.addEventListener("mousedown", onDown);
      window.addEventListener("mouseup",   onUp);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("wheel",     onWheel);

      // ── Geometry helpers ─────────────────────────────────────────────────────
      const mkMat = (o) => new THREE.MeshStandardMaterial(o);
      const mkBox = (w, h, d, mat, px = 0, py = 0, pz = 0) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; return m;
      };
      const mkCyl = (rt, rb, h, seg, mat, px = 0, py = 0, pz = 0) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
        m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; return m;
      };
      const mkSph = (r, mat, px = 0, py = 0, pz = 0) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), mat);
        m.position.set(px, py, pz); m.castShadow = true; return m;
      };

      // ── Materials ────────────────────────────────────────────────────────────
      const wetMat      = mkMat({ color: 0x0c1520, roughness: 0.04, metalness: 0.92 });
      const concMat     = mkMat({ color: 0x18202e, roughness: 0.85, metalness: 0.05 });
      const bodyMat     = mkMat({ color: 0x1e4a8a, roughness: 0.35, metalness: 0.65 });
      const bodyMatAcc  = mkMat({ color: 0xd42b2b, roughness: 0.3,  metalness: 0.6  });
      const bodyMatYel  = mkMat({ color: 0xf5c518, roughness: 0.3,  metalness: 0.5  });
      const winMat      = mkMat({ color: 0xffe090, roughness: 0, metalness: 0, emissive: 0xffd060, emissiveIntensity: 0.8, transparent: true, opacity: 0.75 });
      const dkMat       = mkMat({ color: 0x090e14, roughness: 0.5, metalness: 0.85 });
      const railMat     = mkMat({ color: 0x38485a, roughness: 0.3, metalness: 0.9  });
      const lpostMat    = mkMat({ color: 0x18202a, roughness: 0.6, metalness: 0.5  });
      const lglowMat    = mkMat({ color: 0xffc055, emissive: 0xffa018, emissiveIntensity: 1.6, roughness: 0.3 });
      const loffMat     = mkMat({ color: 0x282828, roughness: 0.6 });
      const roofMat     = mkMat({ color: 0x0c1218, roughness: 0.8, metalness: 0.2  });
      const doorMatBase = mkMat({ color: 0x101820, roughness: 0.4, metalness: 0.6  });
      const yelMat      = mkMat({ color: 0xf0c020, emissive: 0xb09000, emissiveIntensity: 0.3 });
      const lensGlowMat = mkMat({ color: 0xd0e8ff, emissive: 0xb0d8ff, emissiveIntensity: 3   });
      s.bodyMat = bodyMat; s.bodyMatAcc = bodyMatAcc; s.bodyMatYel = bodyMatYel;
      s.lglowMat = lglowMat; s.loffMat = loffMat;

      // ── Lights ───────────────────────────────────────────────────────────────
      const ambient = new THREE.AmbientLight(0x080f1c, 0.9); scene.add(ambient);
      const moon = new THREE.DirectionalLight(0x2a4060, 1.1);
      moon.position.set(-15, 20, -10); moon.castShadow = true;
      moon.shadow.mapSize.set(2048, 2048);
      Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 20, bottom: -20, far: 80 });
      scene.add(moon);
      const sun = new THREE.DirectionalLight(0xfff0d0, 0); sun.position.set(20, 30, 10); scene.add(sun);
      const lp1 = new THREE.PointLight(0xffa035, 4, 18, 2); lp1.position.set(-6, 7, 2); lp1.castShadow = true; scene.add(lp1);
      const lp2 = new THREE.PointLight(0xffa035, 4, 18, 2); lp2.position.set(6, 7, 2);  lp2.castShadow = true; scene.add(lp2);
      const tg1 = new THREE.PointLight(0xffe080, 2.5, 10, 2); tg1.position.set(-4, 3, -3); scene.add(tg1);
      const tg2 = new THREE.PointLight(0xffe080, 2.5, 10, 2); tg2.position.set(3, 3, -3);  scene.add(tg2);
      const hLight = new THREE.SpotLight(0xc8e0ff, 8, 50, Math.PI * 0.11, 0.3, 1.5);
      hLight.position.set(-18, 4, -1); hLight.target.position.set(-55, 2, 0);
      scene.add(hLight); scene.add(hLight.target);
      const ltPt = new THREE.PointLight(0xb8d0ff, 0, 100, 1.2); ltPt.position.set(0, 35, -15); scene.add(ltPt);
      s.lights = { ambient, moon, sun, lp1, lp2, tg1, tg2, hLight, ltPt };

      // ── Ground & platform ────────────────────────────────────────────────────
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 50), wetMat);
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true; scene.add(ground);
      scene.add(mkBox(55, 0.4,  8,    concMat, 0, 0.2,  3));
      scene.add(mkBox(55, 0.05, 0.15, yelMat,  0, 0.43, -1.05));

      // ── Rails ────────────────────────────────────────────────────────────────
      scene.add(mkBox(100, 0.12, 0.15, railMat, 0, 0.06, -2.8));
      scene.add(mkBox(100, 0.12, 0.15, railMat, 0, 0.06, -5.2));
      for (let i = -48; i <= 48; i += 2) scene.add(mkBox(0.2, 0.1, 3.2, dkMat, i, 0.05, -4));

      // ── Raycaster / clickables ────────────────────────────────────────────────
      const raycaster  = new THREE.Raycaster();
      const mndc       = new THREE.Vector2();
      const clickables = [];

      // ── Door meshes ──────────────────────────────────────────────────────────
      const doorMeshes = [];
      s.doorMeshes = doorMeshes;

      // ── Carriage builder ─────────────────────────────────────────────────────
      function makeCarriage(ox) {
        const g = new THREE.Group();
        g.add(mkBox(14, 4.5, 3.6, bodyMat, 0, 2.65, 0));
        g.add(mkBox(14, 0.4,  3.7, roofMat, 0, 5.1,  0));
        g.add(mkBox(12, 0.25, 3.5, dkMat,   0, 5.35, 0));
        g.add(mkBox(14, 0.12, 0.07, bodyMatAcc, 0, 3.55, 1.83));
        g.add(mkBox(14, 0.07, 0.06, bodyMatYel, 0, 3.42, 1.83));
        [-4.5, -1.5, 1.5, 4.5].forEach((wx) => {
          g.add(mkBox(2,   1.5, 0.05, winMat, wx, 3.3, 1.85));
          g.add(mkBox(2.2, 1.7, 0.04, dkMat,  wx, 3.3, 1.84));
        });
        const dm = mkBox(1.4, 3.5, 0.06, doorMatBase.clone(), 0, 2.55, 1.83);
        dm.userData = { type: "door", open: false };
        g.add(dm); clickables.push(dm); doorMeshes.push(dm);
        [-4, -3, 3, 4].forEach((wx) => {
          g.add(mkBox(0.2, 0.2, 4.2, dkMat, wx, 0.6, 0));
          [-1.8, 1.8].forEach((wz) => {
            const wh = mkCyl(0.7, 0.7, 0.25, 20, dkMat,   wx, 0.6, wz); wh.rotation.x = Math.PI / 2; g.add(wh);
            const hb = mkCyl(0.3, 0.3, 0.28, 12, railMat, wx, 0.6, wz); hb.rotation.x = Math.PI / 2; g.add(hb);
          });
        });
        g.add(mkBox(13, 0.6, 3.2, dkMat, 0, 0.9, 0));
        g.position.x = ox; return g;
      }

      // ── Train group ──────────────────────────────────────────────────────────
      const trainG = new THREE.Group();
      trainG.add(makeCarriage(-8));
      trainG.add(makeCarriage(8));
      const locoG = new THREE.Group();
      locoG.add(mkBox(8, 5, 3.8, bodyMat, 0, 3, 0));
      const prow = mkBox(3.5, 4, 3.8, bodyMatAcc, -5, 2.8, 0); prow.rotation.y = 0.22; locoG.add(prow);
      locoG.add(mkBox(8, 0.5, 3.9, roofMat, 0, 5.3, 0));
      locoG.add(mkBox(0.8, 0.8, 0.5, dkMat, -6.8, 4, 0));
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), lensGlowMat);
      lens.position.set(-7.3, 4, 0); lens.rotation.y = Math.PI / 2; locoG.add(lens);
      [1.5, -1].forEach((wx) => locoG.add(mkBox(1.8, 1.2, 0.05, winMat, wx, 4.2, 1.92)));
      [-2, 2].forEach((wx) => [-1.8, 1.8].forEach((wz) => {
        const wh = mkCyl(0.8,  0.8,  0.3,  20, dkMat,   wx, 0.8, wz); wh.rotation.x = Math.PI / 2; locoG.add(wh);
        const hb = mkCyl(0.35, 0.35, 0.33, 12, railMat, wx, 0.8, wz); hb.rotation.x = Math.PI / 2; locoG.add(hb);
      }));
      locoG.add(mkCyl(0.2, 0.32, 1.1, 12, dkMat, -3, 6.1, 0));
      locoG.position.x = -22;
      trainG.add(locoG);
      trainG.position.set(70, 0, -4);
      scene.add(trainG);
      s.trainG = trainG;

      // ── Passengers ───────────────────────────────────────────────────────────
      const skinTones  = [0xf5c5a3, 0xe8a87c, 0xd4876a, 0xc26b3a, 0x8d4a2a, 0xfad5b0];
      const coatColors = [0x1a3a6e, 0x8b1a1a, 0x1a5c1a, 0x4a4a8a, 0x5c3a1a, 0x2a2a2a];
      const shirtColors = [0xffffff, 0xd4e8ff, 0xfff0d0, 0xffd0d0, 0xd0ffd4, 0xf0f0f0];
      const hairColors  = [0x1a0a00, 0x3d1c00, 0x0a0a0a, 0x6b3a00, 0xd4a800, 0x4a2000];
      const umbColors   = [0xcc2222, 0x2244cc, 0x229944, 0xcc8800, 0x882299, 0x228899];
      const passengers  = [];
      s.passengers = passengers;

      function buildPerson(px, pz, i) {
        const g = new THREE.Group();
        const sk = mkMat({ color: skinTones[i % 6], roughness: 0.85 });
        const ct = mkMat({ color: coatColors[i % 6], roughness: 0.8, metalness: 0.05 });
        const sh = mkMat({ color: shirtColors[i % 6], roughness: 0.9 });
        const hr = mkMat({ color: hairColors[i % 6], roughness: 0.9 });
        const tr = mkMat({ color: new THREE.Color(coatColors[i % 6]).offsetHSL(0, 0, -0.2), roughness: 0.85 });
        g.add(mkBox(0.52, 1.15, 0.38, ct, 0, 1.4, 0));
        g.add(mkBox(0.28, 0.2,  0.3,  sh, 0, 1.85, 0.05));
        g.add(mkCyl(0.1, 0.1, 0.22, 8, sk, 0, 2.08, 0));
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), sk);
        head.scale.y = 1.15; head.position.set(0, 2.42, 0); head.castShadow = true; g.add(head);
        const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), hr);
        hairM.position.set(0, 2.55, -0.02); hairM.scale.set(1, 0.7, 1); g.add(hairM);
        [-0.08, 0.08].forEach((ex) => {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), mkMat({ color: 0x111111, roughness: 1 }));
          eye.position.set(ex, 2.44, 0.22); g.add(eye);
        });
        g.add(mkBox(0.18, 1.0, 0.2, ct, -0.36, 1.25, 0));
        g.add(mkBox(0.18, 1.0, 0.2, ct,  0.36, 1.25, 0));
        g.add(mkSph(0.1, sk, -0.36, 0.72, 0));
        g.add(mkSph(0.1, sk,  0.36, 0.72, 0));
        g.add(mkBox(0.22, 0.95, 0.3, tr, -0.15, 0.5, 0));
        g.add(mkBox(0.22, 0.95, 0.3, tr,  0.15, 0.5, 0));
        g.add(mkBox(0.22, 0.12, 0.35, dkMat, -0.15, 0.03, 0.04));
        g.add(mkBox(0.22, 0.12, 0.35, dkMat,  0.15, 0.03, 0.04));
        if (i < 4) {
          g.add(mkCyl(0.02, 0.02, 1.3, 6, dkMat, 0.32, 1.85, 0));
          const can = new THREE.Mesh(
            new THREE.ConeGeometry(0.58, 0.28, 12),
            mkMat({ color: umbColors[i % 6], roughness: 0.7, transparent: true, opacity: 0.9 })
          );
          can.position.set(0.32, 2.62, 0); g.add(can);
        } else {
          g.add(mkBox(0.32, 0.28, 0.18,
            mkMat({ color: new THREE.Color().setHSL(i * 0.15, 0.5, 0.25), roughness: 0.7 }),
            -0.38, 1.0, 0));
        }
        g.position.set(px, 0.06, pz);
        g.userData = {
          type: "person", waving: false, wt: 0,
          dir: Math.random() < 0.5 ? 1 : -1, walkT: Math.random() * 3,
          ox: px, oz: pz, spd: 0.5 + Math.random() * 0.4,
          state: "idle", boardDelay: 0, waitT: 0, boardT: 0,
        };
        scene.add(g); passengers.push(g); clickables.push(g);
      }
      [[-8, 5.5], [3, 6], [9, 5], [-2, 6.5], [13, 5.2], [-14, 5.8]].forEach(([px, pz], i) =>
        buildPerson(px, pz, i)
      );

      // ── Alighters ────────────────────────────────────────────────────────────
      const alighters = [];
      s.alighters = alighters;
      const aHues = [0.3, 0.08, 0.62, 0.45, 0.18, 0.8];

      function spawnAlighter(i) {
        const g = new THREE.Group();
        const sk = mkMat({ color: skinTones[(i + 3) % 6], roughness: 0.85 });
        const ct = mkMat({ color: coatColors[(i + 2) % 6], roughness: 0.8 });
        const tr = mkMat({ color: new THREE.Color(coatColors[(i + 2) % 6]).offsetHSL(0, 0, -0.2), roughness: 0.85 });
        const hr = mkMat({ color: hairColors[(i + 1) % 6], roughness: 0.9 });
        g.add(mkBox(0.52, 1.15, 0.38, ct, 0, 1.4, 0));
        g.add(mkCyl(0.1, 0.1, 0.22, 8, sk, 0, 2.08, 0));
        const hd = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), sk);
        hd.scale.y = 1.15; hd.position.set(0, 2.42, 0); g.add(hd);
        const hm = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), hr);
        hm.position.set(0, 2.55, -0.02); hm.scale.set(1, 0.7, 1); g.add(hm);
        g.add(mkBox(0.18, 1.0, 0.2, ct, -0.36, 1.25, 0));
        g.add(mkBox(0.18, 1.0, 0.2, ct,  0.36, 1.25, 0));
        g.add(mkBox(0.22, 0.95, 0.3, tr, -0.15, 0.5, 0));
        g.add(mkBox(0.22, 0.95, 0.3, tr,  0.15, 0.5, 0));
        g.add(mkBox(0.22, 0.12, 0.35, dkMat, -0.15, 0.03, 0.04));
        g.add(mkBox(0.22, 0.12, 0.35, dkMat,  0.15, 0.03, 0.04));
        g.add(mkBox(0.4, 0.36, 0.22,
          mkMat({ color: new THREE.Color().setHSL(aHues[i], 0.55, 0.25), roughness: 0.7 }),
          -0.4, 1.0, 0));
        const sx = (trainG.position.x - 8) + (i % 3 - 1) * 2;
        g.position.set(sx, 0.42, -3.2); g.visible = false;
        g.userData = {
          type: "alighter", startX: sx,
          destX: -12 + i * 5 + Math.random() * 3, destZ: 5 + Math.random() * 2,
          state: "waiting", waitT: i * 1.2, exitT: 0, spd: 0.55 + Math.random() * 0.3,
        };
        scene.add(g); alighters.push(g);
      }
      for (let i = 0; i < 6; i++) spawnAlighter(i);

      s.resetAlighters = () => {
        alighters.forEach((a, i) => {
          a.visible = false; a.userData.state = "waiting"; a.userData.waitT = i * 1.2; a.userData.exitT = 0;
          a.position.set((trainG.position.x - 8) + (i % 3 - 1) * 2, 0.42, -3.2);
        });
      };

      // ── Lamp posts ───────────────────────────────────────────────────────────
      const lb1 = mkSph(0.18, lglowMat.clone(), 0, 0, 0);
      const lb2 = mkSph(0.18, lglowMat.clone(), 0, 0, 0);
      s.lb1 = lb1; s.lb2 = lb2;

      function makeLamp(x, bulb, idx) {
        const g = new THREE.Group();
        g.add(mkCyl(0.08, 0.1, 7, 8, lpostMat, 0, 3.5, 0));
        g.add(mkBox(1.5, 0.08, 0.08, lpostMat, 0.75, 7.1, 0));
        const shade = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.4, 10), lpostMat);
        shade.position.set(1.5, 6.9, 0); shade.rotation.z = Math.PI; g.add(shade);
        bulb.position.set(1.5, 7.12, 0); g.add(bulb);
        g.position.set(x, 0.42, 5.5);
        g.userData = { type: "lamp", idx, on: true };
        scene.add(g); clickables.push(g);
      }
      makeLamp(-6, lb1, 1);
      makeLamp(6,  lb2, 2);

      // ── Platform roof & furniture ─────────────────────────────────────────────
      scene.add(mkBox(22, 0.25, 4.5, roofMat, 0, 7.5, 4.5));
      [-9, 0, 9].forEach((x) => scene.add(mkBox(0.3, 7.5, 0.3, lpostMat, x, 3.75, 2.5)));
      scene.add(mkBox(6,   1.2, 0.1,  mkMat({ color: 0x08121e, roughness: 0.7 }), 0, 6.5, 2.5));
      scene.add(mkBox(5.6, 0.9, 0.12, mkMat({ color: 0x0e2035, emissive: 0x0a2040, emissiveIntensity: 0.5 }), 0, 6.5, 2.57));
      scene.add(mkBox(3, 0.1, 0.7, concMat, 4, 1.15, 5.8));
      [-1, 1].forEach((x) => scene.add(mkBox(0.1, 0.8, 0.1, dkMat, 4 + x * 1.3, 0.8, 5.8)));

      // ── Background buildings ──────────────────────────────────────────────────
      [[-25, 8, 3], [-35, 13, 4], [-30, 6, 3], [20, 11, 5], [28, 7, 4], [38, 16, 6]].forEach(([bx, h, w]) => {
        scene.add(mkBox(w, h, 3, mkMat({ color: 0x060a0e, roughness: 1 }), bx, h / 2, -12));
        if (Math.random() < 0.65)
          scene.add(mkBox(0.6, 0.4, 0.05, mkMat({ color: 0xffe080, emissive: 0xffcc40, emissiveIntensity: 0.6 }), bx, h * 0.6, -11));
      });

      // ── Steam particles ──────────────────────────────────────────────────────
      const SN = 100;
      const stGeo = new THREE.BufferGeometry();
      const stArr = new Float32Array(SN * 3);
      const stData = [];
      for (let i = 0; i < SN; i++) {
        stArr[i * 3] = -22; stArr[i * 3 + 1] = 6 + Math.random() * 3; stArr[i * 3 + 2] = -4;
        stData.push({ life: Math.random(), sp: 0.025 + Math.random() * 0.02, dr: (Math.random() - 0.5) * 0.01 });
      }
      stGeo.setAttribute("position", new THREE.BufferAttribute(stArr, 3));
      const stMesh = new THREE.Points(stGeo, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        vertexShader:   `void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=max(4.,65./-mv.z);gl_Position=projectionMatrix*mv;}`,
        fragmentShader: `void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.62,.68,.76,smoothstep(.5,.1,d)*.18);}`,
      }));
      scene.add(stMesh);

      // ── 3-D rain particles ────────────────────────────────────────────────────
      const RN = 4800;
      const rGeo = new THREE.BufferGeometry();
      const rArr = new Float32Array(RN * 3);
      const rVel = new Float32Array(RN);
      const initDrop = (i) => {
        rArr[i * 3]     = (Math.random() - 0.5) * 100;
        rArr[i * 3 + 1] = Math.random() * 45 + 5;
        rArr[i * 3 + 2] = (Math.random() - 0.5) * 50;
        rVel[i] = 9 + Math.random() * 6;
      };
      for (let i = 0; i < RN; i++) initDrop(i);
      rGeo.setAttribute("position", new THREE.BufferAttribute(rArr, 3));
      const rMesh = new THREE.Points(rGeo, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader:   `void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=1.8;gl_Position=projectionMatrix*mv;}`,
        fragmentShader: `void main(){gl_FragColor=vec4(.52,.7,.9,.28);}`,
      }));
      scene.add(rMesh);

      const SKN = 1000;
      const skGeo = new THREE.BufferGeometry();
      const skArr = new Float32Array(SKN * 6);
      for (let i = 0; i < SKN; i++) {
        const sx = (Math.random() - 0.5) * 80, sy = Math.random() * 38 + 5, sz = (Math.random() - 0.5) * 42;
        skArr[i * 6] = sx; skArr[i * 6 + 1] = sy; skArr[i * 6 + 2] = sz;
        skArr[i * 6 + 3] = sx - 0.12; skArr[i * 6 + 4] = sy - 1.4; skArr[i * 6 + 5] = sz;
      }
      skGeo.setAttribute("position", new THREE.BufferAttribute(skArr, 3));
      const skMat = new THREE.LineBasicMaterial({ color: 0x78acd0, transparent: true, opacity: 0.13 });
      const streaks = new THREE.LineSegments(skGeo, skMat);
      scene.add(streaks);
      s.rain = { rGeo, rArr, rVel, skGeo, skArr, skMat, rMesh, streaks, initDrop };

      // ── 2-D rain canvas ───────────────────────────────────────────────────────
      const rc = rainCanvasRef.current;
      rc.width = innerWidth; rc.height = innerHeight;
      const rctx = rc.getContext("2d");
      const d2d = Array.from({ length: 140 }, () => ({
        x: Math.random() * innerWidth, y: Math.random() * innerHeight,
        r: 0, mr: 3 + Math.random() * 9, sp: 0.35 + Math.random() * 0.65,
        a: 0.5 + Math.random() * 0.5, t: Math.random() * 3,
      }));

      function draw2D(dt, ri) {
        rctx.clearRect(0, 0, rc.width, rc.height);
        if (ri < 0.04) return;
        d2d.forEach((d) => {
          d.t -= dt;
          if (d.t <= 0) {
            d.r = 0; d.x = Math.random() * rc.width;
            d.y = rc.height * 0.52 + Math.random() * rc.height * 0.48;
            d.t = 0.6 + Math.random() * (3 / ri);
          }
          d.r += d.sp; if (d.r > d.mr) d.r = d.mr;
          const a = (1 - d.r / d.mr) * d.a * 0.33 * ri;
          rctx.beginPath(); rctx.ellipse(d.x, d.y, d.r, d.r * 0.38, 0, 0, Math.PI * 2);
          rctx.strokeStyle = `rgba(140,185,215,${a})`; rctx.lineWidth = 0.7; rctx.stroke();
        });
        if (ri > 0.3) {
          for (let i = 0; i < 22; i++) {
            if (Math.random() < 0.025 * ri) {
              const sx = Math.random() * rc.width, sy = Math.random() * rc.height * 0.65;
              const sl = 12 + Math.random() * 55 * ri;
              const gr = rctx.createLinearGradient(sx, sy, sx, sy + sl);
              gr.addColorStop(0, "rgba(150,192,222,0)");
              gr.addColorStop(0.5, `rgba(150,192,222,${0.2 * ri})`);
              gr.addColorStop(1, "rgba(150,192,222,0)");
              rctx.beginPath(); rctx.moveTo(sx, sy); rctx.lineTo(sx - 2, sy + sl);
              rctx.strokeStyle = gr; rctx.lineWidth = 0.8; rctx.stroke();
            }
          }
        }
      }

      // ── Audio ────────────────────────────────────────────────────────────────
      let actx = null;
      const getCtx = () => { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); return actx; };
      let engineGain = null, engineRunning = false, engineNode = null;

      function startEngine() {
        if (engineRunning) return;
        try {
          const ctx = getCtx(); ctx.resume(); engineRunning = true;
          const osc1 = ctx.createOscillator(), osc2 = ctx.createOscillator(), osc3 = ctx.createOscillator();
          osc1.frequency.value = 42; osc1.type = "sawtooth";
          osc2.frequency.value = 58; osc2.type = "square";
          osc3.frequency.value = 18; osc3.type = "sine";
          const nBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
          const nd = nBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
          const noise = ctx.createBufferSource(); noise.buffer = nBuf; noise.loop = true;
          const nFlt = ctx.createBiquadFilter(); nFlt.type = "bandpass"; nFlt.frequency.value = 80; nFlt.Q.value = 0.8;
          const lfo = ctx.createOscillator(); lfo.frequency.value = 3.5; lfo.type = "sine";
          const lfoG = ctx.createGain(); lfoG.gain.value = 15; lfo.connect(lfoG); lfoG.connect(osc1.frequency);
          engineGain = ctx.createGain(); engineGain.gain.value = 0;
          const mFlt = ctx.createBiquadFilter(); mFlt.type = "lowpass"; mFlt.frequency.value = 180;
          osc1.connect(mFlt); osc2.connect(mFlt); osc3.connect(mFlt);
          noise.connect(nFlt); nFlt.connect(mFlt); mFlt.connect(engineGain); engineGain.connect(ctx.destination);
          osc1.start(); osc2.start(); osc3.start(); noise.start(); lfo.start();
          engineNode = { osc1, osc2, osc3, noise, lfo };
        } catch (e) {}
      }

      function setEngVol(vol, t = 0.8) {
        if (!engineGain) return;
        const ctx = getCtx();
        engineGain.gain.cancelScheduledValues(ctx.currentTime);
        engineGain.gain.setValueAtTime(engineGain.gain.value, ctx.currentTime);
        engineGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(0.18, vol)), ctx.currentTime + t);
      }

      function stopEngine() {
        setEngVol(0, 1.5);
        setTimeout(() => {
          if (engineNode) {
            try { engineNode.osc1.stop(); engineNode.osc2.stop(); engineNode.osc3.stop(); engineNode.noise.stop(); engineNode.lfo.stop(); } catch (e) {}
            engineNode = null;
          }
          engineRunning = false;
        }, 2000);
      }

      function playScreech() {
        try {
          const ctx = getCtx(); const osc = ctx.createOscillator(); osc.frequency.value = 1200; osc.type = "sawtooth";
          const gn = ctx.createGain(); gn.gain.setValueAtTime(0, ctx.currentTime); gn.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.3); gn.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.5);
          const flt = ctx.createBiquadFilter(); flt.type = "bandpass"; flt.frequency.value = 900; flt.Q.value = 3;
          osc.connect(flt); flt.connect(gn); gn.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 2.8);
        } catch (e) {}
      }

      function playDoorChime() {
        try {
          const ctx = getCtx();
          [880, 1100, 1320].forEach((f, i) => setTimeout(() => {
            const o = ctx.createOscillator(); o.frequency.value = f; o.type = "sine";
            const g = ctx.createGain(); g.gain.setValueAtTime(0.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
            o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.65);
          }, i * 120));
        } catch (e) {}
      }

      function horn() {
        const ctx = getCtx(); ctx.resume().then(() => {
          try {
            const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
            o1.frequency.value = 220; o2.frequency.value = 278; o1.type = o2.type = "sawtooth";
            const flt = ctx.createBiquadFilter(); flt.type = "bandpass"; flt.frequency.value = 380; flt.Q.value = 2;
            const gn = ctx.createGain();
            gn.gain.setValueAtTime(0, ctx.currentTime);
            gn.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.09);
            gn.gain.setValueAtTime(0.35, ctx.currentTime + 1.1);
            gn.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.4);
            o1.connect(flt); o2.connect(flt); flt.connect(gn); gn.connect(ctx.destination);
            o1.start(); o2.start(); o1.stop(ctx.currentTime + 1.5); o2.stop(ctx.currentTime + 1.5);
            showToast("🚂 Tooot!");
          } catch (e) {}
        });
      }

      function thunder() {
        try {
          const ctx = getCtx();
          const buf = ctx.createBuffer(1, ctx.sampleRate * 2.5, ctx.sampleRate);
          const dat = buf.getChannelData(0);
          for (let i = 0; i < dat.length; i++) {
            const env = Math.exp(-i / (ctx.sampleRate * 0.8));
            dat[i] = (Math.random() * 2 - 1) * env * (1 + Math.sin(i * 0.001) * 0.5);
          }
          const src = ctx.createBufferSource(); src.buffer = buf;
          const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = 200;
          const gn = ctx.createGain(); gn.gain.setValueAtTime(0.4, ctx.currentTime); gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
          src.connect(flt); flt.connect(gn); gn.connect(ctx.destination); src.start();
        } catch (e) {}
      }

      s.horn = horn;
      s.startEngine = startEngine; s.stopEngine = stopEngine; s.setEngVol = setEngVol;
      s.playDoorChime = playDoorChime; s.playScreech = playScreech;

      // ── Lightning ─────────────────────────────────────────────────────────────
      function doLightning() {
        const { ltPt } = s.lights;
        ltPt.intensity = 30 + Math.random() * 20;
        const fl = document.getElementById("lt-flash");
        if (fl) fl.style.opacity = "0.07";
        setTimeout(() => {
          ltPt.intensity = 0; if (fl) fl.style.opacity = "0";
          setTimeout(() => {
            if (Math.random() < 0.45) {
              ltPt.intensity = 12; if (fl) fl.style.opacity = "0.04";
              setTimeout(() => { ltPt.intensity = 0; if (fl) fl.style.opacity = "0"; }, 55);
            }
          }, 125);
        }, 75);
        setTimeout(() => { getCtx().resume().then(thunder); }, 350 + Math.random() * 900);
      }
      s.doLightning = doLightning;

      // ── Announcements ─────────────────────────────────────────────────────────
      let isSpeaking = false; let annIdx = 0;

      function playPADing() {
        try {
          const ctx = getCtx(); ctx.resume();
          [660, 880].forEach((f, i) => setTimeout(() => {
            const o = ctx.createOscillator(); o.frequency.value = f; o.type = "sine";
            const g = ctx.createGain(); g.gain.setValueAtTime(0.1, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
            o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.6);
          }, i * 220));
        } catch (e) {}
      }

      function speakAnnouncement(text) {
        if (!("speechSynthesis" in window)) { playPADing(); return; }
        if (isSpeaking) window.speechSynthesis.cancel();
        isSpeaking = true; playPADing();
        setTimeout(() => {
          const utt = new SpeechSynthesisUtterance(text);
          const voices = window.speechSynthesis.getVoices();
          const pick = voices.find((v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Daniel") || v.name.includes("Karen")))
            || voices.find((v) => v.lang.startsWith("en")) || voices[0];
          if (pick) utt.voice = pick;
          utt.rate = 0.88; utt.pitch = 0.95; utt.volume = 0.85;
          utt.onstart = () => { setAnnText(text); setAnnVisible(true); };
          utt.onend   = () => { isSpeaking = false; setTimeout(() => setAnnVisible(false), 1200); };
          utt.onerror = () => { isSpeaking = false; setAnnVisible(false); };
          window.speechSynthesis.speak(utt);
        }, 700);
      }

      function triggerAnn(specific) {
        const msg = specific || ANNOUNCEMENTS[annIdx % ANNOUNCEMENTS.length];
        if (!specific) annIdx++;
        speakAnnouncement(msg);
      }
      s.triggerAnn = triggerAnn;

      if ("speechSynthesis" in window) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
      }
      const annTimer = setInterval(() => { if (!document.hidden && !isSpeaking) triggerAnn(); }, 40000);

      // ── Time-of-day updater ──────────────────────────────────────────────────
      function updateTOD(tod) {
        const skyL = Math.min(0.02 + tod * 0.88, 0.82);
        const sky = new THREE.Color().setHSL(0.58, tod < 0.5 ? 0.6 : 0.55, skyL);
        renderer.setClearColor(sky, 1); scene.fog.color.copy(sky);
        scene.fog.density = Math.max(0.001, 0.018 * (1 - tod * 0.92));
        sun.intensity = tod * 6.5; sun.color.setHSL(0.12 + tod * 0.02, 0.7, 0.7 + tod * 0.25);
        moon.intensity = Math.max(0, 1.1 - tod * 1.3);
        ambient.color.setHSL(tod > 0.5 ? 0.1 : 0.6, 0.3, 0.1 + tod * 0.9); ambient.intensity = 0.9 + tod * 2.5;
        tg1.intensity = Math.max(0, 2.5 - tod * 8); tg2.intensity = Math.max(0, 2.5 - tod * 8);
        lp1.intensity = Math.max(0, (s.l1on ? 4 : 0) * (1 - tod * 1.2));
        lp2.intensity = Math.max(0, (s.l2on ? 4 : 0) * (1 - tod * 1.2));
        hLight.intensity = Math.max(0, 8 * (1 - tod * 1.5));
        renderer.toneMappingExposure = 0.55 + tod * 1.2;
        if (rainCanvasRef.current) rainCanvasRef.current.style.opacity = String(0.5 - tod * 0.3);
        bodyMat.color.setRGB(0.12 + tod * 0.2, 0.29 + tod * 0.25, 0.53 + tod * 0.18);
        bodyMat.emissive.setRGB(0, 0, 0);
        bodyMatAcc.emissive.setRGB(tod * 0.1, 0, 0);
        bodyMatYel.emissive.setRGB(tod * 0.08, tod * 0.06, 0);
      }
      s.updateTOD = updateTOD;

      // ── Click handler ─────────────────────────────────────────────────────────
      const onClickCanvas = (e) => {
        if (s.isDrag) return;
        mndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
        raycaster.setFromCamera(mndc, camera);
        const hits = raycaster.intersectObjects(scene.children, true);
        if (!hits.length) return;
        let cur = hits[0].object; let found = null;
        while (cur) { if (cur.userData && cur.userData.type) { found = cur; break; } cur = cur.parent; }
        if (!found) return;
        if (found.userData.type === "door") {
          found.userData.open = !found.userData.open;
          setDoorStatus("Doors — " + (found.userData.open ? "Open" : "Closed"));
          showToast(found.userData.open ? "🚪 Doors opening…" : "🚪 Doors closing…");
        } else if (found.userData.type === "lamp") {
          const on = !found.userData.on; found.userData.on = on;
          if (found.userData.idx === 1) {
            s.l1on = on; lp1.intensity = on ? 4 : 0;
            lb1.material = on ? lglowMat : loffMat;
            setLamp1Status("Lamp A — " + (on ? "On" : "Off"));
          } else {
            s.l2on = on; lp2.intensity = on ? 4 : 0;
            lb2.material = on ? lglowMat : loffMat;
            setLamp2Status("Lamp B — " + (on ? "On" : "Off"));
          }
          showToast(on ? "💡 Light on" : "🌑 Light off");
        } else if (found.userData.type === "person") {
          found.userData.waving = true; found.userData.wt = 0; showToast("👋 They wave back!");
        }
      };
      canvas.addEventListener("click", onClickCanvas);

      // ── FPS counter ───────────────────────────────────────────────────────────
      let frC = 0, lastFT = performance.now();
      const calcFPS = (now) => {
        frC++;
        if (now - lastFT > 900) { setFps(Math.round(frC * 1000 / (now - lastFT))); frC = 0; lastFT = now; }
      };

      // ── Main animation loop ───────────────────────────────────────────────────
      let prev = performance.now(), T = 0, animId;

      function animate(now) {
        animId = requestAnimationFrame(animate);
        const dt = Math.min((now - prev) / 1000, 0.042); prev = now; T += dt;
        calcFPS(now);

        // Camera orbit (smoothed)
        s.sph.t += (s.ts.t - s.sph.t) * 0.07;
        s.sph.p += (s.ts.p - s.sph.p) * 0.07;
        s.sph.r += (s.ts.r - s.sph.r) * 0.07;
        camera.position.set(
          s.sph.r * Math.sin(s.sph.p) * Math.sin(s.sph.t),
          s.sph.r * Math.cos(s.sph.p) + 2,
          s.sph.r * Math.sin(s.sph.p) * Math.cos(s.sph.t)
        );
        camera.lookAt(0, 3, 0);

        // Train movement
        if (s.tState === "arriving" || s.tState === "departing") {
          const dx = s.tTargX - trainG.position.x;
          if (Math.abs(dx) < 0.12) {
            trainG.position.x = s.tTargX;
            if (s.tState === "arriving") {
              s.tState = "stopped";
              setTrainStatusText("● Stopped"); setTrainStatusColor("rgba(180,205,230,.5)");
              setBtnTrainText("🚂 Depart"); setEngVol(0.04, 1.5); playScreech();
              setTimeout(() => playDoorChime(), 1800);
              setTimeout(() => triggerAnn(ANNOUNCEMENTS[1]), 2500);
              showToast("Platform 03 — Last train out");
            } else {
              s.tState = "idle";
              setTrainStatusText("○ Platform Empty"); setTrainStatusColor("rgba(180,205,230,.28)");
              setBtnTrainText("🚂 Arrive"); stopEngine();
            }
          } else {
            trainG.position.x += dx * (s.tState === "departing" ? 0.008 : 0.005);
          }
        }
        if (s.tState === "stopped") {
          trainG.rotation.z = Math.sin(T * 0.6) * 0.003;
          trainG.position.y  = Math.sin(T * 0.8) * 0.04;
        }

        // Doors
        doorMeshes.forEach((dm) => {
          const tgt = dm.userData.open ? 1.65 : 0;
          dm.position.x += (tgt - dm.position.x) * 0.08;
        });

        // Alighters
        alighters.forEach((a, ai) => {
          const ud = a.userData;
          if (s.tState !== "stopped" && s.tState !== "departing") { if (s.tState === "arriving") a.visible = false; return; }
          if (ud.state === "waiting") {
            ud.waitT -= dt;
            if (ud.waitT <= 0) {
              a.visible = true;
              a.position.set((trainG.position.x - 8) + (ai % 3 - 1) * 2, 0.42, -2.5);
              ud.state = "exiting"; ud.exitT = 0;
              doorMeshes.forEach((dm) => dm.userData.open = true); setDoorStatus("Doors — Open");
            }
          } else if (ud.state === "exiting") {
            ud.exitT += dt; a.position.z += ud.spd * dt * 0.9; a.position.y = 0.42; a.rotation.y = 0;
            if (a.position.z > 1.8) ud.state = "walking";
          } else if (ud.state === "walking") {
            const dx2 = ud.destX - a.position.x, dz2 = ud.destZ - a.position.z;
            const dist = Math.sqrt(dx2 * dx2 + dz2 * dz2);
            if (dist < 0.4) {
              ud.state = "standing"; a.rotation.y = Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1); a.position.y = 0.42;
            } else {
              a.position.x += dx2 / dist * ud.spd * dt; a.position.z += dz2 / dist * ud.spd * dt;
              a.rotation.y = Math.atan2(dx2, dz2); a.position.y = 0.42 + Math.abs(Math.sin(T * 5 + ud.destX)) * 0.015;
            }
          } else if (ud.state === "standing") {
            a.position.y = 0.42 + Math.sin(T * 0.8 + ai) * 0.008;
            if (s.tState === "departing" || s.tState === "idle") { a.visible = false; ud.state = "done"; }
          }
        });

        // Passengers
        passengers.forEach((p, pi) => {
          const ud = p.userData;
          if (ud.waving) {
            ud.wt += dt; const arm = p.children[2]; if (arm) arm.rotation.z = Math.sin(ud.wt * 8) * 0.6;
            if (ud.wt > 2.5) { ud.waving = false; if (p.children[2]) p.children[2].rotation.z = 0; }
            return;
          }
          if (ud.state === "boarded") {
            if (s.tState === "departing" || s.tState === "idle") { p.visible = true; p.position.set(ud.ox, 0.42, ud.oz); ud.state = "idle"; }
            return;
          }
          if (ud.state === "boarding") {
            ud.boardT += dt; const progress = ud.boardT / 1.4;
            p.position.z -= ud.spd * 1.2 * dt; p.position.y = 0.42; p.rotation.y = Math.PI;
            p.children.forEach((c) => { if (c.material) c.material.opacity = Math.max(0, 1 - progress * 1.2); });
            if (ud.boardT > 1.4) {
              p.children.forEach((c) => { if (c.material) { c.material.transparent = false; c.material.opacity = 1; } });
              p.visible = false; ud.state = "boarded";
            }
            return;
          }
          if (ud.state === "queuing") {
            const doorX = trainG.position.x - 8, doorZ = -2.5;
            const dx2 = doorX - p.position.x, dz2 = doorZ - p.position.z;
            const dist = Math.sqrt(dx2 * dx2 + dz2 * dz2);
            if (dist < 0.3) {
              ud.waitT = (ud.waitT || 0) + dt; p.rotation.y = Math.PI;
              if (ud.waitT > pi * 0.6) {
                ud.state = "boarding"; ud.boardT = 0;
                doorMeshes.forEach((dm) => dm.userData.open = true); setDoorStatus("Doors — Open");
              }
            } else {
              p.position.x += dx2 / dist * ud.spd * dt; p.position.z += dz2 / dist * ud.spd * dt;
              p.rotation.y = Math.atan2(dx2, dz2); p.position.y = 0.42 + Math.abs(Math.sin(T * 6 + pi)) * 0.015;
            }
            return;
          }
          if (ud.state === "walkToTrain") {
            const targetX = ud.ox + (Math.random() - 0.5) * 6, targetZ = 1.5;
            const dx2 = targetX - p.position.x, dz2 = targetZ - p.position.z;
            const dist = Math.sqrt(dx2 * dx2 + dz2 * dz2);
            if (dist < 0.4) { ud.state = "queuing"; ud.waitT = 0; }
            else {
              p.position.x += dx2 / dist * ud.spd * dt; p.position.z += dz2 / dist * ud.spd * dt;
              p.rotation.y = Math.atan2(dx2, dz2); p.position.y = 0.42 + Math.abs(Math.sin(T * 6 + pi)) * 0.015;
            }
            return;
          }
          if (s.tState === "stopped" && ud.state === "idle") {
            ud.boardDelay = (ud.boardDelay || 0) + dt;
            if (ud.boardDelay > pi * 0.8 + 0.5) { ud.state = "walkToTrain"; ud.boardDelay = 0; }
          }
          if (ud.state === "idle") {
            ud.walkT -= dt; if (ud.walkT <= 0) { ud.dir *= -1; ud.walkT = 2 + Math.random() * 3; }
            const nx = p.position.x + ud.dir * ud.spd * dt;
            if (Math.abs(nx - ud.ox) < 4) {
              p.position.x = nx; p.rotation.y = ud.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
              p.position.y = 0.42 + Math.abs(Math.sin(T * 4 + ud.ox)) * 0.03;
            } else { ud.dir *= -1; }
          }
        });

        // Lamp flicker
        const flk = Math.sin(T * 7) * 0.07 + Math.sin(T * 19) * 0.04 + 1;
        const dayDim = Math.max(0, 1 - s.tod * 1.2);
        if (s.l1on) lp1.intensity = 4 * flk * dayDim;
        if (s.l2on) lp2.intensity = 4 * flk * dayDim;

        // Steam
        const sp = stGeo.attributes.position.array;
        for (let i = 0; i < SN; i++) {
          stData[i].life += dt * stData[i].sp * 5;
          sp[i * 3 + 1] += dt * (0.35 + stData[i].life * 0.25);
          sp[i * 3]     += stData[i].dr + s.windS * dt * 0.18;
          if (stData[i].life >= 1 || sp[i * 3 + 1] > 16) {
            const tx = trainG.position.x - 22;
            sp[i * 3] = tx + (Math.random() - 0.5) * 0.8; sp[i * 3 + 1] = 6.2; sp[i * 3 + 2] = -4 + (Math.random() - 0.5) * 0.6;
            stData[i].life = 0; stData[i].dr = (Math.random() - 0.5) * 0.012;
          }
        }
        stGeo.attributes.position.needsUpdate = true;

        // 3-D rain
        const ri = s.rainI;
        if (ri > 0.02) {
          const wind = s.windS * 0.25;
          for (let i = 0; i < RN; i++) {
            rArr[i * 3 + 1] -= rVel[i] * dt * ri; rArr[i * 3] += wind;
            if (rArr[i * 3 + 1] < 0) initDrop(i);
          }
          rGeo.attributes.position.needsUpdate = true;
          for (let i = 0; i < SKN; i++) {
            skArr[i * 6 + 1] -= 17 * dt * ri; skArr[i * 6 + 4] -= 17 * dt * ri;
            skArr[i * 6] += wind * 0.5; skArr[i * 6 + 3] += wind * 0.5;
            if (skArr[i * 6 + 1] < 0) {
              const nx = (Math.random() - 0.5) * 80, ny = 38 + Math.random() * 12, nz = (Math.random() - 0.5) * 45;
              skArr[i * 6] = nx; skArr[i * 6 + 1] = ny; skArr[i * 6 + 2] = nz;
              skArr[i * 6 + 3] = nx - 0.12; skArr[i * 6 + 4] = ny - 1.4; skArr[i * 6 + 5] = nz;
            }
          }
          skGeo.attributes.position.needsUpdate = true; skMat.opacity = 0.04 + ri * 0.14;
        }
        draw2D(dt, ri);

        // Auto-lightning
        if (s.ltOn) { s.nextLt -= dt; if (s.nextLt <= 0) { doLightning(); s.nextLt = 5 + Math.random() * 14; } }

        renderer.render(scene, camera);
      }

      animate(performance.now());

      // Resize handler
      const onResize = () => {
        camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
        if (rainCanvasRef.current) { rainCanvasRef.current.width = innerWidth; rainCanvasRef.current.height = innerHeight; }
      };
      window.addEventListener("resize", onResize);

      // Boot complete
      setTimeout(() => {
        setLoaded(true); updateTOD(0.8); startEngine(); setEngVol(0.14, 2);
        setTimeout(() => triggerAnn(ANNOUNCEMENTS[6]), 3000);
      }, 1400);

      s.cleanup = () => {
        cancelAnimationFrame(animId); clearInterval(annTimer);
        canvas.removeEventListener("click", onClickCanvas);
        canvas.removeEventListener("mousedown", onDown);
        window.removeEventListener("mouseup",   onUp);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("wheel",     onWheel);
        window.removeEventListener("resize",    onResize);
      };
    }

    return () => { if (S.current.cleanup) S.current.cleanup(); };
  }, []); // eslint-disable-line

  return S;
}
