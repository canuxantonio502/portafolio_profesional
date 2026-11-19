/* Motor 3D de la sección "Del motor al código".
   Carga el modelo solo cuando la sección se acerca y lo dibuja según el
   avance del scroll que calcula main.js (window.__storyP, de 0 a 1):
     capítulo 1: motor armado que gira
     capítulo 2: vista despiezada (animación propia del modelo)
     capítulo 3: el metal se vuelve plano técnico (aristas) y se rearma
     capítulo 4: el motor se desvanece y entra la ventana de código (SVG)
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

async function init() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const canvas = renderer.domElement;
  canvas.className = 'engine-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 4);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));

  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 200);
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(MODEL_URL);
  const model = gltf.scene;
  const pivot = new THREE.Group();
  pivot.add(model);
  scene.add(pivot);

  const mixer = new THREE.AnimationMixer(model);
  const clip = gltf.animations[0];
  if (clip) mixer.clipAction(clip).play();

  // Centra el modelo armado en el origen del pivote
  const boxAt = (t) => {
    mixer.setTime(t);
    model.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(model);
  };
  const center = boxAt(0).getCenter(new THREE.Vector3());
  model.position.sub(center);
  const sizeA = boxAt(0).getSize(new THREE.Vector3()).length();
  const exploded = boxAt(T_EXPLODED);
  const sizeE = exploded.getSize(new THREE.Vector3()).length();
  const centerE = exploded.getCenter(new THREE.Vector3());

  // Materiales: el metal se puede desvanecer y cada pieza tiene sus aristas
  const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6ea8d8';
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

  new MutationObserver(() => { lineMat.color.set(accent()); draw(lastP); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  wrap.prepend(canvas);
  story.classList.add('has-3d');

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
    canvas.style.opacity = String(1 - out);

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

if (story && wrap && hasWebGL && !saveData) {
  // Carga perezosa: empieza cuando la sección está a una pantalla de distancia
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      init().catch((err) => { console.warn('Motor 3D no disponible:', err); });
    }
  }, { rootMargin: '100% 0px' });
  io.observe(story);
}
