/* La foto del hero se convierte en rueda: al hacer click la foto gira como una
   moneda, aparece la rueda 3D girando a toda velocidad y frena hasta detenerse;
   luego vuelve la foto. Alrededor, mientras gira:
     - líneas de velocidad con el color de acento,
     - el disco de freno se pone al rojo vivo al frenar y se enfría,
     - chispas que salen de la parte baja de la llanta al frenar.
   La pinza de freno queda fija, como en un auto real.
   Modelo: "Car wheel with brake disc - Low poly" de Márcio Meireles (CC BY 4.0). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const MODEL_URL = './models/wheel-web/scene.gltf';
const SPINNING = ['tire-low', 'wheel-full', 'brake-disc'];   // la pinza ('brake-caliper') no gira
const PAD = 0.3;              // el lienzo es un 30% más grande por lado que la foto (para los efectos)

const photo = document.querySelector('.hero-photo');
const btn = photo && photo.querySelector('.photo-btn');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
})();

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6ea8d8';

// Línea de tiempo (ms)
const T = { photoOut: [0, 200], wheelIn: [150, 380], spinUp: [150, 420], brake: [950, 1750], wheelOut: [1760, 1960], photoIn: [1900, 2240], end: 2260 };
const W_MAX = 30;             // rad/s a toda velocidad (~4.8 vueltas por segundo)

let stage = null, loading = null, busy = false;

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

  const fx = document.createElement('canvas');   // líneas de velocidad y chispas
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
    let p = o, name = '';
    while (p && !name) { if (SPINNING.includes(p.name) || p.name === 'brake-caliper') name = p.name; p = p.parent; }
    if (name === 'brake-disc') {
      // Material propio para el disco: brilla al rojo vivo sin afectar al rin
      o.material = o.material.clone();
      o.material.emissive = new THREE.Color(1, 0.16, 0.02);
      o.material.emissiveIntensity = 0;
      discMat = o.material;
    }
    if (SPINNING.includes(name)) spinner.attach(o);
  });
  const box = new THREE.Box3().setFromObject(wheelSpace);   // incluye las piezas que se movieron al spinner
  const size = box.getSize(new THREE.Vector3());
  const tireD = Math.max(size.y, size.z);

  // La llanta ocupa lo mismo que la foto: el lienzo mide (1 + 2·PAD) veces la foto
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
  const fitH = tireD * (1 + 2 * PAD) * 1.04;
  camera.position.set(0, 0, fitH / 2 / Math.tan(THREE.MathUtils.degToRad(15)));
  camera.lookAt(0, 0, 0);

  photo.append(canvas, fx);

  let px = 0;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    renderer.setSize(r.width, r.height, false);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    fx.width = r.width * dpr; fx.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    px = r.width;
  };
  resize();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, wheelSpace, spinner, discMat, canvas, fx, ctx, resize, size: () => px };
}

const load = () => (loading ||= buildStage().then((s) => (stage = s)).catch((err) => {
  console.warn('Rueda 3D no disponible:', err);
  stage = false;
}));

/* Foto: gira como moneda (Web Animations, para no chocar con el GSAP del hero) */
const flip = (from, to, dur, easing) => {
  const img = photo.querySelector('img, .ph');
  if (!img) return;
  img.animate([{ transform: `perspective(700px) rotateY(${from}deg)` }, { transform: `perspective(700px) rotateY(${to}deg)` }],
    { duration: dur, easing, fill: 'forwards' });
};

