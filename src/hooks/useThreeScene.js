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
      scene.fog = new THREE.FogExp2(0x030710, 0.023);
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
      s.tState = "arriving"; s.tTargX = 0; s.tVel = 0;
      s.autoCycle = false; s.autoCycleTimer = null; s.pendingAnnTimer = null;

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
      const wetMat      = mkMat({ color: 0x0a1018, roughness: 0.28, metalness: 0.55 });
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
      s.lglowMat = lglowMat; s.loffMat = loffMat; s.winMat = winMat;

      // ── Train body panel texture ─────────────────────────────────────────────
      // Adds horizontal seam lines + rivet dots so the carriage reads as sheet metal
      (function buildTrainTex() {
        const cv = document.createElement("canvas"); cv.width = 256; cv.height = 128;
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#1e4a8a"; ctx.fillRect(0, 0, 256, 128);
        // Horizontal panel seams
        for (let y = 0; y < 128; y += 20) {
          const gr = ctx.createLinearGradient(0, y, 0, y + 20);
          gr.addColorStop(0,   "rgba(255,255,255,0.09)");
          gr.addColorStop(0.35,"rgba(255,255,255,0.03)");
          gr.addColorStop(1,   "rgba(0,0,0,0.05)");
          ctx.fillStyle = gr; ctx.fillRect(0, y, 256, 20);
          ctx.strokeStyle = "rgba(6,16,48,0.55)";
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
        }
        // Vertical dividers
        ctx.strokeStyle = "rgba(6,16,48,0.28)"; ctx.lineWidth = 1;
        for (let x = 0; x < 256; x += 64) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke();
        }
        // Rivet dots
        ctx.fillStyle = "rgba(5,14,40,0.55)";
        for (let x = 32; x < 256; x += 64) {
          for (let y = 10; y < 128; y += 20) {
            ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
          }
        }
        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 1);
        bodyMat.map = tex; bodyMat.needsUpdate = true;
      })();

      // ── Platform tile texture ────────────────────────────────────────────────
      // Grey stone tiles with grout lines give the platform a realistic surface
      (function buildPlatformTex() {
        const cv = document.createElement("canvas"); cv.width = 256; cv.height = 128;
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#090d14"; ctx.fillRect(0, 0, 256, 128);
        const tW = 34, tH = 26;
        for (let row = 0; row < Math.ceil(128 / tH) + 1; row++) {
          for (let col = 0; col < Math.ceil(256 / tW) + 1; col++) {
            const v = Math.floor(Math.random() * 8);
            const tx = col * tW + (row % 2 === 0 ? 0 : tW * 0.5);
            const ty = row * tH;
            ctx.fillStyle = `rgb(${20 + v},${29 + v},${44 + v})`;
            ctx.fillRect(tx + 1, ty + 1, tW - 2, tH - 2);
          }
        }
        ctx.strokeStyle = "rgba(0,0,0,0.65)"; ctx.lineWidth = 1.5;
        for (let x = 0; x < 256 + tW; x += tW) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke();
        }
        for (let y = 0; y < 128 + tH; y += tH) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
        }
        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 2);
        concMat.map = tex; concMat.needsUpdate = true;
      })();

      // ── Lights ───────────────────────────────────────────────────────────────
      // Low ambient — this is the #1 thing that kills realism if too high
      const ambient = new THREE.AmbientLight(0x060c18, 0.35); scene.add(ambient);

      // Hemisphere light: sky colour from above, ground bounce from below
      const hemi = new THREE.HemisphereLight(0x1a2d50, 0x080c10, 0.55); scene.add(hemi);

      const moon = new THREE.DirectionalLight(0x2a4060, 1.1);
      moon.position.set(-15, 20, -10); moon.castShadow = true;
      moon.shadow.mapSize.set(2048, 2048);
      moon.shadow.bias = -0.001;
      Object.assign(moon.shadow.camera, { left: -40, right: 40, top: 30, bottom: -20, far: 100 });
      scene.add(moon);
      const sun = new THREE.DirectionalLight(0xfff4e0, 0); sun.position.set(20, 30, 10);
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.bias = -0.001;
      Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 30, bottom: -20, far: 100 });
      scene.add(sun);
      const lp1 = new THREE.PointLight(0xffa035, 4, 18, 2); lp1.position.set(-6, 7, 2); lp1.castShadow = true; scene.add(lp1);
      const lp2 = new THREE.PointLight(0xffa035, 4, 18, 2); lp2.position.set(6, 7, 2);  lp2.castShadow = true; scene.add(lp2);
      const tg1 = new THREE.PointLight(0xffe080, 2.5, 10, 2); tg1.position.set(-4, 3, -3); scene.add(tg1);
      const tg2 = new THREE.PointLight(0xffe080, 2.5, 10, 2); tg2.position.set(3, 3, -3);  scene.add(tg2);
      const hLight = new THREE.SpotLight(0xc8e0ff, 8, 50, Math.PI * 0.11, 0.3, 1.5);
      hLight.position.set(-18, 4, -1); hLight.target.position.set(-55, 2, 0);
      scene.add(hLight); scene.add(hLight.target);
      const ltPt = new THREE.PointLight(0xb8d0ff, 0, 100, 1.2); ltPt.position.set(0, 35, -15); scene.add(ltPt);
      s.lights = { ambient, hemi, moon, sun, lp1, lp2, tg1, tg2, hLight, ltPt };

      // ── Sky sphere (gradient shader, changes with TOD) ────────────────────────
      const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          uTop:    { value: new THREE.Color(0x010308) },
          uMid:    { value: new THREE.Color(0x0a1828) },
          uHorizon:{ value: new THREE.Color(0x0d1e30) },
        },
        vertexShader: `
          varying vec3 vPos;
          void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
          uniform vec3 uTop, uMid, uHorizon;
          varying vec3 vPos;
          void main(){
            float h = normalize(vPos).y;
            vec3 col = h > 0.12
              ? mix(uMid, uTop, pow((h - 0.12) / 0.88, 0.45))
              : mix(uHorizon, uMid, (h + 1.0) / 1.12);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      });
      const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(185, 32, 16), skyMat);
      scene.add(skyMesh);
      s.skyMat = skyMat;

      // ── Stars ─────────────────────────────────────────────────────────────────
      const STAR_COUNT = 1800;
      const starPos = new Float32Array(STAR_COUNT * 3);
      for (let i = 0; i < STAR_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(Math.random());
        const r     = 155 + Math.random() * 18;
        starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 4;
        starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.55, transparent: true, opacity: 0.88, sizeAttenuation: false });
      const starMesh = new THREE.Points(starGeo, starMat);
      scene.add(starMesh);
      s.starMat = starMat;

      // ── Moon ──────────────────────────────────────────────────────────────────
      const moonObj = new THREE.Mesh(
        new THREE.SphereGeometry(3.5, 16, 12),
        mkMat({ color: 0xeeeedd, emissive: 0xddddcc, emissiveIntensity: 0.55, roughness: 0.92 })
      );
      moonObj.position.set(-62, 72, -88);
      scene.add(moonObj);
      s.moonObj = moonObj;

      // ── Ground & platform ────────────────────────────────────────────────────
      // Canvas texture: wet asphalt with puddles
      (function buildGroundTexture() {
        const c = document.createElement("canvas"); c.width = 512; c.height = 512;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#07101a"; ctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 9000; i++) {
          const x = Math.random() * 512, y = Math.random() * 512;
          const v = Math.floor(Math.random() * 24);
          ctx.fillStyle = `rgba(${v},${v + 3},${v + 7},0.55)`;
          ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
        }
        for (let i = 0; i < 12; i++) {
          const px = Math.random() * 512, py = Math.random() * 512;
          const rx = 18 + Math.random() * 55, ry = 7 + Math.random() * 22;
          const gr = ctx.createRadialGradient(px, py, 0, px, py, rx);
          gr.addColorStop(0, "rgba(45,75,110,0.42)"); gr.addColorStop(1, "rgba(0,0,0,0)");
          ctx.beginPath(); ctx.ellipse(px, py, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
          ctx.fillStyle = gr; ctx.fill();
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(5, 2);
        wetMat.map = tex; wetMat.needsUpdate = true;
      })();

      const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 80), wetMat);
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

      // ── Gangway connectors (accordion bellows, fill gaps between sections) ────
      // Carriage A spans trainG x: -15 → -1  (center -8, width 14)
      // Carriage B spans trainG x: +1 → +15  (center +8, width 14)
      // Loco body spans trainG x: -26 → -18  (center -22, width 8)
      // Gap A↔B = 2 units at cx=0 ; Gap Loco↔A = 3 units at cx=-16.5
      const bellowsMat = mkMat({ color: 0x07101a, roughness: 0.97 });
      function makeGangway(cx, gw) {
        const g = new THREE.Group();
        // Solid dark base filling the gap
        g.add(mkBox(gw, 4.05, 3.22, bellowsMat, 0, 2.55, 0));
        // 5 accordion rings — slightly bulge at the midpoint for the bellows look
        for (let i = 0; i < 5; i++) {
          const lx  = -gw / 2 + (i + 0.5) * (gw / 5);
          const b   = 1 + 0.055 * Math.sin((i / 4) * Math.PI); // peak at ring 2
          g.add(mkBox(
            gw / 5 * 0.58, 4.08 * b, 3.26 * b,
            mkMat({ color: 0x0a1522, roughness: 0.98 }),
            lx, 2.55, 0,
          ));
        }
        // Thin end-frame flanges where gangway meets carriage body
        g.add(mkBox(0.18, 4.1, 3.28, mkMat({ color: 0x111e2c, roughness: 0.85, metalness: 0.45 }),  gw / 2,      2.55, 0));
        g.add(mkBox(0.18, 4.1, 3.28, mkMat({ color: 0x111e2c, roughness: 0.85, metalness: 0.45 }), -gw / 2,      2.55, 0));
        g.position.x = cx;
        trainG.add(g);
      }
      makeGangway(0,     2.2);   // between carriage A and carriage B
      makeGangway(-16.5, 3.3);   // between locomotive and carriage A

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
          ox: px, oz: pz, spd: 1.7 + Math.random() * 1.1,
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
          state: "waiting", waitT: i * 1.2, exitT: 0, spd: 1.9 + Math.random() * 0.9,
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

      // ── Lamp glow halos (billboard sprites, AdditiveBlending) ─────────────────
      function makeGlowTex(rv, gv, bv) {
        const cv = document.createElement("canvas"); cv.width = cv.height = 128;
        const ctx = cv.getContext("2d");
        const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0,    `rgba(${rv},${gv},${bv},1)`);
        gr.addColorStop(0.18, `rgba(${rv},${gv},${bv},0.52)`);
        gr.addColorStop(0.45, `rgba(${rv},${gv},${bv},0.14)`);
        gr.addColorStop(1,    "rgba(0,0,0,0)");
        ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(cv);
      }
      const glowTex = makeGlowTex(255, 160, 40);
      const poolTex = makeGlowTex(255, 130, 20);

      function addGlow(x, y, z, sz) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex, transparent: true, depthWrite: false,
          blending: THREE.AdditiveBlending, opacity: 0.72,
        }));
        sp.position.set(x, y, z); sp.scale.set(sz, sz, 1);
        scene.add(sp); return sp;
      }
      // Lamp A: post x=-6, arm +1.5 → bulb world x=-4.5, y=0.42+7.12=7.54, z=5.5
      // Lamp B: post x=+6, arm +1.5 → bulb world x=+7.5, y=7.54, z=5.5
      const glow1 = addGlow(-4.5, 7.54, 5.5, 6.5);
      const glow2 = addGlow( 7.5, 7.54, 5.5, 6.5);
      s.glow1 = glow1; s.glow2 = glow2;

      // Ground light pools — warm amber splash on platform under each lamp
      [[-4.5, 4.8], [7.5, 4.8]].forEach(([px, pz]) => {
        const pm = new THREE.MeshBasicMaterial({
          map: poolTex, transparent: true, depthWrite: false,
          blending: THREE.AdditiveBlending, opacity: 0.18,
        });
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), pm);
        pool.rotation.x = -Math.PI / 2; pool.position.set(px, 0.02, pz);
        scene.add(pool);
      });

      // ── Platform roof & furniture ─────────────────────────────────────────────
      scene.add(mkBox(22, 0.25, 4.5, roofMat, 0, 7.5, 4.5));
      [-9, 0, 9].forEach((x) => scene.add(mkBox(0.3, 7.5, 0.3, lpostMat, x, 3.75, 2.5)));
      scene.add(mkBox(6,   1.2, 0.1,  mkMat({ color: 0x08121e, roughness: 0.7 }), 0, 6.5, 2.5));
      scene.add(mkBox(5.6, 0.9, 0.12, mkMat({ color: 0x0e2035, emissive: 0x0a2040, emissiveIntensity: 0.5 }), 0, 6.5, 2.57));
      scene.add(mkBox(3, 0.1, 0.7, concMat, 4, 1.15, 5.8));
      [-1, 1].forEach((x) => scene.add(mkBox(0.1, 0.8, 0.1, dkMat, 4 + x * 1.3, 0.8, 5.8)));

      // ── Platform benches ───────────────────────────────────────────────────────
      const benchWoodMat = mkMat({ color: 0x2d1a0c, roughness: 0.88, metalness: 0.05 });
      const benchIronMat = mkMat({ color: 0x18202a, roughness: 0.6,  metalness: 0.65 });
      function makeBench(bx, bz) {
        const g = new THREE.Group();
        g.add(mkBox(2.8, 0.08, 0.52, benchWoodMat, 0, 0.88, 0));
        g.add(mkBox(2.8, 0.44, 0.07, benchWoodMat, 0, 1.18, -0.22));
        g.add(mkBox(2.8, 0.06, 0.08, benchWoodMat, 0, 1.44, -0.18));
        [-1.1, 1.1].forEach((lx) => {
          g.add(mkBox(0.07, 0.9,  0.06, benchIronMat, lx, 0.45, -0.2));
          g.add(mkBox(0.07, 0.9,  0.06, benchIronMat, lx, 0.45,  0.2));
          g.add(mkBox(0.06, 0.06, 0.42, benchIronMat, lx, 0.22,  0));
        });
        g.position.set(bx, 0.42, bz); scene.add(g);
      }
      makeBench(-10, 6.5);
      makeBench(  2, 6.5);
      makeBench( 14, 6.5);

      // ── Station clock (hands driven from real time) ────────────────────────────
      (function() {
        const g = new THREE.Group();
        const clkPoleMat = mkMat({ color: 0x1a2232, roughness: 0.6, metalness: 0.55 });
        const clkHandMat = mkMat({ color: 0xd0d8e8, roughness: 0.4, metalness: 0.7  });
        const clkFaceMat = mkMat({ color: 0x060c18, roughness: 0.85 });
        g.add(mkCyl(0.06, 0.07, 3.5, 8, clkPoleMat, 0, 1.75, 0));
        const face = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), clkFaceMat);
        face.position.set(0, 3.65, 0.07); g.add(face);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.042, 8, 24), clkPoleMat);
        rim.position.set(0, 3.65, 0.08); g.add(rim);
        // Pivots at clock centre — mesh offset so rotation sweeps from centre outward
        const hPivot = new THREE.Group(); hPivot.position.set(0, 3.65, 0.10);
        hPivot.add(mkBox(0.028, 0.30, 0.022, clkHandMat, 0, 0.15, 0));
        const mPivot = new THREE.Group(); mPivot.position.set(0, 3.65, 0.12);
        mPivot.add(mkBox(0.018, 0.43, 0.022, clkHandMat, 0, 0.215, 0));
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10), clkHandMat);
        dot.position.set(0, 3.65, 0.14); g.add(dot);
        g.add(hPivot); g.add(mPivot);
        g.position.set(-18, 0.42, 3.8); scene.add(g);
        s.stationClock = { hPivot, mPivot };
      })();

      // ── Enhanced buildings with lit window grids ──────────────────────────────
      function makeBuilding(bx, bh, bw, bz) {
        const g = new THREE.Group();
        g.add(mkBox(bw, bh, 3.8, mkMat({ color: 0x04070c, roughness: 0.95 }), 0, bh / 2, 0));
        const cols = Math.max(2, Math.floor(bw / 2.2));
        const rows = Math.max(2, Math.floor(bh / 2.8));
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            if (Math.random() > 0.4) {
              const wx = -bw / 2 + (col + 0.5) * (bw / cols);
              const wy = 1.4 + row * (bh / rows);
              const ei = 0.28 + Math.random() * 0.55;
              g.add(mkBox(0.6, 0.8, 0.07,
                mkMat({ color: 0xffe898, emissive: 0xffcc50, emissiveIntensity: ei }),
                wx, wy, 1.93));
            }
          }
        }
        g.position.set(bx, 0, bz);
        return g;
      }

      [
        [-62, 24, 7, -20], [-45, 17, 5, -17], [-30, 11, 4, -14],
        [-18, 15, 5, -15], [ 22, 13, 5, -14], [ 36, 19, 6, -17],
        [ 55, 27, 7, -20], [ 72, 15, 5, -17], [-80, 20, 6, -21],
        [ 88, 22, 6, -20], [-52,  9, 3, -13], [ 14,  9, 3, -13],
      ].forEach(([bx, h, w, bz]) => scene.add(makeBuilding(bx, h, w, bz)));

      // ── Mountains ─────────────────────────────────────────────────────────────
      function makeMountain(x, z, r, h) {
        const g = new THREE.Group();
        // Very dark blue-grey — mountains should read as silhouettes
        const shade = 0.06 + Math.random() * 0.04;
        const mMat = mkMat({ color: new THREE.Color().setHSL(0.58, 0.28, shade), roughness: 1.0 });
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mMat);
        cone.position.y = h / 2 - 1; cone.castShadow = true; g.add(cone);
        if (h > 38) {
          const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.24, h * 0.2, 7),
            mkMat({ color: 0xccd8e0, roughness: 1.0 }));
          cap.position.y = h * 0.88; g.add(cap);
        }
        g.position.set(x, 0, z); return g;
      }

      [
        [-92,-55,20,38],[-68,-62,26,52],[-40,-54,18,30],[-16,-60,22,44],
        [ 10,-56,16,28],[ 38,-64,24,50],[ 64,-58,20,36],[ 90,-62,28,55],
        [-112,-60,22,42],[112,-57,18,34],
        [-76,-84,30,62],[-32,-88,34,70],[14,-85,28,58],[65,-82,32,65],
      ].forEach(([x,z,r,h]) => scene.add(makeMountain(x,z,r,h)));

      // ── Pine trees ────────────────────────────────────────────────────────────
      const snowCaps = [];
      s.snowCaps = snowCaps;

      function makePineTree(x, z, h) {
        const g = new THREE.Group();
        const trunkMat = mkMat({ color: 0x1c0f07, roughness: 0.98 });
        const leafHue = 0.32 + Math.random() * 0.04;
        const leafMat  = mkMat({ color: new THREE.Color().setHSL(leafHue, 0.55, 0.12), roughness: 0.92 });
        g.add(mkCyl(0.1, 0.17, h * 0.28, 6, trunkMat, 0, h * 0.14, 0));
        [[0.40, 1.55, 0.57],[0.58, 1.18, 0.75],[0.76, 0.78, 0.91]].forEach(([bot, rad, top]) => {
          const ch = (top - bot) * h + h * 0.12;
          const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, ch, 7), leafMat);
          cone.position.y = ((bot + top) / 2) * h; cone.castShadow = true; g.add(cone);
        });
        // Snow cap — drapes over tree tip, hidden until snow mode is on
        const capMat = mkMat({ color: 0xeef4ff, roughness: 0.96 });
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.52, h * 0.12, 7), capMat);
        cap.position.y = h * 0.88; cap.visible = false; g.add(cap);
        snowCaps.push(cap);
        g.position.set(x, 0.42, z); return g;
      }

      [
        [-22,9],[-26,11],[-20,7.5],[-30,8.5],[-34,10],[-38,9],[-42,8],[-46,10.5],
        [ 18,9],[ 22,11],[ 25,8],  [ 29,10], [ 33,9], [ 37,8],[ 41,10],[ 45,9.5],
        [-16,13],[19,13],[-50,9],[50,9],[-56,8],[56,8],[-24,7.5],[24,7.5],
        [-28,13],[28,13],[-60,10],[60,10],
      ].forEach(([x, z]) => scene.add(makePineTree(x, z, 3.8 + Math.random() * 3.5)));

      // ── Clouds — billboard sprites with procedural canvas textures ────────────
      // Much more realistic than sphere clusters: sprites always face the camera
      // like real distant clouds, with soft feathered edges and shadow underbelly.
      function genCloudTex(seed) {
        const W = 512, H = 220;
        const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
        const ctx = cv.getContext("2d");
        const rng = (n) => { const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.545; return x - Math.floor(x); };

        // Layer 1 — large base puffs (cloud body)
        const base = 7 + Math.floor(rng(0) * 5);
        for (let i = 0; i < base; i++) {
          const cx = W * (0.06 + rng(i * 4 + 1) * 0.88);
          const cy = H * (0.40 + rng(i * 4 + 2) * 0.32);
          const rx = W * (0.09 + rng(i * 4 + 3) * 0.17);
          const ry = rx * (0.48 + rng(i * 4 + 4) * 0.38);
          const g  = ctx.createRadialGradient(cx, cy - ry * 0.18, rx * 0.05, cx, cy, Math.hypot(rx, ry));
          g.addColorStop(0,    "rgba(248,252,255,0.96)");
          g.addColorStop(0.28, "rgba(232,242,254,0.82)");
          g.addColorStop(0.62, "rgba(210,228,250,0.38)");
          g.addColorStop(1,    "rgba(195,218,245,0)");
          ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fillStyle = g; ctx.fill();
        }

        // Layer 2 — smaller detail puffs on top edge (cauliflower texture)
        const detail = 5 + Math.floor(rng(50) * 5);
        for (let i = 0; i < detail; i++) {
          const cx = W * (0.1 + rng(i * 3 + 60) * 0.8);
          const cy = H * (0.22 + rng(i * 3 + 61) * 0.28);
          const r  = W * (0.04 + rng(i * 3 + 62) * 0.08);
          const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, "rgba(255,255,255,0.75)");
          g.addColorStop(1, "rgba(240,248,255,0)");
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = g; ctx.fill();
        }

        // Layer 3 — shadow underbelly (darker, blended in source-atop)
        ctx.globalCompositeOperation = "source-atop";
        const shadow = ctx.createLinearGradient(0, H * 0.50, 0, H * 0.92);
        shadow.addColorStop(0, "rgba(85,108,145,0)");
        shadow.addColorStop(1, "rgba(75,100,138,0.22)");
        ctx.fillStyle = shadow; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";

        const tex = new THREE.CanvasTexture(cv);
        return tex;
      }

      // Pre-bake 5 unique textures — shared across sprites to save memory
      const cloudTextures = [2, 7, 13, 19, 31].map(genCloudTex);
      const cloudMats = cloudTextures.map((tex) =>
        new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.78,
          color: new THREE.Color(0x3d5068) })   // dark tint at night, updated by TOD
      );
      s.cloudMats = cloudMats;

      const clouds = [];
      // [x, y, z, worldWidth, worldHeight]
      [
        [-30,28,-24, 22, 8.5], [ 14,34,-33, 16, 6.2], [ 58,27,-20, 24, 9.0],
        [-68,32,-40, 18, 7.0], [ 30,37,-28, 14, 5.5], [-12,24,-44, 17, 6.5],
        [ 24,30, 12, 15, 5.8], [-50,28,-14, 20, 7.5], [ 72,31,-30, 22, 8.5],
        [-85,35,-22, 26, 9.5], [  0,39,-52, 18, 7.0], [ 46,26,  6, 16, 6.0],
        [-18,42,-60, 20, 7.5], [ 90,33,-35, 19, 7.2],
      ].forEach(([x, y, z, sw, sh], i) => {
        const mat = cloudMats[i % cloudMats.length].clone();
        const sprite = new THREE.Sprite(mat);
        sprite.position.set(x, y, z);
        sprite.scale.set(sw, sh, 1);
        sprite.userData = { drift: (Math.random() - 0.5) * 0.3 + 0.08 };
        scene.add(sprite);
        clouds.push(sprite);
      });
      s.clouds = clouds;

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

      // ── Snow particles ─────────────────────────────────────────────────────────
      const SNOW_N = 900;
      const sfGeo = new THREE.BufferGeometry();
      const sfArr = new Float32Array(SNOW_N * 3);
      const sfVel = [];
      for (let i = 0; i < SNOW_N; i++) {
        sfArr[i * 3]     = (Math.random() - 0.5) * 90;
        sfArr[i * 3 + 1] = Math.random() * 30 + 2;
        sfArr[i * 3 + 2] = (Math.random() - 0.5) * 55;
        sfVel.push({ spd: 0.5 + Math.random() * 0.8, wx: (Math.random() - 0.5) * 0.18, t: Math.random() * Math.PI * 2 });
      }
      sfGeo.setAttribute("position", new THREE.BufferAttribute(sfArr, 3));
      const sfMesh = new THREE.Points(sfGeo, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        vertexShader:   `void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=max(2.,20./-mv.z);gl_Position=projectionMatrix*mv;}`,
        fragmentShader: `void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.95,.97,1.,smoothstep(.5,.12,d)*.82);}`,
      }));
      sfMesh.visible = false; scene.add(sfMesh);
      s.snow = { sfGeo, sfArr, sfVel, sfMesh };
      s.snowOn = false;

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

      let speakingSafetyTimer = null;

      function resetSpeaking() {
        isSpeaking = false;
        clearTimeout(speakingSafetyTimer);
        setTimeout(() => setAnnVisible(false), 1200);
      }

      function speakAnnouncement(text) {
        if (!("speechSynthesis" in window)) { playPADing(); return; }
        // Cancel any in-progress utterance before starting a new one
        if (isSpeaking) {
          window.speechSynthesis.cancel();
          isSpeaking = false;
        }
        isSpeaking = true;
        playPADing();

        // Safety: Chrome often never fires onend — force-reset after 30 s max
        clearTimeout(speakingSafetyTimer);
        speakingSafetyTimer = setTimeout(() => { isSpeaking = false; setAnnVisible(false); }, 30000);

        setTimeout(() => {
          const utt = new SpeechSynthesisUtterance(text);
          const voices = window.speechSynthesis.getVoices();
          const pick = voices.find((v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Daniel") || v.name.includes("Karen")))
            || voices.find((v) => v.lang.startsWith("en")) || voices[0];
          if (pick) utt.voice = pick;
          utt.rate = 0.88; utt.pitch = 0.95; utt.volume = 0.85;
          utt.onstart = () => { setAnnText(text); setAnnVisible(true); };
          utt.onend   = () => resetSpeaking();
          utt.onerror = () => { isSpeaking = false; clearTimeout(speakingSafetyTimer); setAnnVisible(false); };
          window.speechSynthesis.speak(utt);

          // Chrome bug: speech synthesis silently stops after ~15 s without firing onend.
          // Keep it alive by pause/resume every 12 seconds while speaking.
          const keepAlive = setInterval(() => {
            if (!isSpeaking) { clearInterval(keepAlive); return; }
            if (window.speechSynthesis.speaking) {
              window.speechSynthesis.pause();
              window.speechSynthesis.resume();
            }
          }, 12000);
        }, 700);
      }

      function triggerAnn(specific) {
        if (isSpeaking) return;   // never interrupt an in-progress announcement
        const msg = specific || ANNOUNCEMENTS[annIdx % ANNOUNCEMENTS.length];
        if (!specific) annIdx++;
        speakAnnouncement(msg);
      }
      s.triggerAnn = triggerAnn;

      if ("speechSynthesis" in window) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
      }
      // Auto-announce every 3 minutes (was 40 s — felt continuous)
      const annTimer = setInterval(() => { if (!document.hidden && !isSpeaking) triggerAnn(); }, 180000);

      // ── Auto-cycle: train departs and arrives automatically ──────────────────
      function autoDepart() {
        if (!s.autoCycle || s.tState !== "stopped") return;
        const boarding  = s.passengers?.some((p) => ["walkToTrain","queuing","boarding"].includes(p.userData.state));
        const alighting = s.alighters?.some((a) => ["waiting","exiting"].includes(a.userData.state));
        if (boarding || alighting) {
          // Passengers still active — wait 6s and try again
          s.autoCycleTimer = setTimeout(autoDepart, 6000); return;
        }
        s.tState = "departing"; s.tTargX = -90; s.tVel = 0;
        setTrainStatusText("● Departing"); setTrainStatusColor("rgba(255,160,80,.8)");
        setBtnTrainText("🚂 Arrive");
        playDoorChime();
        setTimeout(() => horn(), 600);
        setTimeout(() => setEngVol(0.16, 1.5), 1000);
        triggerAnn(ANNOUNCEMENTS[5]);
        showToast("Train departing — auto cycle");
      }

      function autoArrive() {
        if (!s.autoCycle) return;
        s.tState = "arriving"; s.tTargX = 0; s.tVel = 0;
        trainG.position.set(90, 0, -4);
        startEngine(); setEngVol(0.14, 2); resetAlighters();
        s.passengers?.forEach((p) => {
          p.visible = true; p.position.set(p.userData.ox, 0.42, p.userData.oz);
          Object.assign(p.userData, { state: "idle", boardDelay: 0, waitT: 0, boardT: 0 });
        });
        doorMeshes.forEach((dm) => (dm.userData.open = false));
        setDoorStatus("Doors — Closed");
        setTrainStatusText("● Train Arriving"); setTrainStatusColor("rgba(100,220,140,.7)");
        setBtnTrainText("🚂 Depart");
        showToast("Train arriving — auto cycle");
      }

      s.autoDepart = autoDepart;
      s.autoArrive = autoArrive;

      // ── Time-of-day updater ──────────────────────────────────────────────────
      function updateTOD(tod) {
        // Horizon fog colour (drives renderer clear + scene fog)
        const skyL = Math.min(0.02 + tod * 0.88, 0.82);
        const horizonCol = new THREE.Color().setHSL(0.58, tod < 0.5 ? 0.6 : 0.55, skyL);
        renderer.setClearColor(horizonCol, 1);
        scene.fog.color.copy(horizonCol);
        // Keep minimum fog for atmospheric depth even at noon — this is what fades distant mountains
        scene.fog.density = 0.007 + (1 - tod) * 0.016;

        // Sun / moon / ambient
        sun.intensity = tod * 6.5; sun.color.setHSL(0.12 + tod * 0.02, 0.7, 0.7 + tod * 0.25);
        moon.intensity = Math.max(0, 1.1 - tod * 1.3);
        // Keep ambient LOW so shadows stay visible — shadows are what make a scene look real
        ambient.color.setHSL(tod > 0.5 ? 0.12 : 0.62, 0.25, 0.08 + tod * 0.35);
        ambient.intensity = 0.35 + tod * 0.55;          // max ≈ 0.9 (was 3.4 — that killed shadows)
        // Hemisphere: sky tone from above, warm ground bounce below
        if (s.lights.hemi) {
          s.lights.hemi.color.setHSL(tod > 0.5 ? 0.55 : 0.62, 0.4, 0.08 + tod * 0.38);
          s.lights.hemi.groundColor.setHSL(0.1, 0.3, 0.03 + tod * 0.12);
          s.lights.hemi.intensity = 0.4 + tod * 0.6;
        }
        tg1.intensity = Math.max(0, 2.5 - tod * 8); tg2.intensity = Math.max(0, 2.5 - tod * 8);
        lp1.intensity = Math.max(0, (s.l1on ? 4 : 0) * (1 - tod * 1.2));
        lp2.intensity = Math.max(0, (s.l2on ? 4 : 0) * (1 - tod * 1.2));
        hLight.intensity = Math.max(0, 8 * (1 - tod * 1.5));
        // Clamp exposure — was reaching 1.75 which washed everything out
        renderer.toneMappingExposure = 0.50 + tod * 0.52;  // max ≈ 1.02
        if (rainCanvasRef.current) rainCanvasRef.current.style.opacity = String(0.5 - tod * 0.3);

        // Train body colour shift
        bodyMat.color.setRGB(0.12 + tod * 0.2, 0.29 + tod * 0.25, 0.53 + tod * 0.18);
        bodyMat.emissive.setRGB(0, 0, 0);
        bodyMatAcc.emissive.setRGB(tod * 0.1, 0, 0);
        bodyMatYel.emissive.setRGB(tod * 0.08, tod * 0.06, 0);

        // ── Sky sphere gradient ──────────────────────────────────────────────────
        if (s.skyMat) {
          if (tod < 0.25) {
            // Deep night
            s.skyMat.uniforms.uTop.value.setHex(0x010308);
            s.skyMat.uniforms.uMid.value.setHex(0x060e1c);
            s.skyMat.uniforms.uHorizon.value.setHex(0x0d1e30);
          } else if (tod < 0.45) {
            // Dusk / dawn — warm orange horizon
            const t = (tod - 0.25) / 0.2;
            s.skyMat.uniforms.uTop.value.setHex(0x050d20);
            s.skyMat.uniforms.uMid.value.lerpColors(new THREE.Color(0x0d1e30), new THREE.Color(0x2a1a40), t);
            s.skyMat.uniforms.uHorizon.value.lerpColors(new THREE.Color(0x301828), new THREE.Color(0xc05530), t);
          } else if (tod < 0.6) {
            // Sunrise / sunset — golden
            const t = (tod - 0.45) / 0.15;
            s.skyMat.uniforms.uTop.value.lerpColors(new THREE.Color(0x102050), new THREE.Color(0x1a4090), t);
            s.skyMat.uniforms.uMid.value.lerpColors(new THREE.Color(0x2a1a40), new THREE.Color(0x4070c0), t);
            s.skyMat.uniforms.uHorizon.value.lerpColors(new THREE.Color(0xc05530), new THREE.Color(0xe0aa60), t);
          } else {
            // Full day — blue sky
            const t = (tod - 0.6) / 0.4;
            s.skyMat.uniforms.uTop.value.lerpColors(new THREE.Color(0x1a4090), new THREE.Color(0x1565c0), t);
            s.skyMat.uniforms.uMid.value.lerpColors(new THREE.Color(0x4070c0), new THREE.Color(0x42a5e0), t);
            s.skyMat.uniforms.uHorizon.value.lerpColors(new THREE.Color(0xe0aa60), new THREE.Color(0xa8d8f0), t);
          }
        }

        // Stars fade out with dawn
        if (s.starMat) s.starMat.opacity = Math.max(0, 0.88 - tod * 2.6);

        // Moon disc fades at sunrise
        if (s.moonObj) s.moonObj.material.emissiveIntensity = Math.max(0, 0.55 - tod * 1.6);

        // Clouds brighten/darken with time of day (sprite billboard system)
        if (s.clouds) {
          const brightness = Math.min(1, 0.22 + tod * 0.78);
          const sat        = Math.max(0, 0.14 - tod * 0.12);
          const hue        = tod < 0.4 ? 0.60 : 0.56;
          s.clouds.forEach((cl) => {
            cl.material.color.setHSL(hue, sat, brightness);
            cl.material.opacity = 0.52 + tod * 0.28;
          });
        }

        // Train windows: warm glow at night, natural glass by day
        if (s.winMat) {
          s.winMat.emissiveIntensity = Math.max(0.08, 0.85 - tod * 0.72);
          s.winMat.color.setHSL(0.1, Math.max(0, 0.4 - tod * 0.35), Math.min(1, 0.72 + tod * 0.28));
        }

        // Lamp glow halos — fade with daylight, respect lamp on/off state
        const glowA = Math.max(0, 1 - tod * 1.5) * 0.72;
        if (s.glow1) s.glow1.material.opacity = s.l1on ? glowA : 0;
        if (s.glow2) s.glow2.material.opacity = s.l2on ? glowA : 0;
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
          const glowA2 = Math.max(0, 1 - s.tod * 1.5) * 0.72;
          if (found.userData.idx === 1) {
            s.l1on = on; lp1.intensity = on ? 4 : 0;
            lb1.material = on ? lglowMat : loffMat;
            if (s.glow1) s.glow1.material.opacity = on ? glowA2 : 0;
            setLamp1Status("Lamp A — " + (on ? "On" : "Off"));
          } else {
            s.l2on = on; lp2.intensity = on ? 4 : 0;
            lb2.material = on ? lglowMat : loffMat;
            if (s.glow2) s.glow2.material.opacity = on ? glowA2 : 0;
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

        // Train movement — physics-based (velocity + acceleration)
        if (s.tState === "arriving" || s.tState === "departing") {
          const dx = s.tTargX - trainG.position.x;

          if (s.tState === "arriving") {
            // Speed proportional to sqrt(distance): fast approach, smooth auto-braking
            const dist = Math.abs(dx);
            if (dist > 0.14) {
              s.tVel = -Math.min(13, Math.sqrt(dist * 5.2) + 0.55);
              trainG.position.x += s.tVel * dt;
            } else {
              // Arrived — train stopped at platform
              trainG.position.x = s.tTargX; s.tVel = 0; s.tState = "stopped";
              setTrainStatusText("● Stopped"); setTrainStatusColor("rgba(180,205,230,.5)");
              setBtnTrainText("🚂 Depart"); setEngVol(0.04, 1.5); playScreech();
              setTimeout(() => playDoorChime(), 1800);
              // "Mind the gap when boarding" — correct for a stopped train
              clearTimeout(s.pendingAnnTimer);
              s.pendingAnnTimer = setTimeout(() => triggerAnn(ANNOUNCEMENTS[3]), 2800);
              showToast("Platform 03 — Last train out");
              // Auto-cycle: schedule departure after 30 s platform dwell
              clearTimeout(s.autoCycleTimer);
              if (s.autoCycle) s.autoCycleTimer = setTimeout(autoDepart, 30000);
            }
          } else {
            // Departing: smooth acceleration from standstill to cruise speed
            s.tVel += (-10 - s.tVel) * dt * 1.35;
            trainG.position.x += s.tVel * dt;
            if (trainG.position.x <= s.tTargX) {
              trainG.position.x = s.tTargX; s.tVel = 0; s.tState = "idle";
              setTrainStatusText("○ Platform Empty"); setTrainStatusColor("rgba(180,205,230,.28)");
              setBtnTrainText("🚂 Arrive"); stopEngine();
              // Auto-cycle: bring train back after 12 s off-screen
              clearTimeout(s.autoCycleTimer);
              if (s.autoCycle) s.autoCycleTimer = setTimeout(autoArrive, 12000);
            }
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

        // Cloud drift
        if (s.clouds) {
          s.clouds.forEach((cl) => {
            cl.position.x += cl.userData.drift * s.windS * dt;
            if (cl.position.x > 110)  cl.position.x = -110;
            if (cl.position.x < -110) cl.position.x =  110;
          });
        }

        // Station clock hands driven from real wall-clock time
        if (s.stationClock) {
          const _n = new Date();
          const _m = _n.getMinutes() + _n.getSeconds() / 60;
          const _h = (_n.getHours() % 12) + _m / 60;
          s.stationClock.mPivot.rotation.z = -(_m  / 60) * Math.PI * 2;
          s.stationClock.hPivot.rotation.z = -(_h  / 12) * Math.PI * 2;
        }

        // Snow particles
        if (s.snowOn && s.snow) {
          const wind = s.windS * 0.15;
          for (let i = 0; i < SNOW_N; i++) {
            const v = s.snow.sfVel[i];
            s.snow.sfArr[i * 3 + 1] -= v.spd * dt;
            s.snow.sfArr[i * 3]     += v.wx + wind + Math.sin(T * 0.5 + v.t) * 0.008;
            if (s.snow.sfArr[i * 3 + 1] < 0) {
              s.snow.sfArr[i * 3]     = (Math.random() - 0.5) * 90;
              s.snow.sfArr[i * 3 + 1] = 30 + Math.random() * 8;
              s.snow.sfArr[i * 3 + 2] = (Math.random() - 0.5) * 55;
            }
          }
          s.snow.sfGeo.attributes.position.needsUpdate = true;
        }

        // Star twinkle
        if (s.starMat && s.starMat.opacity > 0.05) {
          s.starMat.opacity = 0.88 * (0.92 + Math.sin(T * 2.8) * 0.04 + Math.sin(T * 7.1) * 0.04);
          s.starMat.opacity = Math.max(0, s.starMat.opacity - s.tod * 2.6);
        }

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
        clearTimeout(speakingSafetyTimer);
        clearTimeout(s.autoCycleTimer); clearTimeout(s.pendingAnnTimer);
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
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
