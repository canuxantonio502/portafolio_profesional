/* Motor 3D de la sección "Del motor al código".
   Carga el modelo solo cuando la sección se acerca y lo dibuja según el
   avance del scroll que calcula main.js (window.__storyP, de 0 a 1):
     capítulo 1: motor armado que gira
     capítulo 2: vista despiezada (animación propia del modelo)
     capítulo 3: el metal se vuelve plano técnico (aristas) y se rearma
     capítulo 4: el motor se desvanece y entra una laptop que escribe el código
                 (si la laptop no carga, queda la ventana de código SVG)
   Si WebGL no está disponible o el visitante ahorra datos, se queda el SVG. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Modelo comprimido con gltf-transform (meshopt + texturas WebP)
const MODEL_URL = './models/engine.glb';
const story = document.querySelector('.story');
const wrap = story && story.querySelector('.engine-wrap');

const saveData = navigator.connection && navigator.connection.saveData;
const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
})();

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// Tiempos de la animación del modelo (segundos)
const T_ASSEMBLED = 0.8, T_EXPLODED = 4.6, T_REBUILD_FROM = 6.4, T_REBUILT = 8.0;

// El modelo se descarga una sola vez y lo comparten las dos vistas
let gltfPromise = null;
const loadModel = () => (gltfPromise ||= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(MODEL_URL));

// Renderizador y escena con la misma iluminación para ambas vistas
function makeStage(className) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const canvas = renderer.domElement;
  canvas.className = className;
  canvas.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 4);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));
  return { renderer, canvas, scene, camera: new THREE.PerspectiveCamera(32, 1, 0.01, 200) };
}

// Prepara un modelo con su animación y mide el motor armado y despiezado
function rig(model, clip) {
  const pivot = new THREE.Group();
  pivot.add(model);
  const mixer = new THREE.AnimationMixer(model);
  if (clip) mixer.clipAction(clip).play();
  const boxAt = (t) => {
    mixer.setTime(t);
    model.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(model);
  };
  model.position.sub(boxAt(0).getCenter(new THREE.Vector3()));
  const sizeA = boxAt(0).getSize(new THREE.Vector3()).length();
  const exploded = boxAt(T_EXPLODED);
  return {
    pivot, mixer, sizeA,
    sizeE: exploded.getSize(new THREE.Vector3()).length(),
    centerE: exploded.getCenter(new THREE.Vector3())
  };
}

/* Laptop del capítulo final: aparece cerrada donde estaba el motor, abre la tapa
   y en su pantalla se escribe el código. Pantalla: textura de un canvas propio. */
const LAPTOP_URL = './models/laptop/scene.gltf';
const LID_CLOSED = -88;                          // grados respecto a la tapa abierta
const SCREEN = { y: 10.69, z: -10.672, w: 29.4, h: 17.0 };  // pantalla, en unidades del modelo
const CODE = [
  [['k', 'const'], ['t', ' antonio = {']],
  [['t', '  from: '], ['s', "'engines'"], ['t', ',']],
  [['t', '  to: '], ['s', "'code'"], ['t', ',']],
  [['t', '  status: '], ['s', "'building'"], ['t', ',']],
  [['t', '};']]
];
const CODE_CHARS = CODE.reduce((n, line) => n + line.reduce((m, [, s]) => m + s.length, 0), 0);

