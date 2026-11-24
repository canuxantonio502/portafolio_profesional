/* Tacómetro 3D (esquina inferior izquierda).
   Usa el tablero "Original car self-illuminating meter" y enfoca solo el
   cuentarrevoluciones. main.js calcula las RPM según el scroll (con inercia)
   y llama a window.tach3d.update(rpm). Solo se vuelve a dibujar si algo cambia.
   Mientras carga, o sin WebGL, se ve el tacómetro SVG. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Comprimido con gltf-transform (meshopt), 130 KB
const MODEL_URL = './models/tach.glb';
const NEEDLE = 'Circle010'; // aguja del cuentarrevoluciones
const DEG_AT_0 = 213.5; // ángulo de la marca "0" (grados, antihorario desde +X)
const DEG_PER_K = -30.45; // grados por cada 1000 rpm
const REDLINE = 6.5;

const tach = document.getElementById('tach');
const saveData = navigator.connection && navigator.connection.saveData;
const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
})();

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

async function init() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = 'tach-canvas';

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(MODEL_URL);
  const model = gltf.scene;
  scene.add(model);
  model.updateMatrixWorld(true);

  const needle = model.getObjectByName(NEEDLE);
  if (!needle) throw new Error('No se encontró la aguja');
  const pivot = needle.getWorldPosition(new THREE.Vector3());

  // Ángulo actual de la aguja: el vértice más lejano del eje
  let tip = 0,
    far = 0;
  const v = new THREE.Vector3();
  needle.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const d = Math.hypot(v.x - pivot.x, v.y - pivot.y);
      if (d > far) {
        far = d;
        tip = Math.atan2(v.y - pivot.y, v.x - pivot.x);
      }
    }
  });
  const baseQ = needle.quaternion.clone();
  const spin = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);

  // Solo el cuentarrevoluciones: oculta el resto del tablero
  // y separa los materiales que brillan para la zona roja
  const reds = [];
  const box = new THREE.Box3(),
    c = new THREE.Vector3();
  model.traverse((o) => {
    if (!o.isMesh) return;
    box.setFromObject(o).getCenter(c);
    if (Math.hypot(c.x - pivot.x, c.y - pivot.y) > 0.75) {
      o.visible = false;
      return;
    }
    const m = o.material;
    if (m.emissive && m.emissive.r > 0.2 && m.emissive.g < 0.05 && !reds.includes(m)) {
      reds.push(m);
      m.userData.base = m.emissiveIntensity;
    }
  });

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  camera.position.set(pivot.x + 0.14, pivot.y - 0.1, pivot.z + 2.75);
  camera.lookAt(pivot);

  tach.prepend(canvas);
  tach.classList.add('has-3d');

  let rpm = window.__tachRpm || 0,
    glow = -1;
  const draw = () => {
    const deg = DEG_AT_0 + DEG_PER_K * rpm;
    spin.setFromAxisAngle(zAxis, (deg * Math.PI) / 180 - tip);
    needle.quaternion.copy(baseQ).multiply(spin);
    // La zona roja se enciende al acercarse al final de la página
    const g = clamp((rpm - (REDLINE - 0.8)) / 1.3);
    if (g !== glow) {
      glow = g;
      reds.forEach((m) => {
        m.emissiveIntensity = m.userData.base * (1 + g * 2.5);
      });
    }
    renderer.render(scene, camera);
  };

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    draw();
  };

  window.tach3d = {
    update: (next) => {
      if (next !== rpm) {
        rpm = next;
        draw();
      }
    }
  };
  window.addEventListener('resize', resize);
  resize();
}

if (tach && hasWebGL && !saveData) {
  // Se carga cuando la página ya terminó, sin competir con lo importante
  const start = () =>
    (window.requestIdleCallback || ((fn) => setTimeout(fn, 600)))(() => {
      init().catch((err) => console.warn('Tacómetro 3D no disponible:', err));
    });
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
