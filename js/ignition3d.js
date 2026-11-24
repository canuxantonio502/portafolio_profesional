/* Botón ENGINE START/STOP en 3D para la pantalla del arranque (js/ignition.js).
   Hecho con geometría de Three.js (sin modelo externo): bisel cromado, anillo LED
   que "respira", tapa de goma con su rotulado. Se inclina hacia el mouse, se hunde
   al presionarlo y vibra con la marcha. Es decorativo: el click lo recibe el botón HTML. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const root = document.documentElement;
const stage = document.querySelector('.ign-stage');
const LED = new THREE.Color('#6ea8d8');

const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
})();

// Canvas 2D → textura (rotulado y halo del LED)
const canvasTexture = (size, paint) => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  paint(cv.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
};

function build() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 1.25;
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-3, 4, 5);
  const rim = new THREE.PointLight(0x9cc8f0, 2.5, 8);
  rim.position.set(0, 1.6, 2.2); // luz fría frontal para que el cromo brille
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.12));

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.1, 8.4);
  camera.lookAt(0, 0, 0);

  // El botón se modela "acostado" (eje Y) y el grupo lo pone de frente a la cámara
  const button = new THREE.Group();
  scene.add(button);
  const lathe = (pts, mat) =>
    new THREE.Mesh(
      new THREE.LatheGeometry(
        pts.map(([x, y]) => new THREE.Vector2(x, y)),
        96
      ),
      mat
    );

  // Bisel cromado
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xd0d5dc,
    metalness: 0.9,
    roughness: 0.26,
    side: THREE.DoubleSide
  });
  button.add(
    lathe(
      [
        [1.0, 0],
        [1.0, 0.2],
        [1.06, 0.29],
        [1.18, 0.32],
        [1.31, 0.29],
        [1.4, 0.18],
        [1.43, 0]
      ],
      chrome
    )
  );
  // Fondo del hueco
  const pit = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 64),
    new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.8 })
  );
  pit.rotation.x = -Math.PI / 2;
  pit.position.y = 0.01;
  button.add(pit);

  // Anillo LED y su halo
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x0b0f14, emissive: LED, emissiveIntensity: 1.5 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.94, 0.028, 16, 120), ledMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.06;
  button.add(ring);
  const haloMat = new THREE.MeshBasicMaterial({
    map: canvasTexture(256, (g, s) => {
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0.62, 'rgba(110,168,216,0)');
      grad.addColorStop(0.72, 'rgba(110,168,216,1)');
      grad.addColorStop(0.86, 'rgba(110,168,216,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    }),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    opacity: 0.5
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.08;
  button.add(halo);

  // Tapa de goma con el rotulado
  const cap = new THREE.Group();
  button.add(cap);
  cap.add(
    lathe(
      [
        [0, 0.3],
        [0.7, 0.3],
        [0.8, 0.285],
        [0.86, 0.23],
        [0.885, 0.12],
        [0.885, 0]
      ],
      new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.62, metalness: 0.1 })
    )
  );
  const label = canvasTexture(512, (g, s) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#dfe3ea';
    if ('letterSpacing' in g) g.letterSpacing = '8px';
    g.font = '700 54px "Segoe UI", Arial, sans-serif';
    g.fillText('ENGINE', s / 2, 150);
    g.font = '700 50px "Segoe UI", Arial, sans-serif';
    g.fillText('START', s / 2, 362);
    g.fillText('STOP', s / 2, 420);
    // Ícono de encendido
    g.strokeStyle = '#8fc0ea';
    g.lineWidth = 14;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(s / 2, 262, 50, -Math.PI / 2 + 0.75, -Math.PI / 2 - 0.75 + Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(s / 2, 196);
    g.lineTo(s / 2, 258);
    g.stroke();
  });
  const labelMat = new THREE.MeshStandardMaterial({
    map: label,
    transparent: true,
    roughness: 0.6,
    emissive: 0xffffff,
    emissiveMap: label,
    emissiveIntensity: 0.25,
    depthWrite: false
  });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.78, 64), labelMat);
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.302;
  cap.add(face);

  stage.prepend(canvas);
  stage.classList.add('has-3d');

  const resize = () => {
    const r = stage.getBoundingClientRect();
    if (!r.width) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  // Inclinación hacia el mouse
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e) => {
    tilt.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    tilt.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  let pressAt = -1,
    raf = 0,
    running = true;
  const t0 = performance.now();
  const loop = (now) => {
    const t = (now - t0) / 1000;
    tilt.x += (tilt.tx - tilt.x) * 0.08;
    tilt.y += (tilt.ty - tilt.y) * 0.08;
    button.rotation.set(Math.PI / 2 + tilt.y * 0.22, 0, -tilt.x * 0.22);

    if (pressAt < 0) {
      // En espera: el LED respira
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
      ledMat.emissiveIntensity = 1.1 + pulse * 1.4;
      haloMat.opacity = 0.3 + pulse * 0.35;
      labelMat.emissiveIntensity = 0.22 + pulse * 0.12;
    } else {
      const s = (now - pressAt) / 1000;
      // La tapa se hunde y regresa; el LED destella y queda encendido
      cap.position.y = -0.08 * (s < 0.09 ? s / 0.09 : Math.max(0, 1 - (s - 0.09) / 0.25));
      const flash = Math.max(0, 1 - s / 0.6);
      ledMat.emissive.copy(LED).lerp(new THREE.Color(0xffffff), flash * 0.7);
      ledMat.emissiveIntensity = 3 + flash * 5;
      haloMat.opacity = Math.min(1, 0.7 + flash);
      labelMat.emissiveIntensity = 0.9 + flash * 0.8;
      // Marcha: vibración corta antes de encender
      const crank = s < 0.5 ? 1 - s / 0.5 : 0;
      button.position.set((Math.random() - 0.5) * 0.04 * crank, (Math.random() - 0.5) * 0.04 * crank, 0);
    }
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  window.addEventListener(
    'ignition:press',
    () => {
      pressAt = performance.now();
    },
    { once: true }
  );
  window.addEventListener(
    'ignition:done',
    () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      renderer.dispose();
    },
    { once: true }
  );
}

if (stage && root.classList.contains('ignition-pending') && hasWebGL) {
  try {
    build();
  } catch (err) {
    console.warn('Botón 3D no disponible:', err);
  }
}
