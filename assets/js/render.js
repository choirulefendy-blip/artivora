/*
 * Artivora Creative — page renderer.
 * Turns content.json into the full static index.html.
 * Used by the admin (on publish and for live preview) and by scripts/build.js.
 */
(function (root) {
  'use strict';

  // Bump this when site.css / site.js change, so browsers fetch the new files.
  var ASSET_VERSION = '1.0.0';

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
  var markId = 0;
  function brandMark(opts) {
    opts = opts || {};
    var id = 'am' + (++markId);
    var from = opts.dark ? '#B9A5F0' : '#4C1D95';
    var cls = opts.className ? ' class="' + opts.className + '"' : '';
    return '<svg' + cls + ' viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + from + '"/><stop offset="1" stop-color="#FF6B4A"/>' +
      '</linearGradient></defs>' +
      '<path class="mark-stroke mark-stroke-a" pathLength="1" d="M20 88 C 29 62, 39 36, 52 11" fill="none" stroke="url(#' + id + ')" stroke-width="12" stroke-linecap="round"/>' +
      '<path class="mark-stroke mark-stroke-b" pathLength="1" d="M47 13 C 59 37, 69 62, 81 88" fill="none" stroke="url(#' + id + ')" stroke-width="12" stroke-linecap="round"/>' +
      '<circle class="mark-dot" cx="50" cy="63" r="7.5" fill="#FF6B4A"/>' +
      '</svg>';
  }

  function logo(settings, opts) {
    var name = str(settings.brand_name) || 'Artivora Creative';
    var logoUrl = safeUrl(opts.resolve(settings.logo_url));
    if (logoUrl) {
      return '<img class="logo-img" src="' + esc(logoUrl) + '" alt="' + esc(name) + '">';
    }
    var parts = name.split(/\s+/);
    var first = parts.shift();
    return brandMark({ dark: true, className: 'logo-mark' }) +
      '<span class="logo-word">' + esc(first) +
      (parts.length ? '<span class="logo-rest"> ' + esc(parts.join(' ')) + '</span>' : '') +
      '</span>';
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
      (wa ? '<a class="btn btn-coral btn-small" href="' + esc(wa) + '" target="_blank" rel="noopener">' + icon('whatsapp') + '<span>WhatsApp</span></a>'
          : '<a class="btn btn-coral btn-small" href="#kontak">Hubungi kami</a>') +
      '</div></nav></div></header>';
  }

  function renderHero(c) {
    var h = c.hero, s = c.settings;
    var wa = waLink(s);
    var industries = list(h.industries);
    return '<section class="hero" id="top" aria-labelledby="hero-title">' +
      '<div class="hero-art" aria-hidden="true">' + brandMark({ dark: true, className: 'hero-mark' }) + '</div>' +
      '<div class="wrap hero-inner">' +
      '<h1 id="hero-title" class="hero-title">' + esc(h.headline) + '</h1>' +
      (str(h.subheadline) ? '<p class="hero-sub">' + esc(h.subheadline) + '</p>' : '') +
      '<div class="hero-actions">' +
      (str(h.cta_primary) ? '<a class="btn btn-coral" href="' + esc(wa || '#kontak') + '"' + (wa ? ' target="_blank" rel="noopener"' : '') + '>' + (wa ? icon('whatsapp') : '') + '<span>' + esc(h.cta_primary) + '</span></a>' : '') +
      (str(h.cta_secondary) ? '<a class="btn btn-ghost" href="#layanan">' + esc(h.cta_secondary) + '</a>' : '') +
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
      body = '<div class="work-empty">' + brandMark({ dark: true, className: 'work-empty-mark' }) +
        '<p>' + esc(sec.empty_text || 'Studi kasus segera hadir.') + '</p>' +
        (ig ? '<a class="btn btn-coral" href="' + esc(ig) + '" target="_blank" rel="noopener">' + icon('instagram') + '<span>Lihat di Instagram</span></a>' : '') +
        '</div>';
    } else {
      body = '<div class="work-list">' + items.map(function (item) {
        var img = safeUrl(opts.resolve(item.image_url));
        var link = safeUrl(item.link_url);
        var meta = [item.client, item.industry, item.service].map(str).filter(Boolean);
        return '<article class="work">' +
          '<div class="work-media">' + (img ? '<img src="' + esc(img) + '" alt="' + esc(item.title || item.client) + '" loading="lazy">' : brandMark({ className: 'work-media-mark' })) + '</div>' +
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
          '<a class="btn ' + (t.highlighted ? 'btn-coral' : 'btn-outline') + '" href="' + esc(wa || '#kontak') + '"' + (wa ? ' target="_blank" rel="noopener"' : '') + '>Tanya paket ' + esc(t.name) + '</a>' +
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
      '<div class="about-media">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : brandMark({ dark: true, className: 'about-mark' })) + '</div>' +
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
      '<button class="btn btn-coral btn-block" type="submit">' + icon('whatsapp') + '<span>' + esc(sec.button_label || 'Kirim lewat WhatsApp') + '</span></button>' +
      '<p class="form-status" role="status" data-form-status></p>' +
      '</form></div></section>';
  }

  function renderFooter(c, opts, nav) {
    var s = c.settings;
    var ig = socialUrl('instagram', s.instagram);
    var tt = socialUrl('tiktok', s.tiktok);
    var year = opts.year || new Date().getFullYear();
    return '<footer class="site-footer"><div class="wrap footer-inner">' +
      '<div class="footer-brand"><a class="logo" href="#top">' + logo(s, opts) + '</a>' +
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
    markId = 0;
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
      '<meta name="theme-color" content="#1E1633">\n' +
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