function play() {
  const s = stage;
  const { renderer, scene, camera, wheelSpace, spinner, discMat, canvas, fx, ctx } = s;
  s.resize();
  photo.classList.add('is-wheeling');
  canvas.style.opacity = fx.style.opacity = '1';
  flip(0, 90, T.photoOut[1], 'cubic-bezier(.5,0,.9,.5)');

  const color = accent();
  const light = document.documentElement.dataset.theme === 'light';
  const sparks = [];
  let angle = 0, heat = 0, last = performance.now();
  const t0 = last;
  let photoBack = false, photoHidden = false;
  const img = photo.querySelector('img, .ph');

  const frame = (now) => {
    const t = now - t0, dt = Math.min(0.04, (now - last) / 1000);
    last = now;

    // Velocidad: arranca, sostiene y frena
    const up = easeIn(seg(t, ...T.spinUp));
    const br = seg(t, ...T.brake);
    const w = W_MAX * up * Math.pow(1 - br, 2);
    angle += w * dt;
    spinner.rotation.x = -angle;          // gira hacia adelante (en pantalla, sentido horario)

    // Aparece de canto, queda de frente y se va de canto
    const inn = easeOut(seg(t, ...T.wheelIn)), out = easeIn(seg(t, ...T.wheelOut));
    wheelSpace.rotation.set(0.08 * (1 - out), -Math.PI / 2 + (1 - inn) * Math.PI / 2 - out * Math.PI / 2, 0);
    wheelSpace.visible = inn > 0.01 && out < 0.99;

    // El disco se calienta al frenar y se enfría
    const braking = br > 0 && br < 1;
    heat = braking ? Math.min(1, heat + dt * 2.6 * (w / W_MAX + 0.25)) : Math.max(0, heat - dt * 1.4);
    if (discMat) discMat.emissiveIntensity = heat * 1.25;
    renderer.render(scene, camera);

    // Efectos 2D alrededor de la llanta
    const S = s.size(), c = S / 2, R = (S / (1 + 2 * PAD)) / 2;
    ctx.clearRect(0, 0, S, S);
    const speed = w / W_MAX;
    const vis = (1 - out) * inn;
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    ctx.lineCap = 'round';
    if (speed > 0.05 && vis > 0.01) {
      // Líneas de velocidad: arcos que siguen el giro, más largos cuanto más rápido
      for (let i = 0; i < 9; i++) {
        const r = R * (1.06 + (i % 3) * 0.07 + (i * 0.013));
        const a0 = angle * (1 - (i % 3) * 0.12) + (i * Math.PI * 2) / 9;
        const len = 0.25 + speed * 0.9;
        ctx.strokeStyle = color;
        ctx.globalAlpha = Math.min(1, speed * 0.75) * vis * (0.35 + (i % 3) * 0.2);
        ctx.lineWidth = 2.2 - (i % 3) * 0.5;
        ctx.beginPath();
        ctx.arc(c, c, r, a0 - len, a0);
        ctx.stroke();
      }
    }
    // Chispas de frenado: salen de abajo, hacia atrás del giro
    if (braking && speed > 0.08) {
      const n = Math.round(speed * 3.5 + Math.random());
      for (let i = 0; i < n; i++) {
        sparks.push({
          x: c + (Math.random() - 0.5) * R * 0.3, y: c + R * 0.97,
          vx: -(2 + Math.random() * 5) * (0.5 + speed), vy: -(Math.random() * 2.5),
          life: 0, max: 280 + Math.random() * 360
        });
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life += dt * 1000;
      if (p.life > p.max) { sparks.splice(i, 1); continue; }
      const k = dt * 60;
      p.vy += 0.25 * k; p.vx *= Math.pow(0.97, k);
      const x0 = p.x, y0 = p.y;
      p.x += p.vx * k; p.y += p.vy * k;
      const life = p.life / p.max;
      ctx.globalAlpha = 1 - life * life;
      ctx.strokeStyle = `rgb(255, ${Math.round(230 - 140 * life)}, ${Math.round(120 - 100 * life)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // La foto queda oculta mientras la rueda está de frente
    if (!photoHidden && t >= T.photoOut[1]) { photoHidden = true; if (img) img.style.visibility = 'hidden'; }
    if (!photoBack && t >= T.photoIn[0]) {
      photoBack = true;
      if (img) img.style.visibility = '';
      flip(-90, 0, T.photoIn[1] - T.photoIn[0], 'cubic-bezier(.25,1.4,.5,1)');
    }
    if (t < T.end || sparks.length) requestAnimationFrame(frame);
    else {
      ctx.clearRect(0, 0, S, S);
      canvas.style.opacity = fx.style.opacity = '0';
      photo.classList.remove('is-wheeling');
      // La foto ya está en su lugar: se quitan las animaciones para que vuelva el zoom al pasar el mouse
      if (img) { img.style.visibility = ''; img.getAnimations().forEach((a) => a.cancel()); }
      busy = false;
    }
  };
  requestAnimationFrame(frame);
}

// Sin WebGL (o si el modelo no carga): la foto da dos vueltas rápidas
const fallbackSpin = () => {
  const img = photo.querySelector('img, .ph');
  if (!img) { busy = false; return; }
  img.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(720deg)' }],
    { duration: 1100, easing: 'cubic-bezier(.2,.7,.2,1)' }).onfinish = () => { busy = false; };
};

if (btn && !reduce) {
  // Precarga al acercar el mouse o el foco, para que el primer click sea inmediato
  const warm = () => { if (hasWebGL) load(); };
  btn.addEventListener('pointerenter', warm, { once: true });
  btn.addEventListener('focus', warm, { once: true });
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    if (!hasWebGL) return fallbackSpin();
    await load();
    if (stage) play(); else fallbackSpin();
  });
}
