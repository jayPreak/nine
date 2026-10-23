import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

try { history.scrollRestoration = "manual"; } catch (e) {}
window.scrollTo(0, 0);
const C = window.NINE;
const $ = (id) => document.getElementById(id);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const heartPath = "M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3 5.5 6.2 5.5c2 0 3.4 1.1 4.3 2.5.3.4.9.4 1.2 0 .9-1.4 2.3-2.5 4.3-2.5 3.2 0 5 3.1 3.7 6.3C19.5 16.4 12 21 12 21z";

/* ───────────── Text from content.js ───────────── */
$("herName").textContent = C.herName;
$("tagline").textContent = C.heroTagline;
$("greeting").textContent = C.letterGreeting;
$("signoff").textContent = C.letterSignoff;
$("signature").textContent = C.letterSignature;
$("closing").textContent = C.closingLine;
$("yourName").textContent = C.yourName;
document.title = `Nine Months · ${C.herName}`;
document.querySelectorAll(".reveal-line").forEach((el, i) => el.style.setProperty("--d", i * 0.12));

const body = $("letterBody");
C.letter.forEach((t) => {
  const p = document.createElement("p");
  p.className = "para";
  p.textContent = t;
  body.appendChild(p);
});
const gl = $("galleryList");
C.gallery.forEach((g) => {
  const li = document.createElement("li");
  li.textContent = `${g.type}: ${g.caption}`;
  gl.appendChild(li);
});

/* ───────────── Counter ───────────── */
const start = new Date(C.startDate + "T00:00:00");
const tick = () => {
  const s = Math.max(0, Math.floor((Date.now() - start) / 1000));
  $("cDays").textContent = Math.floor(s / 86400);
  $("cHours").textContent = Math.floor((s % 86400) / 3600);
  $("cMin").textContent = Math.floor((s % 3600) / 60);
  $("cSec").textContent = s % 60;
};
tick();
setInterval(tick, 1000);

/* ───────────── Smooth scroll ───────────── */
let lenis = null;
if (window.Lenis && !reduce) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothTouch: false });
}
document.querySelectorAll('a[href^="#"]').forEach((a) =>
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const t = id === "#top" ? 0 : document.querySelector(id);
    if (t === null) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(t, { duration: 2.2 });
    else (t === 0 ? window : t).scrollIntoView?.({ behavior: "smooth" }) || window.scrollTo({ top: 0, behavior: "smooth" });
  })
);

/* ───────────── WebGL world ───────────── */
const canvas = $("gl");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
} catch (e) {
  renderer = null;
}

const photoMeshes = [];
const backdrops = [];
const photoData = C.gallery.map((g, i) => ({ ...g, i }));
let world = null;

function buildHeartGeometry(depth = 0.34, bevel = 0.1) {
  const s = new THREE.Shape();
  s.moveTo(0.25, 0.25);
  s.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0);
  s.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35);
  s.bezierCurveTo(-0.3, 0.55, -0.1, 0.77, 0.25, 0.95);
  s.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35);
  s.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0);
  s.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSegments: 10, bevelSize: bevel, bevelThickness: bevel, curveSegments: 40 });
  g.rotateZ(Math.PI);
  g.center();
  return g;
}

function softSprite(inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)") {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.35, inner.replace(/[\d.]+\)$/, "0.45)"));
  gr.addColorStop(1, outer);
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Palette that the sky/fog moves through as you scroll */
const stops = [
  { t: 0.0, top: "#d8447f", bot: "#ffc9de", glow: "#ffe3ee" },
  { t: 0.3, top: "#b92f6c", bot: "#ffb1cf", glow: "#ffe0d0" },
  { t: 0.62, top: "#8f1d55", bot: "#f58cb4", glow: "#ffcfb5" },
  { t: 0.86, top: "#4a0f33", bot: "#d94f86", glow: "#ffb48a" },
  { t: 1.0, top: "#2a0a1e", bot: "#b83a74", glow: "#ff9a86" },
].map((s) => ({ t: s.t, top: new THREE.Color(s.top), bot: new THREE.Color(s.bot), glow: new THREE.Color(s.glow) }));
const tmpA = new THREE.Color();
function palette(t, out) {
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1].t) i++;
  const a = stops[i], b = stops[i + 1];
  const k = clamp((t - a.t) / (b.t - a.t), 0, 1);
  const e = k * k * (3 - 2 * k);
  out.top.copy(a.top).lerp(b.top, e);
  out.bot.copy(a.bot).lerp(b.bot, e);
  out.glow.copy(a.glow).lerp(b.glow, e);
}

function initWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffe0ec, 6, 44);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x3a0f28);
  const panel = (c, i, x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m); };
  panel(0xffffff, 6, 6, 8, 6, 10, 6); panel(0xff7ab0, 4, -8, 2, 4, 8, 10); panel(0xffd0e2, 3, 0, -6, -8, 14, 5); panel(0xff3d8b, 3, 8, -2, -6, 6, 10); panel(0xffffff, 3, -4, 6, -9, 12, 3);
  scene.environment = pmrem.fromScene(envScene, 0.03).texture;

  scene.add(new THREE.HemisphereLight(0xffd6e6, 0xff7fb0, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rose = new THREE.PointLight(0xff4f9a, 40, 22, 1.6);
  scene.add(rose);

  /* path the camera flies along */
  const curve = new THREE.CatmullRomCurve3(
    [
      [0, 0.25, 7], [0, 0.1, 2], [1.3, 0.35, -8], [-1.2, 0.6, -20], [1, 0.2, -34], [-1.6, 0.7, -48],
      [1.6, 0.2, -62], [-1.2, 0.6, -76], [1.2, 0.2, -90], [-0.8, 0.5, -104], [0, 0.3, -118], [0, 0.2, -130],
    ].map((p) => new THREE.Vector3(...p)),
    false, "catmullrom", 0.5
  );

  /* sky dome */
  const skyU = { uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
      fragmentShader: `varying vec3 vP; uniform vec3 uTop, uBot, uGlow;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vP);
          float y = smoothstep(-0.35, 0.65, d.y);
          vec3 c = mix(uBot, uTop, y);
          float g = pow(max(dot(d, normalize(vec3(0.15, 0.08, -1.))), 0.), 5.);
          c += uGlow * g * 0.2;
          c += (h(gl_FragCoord.xy) - .5) / 140.;
          gl_FragColor = vec4(c, 1.);
        }`,
    })
  );
  sky.renderOrder = -10;
  scene.add(sky);

  /* ── hero heart ── */
  const heartGeo = buildHeartGeometry();
  const heartMat = new THREE.MeshPhysicalMaterial({
    color: 0xd81b60, roughness: 0.22, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.04,
    iridescence: 0.7, iridescenceIOR: 1.5, sheen: 1, sheenColor: new THREE.Color(0xffc2dc), envMapIntensity: 1.5,
  });
  const heart = new THREE.Mesh(heartGeo, heartMat);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite("rgba(255,120,175,1)"), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.scale.setScalar(7.5);
  halo.position.z = -0.6;
  const heartGroup = new THREE.Group();
  heartGroup.add(halo, heart);
  scene.add(heartGroup);

  const endHeart = new THREE.Group();
  const eh = new THREE.Mesh(heartGeo, heartMat);
  const eHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite("rgba(255,170,200,1)"), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  eHalo.scale.setScalar(9); eHalo.position.z = -1;
  endHeart.add(eHalo, eh);
  endHeart.position.set(0, 2.7, -140);
  endHeart.scale.setScalar(1.6);
  scene.add(endHeart);

  /* ── floating mini hearts ── */
  const MINI = coarse ? 60 : 110;
  const miniGeo = buildHeartGeometry(0.28, 0.08);
  miniGeo.scale(0.28, 0.28, 0.28);
  const miniMat = new THREE.MeshPhysicalMaterial({ color: 0xff7bb0, roughness: 0.18, clearcoat: 1, envMapIntensity: 1.4, iridescence: 0.5 });
  const minis = new THREE.InstancedMesh(miniGeo, miniMat, MINI);
  const miniState = [];
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const miniCols = ["#ff7bb0", "#ffffff", "#ff4f9a", "#ffb3d1", "#ffa07a"];
  for (let i = 0; i < MINI; i++) {
    const u = 0.1 + Math.random() * 0.9;
    const p = curve.getPointAt(u);
    const a = Math.random() * Math.PI * 2, r = 3.2 + Math.random() * 9;
    const st = { base: new THREE.Vector3(p.x + Math.cos(a) * r, p.y + (Math.random() - 0.5) * 8, p.z + Math.sin(a) * r * 0.6), s: 0.5 + Math.random() * 1.3, sp: 0.2 + Math.random() * 0.6, ph: Math.random() * 9, rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6) };
    miniState.push(st);
    minis.setColorAt(i, col.set(miniCols[(Math.random() * miniCols.length) | 0]));
  }
  scene.add(minis);

  /* ── particle dust ── */
  const N = reduce ? 500 : coarse ? 1400 : 3000;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N), size = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const p = curve.getPointAt(Math.random());
    const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.6) * 16;
    pos.set([p.x + Math.cos(a) * r, p.y + (Math.random() - 0.5) * 14, p.z + Math.sin(a) * r], i * 3);
    seed[i] = Math.random() * 100;
    size[i] = 0.5 + Math.random() * 1.6;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  pg.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  pg.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const dustU = { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uTint: { value: new THREE.Color("#ffffff") } };
  const dust = new THREE.Points(
    pg,
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: dustU,
      vertexShader: `attribute float aSeed; attribute float aSize; uniform float uTime, uPx; varying float vA;
        void main(){
          vec3 p = position;
          p.y += sin(uTime*.4 + aSeed) * .6 + mod(uTime*.12 + aSeed, 1.) * 0.;
          p.x += cos(uTime*.3 + aSeed*1.7) * .5;
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_Position = projectionMatrix * mv;
          float tw = .55 + .45 * sin(uTime*1.4 + aSeed*3.);
          vA = tw * smoothstep(60., 6., -mv.z) * smoothstep(2.5, 7., -mv.z);
          gl_PointSize = min(aSize * uPx * (90. / -mv.z), 26. * uPx);
        }`,
      fragmentShader: `uniform vec3 uTint; varying float vA;
        void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d); a *= a; gl_FragColor = vec4(uTint, a * vA * .9); }`,
    })
  );
  dust.frustumCulled = false;
  scene.add(dust);

  /* ── photo / video planes ── */
  const loader = new THREE.TextureLoader();
  const photoU = () => ({
    uMap: { value: null }, uAspect: { value: 0.75 }, uVel: { value: 0 }, uHover: { value: 0 }, uFog: { value: new THREE.Color() }, uReveal: { value: 0 }, uTime: { value: 0 }, uHaze: { value: 0 },
  });
  const photoMat = (u) =>
    new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, uniforms: u,
      vertexShader: `uniform float uVel, uHover, uTime; varying vec2 vUv; varying float vD;
        void main(){
          vUv = uv; vec3 p = position;
          float bend = sin(uv.x * 3.14159) * uVel * 0.9;
          p.z += bend + sin(uTime*.8 + uv.y*3.) * .035 + uHover * .15;
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          vD = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uAspect, uHover, uReveal, uHaze; uniform vec3 uFog; varying vec2 vUv; varying float vD;
        float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
        void main(){
          vec2 p = (vUv - .5) * vec2(uAspect, 1.);
          vec2 hs = vec2(uAspect, 1.) * .5;
          float d = rbox(p, hs, .05);
          float aa = fwidth(d) * 1.2;
          float alpha = 1. - smoothstep(-aa, aa, d);
          float bw = .028;
          vec2 ih = hs - bw;
          vec2 uv = p / (2. * ih) + .5;
          bool inside = abs(p.x) < ih.x && abs(p.y) < ih.y;
          vec3 img = texture2D(uMap, uv).rgb;
          vec3 frame = vec3(1., .965, .985);
          vec3 c = inside ? img : frame;
          c *= 1. + uHover * .07;
          c = mix(c, vec3(1., .88, .93), (1. - smoothstep(0.2, 1., vUv.y)) * .0);
          float fogA = clamp(smoothstep(9., 44., vD) + uHaze, 0., 1.);
          c = mix(c, uFog, fogA * .85);
          float fade = (1. - smoothstep(16., 30., vD)) * smoothstep(1.5, 5.5, vD) * uReveal;
          gl_FragColor = vec4(c, alpha * fade);
          #include <colorspace_fragment>
        }`,
    });

  const loadingTextures = photoData.map(async (g) => {
    const u = photoU();
    const mat = photoMat(u);
    const src = g.type === "video" ? g.poster : g.src;
    const tex = await loader.loadAsync(src);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    u.uMap.value = tex;
    const aspect = tex.image.width / tex.image.height;
    u.uAspect.value = aspect;
    const h = g.type === "video" ? (aspect > 1 ? 3.6 : 5) : 5;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h, 24, 24), mat);
    mesh.userData = { i: g.i, g, u, h, w: h * aspect, tex, posterTex: tex, video: null, videoTex: null, targetHover: 0, phase: Math.random() * 6 };
    if (g.type === "video") {
      const v = document.createElement("video");
      v.src = g.src; v.muted = true; v.loop = true; v.playsInline = true; v.preload = "metadata"; v.crossOrigin = "anonymous";
      mesh.userData.video = v;
      mesh.userData.videoTex = new THREE.VideoTexture(v);
      mesh.userData.videoTex.colorSpace = THREE.SRGBColorSpace;
    }
    scene.add(mesh);
    photoMeshes[g.i] = mesh;
    const bu = photoU();
    bu.uMap.value = tex; bu.uAspect.value = aspect; bu.uHaze.value = 0.55;
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h, 8, 8), photoMat(bu));
    bd.userData = { u: bu, phase: Math.random() * 6 };
    scene.add(bd);
    backdrops[g.i] = bd;
  });

  world = { endHeart, eh, scene, camera, curve, sky, skyU, heart, heartGroup, halo, minis, miniState, dummy, dust, dustU, rose, loadingTextures, key };
  return world;
}

