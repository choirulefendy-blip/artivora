/* Artivora Creative — small interactions for the public site */
(function () {
  'use strict';

  // Header background once the page scrolls past the top.
  var header = document.querySelector('[data-header]');
  function onScroll() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu.
  var toggle = document.querySelector('[data-nav-toggle]');
  var menu = document.querySelector('[data-nav-menu]');
  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.querySelector('.sr-only').textContent = open ? 'Tutup menu' : 'Buka menu';
    menu.classList.toggle('is-open', open);
    header.classList.toggle('is-open', open);
  }
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        toggle.focus();
      }
    });
  }

  // Contact form: compose a WhatsApp message (or email as a fallback).
  var form = document.querySelector('[data-wa-form]');
  if (form) {
    var status = form.querySelector('[data-form-status]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var name = String(data.get('name') || '').trim();
      var business = String(data.get('business') || '').trim();
      var service = String(data.get('service') || '').trim();
      var message = String(data.get('message') || '').trim();
      var nameField = form.querySelector('#f-name');

      if (!name) {
        nameField.closest('.field').classList.add('has-error');
        status.textContent = 'Isi nama dulu supaya kami tahu siapa yang menghubungi.';
        status.classList.add('is-error');
        nameField.focus();
        return;
      }
      nameField.closest('.field').classList.remove('has-error');
      status.classList.remove('is-error');

      var lines = ['Halo Artivora, saya ' + name + (business ? ' dari ' + business : '') + '.'];
      lines.push(service ? 'Saya tertarik dengan layanan ' + service + '.' : 'Saya ingin konsultasi dulu.');
      if (message) lines.push('', message);
      var text = lines.join('\n');

      var wa = form.getAttribute('data-wa');
      var email = form.getAttribute('data-email');
      if (wa) {
        window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
        status.textContent = 'WhatsApp terbuka di tab baru. Tinggal tekan kirim.';
      } else if (email) {
        window.location.href = 'mailto:' + email + '?subject=' + encodeURIComponent('Konsultasi dari ' + name) + '&body=' + encodeURIComponent(text);
        status.textContent = 'Aplikasi email terbuka. Tinggal tekan kirim.';
      } else {
        status.textContent = 'Kontak belum diatur. Silakan hubungi kami lewat Instagram.';
        status.classList.add('is-error');
      }
    });
  }

  // ---------- Scroll motion ----------
  // Everything "rises" like the A in the hero. Only elements that start below the
  // fold are hidden, so nothing visible ever flickers and the page still works
  // without JavaScript. Off in the admin preview, when the admin switch is off,
  // and for visitors who ask their device for reduced motion.
  var body = document.body;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var motionOn = !reduceMotion &&
    body.getAttribute('data-motion') !== 'off' &&
    !body.classList.contains('is-preview') &&
    'IntersectionObserver' in window;
  if (!motionOn) return;

  var REVEAL = [
    ['title', '.section-head h2, .about-text h2, .faq-grid h2, .contact-info h2, .clients-title'],
    ['media', '.work-media, .about-media'],
    ['up', [
      '.section-intro', '.service', '.work-meta', '.work-title', '.work-metric', '.work-story', '.work .text-link',
      '.work-empty', '.step', '.tier', '.pricing-note', '.quote', '.about-text p', '.member',
      '.faq-item', '.clients-list li', '.contact-direct li', '.contact-form'
    ].join(', ')]
  ];
  var STAGGER = 90;     // ms between items that enter together
  var MAX_STAGGER = 6;

  var fold = window.innerHeight;
  var observer = new IntersectionObserver(onEnter, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  // Titles and images start fully clipped, and a fully clipped element never
  // reports as visible, so for those we watch their parent instead.
  var watched = new Map(); // observed element -> elements it reveals

  REVEAL.forEach(function (group) {
    var type = group[0];
    document.querySelectorAll(group[1]).forEach(function (node) {
      if (node.hasAttribute('data-reveal') || node.closest('.hero')) return;
      if (node.getBoundingClientRect().top < fold) return; // already on screen: leave it be
      node.setAttribute('data-reveal', type);
      prepareCounter(node);
      var target = (type === 'title' || type === 'media') ? node.parentElement : node;
      if (!watched.has(target)) { watched.set(target, []); observer.observe(target); }
      watched.get(target).push(node);
    });
  });

  function onEnter(entries) {
    var entering = [];
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      (watched.get(entry.target) || []).forEach(function (node) { entering.push(node); });
      watched.delete(entry.target);
    });
    entering.sort(function (a, b) {
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return (ra.top - rb.top) || (ra.left - rb.left);
    });
    entering.forEach(function (node, i) {
      var delay = Math.min(i, MAX_STAGGER) * STAGGER;
      node.style.setProperty('--reveal-delay', delay + 'ms');
      node.classList.add('is-in');
      var counter = node.querySelector('[data-count]');
      if (counter) setTimeout(function () { runCounter(counter); }, delay + 250);
    });
  }

  // Numbers like "6.600", "3x" or "+45%" count up when they appear.
  function prepareCounter(node) {
    var strong = node.matches('.work-metric') ? node.querySelector('strong') : null;
    if (!strong) return;
    var text = strong.textContent.trim();
    var m = text.match(/^([^0-9]*)([0-9][0-9.,]*)(.*)$/);
    if (!m) return;
    var parsed = parseNumber(m[2]);
    if (!parsed || parsed.value === 0) return;
    strong.textContent = '';
    var shown = document.createElement('span');
    shown.setAttribute('aria-hidden', 'true');
    shown.setAttribute('data-count', '');
    shown.textContent = m[1] + formatNumber(0, parsed) + m[3];
    var real = document.createElement('span');
    real.className = 'sr-only';
    real.textContent = text;
    strong.appendChild(shown);
    strong.appendChild(real);
    shown._count = { prefix: m[1], suffix: m[3], parsed: parsed };
  }

  function parseNumber(raw) {
    var thousands = '', decimal = '';
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) { thousands = '.'; decimal = ','; }
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) { thousands = ','; decimal = '.'; }
    else if (/^\d+,\d+$/.test(raw)) { decimal = ','; }
    else if (/^\d+\.\d+$/.test(raw)) { decimal = '.'; }
    else if (!/^\d+$/.test(raw)) return null;
    var normalized = raw;
    if (thousands) normalized = normalized.split(thousands).join('');
    if (decimal) normalized = normalized.replace(decimal, '.');
    var value = parseFloat(normalized);
    if (isNaN(value)) return null;
    var decimals = decimal && raw.indexOf(decimal) > -1 ? raw.length - raw.indexOf(decimal) - 1 : 0;
    return { value: value, thousands: thousands, decimal: decimal, decimals: decimals };
  }

  function formatNumber(n, p) {
    var parts = n.toFixed(p.decimals).split('.');
    var int = parts[0];
    if (p.thousands) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, p.thousands);
    return parts[1] ? int + (p.decimal || '.') + parts[1] : int;
  }

  function runCounter(el) {
    var c = el._count;
    if (!c) return;
    var start = null, duration = 1400;
    function frame(t) {
      if (start === null) start = t;
      var k = Math.min(1, (t - start) / duration);
      var eased = 1 - Math.pow(1 - k, 3);
      el.textContent = c.prefix + formatNumber(c.parsed.value * eased, c.parsed) + c.suffix;
      if (k < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // The hero A drifts slower than the page while scrolling past it.
  var heroArt = document.querySelector('.hero-art');
  var hero = document.querySelector('.hero');
  if (heroArt && hero) {
    var ticking = false;
    var update = function () {
      ticking = false;
      var y = window.scrollY;
      if (y > hero.offsetHeight) return;
      heroArt.style.setProperty('--parallax', (y * 0.22).toFixed(1) + 'px');
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }
})();
