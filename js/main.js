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

  /* Header, progreso, botón volver arriba */
  const header = $('#header'), bar = $('#progress'), toTop = $('#to-top');
  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    header.classList.toggle('scrolled', y > 10);
    toTop.classList.toggle('show', y > 500);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

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

  /* Texto que se escribe (se reinicia al cambiar de idioma) */
  const typed = $('#typed');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  /* Contadores */
  const counters = $$('[data-count]');
  const cio = new IntersectionObserver((entries, obs) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target, target = +el.dataset.count, start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / 1000, 1);
        el.textContent = Math.round(target * p);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      obs.unobserve(el);
    });
  }, { threshold: 0.6 });
  counters.forEach((c) => cio.observe(c));

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
    const text = `${t('form.whatsapp', { name: d.get('name'), email: d.get('_replyto') })}\n\n${d.get('message')}`;
    window.open('https://wa.me/50231007720?text=' + encodeURIComponent(text), '_blank', 'noopener');
    status.textContent = t('form.opening');
    form.reset();
    counter.textContent = '0/' + msg.maxLength;
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
    loadCvFrame();
    $('.cv-close', cvModal).focus();
  };
  const closeCv = () => {
    if (cvModal.hidden) return;
    cvModal.hidden = true;
    document.body.classList.remove('modal-open');
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
  $('#year').textContent = new Date().getFullYear();

  applyLang();
})();
