/* Artivora admin — edits content.json in the GitHub repo and republishes index.html */
(function () {
  'use strict';

  var CFG = Object.assign({ owner: '', repo: '', branch: 'main' }, window.ARTIVORA_ADMIN || {});
  var R = window.ArtivoraRender;
  var TOKEN_KEY = 'artivora_admin_token';
  var DRAFT_KEY = 'artivora_admin_draft';
  var SITE_BASE = new URL('../', location.href).href;
  var REPO_PATH = '/repos/' + CFG.owner + '/' + CFG.repo;

  var state = {
    token: null,
    content: null,
    original: '',
    remoteSha: null,
    pending: new Map(), // path -> { base64, url, size }
    published: new Map(), // path -> blob url, until GitHub Pages has the file
    section: 'settings',
    previewOpen: false,
    device: 'desktop',
    busy: false,
    liveMsg: '',
    liveTimer: null,
    draft: null
  };

  // ---------- schema ----------
  var SECTIONS = [
    {
      key: 'settings', label: 'Pengaturan umum', toggle: false, anchor: 'top',
      desc: 'Kontak, media sosial, logo, dan teks yang tampil di Google.',
      fields: [
        { group: 'Kontak' },
        { key: 'whatsapp', label: 'Nomor WhatsApp', type: 'tel', placeholder: '0812 3456 7890', help: 'Semua tombol WhatsApp di website memakai nomor ini.', validate: 'wa' },
        { key: 'whatsapp_greeting', label: 'Pesan pembuka WhatsApp', type: 'text', help: 'Teks yang otomatis terisi saat orang menekan tombol WhatsApp.' },
        { key: 'email', label: 'Email', type: 'email', placeholder: 'halo@artivora.my.id' },
        { key: 'instagram', label: 'Instagram', type: 'text', placeholder: 'artivora.creative', help: 'Username atau link profil.' },
        { key: 'tiktok', label: 'TikTok', type: 'text', placeholder: 'artivora.creative' },
        { key: 'address', label: 'Alamat atau kota', type: 'text' },
        { key: 'maps_url', label: 'Link Google Maps', type: 'url', placeholder: 'https://maps.app.goo.gl/…' },
        { group: 'Brand' },
        { key: 'brand_name', label: 'Nama brand', type: 'text' },
        { key: 'tagline', label: 'Tagline', type: 'text', help: 'Tampil di footer.' },
        { key: 'logo_url', label: 'Logo', type: 'image', maxSize: 600, help: 'Opsional. Kosongkan untuk memakai logo bawaan. Pakai versi logo berwarna terang karena header berlatar gelap.' },
        { group: 'Google & saat link dibagikan' },
        { key: 'seo_title', label: 'Judul halaman', type: 'text', max: 60, help: 'Tampil di tab browser dan hasil pencarian Google.' },
        { key: 'seo_description', label: 'Deskripsi', type: 'textarea', rows: 3, max: 160, help: 'Tampil di bawah judul di Google dan saat link dibagikan di WhatsApp.' },
        { key: 'og_image', label: 'Gambar saat link dibagikan', type: 'image', maxSize: 1200, help: 'Ukuran ideal 1200 × 630 piksel.' },
        { key: 'site_url', label: 'Alamat website', type: 'url', help: 'Dipakai untuk Google. Biarkan https://artivora.my.id' }
      ]
    },
    {
      key: 'hero', label: 'Bagian pembuka', anchor: 'top',
      desc: 'Hal pertama yang dilihat pengunjung.',
      fields: [
        { key: 'headline', label: 'Judul besar', type: 'textarea', rows: 2, max: 80, help: 'Singkat dan spesifik. Tanpa titik di akhir supaya rapi.' },
        { key: 'subheadline', label: 'Kalimat pendukung', type: 'textarea', rows: 3 },
        { key: 'cta_primary', label: 'Teks tombol WhatsApp', type: 'text' },
        { key: 'cta_secondary', label: 'Teks tombol kedua', type: 'text', help: 'Mengarah ke bagian Layanan. Kosongkan untuk menyembunyikan.' },
        { key: 'industries', label: 'Jenis bisnis yang ditangani', type: 'lines', rows: 4, help: 'Satu per baris.' }
      ]
    },
    {
      key: 'clients', label: 'Logo klien', anchor: 'klien',
      desc: 'Deretan logo bisnis yang pernah bekerja dengan Artivora. Tampilkan hanya yang sudah memberi izin.',
      fields: [
        { key: 'title', label: 'Judul', type: 'text' },
        {
          key: 'items', label: 'Klien', type: 'list', titleKey: 'name', addLabel: 'Tambah klien', emptyTitle: 'Klien baru',
          template: { name: '', logo_url: '', url: '' },
          fields: [
            { key: 'name', label: 'Nama bisnis', type: 'text' },
            { key: 'logo_url', label: 'Logo', type: 'image', maxSize: 500, help: 'PNG atau SVG dengan latar transparan paling bagus.' },
            { key: 'url', label: 'Link (opsional)', type: 'url' }
          ]
        }
      ]
    },
    {
      key: 'services', label: 'Layanan', anchor: 'layanan',
      desc: 'Daftar layanan. Judulnya juga muncul sebagai pilihan di form kontak.',
      fields: [
        { key: 'title', label: 'Judul bagian', type: 'text' },
        { key: 'intro', label: 'Pengantar', type: 'textarea', rows: 3 },
        {
          key: 'items', label: 'Layanan', type: 'list', titleKey: 'title', addLabel: 'Tambah layanan', emptyTitle: 'Layanan baru',
          template: { title: '', description: '', deliverables: [] },
          fields: [
            { key: 'title', label: 'Nama layanan', type: 'text' },
            { key: 'description', label: 'Penjelasan', type: 'textarea', rows: 3 },
            { key: 'deliverables', label: 'Yang didapat klien', type: 'lines', rows: 4, help: 'Satu per baris.' }
          ]
        }
      ]
    },
    {
      key: 'portfolio', label: 'Hasil kerja', anchor: 'karya',
      desc: 'Studi kasus: masalah awal, yang dikerjakan, dan hasilnya. Pastikan klien sudah mengizinkan sebelum ditampilkan.',
      fields: [
        { key: 'title', label: 'Judul bagian', type: 'text' },
        { key: 'intro', label: 'Pengantar', type: 'textarea', rows: 2 },
        { key: 'empty_text', label: 'Teks saat belum ada studi kasus yang ditampilkan', type: 'textarea', rows: 2, help: 'Muncul bersama tombol Instagram kalau semua studi kasus disembunyikan.' },
        {
          key: 'items', label: 'Studi kasus', type: 'list', titleKey: 'client', itemToggle: true, addLabel: 'Tambah studi kasus', emptyTitle: 'Studi kasus baru',
          template: { visible: true, client: '', industry: '', service: '', title: '', challenge: '', approach: '', result: '', metric_value: '', metric_label: '', image_url: '', link_url: '' },
          fields: [
            { key: 'visible', label: 'Tampilkan di website', type: 'toggle' },
            { key: 'client', label: 'Nama klien', type: 'text' },
            { key: 'industry', label: 'Jenis bisnis', type: 'text', placeholder: 'Wedding organizer' },
            { key: 'service', label: 'Layanan', type: 'text', placeholder: 'Social media management' },
            { key: 'title', label: 'Judul studi kasus', type: 'text' },
            { key: 'image_url', label: 'Gambar', type: 'image', maxSize: 1600, help: 'Foto hasil kerja atau tangkapan layar feed. Rasio 4:3 paling pas.' },
            { key: 'metric_value', label: 'Angka utama', type: 'text', placeholder: '6.600', help: 'Opsional. Contoh: 6.600, 3x, +45%.' },
            { key: 'metric_label', label: 'Keterangan angka', type: 'text', placeholder: 'interaksi konten di bulan Juni' },
            { key: 'challenge', label: 'Tantangan', type: 'textarea', rows: 2 },
            { key: 'approach', label: 'Yang kami kerjakan', type: 'textarea', rows: 3 },
            { key: 'result', label: 'Hasil', type: 'textarea', rows: 2 },
            { key: 'link_url', label: 'Link hasil (opsional)', type: 'url', help: 'Misalnya link akun Instagram klien.' }
          ]
        }
      ]
    },
    {
      key: 'process', label: 'Cara kerja', anchor: 'cara-kerja',
      desc: 'Langkah-langkah dari obrolan pertama sampai laporan.',
      fields: [
        { key: 'title', label: 'Judul bagian', type: 'text' },
        { key: 'intro', label: 'Pengantar', type: 'textarea', rows: 2 },
        {
          key: 'steps', label: 'Langkah', type: 'list', titleKey: 'title', addLabel: 'Tambah langkah', emptyTitle: 'Langkah baru',
          template: { title: '', description: '' },
          fields: [
            { key: 'title', label: 'Nama langkah', type: 'text' },
            { key: 'description', label: 'Penjelasan', type: 'textarea', rows: 3 }
          ]
        }
      ]
    },
    {
      key: 'pricing', label: 'Harga', anchor: 'harga',
      desc: 'Paket dan harga mulai. Tombol tiap paket membuka WhatsApp dengan nama paketnya.',
      fields: [
        { key: 'title', label: 'Judul bagian', type: 'text' },
        { key: 'intro', label: 'Pengantar', type: 'textarea', rows: 2 },
        { key: 'note', label: 'Catatan di bawah harga', type: 'textarea', rows: 2 },
        {
          key: 'items', label: 'Paket', type: 'list', titleKey: 'name', addLabel: 'Tambah paket', emptyTitle: 'Paket baru',
          template: { name: '', audience: '', price: '', period: 'per bulan', features: [], highlighted: false, highlight_label: '' },
          fields: [
            { key: 'name', label: 'Nama paket', type: 'text' },
            { key: 'audience', label: 'Cocok untuk', type: 'text' },
            { key: 'price', label: 'Harga mulai', type: 'text', placeholder: 'Rp1,5 jt' },
            { key: 'period', label: 'Periode', type: 'text', placeholder: 'per bulan' },
            { key: 'features', label: 'Isi paket', type: 'lines', rows: 5, help: 'Satu per baris.' },
            { key: 'highlighted', label: 'Tonjolkan paket ini', type: 'toggle' },
            { key: 'highlight_label', label: 'Label paket yang ditonjolkan', type: 'text', placeholder: 'Rekomendasi kami' }
          ]
        }
      ]
    },
    {
      key: 'testimonials', label: 'Testimoni', anchor: 'testimoni',
      desc: 'Kutipan asli dari klien. Gunakan kata-kata klien sendiri dan minta izin sebelum ditampilkan.',
      fields: [
        { key: 'title', label: 'Judul bagian', type: 'text' },
        {
          key: 'items', label: 'Testimoni', type: 'list', titleKey: 'name', itemToggle: true, addLabel: 'Tambah testimoni', emptyTitle: 'Testimoni baru',
          template: { visible: true, quote: '', name: '', role: '', photo_url: '' },
          fields: [
            { key: 'visible', label: 'Tampilkan di website', type: 'toggle' },
            { key: 'quote', label: 'Kutipan', type: 'textarea', rows: 4 },
            { key: 'name', label: 'Nama', type: 'text' },
            { key: 'role', label: 'Jabatan dan bisnis', type: 'text', placeholder: 'Owner, Kopi Contoh' },
            { key: 'photo_url', label: 'Foto (opsional)', type: 'image', maxSize: 300 }
          ]
        }
      ]
    },
    {
      key: 'about', label: 'Tentang', anchor: 'tentang',
      desc: 'Cerita singkat Artivora dan tim di baliknya.',
      fields: [
        { key: 'title', label: 'Judul bagian', type: 'text' },
        { key: 'body', label: 'Cerita', type: 'textarea', rows: 8, help: 'Pisahkan paragraf dengan satu baris kosong.' },
        { key: 'image_url', label: 'Foto', type: 'image', maxSize: 1400, help: 'Foto tim atau suasana kerja. Rasio potret 4:5 paling pas.' },
        {
          key: 'team', label: 'Tim', type: 'list', titleKey: 'name', addLabel: 'Tambah anggota tim', emptyTitle: 'Anggota baru',
          template: { name: '', role: '', photo_url: '' },
          fields: [
            { key: 'name', label: 'Nama', type: 'text' },
            { key: 'role', label: 'Peran', type: 'text' },
            { key: 'photo_url', label: 'Foto', type: 'image', maxSize: 400 }
          ]
        }
      ]
    },
    {
      key: 'faq', label: 'FAQ', anchor: 'faq',
      desc: 'Pertanyaan yang sering ditanyakan calon klien.',
      fields: [
        { key: 'title', label: 'Judul bagian', type: 'text' },
        {
          key: 'items', label: 'Pertanyaan', type: 'list', titleKey: 'question', addLabel: 'Tambah pertanyaan', emptyTitle: 'Pertanyaan baru',
          template: { question: '', answer: '' },
          fields: [
            { key: 'question', label: 'Pertanyaan', type: 'text' },
            { key: 'answer', label: 'Jawaban', type: 'textarea', rows: 4 }
          ]
        }
      ]
    },
    {
      key: 'contact', label: 'Kontak', anchor: 'kontak',
      desc: 'Form yang membuka WhatsApp dengan pesan yang sudah terisi. Nomornya diatur di Pengaturan umum.',
      fields: [
        { key: 'title', label: 'Judul bagian', type: 'text' },
        { key: 'body', label: 'Pengantar', type: 'textarea', rows: 3 },
        { key: 'button_label', label: 'Teks tombol kirim', type: 'text' }
      ]
    }
  ];

  // ---------- DOM helpers ----------
  function $(sel) { return document.querySelector(sel); }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'open' || k === 'hidden') node[k] = v;
      else node.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }
  function append(node, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(node, c); }); return; }
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  var ICONS = {
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    upload: '<path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H4"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'
  };
  function icon(name) {
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }
  function iconBtn(name, label, onClick, cls) {
    return el('button', { type: 'button', class: 'btn btn-quiet btn-icon ' + (cls || ''), 'aria-label': label, title: label, html: icon(name), onclick: onClick });
  }

  function mark(id) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B9A5F0"/><stop offset="1" stop-color="#FF6B4A"/></linearGradient></defs><path d="M20 88 C 29 62, 39 36, 52 11" fill="none" stroke="url(#' + id + ')" stroke-width="12" stroke-linecap="round"/><path d="M47 13 C 59 37, 69 62, 81 88" fill="none" stroke="url(#' + id + ')" stroke-width="12" stroke-linecap="round"/><circle cx="50" cy="63" r="7.5" fill="#FF6B4A"/></svg>';
  }

  // ---------- toast & dialogs ----------
  var toastTimer;
  function toast(msg, isError) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('is-error', !!isError);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, isError ? 7000 : 4000);
  }

  // Resolves to the value of the chosen button.
  function ask(title, text, buttons) {
    return new Promise(function (resolve) {
      var dlg = $('#dialog');
      var actions = el('div', { class: 'dialog-actions' });
      buttons.forEach(function (b) {
        actions.appendChild(el('button', {
          type: 'button', class: 'btn ' + (b.cls || 'btn-line'), text: b.label,
          onclick: function () { dlg.close(); resolve(b.value); }
        }));
      });
      dlg.replaceChildren(el('h2', { text: title }), el('p', { text: text }), actions);
      dlg.onclose = function () { resolve(false); };
      dlg.showModal();
    });
  }

  // ---------- encoding ----------
  function b64FromUtf8(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function utf8FromB64(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(',')[1]); };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  // ---------- GitHub API ----------
  function gh(path, opts) {
    opts = opts || {};
    var headers = {
      Authorization: 'Bearer ' + state.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch('https://api.github.com' + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store'
    }).then(function (res) {
      if (res.ok) return res.status === 204 ? null : res.json();
      return res.json().catch(function () { return {}; }).then(function (data) {
        var err = new Error(data.message || res.statusText || 'Permintaan ke GitHub gagal');
        err.status = res.status;
        throw err;
      });
    });
  }

  function explain(err, onLogin) {
    var s = err && err.status;
    if (s === 401) return onLogin ? 'Token tidak valid atau sudah kedaluwarsa. Periksa lagi token yang ditempel, atau buat token baru.' : 'Token GitHub tidak valid atau sudah kedaluwarsa. Keluar, lalu masuk dengan token baru.';
    if (s === 403) {
      if (/rate limit/i.test(err.message)) return 'Batas permintaan GitHub tercapai. Tunggu beberapa menit lalu coba lagi.';
      return 'Token belum punya izin menulis. Saat membuat token, atur Contents ke "Read and write".';
    }
    if (s === 404) return 'Repo ' + CFG.owner + '/' + CFG.repo + ' tidak ditemukan, atau token tidak diberi akses ke repo ini.';
    if (s === 409 || s === 422) return 'Repo berubah saat sedang menyimpan. Muat ulang halaman admin lalu publikasikan lagi.';
    if (err && err.name === 'TypeError') return 'Tidak bisa terhubung ke GitHub. Periksa koneksi internet.';
    return (err && err.message) || 'Terjadi kesalahan.';
  }

  function contentPath() { return REPO_PATH + '/contents/content.json?ref=' + encodeURIComponent(CFG.branch); }

  function loadContent() {
    return gh(contentPath()).then(function (file) {
      var content = JSON.parse(utf8FromB64(file.content));
      state.content = content;
      state.original = JSON.stringify(content);
      state.remoteSha = file.sha;
      state.pending.clear();
      checkDraft();
    });
  }

  // ---------- assets ----------
  function resolveAsset(v) {
    v = String(v || '').trim();
    if (!v) return '';
    if (state.pending.has(v)) return state.pending.get(v).url;
    if (state.published.has(v)) return state.published.get(v);
    if (/^(https?:|blob:|data:)/i.test(v)) return v;
    return SITE_BASE + v.replace(/^\/+/, '');
  }

  function slugify(name) {
    return String(name).toLowerCase().replace(/\.[a-z0-9]+$/, '').normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'gambar';
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('File ini bukan gambar yang bisa dibaca.')); };
      img.src = url;
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, type, quality); });
  }

  // Resize to maxSize on the longest side and re-encode as WebP (JPEG on old browsers).
  function compressImage(file, maxSize) {
    if (file.type === 'image/svg+xml') return Promise.resolve({ blob: file, ext: 'svg' });
    if (file.type === 'image/gif') return Promise.resolve({ blob: file, ext: 'gif' });
    var source = window.createImageBitmap ? createImageBitmap(file).catch(function () { return loadImage(file); }) : loadImage(file);
    return source.then(function (img) {
      var w = img.width, h = img.height;
      var scale = Math.min(1, maxSize / Math.max(w, h));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvasBlob(canvas, 'image/webp', 0.82).then(function (blob) {
        if (blob && blob.type === 'image/webp') return { blob: blob, ext: 'webp' };
        return canvasBlob(canvas, 'image/jpeg', 0.85).then(function (jpg) { return { blob: jpg, ext: 'jpg' }; });
      });
    });
  }

  function addPendingImage(file, maxSize) {
    if (file.size > 20 * 1024 * 1024) return Promise.reject(new Error('Gambar terlalu besar (lebih dari 20 MB).'));
    return compressImage(file, maxSize || 1600).then(function (res) {
      var path = 'assets/uploads/' + slugify(file.name) + '-' + Date.now().toString(36) + '.' + res.ext;
      return blobToBase64(res.blob).then(function (b64) {
        state.pending.set(path, { base64: b64, url: URL.createObjectURL(res.blob), size: res.blob.size });
        return { path: path, size: res.blob.size };
      });
    });
  }

  // Pending uploads still referenced somewhere in the content.
  function usedPending() {
    var used = [];
    (function walk(v) {
      if (typeof v === 'string') { if (state.pending.has(v) && used.indexOf(v) < 0) used.push(v); }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { walk(v[k]); });
    })(state.content);
    return used;
  }

  function formatKB(bytes) { return bytes > 1024 * 1024 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB'; }

  // ---------- status ----------
  function isDirty() {
    return !!state.content && (JSON.stringify(state.content) !== state.original || usedPending().length > 0);
  }

  function setStatus(text, mode) {
    var s = $('#status');
    s.className = 'status' + (mode ? ' is-' + mode : '');
    $('#status-text').textContent = text;
  }

  function refreshStatus() {
    if (!state.content) return;
    var dirty = isDirty();
    $('#publish-btn').disabled = state.busy || !dirty;
    document.querySelectorAll('[data-revert]').forEach(function (b) { b.disabled = state.busy || !dirty; });
    if (state.busy) return;
    if (dirty) setStatus('Ada perubahan yang belum dipublikasikan', 'dirty');
    else if (state.liveMsg) setStatus(state.liveMsg, state.liveTimer ? 'busy' : '');
    else setStatus('Semua perubahan sudah tayang', '');
  }

  var draftTimer;
  function onChange() {
    refreshStatus();
    schedulePreview();
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 600);
  }

  // ---------- drafts (survive a closed tab) ----------
  function saveDraft() {
    try {
      if (isDirty()) localStorage.setItem(DRAFT_KEY, JSON.stringify({ baseSha: state.remoteSha, content: state.content, savedAt: Date.now() }));
      else localStorage.removeItem(DRAFT_KEY);
    } catch (e) { /* storage full or blocked: drafts are a convenience */ }
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }
  function checkDraft() {
    state.draft = null;
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (d && d.content && JSON.stringify(d.content) !== state.original) state.draft = d;
    } catch (e) {}
  }

  // ---------- editor ----------
  function sectionByKey(key) { return SECTIONS.filter(function (s) { return s.key === key; })[0]; }

  function renderNav() {
    var nav = $('#side-nav');
    nav.replaceChildren.apply(nav, SECTIONS.map(function (sec) {
      var hidden = sec.toggle !== false && state.content[sec.key] && state.content[sec.key].visible === false;
      return el('button', {
        type: 'button', class: 'side-link', 'aria-current': sec.key === state.section ? 'true' : 'false',
        onclick: function () { openSection(sec.key); }
      }, el('span', { text: sec.label }), hidden ? el('span', { class: 'side-flag', text: 'Disembunyikan' }) : null);
    }));
  }

  function openSection(key) {
    state.section = key;
    renderNav();
    renderEditor();
    $('#editor').scrollTop = 0;
    if (state.previewOpen) renderPreview(true);
  }

  function renderEditor() {
    var sec = sectionByKey(state.section);
    var data = state.content[sec.key] = state.content[sec.key] || {};
    var inner = $('#editor-inner');
    var parts = [];

    if (state.draft) parts.push(draftBanner());

    var toggle = null;
    if (sec.toggle !== false) {
      if (typeof data.visible !== 'boolean') data.visible = true;
      toggle = switchControl('Tampilkan di website', data.visible, function (on) {
        data.visible = on;
        renderNav();
        onChange();
      });
    }
    parts.push(el('div', { class: 'sec-head' },
      el('div', null, el('h1', { text: sec.label }), el('p', { text: sec.desc })),
      toggle));

    var card = el('div', { class: 'card' });
    sec.fields.forEach(function (f) { card.appendChild(buildField(f, data)); });
    parts.push(card);

    parts.push(el('div', { class: 'mobile-foot' },
      el('button', { type: 'button', class: 'btn btn-line', 'data-revert': true, html: icon('undo') + '<span>Batalkan perubahan</span>', onclick: revertAll }),
      el('button', { type: 'button', class: 'btn btn-quiet', html: icon('logout') + '<span>Keluar</span>', onclick: logout })));

    inner.replaceChildren.apply(inner, parts);
    refreshStatus();
  }

  function draftBanner() {
    var changed = state.draft.baseSha !== state.remoteSha;
    var when = new Date(state.draft.savedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    return el('div', { class: 'banner', role: 'status' },
      el('p', { text: 'Ada draf yang belum dipublikasikan dari ' + when + '.' +
        (changed ? ' Isi website sudah berubah sejak draf itu dibuat, jadi memakai draf akan menimpa perubahan tersebut.' : '') +
        ' Gambar yang belum sempat dipublikasikan perlu dipilih ulang.' }),
      el('div', { class: 'banner-actions' },
        el('button', { type: 'button', class: 'btn btn-coral', text: 'Pakai draf', onclick: function () {
          state.content = state.draft.content;
          state.draft = null;
          renderNav(); renderEditor(); onChange();
          toast('Draf dipakai. Periksa lalu publikasikan.');
        } }),
        el('button', { type: 'button', class: 'btn btn-line', text: 'Buang draf', onclick: function () {
          state.draft = null; clearDraft(); renderEditor();
        } })));
  }

  function switchControl(label, checked, onToggle) {
    var input = el('input', { type: 'checkbox', checked: !!checked, onchange: function () { onToggle(input.checked); } });
    return el('label', { class: 'switch' }, input, el('span', { class: 'switch-track', 'aria-hidden': 'true' }), el('span', { text: label }));
  }

  var uid = 0;
  function buildField(f, obj, after) {
    if (f.group) return el('h2', { class: 'group-title', text: f.group });
    if (f.type === 'list') return buildList(f, obj);
    if (f.type === 'image') return buildImage(f, obj, after);
    if (f.type === 'toggle') {
      return el('div', { class: 'field' }, switchControl(f.label, obj[f.key], function (on) {
        obj[f.key] = on; if (after) after(); onChange();
      }));
    }

    var id = 'f' + (++uid);
    var helpEl = f.help ? el('p', { class: 'field-help', id: id + '-help', text: f.help }) : null;
    var counter = f.max ? el('span', { class: 'counter', 'aria-live': 'polite' }) : null;
    var input;
    var value = f.type === 'lines' ? (Array.isArray(obj[f.key]) ? obj[f.key].join('\n') : '') : (obj[f.key] == null ? '' : String(obj[f.key]));

    if (f.type === 'textarea' || f.type === 'lines') {
      input = el('textarea', { id: id, class: 'input', rows: f.rows || 3 });
    } else {
      input = el('input', {
        id: id, class: 'input',
        type: f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text',
        inputmode: f.type === 'tel' ? 'tel' : null,
        autocomplete: 'off'
      });
    }
    input.value = value;
    if (f.placeholder) input.placeholder = f.placeholder;
    if (helpEl) input.setAttribute('aria-describedby', id + '-help');

    function update() {
      var v = input.value;
      if (f.type === 'lines') obj[f.key] = v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      else obj[f.key] = f.type === 'textarea' ? v : v.trim();
      if (counter) {
        counter.textContent = v.length + ' / ' + f.max;
        counter.classList.toggle('is-over', v.length > f.max);
      }
      if (f.validate === 'wa' && helpEl) {
        var digits = R.waNumber(v);
        var bad = v.trim() && (digits.length < 10 || digits.length > 15);
        helpEl.textContent = bad ? 'Nomor terlihat belum lengkap. Contoh: 0812 3456 7890.' : (digits ? 'Akan dipakai sebagai +' + digits + '.' : f.help);
        helpEl.classList.toggle('is-warn', !!bad);
      }
    }
    input.addEventListener('input', function () { update(); if (after) after(); onChange(); });
    update();

    return el('div', { class: 'field' }, el('label', { for: id, text: f.label }), input, counter, helpEl);
  }

  function buildImage(f, obj, after) {
    var id = 'f' + (++uid);
    var thumb = el('div', { class: 'thumb', 'aria-hidden': 'true' });
    var note = el('p', { class: 'field-help', id: id + '-help', text: f.help || '' });
    var fileInput = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif', hidden: true });
    var urlInput = el('input', { id: id, class: 'input', type: 'text', placeholder: 'atau tempel link gambar', autocomplete: 'off', 'aria-describedby': id + '-help' });
    var removeBtn = el('button', { type: 'button', class: 'btn btn-quiet btn-danger', text: 'Hapus' });
    var pickBtn = el('button', { type: 'button', class: 'btn btn-line', html: icon('upload') + '<span>Pilih gambar</span>' });

    function refresh() {
      var v = obj[f.key] || '';
      urlInput.value = v;
      if (v) {
        thumb.style.backgroundImage = 'url("' + resolveAsset(v).replace(/"/g, '%22') + '")';
        thumb.textContent = '';
        thumb.classList.add('has-image');
      } else {
        thumb.style.backgroundImage = '';
        thumb.textContent = 'Belum ada gambar';
        thumb.classList.remove('has-image');
      }
      removeBtn.disabled = !v;
    }

    pickBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      pickBtn.disabled = true;
      note.textContent = 'Mengompres gambar…';
      note.className = 'field-help';
      addPendingImage(file, f.maxSize).then(function (res) {
        obj[f.key] = res.path;
        note.textContent = 'Siap dipublikasikan (' + formatKB(res.size) + ', dari ' + formatKB(file.size) + ').';
        refresh(); if (after) after(); onChange();
      }).catch(function (err) {
        note.textContent = err.message || 'Gambar gagal diproses.';
        note.className = 'field-help is-err';
      }).then(function () { pickBtn.disabled = false; });
    });
    removeBtn.addEventListener('click', function () {
      obj[f.key] = '';
      note.textContent = f.help || '';
      note.className = 'field-help';
      refresh(); if (after) after(); onChange();
    });
    urlInput.addEventListener('change', function () {
      obj[f.key] = urlInput.value.trim();
      refresh(); if (after) after(); onChange();
    });

    refresh();
    return el('div', { class: 'field' },
      el('label', { for: id, text: f.label }),
      el('div', { class: 'image-field' }, thumb,
        el('div', { class: 'image-controls' },
          el('div', { class: 'image-buttons' }, pickBtn, removeBtn), urlInput, note)),
      fileInput);
  }

  function buildList(f, obj) {
    if (!Array.isArray(obj[f.key])) obj[f.key] = [];
    var arr = obj[f.key];
    var listEl = el('div', { class: 'list' });

    function redraw(openIndex) {
      listEl.replaceChildren.apply(listEl, arr.map(function (item, i) { return buildItem(item, i, i === openIndex); }));
    }

    function move(i, dir) {
      var j = i + dir;
      if (j < 0 || j >= arr.length) return;
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      redraw(j); onChange();
    }

    function buildItem(item, i, open) {
      var title = el('span', { class: 'item-title' });
      var tag = el('span', { class: 'item-tag', hidden: true });
      function updateHead() {
        var t = String(item[f.titleKey] || '').trim();
        title.textContent = t || f.emptyTitle || 'Tanpa judul';
        title.classList.toggle('is-empty', !t);
        var label = f.itemToggle && item.visible === false ? 'Disembunyikan' : item.highlighted ? 'Ditonjolkan' : '';
        tag.textContent = label;
        tag.hidden = !label;
      }
      function tool(name, label, fn, disabled) {
        var b = iconBtn(name, label, function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
        b.disabled = !!disabled;
        return b;
      }
      var head = el('summary', { class: 'item-head' }, title, tag,
        el('span', { class: 'item-tools' },
          tool('up', 'Naikkan', function () { move(i, -1); }, i === 0),
          tool('down', 'Turunkan', function () { move(i, 1); }, i === arr.length - 1),
          tool('trash', 'Hapus', function () {
            var name = String(item[f.titleKey] || '').trim() || 'item ini';
            ask('Hapus ' + name + '?', 'Item akan hilang dari website setelah dipublikasikan.', [
              { label: 'Batal', value: false },
              { label: 'Hapus', value: true, cls: 'btn-coral' }
            ]).then(function (ok) {
              if (!ok) return;
              arr.splice(i, 1); redraw(-1); onChange();
            });
          })));
      var body = el('div', { class: 'item-body' });
      f.fields.forEach(function (sub) { body.appendChild(buildField(sub, item, updateHead)); });
      updateHead();
      return el('details', { class: 'item', open: open }, head, body);
    }

    redraw(-1);
    var addBtn = el('button', {
      type: 'button', class: 'btn btn-line add-btn', html: icon('plus') + '<span>' + (f.addLabel || 'Tambah') + '</span>',
      onclick: function () {
        arr.push(clone(f.template || {}));
        redraw(arr.length - 1); onChange();
        var last = listEl.lastElementChild;
        if (last) { var first = last.querySelector('.item-body input, .item-body textarea'); if (first) first.focus(); }
      }
    });
    return el('div', { class: 'field' },
      el('span', { class: 'field-label', text: f.label }),
      f.help ? el('p', { class: 'field-help', text: f.help }) : null,
      listEl, addBtn);
  }

  // ---------- preview ----------
  var previewTimer;
  function schedulePreview() {
    if (!state.previewOpen) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () { renderPreview(false); }, 350);
  }

  function renderPreview(jumpToSection) {
    var frame = $('#preview-frame');
    var y = 0;
    try { y = frame.contentWindow.scrollY || 0; } catch (e) {}
    var html = R.renderPage(state.content, { preview: true, baseHref: SITE_BASE, resolve: resolveAsset });
    frame.onload = function () {
      try {
        var win = frame.contentWindow;
        var anchor = sectionByKey(state.section).anchor;
        var target = jumpToSection && anchor !== 'top' ? win.document.getElementById(anchor) : null;
        if (target) target.scrollIntoView();
        else if (!jumpToSection) win.scrollTo(0, y);
      } catch (e) {}
    };
    frame.srcdoc = html;
  }

  function setPreview(open) {
    state.previewOpen = open;
    $('#preview').hidden = !open;
    $('#workspace').classList.toggle('has-preview', open);
    $('#preview-btn').setAttribute('aria-pressed', open ? 'true' : 'false');
    if (open) renderPreview(true);
  }

  function setDevice(device) {
    state.device = device;
    $('#preview-stage').classList.toggle('is-phone', device === 'phone');
    document.querySelectorAll('[data-device]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-device') === device ? 'true' : 'false');
    });
  }

  // ---------- publish ----------
  function publish() {
    if (state.busy || !isDirty()) return;
    state.busy = true;
    refreshStatus();
    setStatus('Mengecek versi terbaru di GitHub…', 'busy');

    gh(contentPath()).then(function (current) {
      if (current.sha === state.remoteSha) return true;
      return ask('Isi website sudah diubah dari tempat lain',
        'Sejak halaman ini dibuka, content.json di GitHub sudah berubah (mungkin dari perangkat lain). Kalau dilanjutkan, perubahan itu akan tertimpa.',
        [{ label: 'Batal', value: false }, { label: 'Timpa dan publikasikan', value: true, cls: 'btn-coral' }]);
    }).then(function (go) {
      if (!go) throw { cancelled: true };
      setStatus('Menyimpan ke GitHub…', 'busy');

      var content = state.content;
      content.meta = content.meta || {};
      content.meta.version = (content.meta.version || 0) + 1;
      content.meta.updated_at = new Date().toISOString();
      var json = JSON.stringify(content, null, 2) + '\n';

      var files = [
        { path: 'content.json', base64: b64FromUtf8(json) },
        { path: 'index.html', base64: b64FromUtf8(R.renderPage(content)) },
        { path: 'sitemap.xml', base64: b64FromUtf8(R.renderSitemap(content)) }
      ];
      var images = usedPending();
      images.forEach(function (p) { files.push({ path: p, base64: state.pending.get(p).base64 }); });

      var headSha, contentBlobSha;
      return gh(REPO_PATH + '/git/ref/heads/' + encodeURIComponent(CFG.branch)).then(function (ref) {
        headSha = ref.object.sha;
        return gh(REPO_PATH + '/git/commits/' + headSha);
      }).then(function (commit) {
        var baseTree = commit.tree.sha;
        return files.reduce(function (p, file) {
          return p.then(function (acc) {
            return gh(REPO_PATH + '/git/blobs', { method: 'POST', body: { content: file.base64, encoding: 'base64' } })
              .then(function (blob) {
                if (file.path === 'content.json') contentBlobSha = blob.sha;
                acc.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
                return acc;
              });
          });
        }, Promise.resolve([])).then(function (tree) {
          return gh(REPO_PATH + '/git/trees', { method: 'POST', body: { base_tree: baseTree, tree: tree } });
        });
      }).then(function (tree) {
        var msg = 'Update isi website lewat admin' + (images.length ? ' (+' + images.length + ' gambar)' : '');
        return gh(REPO_PATH + '/git/commits', { method: 'POST', body: { message: msg, tree: tree.sha, parents: [headSha] } });
      }).then(function (commit) {
        return gh(REPO_PATH + '/git/refs/heads/' + encodeURIComponent(CFG.branch), { method: 'PATCH', body: { sha: commit.sha } });
      }).then(function () {
        state.remoteSha = contentBlobSha;
        state.original = JSON.stringify(content);
        images.forEach(function (p) { state.published.set(p, state.pending.get(p).url); state.pending.delete(p); });
        clearDraft();
        state.busy = false;
        toast('Dipublikasikan. Website ter-update dalam sekitar 1 menit.');
        watchLive(content.meta.updated_at);
      });
    }).catch(function (err) {
      state.busy = false;
      if (err && err.cancelled) { refreshStatus(); return; }
      refreshStatus();
      toast(explain(err), true);
    });
  }

  function watchLive(stamp) {
    clearInterval(state.liveTimer);
    var tries = 0;
    state.liveMsg = 'Dipublikasikan, menunggu GitHub Pages memperbarui website…';
    state.liveTimer = setInterval(function () {
      tries++;
      fetch(SITE_BASE + 'content.json?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (live) {
          if (live && live.meta && live.meta.updated_at === stamp) {
            clearInterval(state.liveTimer); state.liveTimer = null;
            state.liveMsg = 'Sudah tayang di website';
            toast('Website sudah ter-update.');
            refreshStatus();
          }
        }).catch(function () {});
      if (tries >= 40 && state.liveTimer) {
        clearInterval(state.liveTimer); state.liveTimer = null;
        state.liveMsg = 'Dipublikasikan. Kalau website belum berubah, tunggu sebentar lalu muat ulang.';
        refreshStatus();
      }
    }, 7000);
    refreshStatus();
  }

  function revertAll() {
    if (!isDirty()) return;
    ask('Batalkan semua perubahan?', 'Isi editor kembali ke versi yang sedang tayang di website.', [
      { label: 'Tidak', value: false },
      { label: 'Batalkan perubahan', value: true, cls: 'btn-coral' }
    ]).then(function (ok) {
      if (!ok) return;
      state.content = JSON.parse(state.original);
      state.pending.clear();
      clearDraft();
      renderNav(); renderEditor(); onChange();
      toast('Perubahan dibatalkan.');
    });
  }

  // ---------- auth ----------
  function storedToken() {
    try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }
  function storeToken(token, remember) {
    try {
      localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
      (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    } catch (e) {}
  }
  function forgetToken() {
    try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  function login(token, remember) {
    state.token = token;
    return gh(REPO_PATH).then(function () {
      if (remember !== undefined) storeToken(token, remember);
      return loadContent();
    }).then(showApp);
  }

  function logout() {
    var go = isDirty()
      ? ask('Keluar tanpa mempublikasikan?', 'Perubahan tersimpan sebagai draf di perangkat ini, tapi gambar baru akan hilang.', [
        { label: 'Tetap di sini', value: false }, { label: 'Keluar', value: true, cls: 'btn-coral' }])
      : Promise.resolve(true);
    go.then(function (ok) {
      if (!ok) return;
      saveDraft();
      forgetToken();
      state.token = null; state.content = null; state.pending.clear();
      clearInterval(state.liveTimer); state.liveTimer = null; state.liveMsg = '';
      setPreview(false);
      showLogin('');
    });
  }

  function showLogin(error) {
    $('#loading').hidden = true;
    $('#app').hidden = true;
    $('#login').hidden = false;
    var e = $('#login-error');
    e.textContent = error || '';
    e.hidden = !error;
    $('#token').value = '';
    $('#token').focus();
  }

  function showApp() {
    $('#loading').hidden = true;
    $('#login').hidden = true;
    $('#app').hidden = false;
    renderNav();
    renderEditor();
  }

  // ---------- boot ----------
  function boot() {
    $('#login-brand').innerHTML = mark('adm-g1') + '<span class="brand-word">Artivora <span>Admin</span></span>';
    $('#top-brand').innerHTML = mark('adm-g2') + '<span class="brand-word">Artivora <span>Admin</span></span>';
    $('#top-brand').href = SITE_BASE;
    $('#repo-name').textContent = CFG.owner + '/' + CFG.repo;

    $('#login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var token = $('#token').value.trim();
      if (!token) { showLogin('Tempel token GitHub dulu.'); return; }
      var btn = $('#login-btn');
      btn.disabled = true; btn.textContent = 'Memeriksa token…';
      login(token, $('#remember').checked).catch(function (err) {
        showLogin(explain(err, true));
      }).then(function () { btn.disabled = false; btn.textContent = 'Masuk'; });
    });

    $('#publish-btn').addEventListener('click', publish);
    $('#preview-btn').addEventListener('click', function () { setPreview(!state.previewOpen); });
    $('#preview-close').addEventListener('click', function () { setPreview(false); });
    document.querySelectorAll('[data-device]').forEach(function (b) {
      b.addEventListener('click', function () { setDevice(b.getAttribute('data-device')); });
    });
    $('#revert-btn').addEventListener('click', revertAll);
    $('#logout-btn').addEventListener('click', logout);
    $('#site-link').href = SITE_BASE;

    window.addEventListener('beforeunload', function (e) {
      if (isDirty()) { saveDraft(); e.preventDefault(); e.returnValue = ''; }
    });

    var token = storedToken();
    if (!token) { showLogin(''); return; }
    login(token).catch(function (err) {
      if (err && (err.status === 401 || err.status === 404)) forgetToken();
      showLogin(explain(err, true));
    });
  }

  if (!R) {
    document.body.textContent = 'File assets/js/render.js tidak ditemukan.';
    return;
  }
  boot();
})();
