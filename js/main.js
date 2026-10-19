/* PixelQG landing page — small progressive enhancements. Everything works without JS. */
(function () {
  'use strict';

  // Buy buttons link to compte.html#acheter in the HTML: the purchase is tied to an account there.

  // ---- Contact link from CONTACT_EMAIL (falls back to legal/contact.html) ----
  var email = typeof CONTACT_EMAIL === 'string' ? CONTACT_EMAIL.trim() : '';
  if (/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) {
    document.querySelectorAll('[data-contact]').forEach(function (a) { a.href = 'mailto:' + email; });
    document.querySelectorAll('[data-contact-text]').forEach(function (a) { a.textContent = email; });
    document.querySelectorAll('[data-contact-todo]').forEach(function (el) { el.hidden = true; });
  }

  // ---- Footer year ----
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  // ---- Demo video: download it fully, then play from memory ----
  // The static host answers without byte ranges, so a streamed MP4 cannot be scrubbed
  // (no going back). A local blob URL can be seeked freely in every direction.
  var demo = document.querySelector('.win--video video');
  if (demo && window.fetch && window.Blob && window.URL && URL.createObjectURL) {
    var source = demo.querySelector('source');
    var demoUrl = source ? source.getAttribute('src') : demo.getAttribute('src');
    if (demoUrl) {
      if (source) source.parentNode.removeChild(source);
      demo.removeAttribute('src');
      demo.controls = false;
      demo.load();
      var play = document.createElement('button');
      play.type = 'button';
      play.className = 'btn btn--lg video-play';
      play.textContent = '▶ Regarder la démo (1 min)';
      demo.parentNode.appendChild(play);
      var setLabel = function (text) { play.textContent = text; };
      play.addEventListener('click', function () {
        if (play.disabled) return;
        play.disabled = true;
        setLabel('Chargement… 0 %');
        fetch(demoUrl).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var total = Number(res.headers.get('content-length')) || 0;
          if (!res.body || !res.body.getReader || !total) return res.blob();
          var reader = res.body.getReader(), chunks = [], got = 0;
          var pump = function () {
            return reader.read().then(function (r) {
              if (r.done) return new Blob(chunks, { type: 'video/mp4' });
              chunks.push(r.value);
              got += r.value.length;
              setLabel('Chargement… ' + Math.min(99, Math.round(got * 100 / total)) + ' %');
              return pump();
            });
          };
          return pump();
        }).then(function (blob) {
          demo.src = URL.createObjectURL(blob);
          demo.controls = true;
          play.parentNode.removeChild(play);
          var p = demo.play();
          if (p && p.catch) p.catch(function () {});
        }).catch(function () {
          play.disabled = false;
          setLabel('Réessayer de charger la vidéo');
        });
      });
    }
  }

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
