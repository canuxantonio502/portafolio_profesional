/* Partículas de los lados: ruedas, engranes, llaves, tuercas, código, música,
   cámara y balón flotando en los márgenes vacíos de la página.
   - Se apartan del mouse y giran al empujarlas.
   - Se mueven un poco con el scroll (efecto de profundidad).
   - Solo aparecen si los márgenes tienen espacio; con "reducir movimiento"
     se dibujan quietas. */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CONTENT = 1100;       // ancho de .container
  const MIN_GUTTER = 70;      // margen mínimo para mostrar partículas

  const canvas = document.createElement('canvas');
  canvas.className = 'side-particles';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  /* Íconos dibujados con trazos en una caja de 24×24 */
  const P = (d) => new Path2D(d);
  const circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, Math.PI * 2); return p; };
  const join = (...paths) => { const p = new Path2D(); paths.forEach((q) => p.addPath(q)); return p; };
  const gear = (() => {
    const p = new Path2D(), n = 8;
    for (let i = 0; i < n * 4; i++) {
      const a = (i / (n * 4)) * Math.PI * 2 - Math.PI / (n * 4);
      const r = i % 4 < 2 ? 10.5 : 8;
      i ? p.lineTo(12 + r * Math.cos(a), 12 + r * Math.sin(a)) : p.moveTo(12 + r * Math.cos(a), 12 + r * Math.sin(a));
    }
    p.closePath();
    return join(p, circle(12, 12, 3.5));
  })();
  const wheel = (() => {
    const spokes = new Path2D();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      spokes.moveTo(12 + 3.5 * Math.cos(a), 12 + 3.5 * Math.sin(a));
      spokes.lineTo(12 + 8 * Math.cos(a), 12 + 8 * Math.sin(a));
    }
    return join(circle(12, 12, 10.5), circle(12, 12, 8), circle(12, 12, 3.5), spokes);
  })();
  const nut = (() => {
    const p = new Path2D();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      i ? p.lineTo(12 + 10 * Math.cos(a), 12 + 10 * Math.sin(a)) : p.moveTo(22, 12);
    }
    p.closePath();
    return join(p, circle(12, 12, 4.5));
  })();
  const ball = (() => {
    const pent = new Path2D(), rays = new Path2D();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const x = 12 + 4 * Math.cos(a), y = 12 + 4 * Math.sin(a);
      i ? pent.lineTo(x, y) : pent.moveTo(x, y);
      rays.moveTo(x, y);
      rays.lineTo(12 + 10.5 * Math.cos(a), 12 + 10.5 * Math.sin(a));
    }
    pent.closePath();
    return join(circle(12, 12, 10.5), pent, rays);
  })();
  const ICONS = [
    { path: wheel, w: 3 },
    { path: gear, w: 3 },
    { path: P('M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'), w: 3 }, // llave
    { path: nut, w: 2 },
    { path: join(P('M9 18V5l12-2v13'), circle(6, 18, 3), circle(18, 16, 3)), w: 3 },          // notas
    { path: join(P('M9 18V5'), circle(6, 18, 3), P('M9 5c3 1 5 3 4 7')), w: 2 },               // corchea
    { path: join(P('M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z'), circle(12, 13, 4)), w: 2 }, // cámara
    { path: ball, w: 2 },
    { text: '</>', w: 3 }, { text: '{ }', w: 3 }, { text: '=>', w: 2 }, { text: '( )', w: 1 }, { text: ';', w: 1 }
  ];
  const bag = ICONS.flatMap((ic) => Array(ic.w).fill(ic));

  let W = 0, H = 0, dpr = 1, gutter = 0, color = '#6ea8d8', parts = [], active = false, raf = 0;
  const mouse = { x: -1e4, y: -1e4 };
  const rand = (a, b) => a + Math.random() * (b - a);

  const readColor = () => {
    color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || color;
  };

  // Posición dentro de un margen (izquierdo o derecho)
  const homeX = (side) => (side < 0 ? rand(10, gutter - 14) : W - rand(10, gutter - 14));
  const spawn = (p, y) => {
    p.side = Math.random() < 0.5 ? -1 : 1;
    p.x = homeX(p.side);
    p.y = y;
    p.vx = 0; p.vy = 0; p.glow = 0;
    p.drift = rand(-0.22, -0.06);              // suben despacio, como chispas
    p.sway = rand(0, Math.PI * 2);
    p.rot = rand(0, Math.PI * 2);
    p.spin = rand(-0.004, 0.004);
    p.size = rand(18, 34);
    p.depth = rand(0.15, 0.5);                 // cuánto se mueven con el scroll
    p.alpha = rand(0.24, 0.46);
    p.icon = bag[(Math.random() * bag.length) | 0];
    return p;
  };

  const resize = () => {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    gutter = (W - Math.min(CONTENT, W - 40)) / 2;
    const show = gutter >= MIN_GUTTER;
    canvas.style.display = show ? '' : 'none';
    if (!show) { active = false; cancelAnimationFrame(raf); raf = 0; return; }
    // Cantidad según el área de los márgenes
    const count = Math.min(56, Math.round((gutter * 2 * H) / 11000));
    parts = Array.from({ length: count }, () => spawn({}, rand(0, H)));
    active = true;
    readColor();
    if (reduce) draw(); else if (!raf) raf = requestAnimationFrame(tick);
  };

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of parts) {
      // Se desvanecen si entran al área del contenido
      const into = p.side < 0 ? p.x - gutter : W - gutter - p.x;
      const fade = Math.max(0, 1 - Math.max(0, into + 10) / 50);
      const edge = Math.min(1, p.y / 60, (H - p.y) / 60);
      const a = p.alpha * fade * Math.max(0, edge) * (1 + p.glow * 1.6);
      if (a <= 0.005) continue;
      ctx.globalAlpha = Math.min(0.9, a);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const k = p.size / 24;
      ctx.scale(k, k);
      if (p.icon.text) {
        ctx.font = '700 15px Consolas, "Cascadia Code", monospace';
        ctx.fillText(p.icon.text, 0, 0);
      } else {
        ctx.translate(-12, -12);
        ctx.lineWidth = 1.5 / k;
        ctx.stroke(p.icon.path);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  let lastScroll = window.scrollY;
  const tick = () => {
    raf = 0;
    if (!active || document.hidden) return;
    const sy = window.scrollY, ds = sy - lastScroll;
    lastScroll = sy;
    for (const p of parts) {
      p.glow *= 0.94;
      // Empuje del mouse
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy, R = 120;
      if (d2 < R * R) {
        const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 0.9;
        p.vx += (dx / d) * f; p.vy += (dy / d) * f;
        p.spin += (dx > 0 ? 1 : -1) * f * 0.006;
        p.glow = Math.min(1, p.glow + f * 0.25);
      }
      // Vuelve a su margen si el empuje lo metió al contenido
      const into = p.side < 0 ? p.x - (gutter - 14) : (W - gutter + 14) - p.x;
      if (into > 0) p.vx += p.side * into * 0.004;
      p.sway += 0.01;
      p.vx *= 0.94; p.vy *= 0.94;
      p.spin = p.spin * 0.985 + (p.spin > 0 ? 0.00004 : -0.00004);
      p.x += p.vx + Math.sin(p.sway) * 0.12;
      p.y += p.vy + p.drift - ds * p.depth;
      p.rot += p.spin;
      // Al salir por arriba o abajo reaparecen del otro lado, como otra pieza
      // (con módulo: un salto grande de scroll no las amontona en un borde)
      if (p.y < -40 || p.y > H + 40) {
        const span = H + 80;
        spawn(p, ((((p.y + 40) % span) + span) % span) - 40);
      }
      p.x = Math.min(W - 6, Math.max(6, p.x));
    }
    draw();
    raf = requestAnimationFrame(tick);
  };

  // Chispa de bujía (js/sparks.js): las piezas cercanas salen disparadas
  window.addEventListener('spark', (e) => {
    const { x, y } = e.detail, R = 240;
    for (const p of parts) {
      const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
      if (d > R) continue;
      const f = (1 - d / R) * 9;
      p.vx += (dx / d) * f; p.vy += (dy / d) * f;
      p.spin += (Math.random() - 0.5) * 0.12 * (1 - d / R);
      p.glow = 1;
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && active && !reduce && !raf) { lastScroll = window.scrollY; raf = requestAnimationFrame(tick); }
  });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  new MutationObserver(() => { readColor(); if (reduce) draw(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  resize();
})();