/* ───────────── Layout: place photos along the curve from the DOM ───────────── */
let g0 = 0.3, g1 = 0.85, maxScroll = 1;
const tangent = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4();
const photoU = [];

function layout() {
  if (!world) return;
  const { camera, curve } = world;
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 66 : w / h < 1.3 ? 58 : 52;
  camera.updateProjectionMatrix();

  const gal = $("gallery");
  gal.style.minHeight = `${(C.gallery.length * 0.7 + 1.1) * 100}svh`;
  maxScroll = Math.max(1, document.documentElement.scrollHeight - h);
  g0 = clamp((gal.offsetTop + h * 0.45) / maxScroll, 0.05, 0.9);
  g1 = clamp((gal.offsetTop + gal.offsetHeight - h * 0.2) / maxScroll, g0 + 0.05, 0.98);

  const portrait = w / h < 0.9;
  const N = photoMeshes.length;
  photoMeshes.forEach((mesh, idx) => {
    if (!mesh) return;
    const { w: pw, h: ph } = mesh.userData;
    const u = lerp(g0, g1, (idx + 0.5) / N);
    photoU[idx] = u;
    const p = curve.getPointAt(clamp(u, 0, 1));
    curve.getTangentAt(clamp(u, 0, 1), tangent);
    right.crossVectors(tangent, up).normalize();
    const side = idx % 2 === 0 ? -1 : 1;
    const scale = portrait ? 0.78 : 1;
    const lateral = portrait ? side * (0.3 + (idx % 3) * 0.12) : side * (pw * 0.5 * scale + 1.9 + (idx % 3) * 0.25);
    mesh.scale.setScalar(scale);
    mesh.position.copy(p).addScaledVector(right, lateral);
    mesh.position.y += (((idx * 7) % 5) - 2) * 0.22 + (portrait ? 0.15 : 0);
    m4.lookAt(mesh.position, mesh.position.clone().sub(tangent), up);
    mesh.quaternion.setFromRotationMatrix(m4);
    mesh.rotateY(-side * (portrait ? 0.18 : 0.34));
    mesh.rotateZ(side * 0.04);
    mesh.userData.baseY = mesh.position.y;

    const bd = backdrops[idx];
    if (bd) {
      const bu2 = clamp(u + (idx % 2 ? 0.012 : -0.012), 0, 1);
      const bp = curve.getPointAt(bu2);
      bd.scale.setScalar((portrait ? 1.4 : 1.9));
      bd.position.copy(bp).addScaledVector(right, -side * (portrait ? 3.4 : 7 + (idx % 3) * 1.2));
      bd.position.y += ((idx * 5) % 4 - 1.5) * 1.1;
      bd.lookAt(bd.position.clone().sub(tangent));
      bd.rotateY(side * 0.5);
      bd.userData.baseY = bd.position.y;
    }
  });

  /* hero heart placement depends on viewport */
  const wide = w / h > 1.2;
  world.heartGroup.userData.home = wide ? new THREE.Vector3(3.1, 0.15, 0) : new THREE.Vector3(1.15, -1.7, 0);
  world.heartGroup.userData.scale = wide ? 2.1 : 1.25;
}