async function buildLaptop(size, accent) {
  const gltf = await new GLTFLoader().loadAsync(LAPTOP_URL);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const lid = root.getObjectByName('Screen');
  if (!lid) throw new Error('Laptop sin tapa');

  // Pantalla: canvas con el editor y el código que se va escribiendo
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = Math.round(1024 * SCREEN.h / SCREEN.w);
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const screenMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMat);
  screen.position.set(0, SCREEN.y, SCREEN.z);
  root.add(screen);
  lid.attach(screen);                            // la pantalla gira con la tapa

  let typed = -1;
  const paint = (n, color) => {
    if (n === typed) return;
    typed = n;
    const W = cv.width, H = cv.height;
    g.fillStyle = '#0d1117'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#161b22'; g.fillRect(0, 0, W, 64);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(40 + i * 34, 32, 11, 0, Math.PI * 2); g.fill(); });
    g.font = '600 26px Consolas, "Cascadia Code", monospace';
    g.fillStyle = '#8b949e'; g.fillText('antonio.js', 160, 41);
    g.font = '600 44px Consolas, "Cascadia Code", monospace';
    let left = n, cx = 110, cy = 140;           // cursor: justo después de lo escrito
    CODE.forEach((line, row) => {
      const y = 140 + row * 68;
      g.fillStyle = '#3b4452'; g.fillText(String(row + 1), 36, y);
      if (left > 0) { cx = 110; cy = y; }
      let x = 110;
      line.forEach(([kind, text]) => {
        const shown = text.slice(0, Math.max(0, left));
        left -= text.length;
        if (!shown) return;
        g.fillStyle = kind === 'k' ? color : kind === 's' ? '#7fb88a' : '#e6edf3';
        g.fillText(shown, x, y);
        x += g.measureText(shown).width;
        cx = x; cy = y;
      });
    });
    g.fillStyle = color; g.fillRect(cx + 4, cy - 36, 22, 44);
    tex.needsUpdate = true;
  };

  // Materiales propios para poder aparecer de forma gradual
  const mats = [];
  root.traverse((o) => {
    if (o.isMesh && o !== screen) {
      o.material = o.material.clone();
      mats.push(o.material);
    }
  });

  // Tamaño parecido al motor y centrado en el origen
  const group = new THREE.Group();
  const box = new THREE.Box3().setFromObject(root);
  root.position.sub(box.getCenter(new THREE.Vector3()));
  group.add(root);
  const k = (size * 0.85) / box.getSize(new THREE.Vector3()).length();
  group.scale.setScalar(k);
  // Centrada con la tapa abierta: cerrada queda más baja, así que se compensa
  const dropClosed = (box.getCenter(new THREE.Vector3()).y - box.min.y) * 0.9 * k;
  group.visible = false;

  const lidOpen = lid.quaternion.clone();
  const hinge = new THREE.Quaternion(), xAxis = new THREE.Vector3(1, 0, 0);
  return {
    group,
    // Primera vez que se dibuja: subir texturas y geometría y compilar los shaders
    // (opacos y transparentes) ahora, para que no se detenga al aparecer.
    prewarm(renderer, scene, camera) {
      paint(0, accent());
      renderer.initTexture(tex);
      root.traverse((o) => { if (o.isMesh && o.material.map) renderer.initTexture(o.material.map); });
      group.visible = true;
      [false, true].forEach((t) => {
        mats.forEach((m) => { m.transparent = t; m.opacity = t ? 0 : 1; m.needsUpdate = true; });
        renderer.compile(scene, camera);
      });
      screenMat.opacity = 0;
      renderer.render(scene, camera);             // invisible (opacidad 0); sube la geometría
      group.visible = false;
    },
    // show: aparición (0-1) · open: apertura de la tapa (0-1) · type: código escrito (0-1)
    update(show, open, type) {
      group.visible = show > 0.001;
      if (!group.visible) return;
      mats.forEach((m) => { m.transparent = show < 1; m.opacity = show; m.depthWrite = show > 0.5; });
      hinge.setFromAxisAngle(xAxis, THREE.MathUtils.degToRad(lerp(LID_CLOSED, 0, open)));
      lid.quaternion.copy(lidOpen).multiply(hinge);
      group.rotation.set(0, lerp(0.7, 0.28, show), 0);
      group.position.y = dropClosed * (1 - open);
      screenMat.opacity = show * smooth(seg(open, 0.6, 1));
      paint(Math.round(type * CODE_CHARS), accent());
    }
  };
}

async function init() {
  const { renderer, canvas, scene, camera } = makeStage('engine-canvas');
  const gltf = await loadModel();
  // La vista de la trayectoria usa el modelo original; la del contacto, una copia
  const model = gltf.scene;
  const { pivot, mixer, sizeA, sizeE, centerE } = rig(model, gltf.animations[0]);
  scene.add(pivot);

  // Materiales: el metal se puede desvanecer y cada pieza tiene sus aristas
  const readAccent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6ea8d8';
  let accentNow = readAccent();
  const accent = () => accentNow;
  const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(accent()), transparent: true, opacity: 0, depthWrite: false });
  const metals = [];
  const meshes = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => { m.transparent = true; metals.push(m); });
  });
  // Las aristas se calculan después, sin bloquear la primera imagen
  let edgesReady = false;
  const buildEdges = () => {
    meshes.forEach((mesh) => {
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 28), lineMat);
      lines.renderOrder = 2;
      mesh.add(lines);
    });
    edgesReady = true;
    draw(lastP);
  };
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 300)))(buildEdges);

  new MutationObserver(() => { accentNow = readAccent(); lineMat.color.set(accentNow); draw(lastP); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  wrap.prepend(canvas);
  story.classList.add('has-3d');

  // La laptop del último capítulo se carga después, sin retrasar el motor
  let laptop = null;
  buildLaptop(sizeA, accent).then((l) => {
    scene.add(l.group);
    // Se prepara en un momento libre; hasta entonces se muestra la ventana de código SVG
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
    idle(() => {
      try { l.prewarm(renderer, scene, camera); } catch (err) { console.warn('Laptop: precarga incompleta', err); }
      laptop = l;
      story.classList.add('has-laptop');
      draw(lastP);
    }, { timeout: 1500 });
  }).catch((err) => console.warn('Laptop 3D no disponible:', err));

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    // El encuadre del motor es el recuadro del motor más un 6% por lado.
    // En escritorio el canvas es más ancho (llega por detrás del texto):
    // setViewOffset dibuja ese recuadro en su sitio y usa el resto como margen.
    const w = wrap.getBoundingClientRect();
    const fw = w.width * 1.12, fh = w.height * 1.12;
    camera.aspect = fw / fh;
    camera.setViewOffset(fw, fh, r.left - (w.left - w.width * 0.06), r.top - (w.top - w.height * 0.06), r.width, r.height);
    camera.updateProjectionMatrix();
    draw(lastP);
  };

  let lastP = window.__storyP || 0;
  const target = new THREE.Vector3();
  function draw(p) {
    lastP = p;
    // Animación del modelo según el capítulo
    const ex = smooth(seg(p, 0.2, 0.42));     // despiece
    const re = smooth(seg(p, 0.56, 0.7));     // rearmado como plano técnico
    const t = re > 0 ? lerp(T_REBUILD_FROM, T_REBUILT, re) : lerp(T_ASSEMBLED, T_EXPLODED, ex);
    mixer.setTime(t);

    // Del metal a las aristas, y salida final
    const bp = smooth(seg(p, 0.48, 0.6));
    const out = smooth(seg(p, 0.72, 0.82));
    metals.forEach((m) => { m.opacity = 1 - bp; m.depthWrite = bp < 0.5; m.visible = bp < 0.999; });
    lineMat.opacity = edgesReady ? bp * 0.9 * (1 - out) : 0;
    // Con la laptop el lienzo sigue visible; sin ella queda la ventana de código SVG
    canvas.style.opacity = laptop ? '1' : String(1 - out);
    pivot.visible = !laptop || out < 0.999;
    if (laptop) laptop.update(smooth(seg(p, 0.74, 0.86)), smooth(seg(p, 0.78, 0.9)), seg(p, 0.86, 0.98));

    // Giro continuo y cámara que se aleja para encuadrar el despiece
    pivot.rotation.y = -0.9 + p * Math.PI * 1.4;
    pivot.rotation.x = 0.12;
    const spread = ex * (1 - re);
    const dist = lerp(sizeA * 1.95, sizeE * 1.6, spread);
    target.copy(centerE).multiplyScalar(spread); // el modelo armado ya está centrado en el origen
    camera.position.set(target.x + dist * 0.15, target.y + dist * 0.32, target.z + dist * 0.94);
    camera.lookAt(target);
    pivot.scale.setScalar(1 - 0.15 * out);
    renderer.render(scene, camera);
  }

  window.engine3d = { update: (p) => { if (p !== lastP) draw(p); } };
  window.addEventListener('resize', resize);
  resize();
  draw(lastP);
}

