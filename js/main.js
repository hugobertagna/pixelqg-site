/* PixelQG landing page — small progressive enhancements. Everything works without JS. */
(function () {
  'use strict';

  // ---- Buy buttons: all point to CHECKOUT_URL from config.js ----
  var checkout = typeof CHECKOUT_URL === 'string' ? CHECKOUT_URL.trim() : '';
  var validCheckout = /^https:\/\/[^\s"'<>]+$/i.test(checkout);
  var note = document.getElementById('buy-note');
  document.querySelectorAll('[data-buy]').forEach(function (a) {
    if (validCheckout) {
      a.href = checkout;
      a.rel = 'noopener';
    } else {
      // No payment link yet: go to the pricing card and say so inline (no popup).
      a.href = '#prix';
      a.addEventListener('click', function () {
        if (note) note.hidden = false;
      });
    }
  });

  // ---- Contact link from CONTACT_EMAIL (falls back to legal/contact.html) ----
  var email = typeof CONTACT_EMAIL === 'string' ? CONTACT_EMAIL.trim() : '';
  if (/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) {
    document.querySelectorAll('[data-contact]').forEach(function (a) { a.href = 'mailto:' + email; });
    document.querySelectorAll('[data-contact-text]').forEach(function (a) { a.textContent = email; });
    document.querySelectorAll('[data-contact-todo]').forEach(function (el) { el.hidden = true; });
  }

  // ---- Footer year ----
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  // ---- Hero loop: respect reduced motion, and only play while visible ----
  var video = document.querySelector('.hero__video');
  if (video) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    var visible = true;
    var sync = function () {
      if ((reduce && reduce.matches) || !visible) { video.pause(); }
      else { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
    };
    if (reduce && reduce.matches) { video.removeAttribute('autoplay'); video.pause(); }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; sync(); }, { threshold: 0.15 }).observe(video);
    }
    if (reduce && reduce.addEventListener) reduce.addEventListener('change', sync);
  }
})();
