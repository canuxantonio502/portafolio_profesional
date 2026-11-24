/* El arranque: la primera vez en la sesión el sitio está a oscuras con un botón
   ENGINE START/STOP. Al presionarlo (o con Enter/Espacio):
     ignition:press  → destello y vibración de marcha (el botón 3D se hunde)
     ignition:start  → se abre la luz, entra el hero y la aguja del tacómetro sube
     ignition:done   → se retira la pantalla
   No depende de librerías: si el 3D no carga, queda el botón de CSS. */
(() => {
  const root = document.documentElement;
  const overlay = document.getElementById('ignition');
  if (!overlay) return;
  if (!root.classList.contains('ignition-pending')) {
    overlay.remove();
    return;
  }

  const btn = document.getElementById('ign-btn');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const emit = (name) => window.dispatchEvent(new Event('ignition:' + name));

  // Título: cada letra en su span para la entrada (el texto ya viene traducido por main.js)
  const title = document.getElementById('ign-title');
  if (title) {
    const word = title.textContent.trim(),
      chars = [...word],
      mid = (chars.length - 1) / 2;
    title.setAttribute('aria-label', word);
    title.textContent = '';
    chars.forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'ign-ch';
      s.textContent = c;
      s.setAttribute('aria-hidden', 'true');
      s.style.cssText = `--i: ${i}; --o: ${i - mid}; --d: ${Math.abs(i - mid)}`;
      title.append(s);
    });
  }
  overlay.classList.add('is-ready');

  // Mientras está a oscuras, el resto de la página no recibe foco ni lectores de pantalla
  const behind = [...document.body.children].filter((el) => el !== overlay && el.tagName !== 'SCRIPT');
  behind.forEach((el) => {
    el.inert = true;
  });
  btn.focus({ preventScroll: true });

  let fired = false;
  const start = () => {
    if (fired) return;
    fired = true;
    try {
      sessionStorage.setItem('ignited', '1');
    } catch {
      /* sin almacenamiento */
    }
    // La luz se abre desde el centro del botón
    const b = btn.getBoundingClientRect();
    overlay.style.setProperty('--cx', (((b.left + b.width / 2) / innerWidth) * 100).toFixed(1) + '%');
    overlay.style.setProperty('--cy', (((b.top + b.height / 2) / innerHeight) * 100).toFixed(1) + '%');
    root.classList.add('ignition-press');
    emit('press');
    setTimeout(
      () => {
        behind.forEach((el) => {
          el.inert = false;
        });
        root.classList.add('ignition-on');
        emit('start');
      },
      reduce ? 0 : 480
    );
    setTimeout(
      () => {
        root.classList.remove('ignition-pending', 'ignition-press', 'ignition-on');
        overlay.remove();
        window.removeEventListener('keydown', onKey);
        emit('done');
      },
      reduce ? 380 : 1650
    );
  };
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      e.preventDefault();
      start();
    }
  };
  btn.addEventListener('click', start);
  window.addEventListener('keydown', onKey);
})();
