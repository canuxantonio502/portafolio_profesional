/* La foto del hero se convierte en rueda.
   - Al pasar el mouse (o con el foco del teclado) la foto gira como moneda y
     aparece la rueda 3D, rodando despacio. Al salir vuelve la foto.
   - Al hacer click la rueda gira a toda velocidad y frena. Otro click mientras
     frena la vuelve a acelerar. En pantallas táctiles, un toque hace todo.
   Alrededor, mientras gira:
     - líneas de velocidad con el color de acento,
     - el disco de freno se pone al rojo vivo al frenar y se enfría,
     - lluvia de chispas desde la parte baja de la llanta (rebotan en el "piso")
       y desde la pinza, donde roza el disco.
   La pinza de freno queda fija, como en un auto real.
   Modelo: "Car wheel with brake disc - Low poly" de Márcio Meireles (CC BY 4.0). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const MODEL_URL = './models/wheel-web/scene.gltf';
const SPINNING = ['tire-low', 'wheel-full', 'brake-disc']; // la pinza ('brake-caliper') no gira
const PAD = 0.3; // lienzo 3D: 30% más grande por lado que la foto (160%)
const FX = 2.6; // lienzo de efectos: 2.6 veces la foto, para que las chispas vuelen lejos

const photo = document.querySelector('.hero-photo');
const btn = photo && photo.querySelector('.photo-btn');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
})();

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const accent = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6ea8d8';

// Chispas: con tope, y dibujadas por lotes (8 trazos en vez de uno por chispa, sin shadowBlur)
const MAX_SPARKS = 320;
const BUCKETS = 4; // tramos de vida: cada uno con su color y transparencia
const sparkStyle = (hot, life) =>
  hot
    ? `rgb(255, ${Math.round(245 - 90 * life)}, ${Math.round(200 - 160 * life)})`
    : `rgb(255, ${Math.round(200 - 120 * life)}, ${Math.round(70 - 60 * life)})`;
const STYLES = [false, true].flatMap((hot) =>
  Array.from({ length: BUCKETS }, (_, b) => {
    const life = (b + 0.5) / BUCKETS;
    return { color: sparkStyle(hot, life), alpha: 1 - life * life, width: hot ? 2.2 : 1.7 };
  })
);

// Giro al hacer click: acelera durante BOOST_MS (llega rápido a W_MAX) y luego frena
const BOOST_MS = 780;
const W_MAX = 30; // rad/s a toda velocidad (~4.8 vueltas por segundo)
const W_IDLE = 0.9; // rodando despacio mientras se muestra
const FLIP_MS = 420; // foto → rueda (o al revés)

let stage = null,
  loading = null;

async function buildStage() {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const canvas = renderer.domElement;
  canvas.className = 'wheel-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  const fx = document.createElement('canvas'); // líneas de velocidad y chispas
  fx.className = 'wheel-fx';
  fx.setAttribute('aria-hidden', 'true');
  const ctx = fx.getContext('2d');

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-2, 3, 4);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.2));

  // wheelSpace: el eje de la rueda es X; la cara exterior del rin (lado +X) mira a la cámara al girar Y -90°
  const wheelSpace = new THREE.Group();
  scene.add(wheelSpace);
  wheelSpace.add(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  const spinner = new THREE.Group();
  wheelSpace.add(spinner);
  let discMat = null;
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    let p = o,
      name = '';
    while (p && !name) {
      if (SPINNING.includes(p.name) || p.name === 'brake-caliper') name = p.name;
      p = p.parent;
    }
    if (name === 'brake-disc') {
      // Material propio para el disco: brilla al rojo vivo sin afectar al rin
      o.material = o.material.clone();
      o.material.emissive = new THREE.Color(1, 0.16, 0.02);
      o.material.emissiveIntensity = 0;
      discMat = o.material;
    }
    if (SPINNING.includes(name)) spinner.attach(o);
  });
  const box = new THREE.Box3().setFromObject(wheelSpace); // incluye las piezas que se movieron al spinner
  const size = box.getSize(new THREE.Vector3());
  const tireD = Math.max(size.y, size.z);

  // La llanta ocupa lo mismo que la foto: el lienzo mide (1 + 2·PAD) veces la foto
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
  const fitH = tireD * (1 + 2 * PAD) * 1.04;
  camera.position.set(0, 0, fitH / 2 / Math.tan(THREE.MathUtils.degToRad(15)));
  camera.lookAt(0, 0, 0);

  photo.append(canvas, fx);

  let fxSize = 0;
  const resize = () => {
    const r = canvas.getBoundingClientRect(),
      f = fx.getBoundingClientRect();
    if (!r.width) return;
    renderer.setSize(r.width, r.height, false);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    fx.width = f.width * dpr;
    fx.height = f.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fxSize = f.width;
  };
  resize();
  window.addEventListener('resize', resize);

  return {
    renderer,
    scene,
    camera,
    wheelSpace,
    spinner,
    discMat,
    canvas,
    fx,
    ctx,
    resize,
    fxSize: () => fxSize
  };
}

const load = () =>
  (loading ||= buildStage()
    .then((s) => (stage = s))
    .catch((err) => {
      console.warn('Rueda 3D no disponible:', err);
      stage = false;
    }));

/* ---------- Estado y bucle de dibujo ---------- */
const img = () => photo.querySelector('img, .ph');
const st = {
  hover: false, // mouse o foco encima
  face: 0, // 0 = foto, 0.5 = de canto, 1 = rueda de frente
  boostUntil: 0, // hasta cuándo acelera (último click + BOOST_MS)
  w: 0, // velocidad del giro (rad/s)
  angle: 0,
  heat: 0,
  sparks: [],
  color: '#6ea8d8',
  light: false,
  raf: 0,
  last: 0
};
const spinning = (now) => now < st.boostUntil || st.w > W_IDLE + 0.3;

