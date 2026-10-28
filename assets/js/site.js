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
})();
