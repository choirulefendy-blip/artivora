/*
 * Artivora Creative — page renderer.
 * Turns content.json into the full static index.html.
 * Used by the admin (on publish and for live preview) and by scripts/build.js.
 */
(function (root) {
  'use strict';

  // Bump this when site.css / site.js change, so browsers fetch the new files.
  var ASSET_VERSION = '1.1.0';

  // ---------- helpers ----------
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function str(value) {
    return value == null ? '' : String(value).trim();
  }

  function list(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(function (item) {
      if (item == null) return false;
      if (typeof item === 'string') return item.trim() !== '';
      return item.visible !== false;
    });
  }

  // Only allow safe link schemes; relative paths are fine.
  function safeUrl(value) {
    var url = str(value);
    if (!url) return '';
    if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return ''; // javascript:, data:, etc.
    return url;
  }

  // Paragraphs separated by a blank line, single line breaks kept.
  function paragraphs(text) {
    return str(text)
      .split(/\n\s*\n/)
      .map(function (p) { return p.trim(); })
      .filter(Boolean)
      .map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; })
      .join('');
  }

  function waNumber(raw) {
    var digits = str(raw).replace(/[^0-9]/g, '');
    if (!digits) return '';
    if (digits.charAt(0) === '0') digits = '62' + digits.slice(1);
    if (digits.charAt(0) === '8') digits = '62' + digits;
    return digits;
  }

  function waLink(settings, text) {
    var number = waNumber(settings.whatsapp);
    if (!number) return '';
    var msg = str(text) || str(settings.whatsapp_greeting);
    return 'https://wa.me/' + number + (msg ? '?text=' + encodeURIComponent(msg) : '');
  }

  function socialUrl(kind, value) {
    var v = str(value);
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    v = v.replace(/^@/, '');
    if (kind === 'instagram') return 'https://instagram.com/' + v;
    if (kind === 'tiktok') return 'https://www.tiktok.com/@' + v;
    return '';
  }

  function socialHandle(value) {
    var v = str(value);
    if (!v) return '';
    var m = v.match(/(?:instagram\.com|tiktok\.com)\/@?([^/?#]+)/i);
    return '@' + (m ? m[1] : v.replace(/^@/, ''));
  }

  function absUrl(siteUrl, path) {
    var p = str(path);
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    return str(siteUrl).replace(/\/+$/, '') + '/' + p.replace(/^\/+/, '');
  }

  // ---------- brand mark ----------
  // The Artivora "A", traced from the official logo. Defined once per page as a
  // <symbol> (with its copper-to-espresso gradient and film grain) and reused.
  var A_PATH = 'M89.1 521.6 C88.7 521.4 87.3 521.1 86.1 521 C37.7 515 4.7 475.7 1 419.6 C0.9 417.6 0.6 414.9 0.4 413.7 C-0.1 410.8 -0.1 399.5 0.4 396.6 C0.6 395.4 0.9 392.6 1 390.2 C3 356.4 14.9 313.2 34.2 269.7 C38.6 259.8 40.2 256.6 56.4 223.2 C58 220 60.2 215.6 61.3 213.4 C62.3 211.2 64.6 206.5 66.3 203 C68 199.5 72.8 189.7 77 181.1 C81.2 172.6 85.9 162.9 87.5 159.6 C89.1 156.3 93.8 146.7 98 138.1 C102.2 129.6 106.9 119.9 108.5 116.6 C110.1 113.3 114.8 103.7 119 95.1 C129.5 73.5 131.4 69.7 140.1 51.9 C144.4 43.2 148.9 33.9 150.3 31.1 C151.6 28.4 155.5 20.3 159 13.3 C162.4 6.2 165.2 0.3 165.2 0.2 C165.2 0.1 185.9 -0 211.1 -0 L256.9 -0 L257.5 1.2 C258.1 2.4 264.3 16.1 273 35.1 C275.5 40.6 278.4 47 279.5 49.4 C283 57.1 294.4 81.9 301 96.5 C307.4 110.5 318.6 135.1 322.5 143.6 C323.6 146 326.8 153 329.6 159.2 C332.5 165.5 335.4 171.9 336.1 173.5 C336.9 175.1 339.5 180.9 342 186.4 C344.5 191.9 347.4 198.3 348.5 200.6 C349.6 203 353.4 211.3 356.9 219.1 C360.5 227 366.4 239.8 370 247.7 C373.6 255.6 379.4 268.4 383 276.2 C386.6 284.1 392.4 296.9 396 304.8 C399.6 312.7 403.4 321 404.5 323.4 C406.6 328.1 419.6 356.4 426.5 371.6 C429 377 432.7 385.3 434.9 390.1 C445 412.1 452.3 428.1 454.5 433 C455.8 436 458.7 442.3 460.9 447.1 C465 456.1 476 480.2 480.6 490.2 C490 510.8 489.4 509.3 488.5 509.7 C487.5 510.3 370.4 510.1 369.8 509.6 C369.5 509.3 368.5 507.7 367.6 506 C352.2 477.3 326.2 460.1 300.1 461.4 C280.4 462.3 266.1 467 225.9 486 C200 498.2 191.9 501.8 178.4 506.9 C158.4 514.4 137.5 519.5 120.6 521 C119.1 521.1 117.3 521.4 116.6 521.6 C114.9 522.2 90.3 522.1 89.1 521.6 Z M149.9 419.3 C162.9 417.2 175 412.5 199.6 400.1 C245.8 376.9 247.4 376.1 258.4 371.6 C272.6 365.7 288.2 361.1 297.6 359.9 C299.6 359.6 300.5 359.3 300.6 358.6 C300.8 358 301.5 359.4 286.9 327.9 C283.3 320 279.2 311 275.7 303.3 C273.2 298 266.5 283.4 257.9 264.8 C256.7 262.1 255.2 258.7 254.5 257.2 C253.9 255.8 252 251.8 250.4 248.4 C248.9 244.9 245 236.6 241.9 229.8 C238.8 222.9 235 214.7 233.5 211.5 C232 208.3 229.5 202.8 227.9 199.4 C226.3 195.9 224.1 191 222.9 188.5 C221.8 186 218.9 179.7 216.5 174.5 C214.1 169.3 212 164.9 211.8 164.7 C211 163.9 210.5 164.4 209.2 167.2 C207.3 171.3 188.1 211.6 184 220.1 C179.3 230 173.7 241.8 169 251.6 C149.8 291.8 145.4 301.4 138.8 316.8 C118.5 364.4 112.5 394.2 120.4 409.2 C125 418 135.6 421.6 149.9 419.3 Z';

  function brandDefs() {
    return '<svg class="brand-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>' +
      '<linearGradient id="aa-g" gradientUnits="userSpaceOnUse" x1="140" y1="0" x2="440" y2="440">' +
      '<stop offset="0" stop-color="#D07447"/><stop offset=".3" stop-color="#9C5236"/><stop offset=".56" stop-color="#45241A"/>' +
      '<stop offset=".8" stop-color="#1E100A"/><stop offset="1" stop-color="#120804"/></linearGradient>' +
      '<radialGradient id="aa-r" gradientUnits="userSpaceOnUse" cx="0" cy="480" r="240">' +
      '<stop offset="0" stop-color="#B0706A" stop-opacity=".75"/><stop offset=".6" stop-color="#8A4E46" stop-opacity=".3"/>' +
      '<stop offset="1" stop-color="#8A4E46" stop-opacity="0"/></radialGradient>' +
      '<filter id="aa-grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" stitchTiles="stitch" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 1 0 0 0 0 .8 0 0 0 0 .64 0 0 0 2.2 -1.22" result="l"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.2 .98" result="k"/>' +
      '<feComposite in="l" in2="SourceAlpha" operator="in" result="l2"/><feComposite in="k" in2="SourceAlpha" operator="in" result="k2"/>' +
      '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="l2"/><feMergeNode in="k2"/></feMerge></filter>' +
      '<symbol id="artivora-a" viewBox="0 0 490 522"><g filter="url(#aa-grain)">' +
      '<path d="' + A_PATH + '" fill="url(#aa-g)"/><path d="' + A_PATH + '" fill="url(#aa-r)"/></g></symbol>' +
      '</defs></svg>';
  }

  function brandMark(className) {
    return '<svg class="' + (className || '') + '" viewBox="0 0 490 522" aria-hidden="true" focusable="false"><use href="#artivora-a"/></svg>';
  }

  function logo(settings, opts) {
    var name = str(settings.brand_name) || 'Artivora Creative';
    var logoUrl = safeUrl(opts.resolve(settings.logo_url));
    if (logoUrl) return '<img class="logo-img" src="' + esc(logoUrl) + '" alt="' + esc(name) + '">';
    return brandMark('logo-mark') +
      '<img class="logo-wordmark" src="assets/img/logo-wordmark.webp" width="560" height="83" alt="' + esc(name) + '">';
  }

  function footerLogo(settings, opts) {
    var name = str(settings.brand_name) || 'Artivora Creative';
    var logoUrl = safeUrl(opts.resolve(settings.logo_url));
    return '<img src="' + esc(logoUrl || 'assets/img/logo.webp') + '"' + (logoUrl ? '' : ' width="700" height="594"') + ' alt="' + esc(name) + '" loading="lazy">';
  }

  // ---------- icons (inline, stroke-based) ----------
  var ICONS = {
    whatsapp: '<path d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.3 20.7l4.4-1.1A8.8 8.8 0 1 0 12 3.2Z"/><path d="M8.9 8.3c.2-.5.5-.5.8-.5h.5c.2 0 .4 0 .6.5l.7 1.7c.1.2.1.4 0 .6l-.4.6c-.1.2-.2.3 0 .6.4.7 1 1.4 1.7 1.9.6.4 1 .6 1.3.7.2.1.4 0 .5-.1l.6-.7c.2-.2.3-.2.6-.1l1.6.8c.3.1.4.2.4.4 0 .3 0 1.1-.6 1.6-.5.5-1.4.8-2.2.6-1.2-.3-2.6-1-3.9-2.2-1.4-1.3-2.2-2.7-2.5-3.7-.3-1-.1-1.9.3-2.5Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/>',
    tiktok: '<path d="M14 3v11.2a3.3 3.3 0 1 1-3.3-3.3"/><path d="M14 3c.4 2.6 2.2 4.4 5 4.6"/>',
    pin: '<path d="M12 21s-6.5-6.1-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.9 12 21 12 21Z"/><circle cx="12" cy="9.8" r="2.3"/>'
  };
  function icon(name) {
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
  }

  // ---------- sections ----------
  function sectionHead(title, intro, id) {
    return '<header class="section-head">' +
      '<h2 id="' + id + '-title">' + esc(title) + '</h2>' +
      (str(intro) ? '<p class="section-intro">' + esc(intro) + '</p>' : '') +
      '</header>';
  }

  function renderNav(c, opts, nav) {
    var s = c.settings;
    var wa = waLink(s);
    var links = nav.map(function (n) {
      return '<li><a href="#' + n.id + '">' + esc(n.label) + '</a></li>';
    }).join('');
    return '<header class="site-header" data-header>' +
      '<div class="wrap header-inner">' +
      '<a class="logo" href="#top" aria-label="' + esc(s.brand_name || 'Beranda') + '">' + logo(s, opts) + '</a>' +
      '<nav class="nav" aria-label="Navigasi utama">' +
      '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu" data-nav-toggle>' +
      '<span class="nav-toggle-bars" aria-hidden="true"></span><span class="sr-only">Buka menu</span></button>' +
      '<div class="nav-menu" id="nav-menu" data-nav-menu>' +
      '<ul class="nav-links">' + links + '</ul>' +
      (wa ? '<a class="btn btn-primary btn-small" href="' + esc(wa) + '" target="_blank" rel="noopener">' + icon('whatsapp') + '<span>WhatsApp</span></a>'
          : '<a class="btn btn-primary btn-small" href="#kontak">Hubungi kami</a>') +
      '</div></nav></div></header>';
  }

  function renderHero(c) {
    var h = c.hero, s = c.settings;
    var wa = waLink(s);
    var industries = list(h.industries);
    return '<section class="hero" id="top" aria-labelledby="hero-title">' +
      '<div class="hero-art" aria-hidden="true">' + brandMark('hero-mark') + '</div>' +
      '<div class="wrap hero-inner">' +
      '<h1 id="hero-title" class="hero-title">' + esc(h.headline) + '</h1>' +
      (str(h.subheadline) ? '<p class="hero-sub">' + esc(h.subheadline) + '</p>' : '') +
      '<div class="hero-actions">' +
      (str(h.cta_primary) ? '<a class="btn btn-primary" href="' + esc(wa || '#kontak') + '"' + (wa ? ' target="_blank" rel="noopener"' : '') + '>' + (wa ? icon('whatsapp') : '') + '<span>' + esc(h.cta_primary) + '</span></a>' : '') +
      (str(h.cta_secondary) ? '<a class="btn btn-outline" href="#layanan">' + esc(h.cta_secondary) + '</a>' : '') +
      '</div>' +
      (industries.length ? '<div class="hero-industries"><p class="hero-industries-label">Kami bekerja dengan</p><ul>' +
        industries.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>' : '') +
      '</div></section>';
  }

  function renderClients(c, opts) {
    var sec = c.clients;
    var items = list(sec.items);
    return '<section class="section clients" id="klien" aria-labelledby="klien-title">' +
      '<div class="wrap"><h2 class="clients-title" id="klien-title">' + esc(sec.title) + '</h2>' +
      '<ul class="clients-list">' + items.map(function (item) {
        var img = safeUrl(opts.resolve(item.logo_url));
        var inner = img ? '<img src="' + esc(img) + '" alt="' + esc(item.name) + '" loading="lazy">' : '<span>' + esc(item.name) + '</span>';
        var url = safeUrl(item.url);
        return '<li>' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + inner + '</a>' : inner) + '</li>';
      }).join('') + '</ul></div></section>';
  }

  function renderServices(c) {
    var sec = c.services;
    var items = list(sec.items);
    return '<section class="section services" id="layanan" aria-labelledby="layanan-title"><div class="wrap">' +
      sectionHead(sec.title, sec.intro, 'layanan') +
      '<ul class="service-list">' + items.map(function (item) {
        var del = list(item.deliverables);
        return '<li class="service">' +
          '<h3 class="service-title">' + esc(item.title) + '</h3>' +
          '<div class="service-body"><p>' + esc(item.description) + '</p>' +
          (del.length ? '<ul class="dot-list">' + del.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' : '') +
          '</div></li>';
      }).join('') + '</ul></div></section>';
  }

  function renderPortfolio(c, opts) {
    var sec = c.portfolio, s = c.settings;
    var items = list(sec.items);
    var ig = socialUrl('instagram', s.instagram);
    var body;
    if (!items.length) {
      body = '<div class="work-empty">' + brandMark('work-empty-mark') +
        '<p>' + esc(sec.empty_text || 'Studi kasus segera hadir.') + '</p>' +
        (ig ? '<a class="btn btn-primary" href="' + esc(ig) + '" target="_blank" rel="noopener">' + icon('instagram') + '<span>Lihat di Instagram</span></a>' : '') +
        '</div>';
    } else {
      body = '<div class="work-list">' + items.map(function (item) {
        var img = safeUrl(opts.resolve(item.image_url));
        var link = safeUrl(item.link_url);
        var meta = [item.client, item.industry, item.service].map(str).filter(Boolean);
        return '<article class="work">' +
          '<div class="work-media">' + (img ? '<img src="' + esc(img) + '" alt="' + esc(item.title || item.client) + '" loading="lazy">' : brandMark('work-media-mark')) + '</div>' +
          '<div class="work-text">' +
          (meta.length ? '<p class="work-meta">' + meta.map(esc).join('<span aria-hidden="true">/</span>') + '</p>' : '') +
          '<h3 class="work-title">' + esc(item.title) + '</h3>' +
          (str(item.metric_value) ? '<p class="work-metric"><strong>' + esc(item.metric_value) + '</strong><span>' + esc(item.metric_label) + '</span></p>' : '') +
          '<dl class="work-story">' +
          (str(item.challenge) ? '<div><dt>Tantangan</dt><dd>' + esc(item.challenge) + '</dd></div>' : '') +
          (str(item.approach) ? '<div><dt>Yang kami kerjakan</dt><dd>' + esc(item.approach) + '</dd></div>' : '') +
          (str(item.result) ? '<div><dt>Hasil</dt><dd>' + esc(item.result) + '</dd></div>' : '') +
          '</dl>' +
          (link ? '<a class="text-link" href="' + esc(link) + '" target="_blank" rel="noopener">Lihat hasilnya</a>' : '') +
          '</div></article>';
      }).join('') + '</div>';
    }
    return '<section class="section work-section" id="karya" aria-labelledby="karya-title"><div class="wrap">' +
      sectionHead(sec.title, items.length ? sec.intro : '', 'karya') + body + '</div></section>';
  }

  function renderProcess(c) {
    var sec = c.process;
    var steps = list(sec.steps);
    return '<section class="section process" id="cara-kerja" aria-labelledby="cara-kerja-title"><div class="wrap">' +
      sectionHead(sec.title, sec.intro, 'cara-kerja') +
      '<ol class="steps">' + steps.map(function (step, i) {
        return '<li class="step"><span class="step-num" aria-hidden="true">' + (i + 1) + '</span>' +
          '<h3>' + esc(step.title) + '</h3><p>' + esc(step.description) + '</p></li>';
      }).join('') + '</ol></div></section>';
  }

  function renderPricing(c) {
    var sec = c.pricing, s = c.settings;
    var items = list(sec.items);
    return '<section class="section pricing" id="harga" aria-labelledby="harga-title"><div class="wrap">' +
      sectionHead(sec.title, sec.intro, 'harga') +
      '<div class="tiers">' + items.map(function (t) {
        var feats = list(t.features);
        var wa = waLink(s, 'Halo Artivora, saya tertarik dengan paket ' + str(t.name) + '.');
        return '<article class="tier' + (t.highlighted ? ' tier-featured' : '') + '">' +
          (t.highlighted && str(t.highlight_label) ? '<p class="tier-badge">' + esc(t.highlight_label) + '</p>' : '') +
          '<h3 class="tier-name">' + esc(t.name) + '</h3>' +
          (str(t.audience) ? '<p class="tier-audience">' + esc(t.audience) + '</p>' : '') +
          '<p class="tier-price"><span class="tier-from">Mulai</span> <strong>' + esc(t.price) + '</strong> <span class="tier-period">' + esc(t.period) + '</span></p>' +
          (feats.length ? '<ul class="dot-list">' + feats.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '') +
          '<a class="btn ' + (t.highlighted ? 'btn-primary' : 'btn-outline') + '" href="' + esc(wa || '#kontak') + '"' + (wa ? ' target="_blank" rel="noopener"' : '') + '>Tanya paket ' + esc(t.name) + '</a>' +
          '</article>';
      }).join('') + '</div>' +
      (str(sec.note) ? '<p class="pricing-note">' + esc(sec.note) + '</p>' : '') +
      '</div></section>';
  }

  function renderTestimonials(c, opts) {
    var sec = c.testimonials;
    var items = list(sec.items);
    return '<section class="section testimonials" id="testimoni" aria-labelledby="testimoni-title"><div class="wrap">' +
      sectionHead(sec.title, '', 'testimoni') +
      '<div class="quotes">' + items.map(function (q) {
        var photo = safeUrl(opts.resolve(q.photo_url));
        return '<figure class="quote"><blockquote><p>' + esc(q.quote) + '</p></blockquote>' +
          '<figcaption>' + (photo ? '<img src="' + esc(photo) + '" alt="" loading="lazy">' : '') +
          '<span><strong>' + esc(q.name) + '</strong>' + (str(q.role) ? '<span>' + esc(q.role) + '</span>' : '') + '</span>' +
          '</figcaption></figure>';
      }).join('') + '</div></div></section>';
  }

  function renderAbout(c, opts) {
    var sec = c.about;
    var img = safeUrl(opts.resolve(sec.image_url));
    var team = list(sec.team);
    return '<section class="section about" id="tentang" aria-labelledby="tentang-title"><div class="wrap">' +
      '<div class="about-grid">' +
      '<div class="about-text"><h2 id="tentang-title">' + esc(sec.title) + '</h2>' + paragraphs(sec.body) + '</div>' +
      '<div class="about-media">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : brandMark('about-mark')) + '</div>' +
      '</div>' +
      (team.length ? '<ul class="team">' + team.map(function (m) {
        var photo = safeUrl(opts.resolve(m.photo_url));
        var initials = str(m.name).split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
        return '<li class="member">' + (photo ? '<img src="' + esc(photo) + '" alt="" loading="lazy">' : '<span class="member-initials" aria-hidden="true">' + esc(initials) + '</span>') +
          '<strong>' + esc(m.name) + '</strong><span>' + esc(m.role) + '</span></li>';
      }).join('') + '</ul>' : '') +
      '</div></section>';
  }

  function renderFaq(c) {
    var sec = c.faq;
    var items = list(sec.items);
    return '<section class="section faq" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid">' +
      '<h2 id="faq-title">' + esc(sec.title) + '</h2>' +
      '<div class="faq-list">' + items.map(function (f) {
        return '<details class="faq-item"><summary>' + esc(f.question) + '</summary><div class="faq-answer">' + paragraphs(f.answer) + '</div></details>';
      }).join('') + '</div></div></section>';
  }

  function renderContact(c) {
    var sec = c.contact, s = c.settings;
    var wa = waNumber(s.whatsapp);
    var services = list(c.services.items).map(function (i) { return str(i.title); }).filter(Boolean);
    var ig = socialUrl('instagram', s.instagram);
    var tt = socialUrl('tiktok', s.tiktok);
    var direct = [];
    if (wa) direct.push('<li><a href="' + esc(waLink(s)) + '" target="_blank" rel="noopener">' + icon('whatsapp') + '<span>+' + esc(wa) + '</span></a></li>');
    if (str(s.email)) direct.push('<li><a href="mailto:' + esc(s.email) + '">' + icon('mail') + '<span>' + esc(s.email) + '</span></a></li>');
    if (ig) direct.push('<li><a href="' + esc(ig) + '" target="_blank" rel="noopener">' + icon('instagram') + '<span>' + esc(socialHandle(s.instagram)) + '</span></a></li>');
    if (tt) direct.push('<li><a href="' + esc(tt) + '" target="_blank" rel="noopener">' + icon('tiktok') + '<span>' + esc(socialHandle(s.tiktok)) + '</span></a></li>');
    if (str(s.address)) {
      var maps = safeUrl(s.maps_url);
      direct.push('<li>' + (maps ? '<a href="' + esc(maps) + '" target="_blank" rel="noopener">' : '<span class="contact-plain">') + icon('pin') + '<span>' + esc(s.address) + '</span>' + (maps ? '</a>' : '</span>') + '</li>');
    }
    return '<section class="section contact" id="kontak" aria-labelledby="kontak-title"><div class="wrap contact-grid">' +
      '<div class="contact-info"><h2 id="kontak-title">' + esc(sec.title) + '</h2>' +
      (str(sec.body) ? '<p class="section-intro">' + esc(sec.body) + '</p>' : '') +
      (direct.length ? '<ul class="contact-direct">' + direct.join('') + '</ul>' : '') + '</div>' +
      '<form class="contact-form" data-wa-form data-wa="' + esc(wa) + '" data-email="' + esc(s.email) + '" novalidate>' +
      '<div class="field"><label for="f-name">Nama</label><input id="f-name" name="name" autocomplete="name" required></div>' +
      '<div class="field"><label for="f-business">Nama bisnis</label><input id="f-business" name="business" autocomplete="organization"></div>' +
      (services.length ? '<div class="field"><label for="f-service">Layanan yang dibutuhkan</label><select id="f-service" name="service"><option value="">Belum yakin, mau konsultasi dulu</option>' +
        services.map(function (sv) { return '<option>' + esc(sv) + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="field"><label for="f-message">Ceritakan singkat</label><textarea id="f-message" name="message" rows="4" placeholder="Contoh: kafe baru di Dinoyo, ingin akun Instagram lebih ramai sebelum grand opening."></textarea></div>' +
      '<button class="btn btn-primary btn-block" type="submit">' + icon('whatsapp') + '<span>' + esc(sec.button_label || 'Kirim lewat WhatsApp') + '</span></button>' +
      '<p class="form-status" role="status" data-form-status></p>' +
      '</form></div></section>';
  }

  function renderFooter(c, opts, nav) {
    var s = c.settings;
    var ig = socialUrl('instagram', s.instagram);
    var tt = socialUrl('tiktok', s.tiktok);
    var year = opts.year || new Date().getFullYear();
    return '<footer class="site-footer"><div class="wrap footer-inner">' +
      '<div class="footer-brand"><a class="footer-logo" href="#top">' + footerLogo(s, opts) + '</a>' +
      (str(s.tagline) ? '<p>' + esc(s.tagline) + (str(s.address) ? ', ' + esc(s.address) : '') + '</p>' : '') + '</div>' +
      '<ul class="footer-links">' + nav.map(function (n) { return '<li><a href="#' + n.id + '">' + esc(n.label) + '</a></li>'; }).join('') + '</ul>' +
      '<ul class="footer-social">' +
      (ig ? '<li><a href="' + esc(ig) + '" target="_blank" rel="noopener" aria-label="Instagram">' + icon('instagram') + '</a></li>' : '') +
      (tt ? '<li><a href="' + esc(tt) + '" target="_blank" rel="noopener" aria-label="TikTok">' + icon('tiktok') + '</a></li>' : '') +
      (str(s.email) ? '<li><a href="mailto:' + esc(s.email) + '" aria-label="Email">' + icon('mail') + '</a></li>' : '') +
      '</ul>' +
      '<p class="footer-copy">© ' + year + ' ' + esc(s.brand_name || 'Artivora Creative') + '</p>' +
      '</div></footer>';
  }

  // ---------- page ----------
  function isOn(sec, itemsKey) {
    if (!sec || sec.visible === false) return false;
    if (itemsKey) return list(sec[itemsKey]).length > 0;
    return true;
  }

  function renderBody(content, opts) {
    var c = content;
    var nav = [];
    var parts = [];
    var s = c.settings || {};

    if (isOn(c.hero)) parts.push(renderHero(c));
    if (isOn(c.clients, 'items')) parts.push(renderClients(c, opts));
    if (isOn(c.services, 'items')) { parts.push(renderServices(c)); nav.push({ id: 'layanan', label: 'Layanan' }); }
    if (isOn(c.portfolio)) { parts.push(renderPortfolio(c, opts)); nav.push({ id: 'karya', label: 'Karya' }); }
    if (isOn(c.process, 'steps')) parts.push(renderProcess(c));
    if (isOn(c.pricing, 'items')) { parts.push(renderPricing(c)); nav.push({ id: 'harga', label: 'Harga' }); }
    if (isOn(c.testimonials, 'items')) parts.push(renderTestimonials(c, opts));
    if (isOn(c.about)) { parts.push(renderAbout(c, opts)); nav.push({ id: 'tentang', label: 'Tentang' }); }
    if (isOn(c.faq, 'items')) { parts.push(renderFaq(c)); nav.push({ id: 'faq', label: 'FAQ' }); }
    if (isOn(c.contact)) { parts.push(renderContact(c)); nav.push({ id: 'kontak', label: 'Kontak' }); }

    var wa = waLink(s);
    return renderNav(c, opts, nav) +
      '<main id="main">' + parts.join('') + '</main>' +
      renderFooter(c, opts, nav) +
      (wa ? '<a class="wa-float" href="' + esc(wa) + '" target="_blank" rel="noopener" aria-label="Chat WhatsApp">' + icon('whatsapp') + '</a>' : '');
  }

  function jsonLd(c) {
    var s = c.settings;
    var data = {
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: str(s.brand_name) || 'Artivora Creative',
      description: str(s.seo_description),
      url: str(s.site_url),
      areaServed: 'Malang',
      address: { '@type': 'PostalAddress', addressLocality: 'Malang', addressRegion: 'Jawa Timur', addressCountry: 'ID' }
    };
    var wa = waNumber(s.whatsapp);
    if (wa) data.telephone = '+' + wa;
    if (str(s.email)) data.email = str(s.email);
    var same = [socialUrl('instagram', s.instagram), socialUrl('tiktok', s.tiktok)].filter(Boolean);
    if (same.length) data.sameAs = same;
    var og = absUrl(s.site_url, s.og_image);
    if (og) data.image = og;
    return JSON.stringify(data).replace(/</g, '\\u003c');
  }

  /**
   * renderPage(content, opts) -> full HTML document string
   * opts.resolve(path)  map an asset path to a usable URL (admin preview uses blob: URLs)
   * opts.baseHref       optional <base href> (admin preview)
   * opts.preview        true inside the admin preview
   */
  function renderPage(content, opts) {
    opts = opts || {};
    if (!opts.resolve) opts.resolve = function (p) { return p; };
    var c = content || {};
    var s = c.settings || {};
    var title = str(s.seo_title) || str(s.brand_name) || 'Artivora Creative';
    var desc = str(s.seo_description);
    var siteUrl = str(s.site_url).replace(/\/+$/, '');
    var ogImage = absUrl(siteUrl, s.og_image);
    var v = '?v=' + ASSET_VERSION;

    return '<!doctype html>\n<html lang="id">\n<head>\n' +
      '<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      (opts.baseHref ? '<base href="' + esc(opts.baseHref) + '">\n' : '') +
      '<title>' + esc(title) + '</title>\n' +
      '<meta name="description" content="' + esc(desc) + '">\n' +
      (siteUrl ? '<link rel="canonical" href="' + esc(siteUrl + '/') + '">\n' : '') +
      '<meta name="theme-color" content="#FFFFFF">\n' +
      '<meta property="og:type" content="website">\n' +
      '<meta property="og:locale" content="id_ID">\n' +
      '<meta property="og:title" content="' + esc(title) + '">\n' +
      '<meta property="og:description" content="' + esc(desc) + '">\n' +
      (siteUrl ? '<meta property="og:url" content="' + esc(siteUrl + '/') + '">\n' : '') +
      (ogImage ? '<meta property="og:image" content="' + esc(ogImage) + '">\n<meta name="twitter:card" content="summary_large_image">\n' : '') +
      '<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">\n' +
      '<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">\n' +
      '<link rel="preload" href="assets/fonts/plus-jakarta-sans.woff2" as="font" type="font/woff2" crossorigin>\n' +
      '<link rel="stylesheet" href="assets/css/site.css' + v + '">\n' +
      '<script type="application/ld+json">' + jsonLd(c) + '</script>\n' +
      '<!-- Halaman ini dibuat otomatis dari content.json. Ubah isinya lewat /admin, bukan di file ini. -->\n' +
      '</head>\n<body' + (opts.preview ? ' class="is-preview"' : '') + '>\n' +
      '<a class="skip-link" href="#main">Langsung ke isi</a>\n' +
      brandDefs() + '\n' +
      renderBody(c, opts) + '\n' +
      '<script src="assets/js/site.js' + v + '" defer></script>\n' +
      '</body>\n</html>\n';
  }

  function renderSitemap(content) {
    var s = (content && content.settings) || {};
    var siteUrl = str(s.site_url).replace(/\/+$/, '');
    var updated = str(content && content.meta && content.meta.updated_at).slice(0, 10) || new Date().toISOString().slice(0, 10);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '  <url><loc>' + esc(siteUrl + '/') + '</loc><lastmod>' + updated + '</lastmod></url>\n' +
      '</urlset>\n';
  }

  var api = {
    renderPage: renderPage,
    renderSitemap: renderSitemap,
    waNumber: waNumber,
    ASSET_VERSION: ASSET_VERSION
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ArtivoraRender = api;
})(typeof window !== 'undefined' ? window : this);