function setPhoto() {
  const el = img();
  if (!el) return;
  if (st.face <= 0) {
    // Foto en su lugar: se devuelven sus estilos (zoom al pasar el mouse incluido)
    el.style.transform = el.style.transition = el.style.visibility = '';
    return;
  }
  el.style.transition = 'none';
  const a = Math.min(st.face, 0.5) * 2 * 90; // 0 → 90° (queda de canto)
  el.style.transform = `perspective(700px) rotateY(${a}deg)`;
  el.style.visibility = st.face >= 0.5 ? 'hidden' : '';
}

function frame(now) {
  st.raf = 0;
  const s = stage;
  const dt = Math.min(0.04, (now - st.last) / 1000 || 0.016);
  st.last = now;

  // Mostrar la rueda mientras hay hover o giro
  const want = st.hover || spinning(now) ? 1 : 0;
  const step = (dt * 1000) / FLIP_MS;
  st.face = want ? Math.min(1, st.face + step) : Math.max(0, st.face - step);
  setPhoto();

  // Velocidad: el click acelera desde la velocidad actual; después frena hasta rodar despacio
  const idle = st.face > 0.5 ? W_IDLE : 0;
  const boosting = now < st.boostUntil;
  if (boosting) st.w += (W_MAX - st.w) * (1 - Math.exp(-dt * 9));
  else st.w = Math.max(idle, st.w * Math.exp(-dt * 1.6) - dt * 5);
  const speed = st.w / W_MAX;
  const braking = !boosting && st.w > W_IDLE + 0.5;
  st.angle += st.w * dt;
  s.spinner.rotation.x = -st.angle; // en pantalla gira en sentido horario

  // Volteo: de canto (face 0.5) a de frente (face 1)
  const wf = easeInOut(clamp((st.face - 0.5) * 2));
  s.wheelSpace.rotation.set(0.08, -Math.PI / 2 + ((1 - wf) * Math.PI) / 2, 0);
  s.wheelSpace.visible = st.face > 0.5;
  s.canvas.style.opacity = s.fx.style.opacity = st.face > 0.5 || st.sparks.length ? '1' : '0';

  // El disco se calienta al frenar y se enfría
  st.heat = braking ? Math.min(1, st.heat + dt * 2.6 * (speed + 0.25)) : Math.max(0, st.heat - dt * 0.9);
  if (s.discMat) s.discMat.emissiveIntensity = st.heat * 1.25;
  s.renderer.render(s.scene, s.camera);

  drawFx(s, dt, speed, braking, wf);

  const busy = st.face > 0 || want || st.sparks.length || st.heat > 0.01;
  if (busy) st.raf = requestAnimationFrame(frame);
}
const wake = () => {
  if (st.raf || !stage) return;
  st.color = accent();
  st.light = document.documentElement.dataset.theme === 'light';
  st.last = performance.now();
  st.raf = requestAnimationFrame(frame);
};

