(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

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

  /* Texto que se escribe */
  const typed = $('#typed');
  const roles = typed.dataset.roles.split('|');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    typed.textContent = roles[0];
  } else {
    let r = 0, c = 0, del = false;
    const tick = () => {
      const word = roles[r];
      typed.textContent = word.slice(0, c);
      if (!del && c === word.length) { del = true; return setTimeout(tick, 1800); }
      if (del && c === 0) { del = false; r = (r + 1) % roles.length; }
      c += del ? -1 : 1;
      setTimeout(tick, del ? 35 : 70);
    };
    tick();
  }

  /* Contadores */
  const counters = $$('[data-count]');
  const cio = new IntersectionObserver((entries, obs) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target, target = +el.dataset.count, start = performance.now();
      const step = (t) => {
        const p = Math.min((t - start) / 1000, 1);
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
    if (input.validity.valueMissing) text = 'Este campo es obligatorio.';
    else if (input.validity.typeMismatch) text = 'Ingresa un correo válido.';
    else if (input.validity.tooShort) text = `Mínimo ${input.minLength} caracteres.`;
    field.classList.toggle('invalid', !!text);
    err.textContent = text;
    return !text;
  };
  $$('input, textarea', form).forEach((i) => {
    i.addEventListener('blur', () => validate(i));
    i.addEventListener('input', () => i.closest('.invalid') && validate(i));
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = $$('input, textarea', form).map(validate).every(Boolean);
    if (!ok) { status.textContent = ''; return; }
    const d = new FormData(form);
    const text = `Hola Antonio, soy ${d.get('name')} (${d.get('_replyto')}).\n\n${d.get('message')}`;
    window.open('https://wa.me/50231007720?text=' + encodeURIComponent(text), '_blank', 'noopener');
    status.textContent = 'Abriendo WhatsApp con tu mensaje…';
    form.reset();
    counter.textContent = '0/' + msg.maxLength;
  });

  /* Año del footer */
  $('#year').textContent = new Date().getFullYear();
})();