/* ───────────── Interaction state ───────────── */
const pointer = { x: 0, y: 0, sx: 0, sy: 0, cx: -100, cy: -100, rx: -100, ry: -100 };
addEventListener("pointermove", (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -((e.clientY / innerHeight) * 2 - 1);
  pointer.cx = e.clientX; pointer.cy = e.clientY;
  $("cursor").classList.add("on");
}, { passive: true });
if (matchMedia("(hover: hover) and (pointer: fine)").matches) document.body.classList.add("has-cursor");

const cursorEl = $("cursor");
document.addEventListener("pointerover", (e) => {
  if (e.target.closest && e.target.closest("[data-hover], button, a")) cursorEl.classList.add("big");
});
document.addEventListener("pointerout", (e) => {
  if (e.target.closest && e.target.closest("[data-hover], button, a")) cursorEl.classList.remove("big");
});

/* ───────────── Lightbox ───────────── */
const lb = $("lightbox"), stage = $("lbStage");
let cur = 0, lastFocus = null;
const showLb = (i) => {
  cur = (i + C.gallery.length) % C.gallery.length;
  const g = C.gallery[cur];
  stage.innerHTML = "";
  let el;
  if (g.type === "video") {
    el = document.createElement("video");
    el.src = g.src; el.poster = g.poster; el.controls = true; el.autoplay = true; el.playsInline = true;
  } else {
    el = document.createElement("img");
    el.src = g.src; el.alt = g.caption;
  }
  const cap = document.createElement("figcaption");
  cap.textContent = g.caption;
  stage.append(el, cap);
};
function openLb(i) {
  lastFocus = document.activeElement;
  lb.hidden = false;
  lenis && lenis.stop();
  document.body.style.overflow = "hidden";
  showLb(i);
  $("lbClose").focus();
}
function closeLb() {
  lb.hidden = true;
  stage.innerHTML = "";
  document.body.style.overflow = "";
  lenis && lenis.start();
  lastFocus && lastFocus.focus();
}
$("lbClose").onclick = closeLb;
$("lbPrev").onclick = () => showLb(cur - 1);
$("lbNext").onclick = () => showLb(cur + 1);
lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });
addEventListener("keydown", (e) => {
  if (lb.hidden) return;
  if (e.key === "Escape") closeLb();
  if (e.key === "ArrowLeft") showLb(cur - 1);
  if (e.key === "ArrowRight") showLb(cur + 1);
});
let sx = 0;
lb.addEventListener("touchstart", (e) => (sx = e.touches[0].clientX), { passive: true });
lb.addEventListener("touchend", (e) => {
  const dx = e.changedTouches[0].clientX - sx;
  if (Math.abs(dx) > 60) showLb(cur + (dx < 0 ? 1 : -1));
});

