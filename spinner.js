/* ============================================================
   Berlin Treasures — hero can interactions
   Two separate gestures on the big hero can:
     1. Grab the dead center of the can → it lifts (bigger shadow +
        scale) and follows your finger/mouse (damped), then snaps
        back exactly home on release.
     2. Swipe anywhere else — the ring around the can, or the rest
        of the hero column, but not the Telegram button — spins the
        can like a fidget spinner, with inertia decay and a settle
        back to upright.
   Haptics (Vibration API, where supported) fire on pickup/release
   for the lift, and on ratchet "ticks" + flick-release for the spin.
   ============================================================ */
(function () {
  'use strict';

  var hero = document.querySelector('.hero');
  var wrap = document.getElementById('heroCan');
  var img = wrap ? wrap.querySelector('img') : null;
  var spinZone = document.getElementById('spinZone');
  if (!hero || !wrap || !img) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function vibrate(ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) { /* ignore unsupported/blocked calls */ }
    }
  }

  /* ==================================================================
     1. Grab-and-lift: only when the gesture starts near the center of
        the can. It follows the pointer 1:1, free to go anywhere on
        screen (only clamped so it can't be dragged past the viewport
        edge), then eases back to exactly its resting position on
        release.
     ================================================================== */
  var LIFT_ZONE_FRACTION = 0.32;  // normalized radius (of the can's half-size) that counts as "center"
  var DRAG_DAMPING       = 1;     // 1:1 — the can tracks the pointer exactly

  var lifting = false;
  var liftStartX = 0, liftStartY = 0;
  var liftMinDx = -Infinity, liftMaxDx = Infinity;
  var liftMinDy = -Infinity, liftMaxDy = Infinity;

  // true only when the pointer is within the central "core" of the can —
  // everything outside that (but still visually on the can) is the spin ring
  function isInLiftZone(clientX, clientY) {
    var rect = wrap.getBoundingClientRect();
    var nx = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    var ny = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    return (nx * nx + ny * ny) <= LIFT_ZONE_FRACTION * LIFT_ZONE_FRACTION;
  }

  function liftRender(dx, dy, scale) {
    wrap.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(' + scale + ')';
  }

  function onLiftDown(e) {
    if (!isInLiftZone(e.clientX, e.clientY)) return;   // outside the core — let it bubble up to the spin handler
    lifting = true;
    liftStartX = e.clientX;
    liftStartY = e.clientY;
    // let it travel anywhere on screen, just not off the edge of the viewport
    var rect = wrap.getBoundingClientRect();
    liftMinDx = -rect.left;
    liftMaxDx = window.innerWidth - rect.right;
    liftMinDy = -rect.top;
    liftMaxDy = window.innerHeight - rect.bottom;
    wrap.style.transition = '';   // interrupt any in-progress snap-back
    wrap.classList.add('lifted');
    if (wrap.setPointerCapture) {
      try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    vibrate(6);   // little "pickup" tick
    e.stopPropagation();   // don't also let .hero's spin handler see this gesture
  }

  function onLiftMove(e) {
    if (!lifting) return;
    var dx = Math.max(liftMinDx, Math.min(liftMaxDx, (e.clientX - liftStartX) * DRAG_DAMPING));
    var dy = Math.max(liftMinDy, Math.min(liftMaxDy, (e.clientY - liftStartY) * DRAG_DAMPING));
    liftRender(dx, dy, 1.06);
    e.stopPropagation();
  }

  function onLiftUp(e) {
    if (!lifting) return;
    lifting = false;
    if (reduceMotion) {
      liftRender(0, 0, 1);
      wrap.classList.remove('lifted');
      return;
    }
    wrap.style.transition = 'transform 480ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    liftRender(0, 0, 1);   // always eases back to exactly its original position
    vibrate(10);   // little "drop" buzz as it springs back
    var onEnd = function () {
      wrap.style.transition = '';
      wrap.classList.remove('lifted');
      wrap.removeEventListener('transitionend', onEnd);
    };
    wrap.addEventListener('transitionend', onEnd);
    if (e) e.stopPropagation();
  }

  wrap.addEventListener('pointerdown', onLiftDown);
  wrap.addEventListener('pointermove', onLiftMove);
  wrap.addEventListener('pointerup', onLiftUp);
  wrap.addEventListener('pointercancel', onLiftUp);

  /* ==================================================================
     2. Swipe-to-spin: a directional swipe that starts near the can
        (the ring around its core, not the whole hero column) spins
        the can's rotation. Inertia decays like a fidget spinner, then
        it eases back to its upright orientation. Gestures that start
        elsewhere in the hero (over the title, quote, Telegram button,
        etc.) are left alone so they don't hijack scrolling/clicking.
     ================================================================== */
  var SPIN_ZONE_FRACTION = 1.5;   // normalized radius (of the can's half-size) that still counts as "around the can"
  var TICK_STEP       = 45;     // degrees between haptic "ratchet" clicks
  var FRICTION        = 0.985;  // per-16.7ms-frame velocity decay while free-spinning
  var MIN_VELOCITY    = 0.006;  // deg/ms — below this, the free-spin loop stops
  var FLICK_MIN_VEL   = 0.03;   // deg/ms — minimum release speed that keeps it spinning
  var SETTLE_MS       = 550;    // ease-back-to-upright duration once it stops
  var SPIN_SENSITIVITY = 0.6;   // degrees of spin per pixel of horizontal swipe

  var angle = 0;         // accumulated rotation, degrees (unwrapped)
  var velocity = 0;      // deg / ms
  var spinning = false;
  var lastX = 0, lastTime = 0;
  var lastTickUnit = 0;
  var spinFrame = null;

  function render() {
    img.style.transform = 'rotate(' + angle + 'deg)';
  }

  // fires a short haptic click each time we cross a ratchet notch,
  // like the detents on a real fidget spinner
  function tick() {
    var unit = Math.floor(Math.abs(angle) / TICK_STEP);
    if (unit !== lastTickUnit) {
      lastTickUnit = unit;
      if (Math.abs(velocity) > 0.01) vibrate(5);
    }
  }

  function cancelSpin() {
    if (spinFrame) { cancelAnimationFrame(spinFrame); spinFrame = null; }
  }

  // once it stops moving, ease it back to the artwork's upright orientation
  // (nearest multiple of 360deg) instead of leaving it resting crooked
  function settle() {
    var target = Math.round(angle / 360) * 360;
    if (target === angle || reduceMotion) {
      angle = 0;
      render();
      return;
    }
    img.style.transition = 'transform ' + SETTLE_MS + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
    angle = target;
    render();
    var onEnd = function () {
      img.style.transition = '';
      img.removeEventListener('transitionend', onEnd);
      angle = 0;   // normalize so the accumulator never drifts across many spins
      render();
    };
    img.addEventListener('transitionend', onEnd);
  }

  function spin() {
    if (reduceMotion) { settle(); return; }
    cancelSpin();
    var last = performance.now();
    function step(now) {
      var dt = Math.min(now - last, 48);
      last = now;
      angle += velocity * dt;
      velocity *= Math.pow(FRICTION, dt / 16.6667);
      render();
      tick();
      if (Math.abs(velocity) > MIN_VELOCITY) {
        spinFrame = requestAnimationFrame(step);
      } else {
        velocity = 0;
        spinFrame = null;
        settle();
      }
    }
    spinFrame = requestAnimationFrame(step);
  }

  // ignore gestures that start on the Telegram button — gestures on the
  // can's own center are already stopped from propagating by the lift
  // handler above, so anything that reaches here (including the ring
  // around the can's core) is fair game for spinning
  function isExcluded(target) {
    return !!(target.closest && target.closest('.telegram'));
  }

  // only spin when the gesture starts within a ring around the can —
  // not anywhere in the hero column — so the rest of the page (title,
  // quote, scrolling, etc.) stays untouched
  function isNearCan(clientX, clientY) {
    var rect = wrap.getBoundingClientRect();
    var nx = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    var ny = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    return (nx * nx + ny * ny) <= SPIN_ZONE_FRACTION * SPIN_ZONE_FRACTION;
  }

  // #spinZone is the only element that visibly covers the ring around the
  // can (everywhere else there falls through to the physics canvas), so
  // keep it sized/positioned to match the circle isNearCan checks against
  function updateSpinZone() {
    if (!spinZone) return;
    var rect = wrap.getBoundingClientRect();
    var d = Math.max(rect.width, rect.height) * SPIN_ZONE_FRACTION;
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    spinZone.style.width = d + 'px';
    spinZone.style.height = d + 'px';
    spinZone.style.left = (cx - d / 2) + 'px';
    spinZone.style.top = (cy - d / 2) + 'px';
  }
  updateSpinZone();
  window.addEventListener('resize', updateSpinZone);

  function onSpinDown(e) {
    if (isExcluded(e.target) || !isNearCan(e.clientX, e.clientY)) return;
    cancelSpin();
    img.style.transition = '';   // interrupt any in-progress settle animation
    spinning = true;
    velocity = 0;
    lastX = e.clientX;
    lastTime = performance.now();
    if (e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
  }

  function onSpinMove(e) {
    if (!spinning) return;
    var now = performance.now();
    // flipped so the can turns the way the swipe actually drags it around
    var delta = (lastX - e.clientX) * SPIN_SENSITIVITY;
    var dt = Math.max(now - lastTime, 1);

    angle += delta;
    // smooth the instantaneous velocity a bit so a jittery last sample
    // doesn't dictate the whole release throw
    velocity = velocity * 0.5 + (delta / dt) * 0.5;

    lastX = e.clientX;
    lastTime = now;
    render();
    tick();
  }

  function onSpinUp(e) {
    if (!spinning) return;
    spinning = false;
    if (Math.abs(velocity) > FLICK_MIN_VEL) {
      vibrate(Math.min(35, 10 + Math.abs(velocity) * 60));   // flick-release buzz, scaled with speed
      spin();
    } else {
      velocity = 0;
      settle();
    }
  }

  // "hero" catches swipes that start directly on the can's own artwork
  // (bubbled up from #heroCan, outside the tight lift-core); "spinZone"
  // catches the ring beyond the can's box, which otherwise falls through
  // straight to the physics canvas
  hero.addEventListener('pointerdown', onSpinDown);
  hero.addEventListener('pointermove', onSpinMove);
  hero.addEventListener('pointerup', onSpinUp);
  hero.addEventListener('pointercancel', onSpinUp);

  if (spinZone) {
    spinZone.addEventListener('pointerdown', onSpinDown);
    spinZone.addEventListener('pointermove', onSpinMove);
    spinZone.addEventListener('pointerup', onSpinUp);
    spinZone.addEventListener('pointercancel', onSpinUp);
  }
})();
