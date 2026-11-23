// Click-to-load game player. Without JS the Play link simply opens the demo in a new tab.
(function () {
  'use strict';
  var frames = document.querySelectorAll('[data-player]');
  Array.prototype.forEach.call(frames, function (box) {
    var play = box.querySelector('[data-play]');
    var bar = box.parentNode.querySelector('.player-bar');
    var fsBtn = bar && bar.querySelector('[data-fullscreen]');
    var iframe = null;

    if (fsBtn && document.fullscreenEnabled) fsBtn.hidden = false;

    function load(event) {
      if (event) event.preventDefault();
      if (iframe) return;
      iframe = document.createElement('iframe');
      iframe.src = box.getAttribute('data-src');
      iframe.title = box.getAttribute('data-title') || 'Game demo';
      iframe.setAttribute('allow', 'fullscreen; gamepad; xr-spatial-tracking; autoplay');
      iframe.setAttribute('allowfullscreen', '');
      box.classList.add('is-loaded');
      box.textContent = '';
      box.appendChild(iframe);
      iframe.addEventListener('load', function () { iframe.focus(); });
    }

    if (play) play.addEventListener('click', load);
    if (fsBtn) {
      fsBtn.addEventListener('click', function () {
        if (!iframe) load();
        var target = iframe;
        if (target.requestFullscreen) target.requestFullscreen().catch(function () {});
      });
    }
  });
})();