/* ───────────── Hearts burst (DOM) ───────────── */
function burst(x, y, n = 30) {
  const colors = ["#ff5fa2", "#ff9ec4", "#ffffff", "#ff3d8b", "#ffc2dc"];
  for (let i = 0; i < n; i++) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    el.setAttribute("viewBox", "0 0 24 24");
    const s = 14 + Math.random() * 26;
    el.setAttribute("width", s); el.setAttribute("height", s);
    el.setAttribute("class", "hearts-burst");
    el.style.color = colors[(Math.random() * colors.length) | 0];
    el.innerHTML = `<path fill="currentColor" d="${heartPath}"/>`;
    document.body.appendChild(el);
    const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 260;
    const dx = Math.cos(a) * v, dy = Math.sin(a) * v - 140;
    const rot = (Math.random() - 0.5) * 540;
    el.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(.3) rotate(0)`, opacity: 1 },
        { transform: `translate(${x + dx}px, ${y + dy}px) scale(1) rotate(${rot}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${x + dx * 1.1}px, ${y + dy + 260}px) scale(.8) rotate(${rot * 1.4}deg)`, opacity: 0 },
      ],
      { duration: 1700 + Math.random() * 900, easing: "cubic-bezier(.2,.7,.3,1)" }
    ).onfinish = () => el.remove();
  }
}
$("confettiBtn").addEventListener("click", (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, 70);
});

/* ───────────── Envelope → letter ───────────── */
const env = $("envelope"), paper = $("paper");
env.addEventListener("click", () => {
  if (env.classList.contains("open")) return;
  env.classList.add("open");
  env.setAttribute("aria-expanded", "true");
  const r = env.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, 34);
  setTimeout(() => {
    paper.hidden = false;
    layoutSoon();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      paper.classList.add("show");
      lenis ? lenis.scrollTo(paper, { duration: 1.8, offset: -80 }) : paper.scrollIntoView({ behavior: "smooth", block: "start" });
      paper.querySelectorAll(".para, .signoff, .signature").forEach((p, i) =>
        setTimeout(() => p.classList.add("in"), reduce ? 0 : 900 + i * 700));
    }));
  }, reduce ? 0 : 900);
});

/* ───────────── Reveal on scroll ───────────── */
const io = new IntersectionObserver((es) => es.forEach((en) => {
  if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
}), { threshold: 0.18 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

/* ───────────── Main loop ───────────── */
let layoutTimer = 0;
function layoutSoon() { clearTimeout(layoutTimer); layoutTimer = setTimeout(layout, 120); }
addEventListener("resize", layoutSoon);

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = -1, tSmooth = 0, tTarget = 0, vel = 0, lastT = 0;
const pal = { top: new THREE.Color(), bot: new THREE.Color(), glow: new THREE.Color() };
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpV = new THREE.Vector3();
const clock = new THREE.Clock();
const hudCap = $("hudCap");
let capIdx = -1;
let downPos = null;

addEventListener("pointerdown", (e) => { downPos = { x: e.clientX, y: e.clientY }; });
addEventListener("pointerup", (e) => {
  if (!downPos || !world || !lb.hidden) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  downPos = null;
  if (moved > 8 || e.target.closest("button, a, .paper, .hud")) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
  ray.setFromCamera(ndc, world.camera);
  const hit = ray.intersectObjects(photoMeshes.filter(Boolean), false)[0];
  if (hit) openLb(hit.object.userData.i);
});

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  const { scene, camera, curve } = world;

  const sc = scrollY;
  tTarget = clamp(sc / maxScroll, 0, 1);
  tSmooth = reduce ? tTarget : lerp(tSmooth, tTarget, 1 - Math.pow(0.0009, dt));
  vel = lerp(vel, clamp((tSmooth - lastT) / Math.max(dt, 0.001) * 1.6, -1, 1), 0.1);
  lastT = tSmooth;
  pointer.sx = lerp(pointer.sx, pointer.x, 0.05);
  pointer.sy = lerp(pointer.sy, pointer.y, 0.05);

  /* camera */
  curve.getPointAt(clamp(tSmooth, 0, 1), camPos);
  curve.getPointAt(clamp(tSmooth + 0.018, 0, 1), camLook);
  if (tSmooth > 0.985) camLook.z = camPos.z - 5;
  camera.position.copy(camPos);
  camera.position.x += pointer.sx * 0.35;
  camera.position.y += pointer.sy * 0.22;
  camera.lookAt(camLook);
  camera.rotateZ(-vel * 0.06 + pointer.sx * -0.015);
  world.rose.position.copy(camPos).add(tmpV.set(0.5, 1.5, -2.5));

  /* palette */
  palette(tSmooth, pal);
  world.skyU.uTop.value.copy(pal.top);
  world.skyU.uBot.value.copy(pal.bot);
  world.skyU.uGlow.value.copy(pal.glow);
  world.sky.position.copy(camera.position);
  tmpA.copy(pal.bot).lerp(pal.top, 0.35);
  scene.fog.color.copy(tmpA);
  scene.fog.far = lerp(52, 36, smooth(tSmooth, 0.7, 1));
  world.dustU.uTime.value = time;

  /* hero heart */
  const hh = world.heartGroup;
  const home = hh.userData.home, hs = hh.userData.scale;
  if (home) {
    const beat = 1 + Math.pow(Math.max(0, Math.sin(time * 2.2)), 8) * 0.07 + Math.pow(Math.max(0, Math.sin(time * 2.2 - 0.6)), 10) * 0.04;
    const s = hs * beat * lerp(1, 0.001, smooth(tSmooth, 0.1, 0.16));
    hh.scale.setScalar(Math.max(s, 0.0001));
    hh.position.set(home.x + pointer.sx * 0.25, home.y + Math.sin(time * 0.9) * 0.12 + pointer.sy * 0.15, home.z);
    world.heart.rotation.y = Math.sin(time * 0.5) * 0.45 + pointer.sx * 0.5;
    world.heart.rotation.x = Math.sin(time * 0.37) * 0.12 - pointer.sy * 0.25;
    hh.visible = s > 0.002;
    world.halo.material.opacity = 0.8 * (1 - smooth(tSmooth, 0.04, 0.12));
  }

  /* finale heart */
  const eb = 1 + Math.pow(Math.max(0, Math.sin(time * 2.2)), 8) * 0.06;
  world.endHeart.scale.setScalar(1.6 * eb);
  world.eh.rotation.y = Math.sin(time * 0.6) * 0.5;
  document.body.classList.toggle("tone-dark", tSmooth > 0.2);
  world.endHeart.visible = tSmooth > 0.8;

  /* mini hearts */
  world.miniState.forEach((st, i) => {
    const d = world.dummy;
    d.position.set(st.base.x + Math.sin(time * st.sp + st.ph) * 0.5, st.base.y + Math.sin(time * st.sp * 1.3 + st.ph) * 0.8, st.base.z);
    d.rotation.set(st.rot.x + time * st.sp * 0.5, st.rot.y + time * st.sp * 0.7, st.rot.z);
    d.scale.setScalar(st.s);
    d.updateMatrix();
    world.minis.setMatrixAt(i, d.matrix);
  });
  world.minis.instanceMatrix.needsUpdate = true;

  /* photos */
  ndc.set(pointer.x, pointer.y);
  ray.setFromCamera(ndc, camera);
  const visible = photoMeshes.filter(Boolean);
  const hit = lb.hidden && matchMedia("(hover:hover)").matches ? ray.intersectObjects(visible, false)[0] : null;
  const hi = hit ? hit.object.userData.i : -1;
  if (hi !== hovered) { hovered = hi; cursorEl.classList.toggle("big", hi >= 0); }
  let nearest = -1, nd = 9;
  visible.forEach((m) => {
    const ud = m.userData, u = ud.u.uniforms ? null : null;
    const U = ud.u;
    U.uTime.value = time + ud.phase;
    U.uVel.value = lerp(U.uVel.value, vel * 1.4, 0.15);
    U.uHover.value = lerp(U.uHover.value, hovered === ud.i ? 1 : 0, 0.12);
    U.uFog.value.copy(scene.fog.color);
    const du = Math.abs(photoU[ud.i] - tSmooth);
    U.uReveal.value = lerp(U.uReveal.value, 1, 0.04);
    m.position.y = ud.baseY + Math.sin(time * 0.6 + ud.phase) * 0.12;
    if (du < nd) { nd = du; nearest = ud.i; }
    const bd = backdrops[ud.i];
    if (bd) { const B = bd.userData.u; B.uTime.value = time; B.uVel.value = U.uVel.value; B.uFog.value.copy(scene.fog.color); B.uReveal.value = U.uReveal.value * 0.6; bd.position.y = bd.userData.baseY + Math.sin(time * 0.4 + bd.userData.phase) * 0.2; }
    if (ud.video) {
      const near = du < 0.04;
      if (near && ud.video.paused) {
        ud.video.play().then(() => { U.uMap.value = ud.videoTex; }).catch(() => {});
      } else if (!near && !ud.video.paused) {
        ud.video.pause();
        U.uMap.value = ud.posterTex;
      }
    }
  });

  /* HUD */
  const inGallery = tSmooth > g0 - 0.03 && tSmooth < g1 + 0.02 && nearest >= 0;
  hudCap.classList.toggle("show", inGallery);
  if (inGallery && nearest !== capIdx) {
    capIdx = nearest;
    $("hcNum").textContent = String(nearest + 1).padStart(2, "0") + " / " + String(C.gallery.length).padStart(2, "0");
    $("hcText").textContent = C.gallery[nearest].caption;
  }
  $("progBar").style.transform = `scaleY(${tTarget})`;

  renderer.render(scene, camera);

  /* custom cursor */
  pointer.rx = lerp(pointer.rx, pointer.cx, 0.22);
  pointer.ry = lerp(pointer.ry, pointer.cy, 0.22);
  cursorEl.style.transform = `translate(${pointer.rx}px, ${pointer.ry}px)`;
}
function smooth(v, a, b) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

/* ───────────── Boot ───────────── */
async function boot() {
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  let progress = 0;
  const setProgress = (p) => {
    progress = Math.max(progress, p);
    $("loadNum").textContent = Math.min(9, Math.floor(progress * 9.999));
    $("loadBar").style.width = progress * 100 + "%";
  };

  if (!renderer) {
    document.body.classList.add("no-gl");
    setProgress(1);
  } else {
    initWorld();
    let done = 0;
    const total = world.loadingTextures.length + 1;
    const bump = () => setProgress(++done / total);
    await Promise.all([...world.loadingTextures.map((p) => p.then(bump, bump)), fonts.then(bump)]);
    layout();
  }
  await new Promise((r) => setTimeout(r, 450));
  $("loader").classList.add("done");
  document.body.classList.remove("is-loading");
  setTimeout(() => ($("loader").style.display = "none"), 1600);

  if (renderer) {
    layout();
    const raf = (t) => { lenis && lenis.raf(t); frame(); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    new ResizeObserver(layoutSoon).observe(document.body);
  } else {
    const raf = (t) => { lenis && lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
}
boot();

window.__nine = { get t() { return tSmooth; }, get g() { return [g0, g1, maxScroll]; }, photoU };