/* ---------- Efectos 2D: líneas de velocidad y chispas ---------- */
function drawFx(s, dt, speed, braking, vis) {
  const { ctx } = s;
  const S = s.fxSize(),
    c = S / 2,
    R = S / FX / 2; // R: radio de la llanta (= radio de la foto)
  const floor = c + R * 1.02;
  const { light } = st;
  ctx.clearRect(0, 0, S, S);
  ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
  ctx.lineCap = 'round';

  if (speed > 0.05 && vis > 0.01) {
    const color = st.color;
    for (let i = 0; i < 12; i++) {
      const r = R * (1.06 + (i % 4) * 0.06 + i * 0.008);
      const a0 = st.angle * (1 - (i % 4) * 0.1) + (i * Math.PI * 2) / 12;
      const len = 0.25 + speed * 0.95;
      ctx.strokeStyle = color;
      ctx.globalAlpha = Math.min(1, speed * 0.8) * vis * (0.3 + (i % 4) * 0.15);
      ctx.lineWidth = 2.4 - (i % 4) * 0.45;
      ctx.beginPath();
      ctx.arc(c, c, r, a0 - len, a0);
      ctx.stroke();
    }
  }

  // Emisión: muchas al frenar, algunas a toda velocidad
  const k = dt * 60;
  if (vis > 0.5 && speed > 0.04) {
    const rate = braking ? 6 + speed * 22 : speed * 3;
    const n = Math.min(MAX_SPARKS - st.sparks.length, Math.floor(rate * k + Math.random()));
    for (let i = 0; i < n; i++) {
      // Desde la parte baja de la llanta, hacia atrás del giro (izquierda) y hacia arriba
      const a = Math.PI + (Math.random() - 0.2) * 0.9; // ángulo de salida
      const v = (3 + Math.random() * 9) * (0.55 + speed);
      st.sparks.push({
        x: c + (Math.random() - 0.35) * R * 0.5,
        y: floor - 2,
        vx: Math.cos(a) * v,
        vy: -Math.abs(Math.sin(a)) * v * 0.9 - Math.random() * 2,
        life: 0,
        max: 380 + Math.random() * 620,
        hot: Math.random() < 0.3,
        bounced: 0
      });
    }
    if (braking) {
      // Desde la pinza (a la derecha del centro), donde roza el disco: salen hacia abajo
      const m = Math.min(MAX_SPARKS - st.sparks.length, Math.floor((2 + speed * 9) * k + Math.random()));
      for (let i = 0; i < m; i++) {
        const v = 2 + Math.random() * 6 * (0.5 + speed);
        st.sparks.push({
          x: c + R * (0.46 + Math.random() * 0.12),
          y: c + (Math.random() - 0.5) * R * 0.3,
          vx: v * (0.3 + Math.random() * 0.6),
          vy: v * (0.6 + Math.random() * 0.6),
          life: 0,
          max: 260 + Math.random() * 420,
          hot: Math.random() < 0.5,
          bounced: 0
        });
      }
    }
  }

  // Física, y cada chispa se agrega al trazo de su tramo de vida
  const paths = STYLES.map(() => new Path2D());
  const list = st.sparks;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life += dt * 1000;
    if (p.life > p.max) {
      list[i] = list[list.length - 1];
      list.pop();
      continue;
    }
    p.vy += 0.32 * k;
    p.vx *= Math.pow(0.985, k);
    const x0 = p.x,
      y0 = p.y;
    p.x += p.vx * k;
    p.y += p.vy * k;
    // Rebote en el piso imaginario bajo la llanta
    if (p.y > floor + 40 && p.vy > 0 && p.bounced < 2) {
      p.y = floor + 40;
      p.vy *= -0.38;
      p.vx *= 0.75;
      p.bounced++;
    }
    const path = paths[Math.min(BUCKETS - 1, ((p.life / p.max) * BUCKETS) | 0) + (p.hot ? BUCKETS : 0)];
    path.moveTo(x0 - p.vx * 0.8, y0 - p.vy * 0.8);
    path.lineTo(p.x, p.y);
  }
  // En oscuro, primero un trazo ancho y tenue (el brillo) y encima el núcleo
  for (let pass = light ? 1 : 0; pass < 2; pass++) {
    for (let j = 0; j < STYLES.length; j++) {
      const sty = STYLES[j];
      ctx.strokeStyle = sty.color;
      ctx.globalAlpha = sty.alpha * (pass ? 1 : 0.22);
      ctx.lineWidth = sty.width * (pass ? 1 : 3.2);
      ctx.stroke(paths[j]);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/* ---------- Sin WebGL: la foto da dos vueltas rápidas ---------- */
let fallbackBusy = false;
const fallbackSpin = () => {
  const el = img();
  if (!el || fallbackBusy) return;
  fallbackBusy = true;
  el.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(720deg)' }], {
    duration: 1100,
    easing: 'cubic-bezier(.2,.7,.2,1)'
  }).onfinish = () => {
    fallbackBusy = false;
  };
};

if (btn && !reduce) {
  const enter = async () => {
    st.hover = true;
    if (!hasWebGL) return;
    await load();
    if (stage && st.hover) {
      stage.resize();
      wake();
    }
  };
  const leave = () => {
    st.hover = false;
    wake();
  };
  btn.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') enter();
  });
  btn.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') leave();
  });
  btn.addEventListener('focus', () => {
    if (btn.matches(':focus-visible')) enter();
  });
  btn.addEventListener('blur', leave);
  btn.addEventListener('click', async () => {
    if (!hasWebGL) return fallbackSpin();
    await load();
    if (!stage) return fallbackSpin();
    stage.resize();
    // Si ya estaba girando, vuelve a acelerar desde la velocidad actual (sin saltos)
    st.boostUntil = performance.now() + BOOST_MS;
    wake();
  });
}
