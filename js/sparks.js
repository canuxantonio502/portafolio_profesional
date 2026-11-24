/* Chispa de bujía: al hacer click en un espacio vacío salta un arco eléctrico
   breve y unas chispas que caen con gravedad. También avisa a las partículas
   de los márgenes (evento "spark") para que salgan disparadas.
   No se activa sobre enlaces, botones, campos ni tarjetas, ni al seleccionar texto. */
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const IGNORE =
    'dialog, a, button, input, textarea, select, label, summary, [role="dialog"], .card, .logo, .socials, .contact-form, .tach, .to-top, .menu-toggle, .nav, canvas.engine-canvas';
  const canvas = document.createElement('canvas');
  canvas.className = 'spark-layer';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0,
    H = 0,
    dpr = 1,
    raf = 0,
    last = 0;
  const sparks = [],
    arcs = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  const resize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  };

  // Arco en zigzag entre dos puntos, como el salto entre los electrodos
  const arcPoints = (x, y) => {
    const ang = rand(0, Math.PI * 2),
      len = rand(26, 44);
    const x0 = x - (Math.cos(ang) * len) / 2,
      y0 = y - (Math.sin(ang) * len) / 2;
    const nx = -Math.sin(ang),
      ny = Math.cos(ang),
      pts = [];
    const steps = 7;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        j = i && i < steps ? rand(-7, 7) : 0;
      pts.push([x0 + Math.cos(ang) * len * t + nx * j, y0 + Math.sin(ang) * len * t + ny * j]);
    }
    return pts;
  };

  const ignite = (x, y) => {
    arcs.push({ x, y, life: 0, max: 140, pts: arcPoints(x, y) });
    const n = rand(12, 18) | 0;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2),
        v = rand(2.2, 6.5);
      sparks.push({
        x,
        y,
        px: x,
        py: y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - rand(0.5, 2),
        life: 0,
        max: rand(380, 720),
        hot: Math.random() < 0.35 // algunas más blancas
      });
    }
    window.dispatchEvent(new CustomEvent('spark', { detail: { x, y } }));
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };

  const tick = (now) => {
    const dt = Math.min(40, Math.max(0, now - last));
    last = now;
    const k = dt / 16.7;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // En tema claro, mezcla normal y arco azul (el blanco no se vería)
    const light = document.documentElement.dataset.theme === 'light';
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    ctx.lineCap = 'round';

    // Arcos: destello blanco azulado que se apaga muy rápido
    for (let i = arcs.length - 1; i >= 0; i--) {
      const a = arcs[i];
      a.life += dt;
      const t = a.life / a.max;
      if (t >= 1) {
        arcs.splice(i, 1);
        continue;
      }
      if (a.life > 50 && a.life - dt <= 50) a.pts = arcPoints(a.x, a.y); // parpadeo
      const al = 1 - t;
      const glow = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, 46);
      glow.addColorStop(0, `rgba(170, 210, 255, ${0.45 * al})`);
      glow.addColorStop(1, 'rgba(170, 210, 255, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(a.x - 46, a.y - 46, 92, 92);
      [
        [6, `rgba(110, 168, 255, ${0.35 * al})`],
        [2, light ? `rgba(40, 105, 190, ${al})` : `rgba(235, 245, 255, ${al})`]
      ].forEach(([w, c]) => {
        ctx.lineWidth = w;
        ctx.strokeStyle = c;
        ctx.beginPath();
        a.pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.stroke();
      });
    }

    // Chispas: estela corta, gravedad y color que se enfría
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life += dt;
      const t = s.life / s.max;
      if (t >= 1) {
        sparks.splice(i, 1);
        continue;
      }
      s.px = s.x;
      s.py = s.y;
      s.vy += 0.16 * k;
      s.vx *= Math.pow(0.97, k);
      s.vy *= Math.pow(0.985, k);
      s.x += s.vx * k;
      s.y += s.vy * k;
      const al = 1 - t * t;
      const g = s.hot ? 240 : Math.round(220 - 120 * t),
        b = s.hot ? 220 : Math.round(140 - 120 * t);
      ctx.strokeStyle = `rgba(255, ${g}, ${Math.max(20, b)}, ${al})`;
      ctx.lineWidth = s.hot ? 1.8 : 1.4;
      ctx.beginPath();
      ctx.moveTo(s.px - s.vx * 1.5, s.py - s.vy * 1.5);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    if (arcs.length || sparks.length) raf = requestAnimationFrame(tick);
    else {
      raf = 0;
      ctx.clearRect(0, 0, W, H);
    }
  };

  document.addEventListener('click', (e) => {
    if (e.button !== 0 || e.target.closest(IGNORE)) return;
    if (document.body.classList.contains('modal-open')) return;
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed && String(sel).trim()) return; // estaba seleccionando texto
    ignite(e.clientX, e.clientY);
  });
  window.addEventListener('resize', resize);
  resize();
})();