/* La meta (sección de contacto): una copia del motor llega despiezada
   y se vuelve a armar mientras la sección entra en pantalla. */
const goal = document.querySelector('.goal');
const goalWrap = goal && goal.querySelector('.goal-wrap');

async function initGoal() {
  const { renderer, canvas, scene, camera } = makeStage('goal-canvas');
  const gltf = await loadModel();
  const model = gltf.scene.clone(true);
  // Sin las aristas de la otra vista y con materiales propios (la trayectoria los desvanece)
  const extras = [];
  model.traverse((o) => {
    if (o.isLineSegments) extras.push(o);
    else if (o.isMesh) {
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        m.transparent = false; m.opacity = 1; m.depthWrite = true; m.visible = true;
      });
    }
  });
  extras.forEach((o) => o.removeFromParent());
  const { pivot, mixer, sizeA, sizeE, centerE } = rig(model, gltf.animations[0]);
  scene.add(pivot);

  goalWrap.appendChild(canvas);
  goal.classList.add('is-ready');

  let lastQ = 0;
  const target = new THREE.Vector3();
  const draw = (q) => {
    lastQ = q;
    const s = smooth(q);
    mixer.setTime(lerp(T_REBUILD_FROM, T_REBUILT, s));   // de despiezado a armado
    pivot.rotation.set(0.12, 0.6 - s * 1.3, 0);
    const dist = lerp(sizeE * 1.6, sizeA * 1.9, s);
    target.copy(centerE).multiplyScalar(1 - s);
    camera.position.set(target.x + dist * 0.15, target.y + dist * 0.32, target.z + dist * 0.94);
    camera.lookAt(target);
    renderer.render(scene, camera);
  };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    draw(lastQ);
  };
  window.addEventListener('resize', resize);
  resize();

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (window.gsap && window.ScrollTrigger && !reduce) {
    window.ScrollTrigger.create({
      // clamp(): el contacto está al final de la página; el armado debe terminar antes del fondo
      trigger: goal, start: 'clamp(top 90%)', end: 'clamp(center 50%)', scrub: 0.6,
      onUpdate: (self) => draw(self.progress)
    });
    window.ScrollTrigger.refresh();
  } else {
    draw(1);
  }
}

// Carga perezosa: cada vista empieza cuando su sección está a una pantalla de distancia
const lazy = (el, fn, label) => {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      fn().catch((err) => { console.warn(label, err); });
    }
  }, { rootMargin: '100% 0px' });
  io.observe(el);
};
if (hasWebGL && !saveData) {
  if (story && wrap) lazy(story, init, 'Motor 3D no disponible:');
  // .goal está oculto hasta que carga: se observa la sección de contacto
  if (goal && goalWrap) lazy(goal.closest('section') || goal, initGoal, 'Motor de la meta no disponible:');
}
