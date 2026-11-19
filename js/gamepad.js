/* EROFEY CYBER ARENA — interactive 3D gamepad (three.js)
 * Procedurally built controller: tilt follows the cursor, drag to spin,
 * click buttons / D-pad / sticks, keyboard (WASD + IJKL/U, arrows, Q/E),
 * and a real connected gamepad (Gamepad API) is mirrored on the model.
 */
import * as THREE from 'three';

const stage = document.getElementById('gamepad-stage');
const canvas = document.getElementById('gamepad-canvas');
const logEl = document.getElementById('pad-log');
const heroEl = document.getElementById('hero');

const toast = (msg, ms) => window.dispatchEvent(new CustomEvent('eca:toast', { detail: { msg, ms } }));

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

if (!stage || !canvas || !hasWebGL()) {
  stage && stage.classList.add('no-webgl');
} else {
  try { init(); } catch (err) { console.error(err); stage.classList.add('no-webgl'); }
}

function init() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ */
  /* Renderer / scene / camera                                           */
  /* ------------------------------------------------------------------ */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  // custom dark "studio" with neon softboxes → reflections are tinted blue/violet instead of white
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x04031a);
    const box = (color, w, h, pos, look) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
    };
    box(new THREE.Color(0x3d5bff).multiplyScalar(2.2), 6, 3, [-6, 3, 4]);
    box(new THREE.Color(0xb44bff).multiplyScalar(2.2), 6, 3, [6, -2, 4]);
    box(new THREE.Color(0x3de0ff).multiplyScalar(1.4), 8, 1, [0, 6, -2]);
    box(new THREE.Color(0xd8d6ff).multiplyScalar(0.9), 5, 1.2, [0, 5, 6]);
    box(new THREE.Color(0x2a1f80), 20, 4, [0, -6, 0]);
    scene.environment = pmrem.fromScene(env, 0.035).texture;
  }

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // lights — neon blue / violet / cyan rim
  scene.add(new THREE.AmbientLight(0x4a4aff, 0.35));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
  keyLight.position.set(1, 4, 6);
  scene.add(keyLight);
  const blueLight = new THREE.PointLight(0x3b5bff, 45, 20, 2);
  blueLight.position.set(-4.5, 2.2, 3.5);
  const violetLight = new THREE.PointLight(0xb44bff, 40, 20, 2);
  violetLight.position.set(4.5, -1.5, 3.5);
  const rimLight = new THREE.PointLight(0x3de0ff, 50, 20, 2);
  rimLight.position.set(0, 3.5, -3.5);
  scene.add(blueLight, violetLight, rimLight);

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  function glowTexture() {
    const s = 128, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const GLOW = glowTexture();

  function makeGlow(color, size, opacity = 0.35) {
    const m = new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(m);
    s.scale.setScalar(size);
    s.userData.baseOpacity = opacity;
    return s;
  }

  function roundedRect(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  const neon = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const plastic = (color = 0x15123a, extra = {}) => new THREE.MeshPhysicalMaterial({
    color, metalness: 0.25, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.9, ...extra
  });

  /* ------------------------------------------------------------------ */
  /* Gamepad model                                                       */
  /* ------------------------------------------------------------------ */
  const root = new THREE.Group();   // float / shake
  const pad = new THREE.Group();    // tilt / spin
  root.add(pad);
  scene.add(root);

  // --- body outline (clockwise, right half then mirrored) ---
  const body = new THREE.Shape();
  body.moveTo(0, 0.85);
  body.bezierCurveTo(0.6, 0.85, 1.1, 0.98, 1.45, 0.95);
  body.bezierCurveTo(1.85, 0.92, 2.05, 0.7, 2.05, 0.35);
  body.bezierCurveTo(2.1, -0.3, 2.12, -1.1, 1.75, -1.38);
  body.bezierCurveTo(1.5, -1.56, 1.22, -1.45, 1.12, -1.18);
  body.bezierCurveTo(0.98, -0.78, 0.5, -0.58, 0, -0.58);
  body.bezierCurveTo(-0.5, -0.58, -0.98, -0.78, -1.12, -1.18);
  body.bezierCurveTo(-1.22, -1.45, -1.5, -1.56, -1.75, -1.38);
  body.bezierCurveTo(-2.12, -1.1, -2.1, -0.3, -2.05, 0.35);
  body.bezierCurveTo(-2.05, 0.7, -1.85, 0.92, -1.45, 0.95);
  body.bezierCurveTo(-1.1, 0.98, -0.6, 0.85, 0, 0.85);

  const DEPTH = 0.42, BEVEL_T = 0.2, BEVEL_S = 0.16;
  const bodyGeo = new THREE.ExtrudeGeometry(body, {
    depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL_T, bevelSize: BEVEL_S, bevelSegments: 10, curveSegments: 64
  });
  bodyGeo.translate(0, 0, -DEPTH / 2);
  bodyGeo.computeVertexNormals();
  const bodyMat = plastic(0x100d34, { envMapIntensity: 1, roughness: 0.34, sheen: 0.4, sheenColor: new THREE.Color(0x5a4bff), sheenRoughness: 0.6 });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  pad.add(bodyMesh);
  const FRONT = DEPTH / 2 + BEVEL_T; // z of the front face

  // --- neon seam around the body ---
  {
    const pts = body.getSpacedPoints(260);
    pts.pop();
    const seamPts = pts.map((p, i) => {
      const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
      const tx = b.x - a.x, ty = b.y - a.y, len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len, ny = tx / len; // outward for clockwise path
      return new THREE.Vector3(p.x + nx * (BEVEL_S + 0.004), p.y + ny * (BEVEL_S + 0.004), 0);
    });
    const curve = new THREE.CatmullRomCurve3(seamPts, true);
    const seamGeo = new THREE.TubeGeometry(curve, 400, 0.022, 8, true);
    // vertex colors: gradient blue → violet → magenta around the loop
    const cols = [];
    const c1 = new THREE.Color(0x3d5bff), c2 = new THREE.Color(0xb44bff), c3 = new THREE.Color(0x3de0ff), tmp = new THREE.Color();
    const pos = seamGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const t = (Math.atan2(y, x) / Math.PI + 1) / 2;
      if (t < 0.5) tmp.copy(c1).lerp(c2, t * 2); else tmp.copy(c2).lerp(c3, (t - 0.5) * 2);
      cols.push(tmp.r * 1.6, tmp.g * 1.6, tmp.b * 1.6);
    }
    seamGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const seam = new THREE.Mesh(seamGeo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    pad.add(seam);
  }

  // --- big halo behind the controller ---
  const halo = makeGlow(0x5a3dff, 6.5, 0.34);
  halo.position.set(0, -0.1, -1.2);
  root.add(halo);

  /* -------------------- controls registry -------------------- */
  const controls = [];        // all pressable controls
  const hitMeshes = [];       // meshes for raycasting
  const byId = {};

  function registerControl(ctrl, meshes) {
    ctrl.value = 0; ctrl.held = false; ctrl.flash = 0; ctrl.hover = 0;
    ctrl.basePos = ctrl.group.position.clone();
    controls.push(ctrl);
    byId[ctrl.id] = ctrl;
    meshes.forEach((m) => { m.userData.ctrl = ctrl; hitMeshes.push(m); });
    return ctrl;
  }

  /* -------------------- face buttons -------------------- */
  const FACE = { x: 1.36, y: 0.22, r: 0.33 };
  function symbolMesh(kind, color) {
    const mat = neon(color);
    const g = new THREE.Group();
    if (kind === 'triangle') {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.058, 0.086, 3), mat);
      m.rotation.z = Math.PI / 2; m.position.y = -0.012; g.add(m);
    } else if (kind === 'circle') {
      g.add(new THREE.Mesh(new THREE.RingGeometry(0.058, 0.084, 40), mat));
    } else if (kind === 'square') {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.088, 4), mat);
      m.rotation.z = Math.PI / 4; g.add(m);
    } else if (kind === 'cross') {
      const geo = new THREE.PlaneGeometry(0.18, 0.03);
      const a = new THREE.Mesh(geo, mat); a.rotation.z = Math.PI / 4;
      const b = new THREE.Mesh(geo, mat); b.rotation.z = -Math.PI / 4;
      g.add(a, b);
    }
    return g;
  }

  const FACE_DEF = [
    { id: 'triangle', sym: '△', color: 0x3de0ff, css: '#3de0ff', dx: 0, dy: 1 },
    { id: 'circle',   sym: '○', color: 0xff3bd4, css: '#ff3bd4', dx: 1, dy: 0 },
    { id: 'cross',    sym: '✕', color: 0x4d6bff, css: '#6d86ff', dx: 0, dy: -1 },
    { id: 'square',   sym: '□', color: 0xb45bff, css: '#c27bff', dx: -1, dy: 0 }
  ];
  const capGeo = new THREE.CylinderGeometry(0.17, 0.175, 0.13, 48);
  capGeo.rotateX(Math.PI / 2);
  const wellGeo = new THREE.TorusGeometry(0.2, 0.022, 12, 48);

  FACE_DEF.forEach((d) => {
    const group = new THREE.Group();
    group.position.set(FACE.x + d.dx * FACE.r, FACE.y + d.dy * FACE.r, FRONT);
    const capMat = plastic(0x1b1846, { emissive: new THREE.Color(d.color), emissiveIntensity: 0.06 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.z = 0.05;
    const sym = symbolMesh(d.id, d.color);
    sym.position.z = 0.118;
    group.add(cap, sym);
    const glow = makeGlow(d.color, 0.85, 0.22);
    glow.position.z = 0.02;
    group.add(glow);
    pad.add(group);
    // static well ring around the button (doesn't move when pressed)
    const well = new THREE.Mesh(wellGeo, plastic(0x0a0822));
    well.position.set(group.position.x, group.position.y, FRONT);
    pad.add(well);
    registerControl({
      id: d.id, kind: 'face', label: d.sym, css: d.css, color: new THREE.Color(d.color),
      group, mat: capMat, glow, pressDir: new THREE.Vector3(0, 0, -1), depth: 0.065, baseEmissive: 0.06
    }, [cap]);
  });

  /* -------------------- D-pad -------------------- */
  const DPAD = { x: -1.36, y: 0.22 };
  const armShape = roundedRect(0.19, 0.25, 0.05);
  const armGeo = new THREE.ExtrudeGeometry(armShape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 4 });
  const arrowGeo = new THREE.CircleGeometry(0.04, 3);
  const DPAD_DEF = [
    { id: 'up', sym: '↑', rot: 0, dx: 0, dy: 1 },
    { id: 'right', sym: '→', rot: -Math.PI / 2, dx: 1, dy: 0 },
    { id: 'down', sym: '↓', rot: Math.PI, dx: 0, dy: -1 },
    { id: 'left', sym: '←', rot: Math.PI / 2, dx: -1, dy: 0 }
  ];
  const dpadColor = 0x7d84ff;
  DPAD_DEF.forEach((d) => {
    const group = new THREE.Group();
    group.position.set(DPAD.x + d.dx * 0.2, DPAD.y + d.dy * 0.2, FRONT);
    group.rotation.z = d.rot;
    const mat = plastic(0x1b1846, { emissive: new THREE.Color(dpadColor), emissiveIntensity: 0.05 });
    const arm = new THREE.Mesh(armGeo, mat);
    const arrow = new THREE.Mesh(arrowGeo, neon(dpadColor));
    arrow.rotation.z = Math.PI / 2;
    arrow.position.set(0, 0.04, 0.1);
    const glow = makeGlow(dpadColor, 0.6, 0.12);
    glow.position.z = 0.03;
    group.add(arm, arrow, glow);
    pad.add(group);
    registerControl({
      id: d.id, kind: 'dpad', label: d.sym, css: '#9aa0ff', color: new THREE.Color(dpadColor),
      group, mat, glow, pressDir: new THREE.Vector3(0, 0, -1), depth: 0.05, baseEmissive: 0.05
    }, [arm]);
  });
  { // dpad center
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4), plastic(0x1b1846));
    c.position.set(DPAD.x, DPAD.y, FRONT + 0.03);
    pad.add(c);
  }

  /* -------------------- analog sticks -------------------- */
  const sticks = {};
  function makeStick(id, x, y, color) {
    // well
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.024, 12, 64), neon(color));
    ring.position.set(x, y, FRONT + 0.005);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.33, 48), new THREE.MeshStandardMaterial({ color: 0x05040f, roughness: 0.9 }));
    hole.position.set(x, y, FRONT + 0.002);
    const ringGlow = makeGlow(color, 1.3, 0.25);
    ringGlow.position.set(x, y, FRONT);
    pad.add(ring, hole, ringGlow);

    const pivot = new THREE.Group();
    pivot.position.set(x, y, FRONT - 0.05);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.25, 24).rotateX(Math.PI / 2), plastic(0x0c0a24));
    shaft.position.z = 0.12;
    const capMat = plastic(0x1d1a4c, { emissive: new THREE.Color(color), emissiveIntensity: 0.04, roughness: 0.55 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.24, 0.1, 48).rotateX(Math.PI / 2), capMat);
    cap.position.z = 0.27;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.032, 12, 48), plastic(0x24205a, { roughness: 0.7 }));
    rim.position.z = 0.325;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24), neon(color));
    dot.position.z = 0.322;
    pivot.add(shaft, cap, rim, dot);
    pad.add(pivot);
    const s = { id, pivot, cap, vx: 0, vy: 0, tx: 0, ty: 0, color: new THREE.Color(color), ring, ringGlow };
    sticks[id] = s;
    registerControl({
      id: id === 'L' ? 'l3' : 'r3', kind: 'stick', stick: s, label: id + '3', css: id === 'L' ? '#4d6bff' : '#b44bff',
      color: new THREE.Color(color), group: pivot, mat: capMat, glow: ringGlow, pressDir: new THREE.Vector3(0, 0, -1), depth: 0.05, baseEmissive: 0.04
    }, [cap, rim]);
    return s;
  }
  makeStick('L', -0.64, -0.48, 0x3d5bff);
  makeStick('R', 0.64, -0.48, 0xb44bff);

  /* -------------------- touchpad with logo -------------------- */
  const tpCanvas = document.createElement('canvas');
  tpCanvas.width = 512; tpCanvas.height = 256;
  const tpTex = new THREE.CanvasTexture(tpCanvas);
  tpTex.colorSpace = THREE.SRGBColorSpace;
  function drawTouchpad() {
    const g = tpCanvas.getContext('2d');
    const W = tpCanvas.width, H = tpCanvas.height;
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#120f3c'); bg.addColorStop(1, '#0a0826');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(110,120,255,.14)'; g.lineWidth = 1;
    for (let x = 0; x < W; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#5a6bff'; g.shadowBlur = 18;
    g.fillStyle = '#7d8cff';
    g.font = '400 54px "Press Start 2P", monospace';
    g.fillText('EROFEY', W / 2, H / 2 - 22);
    g.shadowColor = '#b44bff';
    g.fillStyle = '#c690ff';
    g.font = '400 22px "Press Start 2P", monospace';
    g.fillText('CYBER ARENA', W / 2, H / 2 + 42);
    tpTex.needsUpdate = true;
  }
  drawTouchpad();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawTouchpad);

  const tpGroup = new THREE.Group();
  tpGroup.position.set(0, 0.28, FRONT);
  const tpGeo = new THREE.ExtrudeGeometry(roundedRect(1.3, 0.66, 0.1), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3 });
  // map UVs of the front face to 0..1
  {
    const uv = tpGeo.attributes.uv, p = tpGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + 0.65) / 1.3, (p.getY(i) + 0.33) / 0.66);
  }
  const tpMat = new THREE.MeshPhysicalMaterial({ map: tpTex, emissiveMap: tpTex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.55, roughness: 0.2, clearcoat: 1, metalness: 0.1 });
  const tp = new THREE.Mesh(tpGeo, tpMat);
  tpGroup.add(tp);
  pad.add(tpGroup);
  registerControl({
    id: 'touch', kind: 'touch', label: 'TP', css: '#c690ff', color: new THREE.Color(0xb44bff),
    group: tpGroup, mat: tpMat, glow: null, pressDir: new THREE.Vector3(0, 0, -1), depth: 0.03, baseEmissive: 0.55
  }, [tp]);

  // light bar under touchpad
  const lightBarMat = new THREE.MeshBasicMaterial({ color: 0x8b6bff, toneMapped: false });
  const lightBar = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.9, 4, 12).rotateZ(Math.PI / 2), lightBarMat);
  lightBar.position.set(0, -0.12, FRONT + 0.01);
  const lightBarGlow = makeGlow(0x8b6bff, 1.6, 0.3);
  lightBarGlow.scale.set(2.2, 0.5, 1);
  lightBarGlow.position.copy(lightBar.position);
  pad.add(lightBar, lightBarGlow);

  /* -------------------- small center buttons -------------------- */
  [['share', -0.86, '◧'], ['options', 0.86, '≡']].forEach(([id, x, sym]) => {
    const group = new THREE.Group();
    group.position.set(x, 0.62, FRONT);
    const mat = plastic(0x1d1a4c, { emissive: new THREE.Color(0x7d84ff), emissiveIntensity: 0.08 });
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.1, 4, 12), mat);
    m.position.z = 0.03;
    group.add(m);
    pad.add(group);
    registerControl({ id, kind: 'small', label: sym, css: '#9aa0ff', color: new THREE.Color(0x7d84ff), group, mat, glow: null, pressDir: new THREE.Vector3(0, 0, -1), depth: 0.03, baseEmissive: 0.08 }, [m]);
  });
  { // home / logo button
    const group = new THREE.Group();
    group.position.set(0, -0.36, FRONT);
    const mat = plastic(0x1d1a4c, { emissive: new THREE.Color(0xb44bff), emissiveIntensity: 0.6 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 32).rotateX(Math.PI / 2), mat);
    m.position.z = 0.025;
    const glow = makeGlow(0xb44bff, 0.5, 0.35);
    glow.position.z = 0.05;
    group.add(m, glow);
    pad.add(group);
    registerControl({ id: 'home', kind: 'home', label: 'E', css: '#d24bff', color: new THREE.Color(0xd24bff), group, mat, glow, pressDir: new THREE.Vector3(0, 0, -1), depth: 0.03, baseEmissive: 0.6 }, [m]);
  }

  /* -------------------- shoulder buttons & triggers -------------------- */
  const bumperGeo = new THREE.ExtrudeGeometry(roundedRect(0.78, 0.13, 0.06), { depth: 0.34, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4 });
  bumperGeo.translate(0, 0, -0.17);
  const triggerGeo = new THREE.ExtrudeGeometry(roundedRect(0.62, 0.22, 0.09), { depth: 0.24, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 4 });
  triggerGeo.translate(0, 0, -0.12);
  [[-1, 'l1', 'l2', 'L1', 'L2', 0x3d5bff, '#6d86ff'], [1, 'r1', 'r2', 'R1', 'R2', 0xb44bff, '#c27bff']].forEach(([side, b, t, bl, tl, color, css]) => {
    const g1 = new THREE.Group();
    g1.position.set(side * 1.42, 1.05, 0.05);
    g1.rotation.z = side * -0.08;
    const m1 = plastic(0x1b1846, { emissive: new THREE.Color(color), emissiveIntensity: 0.1 });
    const bumper = new THREE.Mesh(bumperGeo, m1);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.025), neon(color));
    strip.position.set(0, 0, 0.205);
    g1.add(bumper, strip);
    pad.add(g1);
    registerControl({ id: b, kind: 'shoulder', label: bl, css, color: new THREE.Color(color), group: g1, mat: m1, glow: null, pressDir: new THREE.Vector3(0, -1, 0), depth: 0.05, baseEmissive: 0.1 }, [bumper]);

    const g2 = new THREE.Group();
    g2.position.set(side * 1.38, 1.0, -0.33);
    g2.rotation.set(-0.35, 0, side * -0.08);
    const m2 = plastic(0x15123a, { emissive: new THREE.Color(color), emissiveIntensity: 0.1 });
    const trig = new THREE.Mesh(triggerGeo, m2);
    g2.add(trig);
    pad.add(g2);
    registerControl({ id: t, kind: 'shoulder', label: tl, css, color: new THREE.Color(color), group: g2, mat: m2, glow: null, pressDir: new THREE.Vector3(0, -1, 0.3).normalize(), depth: 0.08, baseEmissive: 0.1 }, [trig]);
  });

  /* ------------------------------------------------------------------ */
  /* Ambient: floating neon cubes + star dust                            */
  /* ------------------------------------------------------------------ */
  const cubes = [];
  const cubeCols = [0x3d5bff, 0xb44bff, 0x3de0ff, 0xd24bff];
  const CUBE_POS = [[-2.9, 1.8, -1.5], [2.8, 1.9, -0.8], [3.0, -1.5, -1.2], [-2.7, -1.8, -0.4], [-1.2, 2.4, -2.8], [1.5, -2.3, -2.2], [0.3, 2.6, -3.6]];
  CUBE_POS.forEach((p, i) => {
    const size = 0.22 + (i % 3) * 0.12;
    const geo = new THREE.BoxGeometry(size, size, size);
    const col = cubeCols[i % cubeCols.length];
    const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
      color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.2,
      transparent: true, opacity: 0.55, clearcoat: 1
    }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: col, toneMapped: false }));
    mesh.add(edges);
    mesh.position.set(...p);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    mesh.userData = { base: new THREE.Vector3(...p), speed: 0.3 + Math.random() * 0.5, phase: Math.random() * 6 };
    const g = makeGlow(col, size * 5, 0.22);
    mesh.add(g);
    scene.add(mesh);
    cubes.push(mesh);
  });

  const DUST = 260;
  {
    const pos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 9;
      pos[i * 3 + 2] = -2 - Math.random() * 6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8c8cff, size: 0.035, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(dust);
  }

  /* ------------------------------------------------------------------ */
  /* Particle bursts                                                     */
  /* ------------------------------------------------------------------ */
  const PCOUNT = 600;
  const pPos = new Float32Array(PCOUNT * 3).fill(9999);
  const pCol = new Float32Array(PCOUNT * 3);
  const pVel = new Float32Array(PCOUNT * 3);
  const pLife = new Float32Array(PCOUNT);
  const pBase = new Float32Array(PCOUNT * 3);
  let pCursor = 0;
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.11, map: GLOW, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
  }));
  particles.frustumCulled = false;
  scene.add(particles);

  function burst(worldPos, color, n = 36, power = 1) {
    for (let k = 0; k < n; k++) {
      const i = pCursor; pCursor = (pCursor + 1) % PCOUNT;
      pPos[i * 3] = worldPos.x; pPos[i * 3 + 1] = worldPos.y; pPos[i * 3 + 2] = worldPos.z;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const sp = (1.2 + Math.random() * 2.4) * power;
      pVel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
      pVel[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * sp;
      pVel[i * 3 + 2] = Math.abs(Math.cos(ph)) * sp + 0.6;
      pLife[i] = 1;
      const c = color.clone().offsetHSL((Math.random() - 0.5) * 0.08, 0, Math.random() * 0.15);
      pBase[i * 3] = c.r * 2; pBase[i * 3 + 1] = c.g * 2; pBase[i * 3 + 2] = c.b * 2;
    }
  }
  function updateParticles(dt) {
    for (let i = 0; i < PCOUNT; i++) {
      if (pLife[i] <= 0) continue;
      pLife[i] -= dt * 1.4;
      const l = Math.max(pLife[i], 0);
      pVel[i * 3 + 1] -= dt * 1.6; // gravity
      pVel[i * 3] *= 0.985; pVel[i * 3 + 1] *= 0.985; pVel[i * 3 + 2] *= 0.985;
      pPos[i * 3] += pVel[i * 3] * dt;
      pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
      pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      pCol[i * 3] = pBase[i * 3] * l; pCol[i * 3 + 1] = pBase[i * 3 + 1] * l; pCol[i * 3 + 2] = pBase[i * 3 + 2] * l;
      if (l === 0) pPos[i * 3] = 9999;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }

  /* ------------------------------------------------------------------ */
  /* Input log + combos                                                  */
  /* ------------------------------------------------------------------ */
  const history = [];
  const KONAMI = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'circle', 'cross'];
  let partyUntil = 0;

  function logInput(ctrl) {
    if (!logEl) return;
    const empty = logEl.querySelector('.pad-hud__empty');
    if (empty) empty.remove();
    const k = document.createElement('span');
    k.className = 'pad-key';
    k.style.setProperty('--k', ctrl.css);
    k.textContent = ctrl.label;
    logEl.appendChild(k);
    while (logEl.children.length > 10) logEl.firstElementChild.remove();
  }

  const FACE_ORDER = ['triangle', 'circle', 'cross', 'square'];
  function checkCombos() {
    const last = history.slice(-KONAMI.length);
    if (last.join() === KONAMI.join()) { triggerParty('Konami Code! 🎉 Промокод KONAMI — +1 час к первой брони'); history.length = 0; return; }
    const last4 = history.slice(-4);
    if (last4.length === 4 && FACE_ORDER.every((id) => last4.includes(id)) && new Set(last4).size === 4) {
      toast('Комбо △○✕□! Ты точно наш игрок — забирай бесплатный час 👇');
      history.length = 0;
    }
  }

  function triggerParty(msg) {
    partyUntil = performance.now() + 4500;
    toast(msg, 6000);
    const wp = new THREE.Vector3();
    controls.forEach((c, i) => setTimeout(() => {
      c.group.getWorldPosition(wp);
      burst(wp, c.color, 18, 1.4);
      c.flash = 1;
    }, i * 60));
    shake = 0.25;
  }

  /* ------------------------------------------------------------------ */
  /* Press logic                                                         */
  /* ------------------------------------------------------------------ */
  let shake = 0;
  const tmpV = new THREE.Vector3();

  function pressDown(ctrl, source) {
    if (ctrl.held) return;
    ctrl.held = true;
    ctrl.flash = 1;
    ctrl.group.getWorldPosition(tmpV);
    tmpV.z += 0.2;
    burst(tmpV, ctrl.color, ctrl.kind === 'face' ? 42 : 26);
    shake = Math.min(0.12, shake + 0.06);
    if (navigator.vibrate && source === 'pointer') { try { navigator.vibrate(18); } catch (e) {} }
    logInput(ctrl);
    history.push(ctrl.id);
    if (history.length > 20) history.shift();
    checkCombos();
    // tint the hero glow with the button colour
    if (heroEl && ctrl.css) heroEl.style.setProperty('--pad-glow', ctrl.css);
  }
  function pressUp(ctrl) { ctrl.held = false; }

  /* ------------------------------------------------------------------ */
  /* Pointer interaction                                                 */
  /* ------------------------------------------------------------------ */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pointer = { x: 0, y: 0, inside: false }; // normalized -1..1 relative to the hero
  let hovered = null;
  let drag = null;  // {mode:'spin'|'stick', ...}
  const activePointers = new Map(); // pointerId -> ctrl (for multi-touch buttons)

  let spinY = 0, spinVelY = 0, spinX = 0, spinVelX = 0;

  function setNDC(e) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }
  function pick(e) {
    setNDC(e);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(hitMeshes, false)[0];
    return hit ? hit.object.userData.ctrl : null;
  }
  function overBody(e) {
    setNDC(e);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(bodyMesh, false).length > 0;
  }

  window.addEventListener('pointermove', (e) => {
    const r = (heroEl || stage).getBoundingClientRect();
    pointer.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    pointer.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    pointer.inside = e.clientY >= r.top && e.clientY <= r.bottom;

    if (drag && drag.id === e.pointerId) {
      const dx = e.clientX - drag.lastX, dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX; drag.lastY = e.clientY;
      if (drag.mode === 'spin') {
        spinVelY = dx * 0.012;
        spinVelX = dy * 0.006;
        spinY += spinVelY;
        spinX = Math.max(-0.8, Math.min(0.8, spinX + spinVelX));
        drag.moved += Math.abs(dx) + Math.abs(dy);
      } else if (drag.mode === 'stick') {
        const s = drag.stick;
        const ox = (e.clientX - drag.startX) / 55, oy = (e.clientY - drag.startY) / 55;
        const len = Math.hypot(ox, oy);
        const k = len > 1 ? 1 / len : 1;
        s.tx = ox * k; s.ty = oy * k;
      }
      return;
    }
    if (e.target === canvas && e.pointerType === 'mouse') {
      const c = pick(e);
      if (c !== hovered) {
        hovered = c;
        canvas.classList.toggle('is-hover', !!c);
      }
    }
  }, { passive: true });

  canvas.addEventListener('pointerdown', (e) => {
    const c = pick(e);
    if (c) {
      e.preventDefault();
      activePointers.set(e.pointerId, c);
      pressDown(c, 'pointer');
      if (c.kind === 'stick') {
        drag = { id: e.pointerId, mode: 'stick', stick: c.stick, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: 0 };
      }
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    // drag to spin — on touch only when touching the controller body so the page can still scroll
    if (e.pointerType === 'mouse' || overBody(e)) {
      if (e.pointerType !== 'mouse') e.preventDefault();
      drag = { id: e.pointerId, mode: 'spin', lastX: e.clientX, lastY: e.clientY, moved: 0 };
      canvas.classList.add('is-dragging');
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });
  function endPointer(e) {
    const c = activePointers.get(e.pointerId);
    if (c) { pressUp(c); activePointers.delete(e.pointerId); }
    if (drag && drag.id === e.pointerId) {
      if (drag.mode === 'stick') { drag.stick.tx = 0; drag.stick.ty = 0; }
      if (drag.mode === 'spin' && drag.moved > 160) spinBurst();
      drag = null;
      canvas.classList.remove('is-dragging');
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);
  canvas.addEventListener('pointerleave', () => { if (hovered) { hovered = null; canvas.classList.remove('is-hover'); } });
  // touch: block page scroll only while dragging the controller
  canvas.addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });

  let lastSpinBurst = 0;
  function spinBurst() {
    const now = performance.now();
    if (now - lastSpinBurst < 600) return;
    lastSpinBurst = now;
    burst(new THREE.Vector3(0, 0, 0.5), new THREE.Color(0x6a5bff), 30, 1.6);
  }

  /* ------------------------------------------------------------------ */
  /* Keyboard                                                            */
  /* ------------------------------------------------------------------ */
  const KEYMAP = {
    KeyI: 'triangle', KeyL: 'circle', KeyK: 'cross', KeyJ: 'square',
    KeyU: 'square', KeyO: 'circle',
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyQ: 'l1', KeyE: 'r1', KeyZ: 'l2', KeyC: 'r2', KeyH: 'home', Enter: 'options'
  };
  const stickKeys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };
  let heroVisible = true;
  const konamiKeys = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  const keyHist = [];

  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    keyHist.push(e.code); if (keyHist.length > 10) keyHist.shift();
    if (keyHist.join() === konamiKeys.join()) { triggerParty('Konami Code! 🎉 Промокод KONAMI — +1 час к первой брони'); keyHist.length = 0; }
    if (!heroVisible) return;
    if (e.code in stickKeys) { stickKeys[e.code] = true; return; }
    const id = KEYMAP[e.code];
    if (!id) return;
    // arrows only hijacked while the hero is at the top of the page
    if (e.code.startsWith('Arrow') && window.scrollY > 40) return;
    if (e.code.startsWith('Arrow') || e.code === 'Enter') e.preventDefault();
    if (!e.repeat) pressDown(byId[id], 'key');
  });
  window.addEventListener('keyup', (e) => {
    if (e.code in stickKeys) { stickKeys[e.code] = false; return; }
    const id = KEYMAP[e.code];
    if (id && byId[id]) pressUp(byId[id]);
  });

  /* ------------------------------------------------------------------ */
  /* Real gamepad (Gamepad API, standard mapping)                        */
  /* ------------------------------------------------------------------ */
  const GP_MAP = { 0: 'cross', 1: 'circle', 2: 'square', 3: 'triangle', 4: 'l1', 5: 'r1', 6: 'l2', 7: 'r2', 8: 'share', 9: 'options', 10: 'l3', 11: 'r3', 12: 'up', 13: 'down', 14: 'left', 15: 'right', 16: 'home', 17: 'touch' };
  const gpPrev = {};
  let gpActive = false;
  window.addEventListener('gamepadconnected', (e) => {
    gpActive = true;
    toast('🎮 Геймпад подключён — управляй 3D-моделью!');
  });
  window.addEventListener('gamepaddisconnected', () => { gpActive = false; });
  function pollGamepad() {
    if (!gpActive || !navigator.getGamepads) return null;
    const gp = Array.from(navigator.getGamepads()).find(Boolean);
    if (!gp) return null;
    gp.buttons.forEach((b, i) => {
      const id = GP_MAP[i];
      if (!id || !byId[id]) return;
      const p = b.pressed || b.value > 0.5;
      if (p && !gpPrev[i]) pressDown(byId[id], 'gamepad');
      if (!p && gpPrev[i]) pressUp(byId[id]);
      gpPrev[i] = p;
    });
    return gp;
  }

  /* ------------------------------------------------------------------ */
  /* Layout / resize                                                     */
  /* ------------------------------------------------------------------ */
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const needW = camera.aspect < 1.4 ? 6.3 : 5.6, needH = 4.3;
    camera.position.z = Math.max(needH / (2 * t), needW / (2 * t * camera.aspect));
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // pause rendering while off-screen
  let running = true;
  new IntersectionObserver(([en]) => {
    heroVisible = en.isIntersecting;
    running = en.isIntersecting && !document.hidden;
    if (running) start();
  }, { threshold: 0.02 }).observe(stage);
  document.addEventListener('visibilitychange', () => {
    const was = running;
    running = !document.hidden && heroVisible;
    if (running && !was) start();
  });

  /* ------------------------------------------------------------------ */
  /* Animation loop                                                      */
  /* ------------------------------------------------------------------ */
  const clock = new THREE.Clock();
  let tiltX = 0, tiltY = 0;
  const BASE_TILT_X = -0.32;
  const hueTmp = new THREE.Color();
  let rafScheduled = false;

  function loop() {
    rafScheduled = false;
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const now = performance.now();

    const gp = pollGamepad();

    // --- tilt toward the cursor ---
    const targetY = pointer.x * 0.5;
    const targetX = pointer.y * 0.32;
    tiltY += (targetY - tiltY) * Math.min(1, dt * 4);
    tiltX += (targetX - tiltX) * Math.min(1, dt * 4);

    // --- spin with inertia, spring back to nearest full turn ---
    if (!drag || drag.mode !== 'spin') {
      spinY += spinVelY;
      spinVelY *= 0.94;
      const home = Math.round(spinY / (Math.PI * 2)) * Math.PI * 2;
      if (Math.abs(spinVelY) < 0.06) spinVelY += (home - spinY) * 0.012;
      spinX += spinVelX; spinVelX *= 0.9;
      spinX += (0 - spinX) * Math.min(1, dt * 3);
    }

    pad.rotation.y = tiltY + spinY + (reduceMotion ? 0 : Math.sin(t * 0.6) * 0.05);
    pad.rotation.x = BASE_TILT_X + tiltX + spinX + (reduceMotion ? 0 : Math.sin(t * 0.8) * 0.03);
    pad.rotation.z = reduceMotion ? 0 : Math.sin(t * 0.5) * 0.03 - tiltY * 0.08;

    // --- float + shake ---
    root.position.y = reduceMotion ? 0 : Math.sin(t * 1.1) * 0.09;
    shake *= Math.pow(0.0015, dt);
    root.position.x = (Math.random() - 0.5) * shake;
    root.position.z = (Math.random() - 0.5) * shake * 0.6;

    // --- sticks ---
    const L = sticks.L, R = sticks.R;
    if (!(drag && drag.mode === 'stick' && drag.stick === L)) {
      const kx = (stickKeys.KeyD ? 1 : 0) - (stickKeys.KeyA ? 1 : 0);
      const ky = (stickKeys.KeyS ? 1 : 0) - (stickKeys.KeyW ? 1 : 0);
      if (gp && (Math.abs(gp.axes[0]) > 0.08 || Math.abs(gp.axes[1]) > 0.08)) { L.tx = gp.axes[0]; L.ty = gp.axes[1]; }
      else if (kx || ky) { const n = Math.hypot(kx, ky); L.tx = kx / n; L.ty = ky / n; }
      else { L.tx = pointer.x * 0.35; L.ty = pointer.y * 0.35; }
    }
    if (!(drag && drag.mode === 'stick' && drag.stick === R)) {
      if (gp && (Math.abs(gp.axes[2]) > 0.08 || Math.abs(gp.axes[3]) > 0.08)) { R.tx = gp.axes[2]; R.ty = gp.axes[3]; }
      else { R.tx = pointer.x * 0.35; R.ty = pointer.y * 0.35; }
    }
    [L, R].forEach((s) => {
      s.vx += (s.tx - s.vx) * Math.min(1, dt * 14);
      s.vy += (s.ty - s.vy) * Math.min(1, dt * 14);
      s.pivot.rotation.y = s.vx * 0.42;
      s.pivot.rotation.x = s.vy * 0.42;
      const mag = Math.min(1, Math.hypot(s.vx, s.vy));
      s.ring.material.color.copy(s.color).multiplyScalar(1 + mag * 1.6);
      s.ringGlow.material.opacity = 0.2 + mag * 0.5;
    });

    // --- controls press / flash ---
    const party = now < partyUntil;
    controls.forEach((c, i) => {
      const target = c.held ? 1 : 0;
      c.value += (target - c.value) * Math.min(1, dt * (c.held ? 30 : 14));
      c.flash = Math.max(0, c.flash - dt * 2.2);
      const hov = hovered === c ? 1 : 0;
      c.hover += (hov - c.hover) * Math.min(1, dt * 10);
      c.group.position.copy(c.basePos).addScaledVector(c.pressDir, c.depth * c.value);
      let e = c.baseEmissive + c.flash * 2.2 + c.value * 0.6 + c.hover * 0.35;
      if (party) e += 0.8 + Math.sin(t * 10 + i) * 0.6;
      c.mat.emissiveIntensity = e;
      if (c.glow) c.glow.material.opacity = c.glow.userData.baseOpacity + c.flash * 0.8 + c.hover * 0.25 + c.value * 0.3;
    });

    // --- lights / light bar ---
    if (party) {
      hueTmp.setHSL((t * 0.6) % 1, 0.9, 0.6);
      blueLight.color.copy(hueTmp);
      violetLight.color.setHSL((t * 0.6 + 0.4) % 1, 0.9, 0.6);
      lightBarMat.color.copy(hueTmp);
    } else {
      blueLight.color.lerp(new THREE.Color(0x3b5bff), 0.05);
      violetLight.color.lerp(new THREE.Color(0xb44bff), 0.05);
      const pulse = 0.75 + Math.sin(t * 2.2) * 0.25;
      lightBarMat.color.setRGB(0.55 * pulse * 1.4, 0.42 * pulse * 1.4, 1.0 * pulse * 1.4);
    }
    lightBarGlow.material.color.copy(lightBarMat.color);
    halo.material.opacity = 0.32 + Math.sin(t * 1.3) * 0.05 + shake * 1.2;

    // --- ambient ---
    if (!reduceMotion) {
      cubes.forEach((m) => {
        const u = m.userData;
        m.rotation.x += dt * u.speed * 0.6;
        m.rotation.y += dt * u.speed;
        m.position.y = u.base.y + Math.sin(t * u.speed + u.phase) * 0.25;
        m.position.x = u.base.x - pointer.x * 0.35 * (1 + u.base.z * -0.2);
      });
      dust.rotation.y = t * 0.01;
      dust.position.x = -pointer.x * 0.25;
    }

    updateParticles(dt);
    renderer.render(scene, camera);
    if (!rafScheduled) { rafScheduled = true; requestAnimationFrame(loop); }
  }
  function start() {
    if (rafScheduled) return;
    clock.getDelta();
    rafScheduled = true;
    requestAnimationFrame(loop);
  }
  start();
}
