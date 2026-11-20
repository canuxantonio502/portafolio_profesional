(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* Idioma (ES / EN): los textos viven en js/i18n.js */
  const DICT = window.I18N || { es: {} };
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }
  };
  let lang = store.get('lang');
  if (!DICT[lang]) lang = (navigator.language || 'es').toLowerCase().startsWith('en') && DICT.en ? 'en' : 'es';
  const t = (key, vars = {}) => {
    const v = (DICT[lang] && DICT[lang][key]) ?? DICT.es[key] ?? key;
    return typeof v === 'string' ? v.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : v;
  };
  const langListeners = [];
  const applyLang = () => {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-attr]').forEach((el) => {
      el.dataset.i18nAttr.split(';').forEach((pair) => {
        const [attr, key] = pair.split(':').map((x) => x.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
    const lt = $('#lang-toggle');
    lt.dataset.current = lang;
    lt.setAttribute('aria-label', t('lang.switch'));
    lt.title = t('lang.switch');
    langListeners.forEach((fn) => fn());
  };
  $('#lang-toggle').addEventListener('click', () => {
    lang = lang === 'es' ? 'en' : 'es';
    store.set('lang', lang);
    applyLang();
  });

  /* Tema claro / oscuro (el tema inicial lo aplica el script del <head>) */
  const root = document.documentElement, themeBtn = $('#theme-toggle');
  const themeMeta = $('meta[name="theme-color"]');
  const systemLight = window.matchMedia('(prefers-color-scheme: light)');
  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    themeMeta.content = theme === 'light' ? '#eceff3' : '#0b1220';
    const label = t(theme === 'light' ? 'theme.toDark' : 'theme.toLight');
    themeBtn.setAttribute('aria-label', label);
    themeBtn.title = label;
  };
  themeBtn.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    store.set('theme', next);
    applyTheme(next);
  });
  // Si el visitante no eligió un tema, sigue el del sistema
  systemLight.addEventListener('change', (e) => {
    const saved = store.get('theme');
    if (saved !== 'light' && saved !== 'dark') applyTheme(e.matches ? 'light' : 'dark');
  });
  langListeners.push(() => applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark'));

  /* Imágenes con respaldo: si una imagen falta, muestra un marcador con texto */
  const applyFallback = (img) => {
    if (img.dataset.done) return;
    img.dataset.done = '1';
    const ph = document.createElement('span');
    ph.className = 'ph';
    ph.textContent = img.dataset.fallback || '';
    ph.setAttribute('role', 'img');
    ph.setAttribute('aria-label', img.alt || img.dataset.fallback || '');
    ph.classList.add(...img.classList);
    img.replaceWith(ph);
  };
  $$('img[data-fallback]').forEach((img) => {
    img.addEventListener('error', () => applyFallback(img));
    if (img.complete && img.naturalWidth === 0) applyFallback(img);
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  // El arranque (js/ignition.js): si el sitio empieza a oscuras, las entradas esperan al encendido
  const ignitionPending = document.documentElement.classList.contains('ignition-pending');
  const afterIgnition = (fn) => (ignitionPending ? window.addEventListener('ignition:start', fn, { once: true }) : fn());

  /* Tacómetro: la aguja sube con el scroll y llega a la zona roja al final */
  const tach = $('#tach'), needle = $('.tach-needle', tach);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const polar = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return [50 + r * Math.sin(a), 50 - r * Math.cos(a)].map((n) => +n.toFixed(2));
  };
  const arc = (from, to, r) => {
    const [x1, y1] = polar(from, r), [x2, y2] = polar(to, r);
    return `M${x1} ${y1}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  // 0 a 8 (x1000 rpm) repartidos en 240°, de -120° a +120°
  const rpmToDeg = (rpm) => -120 + rpm * 30;
  $('.tach-arc', tach).setAttribute('d', arc(-120, rpmToDeg(6.5), 42));
  $('.tach-red', tach).setAttribute('d', arc(rpmToDeg(6.5), 120, 42));
  const ticks = $('.tach-ticks', tach);
  for (let i = 0; i <= 8; i++) {
    const [x1, y1] = polar(rpmToDeg(i), 38), [x2, y2] = polar(rpmToDeg(i), 33);
    const line = document.createElementNS(SVGNS, 'line');
    Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => line.setAttribute(k, v));
    ticks.appendChild(line);
    if (i % 2 === 0) {
      const [tx, ty] = polar(rpmToDeg(i), 26);
      const label = document.createElementNS(SVGNS, 'text');
      label.setAttribute('x', tx); label.setAttribute('y', ty);
      label.textContent = i;
      ticks.appendChild(label);
    }
  }
  let needleTarget = -120, needleNow = -120, needleRaf = 0;
  const drawNeedle = () => {
    needleNow += (needleTarget - needleNow) * (reduceMotion ? 1 : 0.12);
    needle.setAttribute('transform', `rotate(${needleNow.toFixed(2)} 50 50)`);
    tach.classList.toggle('redline', needleNow > rpmToDeg(6.5));
    // Tacómetro 3D (js/tach3d.js), si ya cargó
    window.__tachRpm = (needleNow + 120) / 30;
    if (window.tach3d) window.tach3d.update(window.__tachRpm);
    needleRaf = Math.abs(needleTarget - needleNow) > 0.1 ? requestAnimationFrame(drawNeedle) : 0;
  };

  /* Header, tacómetro, botón volver arriba */
  const header = $('#header'), toTop = $('#to-top'), cue = $('.scroll-cue');
  let revving = false;   // acelerón del arranque: el tacómetro aparece y la aguja sube
  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (!revving) needleTarget = rpmToDeg(8 * (max > 0 ? clamp(y / max) : 0));
    if (!needleRaf) needleRaf = requestAnimationFrame(drawNeedle);
    tach.classList.toggle('show', y > 120 || revving);
    header.classList.toggle('scrolled', y > 10);
    toTop.classList.toggle('show', y > 500);
    toTop.style.setProperty('--spin', (y * 0.12).toFixed(1) + 'deg'); // el engrane avanza con el scroll
    if (cue) cue.classList.toggle('gone', y > 60);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (ignitionPending && !reduceMotion) {
    window.addEventListener('ignition:start', () => {
      revving = true;
      needleTarget = rpmToDeg(7.4);
      onScroll();
      setTimeout(() => { revving = false; onScroll(); }, 900);
    }, { once: true });
  }
  toTop.addEventListener('click', () => {
    // Reversa: la flecha sale disparada y el engrane gira hacia atrás mientras sube
    toTop.classList.remove('reversing'); void toTop.offsetWidth; toTop.classList.add('reversing');
    if (window.lenis) window.lenis.scrollTo(0);
    else window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* Menú móvil */
  const toggle = $('#menu-toggle'), nav = $('#nav');
  const closeMenu = () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); };
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  $$('a', nav).forEach((a) => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());

  /* Enlace activo según la sección visible */
  const links = $$('a', nav);
  const secObserver = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        links.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#' + en.target.id));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach((s) => secObserver.observe(s));

  /* Aparición al hacer scroll */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('visible'); obs.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach((el, i) => { el.style.transitionDelay = (i % 4) * 80 + 'ms'; io.observe(el); });
  } else {
    reveals.forEach((el) => el.classList.add('visible'));
  }

  /* Carrusel de logos: duplica la pista para que el desplazamiento sea continuo */
  $$('.marquee').forEach((m) => {
    const track = $('.marquee-track', m);
    [...track.children].forEach((li) => {
      const copy = li.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      $$('[id]', copy).forEach((el) => el.removeAttribute('id'));
      track.appendChild(copy);
    });
    m.classList.add('is-running');
  });

  /* Texto que se escribe (se reinicia al cambiar de idioma) */
  const typed = $('#typed');
  let typedTimer;
  const startTyping = () => {
    clearTimeout(typedTimer);
    const roles = t('hero.roles');
    if (reduceMotion) { typed.textContent = roles[0]; return; }
    let r = 0, c = 0, del = false;
    const tick = () => {
      const word = roles[r];
      typed.textContent = word.slice(0, c);
      if (!del && c === word.length) { del = true; typedTimer = setTimeout(tick, 1800); return; }
      if (del && c === 0) { del = false; r = (r + 1) % roles.length; }
      c += del ? -1 : 1;
      typedTimer = setTimeout(tick, del ? 35 : 70);
    };
    tick();
  };
  langListeners.push(startTyping);

  /* Contadores: suben con frenado suave al aparecer (al instante con movimiento reducido) */
  const counters = $$('[data-count]');
  const cio = new IntersectionObserver((entries, obs) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target, target = +el.dataset.count, start = performance.now();
      const dur = 900 + target * 60;
      const step = (now) => {
        const p = reduceMotion ? 1 : Math.min((now - start) / dur, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      obs.unobserve(el);
    });
  }, { threshold: 0.6 });
  afterIgnition(() => counters.forEach((c) => cio.observe(c)));

  /* Filtro de proyectos */
  const filters = $$('.filter'), cards = $$('.card');
  filters.forEach((btn) => btn.addEventListener('click', () => {
    filters.forEach((b) => b.classList.toggle('active', b === btn));
    const f = btn.dataset.filter;
    cards.forEach((card) => card.classList.toggle('hide', f !== 'all' && card.dataset.cat !== f));
  }));

  /* Formulario: validación y envío por WhatsApp */
  const form = $('#contact-form'), status = $('#form-status');
  const msg = $('#message'), counter = $('#counter');
  msg.addEventListener('input', () => { counter.textContent = `${msg.value.length}/${msg.maxLength}`; });

  const validate = (input) => {
    const field = input.closest('.field'), err = $('.error', field);
    let text = '';
    if (input.validity.valueMissing) text = t('form.required');
    else if (input.validity.typeMismatch) text = t('form.invalidEmail');
    else if (input.validity.tooShort) text = t('form.tooShort', { n: input.minLength });
    field.classList.toggle('invalid', !!text);
    err.textContent = text;
    return !text;
  };
  $$('input, textarea', form).forEach((i) => {
    i.addEventListener('blur', () => validate(i));
    i.addEventListener('input', () => i.closest('.invalid') && validate(i));
  });
  langListeners.push(() => {
    $$('.field.invalid input, .field.invalid textarea', form).forEach(validate);
    status.textContent = '';
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = $$('input, textarea', form).map(validate).every(Boolean);
    if (!ok) { status.textContent = ''; return; }
    const d = new FormData(form);
    const name = d.get('name'), text = `${t('form.whatsapp', { name, email: d.get('_replyto') })}\n\n${d.get('message')}`;
    if (e.submitter && e.submitter.dataset.via === 'whatsapp') {
      window.open('https://wa.me/50231007720?text=' + encodeURIComponent(text), '_blank', 'noopener');
      status.textContent = t('form.opening');
    } else {
      // Por defecto (Enter o "Enviar por correo"): abre el correo con todo listo
      location.href = 'mailto:canuxantonio77@gmail.com?subject=' + encodeURIComponent(t('form.emailSubject', { name })) + '&body=' + encodeURIComponent(text);
      status.textContent = t('form.openingEmail');
    }
    form.reset();
    counter.textContent = '0/' + msg.maxLength;
  });

  /* Tarjetas con dos caras (WTWT: descripción ↔ mi parte) */
  $$('[data-flip]').forEach((flip) => {
    const faces = $$('.flip-face', flip), dots = $$('.flip-dots button', flip);
    const card = flip.closest('.card') || flip;
    let i = 0, timer = 0, visible = false, paused = false;
    const show = (n) => {
      i = n;
      faces.forEach((f, k) => f.classList.toggle('is-on', k === n));
      dots.forEach((d, k) => { d.classList.toggle('is-on', k === n); d.setAttribute('aria-pressed', String(k === n)); });
    };
    const run = () => {
      clearInterval(timer);
      if (visible && !paused) timer = setInterval(() => show((i + 1) % faces.length), 6000);
    };
    dots.forEach((d, k) => d.addEventListener('click', () => { show(k); run(); }));
    card.addEventListener('pointerenter', () => { paused = true; run(); });
    card.addEventListener('pointerleave', () => { paused = false; run(); });
    card.addEventListener('focusin', () => { paused = true; run(); });
    card.addEventListener('focusout', () => { paused = false; run(); });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }).observe(card);
  });

  /* CV: visor y descarga.
     Usa el PDF del idioma actual; si no existe, el del otro idioma. */
  const cvModal = $('#cv-modal'), cvFrame = $('#cv-frame'), cvMissing = $('#cv-missing');
  const cvCache = {};
  const cvExists = (url) => {
    if (location.protocol === 'file:') return Promise.resolve(true);
    if (!(url in cvCache)) {
      cvCache[url] = fetch(url, { method: 'HEAD', cache: 'no-cache' })
        .then((r) => r.ok && !(r.headers.get('content-type') || '').includes('text/html'))
        .catch(() => false);
    }
    return cvCache[url];
  };
  let cvUrl = null;
  const resolveCv = async () => {
    const other = DICT[lang === 'es' ? 'en' : 'es'];
    for (const url of [t('cv.file'), other && other['cv.file']]) {
      if (url && await cvExists(url)) return url;
    }
    return null;
  };
  const loadCvFrame = () => {
    cvMissing.hidden = !!cvUrl;
    cvFrame.hidden = !cvUrl;
    const src = cvUrl ? cvUrl + '#view=FitH' : 'about:blank';
    if (cvFrame.getAttribute('src') !== src) cvFrame.setAttribute('src', src);
  };
  const updateCv = async () => {
    const current = lang;
    const url = await resolveCv();
    if (current !== lang) return; // el idioma cambió mientras se comprobaba
    cvUrl = url;
    $$('[data-cv-download], [data-cv-newtab]').forEach((a) => {
      if (url) {
        a.href = url;
        if (a.hasAttribute('data-cv-download')) a.download = url.split('/').pop();
        a.removeAttribute('aria-disabled');
      } else {
        a.removeAttribute('href');
        a.setAttribute('aria-disabled', 'true');
      }
    });
    if (!cvModal.hidden) loadCvFrame();
  };
  let lastFocus = null;
  const openCv = () => {
    lastFocus = document.activeElement;
    closeMenu();
    cvModal.hidden = false;
    document.body.classList.add('modal-open');
    if (window.lenis) window.lenis.stop();   // el fondo no se mueve con el visor abierto
    loadCvFrame();
    $('.cv-close', cvModal).focus();
  };
  const closeCv = () => {
    if (cvModal.hidden) return;
    cvModal.hidden = true;
    document.body.classList.remove('modal-open');
    if (window.lenis) window.lenis.start();
    if (lastFocus) lastFocus.focus();
  };
  $$('[data-cv-open]').forEach((b) => b.addEventListener('click', openCv));
  $$('[data-cv-close]', cvModal).forEach((b) => b.addEventListener('click', closeCv));
  $$('[data-cv-download], [data-cv-newtab]').forEach((a) => a.addEventListener('click', (e) => {
    if (!cvUrl) { e.preventDefault(); if (cvModal.hidden) openCv(); }
  }));
  document.addEventListener('keydown', (e) => {
    if (cvModal.hidden) return;
    if (e.key === 'Escape') closeCv();
    if (e.key === 'Tab') { // mantener el foco dentro del visor
      const f = $$('a[href], button, iframe', cvModal).filter((el) => !el.hidden && el.offsetParent);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  langListeners.push(updateCv);

  /* Año del footer */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* Créditos: el pie es solo un botón; el panel sube desde abajo (dialog nativo:
     atrapa el foco y se cierra con Esc). También se cierra al tocar fuera. */
  const credits = $('#credits'), creditsBtn = $('.credits-btn');
  if (credits && creditsBtn && credits.showModal) {
    const closeCredits = () => {
      if (!credits.open || credits.classList.contains('closing')) return;
      credits.classList.add('closing');
      setTimeout(() => { credits.classList.remove('closing'); credits.close(); }, reduceMotion ? 0 : 280);
    };
    creditsBtn.addEventListener('click', () => {
      credits.showModal();
      creditsBtn.setAttribute('aria-expanded', 'true');
      if (window.lenis) window.lenis.stop();
    });
    credits.addEventListener('close', () => {
      creditsBtn.setAttribute('aria-expanded', 'false');
      if (window.lenis) window.lenis.start();
    });
    credits.addEventListener('cancel', (e) => { e.preventDefault(); closeCredits(); });   // Esc, con animación
    $('.sheet-close', credits).addEventListener('click', closeCredits);
    credits.addEventListener('click', (e) => { if (e.target === credits) closeCredits(); }); // fuera del panel
  }

  /* ---------- Experiencia inmersiva (GSAP + ScrollTrigger) ---------- */
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    // Con scroll-behavior: smooth (CSS), ScrollTrigger mide mal al recargar o cambiar el
    // tamaño a media página. Se apaga y los enlaces internos se desplazan suave por JS.
    document.documentElement.style.scrollBehavior = 'auto';
    // Al retirar la pantalla del arranque cambia el desbordamiento de html: se vuelven a medir los disparadores
    if (ignitionPending) window.addEventListener('ignition:done', () => ScrollTrigger.refresh(), { once: true });

    // Scroll suave con inercia (Lenis), sincronizado con el reloj de GSAP.
    // En táctiles Lenis deja el scroll nativo; con movimiento reducido no se activa.
    if (window.Lenis && !reduceMotion) {
      const lenis = new Lenis({ lerp: 0.1 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
      // La página cambia de alto (galería fijada, motor de la meta): Lenis recalcula su límite
      ScrollTrigger.addEventListener('refresh', () => lenis.resize());
      window.lenis = lenis;
      if (ignitionPending) { lenis.stop(); afterIgnition(() => lenis.start()); }
    }

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      const target = a && a.getAttribute('href').length > 1 && document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = -(header ? header.offsetHeight : 0);
      if (window.lenis) window.lenis.scrollTo(target, { offset });
      else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY + offset, behavior: reduceMotion ? 'auto' : 'smooth' });
      history.pushState(null, '', a.getAttribute('href'));
    });
  }

  /* Hero: el nombre entra letra por letra y la escena se aleja al bajar */
  const h1 = $('.hero h1');
  if (h1) {
    const name = h1.textContent.trim();
    h1.setAttribute('aria-label', name);
    h1.innerHTML = name.split(' ').map((w) =>
      `<span class="word" aria-hidden="true" style="display:inline-block;white-space:nowrap">${[...w].map((c) => `<span class="ch">${c}</span>`).join('')}</span>`
    ).join(' ');
  }
  /* Aura del nombre: las letras cerca del mouse se encienden con un degradado de color
     (acento → violeta → chispa). En pantallas táctiles, un toque la pasa de lado a lado. */
  if (h1) {
    const chars = $$('.ch', h1);
    const stops = [[110, 168, 216], [139, 124, 246], [255, 154, 60]];   // acento, violeta, chispa
    chars.forEach((ch, i) => {
      const t = chars.length > 1 ? i / (chars.length - 1) : 0;
      const k = t < 0.5 ? t * 2 : (t - 0.5) * 2, [a, b] = t < 0.5 ? [stops[0], stops[1]] : [stops[1], stops[2]];
      ch.style.setProperty('--aura', `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(', ')})`);
    });
    const R = 130;   // radio del aura en px
    let raf = 0, px = 0, py = 0;
    const paint = () => {
      raf = 0;
      chars.forEach((ch) => {
        const r = ch.getBoundingClientRect();
        const d = Math.hypot(r.left + r.width / 2 - px, (r.top + r.height / 2 - py) * 1.6);
        ch.style.setProperty('--p', Math.max(0, 1 - d / R).toFixed(3));
      });
    };
    const at = (x, y) => { px = x; py = y; if (!raf) raf = requestAnimationFrame(paint); };
    const off = () => { cancelAnimationFrame(raf); raf = 0; chars.forEach((ch) => ch.style.setProperty('--p', '0')); };
    h1.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') at(e.clientX, e.clientY); });
    h1.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') off(); });
    // Toque: el aura recorre el nombre una vez
    let sweeping = false;
    h1.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || sweeping) return;
      const box = h1.getBoundingClientRect(), y = box.top + box.height / 2, t0 = performance.now(), dur = reduceMotion ? 0 : 1100;
      sweeping = true;
      const step = (now) => {
        const t = dur ? Math.min(1, (now - t0) / dur) : 1;
        at(box.left - R + (box.width + 2 * R) * t, y);
        if (t < 1) requestAnimationFrame(step); else { sweeping = false; setTimeout(off, 60); }
      };
      requestAnimationFrame(step);
    });
  }
  if (hasGsap && !reduceMotion) {
    // En pausa hasta el arranque: el hero queda vacío en la oscuridad y entra con la luz
    const heroIntro = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    afterIgnition(() => heroIntro.play());
    heroIntro
      .from('.hero .eyebrow', { y: 16, opacity: 0, duration: 0.6 })
      .from('.hero h1 .ch', { yPercent: 90, opacity: 0, rotate: 8, stagger: 0.035, duration: 0.8 }, '-=0.3')
      .from('.hero .role', { y: 16, opacity: 0, duration: 0.6 }, '-=0.45')
      .from('.hero .lead', { y: 16, opacity: 0, duration: 0.6 }, '-=0.45')
      .from('.hero .actions', { y: 14, opacity: 0, duration: 0.5 }, '-=0.4')
      .from('.hero-photo', { scale: 0.85, opacity: 0, rotate: -6, duration: 1.1 }, 0.25)
      .from('.scroll-cue', { y: 10, opacity: 0, duration: 0.6, clearProps: 'all' }, '-=0.2');
    const heroST = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('.hero-text', { y: -70, opacity: 0.25, ease: 'none', scrollTrigger: heroST });
    gsap.to('.hero-photo', { yPercent: -14, ease: 'none', scrollTrigger: { ...heroST } });
  }

  /* Sobre mí: el manifiesto se ilumina palabra por palabra con el scroll.
     En el texto (i18n) las frases entre *asteriscos* se resaltan con el color de acento. */
  const mani = $('.manifesto');
  let maniTween = null;
  const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const buildManifesto = () => {
    if (!mani) return;
    const text = t(mani.dataset.manifesto);
    let hl = false;
    const words = text.split(/\s+/).map((tok) => {
      if (tok.startsWith('*')) { hl = true; tok = tok.slice(1); }
      const ends = tok.includes('*');
      const html = `<span class="w${hl ? ' hl' : ''}">${esc(tok.replace('*', ''))}</span>`;
      if (ends) hl = false;
      return html;
    }).join(' ');
    // Texto completo para lectores de pantalla; las palabras sueltas son decorativas
    mani.innerHTML = `<span class="sr-only">${esc(text.replace(/\*/g, ''))}</span><span aria-hidden="true">${words}</span>`;
    if (maniTween) { maniTween.scrollTrigger.kill(); maniTween.kill(); maniTween = null; }
    if (hasGsap && !reduceMotion) {
      mani.classList.add('is-live');
      maniTween = gsap.fromTo($$('.w', mani), { opacity: 0.14 }, {
        opacity: 1, ease: 'none', stagger: 0.08,
        scrollTrigger: { trigger: mani, start: 'top 82%', end: 'bottom 48%', scrub: 0.4 }
      });
    }
  };
  langListeners.push(buildManifesto);

  /* Trayectoria: el motor gira, se despieza y se transforma en código */
  const story = $('.story');
  if (story) {
    const svg = $('.engine', story);
    const el = (s) => $(s, svg);
    const gBig = el('#g-big'), gSmall = el('#g-small'), gPiston = el('#g-piston');
    const pHead = el('#p-head'), pRod = el('#p-rod'), pPin = el('#p-pin');
    const parts = el('.eng-parts'), labels = el('.eng-labels');
    const braces = el('#glyph-braces'), tag = el('#glyph-tag');
    const code = el('.eng-code'), frame = el('#code-frame'), lines = $$('.code-lines text', svg);
    const seg = (p, a, b) => clamp((p - a) / (b - a));
    const smooth = (t) => t * t * (3 - 2 * t);
    const scaleAt = (x, y, s) => `translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`;

    const render = (p) => {
      // El motor 3D (js/engine3d.js), si cargó, sigue el mismo avance
      window.__storyP = p;
      if (window.engine3d) window.engine3d.update(p);
      const rot = p * 720;
      const ex = smooth(seg(p, 0.22, 0.36));            // vista despiezada
      const mo = smooth(seg(p, 0.5, 0.66));             // piezas -> símbolos
      const co = seg(p, 0.72, 0.9);                     // símbolos -> código
      gBig.setAttribute('transform', `translate(${150 - 34 * ex} ${205 - 14 * ex}) rotate(${rot}) scale(${1 - 0.3 * mo})`);
      gSmall.setAttribute('transform', `translate(${247 + 26 * ex} ${149 - 26 * ex}) rotate(${-rot * 1.5 + 11})`);
      // Biela y pistón: el cigüeñal da 6 vueltas en todo el recorrido
      const th = (p * 360 * 6 * Math.PI) / 180;
      const pinX = 310 + 18 * Math.sin(th), pinY = 340 - 18 * Math.cos(th);
      const wristY = pinY - Math.sqrt(70 * 70 - (pinX - 310) ** 2);
      pHead.setAttribute('y', (wristY - 26).toFixed(2));
      pRod.setAttribute('x1', 310); pRod.setAttribute('y1', wristY.toFixed(2));
      pRod.setAttribute('x2', pinX.toFixed(2)); pRod.setAttribute('y2', pinY.toFixed(2));
      pPin.setAttribute('cx', pinX.toFixed(2)); pPin.setAttribute('cy', pinY.toFixed(2));
      gPiston.setAttribute('transform', `translate(${30 * ex} ${22 * ex})`);
      parts.style.opacity = 1 - mo;
      labels.style.opacity = seg(p, 0.27, 0.4) * (1 - seg(p, 0.5, 0.58));
      const fadeGlyphs = 1 - seg(p, 0.74, 0.84);
      braces.style.opacity = mo * fadeGlyphs;
      braces.setAttribute('transform', scaleAt(150 - 34 * ex, 205, 0.5 + 0.5 * mo));
      tag.style.opacity = mo * fadeGlyphs;
      tag.setAttribute('transform', scaleAt(247 + 26 * ex, 149, 0.5 + 0.5 * mo));
      code.style.opacity = seg(p, 0.72, 0.78);
      frame.style.strokeDashoffset = 1 - seg(p, 0.72, 0.86);
      lines.forEach((ln, i) => {
        const o = seg(p, 0.8 + i * 0.03, 0.84 + i * 0.03);
        ln.style.opacity = o;
        ln.setAttribute('transform', `translate(${(o - 1) * 14} 0)`);
      });
    };

    const chapters = $$('.chapter', story), dots = $$('.story-dots li', story);
    const STATES = [0.1, 0.42, 0.66, 1];   // estado del motor para cada capítulo
    const setActive = (i) => {
      chapters.forEach((c, k) => c.classList.toggle('active', k === i));
      dots.forEach((d, k) => d.classList.toggle('active', k === i));
      if (!hasGsap || reduceMotion) render(STATES[i]);
    };
    story.classList.add('is-live');
    render(0);

    if (hasGsap && !reduceMotion) {
      ScrollTrigger.create({
        trigger: '.story-inner', start: 'top top', end: 'bottom bottom', scrub: 0.6,
        onUpdate: (self) => render(self.progress)
      });
    }
    // Capítulo activo: el que cruza el centro del área visible
    // (en móvil el motor ocupa la parte de arriba, así que la línea baja)
    const mobile = window.matchMedia('(max-width: 820px)').matches;
    const line = mobile ? '-68% 0px -32% 0px' : '-50% 0px -50% 0px';
    const chIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setActive(chapters.indexOf(en.target)); });
    }, { rootMargin: line });
    chapters.forEach((c) => chIO.observe(c));
    setActive(0);
  }

  /* Proyectos: galería horizontal fijada. Al bajar, las tarjetas pasan de lado.
     Solo en pantallas anchas y altas; en el resto queda la cuadrícula normal. */
  const projSection = $('#proyectos'), track = $('.projects');
  if (hasGsap && projSection && track) {
    const bar = document.createElement('div');
    bar.className = 'h-progress';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<span></span>';
    track.after(bar);
    const fill = $('span', bar);
    const distance = () => Math.max(0, track.scrollWidth - track.parentElement.clientWidth);
    let projST = null;

    gsap.matchMedia().add('(min-width: 821px) and (min-height: 680px) and (prefers-reduced-motion: no-preference)', () => {
      projSection.classList.add('is-h');
      const tween = gsap.to(track, {
        x: () => -distance(), ease: 'none',
        scrollTrigger: {
          trigger: projSection, start: 'top top', end: () => '+=' + distance(),
          pin: true, scrub: 0.6, invalidateOnRefresh: true,
          onUpdate: (self) => { fill.style.transform = `scaleX(${self.progress})`; }
        }
      });
      const st = projST = tween.scrollTrigger;
      // gsap.matchMedia ya revierte el tween al cambiar de tamaño: aquí solo se limpia lo propio
      return () => { projSection.classList.remove('is-h'); projST = null; if (st) st.kill(); tween.kill(); gsap.set(track, { clearProps: 'transform' }); };
    });
    // Al filtrar cambia el ancho de la pista: se recalcula el recorrido y, si la
    // galería estaba fijada, se vuelve a su inicio para ver el resultado desde el principio
    filters.forEach((btn) => btn.addEventListener('click', () => {
      if (!projST) return;
      const wasPinned = projST.isActive;
      ScrollTrigger.refresh();
      if (!wasPinned) return;
      if (window.lenis) window.lenis.scrollTo(projST.start, { immediate: true });
      else window.scrollTo({ top: projST.start, behavior: 'auto' });
    }));
  }

  applyLang();
})();
